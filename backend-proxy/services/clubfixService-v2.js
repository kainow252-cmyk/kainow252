/**
 * ClubFix API Service - v5.0 (Multi Base URL + Multi Endpoint)
 * 
 * Testa TODAS as combinações possíveis:
 * - 5 Base URLs
 * - 10 Endpoints
 * - 10 Formatos de autenticação
 */

const axios = require('axios');

class ClubFixServiceV5 {
    constructor() {
        // Credenciais
        this.email = process.env.CLUBFIX_EMAIL || 'kainow@clubfix.com.br';
        this.password = process.env.CLUBFIX_PASSWORD || 'Kainow@27923746';
        this.clientId = process.env.CLUBFIX_CLIENT_ID || '2f6356ca-8089-4afc-aad8-c83b30ca1f3f';
        this.clientSecret = process.env.CLUBFIX_CLIENT_SECRET || 'CLUBFIX6986445f624d31770407007';
        
        // Token
        this.token = {
            accessToken: null,
            expiresAt: null
        };
        
        // Cache
        this.cache = {
            brands: null,
            models: {},
            plans: {},
            lastUpdate: null
        };
        
        // Base URL que funcionou
        this.workingBaseURL = null;
        this.workingMethod = null;
        
        console.log('📱 ClubFix Service v5.0 (Multi URL/Endpoint) inicializado');
    }
    
    getInfo() {
        return {
            workingBaseURL: this.workingBaseURL,
            workingMethod: this.workingMethod,
            authenticated: !!this.token.accessToken
        };
    }
    
    /**
     * 🔐 AUTENTICAÇÃO - TESTA TODAS AS COMBINAÇÕES
     */
    async authenticate() {
        try {
            console.log('\n🔐 INICIANDO TESTES DE AUTENTICAÇÃO...');
            console.log('   Email:', this.email);
            console.log('   Client ID:', this.clientId);
            
            // Criar credentials Base64
            const credentials = Buffer.from(`${this.email}:${this.password}`).toString('base64');
            
            // TESTAR 5 BASE URLs DIFERENTES
            const baseURLs = [
                'https://clubfix.com.br/webservice',
                'https://clubfix.com.br',
                'https://api.clubfix.com.br',
                'https://clubfix.com.br/api',
                'https://homolog.clubfix.com.br/webservice'
            ];
            
            // TESTAR 10 COMBINAÇÕES DE ENDPOINT + FORMATO
            const authMethods = [
                // OAuth 2.0 padrão
                {
                    name: 'OAuth 2.0 Standard',
                    endpoint: '/oauth/token',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: {
                        grant_type: 'client_credentials',
                        client_id: this.clientId,
                        client_secret: this.clientSecret
                    }
                },
                // OAuth 2.0 JSON
                {
                    name: 'OAuth 2.0 JSON',
                    endpoint: '/oauth/token',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        grant_type: 'client_credentials',
                        client_id: this.clientId,
                        client_secret: this.clientSecret
                    }
                },
                // API Reference Auth
                {
                    name: 'API Reference Auth',
                    endpoint: '/api-reference/auth',
                    method: 'POST',
                    headers: {},
                    body: {
                        client_id: this.clientId,
                        client_secret: this.clientSecret
                    }
                },
                // Auth Login - Email/Password
                {
                    name: 'Auth Login (email/password)',
                    endpoint: '/auth/login',
                    method: 'POST',
                    headers: {},
                    body: {
                        email: this.email,
                        password: this.password
                    }
                },
                // Auth Login - X-CREDENTIALS
                {
                    name: 'Auth Login (X-CREDENTIALS)',
                    endpoint: '/auth/login',
                    method: 'POST',
                    headers: { 'X-CREDENTIALS': credentials },
                    body: {}
                },
                // API Auth
                {
                    name: 'API Auth',
                    endpoint: '/api/auth',
                    method: 'POST',
                    headers: {},
                    body: {
                        client_id: this.clientId,
                        client_secret: this.clientSecret
                    }
                },
                // API Login
                {
                    name: 'API Login',
                    endpoint: '/api/login',
                    method: 'POST',
                    headers: {},
                    body: {
                        email: this.email,
                        password: this.password
                    }
                },
                // Token endpoint
                {
                    name: 'Token Endpoint',
                    endpoint: '/token',
                    method: 'POST',
                    headers: {},
                    body: {
                        client_id: this.clientId,
                        client_secret: this.clientSecret
                    }
                },
                // Authenticate
                {
                    name: 'Authenticate',
                    endpoint: '/authenticate',
                    method: 'POST',
                    headers: {},
                    body: {
                        email: this.email,
                        password: this.password,
                        client_id: this.clientId,
                        client_secret: this.clientSecret
                    }
                },
                // Auth (root)
                {
                    name: 'Auth Root',
                    endpoint: '/auth',
                    method: 'POST',
                    headers: {},
                    body: {
                        client_id: this.clientId,
                        client_secret: this.clientSecret,
                        email: this.email,
                        password: this.password
                    }
                }
            ];
            
            let successCount = 0;
            let totalAttempts = baseURLs.length * authMethods.length;
            
            console.log(`\n📊 Testando ${baseURLs.length} URLs × ${authMethods.length} métodos = ${totalAttempts} combinações\n`);
            
            // Testar todas as combinações
            for (const baseURL of baseURLs) {
                console.log(`\n🌐 Testando Base URL: ${baseURL}`);
                console.log('─'.repeat(80));
                
                for (const method of authMethods) {
                    try {
                        console.log(`\n🔍 ${++successCount}/${totalAttempts}: ${method.name}`);
                        console.log(`   Endpoint: ${method.endpoint}`);
                        console.log(`   Headers:`, Object.keys(method.headers));
                        console.log(`   Body:`, Object.keys(method.body));
                        
                        const client = axios.create({
                            baseURL: baseURL,
                            timeout: 10000,
                            headers: {
                                'Accept': 'application/json',
                                ...method.headers
                            }
                        });
                        
                        const response = await client.post(method.endpoint, method.body);
                        
                        console.log(`\n✅ SUCESSO!`);
                        console.log(`   Base URL: ${baseURL}`);
                        console.log(`   Método: ${method.name}`);
                        console.log(`   Status: ${response.status}`);
                        console.log(`   Resposta:`, JSON.stringify(response.data).substring(0, 200));
                        
                        // Extrair token
                        const { access_token, token, expires_in, data } = response.data;
                        const authToken = access_token || token || data?.access_token || data?.token;
                        
                        if (authToken) {
                            this.workingBaseURL = baseURL;
                            this.workingMethod = method.name;
                            
                            const expirationTime = expires_in || 3600;
                            this.token = {
                                accessToken: authToken,
                                expiresAt: Date.now() + ((expirationTime - 300) * 1000)
                            };
                            
                            console.log(`\n🎉 AUTENTICAÇÃO BEM-SUCEDIDA!`);
                            console.log(`   Base URL: ${this.workingBaseURL}`);
                            console.log(`   Método: ${this.workingMethod}`);
                            console.log(`   Token: ${authToken.substring(0, 30)}...`);
                            console.log(`   Expira em: ${expirationTime}s`);
                            
                            return true;
                        }
                        
                    } catch (error) {
                        const status = error.response?.status || 'N/A';
                        const errorMsg = error.response?.data?.message || error.message;
                        console.log(`   ❌ Status: ${status} | ${errorMsg}`);
                    }
                }
            }
            
            console.log(`\n❌ NENHUMA COMBINAÇÃO FUNCIONOU!`);
            console.log(`   Total testado: ${totalAttempts}`);
            throw new Error('Falha na autenticação com ClubFix API');
            
        } catch (error) {
            console.error('\n❌ Erro fatal:', error.message);
            throw error;
        }
    }
    
    async ensureAuthenticated() {
        if (!this.token.accessToken || Date.now() >= this.token.expiresAt) {
            await this.authenticate();
        }
    }
    
    async getBrands(page = 1, perPage = 50) {
        try {
            if (this.cache.brands && this.cache.lastUpdate && 
                (Date.now() - this.cache.lastUpdate < 3600000)) {
                return this.cache.brands;
            }
            
            await this.ensureAuthenticated();
            
            const client = axios.create({
                baseURL: this.workingBaseURL,
                headers: {
                    'Authorization': `Bearer ${this.token.accessToken}`,
                    'Accept': 'application/json'
                }
            });
            
            console.log('📱 Buscando marcas...');
            const response = await client.get('/api-reference/devices/brands', {
                params: { page, per_page: perPage }
            });
            
            const brands = response.data.data.map(brand => ({
                id: brand.id,
                name: brand.name,
                status: brand.status,
                createdAt: brand.created_at
            }));
            
            this.cache.brands = brands;
            this.cache.lastUpdate = Date.now();
            
            console.log(`✅ ${brands.length} marcas carregadas`);
            return brands;
        } catch (error) {
            console.error('❌ Erro ao buscar marcas:', error.message);
            throw error;
        }
    }
    
    async getModels(brandId, page = 1, perPage = 100) {
        try {
            const cacheKey = `${brandId}_${page}_${perPage}`;
            
            if (this.cache.models[cacheKey]) {
                return this.cache.models[cacheKey];
            }
            
            await this.ensureAuthenticated();
            
            const client = axios.create({
                baseURL: this.workingBaseURL,
                headers: {
                    'Authorization': `Bearer ${this.token.accessToken}`,
                    'Accept': 'application/json'
                }
            });
            
            const response = await client.get('/api-reference/devices/models', {
                params: { brand_id: brandId, page, per_page: perPage }
            });
            
            const models = response.data.data.map(model => ({
                id: model.id,
                brandId: model.brand_id,
                name: model.name,
                lmi: parseFloat(model.lmi) || 0,
                status: model.status
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
        try {
            const cacheKey = `${modelId}_${isUsed}`;
            
            if (this.cache.plans[cacheKey] && 
                (Date.now() - this.cache.plans[cacheKey].timestamp < 1800000)) {
                return this.cache.plans[cacheKey].data;
            }
            
            await this.ensureAuthenticated();
            
            const client = axios.create({
                baseURL: this.workingBaseURL,
                headers: {
                    'Authorization': `Bearer ${this.token.accessToken}`,
                    'Accept': 'application/json'
                }
            });
            
            const response = await client.get('/api-reference/subscriptions/quotation', {
                params: { model_id: modelId, is_used: isUsed }
            });
            
            const quotationData = response.data.data;
            
            const quotation = {
                model: {
                    id: quotationData.model.id,
                    name: quotationData.model.name,
                    brand: quotationData.model.brand,
                    lmi: parseFloat(quotationData.model.lmi) || 0
                },
                plans: quotationData.plans.map(plan => ({
                    id: plan.id,
                    name: plan.name,
                    monthlyPrice: parseFloat(plan.monthly_price) || 0,
                    annualPrice: parseFloat(plan.annual_price) || 0,
                    franchisePercentage: parseFloat(plan.franchise_percentage) || 0,
                    coverage: plan.coverage,
                    lmi: parseFloat(quotationData.model.lmi) || 0
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
    
    clearCache() {
        this.cache = {
            brands: null,
            models: {},
            plans: {},
            lastUpdate: null
        };
    }
}

const clubfixService = new ClubFixServiceV5();

module.exports = clubfixService;
