/**
 * ClubFix API REST Service - v2.0
 * 
 * Implementação oficial usando API REST da ClubFix
 * Documentação: https://docs.clubfix.com.br/api-reference/introduction
 * 
 * Recursos:
 * - OAuth 2.0 Authentication
 * - RESTful API endpoints
 * - Cache inteligente
 * - Renovação automática de token
 * - Fallback automático de endpoints
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
            
            const response = await this.client.post('/api-reference/auth', {
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
            console.log('📱 Buscando marcas...');
            
            const response = await this.client.get('/api-reference/devices/brands', {
                params: { page, per_page: perPage }
            });
            
            const brands = response.data.data.map(brand => ({
                id: brand.id,
                name: brand.name,
                status: brand.status,
                createdAt: brand.created_at
            }));
            
            // Salvar no cache
            this.cache.brands = brands;
            this.cache.lastUpdate = Date.now();
            
            console.log(`✅ ${brands.length} marcas carregadas`);
            return brands;
            
        } catch (error) {
            console.error('❌ Erro ao buscar marcas:', error.message);
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
            
            // Testar múltiplos endpoints (documentação inconsistente)
            const endpoints = [
                { path: '/models', params: { 'filter[brand]': brandId, page, per_page: perPage } },
                { path: '/api-reference/devices/models', params: { brand_id: brandId, page, per_page: perPage } },
                { path: `/brands/${brandId}`, params: { include: 'models', page, per_page: perPage } }
            ];
            
            let response = null;
            let lastError = null;
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`🔍 Tentando endpoint: ${endpoint.path}`);
                    response = await this.client.get(endpoint.path, { params: endpoint.params });
                    console.log(`✅ Endpoint funcionou: ${endpoint.path}`);
                    break;
                } catch (error) {
                    console.log(`❌ Endpoint ${endpoint.path} falhou: ${error.response?.status || error.message}`);
                    lastError = error;
                }
            }
            
            if (!response) {
                console.error('❌ Nenhum endpoint de modelos funcionou');
                throw lastError || new Error('Nenhum endpoint de modelos funcionou');
            }
            
            // Extrair modelos (pode estar em data.data ou data.models)
            let modelsData = response.data.data;
            if (!modelsData && response.data.models) {
                modelsData = response.data.models;
            }
            
            const models = modelsData.map(model => ({
                id: model.id,
                brandId: model.brand_id || brandId,
                name: model.name,
                lmi: parseFloat(model.lmi || 0),
                status: model.status
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
     * 📱 DISPOSITIVO ESPECÍFICO
     */
    async getModelById(modelId) {
        await this.ensureAuthenticated();
        
        try {
            console.log(`📱 Buscando modelo ${modelId}...`);
            
            const response = await this.client.get(`/api-reference/devices/models/show`, {
                params: { id: modelId }
            });
            
            const model = response.data.data;
            
            return {
                id: model.id,
                brandId: model.brand_id,
                name: model.name,
                lmi: parseFloat(model.lmi || 0),
                status: model.status
            };
            
        } catch (error) {
            console.error('❌ Erro ao buscar modelo:', error.message);
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
            
            // Testar múltiplos endpoints de cotação
            const endpoints = [
                { path: '/quotation', params: { model_id: modelId, is_used: isUsed } },
                { path: '/plans/quotation', params: { model_id: modelId, is_used: isUsed } },
                { path: '/subscriptions/quotation', params: { model_id: modelId, is_used: isUsed } },
                { path: '/api-reference/subscriptions/quotation', params: { model_id: modelId, is_used: isUsed } }
            ];
            
            let response = null;
            let lastError = null;
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`🔍 Tentando endpoint de cotação: ${endpoint.path}`);
                    response = await this.client.get(endpoint.path, { params: endpoint.params });
                    console.log(`✅ Endpoint de cotação funcionou: ${endpoint.path}`);
                    console.log(`📋 Resposta:`, JSON.stringify(response.data, null, 2));
                    break;
                } catch (error) {
                    console.log(`❌ Endpoint ${endpoint.path} falhou: ${error.response?.status || error.message}`);
                    lastError = error;
                }
            }
            
            if (!response) {
                console.error('❌ Nenhum endpoint de cotação funcionou');
                throw lastError || new Error('Nenhum endpoint de cotação funcionou');
            }
            
            const quotationData = response.data.data || response.data;
            
            const quotation = {
                model: {
                    id: quotationData.model?.id || modelId,
                    name: quotationData.model?.name || 'N/A',
                    brand: quotationData.model?.brand || 'N/A',
                    lmi: parseFloat(quotationData.model?.lmi || 0)
                },
                plans: (quotationData.plans || []).map(plan => ({
                    id: plan.id,
                    name: plan.name,
                    monthlyPrice: parseFloat(plan.monthly_price || plan.monthlyPrice || 0),
                    annualPrice: parseFloat(plan.annual_price || plan.annualPrice || 0),
                    franchisePercentage: parseFloat(plan.franchise_percentage || plan.franchisePercentage || 0),
                    coverage: plan.coverage || [],
                    lmi: parseFloat(plan.lmi || quotationData.model?.lmi || 0)
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
            
            // Primeiro tentar buscar cliente existente
            try {
                const existingCustomer = await this.client.get('/api-reference/customers/show', {
                    params: { document: customerData.document }
                });
                
                console.log('✅ Cliente já existe, usando cadastro existente');
                return existingCustomer.data.data;
            } catch (err) {
                // Cliente não existe, criar novo
                console.log('📝 Criando novo cliente...');
            }
            
            const response = await this.client.post('/api-reference/customers/post', {
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
            
            const response = await this.client.post('/api-reference/subscriptions/post', {
                customer_id: subscriptionData.customer_id,
                plan_id: subscriptionData.plan_id,
                model_id: subscriptionData.model_id,
                imei_1: subscriptionData.imei_1,
                imei_2: subscriptionData.imei_2 || null,
                invoice: subscriptionData.invoice || null,
                is_used: subscriptionData.is_used || false,
                purchase_date: subscriptionData.purchase_date || new Date().toISOString().split('T')[0]
            });
            
            console.log('✅ Assinatura criada com sucesso');
            return response.data.data;
            
        } catch (error) {
            console.error('❌ Erro ao criar assinatura:', error.message);
            throw error;
        }
    }
    
    /**
     * 💳 PROCESSAR PAGAMENTO PIX
     */
    async processPixPayment(subscriptionId) {
        await this.ensureAuthenticated();
        
        try {
            console.log('💳 Processando pagamento PIX...');
            
            const response = await this.client.post('/api-reference/payments/pix', {
                subscription_id: subscriptionId
            });
            
            console.log('✅ QR Code PIX gerado');
            return response.data.data;
            
        } catch (error) {
            console.error('❌ Erro ao processar pagamento PIX:', error.message);
            throw error;
        }
    }
    
    /**
     * 💳 PROCESSAR PAGAMENTO CARTÃO
     */
    async processCreditCardPayment(paymentData) {
        await this.ensureAuthenticated();
        
        try {
            console.log('💳 Processando pagamento com cartão...');
            
            const response = await this.client.post('/api-reference/payments/credit-card', {
                subscription_id: paymentData.subscription_id,
                card_number: paymentData.card_number,
                card_holder: paymentData.card_holder,
                card_expiration: paymentData.card_expiration,
                card_cvv: paymentData.card_cvv,
                installments: paymentData.installments || 1
            });
            
            console.log('✅ Pagamento processado');
            return response.data.data;
            
        } catch (error) {
            console.error('❌ Erro ao processar pagamento:', error.message);
            throw error;
        }
    }
    
    /**
     * 📊 OBTER STATUS DA ASSINATURA
     */
    async getSubscriptionStatus(subscriptionId) {
        await this.ensureAuthenticated();
        
        try {
            console.log(`📊 Buscando status da assinatura ${subscriptionId}...`);
            
            const response = await this.client.get(`/api-reference/subscriptions/show`, {
                params: { id: subscriptionId }
            });
            
            return response.data.data;
            
        } catch (error) {
            console.error('❌ Erro ao buscar status:', error.message);
            throw error;
        }
    }
}

module.exports = ClubFixServiceV2;
