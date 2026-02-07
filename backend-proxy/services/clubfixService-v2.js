/**
 * ClubFix API REST Service - v2.0 CORRIGIDO
 * 
 * Implementação oficial usando API REST da ClubFix
 * Documentação: https://docs.clubfix.com.br/api-reference/introduction
 * 
 * Recursos:
 * - OAuth 2.0 Authentication
 * - RESTful API endpoints
 * - Cache inteligente
 * - Renovação automática de token
 */

const axios = require('axios');

class ClubFixServiceV2 {
    constructor() {
        // Configuração da API
        this.baseURL = process.env.CLUBFIX_BASE_URL || 'https://clubfix.com.br/webservice';
        this.clientId = process.env.CLUBFIX_CLIENT_ID;
        this.clientSecret = process.env.CLUBFIX_CLIENT_SECRET;
        
        // Token de autenticação
        this.token = {
            accessToken: null,
            expiresAt: null
        };
        
        // Cache de dados
        this.cache = {
            brands: null,
            models: {},
            plans: {},
            lastUpdate: null
        };
        
        // Cliente HTTP
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
     * 🔐 AUTENTICAÇÃO OAUTH 2.0
     */
    async authenticate() {
        try {
            console.log('🔐 Autenticando na API ClubFix...');
            console.log('   Base URL:', this.baseURL);
            console.log('   Client ID:', this.clientId ? 'Configurado' : 'NÃO CONFIGURADO');
            
            // CORREÇÃO: Usar endpoint OAuth 2.0 padrão
            const response = await this.client.post('/oauth/token', {
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret
            });
            
            const { access_token, expires_in } = response.data;
            
            // Calcular tempo de expiração (com margem de segurança de 5 minutos)
            const expiresAt = Date.now() + ((expires_in - 300) * 1000);
            
            this.token = {
                accessToken: access_token,
                expiresAt: expiresAt
            };
            
            // Atualizar header de autorização
            this.client.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            
            console.log('✅ Autenticação bem-sucedida');
            console.log(`   Token expira em: ${expires_in}s`);
            
            return true;
        } catch (error) {
            console.error('❌ Erro na autenticação:', error.message);
            if (error.response) {
                console.error('   Status:', error.response.status);
                console.error('   Dados:', error.response.data);
            }
            throw new Error('Falha na autenticação com ClubFix API');
        }
    }
    
    /**
     * Verifica e renova token se necessário
     */
    async ensureAuthenticated() {
        if (!this.token.accessToken || Date.now() >= this.token.expiresAt) {
            await this.authenticate();
        }
    }
    
    /**
     * 📱 DISPOSITIVOS - MARCAS
     */
    async getBrands(page = 1, perPage = 50) {
        // Usar cache se disponível (válido por 1 hora)
        if (this.cache.brands && 
            this.cache.lastUpdate && 
            (Date.now() - this.cache.lastUpdate) < 3600000) {
            console.log('📦 Usando marcas do cache');
            return this.cache.brands;
        }
        
        await this.ensureAuthenticated();
        
        try {
            console.log('📱 Buscando marcas da API ClubFix...');
            
            // CORREÇÃO: Endpoint correto para marcas
            const response = await this.client.get('/api/v1/brands', {
                params: { page, per_page: perPage }
            });
            
            const brands = response.data.data.map(brand => ({
                id: brand.id,
                name: brand.name,
                status: brand.status || 'active',
                createdAt: brand.created_at
            }));
            
            // Salvar no cache
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
    
    /**
     * 📱 DISPOSITIVOS - MODELOS
     */
    async getModels(brandId, page = 1, perPage = 100) {
        const cacheKey = `${brandId}_${page}`;
        
        // Verificar cache
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
            
            // Salvar no cache
            this.cache.models[cacheKey] = models;
            
            console.log(`✅ ${models.length} modelos carregados`);
            return models;
            
        } catch (error) {
            console.error('❌ Erro ao buscar modelos:', error.message);
            throw error;
        }
    }
    
    /**
     * 💰 COTAÇÃO (PLANOS)
     */
    async getQuotation(modelId, isUsed = false) {
        const cacheKey = `${modelId}_${isUsed}`;
        
        // Verificar cache (válido por 30 minutos)
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
            
            // Salvar no cache
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
    
    /**
     * 👤 CRIAR/OBTER CLIENTE
     */
    async createCustomer(customerData) {
        await this.ensureAuthenticated();
        
        try {
            console.log('👤 Criando/verificando cliente...');
            
            const response = await this.client.post('/api/v1/customers', {
                name: customerData.name,
                document: customerData.document,
                email: customerData.email,
                phone: customerData.phone,
                zip_code: customerData.zip_code,
                street: customerData.street,
                number: customerData.number,
                complement: customerData.complement || '',
                neighborhood: customerData.neighborhood,
                city: customerData.city,
                state: customerData.state
            });
            
            console.log('✅ Cliente criado com sucesso');
            return response.data.data;
            
        } catch (error) {
            console.error('❌ Erro ao criar cliente:', error.message);
            throw error;
        }
    }
    
    /**
     * 📝 CRIAR ASSINATURA
     */
    async createSubscription(subscriptionData) {
        await this.ensureAuthenticated();
        
        try {
            console.log('📝 Criando assinatura...');
            
            const response = await this.client.post('/api/v1/subscriptions', {
                customer_id: subscriptionData.customer_id,
                plan_id: subscriptionData.plan_id,
                model_id: subscriptionData.model_id,
                imei_1: subscriptionData.imei_1,
                imei_2: subscriptionData.imei_2 || null,
                is_used: subscriptionData.is_used || false,
                observation: subscriptionData.observation || 'Contratado via ProtegMais'
            });
            
            const subscription = response.data.data;
            
            console.log('✅ Assinatura criada com sucesso');
            
            return {
                id: subscription.id,
                customerId: subscription.customer_id,
                planId: subscription.plan_id,
                modelId: subscription.model_id,
                status: subscription.status,
                monthlyPrice: parseFloat(subscription.monthly_price || 0),
                annualPrice: parseFloat(subscription.annual_price || 0),
                paymentUrl: subscription.payment_url || null,
                createdAt: subscription.created_at
            };
            
        } catch (error) {
            console.error('❌ Erro ao criar assinatura:', error.message);
            throw error;
        }
    }
    
    /**
     * 💳 PROCESSAR PAGAMENTO PIX
     */
    async processPaymentPix(subscriptionId) {
        await this.ensureAuthenticated();
        
        try {
            console.log('💳 Gerando pagamento Pix...');
            
            const response = await this.client.post('/api/v1/payments', {
                subscription_id: subscriptionId,
                payment_method: 'pix'
            });
            
            const payment = response.data.data;
            
            console.log('✅ QR Code Pix gerado com sucesso');
            
            return {
                subscriptionId: payment.subscription_id,
                paymentMethod: payment.payment_method,
                qrCode: payment.qr_code,
                qrCodeImage: payment.qr_code_image,
                expiresAt: payment.expires_at,
                status: payment.status
            };
            
        } catch (error) {
            console.error('❌ Erro ao gerar pagamento Pix:', error.message);
            throw error;
        }
    }
    
    /**
     * 💳 PROCESSAR PAGAMENTO CARTÃO DE CRÉDITO
     */
    async processPaymentCreditCard(subscriptionId, cardData) {
        await this.ensureAuthenticated();
        
        try {
            console.log('💳 Processando pagamento com cartão...');
            
            const response = await this.client.post('/api/v1/payments', {
                subscription_id: subscriptionId,
                payment_method: 'credit_card',
                card: {
                    number: cardData.number,
                    holder: cardData.holder,
                    expiry: cardData.expiry,
                    cvv: cardData.cvv
                }
            });
            
            const payment = response.data.data;
            
            console.log('✅ Pagamento processado com sucesso');
            
            return {
                subscriptionId: payment.subscription_id,
                paymentMethod: payment.payment_method,
                status: payment.status,
                transactionId: payment.transaction_id,
                message: payment.message
            };
            
        } catch (error) {
            console.error('❌ Erro ao processar pagamento:', error.message);
            throw error;
        }
    }
    
    /**
     * 🗑️ LIMPAR CACHE
     */
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
    
    /**
     * ℹ️ INFORMAÇÕES DO SERVIÇO
     */
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

// Singleton
const clubfixService = new ClubFixServiceV2();

module.exports = clubfixService;
