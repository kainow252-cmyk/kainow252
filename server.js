/**
 * ProtegMais Backend - API OFICIAL CLUBFIX - VERSÃO COMPLETA
 * Integração TOTAL com Webservice de Parceiros
 * 
 * Endpoints disponíveis:
 * - Autenticação
 * - Marcas de Dispositivos
 * - Modelos de Dispositivos
 * - Planos de Assinatura
 * - Cotações
 * - Clientes
 * - Assinaturas
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middlewares
app.use(cors());
app.use(express.json());

// ============================================================
// CONFIGURAÇÃO DA API CLUBFIX
// ============================================================

const CLUBFIX_CONFIG = {
  baseURL: 'https://homolog.clubfix.com.br/webservice',
  credentials: {
    email: 'kainow@clubfix.com.br',
    password: 'Kainow@27923746',
    client_id: '96639fd2-7598-46a7-89e8-05b84c7f3b6b',
    client_secret: 'CLUBFIX698497c880cb41770297288'
  }
};

// Token de autenticação
let authToken = {
  access_token: null,
  expires_at: null
};

// Cache simples
const cache = {
  brands: null,
  models: {},
  plans: null,
  lastUpdate: null
};

// ============================================================
// AUTENTICAÇÃO
// ============================================================

function getCredentialsHeader() {
  const credentials = `${CLUBFIX_CONFIG.credentials.email}:${CLUBFIX_CONFIG.credentials.password}`;
  return Buffer.from(credentials).toString('base64');
}

async function authenticate() {
  console.log('='.repeat(60));
  console.log('==> AUTENTICANDO NA API CLUBFIX...');
  console.log('='.repeat(60));
  
  try {
    const response = await axios.post(
      `${CLUBFIX_CONFIG.baseURL}/auth/login`,
      {
        client_id: CLUBFIX_CONFIG.credentials.client_id,
        client_secret: CLUBFIX_CONFIG.credentials.client_secret
      },
      {
        headers: {
          'X-CREDENTIALS': getCredentialsHeader(),
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    const { access_token, expires_in } = response.data;
    
    authToken.access_token = access_token;
    authToken.expires_at = Date.now() + (expires_in * 1000);
    
    console.log('==> ✅ AUTENTICACAO REALIZADA COM SUCESSO!');
    console.log(`==> Token expira em: ${expires_in} segundos`);
    console.log('='.repeat(60));
    
    return true;
  } catch (error) {
    console.error('==> ❌ ERRO NA AUTENTICACAO:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error(`==> Mensagem: ${error.response?.data?.message || error.message}`);
    console.error('='.repeat(60));
    return false;
  }
}

async function ensureValidToken() {
  if (!authToken.access_token || Date.now() >= authToken.expires_at) {
    console.log('==> Token expirado ou inexistente, renovando...');
    return await authenticate();
  }
  return true;
}

async function makeAuthenticatedRequest(method, endpoint, data = null, params = null) {
  await ensureValidToken();
  
  const config = {
    method,
    url: `${CLUBFIX_CONFIG.baseURL}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${authToken.access_token}`,
      'X-CREDENTIALS': getCredentialsHeader(),
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };
  
  if (data) config.data = data;
  if (params) config.params = params;
  
  return await axios(config);
}

// ============================================================
// ENDPOINTS - HEALTH CHECK
// ============================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    authenticated: !!authToken.access_token,
    tokenValid: authToken.access_token && Date.now() < authToken.expires_at,
    cacheStatus: {
      brands: !!cache.brands,
      plans: !!cache.plans,
      lastUpdate: cache.lastUpdate
    }
  });
});

// ============================================================
// ENDPOINTS - MARCAS (BRANDS)
// ============================================================

/**
 * GET /api/clubfix/brands - Listar todas as marcas
 */
app.get('/api/clubfix/brands', async (req, res) => {
  console.log('='.repeat(60));
  console.log('==> REQUISICAO DE MARCAS');
  console.log('='.repeat(60));
  
  try {
    // Verifica cache (válido por 1 hora)
    if (cache.brands && cache.lastUpdate && (Date.now() - cache.lastUpdate < 3600000)) {
      console.log('==> ✅ RETORNANDO MARCAS DO CACHE');
      console.log(`==> Total: ${cache.brands.length} marcas`);
      console.log('='.repeat(60));
      return res.json({
        success: true,
        cached: true,
        count: cache.brands.length,
        data: cache.brands
      });
    }
    
    console.log('==> Buscando marcas da API ClubFix...');
    
    // Força buscar todas as marcas (per_page=100)
    const { page, per_page } = req.query;
    const params = { 
      page: page || 1, 
      per_page: per_page || 100  // Busca até 100 marcas por padrão
    };
    
    console.log(`==> Parametros: page=${params.page}, per_page=${params.per_page}`);
    
    const response = await makeAuthenticatedRequest('GET', '/brands', null, params);
    
    const brands = response.data.data || response.data;
    
    console.log(`==> API retornou: ${brands.length} marcas`);
    console.log(`==> Total disponível: ${response.data.meta?.total || brands.length}`);
    
    // Salva no cache
    cache.brands = brands;
    cache.lastUpdate = Date.now();
    
    console.log(`==> ✅ ${brands.length} MARCAS REAIS OBTIDAS DA API!`);
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      cached: false,
      count: brands.length,
      data: brands,
      meta: response.data.meta,
      links: response.data.links
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO AO BUSCAR MARCAS:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error(`==> Dados: ${JSON.stringify(error.response?.data)}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
});

/**
 * GET /api/clubfix/brands/:id - Obter marca por ID
 */
app.get('/api/clubfix/brands/:id', async (req, res) => {
  console.log('='.repeat(60));
  console.log(`==> REQUISICAO DE MARCA - ID: ${req.params.id}`);
  console.log('='.repeat(60));
  
  try {
    const { include } = req.query;
    const endpoint = `/brands/${req.params.id}`;
    const params = include ? { include } : null;
    
    console.log('==> Buscando marca da API ClubFix...');
    
    const response = await makeAuthenticatedRequest('GET', endpoint, null, params);
    
    console.log('==> ✅ MARCA OBTIDA COM SUCESSO!');
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO AO BUSCAR MARCA:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// ENDPOINTS - MODELOS (MODELS)
// ============================================================

/**
 * GET /api/clubfix/models - Listar modelos
 */
app.get('/api/clubfix/models', async (req, res) => {
  console.log('='.repeat(60));
  console.log('==> REQUISICAO DE MODELOS');
  console.log('='.repeat(60));
  
  try {
    const { page, per_page, include } = req.query;
    const filterName = req.query['filter[name]'];
    const filterBrand = req.query['filter[brand]'];
    
    const params = { page, per_page, include };
    if (filterName) params['filter[name]'] = filterName;
    if (filterBrand) params['filter[brand]'] = filterBrand;
    
    console.log('==> Buscando modelos da API ClubFix...');
    console.log(`==> Filtros: ${JSON.stringify(params)}`);
    
    const response = await makeAuthenticatedRequest('GET', '/models', null, params);
    
    const models = response.data.data || response.data;
    
    console.log(`==> ✅ ${models.length} MODELOS OBTIDOS!`);
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      count: models.length,
      data: models,
      meta: response.data.meta,
      links: response.data.links
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO AO BUSCAR MODELOS:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

/**
 * POST /api/clubfix/brands/:id/models - Listar modelos de uma marca
 * (Compatibilidade com frontend atual)
 */
app.post('/api/clubfix/brands/:id/models', async (req, res) => {
  console.log('='.repeat(60));
  console.log(`==> REQUISICAO DE MODELOS - Marca ID: ${req.params.id}`);
  console.log('='.repeat(60));
  
  try {
    const brandId = req.params.id;
    const cacheKey = `brand_${brandId}`;
    
    // Verifica cache
    if (cache.models[cacheKey] && (Date.now() - cache.models[cacheKey].timestamp < 3600000)) {
      console.log('==> ✅ RETORNANDO MODELOS DO CACHE');
      console.log(`==> Total: ${cache.models[cacheKey].data.length} modelos`);
      console.log('='.repeat(60));
      return res.json({
        success: true,
        cached: true,
        count: cache.models[cacheKey].data.length,
        data: cache.models[cacheKey].data
      });
    }
    
    console.log('==> Buscando modelos da API ClubFix...');
    
    const response = await makeAuthenticatedRequest('GET', '/models', null, {
      'filter[brand]': brandId,
      per_page: 100
    });
    
    const models = response.data.data || response.data;
    
    // Formata modelos para o frontend
    const formattedModels = models.map(model => ({
      id: model.id,
      name: model.name,
      brandId: parseInt(brandId)
    }));
    
    // Salva no cache
    cache.models[cacheKey] = {
      timestamp: Date.now(),
      data: formattedModels
    };
    
    console.log(`==> ✅ ${formattedModels.length} MODELOS REAIS OBTIDOS DA API!`);
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      cached: false,
      count: formattedModels.length,
      real: true,
      data: formattedModels
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO AO BUSCAR MODELOS:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

/**
 * GET /api/clubfix/models/:id - Obter modelo por ID
 */
app.get('/api/clubfix/models/:id', async (req, res) => {
  console.log('='.repeat(60));
  console.log(`==> REQUISICAO DE MODELO - ID: ${req.params.id}`);
  console.log('='.repeat(60));
  
  try {
    const response = await makeAuthenticatedRequest('GET', `/models/${req.params.id}`);
    
    console.log('==> ✅ MODELO OBTIDO COM SUCESSO!');
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO AO BUSCAR MODELO:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// ENDPOINTS - PLANOS (PLANS)
// ============================================================

/**
 * GET /api/clubfix/plans - Listar planos
 */
app.get('/api/clubfix/plans', async (req, res) => {
  console.log('='.repeat(60));
  console.log('==> REQUISICAO DE PLANOS');
  console.log('='.repeat(60));
  
  try {
    // Verifica cache
    if (cache.plans && cache.lastUpdate && (Date.now() - cache.lastUpdate < 3600000)) {
      console.log('==> ✅ RETORNANDO PLANOS DO CACHE');
      console.log('='.repeat(60));
      return res.json({
        success: true,
        cached: true,
        data: cache.plans
      });
    }
    
    console.log('==> Buscando planos da API ClubFix...');
    
    const { page } = req.query;
    const response = await makeAuthenticatedRequest('GET', '/plans', null, { page });
    
    cache.plans = response.data;
    cache.lastUpdate = Date.now();
    
    console.log('==> ✅ PLANOS OBTIDOS COM SUCESSO!');
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      cached: false,
      data: response.data
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO AO BUSCAR PLANOS:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

/**
 * GET /api/clubfix/plans/:id - Obter plano por ID
 */
app.get('/api/clubfix/plans/:id', async (req, res) => {
  console.log('='.repeat(60));
  console.log(`==> REQUISICAO DE PLANO - ID: ${req.params.id}`);
  console.log('='.repeat(60));
  
  try {
    const response = await makeAuthenticatedRequest('GET', `/plans/${req.params.id}`);
    
    console.log('==> ✅ PLANO OBTIDO COM SUCESSO!');
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO AO BUSCAR PLANO:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// ENDPOINTS - COTAÇÕES (QUOTATION)
// ============================================================

/**
 * GET /api/clubfix/quotation - Cotar todos os planos
 */
app.get('/api/clubfix/quotation', async (req, res) => {
  console.log('='.repeat(60));
  console.log('==> REQUISICAO DE COTACAO - TODOS OS PLANOS');
  console.log('='.repeat(60));
  
  try {
    const { model_id, is_used } = req.query;
    
    console.log('==> Parametros:', { model_id, is_used });
    console.log('==> Cotando planos na API ClubFix...');
    
    const response = await makeAuthenticatedRequest('GET', '/quotation', null, {
      model_id,
      is_used
    });
    
    console.log('==> ✅ COTACAO REALIZADA COM SUCESSO!');
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO NA COTACAO:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

/**
 * GET /api/clubfix/plans/:id/quotation - Cotar um plano específico
 */
app.get('/api/clubfix/plans/:id/quotation', async (req, res) => {
  console.log('='.repeat(60));
  console.log(`==> REQUISICAO DE COTACAO - Plano ID: ${req.params.id}`);
  console.log('='.repeat(60));
  
  try {
    const { model_id, is_used } = req.query;
    
    console.log('==> Parametros:', { model_id, is_used });
    console.log('==> Cotando plano na API ClubFix...');
    
    const response = await makeAuthenticatedRequest(
      'GET',
      `/plans/${req.params.id}/quotation`,
      null,
      { model_id, is_used }
    );
    
    console.log('==> ✅ COTACAO REALIZADA COM SUCESSO!');
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO NA COTACAO:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// ENDPOINTS - CLIENTES (CUSTOMERS)
// ============================================================

/**
 * POST /api/clubfix/customers - Registrar cliente
 */
app.post('/api/clubfix/customers', async (req, res) => {
  console.log('='.repeat(60));
  console.log('==> REGISTRO DE CLIENTE');
  console.log('='.repeat(60));
  
  try {
    console.log('==> Registrando cliente na API ClubFix...');
    
    const response = await makeAuthenticatedRequest('POST', '/customers', req.body);
    
    console.log('==> ✅ CLIENTE REGISTRADO COM SUCESSO!');
    console.log(`==> ID: ${response.data.id}`);
    console.log('='.repeat(60));
    
    res.status(201).json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO AO REGISTRAR CLIENTE:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error(`==> Dados: ${JSON.stringify(error.response?.data)}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
});

/**
 * GET /api/clubfix/customers/:document - Obter cliente por documento
 */
app.get('/api/clubfix/customers/:document', async (req, res) => {
  console.log('='.repeat(60));
  console.log(`==> BUSCA DE CLIENTE - Documento: ${req.params.document}`);
  console.log('='.repeat(60));
  
  try {
    const { include } = req.query;
    const params = include ? { include } : null;
    
    const response = await makeAuthenticatedRequest(
      'GET',
      `/customers/${req.params.document}`,
      null,
      params
    );
    
    console.log('==> ✅ CLIENTE ENCONTRADO!');
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO AO BUSCAR CLIENTE:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// ENDPOINTS - ASSINATURAS (SUBSCRIPTIONS)
// ============================================================

/**
 * GET /api/clubfix/subscriptions - Listar assinaturas
 */
app.get('/api/clubfix/subscriptions', async (req, res) => {
  console.log('='.repeat(60));
  console.log('==> LISTAGEM DE ASSINATURAS');
  console.log('='.repeat(60));
  
  try {
    const response = await makeAuthenticatedRequest('GET', '/subscriptions');
    
    console.log('==> ✅ ASSINATURAS OBTIDAS COM SUCESSO!');
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO AO LISTAR ASSINATURAS:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

/**
 * POST /api/clubfix/subscriptions - Criar assinatura
 */
app.post('/api/clubfix/subscriptions', async (req, res) => {
  console.log('='.repeat(60));
  console.log('==> CRIACAO DE ASSINATURA');
  console.log('='.repeat(60));
  
  try {
    console.log('==> Criando assinatura na API ClubFix...');
    
    const response = await makeAuthenticatedRequest('POST', '/subscriptions', req.body);
    
    console.log('==> ✅ ASSINATURA CRIADA COM SUCESSO!');
    console.log(`==> ID: ${response.data.id}`);
    console.log('='.repeat(60));
    
    res.status(201).json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO AO CRIAR ASSINATURA:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error(`==> Dados: ${JSON.stringify(error.response?.data)}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
});

/**
 * GET /api/clubfix/subscriptions/:id - Obter assinatura por ID
 */
app.get('/api/clubfix/subscriptions/:id', async (req, res) => {
  console.log('='.repeat(60));
  console.log(`==> BUSCA DE ASSINATURA - ID: ${req.params.id}`);
  console.log('='.repeat(60));
  
  try {
    const response = await makeAuthenticatedRequest('GET', `/subscriptions/${req.params.id}`);
    
    console.log('==> ✅ ASSINATURA ENCONTRADA!');
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO AO BUSCAR ASSINATURA:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

/**
 * POST /api/clubfix/subscriptions/:id/payment - Processar pagamento
 */
app.post('/api/clubfix/subscriptions/:id/payment', async (req, res) => {
  console.log('='.repeat(60));
  console.log(`==> PAGAMENTO DE ASSINATURA - ID: ${req.params.id}`);
  console.log('='.repeat(60));
  
  try {
    console.log('==> Processando pagamento na API ClubFix...');
    
    const response = await makeAuthenticatedRequest(
      'POST',
      `/subscriptions/${req.params.id}/payment`,
      req.body
    );
    
    console.log('==> ✅ PAGAMENTO PROCESSADO COM SUCESSO!');
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('==> ❌ ERRO AO PROCESSAR PAGAMENTO:');
    console.error(`==> Status: ${error.response?.status}`);
    console.error(`==> Dados: ${JSON.stringify(error.response?.data)}`);
    console.error('='.repeat(60));
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
});

// ============================================================
// ENDPOINT DE SESSÃO
// ============================================================

app.get('/api/clubfix/session', (req, res) => {
  res.json({
    authenticated: !!authToken.access_token,
    tokenValid: authToken.access_token && Date.now() < authToken.expires_at,
    expiresIn: authToken.expires_at ? Math.floor((authToken.expires_at - Date.now()) / 1000) : 0
  });
});

// ============================================================
// ENDPOINT DE CACHE
// ============================================================

/**
 * POST /api/cache/clear - Limpar cache do servidor
 */
app.post('/api/cache/clear', (req, res) => {
  console.log('='.repeat(60));
  console.log('==> LIMPANDO CACHE DO SERVIDOR');
  console.log('='.repeat(60));
  
  const oldCache = {
    brands: cache.brands ? cache.brands.length : 0,
    models: Object.keys(cache.models).length,
    plans: !!cache.plans,
    lastUpdate: cache.lastUpdate
  };
  
  // Limpa todo o cache
  cache.brands = null;
  cache.models = {};
  cache.plans = null;
  cache.lastUpdate = null;
  
  console.log('==> ✅ CACHE LIMPO COM SUCESSO!');
  console.log(`==> Marcas em cache: ${oldCache.brands} → 0`);
  console.log(`==> Modelos em cache: ${oldCache.models} → 0`);
  console.log('='.repeat(60));
  
  res.json({
    success: true,
    message: 'Cache limpo com sucesso!',
    oldCache,
    newCache: {
      brands: 0,
      models: 0,
      plans: false
    }
  });
});

/**
 * GET /api/cache/status - Ver status do cache
 */
app.get('/api/cache/status', (req, res) => {
  res.json({
    success: true,
    cache: {
      brands: cache.brands ? cache.brands.length : 0,
      models: Object.keys(cache.models).length,
      plans: !!cache.plans,
      lastUpdate: cache.lastUpdate,
      age: cache.lastUpdate ? Math.floor((Date.now() - cache.lastUpdate) / 1000) : null
    }
  });
});

// ============================================================
// INICIALIZAÇÃO
// ============================================================

app.listen(PORT, async () => {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('==> PROTEGMAIS BACKEND - API OFICIAL CLUBFIX');
  console.log('==> VERSAO COMPLETA');
  console.log('='.repeat(60));
  console.log(`==> Porta: ${PORT}`);
  console.log(`==> Ambiente: HOMOLOGACAO`);
  console.log(`==> URL: https://protegmais.onrender.com`);
  console.log('='.repeat(60));
  console.log('\n');
  
  // Autentica ao iniciar
  const authenticated = await authenticate();
  
  if (authenticated) {
    console.log('==> ✅ SERVIDOR PRONTO!');
    console.log('==> Endpoints disponiveis:');
    console.log('==>   - GET  /health');
    console.log('==>   - GET  /api/clubfix/brands');
    console.log('==>   - POST /api/clubfix/brands/:id/models');
    console.log('==>   - GET  /api/clubfix/models');
    console.log('==>   - GET  /api/clubfix/plans');
    console.log('==>   - GET  /api/clubfix/quotation');
    console.log('==>   - POST /api/clubfix/customers');
    console.log('==>   - POST /api/clubfix/subscriptions');
    console.log('='.repeat(60));
    console.log('\n');
  } else {
    console.log('==> ⚠️ SERVIDOR INICIADO MAS NAO AUTENTICADO!');
    console.log('==> Verificar credenciais e endpoint');
    console.log('='.repeat(60));
    console.log('\n');
  }
});
