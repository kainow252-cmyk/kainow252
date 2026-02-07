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
        
        console.log('📱 ClubFix Service v2.0 inicializado');
        console.log('   Base URL:', this.baseURL);
    }
    
    /**
     * 📊 INFORMAÇÕES DO SERVIÇO
     */
    getInfo() {
        return {
            baseURL: this.baseURL,
            authenticated: !!this.token.accessToken,
            tokenExpires: this.token.expiresAt ? new Date(this.token.expiresAt).toISOString() : null,
            cacheStatus: {
                brands: !!this.cache.brands,
                modelsCount: Object.keys(this.cache.models).length,
                plansCount: Object.keys(this.cache.plans).length
            }
        };
    }
    
    /**
     * 🔐 AUTENTICAÇÃO OAUTH 2.0
     */
    async authenticate() {
        try {
            console.log('🔐 Autenticando na API ClubFix...');
            console.log('   Client ID:', this.clientId ? 'Configurado' : 'FALTANDO');
            console.log('   Client Secret:', this.clientSecret ? 'Configurado' : 'FALTANDO');
            
            // Tentar múltiplos endpoints de autenticação
            const authEndpoints = [
                '/auth/login',
                '/api-reference/auth',
                '/auth'
            ];
            
            let response = null;
            let lastError = null;
            
            for (const endpoint of authEndpoints) {
                try {
                    console.log(`🔍 Tentando autenticação em: ${endpoint}`);
                    
                    response = await this.client.post(endpoint, {
                        client_id: this.clientId,
                        client_secret: this.clientSecret
                    });
                    
                    console.log(`✅ Autenticação funcionou em: ${endpoint}`);
                    break;
                } catch (error) {
                    console.log(`❌ Endpoint ${endpoint} falhou:`, error.response?.status || error.message);
                    if (error.response?.data) {
                        console.log('   Resposta:', JSON.stringify(error.response.data));
                    }
                    lastError = error;
                }
            }
            
            if (!response) {
                console.error('❌ Nenhum endpoint de autenticação funcionou');
                console.error('   Último erro:', lastError.message);
                if (lastError.response) {
                    console.error('   Status:', lastError.response.status);
                    console.error('   Dados:', lastError.response.data);
                }
                throw lastError;
            }
            
            const { access_token, expires_in } = response.data;
            
            if (!access_token) {
                console.error('❌ Token não retornado pela API');
                console.error('   Resposta:', response.data);
                throw new Error('Token não retornado pela API ClubFix');
            }
            
            // Calcular tempo de expiração (com margem de segurança de 5 minutos)
            const expiresAt = Date.now() + ((expires_in - 300) * 1000);
            
            this.token = {
                accessToken: access_token,
                expiresAt: expiresAt
            };
            
            // Atualizar header de autorização
            this.client.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            
            console.log('✅ Autenticação bem-sucedida');
            console.log(`🎫 Token obtido (expira em ${expires_in}s)`);
            
            return true;
        } catch (error) {
            console.error('❌ Erro na autenticação:', error.message);
            console.error('   Base URL:', this.baseURL);
            console.error('   Client ID presente:', !!this.clientId);
            console.error('   Client Secret presente:', !!this.clientSecret);
            throw new Error('Falha na autenticação com ClubFix API');
        }
    }
    
    /**
     * Verifica e renova token se necessário
     */
    async ensureAuthenticated() {
        if (!this.token.accessToken || Date.now() >= this.token.expiresAt) {
            console.log('🔄 Token expirado, renovando...');
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
            
            const models = response.data.data.map(model => ({
                id: model.id,
                brandId: model.brand_id,
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
            console.log('   Cliente:', subscriptionData.customer_id);
            console.log('   Plano:', subscriptionData.plan_id);
            console.log('   Modelo:', subscriptionData.model_id);
            
            const response = await this.client.post('/api-reference/subscriptions/post', {
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
            console.log('   ID:', subscription.id);
            console.log('   Status:', subscription.status);
            
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
            console.error('   Detalhes:', error.response?.data);
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
            console.log('   Assinatura:', subscriptionId);
            
            const response = await this.client.post('/api-reference/subscriptions/payment', {
                subscription_id: subscriptionId,
                payment_method: 'pix'
            });
            
            const payment = response.data.data;
            
            console.log('✅ QR Code Pix gerado com sucesso');
            console.log('   Expira em:', payment.expires_at);
            
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
            console.log('   Assinatura:', subscriptionId);
            
            const response = await this.client.post('/api-reference/subscriptions/payment', {
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
            console.log('   Status:', payment.status);
            
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
     * 📋 BUSCAR ASSINATURA
     */
    async getSubscription(subscriptionId) {
        await this.ensureAuthenticated();
        
        try {
            console.log(`📋 Buscando assinatura ${subscriptionId}...`);
            
            const response = await this.client.get('/api-reference/subscriptions/show', {
                params: { id: subscriptionId }
            });
            
            const subscription = response.data.data;
            
            return {
                id: subscription.id,
                customerId: subscription.customer_id
                planId: subscription.plan_id,
                modelId: subscription.model_id,
                status: subscription.status,
                monthlyPrice: parseFloat(subscription.monthly_price || 0),
                annualPrice: parseFloat(subscription.annual_price || 0),
                paymentStatus: subscription.payment_status,
                createdAt: subscription.created_at
            };
            
        } catch (error) {
            console.error('❌ Erro ao buscar assinatura:', error.message);
            throw error;
        }
    }
}

// Criar instância única (Singleton)
const clubfixService = new ClubFixServiceV2();

module.exports = clubfixService;
