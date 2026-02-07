/**
 * ClubFix API REST Service - v2.0 COM FALLBACK
 * 
 * Tenta múltiplos endpoints OAuth até encontrar o correto
 */

const axios = require('axios');

class ClubFixServiceV2 {
    constructor() {
        this.baseURL = process.env.CLUBFIX_BASE_URL || 'https://clubfix.com.br/webservice';
        this.clientId = process.env.CLUBFIX_CLIENT_ID;
        this.clientSecret = process.env.CLUBFIX_CLIENT_SECRET;
        
        this.token = {
            accessToken: null,
            expiresAt: null
        };
        
        this.cache = {
            brands: null,
            models: {},
            plans: {},
            lastUpdate: null
        };
        
        // Endpoints OAuth para testar (em ordem)
        this.oauthEndpoints = [
            '/api/v1/auth',
            '/oauth/token',
            '/auth',
            '/api/oauth/token',
            '/token'
        ];
        
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
    }
    
    /**
     * 🔐 AUTENTICAÇÃO COM FALLBACK
     */
    async authenticate() {
        console.log('🔐 Autenticando na API ClubFix...');
        console.log('   Base URL:', this.baseURL);
        console.log('   Client ID:', this.clientId ? 'Configurado' : 'NÃO CONFIGURADO');
        
        // Tentar cada endpoint até encontrar um que funcione
        for (const endpoint of this.oauthEndpoints) {
            try {
                console.log(`   Tentando endpoint: ${endpoint}`);
                
                const response = await this.client.post(endpoint, {
                    grant_type: 'client_credentials',
                    client_id: this.clientId,
                    client_secret: this.clientSecret
                });
                
                const { access_token, expires_in } = response.data;
                
                if (access_token) {
                    const expiresAt = Date.now() + ((expires_in - 300) * 1000);
                    
                    this.token = {
                        accessToken: access_token,
                        expiresAt: expiresAt
                    };
                    
                    this.client.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                    
                    console.log(`✅ Autenticação bem-sucedida usando: ${endpoint}`);
                    console.log(`   Token expira em: ${expires_in}s`);
                    
                    return true;
                }
                
            } catch (error) {
                console.log(`   ❌ Falhou com ${endpoint}: ${error.response?.status || error.message}`);
                // Continuar tentando próximo endpoint
                continue;
            }
        }
        
        // Se chegou aqui, nenhum endpoint funcionou
        console.error('❌ Todos os endpoints OAuth falharam!');
        throw new Error('Falha na autenticação com ClubFix API - nenhum endpoint OAuth funcionou');
    }
    
    async ensureAuthenticated() {
        if (!this.token.accessToken || Date.now() >= this.token.expiresAt) {
            await this.authenticate();
        }
    }
    
    async getBrands(page = 1, perPage = 50) {
        if (this.cache.brands && 
            this.cache.lastUpdate && 
            (Date.now() - this.cache.lastUpdate) < 3600000) {
            console.log('📦 Usando marcas do cache');
            return this.cache.brands;
        }
        
        await this.ensureAuthenticated();
        
        try {
            console.log('📱 Buscando marcas da API ClubFix...');
            
            const response = await this.client.get('/api/v1/brands', {
                params: { page, per_page: perPage }
            });
            
            const brands = response.data.data.map(brand => ({
                id: brand.id,
                name: brand.name,
                status: brand.status || 'active',
                createdAt: brand.created_at
            }));
            
            this.cache.brands = brands;
            this.cache.lastUpdate = Date.now();
            
            console.log(`✅ ${brands.length} marcas carregadas com sucesso`);
            return brands;
            
        } catch (error) {
            console.error('❌ Erro ao buscar marcas:', error.message);
            if (error.response) {
                console.error('   Status:', error.response.status);
                console.error('   URL:', error.config.url);
            }
            throw error;
        }
    }
    
    async getModels(brandId, page = 1, perPage = 100) {
        const cacheKey = `${brandId}_${page}`;
        
        if (this.cache.models[cacheKey]) {
            console.log(`📦 Usando modelos da marca ${brandId} do cache`);
            return this.cache.models[cacheKey];
        }
        
        await this.ensureAuthenticated();
        
        try {
            console.log(`📱 Buscando modelos da marca ${brandId}...`);
            
            const response = await this.client.get('/api/v1/models', {
                params: { 
                    brand_id: brandId,
                    page,
                    per_page: perPage
                }
            });
            
            const models = response.data.data.map(model => ({
                id: model.id,
                brandId: model.brand_id,
                name: model.name,
                lmi: parseFloat(model.lmi || 0),
                status: model.status || 'active'
            }));
            
            this.cache.models[cacheKey] = models;
            
            console.log(`✅ ${models.length} modelos carregados`);
            return models;
            
        } catch (error) {
            console.error('❌ Erro ao buscar modelos:', error.message);
            throw error;
        }
    }
    
    async getQuotation(modelId, isUsed = false) {
        const cacheKey = `${modelId}_${isUsed}`;
        
        if (this.cache.plans[cacheKey] && 
            this.cache.plans[cacheKey].timestamp &&
            (Date.now() - this.cache.plans[cacheKey].timestamp) < 1800000) {
            console.log(`📦 Usando cotação do cache`);
            return this.cache.plans[cacheKey].data;
        }
        
        await this.ensureAuthenticated();
        
        try {
            console.log(`💰 Buscando cotação para modelo ${modelId}...`);
            
            const response = await this.client.get('/api/v1/quotation', {
                params: { 
                    model_id: modelId,
                    is_used: isUsed
                }
            });
            
            const quotationData = response.data.data;
            
            const quotation = {
                model: {
                    id: quotationData.model.id,
                    name: quotationData.model.name,
                    brand: quotationData.model.brand,
                    lmi: parseFloat(quotationData.model.lmi || 0)
                },
                plans: quotationData.plans.map(plan => ({
                    id: plan.id,
                    name: plan.name,
                    monthlyPrice: parseFloat(plan.monthly_price || 0),
                    annualPrice: parseFloat(plan.annual_price || 0),
                    franchisePercentage: parseFloat(plan.franchise_percentage || 0),
                    coverage: plan.coverage || [],
                    lmi: parseFloat(plan.lmi || quotationData.model.lmi || 0)
                }))
            };
            
            this.cache.plans[cacheKey] = {
                data: quotation,
                timestamp: Date.now()
            };
            
            console.log(`✅ ${quotation.plans.length} planos disponíveis`);
            return quotation;
            
        } catch (error) {
            console.error('❌ Erro ao buscar cotação:', error.message);
            throw error;
        }
    }
    
    async createCustomer(customerData) {
        await this.ensureAuthenticated();
        
        try {
            const response = await this.client.post('/api/v1/customers', customerData);
            return response.data.data;
        } catch (error) {
            console.error('❌ Erro ao criar cliente:', error.message);
            throw error;
        }
    }
    
    async createSubscription(subscriptionData) {
        await this.ensureAuthenticated();
        
        try {
            const response = await this.client.post('/api/v1/subscriptions', subscriptionData);
            return response.data.data;
        } catch (error) {
            console.error('❌ Erro ao criar assinatura:', error.message);
            throw error;
        }
    }
    
    async processPaymentPix(subscriptionId) {
        await this.ensureAuthenticated();
        
        try {
            const response = await this.client.post('/api/v1/payments', {
                subscription_id: subscriptionId,
                payment_method: 'pix'
            });
            return response.data.data;
        } catch (error) {
            console.error('❌ Erro ao gerar Pix:', error.message);
            throw error;
        }
    }
    
    async processPaymentCreditCard(subscriptionId, cardData) {
        await this.ensureAuthenticated();
        
        try {
            const response = await this.client.post('/api/v1/payments', {
                subscription_id: subscriptionId,
                payment_method: 'credit_card',
                card: cardData
            });
            return response.data.data;
        } catch (error) {
            console.error('❌ Erro ao processar pagamento:', error.message);
            throw error;
        }
    }
    
    clearCache() {
        console.log('🗑️ Limpando cache...');
        this.cache = {
            brands: null,
            models: {},
            plans: {},
            lastUpdate: null
        };
        console.log('✅ Cache limpo');
    }
    
    getInfo() {
        return {
            baseURL: this.baseURL,
            authenticated: !!this.token.accessToken,
            tokenExpiresAt: this.token.expiresAt,
            cacheSize: {
                brands: this.cache.brands ? this.cache.brands.length : 0,
                models: Object.keys(this.cache.models).length,
                plans: Object.keys(this.cache.plans).length
            },
            lastCacheUpdate: this.cache.lastUpdate
        };
    }
}

const clubfixService = new ClubFixServiceV2();

module.exports = clubfixService;
