/**
 * ProtegMais Backend - API OFICIAL CLUBFIX - VERSÃO SUPER COMPLETA
 * Integração TOTAL com todos os endpoints do Webservice de Parceiros
 * 
 * Funcionalidades:
 * ✅ Autenticação OAuth2
 * ✅ Marcas e Modelos de Dispositivos
 * ✅ Planos de Assinatura
 * ✅ Cotações (Quotation)
 * ✅ Assinaturas (Subscriptions)
 * ✅ Pagamentos
 * ✅ Planos Anuais (Annual Plans)
 * ✅ Clientes (Customers)
 * ✅ Lojistas (Shopkeepers)
 * ✅ Cache inteligente
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

// Ambientes disponíveis
const ENVIRONMENTS = {
  PRODUCTION: {
    baseURL: 'https://clubfix.com.br/webservice',
    name: 'PRODUCAO',
    priority: 1,
    expectedBrands: '25+'
  },
  HOMOLOG: {
    baseURL: 'https://homolog.clubfix.com.br/webservice',
    name: 'HOMOLOGACAO',
    priority: 2,
    expectedBrands: '6'
  }
};

const CLUBFIX_CONFIG = {
  // URL base - será definida automaticamente no startup
  baseURL: null,
  environment: null,
  
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

// Cache inteligente
const cache = {
  brands: null,
  models: {},
  plans: null,
  annualPlans: {},
  lastUpdate: null
};

// ============================================================
// UTILITÁRIOS
// ============================================================

function getCredentialsHeader() {
  const credentials = `${CLUBFIX_CONFIG.credentials.email}:${CLUBFIX_CONFIG.credentials.password}`;
  return Buffer.from(credentials).toString('base64');
}

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : '📍';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================

async function tryAuthenticateWithEnvironment(env) {
  console.log(`==> 🔧 Tentando ${env.name}...`);
  console.log(`==> URL: ${env.baseURL}/auth/login`);
  
  try {
    const requestBody = {
      client_id: CLUBFIX_CONFIG.credentials.client_id,
      client_secret: CLUBFIX_CONFIG.credentials.client_secret
    };
    
    const requestHeaders = {
      'X-CREDENTIALS': getCredentialsHeader(),
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    
    const response = await axios.post(
      `${env.baseURL}/auth/login`,
      requestBody,
      { headers: requestHeaders }
    );

    const { access_token, expires_in } = response.data;
    
    // Sucesso! Configurar o ambiente
    CLUBFIX_CONFIG.baseURL = env.baseURL;
    CLUBFIX_CONFIG.environment = env.name;
    
    authToken.access_token = access_token;
    authToken.expires_at = Date.now() + (expires_in * 1000);
    
    console.log('==> ✅ AUTENTICACAO REALIZADA COM SUCESSO!');
    console.log(`==> Ambiente: ${env.name}`);
    console.log(`==> URL Base: ${env.baseURL}`);
    console.log(`==> Marcas Esperadas: ${env.expectedBrands}`);
    console.log(`==> Token expira em: ${expires_in} segundos`);
    console.log('='.repeat(60));
    
    return { success: true, environment: env };
  } catch (error) {
    console.log(`==> ⚠️ ${env.name} indisponível:`, error.response?.data?.message || error.message);
    return { success: false, error: error.message };
  }
}

async function authenticate() {
  console.log('='.repeat(60));
  console.log('==> 🚀 AUTO-DETECT: AUTENTICANDO NA API CLUBFIX...');
  console.log('='.repeat(60));
  console.log('==> Email:', CLUBFIX_CONFIG.credentials.email);
  console.log('==> Client ID:', CLUBFIX_CONFIG.credentials.client_id);
  console.log('='.repeat(60));
  
  // Tentar produção primeiro
  let result = await tryAuthenticateWithEnvironment(ENVIRONMENTS.PRODUCTION);
  
  if (result.success) {
    console.log('==> 🏆 PRODUCAO ATIVA! Sistema completo com 25+ marcas!');
    console.log('='.repeat(60));
    return true;
  }
  
  // Se produção falhar, tentar homologação
  console.log('==> 🔄 Tentando ambiente alternativo...');
  console.log('='.repeat(60));
  
  result = await tryAuthenticateWithEnvironment(ENVIRONMENTS.HOMOLOG);
  
  if (result.success) {
    console.log('==> ℹ️ HOMOLOGACAO ATIVA! 6 marcas disponíveis.');
    console.log('==> ⚠️ Para acessar PRODUCAO (25+ marcas), contate:');
    console.log('==> 📧 ti@clubfix.com.br');
    console.log('='.repeat(60));
    return true;
  }
  
  // Ambos falharam
  console.error('='.repeat(60));
  console.error('==> ❌ ERRO: Não foi possível autenticar em nenhum ambiente!');
  console.error('==> Produção:', result.error);
  console.error('==> Homologação:', result.error);
  console.error('==> Contate: ti@clubfix.com.br');
  console.error('='.repeat(60));
  return false;
}

async function ensureValidToken() {
  if (!authToken.access_token || Date.now() >= authToken.expires_at) {
    log('Token expirado ou inexistente, renovando...');
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
// ENDPOINTS - HEALTH & INFO
// ============================================================

app.get('/health', (req, res) => {
  const isProduction = CLUBFIX_CONFIG.environment === 'PRODUCAO';
  const expectedBrands = isProduction ? '25+' : '6';
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: CLUBFIX_CONFIG.environment || 'NOT_INITIALIZED',
    baseURL: CLUBFIX_CONFIG.baseURL || 'NOT_INITIALIZED',
    authenticated: !!authToken.access_token,
    tokenValid: authToken.access_token && Date.now() < authToken.expires_at,
    expectedBrands: expectedBrands,
    autoDetect: true,
    cache: {
      brands: cache.brands ? cache.brands.length : 0,
      models: Object.keys(cache.models).length,
      plans: !!cache.plans,
      lastUpdate: cache.lastUpdate
    },
    message: isProduction 
      ? '🏆 Produção ativa! Sistema completo com 25+ marcas'
      : CLUBFIX_CONFIG.environment === 'HOMOLOGACAO'
        ? 'ℹ️ Homologação ativa. Para produção (25+ marcas), contate ti@clubfix.com.br'
        : 'Inicializando...'
  });
});

app.get('/api/info', (req, res) => {
  res.json({
    name: 'ProtegMais Backend API',
    version: '3.0.0',
    environment: process.env.CLUBFIX_ENV || 'homologacao',
    baseURL: CLUBFIX_CONFIG.baseURL,
    endpoints: {
      health: 'GET /health',
      brands: 'GET /api/clubfix/brands',
      models: 'GET /api/clubfix/models',
      plans: 'GET /api/clubfix/plans',
      quotation: 'GET /api/clubfix/quotation',
      customers: 'POST /api/clubfix/customers',
      subscriptions: 'POST /api/clubfix/subscriptions',
      annualPlans: 'POST /api/clubfix/annual-plans',
      cache: 'POST /api/cache/clear'
    }
  });
});

// ============================================================
// ENDPOINTS - MARCAS (BRANDS)
// ============================================================

app.get('/api/clubfix/brands', async (req, res) => {
  console.log('='.repeat(60));
  log('REQUISICAO DE MARCAS');
  console.log('='.repeat(60));
  
  try {
    // Cache check
    if (cache.brands && cache.lastUpdate && (Date.now() - cache.lastUpdate < 3600000)) {
      log(`Retornando ${cache.brands.length} marcas do cache`, 'success');
      return res.json({
        success: true,
        cached: true,
        count: cache.brands.length,
        data: cache.brands
      });
    }
    
    log('Buscando marcas da API ClubFix...');
    
    const { page, per_page, include } = req.query;
    
    // Buscar TODAS as marcas (sem paginação limitada)
    const params = { 
      page: page || 1, 
      per_page: per_page || 200  // Aumentado para 200 para pegar todas as marcas
    };
    if (include) params.include = include;
    
    log(`Parametros: page=${params.page}, per_page=${params.per_page}`);
    
    const response = await makeAuthenticatedRequest('GET', '/brands', null, params);
    const brands = response.data.data || response.data;
    
    // Se a API usar paginação e houver mais páginas, buscar todas
    let allBrands = [...brands];
    
    if (response.data.meta && response.data.meta.last_page > 1) {
      log(`API tem ${response.data.meta.last_page} páginas. Buscando todas...`);
      
      for (let currentPage = 2; currentPage <= response.data.meta.last_page; currentPage++) {
        log(`Buscando página ${currentPage}...`);
        const pageResponse = await makeAuthenticatedRequest('GET', '/brands', null, {
          page: currentPage,
          per_page: params.per_page
        });
        
        const pageBrands = pageResponse.data.data || pageResponse.data;
        allBrands = [...allBrands, ...pageBrands];
      }
      
      log(`Total de marcas após buscar todas as páginas: ${allBrands.length}`);
    }
    
    cache.brands = allBrands;
    cache.lastUpdate = Date.now();
    
    log(`${allBrands.length} MARCAS REAIS OBTIDAS!`, 'success');
    log(`Total disponível na API: ${response.data.meta?.total || allBrands.length}`);
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      cached: false,
      count: allBrands.length,
      data: allBrands,
      meta: response.data.meta,
      links: response.data.links,
      message: allBrands.length < 25 ? 'Ambiente de homologação pode ter menos marcas. Para todas as 25+ marcas, usar ambiente de produção.' : null
    });
    
  } catch (error) {
    log(`ERRO AO BUSCAR MARCAS: ${error.response?.data?.message || error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

app.get('/api/clubfix/brands/:id', async (req, res) => {
  try {
    const { include } = req.query;
    const params = include ? { include } : null;
    
    const response = await makeAuthenticatedRequest('GET', `/brands/${req.params.id}`, null, params);
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// ENDPOINTS - MODELOS (MODELS)
// ============================================================

app.get('/api/clubfix/models', async (req, res) => {
  try {
    const { page, per_page, include } = req.query;
    const filterName = req.query['filter[name]'];
    const filterBrand = req.query['filter[brand]'];
    
    const params = { page, per_page, include };
    if (filterName) params['filter[name]'] = filterName;
    if (filterBrand) params['filter[brand]'] = filterBrand;
    
    const response = await makeAuthenticatedRequest('GET', '/models', null, params);
    const models = response.data.data || response.data;
    
    res.json({
      success: true,
      count: models.length,
      data: models,
      meta: response.data.meta,
      links: response.data.links
    });
    
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

app.post('/api/clubfix/brands/:id/models', async (req, res) => {
  console.log('='.repeat(60));
  log(`REQUISICAO DE MODELOS - Marca ID: ${req.params.id}`);
  console.log('='.repeat(60));
  
  try {
    const brandId = req.params.id;
    const cacheKey = `brand_${brandId}`;
    
    // Cache check
    if (cache.models[cacheKey] && (Date.now() - cache.models[cacheKey].timestamp < 3600000)) {
      log(`Retornando ${cache.models[cacheKey].data.length} modelos do cache`, 'success');
      return res.json({
        success: true,
        cached: true,
        count: cache.models[cacheKey].data.length,
        data: cache.models[cacheKey].data
      });
    }
    
    log('Buscando modelos da API ClubFix...');
    
    const response = await makeAuthenticatedRequest('GET', '/models', null, {
      'filter[brand]': brandId,
      per_page: 100
    });
    
    const models = response.data.data || response.data;
    
    const formattedModels = models.map(model => ({
      id: model.id,
      name: model.name,
      brandId: parseInt(brandId),
      brand: model.brand
    }));
    
    cache.models[cacheKey] = {
      timestamp: Date.now(),
      data: formattedModels
    };
    
    log(`${formattedModels.length} MODELOS REAIS OBTIDOS!`, 'success');
    console.log('='.repeat(60));
    
    res.json({
      success: true,
      cached: false,
      count: formattedModels.length,
      real: true,
      data: formattedModels
    });
    
  } catch (error) {
    log(`ERRO AO BUSCAR MODELOS: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

app.get('/api/clubfix/models/:id', async (req, res) => {
  try {
    const response = await makeAuthenticatedRequest('GET', `/models/${req.params.id}`);
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// ENDPOINTS - PLANOS (PLANS)
// ============================================================

app.get('/api/clubfix/plans', async (req, res) => {
  try {
    // Cache check
    if (cache.plans && cache.lastUpdate && (Date.now() - cache.lastUpdate < 3600000)) {
      return res.json({
        success: true,
        cached: true,
        data: cache.plans
      });
    }
    
    const { page } = req.query;
    const response = await makeAuthenticatedRequest('GET', '/plans', null, { page });
    
    cache.plans = response.data;
    cache.lastUpdate = Date.now();
    
    res.json({
      success: true,
      cached: false,
      data: response.data
    });
    
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

app.get('/api/clubfix/plans/:id', async (req, res) => {
  try {
    const response = await makeAuthenticatedRequest('GET', `/plans/${req.params.id}`);
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// ENDPOINTS - COTAÇÕES (QUOTATION)
// ============================================================

app.get('/api/clubfix/quotation', async (req, res) => {
  log('COTACAO - Todos os planos');
  
  try {
    const { model_id, is_used } = req.query;
    
    const response = await makeAuthenticatedRequest('GET', '/quotation', null, {
      model_id,
      is_used
    });
    
    log('COTACAO realizada com sucesso!', 'success');
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    log(`ERRO NA COTACAO: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

app.get('/api/clubfix/plans/:id/quotation', async (req, res) => {
  log(`COTACAO - Plano ID: ${req.params.id}`);
  
  try {
    const { model_id, is_used } = req.query;
    
    const response = await makeAuthenticatedRequest(
      'GET',
      `/plans/${req.params.id}/quotation`,
      null,
      { model_id, is_used }
    );
    
    log('COTACAO realizada com sucesso!', 'success');
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    log(`ERRO NA COTACAO: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// ENDPOINTS - CLIENTES (CUSTOMERS)
// ============================================================

app.post('/api/clubfix/customers', async (req, res) => {
  log('REGISTRO DE CLIENTE');
  
  try {
    const response = await makeAuthenticatedRequest('POST', '/customers', req.body);
    
    log(`CLIENTE registrado: ID ${response.data.id}`, 'success');
    
    res.status(201).json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    log(`ERRO AO REGISTRAR CLIENTE: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
});

app.get('/api/clubfix/customers/:document', async (req, res) => {
  log(`BUSCA DE CLIENTE - Documento: ${req.params.document}`);
  
  try {
    const { include } = req.query;
    const params = include ? { include } : null;
    
    const response = await makeAuthenticatedRequest(
      'GET',
      `/customers/${req.params.document}`,
      null,
      params
    );
    
    log('CLIENTE encontrado!', 'success');
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    log(`ERRO AO BUSCAR CLIENTE: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// ENDPOINTS - ASSINATURAS (SUBSCRIPTIONS)
// ============================================================

app.get('/api/clubfix/subscriptions', async (req, res) => {
  log('LISTAGEM DE ASSINATURAS');
  
  try {
    const response = await makeAuthenticatedRequest('GET', '/subscriptions');
    
    log('ASSINATURAS obtidas com sucesso!', 'success');
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    log(`ERRO AO LISTAR ASSINATURAS: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

app.post('/api/clubfix/subscriptions', async (req, res) => {
  log('CRIACAO DE ASSINATURA');
  
  try {
    const response = await makeAuthenticatedRequest('POST', '/subscriptions', req.body);
    
    log(`ASSINATURA criada: ID ${response.data.id}`, 'success');
    
    res.status(201).json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    log(`ERRO AO CRIAR ASSINATURA: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
});

app.get('/api/clubfix/subscriptions/:id', async (req, res) => {
  log(`BUSCA DE ASSINATURA - ID: ${req.params.id}`);
  
  try {
    const response = await makeAuthenticatedRequest('GET', `/subscriptions/${req.params.id}`);
    
    log('ASSINATURA encontrada!', 'success');
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    log(`ERRO AO BUSCAR ASSINATURA: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

app.post('/api/clubfix/subscriptions/:id/payment', async (req, res) => {
  log(`PAGAMENTO DE ASSINATURA - ID: ${req.params.id}`);
  
  try {
    const response = await makeAuthenticatedRequest(
      'POST',
      `/subscriptions/${req.params.id}/payment`,
      req.body
    );
    
    log('PAGAMENTO processado com sucesso!', 'success');
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    log(`ERRO AO PROCESSAR PAGAMENTO: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
});

// ============================================================
// ENDPOINTS - PLANOS ANUAIS (ANNUAL PLANS)
// ============================================================

app.get('/api/clubfix/annual-plans/quote', async (req, res) => {
  log('COTACAO DE PLANO ANUAL');
  
  try {
    const { model_id, used } = req.query;
    
    const response = await makeAuthenticatedRequest('GET', '/annual-plans/quote', null, {
      model_id,
      used
    });
    
    log('COTACAO de plano anual realizada!', 'success');
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    log(`ERRO NA COTACAO: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

app.post('/api/clubfix/annual-plans', async (req, res) => {
  log('REGISTRO DE PLANO ANUAL');
  
  try {
    const response = await makeAuthenticatedRequest('POST', '/annual-plans', req.body);
    
    log(`PLANO ANUAL registrado: ID ${response.data.id}`, 'success');
    
    res.status(201).json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    log(`ERRO AO REGISTRAR PLANO ANUAL: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
});

app.get('/api/clubfix/annual-plans/:id', async (req, res) => {
  log(`BUSCA DE PLANO ANUAL - ID: ${req.params.id}`);
  
  try {
    const response = await makeAuthenticatedRequest('GET', `/annual-plans/${req.params.id}`);
    
    log('PLANO ANUAL encontrado!', 'success');
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    log(`ERRO AO BUSCAR PLANO ANUAL: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// ENDPOINTS - LOJISTAS (SHOPKEEPERS)
// ============================================================

app.post('/api/clubfix/shopkeepers', async (req, res) => {
  log('REGISTRO DE LOJISTA');
  
  try {
    const response = await makeAuthenticatedRequest('POST', '/shopkeepers', req.body);
    
    log(`LOJISTA registrado: ID ${response.data.id}`, 'success');
    
    res.status(201).json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    log(`ERRO AO REGISTRAR LOJISTA: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
});

app.get('/api/clubfix/shopkeepers/:id', async (req, res) => {
  log(`BUSCA DE LOJISTA - ID: ${req.params.id}`);
  
  try {
    const { page, per_page, include } = req.query;
    const params = { page, per_page, include };
    
    const response = await makeAuthenticatedRequest(
      'GET',
      `/shopkeepers/${req.params.id}`,
      null,
      params
    );
    
    log('LOJISTA encontrado!', 'success');
    
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    log(`ERRO AO BUSCAR LOJISTA: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// ENDPOINTS - CACHE
// ============================================================

app.post('/api/cache/clear', (req, res) => {
  log('LIMPANDO CACHE');
  
  const oldCache = {
    brands: cache.brands ? cache.brands.length : 0,
    models: Object.keys(cache.models).length,
    plans: !!cache.plans
  };
  
  cache.brands = null;
  cache.models = {};
  cache.plans = null;
  cache.annualPlans = {};
  cache.lastUpdate = null;
  
  log('CACHE limpo com sucesso!', 'success');
  
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

app.get('/api/cache/status', (req, res) => {
  res.json({
    success: true,
    cache: {
      brands: cache.brands ? cache.brands.length : 0,
      models: Object.keys(cache.models).length,
      plans: !!cache.plans,
      annualPlans: Object.keys(cache.annualPlans).length,
      lastUpdate: cache.lastUpdate,
      age: cache.lastUpdate ? Math.floor((Date.now() - cache.lastUpdate) / 1000) : null
    }
  });
});

// ============================================================
// ENDPOINT DE SESSÃO
// ============================================================

app.get('/api/clubfix/session', (req, res) => {
  res.json({
    authenticated: !!authToken.access_token,
    tokenValid: authToken.access_token && Date.now() < authToken.expires_at,
    expiresIn: authToken.expires_at ? Math.floor((authToken.expires_at - Date.now()) / 1000) : 0,
    environment: CLUBFIX_CONFIG.environment,
    baseURL: CLUBFIX_CONFIG.baseURL
  });
});

// ============================================================
// INICIALIZAÇÃO
// ============================================================

app.listen(PORT, async () => {
  console.log('\n');
  console.log('\n');
  console.log('='.repeat(60));
  console.log('==> 🏆 PROTEGMAIS BACKEND - API OFICIAL CLUBFIX');
  console.log('==> 🚀 VERSAO AUTO-DETECT v3.1');
  console.log('='.repeat(60));
  console.log(`==> Porta: ${PORT}`);
  console.log(`==> URL Publica: https://protegmais.onrender.com`);
  console.log('='.repeat(60));
  console.log('==> 🔍 AUTO-DETECT: Detectando melhor ambiente...');
  console.log('==> 1️⃣ Tentará PRODUCAO primeiro (25+ marcas)');
  console.log('==> 2️⃣ Se falhar, usa HOMOLOGACAO (6 marcas)');
  console.log('='.repeat(60));
  console.log('\n');
  
  const authenticated = await authenticate();
  
  if (authenticated) {
    console.log('==> ✅ SERVIDOR PRONTO!');
    console.log('==> Endpoints disponiveis:');
    console.log('==>');
    console.log('==>   GERAL:');
    console.log('==>   - GET  /health');
    console.log('==>   - GET  /api/info');
    console.log('==>   - GET  /api/clubfix/session');
    console.log('==>');
    console.log('==>   DISPOSITIVOS:');
    console.log('==>   - GET  /api/clubfix/brands');
    console.log('==>   - GET  /api/clubfix/brands/:id');
    console.log('==>   - GET  /api/clubfix/models');
    console.log('==>   - POST /api/clubfix/brands/:id/models');
    console.log('==>   - GET  /api/clubfix/models/:id');
    console.log('==>');
    console.log('==>   PLANOS:');
    console.log('==>   - GET  /api/clubfix/plans');
    console.log('==>   - GET  /api/clubfix/plans/:id');
    console.log('==>');
    console.log('==>   COTACOES:');
    console.log('==>   - GET  /api/clubfix/quotation');
    console.log('==>   - GET  /api/clubfix/plans/:id/quotation');
    console.log('==>');
    console.log('==>   CLIENTES:');
    console.log('==>   - POST /api/clubfix/customers');
    console.log('==>   - GET  /api/clubfix/customers/:document');
    console.log('==>');
    console.log('==>   ASSINATURAS:');
    console.log('==>   - GET  /api/clubfix/subscriptions');
    console.log('==>   - POST /api/clubfix/subscriptions');
    console.log('==>   - GET  /api/clubfix/subscriptions/:id');
    console.log('==>   - POST /api/clubfix/subscriptions/:id/payment');
    console.log('==>');
    console.log('==>   PLANOS ANUAIS:');
    console.log('==>   - GET  /api/clubfix/annual-plans/quote');
    console.log('==>   - POST /api/clubfix/annual-plans');
    console.log('==>   - GET  /api/clubfix/annual-plans/:id');
    console.log('==>');
    console.log('==>   LOJISTAS:');
    console.log('==>   - POST /api/clubfix/shopkeepers');
    console.log('==>   - GET  /api/clubfix/shopkeepers/:id');
    console.log('==>');
    console.log('==>   CACHE:');
    console.log('==>   - GET  /api/cache/status');
    console.log('==>   - POST /api/cache/clear');
    console.log('='.repeat(60));
    console.log('\n');
  } else {
    console.log('==> ⚠️ SERVIDOR INICIADO MAS NAO AUTENTICADO!');
    console.log('==> Verificar credenciais');
    console.log('='.repeat(60));
    console.log('\n');
  }
});
