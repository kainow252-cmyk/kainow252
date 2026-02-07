/**
 * ClubFix API Service - v3.0 (Login Web)
 * 
 * Autenticação via X-CREDENTIALS (email:password em Base64)
 * Documentação: https://docs.clubfix.com.br/api-reference/introduction
 */

const axios = require('axios');

class ClubFixServiceV3 {
    constructor() {
        // Configuração da API
        this.baseURL = process.env.CLUBFIX_BASE_URL || 'https://clubfix.com.br/webservice';
        this.email = process.env.CLUBFIX_EMAIL || 'kainow@clubfix.com.br';
        this.password = process.env.CLUBFIX_PASSWORD || 'Kainow@27923746';
        
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
        
        // Configurar baseURL após criar a instância
        this.client.defaults.baseURL = this.baseURL;
        
        console.log('📱 ClubFix Service v3.0 (Login Web) inicializado');
        console.log('   Base URL:', this.baseURL);
        console.log('   Email:', this.email);
    }
    
    /**
     * 📊 INFORMAÇÕES DO SERVIÇO
     */
    getInfo() {
        return {
            baseURL: this.baseURL,
            email: this.email,
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
     * 🔐 AUTENTICAÇÃO VIA LOGIN WEB (X-CREDENTIALS)
     */
    async authenticate() {
        try {
            console.log('🔐 Autenticando via Login Web...');
            console.log('   Email:', this.email);
            console.log('   Password:', this.password ? '***' : 'FALTANDO');
            
            // Criar X-CREDENTIALS (Base64 de "email:password")
            const credentials = Buffer.from(`${this.email}:${this.password}`).toString('base64');
            console.log('   X-CREDENTIALS:', credentials.substring(0, 20) + '...');
            
            // Tentar múltiplos endpoints e métodos
            const authAttempts = [
                // Tentativa 1: POST /auth/login com X-CREDENTIALS
                {
                    method: 'POST',
                    endpoint: '/auth/login',
                    headers: { 'X-CREDENTIALS': credentials },
                    body: {}
                },
                // Tentativa 2: POST /auth com email/password no body
                {
                    method: 'POST',
                    endpoint: '/auth',
                    headers: {},
                    body: { email: this.email, password: this.password }
                },
                // Tentativa 3: POST /api-reference/auth com X-CREDENTIALS
                {
                    method: 'POST',
                    endpoint: '/api-reference/auth',
                    headers: { 'X-CREDENTIALS': credentials },
                    body: {}
                },
                // Tentativa 4: GET /auth/login com X-CREDENTIALS
                {
                    method: 'GET',
                    endpoint: '/auth/login',
                    headers: { 'X-CREDENTIALS': credentials },
                    body: null
                }
            ];
            
            let response = null;
            let lastError = null;
            
            for (const attempt of authAttempts) {
                try {
                    console.log(`🔍 Tentando: ${attempt.method} ${attempt.endpoint}`);
                    
                    const config = {
                        headers: attempt.headers
                    };
                    
                    if (attempt.method === 'POST') {
                        response = await this.client.post(attempt.endpoint, attempt.body, config);
                    } else {
                        response = await this.client.get(attempt.endpoint, config);
                    }
                    
                    console.log(`✅ Autenticação funcionou: ${attempt.method} ${attempt.endpoint}`);
                    console.log('   Resposta:', JSON.stringify(response.data).substring(0, 100) + '...');
                    break;
                } catch (error) {
                    console.log(`❌ Falhou: ${attempt.method} ${attempt.endpoint}`);
                    console.log('   Status:', error.response?.status || 'N/A');
                    console.log('   Erro:', error.response?.data?.message || error.message);
                    lastError = error;
                }
            }
            
            if (!response) {
                console.error('❌ Nenhum método de autenticação funcionou');
                console.error('   Último erro:', lastError.message);
                if (lastError.response) {
                    console.error('   Status:', lastError.response.status);
                    console.error('   Dados:', JSON.stringify(lastError.response.data));
                }
                throw new Error('Falha na autenticação com ClubFix API');
            }
            
            // Extrair token da resposta
            const { access_token, token, expires_in } = response.data;
            const authToken = access_token || token;
            
            if (!authToken) {
                console.error('❌ Token não encontrado na resposta');
                console.error('   Resposta completa:', JSON.stringify(response.data));
                throw new Error('Token não retornado pela API ClubFix');
            }
            
            // Calcular tempo de expiração (padrão 1 hora se não especificado)
            const expirationTime = expires_in || 3600;
            const expiresAt = Date.now() + ((expirationTime - 300) * 1000);
            
            this.token = {
                accessToken: authToken,
                expiresAt: expiresAt
            };
            
            // Atualizar header de autorização
            this.client.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
            
            console.log('✅ Autenticação bem-sucedida');
            console.log(`🎫 Token obtido (expira em ${expirationTime}s)`);
            
            return true;
        } catch (error) {
            console.error('❌ Erro fatal na autenticação:', error.message);
            throw error;
        }
    }
    
    /**
     * ✅ GARANTIR AUTENTICAÇÃO
     */
    async ensureAuthenticated() {
        if (!this.token.accessToken || Date.now() >= this.token.expiresAt) {
            console.log('🔄 Token expirado ou ausente, renovando...');
            await this.authenticate();
        }
    }
    
    /**
     * 📱 BUSCAR MARCAS
     */
    async getBrands(page = 1, perPage = 50) {
        try {
            // Verificar cache (válido por 1 hora)
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
     * 📱 BUSCAR MODELOS POR MARCA
     */
    async getModels(brandId, page = 1, perPage = 100) {
        try {
            const cacheKey = `${brandId}_${page}_${perPage}`;
            
            // Verificar cache
            if (this.cache.models[cacheKey]) {
                console.log(`📦 Usando modelos do cache (marca ${brandId})`);
                return this.cache.models[cacheKey];
            }
            
            await this.ensureAuthenticated();
            
            console.log(`📱 Buscando modelos da marca ${brandId}...`);
            
            // Tentar múltiplos endpoints para modelos
            const endpoints = [
                {
                    url: '/models',
                    params: { filter: { brand: brandId }, page, per_page: perPage }
                },
                {
                    url: '/api-reference/devices/models',
                    params: { brand_id: brandId, page, per_page: perPage }
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
                console.error('❌ Nenhum endpoint de modelos funcionou');
                throw lastError;
            }
            
            const models = response.data.data.map(model => ({
                id: model.id,
                brandId: model.brand_id,
                name: model.name,
                lmi: parseFloat(model.lmi) || 0,
                status: model.status
            }));
            
            // Atualizar cache
            this.cache.models[cacheKey] = models;
            
            console.log(`✅ ${models.length} modelos carregados`);
            return models;
        } catch (error) {
            console.error('❌ Erro ao buscar modelos:', error.message);
            throw error;
        }
    }
    
    /**
     * 💰 BUSCAR COTAÇÃO
     */
    async getQuotation(modelId, isUsed = false) {
        try {
            const cacheKey = `${modelId}_${isUsed}`;
            
            // Verificar cache (válido por 30 minutos)
            if (this.cache.plans[cacheKey] && 
                (Date.now() - this.cache.plans[cacheKey].timestamp < 1800000)) {
                console.log(`📦 Usando cotação do cache (modelo ${modelId})`);
                return this.cache.plans[cacheKey].data;
            }
            
            await this.ensureAuthenticated();
            
            console.log(`💰 Buscando cotação para modelo ${modelId}...`);
            
            // Tentar múltiplos endpoints para cotação
            const endpoints = [
                '/quotation',
                '/plans/quotation',
                '/subscriptions/quotation',
                '/api-reference/subscriptions/quotation'
            ];
            
            let response = null;
            let lastError = null;
            
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
                    lastError = error;
                }
            }
            
            if (!response) {
                console.error('❌ Nenhum endpoint de cotação funcionou');
                throw lastError;
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
            
            // Atualizar cache
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
}

// Singleton
const clubfixService = new ClubFixServiceV3();

module.exports = clubfixService;
