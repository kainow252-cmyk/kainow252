/**
 * ClubFix Service v5.0 - Baseado na Documentação Oficial do TI
 * 
 * Documentação Oficial:
 * - Auth: https://docs.clubfix.com.br/api-reference/auth
 * - Marcas: https://docs.clubfix.com.br/api-reference/devices/brands
 * - Modelos: https://docs.clubfix.com.br/api-reference/devices/models
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
        
        // Cache para otimização
        this.cache = {
            brands: null,
            models: {},
            plans: null,
            lastUpdate: null
        };

        // Cliente HTTP
        this.client = axios.create({
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        // Configurar baseURL depois da criação
        this.client.defaults.baseURL = this.baseURL;

        console.log('📱 ClubFix Service v5.0 (Docs Oficiais TI) inicializado');
        console.log(`Base URL: ${this.baseURL}`);
    }

    /**
     * Retorna informações do serviço
     */
    getInfo() {
        return {
            baseURL: this.baseURL,
            authenticated: !!this.token.accessToken,
            tokenExpiresAt: this.token.expiresAt,
            cacheStats: {
                brands: this.cache.brands ? this.cache.brands.length : 0,
                models: Object.keys(this.cache.models).length,
                lastUpdate: this.cache.lastUpdate
            }
        };
    }

    /**
     * AUTENTICAÇÃO
     * Endpoint: POST /api-reference/auth
     * Body: { client_id, client_secret }
     * Response: { access_token, token_type, expires_in }
     */
    async authenticate() {
        const email = process.env.CLUBFIX_EMAIL || 'kainow@clubfix.com.br';
        const password = process.env.CLUBFIX_PASSWORD || 'Kainow@27923746';

        if (!this.clientId || !this.clientSecret) {
            throw new Error('CLIENT_ID e CLIENT_SECRET são obrigatórios');
        }

        if (!email || !password) {
            throw new Error('EMAIL e PASSWORD são obrigatórios');
        }

        console.log('\n🔐 Autenticando na API ClubFix (Docs Oficiais)...');
        console.log(`Email: ${email}`);
        console.log(`Client ID: ${this.clientId}`);

        try {
            // Criar X-CREDENTIALS header (base64 de email:password)
            const credentials = Buffer.from(`${email}:${password}`).toString('base64');
            
            console.log('📝 Usando endpoint da documentação: POST /auth/login');
            console.log(`X-CREDENTIALS: ${credentials.substring(0, 20)}...`);

            // Endpoint conforme documentação oficial
            const response = await this.client.post('/auth/login', {
                client_id: this.clientId,
                client_secret: this.clientSecret
            }, {
                headers: {
                    'X-CREDENTIALS': credentials
                }
            });

            if (response.data && response.data.access_token) {
                this.token.accessToken = response.data.access_token;
                
                // A resposta tem expires_in como string de data
                // Calcular expiração (padrão: 1 hora - 5 min de margem)
                const expiresIn = 3600; // 1 hora
                this.token.expiresAt = Date.now() + ((expiresIn - 300) * 1000);
                
                // Configurar token no header
                this.client.defaults.headers['Authorization'] = `Bearer ${this.token.accessToken}`;
                
                console.log('✅ Autenticação bem-sucedida!');
                console.log(`Token: ${this.token.accessToken.substring(0, 20)}...`);
                console.log(`Token expira em: ${response.data.expires_in || '1 hora'}`);
                
                return true;
            }

            throw new Error('Resposta de autenticação inválida');

        } catch (error) {
            console.error('❌ Erro na autenticação:');
            console.error(`Status: ${error.response?.status}`);
            console.error(`Status Text: ${error.response?.statusText}`);
            console.error(`URL: ${this.baseURL}/auth/login`);
            console.error(`Dados da resposta:`, JSON.stringify(error.response?.data, null, 2));
            console.error(`Mensagem: ${error.response?.data?.message || error.message}`);
            
            throw new Error('Falha na autenticação com ClubFix API');
        }
    }

    /**
     * Verifica se o token está válido
     */
    isTokenValid() {
        if (!this.token.accessToken) return false;
        if (!this.token.expiresAt) return false;
        return Date.now() < this.token.expiresAt;
    }

    /**
     * Garante autenticação válida antes das requisições
     */
    async ensureAuthenticated() {
        if (!this.isTokenValid()) {
            console.log('Token expirado ou ausente, renovando...');
            await this.authenticate();
        }
    }

    /**
     * LISTAR MARCAS
     * Endpoint: GET /api-reference/devices/brands
     * Headers: Authorization: Bearer {token}
     * Response: { data: [...], meta: {...} }
     */
    async getBrands(forceRefresh = false) {
        await this.ensureAuthenticated();

        // Usar cache se disponível
        if (!forceRefresh && this.cache.brands) {
            console.log('📦 Retornando marcas do cache');
            return this.cache.brands;
        }

        try {
            console.log('🔍 Buscando marcas...');
            
            const response = await this.client.get('/api-reference/devices/brands', {
                params: {
                    page: 1,
                    per_page: 100
                }
            });

            const brands = response.data?.data || response.data || [];
            
            // Atualizar cache
            this.cache.brands = brands;
            this.cache.lastUpdate = new Date().toISOString();
            
            console.log(`✅ ${brands.length} marcas encontradas`);
            
            return brands;

        } catch (error) {
            console.error('❌ Erro ao buscar marcas:');
            console.error(`Status: ${error.response?.status}`);
            console.error(`Erro: ${error.response?.data?.message || error.message}`);
            
            throw new Error('Falha ao buscar marcas');
        }
    }

    /**
     * LISTAR MODELOS
     * Endpoint: GET /api-reference/devices/models
     * Query: brand_id={id}
     * Headers: Authorization: Bearer {token}
     * Response: { data: [...], meta: {...} }
     */
    async getModels(brandId, forceRefresh = false) {
        await this.ensureAuthenticated();

        if (!brandId) {
            throw new Error('brandId é obrigatório');
        }

        // Usar cache se disponível
        if (!forceRefresh && this.cache.models[brandId]) {
            console.log(`📦 Retornando modelos da marca ${brandId} do cache`);
            return this.cache.models[brandId];
        }

        try {
            console.log(`🔍 Buscando modelos da marca ${brandId}...`);
            
            const response = await this.client.get('/api-reference/devices/models', {
                params: {
                    brand_id: brandId,
                    page: 1,
                    per_page: 100
                }
            });

            const models = response.data?.data || response.data || [];
            
            // Atualizar cache
            this.cache.models[brandId] = models;
            
            console.log(`✅ ${models.length} modelos encontrados`);
            
            return models;

        } catch (error) {
            console.error('❌ Erro ao buscar modelos:');
            console.error(`Status: ${error.response?.status}`);
            console.error(`Erro: ${error.response?.data?.message || error.message}`);
            
            throw new Error('Falha ao buscar modelos');
        }
    }

    /**
     * BUSCAR PLANOS
     * Endpoint: GET /api-reference/subscriptions/plans
     * Headers: Authorization: Bearer {token}
     */
    async getPlans(forceRefresh = false) {
        await this.ensureAuthenticated();

        // Usar cache se disponível
        if (!forceRefresh && this.cache.plans) {
            console.log('📦 Retornando planos do cache');
            return this.cache.plans;
        }

        try {
            console.log('🔍 Buscando planos...');
            
            const response = await this.client.get('/api-reference/subscriptions/plans', {
                params: {
                    page: 1,
                    per_page: 100
                }
            });

            const plans = response.data?.data || response.data || [];
            
            // Atualizar cache
            this.cache.plans = plans;
            
            console.log(`✅ ${plans.length} planos encontrados`);
            
            return plans;

        } catch (error) {
            console.error('❌ Erro ao buscar planos:');
            console.error(`Status: ${error.response?.status}`);
            console.error(`Erro: ${error.response?.data?.message || error.message}`);
            
            throw new Error('Falha ao buscar planos');
        }
    }

    /**
     * COTAÇÃO
     * Endpoint: GET /api-reference/subscriptions/quotation
     * Query: model_id={id}&is_used={boolean}
     * Headers: Authorization: Bearer {token}
     */
    async getQuotation(modelId, isUsed = false) {
        await this.ensureAuthenticated();

        if (!modelId) {
            throw new Error('modelId é obrigatório');
        }

        try {
            console.log(`🔍 Buscando cotação para modelo ${modelId}...`);
            
            const response = await this.client.get('/api-reference/subscriptions/quotation', {
                params: {
                    model_id: modelId,
                    is_used: isUsed
                }
            });

            const quotation = response.data?.data || response.data;
            
            console.log('✅ Cotação obtida com sucesso');
            
            return quotation;

        } catch (error) {
            console.error('❌ Erro ao buscar cotação:');
            console.error(`Status: ${error.response?.status}`);
            console.error(`Erro: ${error.response?.data?.message || error.message}`);
            
            throw new Error('Falha ao buscar cotação');
        }
    }

    /**
     * CRIAR CLIENTE
     * Endpoint: POST /api-reference/customers
     * Body: { name, cpf, email, phone, ... }
     * Headers: Authorization: Bearer {token}
     */
    async createCustomer(customerData) {
        await this.ensureAuthenticated();

        try {
            console.log('👤 Criando cliente...');
            
            const response = await this.client.post('/api-reference/customers', customerData);
            
            console.log('✅ Cliente criado com sucesso');
            
            return response.data;

        } catch (error) {
            console.error('❌ Erro ao criar cliente:');
            console.error(`Status: ${error.response?.status}`);
            console.error(`Erro: ${error.response?.data?.message || error.message}`);
            
            throw new Error('Falha ao criar cliente');
        }
    }

    /**
     * CRIAR ASSINATURA
     * Endpoint: POST /api-reference/subscriptions
     * Body: { customer_id, plan_id, model_id, ... }
     * Headers: Authorization: Bearer {token}
     */
    async createSubscription(subscriptionData) {
        await this.ensureAuthenticated();

        try {
            console.log('📝 Criando assinatura...');
            
            const response = await this.client.post('/api-reference/subscriptions', subscriptionData);
            
            console.log('✅ Assinatura criada com sucesso');
            
            return response.data;

        } catch (error) {
            console.error('❌ Erro ao criar assinatura:');
            console.error(`Status: ${error.response?.status}`);
            console.error(`Erro: ${error.response?.data?.message || error.message}`);
            
            throw new Error('Falha ao criar assinatura');
        }
    }

    /**
     * PAGAMENTO PIX
     * Endpoint: POST /api-reference/payment/pix
     * Body: { subscription_id, ... }
     * Headers: Authorization: Bearer {token}
     */
    async createPixPayment(paymentData) {
        await this.ensureAuthenticated();

        try {
            console.log('💰 Criando pagamento PIX...');
            
            const response = await this.client.post('/api-reference/payment/pix', paymentData);
            
            console.log('✅ Pagamento PIX criado com sucesso');
            
            return response.data;

        } catch (error) {
            console.error('❌ Erro ao criar pagamento PIX:');
            console.error(`Status: ${error.response?.status}`);
            console.error(`Erro: ${error.response?.data?.message || error.message}`);
            
            throw new Error('Falha ao criar pagamento PIX');
        }
    }

    /**
     * PAGAMENTO CARTÃO DE CRÉDITO
     * Endpoint: POST /api-reference/payment/credit-card
     * Body: { subscription_id, card_data, ... }
     * Headers: Authorization: Bearer {token}
     */
    async createCreditCardPayment(paymentData) {
        await this.ensureAuthenticated();

        try {
            console.log('💳 Criando pagamento com cartão...');
            
            const response = await this.client.post('/api-reference/payment/credit-card', paymentData);
            
            console.log('✅ Pagamento com cartão criado com sucesso');
            
            return response.data;

        } catch (error) {
            console.error('❌ Erro ao criar pagamento com cartão:');
            console.error(`Status: ${error.response?.status}`);
            console.error(`Erro: ${error.response?.data?.message || error.message}`);
            
            throw new Error('Falha ao criar pagamento com cartão');
        }
    }

    /**
     * Limpar cache
     */
    clearCache() {
        this.cache = {
            brands: null,
            models: {},
            plans: null,
            lastUpdate: null
        };
        console.log('🗑️ Cache limpo');
    }
}

// Criar instância única (singleton)
const clubfixService = new ClubFixServiceV2();

module.exports = clubfixService;
