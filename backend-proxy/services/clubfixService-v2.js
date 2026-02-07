/**
 * ClubFix API Service - v4.0 (Autenticação Completa)
 * 
 * Testa TODOS os formatos possíveis de autenticação
 */

const axios = require('axios');

class ClubFixServiceV4 {
    constructor() {
        // Configuração da API
        this.baseURL = process.env.CLUBFIX_BASE_URL || 'https://clubfix.com.br/webservice';
        this.email = process.env.CLUBFIX_EMAIL || 'kainow@clubfix.com.br';
        this.password = process.env.CLUBFIX_PASSWORD || 'Kainow@27923746';
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
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        
        this.client.defaults.baseURL = this.baseURL;
        
        console.log('📱 ClubFix Service v4.0 (Auth Completo) inicializado');
        console.log('   Base URL:', this.baseURL);
    }
    
    getInfo() {
        return {
            baseURL: this.baseURL,
            email: this.email,
            authenticated: !!this.token.accessToken,
            tokenExpires: this.token.expiresAt ? new Date(this.token.expiresAt).toISOString() : null
        };
    }
    
    /**
     * 🔐 AUTENTICAÇÃO - TESTA TODOS OS FORMATOS
     */
    async authenticate() {
        try {
            console.log('🔐 Autenticando na API ClubFix...');
            console.log('   Email:', this.email);
            console.log('   Password:', this.password ? '***' : 'FALTANDO');
            
            // Criar X-CREDENTIALS (Base64)
            const credentials = Buffer.from(`${this.email}:${this.password}`).toString('base64');
            
            // TESTAR 10 FORMATOS DIFERENTES!
            const authAttempts = [
                // 1. POST /auth/login com email/password no body
                {
                    name: 'POST /auth/login (body: email/password)',
                    method: 'POST',
                    endpoint: '/auth/login',
                    headers: {},
                    body: { 
                        email: this.email, 
                        password: this.password 
                    }
                },
                // 2. POST /auth/login com X-CREDENTIALS header
                {
                    name: 'POST /auth/login (header: X-CREDENTIALS)',
                    method: 'POST',
                    endpoint: '/auth/login',
                    headers: { 'X-CREDENTIALS': credentials },
                    body: {}
                },
                // 3. POST /auth/login com username/password
                {
                    name: 'POST /auth/login (body: username/password)',
                    method: 'POST',
                    endpoint: '/auth/login',
                    headers: {},
                    body: { 
                        username: this.email, 
                        password: this.password 
                    }
                },
                // 4. POST /auth/login com login/password
                {
                    name: 'POST /auth/login (body: login/password)',
                    method: 'POST',
                    endpoint: '/auth/login',
                    headers: {},
                    body: { 
                        login: this.email, 
                        password: this.password 
                    }
                },
                // 5. POST /api-reference/auth com client_id/client_secret
                {
                    name: 'POST /api-reference/auth (OAuth)',
                    method: 'POST',
                    endpoint: '/api-reference/auth',
                    headers: {},
                    body: {
                        client_id: this.clientId,
                        client_secret: this.clientSecret
                    }
                },
                // 6. POST /auth/login com credentials no body
                {
                    name: 'POST /auth/login (body: credentials base64)',
                    method: 'POST',
                    endpoint: '/auth/login',
                    headers: {},
                    body: { 
                        credentials: credentials 
                    }
                },
                // 7. POST /login com email/password
                {
                    name: 'POST /login (body: email/password)',
                    method: 'POST',
                    endpoint: '/login',
                    headers: {},
                    body: { 
                        email: this.email, 
                        password: this.password 
                    }
                },
                // 8. POST /auth/login com Authorization Basic
                {
                    name: 'POST /auth/login (Authorization: Basic)',
                    method: 'POST',
                    endpoint: '/auth/login',
                    headers: { 'Authorization': `Basic ${credentials}` },
                    body: {}
                },
                // 9. POST /webservice/auth/login
                {
                    name: 'POST direto (full URL)',
                    method: 'POST',
                    endpoint: '/auth/login',
                    headers: {},
                    body: { 
                        email: this.email, 
                        password: this.password,
                        grant_type: 'password'
                    }
                },
                // 10. POST /auth com email/password e client_id
                {
                    name: 'POST /auth (hybrid)',
                    method: 'POST',
                    endpoint: '/auth',
                    headers: {},
                    body: { 
                        email: this.email, 
                        password: this.password,
                        client_id: this.clientId,
                        client_secret: this.clientSecret
                    }
                }
            ];
            
            let response = null;
            let lastError = null;
            let workingMethod = null;
            
            for (const attempt of authAttempts) {
                try {
                    console.log(`\n🔍 Tentando: ${attempt.name}`);
                    console.log(`   Endpoint: ${attempt.endpoint}`);
                    console.log(`   Headers:`, Object.keys(attempt.headers).length > 0 ? Object.keys(attempt.headers) : 'Nenhum');
                    console.log(`   Body:`, Object.keys(attempt.body).length > 0 ? Object.keys(attempt.body) : 'Vazio');
                    
                    const config = {
                        headers: attempt.headers
                    };
                    
                    response = await this.client.post(attempt.endpoint, attempt.body, config);
                    
                    console.log(`✅ SUCESSO! Método funcionou: ${attempt.name}`);
                    console.log(`   Status: ${response.status}`);
                    console.log(`   Resposta:`, JSON.stringify(response.data).substring(0, 200) + '...');
                    
                    workingMethod = attempt.name;
                    break;
                } catch (error) {
                    console.log(`❌ Falhou: ${attempt.name}`);
                    console.log(`   Status: ${error.response?.status || 'N/A'}`);
                    console.log(`   Erro: ${error.response?.data?.message || error.message}`);
                    
                    lastError = error;
                }
            }
            
            if (!response) {
                console.error('\n❌ NENHUM MÉTODO DE AUTENTICAÇÃO FUNCIONOU!');
                console.error('   Total de tentativas:', authAttempts.length);
                console.error('   Último erro:', lastError.message);
                if (lastError.response) {
                    console.error('   Status:', lastError.response.status);
                    console.error('   Dados:', JSON.stringify(lastError.response.data));
                }
                throw new Error('Falha na autenticação com ClubFix API');
            }
            
            // Extrair token da resposta
            const { access_token, token, expires_in, data } = response.data;
            const authToken = access_token || token || data?.access_token || data?.token;
            
            if (!authToken) {
                console.error('❌ Token não encontrado na resposta');
                console.error('   Resposta completa:', JSON.stringify(response.data));
                throw new Error('Token não retornado pela API ClubFix');
            }
            
            // Calcular expiração
            const expirationTime = expires_in || 3600;
            const expiresAt = Date.now() + ((expirationTime - 300) * 1000);
            
            this.token = {
                accessToken: authToken,
                expiresAt: expiresAt
            };
            
            // Atualizar header
            this.client.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
            
            console.log('\n✅ AUTENTICAÇÃO BEM-SUCEDIDA!');
            console.log(`   Método usado: ${workingMethod}`);
            console.log(`   Token: ${authToken.substring(0, 30)}...`);
            console.log(`   Expira em: ${expirationTime}s`);
            
            return true;
        } catch (error) {
            console.error('\n❌ Erro fatal na autenticação:', error.message);
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
                console.log('📦 Usando marcas do cache');
                return this.cache.brands;
            }
            
            await this.ensureAuthenticated();
            
            console.log('📱 Buscando marcas da API...');
            const response = await this.client.get('/api-reference/devices/brands', {
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
                console.log(`📦 Usando modelos do cache (marca ${brandId})`);
                return this.cache.models[cacheKey];
            }
            
            await this.ensureAuthenticated();
            
            console.log(`📱 Buscando modelos da marca ${brandId}...`);
            
            const endpoints = [
                {
                    url: '/api-reference/devices/models',
                    params: { brand_id: brandId, page, per_page: perPage }
                },
                {
                    url: '/models',
                    params: { filter: { brand: brandId }, page, per_page: perPage }
                },
                {
                    url: `/brands/${brandId}`,
                    params: { include: 'models', page, per_page: perPage }
                }
            ];
            
            let response = null;
            let lastError = null;
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`🔍 Tentando: ${endpoint.url}`);
                    response = await this.client.get(endpoint.url, { params: endpoint.params });
                    console.log(`✅ Endpoint funcionou: ${endpoint.url}`);
                    break;
                } catch (error) {
                    console.log(`❌ Falhou: ${endpoint.url}`);
                    lastError = error;
                }
            }
            
            if (!response) {
                throw lastError;
            }
            
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
                console.log(`📦 Usando cotação do cache`);
                return this.cache.plans[cacheKey].data;
            }
            
            await this.ensureAuthenticated();
            
            console.log(`💰 Buscando cotação...`);
            
            const endpoints = [
                '/quotation',
                '/api-reference/subscriptions/quotation',
                '/plans/quotation',
                '/subscriptions/quotation'
            ];
            
            let response = null;
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`🔍 Tentando: ${endpoint}`);
                    response = await this.client.get(endpoint, {
                        params: { model_id: modelId, is_used: isUsed }
                    });
                    console.log(`✅ Endpoint funcionou: ${endpoint}`);
                    break;
                } catch (error) {
                    console.log(`❌ Falhou: ${endpoint}`);
                }
            }
            
            if (!response) {
                throw new Error('Nenhum endpoint de cotação funcionou');
            }
            
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
        console.log('✅ Cache limpo');
    }
}

const clubfixService = new ClubFixServiceV4();

module.exports = clubfixService;
