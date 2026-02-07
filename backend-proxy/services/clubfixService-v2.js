/**
 * ClubFix API REST Service - v2.0
 * 
 * Documentação Oficial: https://docs.clubfix.com.br/api-reference/introduction
 * 
 * IMPLEMENTAÇÃO CONFORME DOCUMENTAÇÃO OFICIAL:
 * - URL Base Produção: https://clubfix.com.br/webservice
 * - Endpoint de Autenticação: POST /auth/login
 * - Header X-CREDENTIALS: Base64 de [email]:[password]
 * - Body: { client_id, client_secret }
 * - Todas as requisições subsequentes: Authorization: Bearer <token>
 */

const axios = require('axios');

class ClubFixServiceV2 {
    constructor() {
        // Configurações de ambiente
        this.baseURL = process.env.CLUBFIX_BASE_URL || 'https://clubfix.com.br/webservice';
        this.email = process.env.CLUBFIX_EMAIL;
        this.password = process.env.CLUBFIX_PASSWORD;
        this.clientId = process.env.CLUBFIX_CLIENT_ID;
        this.clientSecret = process.env.CLUBFIX_CLIENT_SECRET;

        // Validar credenciais
        if (!this.email || !this.password) {
            console.error('❌ ERRO: Variáveis CLUBFIX_EMAIL e CLUBFIX_PASSWORD não configuradas!');
        }
        if (!this.clientId || !this.clientSecret) {
            console.error('❌ ERRO: Variáveis CLUBFIX_CLIENT_ID e CLUBFIX_CLIENT_SECRET não configuradas!');
        }

        // Estado do token
        this.token = {
            accessToken: null,
            expiresAt: null
        };

        // Cache inteligente
        this.cache = {
            brands: [],
            models: {},
            plans: {},
            lastUpdate: null
        };

        // Cliente HTTP
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('🚀 ClubFix Service v2.0 inicializado');
        console.log('📡 Base URL:', this.baseURL);
    }

    /**
     * Autenticação conforme documentação oficial ClubFix
     * POST /auth/login
     * Header: X-CREDENTIALS com Base64 de email:password
     * Body: { client_id, client_secret }
     */
    async authenticate() {
        try {
            console.log('\n🔐 Autenticando na API ClubFix (Produção)...');
            console.log('📡 Base URL:', this.baseURL);
            console.log('📧 Email:', this.email);
            console.log('🔑 Client ID:', this.clientId);

            // Criar X-CREDENTIALS conforme documentação: Base64 de email:password
            const credentials = `${this.email}:${this.password}`;
            const base64Credentials = Buffer.from(credentials).toString('base64');
            
            console.log(`🔐 X-CREDENTIALS: ${this.email}:${'*'.repeat(this.password.length)} (Base64 encoded)`);

            // Fazer requisição de autenticação
            const response = await this.client.post('/auth/login', {
                client_id: this.clientId,
                client_secret: this.clientSecret
            }, {
                headers: {
                    'X-CREDENTIALS': base64Credentials
                }
            });

            // Processar resposta
            const { access_token, token_type, expires_in } = response.data;

            if (!access_token) {
                throw new Error('Token de acesso não retornado pela API');
            }

            // Armazenar token com margem de segurança de 5 minutos
            this.token.accessToken = access_token;
            this.token.expiresAt = Date.now() + ((expires_in || 3600) - 300) * 1000;

            // Configurar header de autorização para todas as próximas requisições
            this.client.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

            console.log('✅ Autenticação bem-sucedida!');
            console.log(`🎫 Token obtido (expira em ${expires_in || 3600}s)`);
            console.log(`⏰ Válido até: ${new Date(this.token.expiresAt).toLocaleString()}`);

            return true;

        } catch (error) {
            console.error('❌ Erro na autenticação:', error.message);
            
            if (error.response) {
                console.error('📊 Status:', error.response.status);
                console.error('📦 Data:', JSON.stringify(error.response.data, null, 2));
            }

            throw new Error('Falha na autenticação com ClubFix API');
        }
    }

    /**
     * Garantir que está autenticado antes de fazer requisições
     */
    async ensureAuthenticated() {
        // Se não tem token ou está expirado, autenticar
        if (!this.token.accessToken || Date.now() >= this.token.expiresAt) {
            console.log('🔄 Token expirado ou ausente, renovando...');
            await this.authenticate();
        }
    }

    /**
     * Buscar marcas (Brands)
     * GET /api-reference/devices/brands
     */
    async getBrands(page = 1, perPage = 50) {
        try {
            await this.ensureAuthenticated();

            // Verificar cache (1 hora de validade)
            const cacheAge = Date.now() - (this.cache.lastUpdate || 0);
            if (this.cache.brands.length > 0 && cacheAge < 3600000) {
                console.log('📦 Retornando marcas do cache');
                return this.cache.brands;
            }

            console.log('📱 Buscando marcas da API ClubFix...');

            const response = await this.client.get('/api-reference/devices/brands', {
                params: { page, per_page: perPage }
            });

            // Processar dados
            const brands = response.data.data || response.data || [];
            
            // Atualizar cache
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
     * Buscar modelos de uma marca
     * GET /api-reference/devices/models
     */
    async getModels(brandId, page = 1, perPage = 100) {
        try {
            await this.ensureAuthenticated();

            // Verificar cache (1 hora de validade)
            const cacheKey = `${brandId}_${page}`;
            const cachedModels = this.cache.models[cacheKey];
            const cacheAge = Date.now() - (this.cache.lastUpdate || 0);

            if (cachedModels && cacheAge < 3600000) {
                console.log('📦 Retornando modelos do cache');
                return cachedModels;
            }

            console.log(`📱 Buscando modelos da marca ${brandId}...`);

            const response = await this.client.get('/api-reference/devices/models', {
                params: {
                    brand_id: brandId,
                    page,
                    per_page: perPage
                }
            });

            const models = response.data.data || response.data || [];

            // Atualizar cache
            this.cache.models[cacheKey] = models;
            this.cache.lastUpdate = Date.now();

            console.log(`✅ ${models.length} modelos carregados`);

            return models;

        } catch (error) {
            console.error('❌ Erro ao buscar modelos:', error.message);
            throw error;
        }
    }

    /**
     * Buscar detalhes de um modelo específico
     * GET /api-reference/devices/models/show
     */
    async getModelById(modelId) {
        try {
            await this.ensureAuthenticated();

            console.log(`📱 Buscando detalhes do modelo ${modelId}...`);

            const response = await this.client.get(`/api-reference/devices/models/show/${modelId}`);
            const model = response.data;

            console.log(`✅ Modelo carregado: ${model.name || modelId}`);

            return model;

        } catch (error) {
            console.error('❌ Erro ao buscar modelo:', error.message);
            throw error;
        }
    }

    /**
     * Obter cotação de proteção para um modelo
     * GET /api-reference/subscriptions/quotation
     */
    async getQuotation(modelId, isUsed = false) {
        try {
            await this.ensureAuthenticated();

            // Verificar cache (30 minutos)
            const cacheKey = `quotation_${modelId}_${isUsed}`;
            const cachedQuotation = this.cache.plans[cacheKey];
            const cacheAge = Date.now() - (this.cache.lastUpdate || 0);

            if (cachedQuotation && cacheAge < 1800000) {
                console.log('📦 Retornando cotação do cache');
                return cachedQuotation;
            }

            console.log(`💰 Buscando cotação para modelo ${modelId}...`);

            const response = await this.client.get('/api-reference/subscriptions/quotation', {
                params: {
                    model_id: modelId,
                    is_used: isUsed
                }
            });

            const quotation = response.data;

            // Atualizar cache
            this.cache.plans[cacheKey] = quotation;
            this.cache.lastUpdate = Date.now();

            console.log('✅ Cotação obtida com sucesso');

            return quotation;

        } catch (error) {
            console.error('❌ Erro ao buscar cotação:', error.message);
            throw error;
        }
    }

    /**
     * Criar ou verificar cliente
     * POST /api-reference/customers/post
     */
    async createCustomer(customerData) {
        try {
            await this.ensureAuthenticated();

            console.log('👤 Criando/verificando cliente...');

            // Verificar se cliente já existe pelo documento
            try {
                const existingCustomer = await this.client.get(
                    `/api-reference/customers/show/${customerData.document}`
                );

                if (existingCustomer.data) {
                    console.log('✅ Cliente já existe, retornando dados');
                    return existingCustomer.data;
                }
            } catch (err) {
                // Cliente não existe, continuar com a criação
            }

            // Criar novo cliente
            const response = await this.client.post('/api-reference/customers/post', customerData);

            console.log('✅ Cliente criado com sucesso');

            return response.data;

        } catch (error) {
            console.error('❌ Erro ao criar cliente:', error.message);
            throw error;
        }
    }

    /**
     * Criar assinatura de proteção
     * POST /api-reference/subscriptions/post
     */
    async createSubscription(subscriptionData) {
        try {
            await this.ensureAuthenticated();

            console.log('📝 Criando assinatura...');

            const response = await this.client.post(
                '/api-reference/subscriptions/post',
                subscriptionData
            );

            console.log('✅ Assinatura criada com sucesso');

            return response.data;

        } catch (error) {
            console.error('❌ Erro ao criar assinatura:', error.message);
            throw error;
        }
    }

    /**
     * Processar pagamento via Pix
     * POST /api-reference/subscriptions/payment
     */
    async processPaymentPix(subscriptionId) {
        try {
            await this.ensureAuthenticated();

            console.log('💳 Processando pagamento Pix...');

            const response = await this.client.post('/api-reference/subscriptions/payment', {
                subscription_id: subscriptionId,
                payment_method: 'pix'
            });

            console.log('✅ QR Code Pix gerado com sucesso');

            return response.data;

        } catch (error) {
            console.error('❌ Erro ao processar pagamento Pix:', error.message);
            throw error;
        }
    }

    /**
     * Processar pagamento via Cartão de Crédito
     * POST /api-reference/subscriptions/payment
     */
    async processPaymentCreditCard(subscriptionId, cardData) {
        try {
            await this.ensureAuthenticated();

            console.log('💳 Processando pagamento com cartão...');

            const response = await this.client.post('/api-reference/subscriptions/payment', {
                subscription_id: subscriptionId,
                payment_method: 'credit_card',
                card: cardData
            });

            console.log('✅ Pagamento processado com sucesso');

            return response.data;

        } catch (error) {
            console.error('❌ Erro ao processar pagamento:', error.message);
            throw error;
        }
    }

    /**
     * Buscar assinatura por ID
     * GET /api-reference/subscriptions/show
     */
    async getSubscription(subscriptionId) {
        try {
            await this.ensureAuthenticated();

            console.log(`📋 Buscando assinatura ${subscriptionId}...`);

            const response = await this.client.get(
                `/api-reference/subscriptions/show/${subscriptionId}`
            );

            console.log('✅ Assinatura encontrada');

            return response.data;

        } catch (error) {
            console.error('❌ Erro ao buscar assinatura:', error.message);
            throw error;
        }
    }

    /**
     * Limpar cache
     */
    clearCache() {
        this.cache = {
            brands: [],
            models: {},
            plans: {},
            lastUpdate: null
        };
        console.log('🗑️ Cache limpo');
    }

    /**
     * Obter informações do serviço
     */
    getInfo() {
        return {
            baseURL: this.baseURL,
            authenticated: !!this.token.accessToken,
            tokenExpiresAt: this.token.expiresAt,
            cacheSize: {
                brands: this.cache.brands.length,
                models: Object.keys(this.cache.models).length,
                plans: Object.keys(this.cache.plans).length
            },
            lastCacheUpdate: this.cache.lastUpdate
        };
    }
}

// Exportar instância única (Singleton)
module.exports = new ClubFixServiceV2();
