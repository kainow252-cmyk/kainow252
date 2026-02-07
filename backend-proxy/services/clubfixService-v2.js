/**
 * ClubFix API REST Service - VERSÃO FINAL CORRETA
 * 
 * Baseado na documentação oficial da ClubFix
 * Endpoint: POST /auth/login
 * Autenticação: X-CREDENTIALS header + client_id/client_secret no body
 */

const axios = require('axios');

class ClubFixServiceV2 {
    constructor() {
        this.baseURL = process.env.CLUBFIX_BASE_URL || 'https://clubfix.com.br/webservice';
        this.email = process.env.CLUBFIX_EMAIL || 'kainow@clubfix.com.br';
        this.password = process.env.CLUBFIX_PASSWORD || 'Kainow@27923746';
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
     * 🔐 AUTENTICAÇÃO CONFORME DOCUMENTAÇÃO OFICIAL
     */
    async authenticate() {
        try {
            console.log('🔐 Autenticando na API ClubFix (Produção)...');
            console.log('   Base URL:', this.baseURL);
            console.log('   Email:', this.email);
            console.log('   Client ID:', this.clientId);
            
            // Criar X-CREDENTIALS: Base64(email:password)
            const credentials = Buffer.from(`${this.email}:${this.password}`).toString('base64');
            
            console.log('   X-CREDENTIALS:', `${this.email}:******* (Base64 encoded)`);
            
            // Fazer requisição conforme documentação
            const response = await axios.post(
                `${this.baseURL}/auth/login`,
                {
                    client_id: this.clientId,
                    client_secret: this.clientSecret
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CREDENTIALS': credentials
                    },
                    timeout: 30000
                }
            );
            
            const { access_token, token_type, expires_in } = response.data;
            
            if (access_token) {
                // Calcular expiração (com margem de 5 minutos)
                const expiresAt = Date.now() + ((expires_in - 300) * 1000);
                
                this.token = {
                    accessToken: access_token,
                    expiresAt: expiresAt
                };
                
                // Configurar token para próximas requisições
                this.client.defaults.headers.common['Authorization'] = `${token_type} ${access_token}`;
                
                console.log('✅ Autenticação bem-sucedida!');
                console.log(`   Token type: ${token_type}`);
                console.log(`   Expira em: ${expires_in}s`);
                
                return true;
            }
            
            throw new Error('Token não retornado pela API');
            
        } catch (error) {
            console.error('❌ Erro na autenticação:', error.message);
            if (error.response) {
                console.error('   Status:', error.response.status);
                console.error('   Data:', JSON.stringify(error.response.data));
            }
            throw new Error('Falha na autenticação com ClubFix API');
        }
    }
    
    async ensureAuthenticated() {
        if (!this.token.accessToken || Date.now() >= this.token.expiresAt) {
            await this.authenticate();
        }
    }
    
    /**
     * 📱 LISTAR MARCAS
     */
    async getBrands(page = 1, perPage = 50) {
        if (this.cache.brands && 
            this.cache.lastUpdate && 
            (Date.now() - this.cache.lastUpdate) < 3600000) {
            console.log('📦 Usando marcas do cache');
            return this.cache.brands;
        }
        
        await this.ensureAuthenticated();
        
        try {
            console.log('📱 Buscando marcas...');
            
            const response = await this.client.get('/brands', {
                params: { page, per_page: perPage }
            });
            
            const data = response.data.data || response.data;
            const brands = Array.isArray(data) ? data : [];
            
            const formattedBrands = brands.map(brand => ({
                id: brand.id,
                name: brand.name || brand.nome,
                status: brand.status || 'active',
                createdAt: brand.created_at || brand.criado_em
            }));
            
            this.cache.brands = formattedBrands;
            this.cache.lastUpdate = Date.now();
            
            console.log(`✅ ${formattedBrands.length} marcas carregadas`);
            return formattedBrands;
            
        } catch (error) {
            console.error('❌ Erro ao buscar marcas:', error.message);
            if (error.response) {
                console.error('   Status:', error.response.status);
                console.error('   Data:', JSON.stringify(error.response.data));
            }
            throw error;
        }
    }
    
    /**
     * 📱 LISTAR MODELOS
     */
    async getModels(brandId, page = 1, perPage = 100) {
        const cacheKey = `${brandId}_${page}`;
        
        if (this.cache.models[cacheKey]) {
            console.log(`📦 Usando modelos da marca ${brandId} do cache`);
            return this.cache.models[cacheKey];
        }
        
        await this.ensureAuthenticated();
        
        try {
            console.log(`📱 Buscando modelos da marca ${brandId}...`);
            
            const response = await this.client.get('/models', {
                params: { 
                    brand_id: brandId,
                    page,
                    per_page: perPage
                }
            });
            
            const data = response.data.data || response.data;
            const models = Array.isArray(data) ? data : [];
            
            const formattedModels = models.map(model => ({
                id: model.id,
                brandId: model.brand_id || model.marca_id,
                name: model.name || model.nome,
                lmi: parseFloat(model.lmi || 0),
                status: model.status || 'active'
            }));
            
            this.cache.models[cacheKey] = formattedModels;
            
            console.log(`✅ ${formattedModels.length} modelos carregados`);
            return formattedModels;
            
        } catch (error) {
            console.error('❌ Erro ao buscar modelos:', error.message);
            throw error;
        }
    }
    
    /**
     * 💰 BUSCAR COTAÇÃO
     */
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
            
            const response = await this.client.get('/quotation', {
                params: { 
                    model_id: modelId,
                    is_used: isUsed
                }
            });
            
            const quotationData = response.data.data || response.data;
            
            const quotation = {
                model: {
                    id: quotationData.model?.id || modelId,
                    name: quotationData.model?.name || quotationData.model?.nome,
                    brand: quotationData.model?.brand || quotationData.model?.marca,
                    lmi: parseFloat(quotationData.model?.lmi || 0)
                },
                plans: (quotationData.plans || quotationData.planos || []).map(plan => ({
                    id: plan.id,
                    name: plan.name || plan.nome,
                    monthlyPrice: parseFloat(plan.monthly_price || plan.preco_mensal || 0),
                    annualPrice: parseFloat(plan.annual_price || plan.preco_anual || 0),
                    franchisePercentage: parseFloat(plan.franchise_percentage || plan.percentual_franquia || 0),
                    coverage: plan.coverage || plan.cobertura || [],
                    lmi: parseFloat(plan.lmi || quotationData.model?.lmi || 0)
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
            const response = await this.client.post('/customers', customerData);
            return response.data.data || response.data;
        } catch (error) {
            console.error('❌ Erro ao criar cliente:', error.message);
            throw error;
        }
    }
    
    async createSubscription(subscriptionData) {
        await this.ensureAuthenticated();
        try {
            const response = await this.client.post('/subscriptions', subscriptionData);
            return response.data.data || response.data;
        } catch (error) {
            console.error('❌ Erro ao criar assinatura:', error.message);
            throw error;
        }
    }
    
    async processPaymentPix(subscriptionId) {
        await this.ensureAuthenticated();
        try {
            const response = await this.client.post('/payments', {
                subscription_id: subscriptionId,
                payment_method: 'pix'
            });
            return response.data.data || response.data;
        } catch (error) {
            console.error('❌ Erro ao gerar Pix:', error.message);
            throw error;
        }
    }
    
    async processPaymentCreditCard(subscriptionId, cardData) {
        await this.ensureAuthenticated();
        try {
            const response = await this.client.post('/payments', {
                subscription_id: subscriptionId,
                payment_method: 'credit_card',
                card: cardData
            });
            return response.data.data || response.data;
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
