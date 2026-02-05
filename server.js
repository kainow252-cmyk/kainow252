// ===================================================================
// PROTEGMAIS BACKEND - INTEGRACAO API OFICIAL CLUBFIX
// Data: 2026-02-05
// Versao: API Oficial
// ===================================================================

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// ===================================================================
// CREDENCIAIS API CLUBFIX (HOMOLOGACAO)
// ===================================================================
const CLUBFIX_CONFIG = {
    baseURL: 'https://homolog.clubfix.com.br/api', // URL base da API
    clientId: '96639fd2-7598-46a7-89e8-05b84c7f3b6b',
    clientSecret: 'CLUBFIX698497c880cb41770297288',
    email: 'kainow@clubfix.com.br',
    password: 'Kainow@27923746'
};

// Estado da autenticacao
let authState = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null
};

// Cache
const cache = {
    brands: null,
    models: {},
    plans: {}
};

// ===================================================================
// AUTENTICACAO - OBTER TOKEN
// ===================================================================
async function authenticate() {
    try {
        console.log('==> Autenticando na API ClubFix...');
        
        const response = await axios.post(`${CLUBFIX_CONFIG.baseURL}/auth/login`, {
            client_id: CLUBFIX_CONFIG.clientId,
            client_secret: CLUBFIX_CONFIG.clientSecret,
            email: CLUBFIX_CONFIG.email,
            password: CLUBFIX_CONFIG.password,
            grant_type: 'password'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });

        if (response.data.access_token) {
            authState.accessToken = response.data.access_token;
            authState.refreshToken = response.data.refresh_token;
            authState.expiresAt = Date.now() + (response.data.expires_in * 1000);
            
            console.log('==> Autenticacao realizada com sucesso!');
            console.log(`==> Token expira em: ${response.data.expires_in} segundos`);
            return true;
        }

        throw new Error('Token nao recebido');

    } catch (error) {
        console.error('==> ERRO na autenticacao:', error.response?.data || error.message);
        return false;
    }
}

// ===================================================================
// VERIFICAR E RENOVAR TOKEN
// ===================================================================
async function ensureAuthenticated() {
    // Se nao tem token ou expirou
    if (!authState.accessToken || Date.now() >= authState.expiresAt) {
        console.log('==> Token expirado ou ausente, autenticando...');
        return await authenticate();
    }
    return true;
}

// ===================================================================
// FAZER REQUISICAO AUTENTICADA
// ===================================================================
async function apiRequest(method, endpoint, data = null) {
    await ensureAuthenticated();

    try {
        const config = {
            method: method,
            url: `${CLUBFIX_CONFIG.baseURL}${endpoint}`,
            headers: {
                'Authorization': `Bearer ${authState.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        };

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return response.data;

    } catch (error) {
        // Se erro 401, tentar reautenticar
        if (error.response?.status === 401) {
            console.log('==> Token invalido, reautenticando...');
            await authenticate();
            // Tentar novamente
            return apiRequest(method, endpoint, data);
        }
        throw error;
    }
}

// ===================================================================
// HEALTH CHECK
// ===================================================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        auth: {
            authenticated: authState.accessToken !== null,
            expiresAt: authState.expiresAt
        }
    });
});

// ===================================================================
// LISTAR MARCAS
// ===================================================================
app.get('/api/clubfix/brands', async (req, res) => {
    try {
        console.log('==> Requisicao de marcas recebida');

        // Verificar cache
        if (cache.brands && cache.brands.length > 0) {
            console.log(`==> Retornando ${cache.brands.length} marcas do cache`);
            return res.json({
                success: true,
                data: cache.brands,
                count: cache.brands.length,
                cached: true
            });
        }

        // Buscar da API
        console.log('==> Buscando marcas da API ClubFix...');
        const data = await apiRequest('GET', '/brands');

        // Processar resposta
        const brands = data.brands || data.data || data;
        
        if (Array.isArray(brands)) {
            // Salvar no cache
            cache.brands = brands.map(brand => ({
                id: brand.id,
                name: brand.name || brand.nome,
                status: brand.status || brand.ativo || 1
            }));

            console.log(`==> ${cache.brands.length} marcas obtidas da API!`);

            return res.json({
                success: true,
                data: cache.brands,
                count: cache.brands.length,
                cached: false
            });
        }

        throw new Error('Formato de resposta inesperado');

    } catch (error) {
        console.error('==> ERRO ao buscar marcas:', error.response?.data || error.message);
        
        // Fallback
        res.json({
            success: true,
            data: [
                { id: 6, name: 'SAMSUNG', status: 1 },
                { id: 2, name: 'APPLE', status: 1 },
                { id: 13, name: 'MOTOROLA', status: 1 },
                { id: 15, name: 'XIAOMI', status: 1 }
            ],
            count: 4,
            fallback: true,
            error: error.message
        });
    }
});

// ===================================================================
// LISTAR MODELOS DE UMA MARCA
// ===================================================================
app.post('/api/clubfix/brands/:id/models', async (req, res) => {
    const brandId = parseInt(req.params.id);
    
    try {
        console.log('');
        console.log('='.repeat(60));
        console.log(`==> REQUISICAO DE MODELOS - Marca ID: ${brandId}`);
        console.log('='.repeat(60));

        // Verificar cache
        const cacheKey = `brand_${brandId}`;
        if (cache.models[cacheKey]) {
            console.log(`==> Retornando ${cache.models[cacheKey].length} modelos do cache`);
            return res.json({
                success: true,
                data: cache.models[cacheKey],
                count: cache.models[cacheKey].length,
                cached: true
            });
        }

        // Buscar da API
        console.log('==> Buscando modelos da API ClubFix...');
        const data = await apiRequest('GET', `/brands/${brandId}/models`);

        // Processar resposta
        const models = data.models || data.data || data;
        
        if (Array.isArray(models)) {
            // Salvar no cache
            cache.models[cacheKey] = models.map(model => ({
                id: model.id,
                name: model.name || model.nome || model.model_name,
                brandId: brandId,
                price: model.price || model.preco || model.valor
            }));

            console.log(`==> ${cache.models[cacheKey].length} modelos REAIS obtidos da API!`);
            console.log('='.repeat(60));
            console.log('');

            return res.json({
                success: true,
                data: cache.models[cacheKey],
                count: cache.models[cacheKey].length,
                real: true,
                cached: false
            });
        }

        throw new Error('Formato de resposta inesperado');

    } catch (error) {
        console.error('');
        console.error('='.repeat(60));
        console.error('==> ERRO AO BUSCAR MODELOS');
        console.error(`==> Mensagem: ${error.message}`);
        console.error(`==> Response: ${JSON.stringify(error.response?.data || {})}`);
        console.error('='.repeat(60));
        console.error('');
        
        // Fallback
        res.json({
            success: true,
            data: [
                { id: 1788, name: 'Galaxy S24 5G 128GB', brandId },
                { id: 1780, name: 'Galaxy S24 5G 256GB', brandId },
                { id: 1781, name: 'Galaxy S24+ 5G 256GB', brandId }
            ],
            count: 3,
            fallback: true,
            error: error.message
        });
    }
});

// ===================================================================
// BUSCAR PLANOS
// ===================================================================
app.post('/api/clubfix/plans', async (req, res) => {
    try {
        const { brandId, modelId, deviceValue } = req.body;
        
        console.log('==> Buscando planos...');
        console.log(`    Marca: ${brandId}, Modelo: ${modelId}, Valor: ${deviceValue}`);

        const data = await apiRequest('POST', '/plans/search', {
            brand_id: brandId,
            model_id: modelId,
            device_value: deviceValue
        });

        const plans = data.plans || data.data || data;

        console.log(`==> ${plans.length || 0} planos encontrados`);

        res.json({
            success: true,
            data: plans,
            count: plans.length || 0
        });

    } catch (error) {
        console.error('==> ERRO ao buscar planos:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===================================================================
// CRIAR ASSINATURA
// ===================================================================
app.post('/api/clubfix/subscription', async (req, res) => {
    try {
        const subscriptionData = req.body;
        
        console.log('==> Criando assinatura...');

        const data = await apiRequest('POST', '/subscriptions', subscriptionData);

        console.log('==> Assinatura criada com sucesso!');
        console.log(`    ID: ${data.id || data.subscription_id}`);

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('==> ERRO ao criar assinatura:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===================================================================
// INFO DA SESSAO
// ===================================================================
app.get('/api/clubfix/session', (req, res) => {
    res.json({
        authenticated: authState.accessToken !== null,
        expiresAt: authState.expiresAt,
        expiresIn: authState.expiresAt ? Math.floor((authState.expiresAt - Date.now()) / 1000) : 0
    });
});

// ===================================================================
// INICIAR SERVIDOR
// ===================================================================
app.listen(PORT, async () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('==> PROTEGMAIS BACKEND - API OFICIAL CLUBFIX');
    console.log(`==> Porta: ${PORT}`);
    console.log(`==> Ambiente: HOMOLOGACAO`);
    console.log('='.repeat(60));
    console.log('');
    
    // Autenticar ao iniciar
    await authenticate();
    
    console.log('==> Servidor PRONTO!');
    console.log(`==> URL: https://protegmais.onrender.com`);
});
