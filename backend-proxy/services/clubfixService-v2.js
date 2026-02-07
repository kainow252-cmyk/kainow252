/**
 * ClubFix API REST Service - VERSÃO FINAL
 * 
 * Credenciais de Produção - Parceiro KAINOW
 * Base URL: https://clubfix.com.br
 */

const axios = require('axios');

class ClubFixServiceV2 {
    constructor() {
        // Base URL CORRIGIDA (sem /webservice)
        this.baseURL = process.env.CLUBFIX_BASE_URL || 'https://clubfix.com.br';
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
     * 🔐 AUTENTICAÇÃO - TENTATIVA COM MÚLTIPLOS FORMATOS
     */
    async authenticate() {
        console.log('🔐 Autenticando na API ClubFix (Produção)...');
        console.log('   Base URL:', this.baseURL);
        console.log('   Client ID:', this.clientId);
        
        // Lista de tentativas com diferentes endpoints e formatos
        const attempts = [
            // Tentativa 1: OAuth2 padrão com webservice
            {
                url: `${this.baseURL}/webservice/oauth/token`,
                method: 'POST',
                data: {
                    grant_type: 'client_credentials',
                    client_id: this.clientId,
                    client_secret: this.clientSecret
                }
            },
            // Tentativa 2: API v1 com webservice
            {
                url: `${this.baseURL}/webservice/api/v1/auth`,
                method: 'POST',
                data: {
                    client_id: this.clientId,
                    client_secret: this.clientSecret
                }
            },
            // Tentativa 3: OAuth2 sem webservice
            {
                url: `${this.baseURL}/oauth/token`,
                method: 'POST',
                data: {
                    grant_type: 'client_credentials',
                    client_id: this.clientId,
                    client_secret: this.clientSecret
                }
            },
            // Tentativa 4: API v1 sem webservice
            {
                url: `${this.baseURL}/api/v1/auth`,
                method: 'POST',
                data: {
                    client_id: this.clientId,
                    client_secret: this.clientSecret
                }
            },
            // Tentativa 5: Basic Auth
            {
                url: `${this.baseURL}/webservice/oauth/token`,
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
                },
                data: {
                    grant_type: 'client_credentials'
                }
            }
        ];
        
        for (let i = 0; i < attempts.length; i++) {
            const attempt = attempts[i];
            console.log(`   Tentativa ${i + 1}: ${attempt.url}`);
            
            try {
                const response = await axios({
                    method: attempt.method,
                    url: attempt.url,
                    data: attempt.data,
                    headers: attempt.headers || {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 30000
                });
                
                const data = response.data;
                
                // Verificar diferentes formatos de resposta
                const accessToken = data.access_token || data.token || data.accessToken;
                const expiresIn = data.expires_in || data.expiresIn || 3600;
                
                if (accessToken) {
                    const expiresAt = Date.now() + ((expiresIn - 300) * 1000);
                    
                    this.token = {
                        accessToken: accessToken,
                        expiresAt: expiresAt
                    };
                    
                    this.client.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
                    
                    console.log(`✅ SUCESSO! Endpoint que funcionou: ${attempt.url}`);
                    console.log(`   Token expira em: ${expiresIn}s`);
                    
                    return true;
                }
                
            } catch (error) {
                const status = error.response?.status || 'network error';
                const message = error.response?.data?.message || error.message;
                console.log(`   ❌ Falhou (${status}): ${message}`);
                continue;
            }
        }
        
        console.error('❌ TODAS as tentativas de autenticação falharam!');
        console.error('   Verifique as credenciais ou entre em contato com ClubFix');
        throw new Error('Falha na autenticação - todas as tentativas falharam');
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
        
        // Tentar diferentes endpoints para marcas
        const endpoints = [
            '/webservice/api/v1/brands',
            '/api/v1/brands',
            '/webservice/api/brands',
            '/api/brands'
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`📱 Tentando buscar marcas em: ${endpoint}`);
                
                const response = await this.client.get(endpoint, {
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
                
                console.log(`✅ ${formattedBrands.length} marcas carregadas de: ${endpoint}`);
                return formattedBrands;
                
            } catch (error) {
                console.log(`   ❌ Falhou em ${endpoint}: ${error.response?.status || error.message}`);
                continue;
            }
        }
        
        throw new Error('Não foi possível buscar marcas em nenhum endpoint');
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
        
        const endpoints = [
            '/webservice/api/v1/models',
            '/api/v1/models',
            '/webservice/api/models',
            '/api/models'
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`📱 Tentando buscar modelos em: ${endpoint}`);
                
                const response = await this.client.get(endpoint, {
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
                
                console.log(`✅ ${formattedModels.length} modelos carregados de: ${endpoint}`);
                return formattedModels;
                
            } catch (error) {
                console.log(`   ❌ Falhou em ${endpoint}: ${error.response?.status || error.message}`);
                continue;
            }
        }
        
        throw new Error('Não foi possível buscar modelos em nenhum endpoint');
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
        
        const endpoints = [
            '/webservice/api/v1/quotation',
            '/api/v1/quotation',
            '/webservice/api/quotation',
            '/api/quotation'
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`💰 Tentando buscar cotação em: ${endpoint}`);
                
                const response = await this.client.get(endpoint, {
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
                
                console.log(`✅ ${quotation.plans.length} planos disponíveis de: ${endpoint}`);
                return quotation;
                
            } catch (error) {
                console.log(`   ❌ Falhou em ${endpoint}: ${error.response?.status || error.message}`);
                continue;
            }
        }
        
        throw new Error('Não foi possível buscar cotação em nenhum endpoint');
    }
    
    async createCustomer(customerData) {
        await this.ensureAuthenticated();
        try {
            const response = await this.client.post('/webservice/api/v1/customers', customerData);
            return response.data.data || response.data;
        } catch (error) {
            console.error('❌ Erro ao criar cliente:', error.message);
            throw error;
        }
    }
    
    async createSubscription(subscriptionData) {
        await this.ensureAuthenticated();
        try {
            const response = await this.client.post('/webservice/api/v1/subscriptions', subscriptionData);
            return response.data.data || response.data;
        } catch (error) {
            console.error('❌ Erro ao criar assinatura:', error.message);
            throw error;
        }
    }
    
    async processPaymentPix(subscriptionId) {
        await this.ensureAuthenticated();
        try {
            const response = await this.client.post('/webservice/api/v1/payments', {
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
            const response = await this.client.post('/webservice/api/v1/payments', {
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
