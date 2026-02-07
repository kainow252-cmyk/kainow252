/**
 * ClubFix API REST Service - v2.0
 * 
 * VERSÃO CORRIGIDA: Endpoint de marcas correto
 * Documentação: https://docs.clubfix.com.br/api-reference/introduction
 */

const axios = require('axios');

class ClubFixServiceV2 {
    constructor() {
        this.baseURL = process.env.CLUBFIX_BASE_URL || 'https://clubfix.com.br/webservice';
        this.email = process.env.CLUBFIX_EMAIL;
        this.password = process.env.CLUBFIX_PASSWORD;
        this.clientId = process.env.CLUBFIX_CLIENT_ID;
        this.clientSecret = process.env.CLUBFIX_CLIENT_SECRET;

        if (!this.email || !this.password) {
            console.error('❌ ERRO: CLUBFIX_EMAIL e CLUBFIX_PASSWORD não configuradas!');
        }
        if (!this.clientId || !this.clientSecret) {
            console.error('❌ ERRO: CLUBFIX_CLIENT_ID e CLUBFIX_CLIENT_SECRET não configuradas!');
        }

        this.token = {
            accessToken: null,
            expiresAt: null
        };

        this.cache = {
            brands: [],
            models: {},
            plans: {},
            lastUpdate: null
        };

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

    async authenticate() {
        try {
            console.log('\n🔐 Autenticando na API ClubFix (Produção)...');
            console.log('📡 Base URL:', this.baseURL);
            console.log('📧 Email:', this.email);
            console.log('🔑 Client ID:', this.clientId);

            const credentials = `${this.email}:${this.password}`;
            const base64Credentials = Buffer.from(credentials).toString('base64');
            
            console.log(`🔐 X-CREDENTIALS: ${this.email}:${'*'.repeat(this.password.length)} (Base64 encoded)`);

            const response = await this.client.post('/auth/login', {
                client_id: this.clientId,
                client_secret: this.clientSecret
            }, {
                headers: {
                    'X-CREDENTIALS': base64Credentials
                }
            });

            const { access_token, token_type, expires_in } = response.data;

            if (!access_token) {
                throw new Error('Token não retornado pela API');
            }

            this.token.accessToken = access_token;
            this.token.expiresAt = Date.now() + ((expires_in || 3600) - 300) * 1000;

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

    async ensureAuthenticated() {
        if (!this.token.accessToken || Date.now() >= this.token.expiresAt) {
            console.log('🔄 Token expirado ou ausente, renovando...');
            await this.authenticate();
        }
    }

    /**
     * Buscar marcas - VERSÃO CORRIGIDA
     * Tenta múltiplos endpoints até encontrar o correto
     */
    async getBrands(page = 1, perPage = 50) {
        try {
            await this.ensureAuthenticated();

            // Verificar cache
            const cacheAge = Date.now() - (this.cache.lastUpdate || 0);
            if (this.cache.brands.length > 0 && cacheAge < 3600000) {
                console.log('📦 Retornando marcas do cache');
                return this.cache.brands;
            }

            console.log('📱 Buscando marcas da API ClubFix...');

            // Lista de endpoints possíveis (em ordem de prioridade)
            const endpoints = [
                '/devices/brands',                    // Mais provável
                '/brands',                            // Alternativa 1
                '/api/v1/devices/brands',            // Alternativa 2
                '/api-reference/devices/brands',     // Documentação
                '/api/devices/brands'                // Alternativa 3
            ];

            let brands = null;
            let successEndpoint = null;

            // Tentar cada endpoint até funcionar
            for (const endpoint of endpoints) {
                try {
                    console.log(`🔍 Tentando endpoint: ${endpoint}`);
                    
                    const response = await this.client.get(endpoint, {
                        params: { page, per_page: perPage }
                    });

                    // Processar resposta
                    brands = response.data.data || response.data || [];
                    successEndpoint = endpoint;
                    
                    console.log(`✅ Endpoint funcionou: ${endpoint}`);
                    console.log(`✅ ${brands.length} marcas carregadas`);
                    
                    break; // Sair do loop se funcionou

                } catch (err) {
                    console.log(`❌ Endpoint ${endpoint} falhou: ${err.response?.status || err.message}`);
                    continue; // Tentar próximo endpoint
                }
            }

            // Se nenhum endpoint funcionou
            if (!brands) {
                console.error('❌ TODOS os endpoints falharam!');
                throw new Error('Nenhum endpoint de marcas funcionou');
            }

            // Atualizar cache
            this.cache.brands = brands;
            this.cache.lastUpdate = Date.now();

            console.log(`\n💡 ENDPOINT CORRETO IDENTIFICADO: ${successEndpoint}`);
            console.log(`📝 Atualize o código para usar apenas este endpoint\n`);

            return brands;

        } catch (error) {
            console.error('❌ Erro ao buscar marcas:', error.message);
            throw error;
        }
    }

    async getModels(brandId, page = 1, perPage = 100) {
        try {
            await this.ensureAuthenticated();

            const cacheKey = `${brandId}_${page}`;
            const cachedModels = this.cache.models[cacheKey];
            const cacheAge = Date.now() - (this.cache.lastUpdate || 0);

            if (cachedModels && cacheAge < 3600000) {
                console.log('📦 Retornando modelos do cache');
                return cachedModels;
            }

            console.log(`📱 Buscando modelos da marca ${brandId}...`);

            // Tentar endpoints possíveis
            const endpoints = [
                `/devices/models`,
                `/models`,
                `/api/v1/devices/models`,
                `/api-reference/devices/models`
            ];

            let models = null;

            for (const endpoint of endpoints) {
                try {
                    const response = await this.client.get(endpoint, {
                        params: {
                            brand_id: brandId,
                            page,
                            per_page: perPage
                        }
                    });

                    models = response.data.data || response.data || [];
                    console.log(`✅ ${models.length} modelos carregados (${endpoint})`);
                    break;

                } catch (err) {
                    continue;
                }
            }

            if (!models) {
                throw new Error('Nenhum endpoint de modelos funcionou');
            }

            this.cache.models[cacheKey] = models;
            this.cache.lastUpdate = Date.now();

            return models;

        } catch (error) {
            console.error('❌ Erro ao buscar modelos:', error.message);
            throw error;
        }
    }

    async getModelById(modelId) {
        try {
            await this.ensureAuthenticated();

            console.log(`📱 Buscando detalhes do modelo ${modelId}...`);

            const endpoints = [
                `/devices/models/show/${modelId}`,
                `/models/show/${modelId}`,
                `/api-reference/devices/models/show/${modelId}`
            ];

            for (const endpoint of endpoints) {
                try {
                    const response = await this.client.get(endpoint);
                    const model = response.data;
                    console.log(`✅ Modelo carregado: ${model.name || modelId}`);
                    return model;
                } catch (err) {
                    continue;
                }
            }

            throw new Error('Nenhum endpoint de modelo funcionou');

        } catch (error) {
            console.error('❌ Erro ao buscar modelo:', error.message);
            throw error;
        }
    }

    async getQuotation(modelId, isUsed = false) {
        try {
            await this.ensureAuthenticated();

            const cacheKey = `quotation_${modelId}_${isUsed}`;
            const cachedQuotation = this.cache.plans[cacheKey];
            const cacheAge = Date.now() - (this.cache.lastUpdate || 0);

            if (cachedQuotation && cacheAge < 1800000) {
                console.log('📦 Retornando cotação do cache');
                return cachedQuotation;
            }

            console.log(`💰 Buscando cotação para modelo ${modelId}...`);
            
            const endpoints = [
                `/quotation`,
                `/subscriptions/quotation`,
                `/api-reference/subscriptions/quotation`
            ];
            for (const endpoint of endpoints) {
                try {
                    const response = await this.client.get(endpoint, {
                        params: {
                            model_id: modelId,
                            is_used: isUsed
                        }
                    });

                    const quotation = response.data;
                    this.cache.plans[cacheKey] = quotation;
                    this.cache.lastUpdate = Date.now();

                    console.log('✅ Cotação obtida com sucesso');
                    return quotation;

                } catch (err) {
                    continue;
                }
            }

            throw new Error('Nenhum endpoint de cotação funcionou');

        } catch (error) {
            console.error('❌ Erro ao buscar cotação:', error.message);
            throw error;
        }
    }

    async createCustomer(customerData) {
        try {
            await this.ensureAuthenticated();

            console.log('👤 Criando/verificando cliente...');

            try {
                const existingCustomer = await this.client.get(
                    `/customers/show/${customerData.document}`
                );

                if (existingCustomer.data) {
                    console.log('✅ Cliente já existe');
                    return existingCustomer.data;
                }
            } catch (err) {
                // Cliente não existe
            }

            const response = await this.client.post('/customers/post', customerData);

            console.log('✅ Cliente criado com sucesso');
            return response.data;

        } catch (error) {
            console.error('❌ Erro ao criar cliente:', error.message);
            throw error;
        }
    }

    async createSubscription(subscriptionData) {
        try {
            await this.ensureAuthenticated();

            console.log('📝 Criando assinatura...');

            const response = await this.client.post(
                '/subscriptions/post',
                subscriptionData
            );

            console.log('✅ Assinatura criada com sucesso');
            return response.data;

        } catch (error) {
            console.error('❌ Erro ao criar assinatura:', error.message);
            throw error;
        }
    }

    async processPaymentPix(subscriptionId) {
        try {
            await this.ensureAuthenticated();

            console.log('💳 Processando pagamento Pix...');

            const response = await this.client.post('/subscriptions/payment', {
                subscription_id: subscriptionId,
                payment_method: 'pix'
            });

            console.log('✅ QR Code Pix gerado');
            return response.data;

        } catch (error) {
            console.error('❌ Erro ao processar Pix:', error.message);
            throw error;
        }
    }

    async processPaymentCreditCard(subscriptionId, cardData) {
        try {
            await this.ensureAuthenticated();

            console.log('💳 Processando pagamento com cartão...');

            const response = await this.client.post('/subscriptions/payment', {
                subscription_id: subscriptionId,
                payment_method: 'credit_card',
                card: cardData
            });

            console.log('✅ Pagamento processado');
            return response.data;

        } catch (error) {
            console.error('❌ Erro ao processar cartão:', error.message);
            throw error;
        }
    }

    async getSubscription(subscriptionId) {
        try {
            await this.ensureAuthenticated();

            console.log(`📋 Buscando assinatura ${subscriptionId}...`);

            const response = await this.client.get(
                `/subscriptions/show/${subscriptionId}`
            );

            console.log('✅ Assinatura encontrada');
            return response.data;

        } catch (error) {
            console.error('❌ Erro ao buscar assinatura:', error.message);
            throw error;
        }
    }

    clearCache() {
        this.cache = {
            brands: [],
            models: {},
            plans: {},
            lastUpdate: null
        };
        console.log('🗑️ Cache limpo');
    }

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

module.exports = new ClubFixServiceV2();
