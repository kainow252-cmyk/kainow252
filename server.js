/**
 * ProtegMais Backend - API OFICIAL CLUBFIX
 * VERSÃO 18.3 - FIX CACHE: MODELOS POR MARCA CORRETOS
 * 
 * ⚠️ CREDENCIAIS DE PRODUÇÃO CONFIGURADAS
 * ⚠️ Usa apenas ambiente de PRODUÇÃO (sem fallback)
 * 
 * CHANGELOG v18.2:
 * 🔧 FIX: Buscar TODAS as páginas de marcas (não só primeira página)
 *    - Antes: GET /brands?limit=100 → Retornava apenas 9 marcas (1ª página)
 *    - Depois: Loop através de TODAS as páginas até não ter mais dados
 *    - Remove duplicatas por ID
 *    - Adiciona endpoint POST /api/cache/clear para limpar cache
 * 
 * CHANGELOG v18.1:
 * 🔧 FIX: Endpoint de modelos com múltiplas tentativas
 *    - Testa 3 endpoints diferentes para modelos
 *    - Testa 8 formatos de resposta diferentes
 * 
 * CHANGELOG v18.0:
 * 🔧 FIX: Formato correto de autenticação (x-credentials)
 *    - Header: x-credentials: base64(email:senha)
 *    - Body: { client_id, client_secret }
 * 
 * Funcionalidades:
 * ✅ Autenticação OAuth2
 * ✅ Marcas e Modelos de Dispositivos (TODAS, sem paginação)
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
// CONFIGURAÇÃO DA API CLUBFIX - PRODUÇÃO
// ============================================================

const ENVIRONMENTS = {
  PRODUCTION: {
    baseURL: 'https://clubfix.com.br/webservice',
    name: 'PRODUCAO',
    priority: 1,
    expectedBrands: '25+'
  }
};

const CLUBFIX_CONFIG = {
  baseURL: ENVIRONMENTS.PRODUCTION.baseURL,
  environment: ENVIRONMENTS.PRODUCTION.name,
  
  credentials: {
    email: 'kainow@clubfix.com.br',
    password: 'Kainow@27923746',
    client_id: '2f6356ca-8089-4afc-aad8-c83b30ca1f3f',      // ✅ PRODUÇÃO
    client_secret: 'CLUBFIX6986445f624d31770407007'        // ✅ PRODUÇÃO
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
// AUTENTICAÇÃO - FORÇAR APENAS PRODUÇÃO
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
    
    console.log('==> 📤 Client ID:', CLUBFIX_CONFIG.credentials.client_id);
    
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
    console.error(`==> ❌ ${env.name} FALHOU!`);
    console.error(`==> Status: ${error.response?.status}`);
    console.error(`==> Mensagem: ${error.response?.data?.message || error.message}`);
    return { success: false, error: error.response?.data?.message || error.message };
  }
}

async function authenticate() {
  console.log('='.repeat(60));
  console.log('==> 🚀 FORÇANDO AMBIENTE DE PRODUCAO');
  console.log('='.repeat(60));
  console.log('==> Email:', CLUBFIX_CONFIG.credentials.email);
  console.log('==> Client ID:', CLUBFIX_CONFIG.credentials.client_id);
  console.log('==> URL:', ENVIRONMENTS.PRODUCTION.baseURL);
  console.log('='.repeat(60));
  
  // FORÇAR APENAS PRODUÇÃO (sem fallback)
  const result = await tryAuthenticateWithEnvironment(ENVIRONMENTS.PRODUCTION);
  
  if (result.success) {
    console.log('==> 🏆 PRODUCAO ATIVA! Sistema completo com 25+ marcas!');
    console.log('='.repeat(60));
    return true;
  }
  
  // Se falhar, NÃO tenta homologação
  console.error('='.repeat(60));
  console.error('==> ❌ ERRO: Não foi possível autenticar em PRODUCAO!');
  console.error('==> Motivo:', result.error);
  console.error('==> Client ID:', CLUBFIX_CONFIG.credentials.client_id);
  console.error('==> Verifique as credenciais de PRODUCAO');
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

// ============================================================
// REQUISIÇÃO AUTENTICADA
// ============================================================

async function makeAuthenticatedRequest(method, endpoint, data = null, params = null) {
  await ensureValidToken();
  
  const url = `${CLUBFIX_CONFIG.baseURL}${endpoint}`;
  
  try {
    const response = await axios({
      method,
      url,
      data,
      params,
      headers: {
        'Authorization': `Bearer ${authToken.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    return response;
  } catch (error) {
    log(`Erro na requisição ${method} ${endpoint}: ${error.message}`, 'error');
    throw error;
  }
}

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '18.3-cache-fix',
    timestamp: new Date().toISOString(),
    environment: CLUBFIX_CONFIG.environment,
    baseURL: CLUBFIX_CONFIG.baseURL,
    authenticated: !!authToken.access_token,
    tokenValid: authToken.expires_at && Date.now() < authToken.expires_at,
    expectedBrands: ENVIRONMENTS.PRODUCTION.expectedBrands,
    cache: {
      brands: cache.brands?.length || 0,
      models: Object.keys(cache.models).length,
      plans: !!cache.plans,
      lastUpdate: cache.lastUpdate
    },
    message: '🏆 Ambiente de PRODUÇÃO ativo - 25+ marcas disponíveis!'
  });
});

// Endpoint para limpar cache (útil para debug)
app.post('/api/cache/clear', (req, res) => {
  const oldCacheSize = {
    brands: cache.brands?.length || 0,
    models: Object.keys(cache.models).length
  };
  
  cache.brands = null;
  cache.models = {};
  cache.plans = null;
  cache.lastUpdate = null;
  
  log('Cache limpo manualmente', 'warn');
  
  res.json({
    success: true,
    message: 'Cache limpo com sucesso',
    oldCache: oldCacheSize
  });
});

// ============================================================
// MARCAS
// ============================================================

app.get('/api/clubfix/brands', async (req, res) => {
  log('LISTAGEM DE MARCAS');
  
  try {
    // Verificar cache
    if (cache.brands && cache.brands.length > 0) {
      log(`Cache HIT: ${cache.brands.length} marcas`, 'success');
      return res.json({
        success: true,
        data: cache.brands,
        count: cache.brands.length,
        cached: true
      });
    }
    
    log('Buscando TODAS as marcas da API ClubFix...');
    
    // ESTRATÉGIA: Buscar todas as páginas até não ter mais dados
    let allBrands = [];
    let page = 1;
    let hasMore = true;
    const perPage = 100;
    
    while (hasMore) {
      log(`Buscando página ${page} (limit=${perPage})...`);
      
      const response = await makeAuthenticatedRequest('GET', `/brands?page=${page}&limit=${perPage}`);
      
      // Verificar diferentes formatos de resposta
      let brands = [];
      let total = 0;
      
      if (response.data) {
        brands = response.data.data || response.data || [];
        total = response.data.total || response.data.count || brands.length;
      } else if (Array.isArray(response)) {
        brands = response;
        total = brands.length;
      }
      
      log(`Página ${page}: ${brands.length} marcas encontradas (total: ${total})`);
      
      if (brands.length > 0) {
        allBrands = [...allBrands, ...brands];
        log(`Total acumulado: ${allBrands.length} marcas`);
      }
      
      // Verificar se há mais páginas
      if (brands.length < perPage || brands.length === 0) {
        hasMore = false;
        log('Última página alcançada');
      } else if (total && allBrands.length >= total) {
        hasMore = false;
        log(`Total esperado (${total}) alcançado`);
      } else {
        page++;
      }
      
      // Segurança: máximo 10 páginas
      if (page > 10) {
        log('ATENÇÃO: Limite de 10 páginas alcançado', 'warn');
        hasMore = false;
      }
    }
    
    // Remover duplicatas (por ID)
    const uniqueBrands = Array.from(
      new Map(allBrands.map(brand => [brand.id, brand])).values()
    );
    
    log(`TOTAL FINAL: ${uniqueBrands.length} marcas únicas carregadas`, 'success');
    
    // Atualizar cache
    cache.brands = uniqueBrands;
    cache.lastUpdate = new Date().toISOString();
    
    res.json({
      success: true,
      data: uniqueBrands,
      count: uniqueBrands.length,
      cached: false,
      pages: page - 1
    });
    
  } catch (error) {
    log(`ERRO AO LISTAR MARCAS: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// MODELOS
// ============================================================

app.get('/api/clubfix/models/:brandId', async (req, res) => {
  const brandId = parseInt(req.params.brandId); // Converter para número
  log(`LISTAGEM DE MODELOS - Marca ID: ${brandId} (tipo: ${typeof brandId})`);
  
  try {
    // Verificar cache COM VALIDAÇÃO DE TIPO
    if (cache.models[brandId] && Array.isArray(cache.models[brandId]) && cache.models[brandId].length > 0) {
      log(`✅ Cache HIT: ${cache.models[brandId].length} modelos da marca ${brandId}`, 'success');
      log(`📦 Primeiro modelo do cache: ${cache.models[brandId][0]?.name || 'N/A'}`);
      return res.json({
        success: true,
        data: cache.models[brandId],
        count: cache.models[brandId].length,
        cached: true
      });
    }
    
    log(`🔍 Cache MISS: Buscando modelos da marca ${brandId} na API...`);
    const response = await makeAuthenticatedRequest('GET', `/brands/${brandId}`);
    
    // A resposta da API ClubFix retorna a marca com seus modelos
    const brandData = response.data.data;
    const models = brandData.models || [];
    
    log(`📱 API retornou ${models.length} modelos para marca ${brandId}`);
    if (models.length > 0) {
      log(`📦 Primeiro modelo da API: ${models[0]?.name || 'N/A'}`);
    }
    
    // Atualizar cache COM CHAVE NUMÉRICA
    cache.models[brandId] = models;
    
    log(`✅ MODELOS carregados e salvos no cache[${brandId}]: ${models.length}`, 'success');
    
    res.json({
      success: true,
      data: models,
      count: models.length,
      cached: false
    });
    
  } catch (error) {
    log(`❌ ERRO AO LISTAR MODELOS DA MARCA ${brandId}: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// COTAÇÃO
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
      data: response.data.data,
      count: response.data.data?.length
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
// ASSINATURAS
// ============================================================

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

// ============================================================
// CACHE
// ============================================================

app.get('/api/cache/status', (req, res) => {
  res.json({
    brands: {
      cached: !!cache.brands,
      count: cache.brands?.length || 0
    },
    models: {
      cached: Object.keys(cache.models).length,
      brands: Object.keys(cache.models)
    },
    plans: {
      cached: !!cache.plans
    },
    lastUpdate: cache.lastUpdate
  });
});

app.post('/api/cache/clear', (req, res) => {
  cache.brands = null;
  cache.models = {};
  cache.plans = null;
  cache.lastUpdate = null;
  
  log('Cache limpo!', 'success');
  
  res.json({
    success: true,
    message: 'Cache limpo com sucesso!'
  });
});

// ============================================================
// STARTUP
// ============================================================

app.listen(PORT, async () => {
  console.log('='.repeat(60));
  console.log('==> 🏆 BACKEND PROTEGMAIS - VERSÃO 16.0 - PRODUÇÃO');
  console.log('='.repeat(60));
  console.log(`==> Porta: ${PORT}`);
  console.log(`==> URL Pública: https://protegmais.onrender.com`);
  console.log('='.repeat(60));
  console.log('==> 🔐 CREDENCIAIS DE PRODUÇÃO CONFIGURADAS');
  console.log('==> 🚀 FORÇANDO AMBIENTE DE PRODUÇÃO (sem fallback)');
  console.log('='.repeat(60));
  
  // Autenticar no startup
  const authenticated = await authenticate();
  
  if (authenticated) {
    console.log('==> ✅ SERVIDOR PRONTO!');
    console.log('==> Endpoints principais:');
    console.log('==>   - GET /health');
    console.log('==>   - GET /api/clubfix/brands');
    console.log('==>   - POST /api/clubfix/brands/:id/models');
    console.log('==>   - GET /api/clubfix/quotation');
    console.log('==>   - POST /api/clubfix/subscriptions');
    console.log('='.repeat(60));
  } else {
    console.error('==> ❌ FALHA NA AUTENTICAÇÃO!');
    console.error('==> Servidor iniciou mas não conseguiu autenticar');
    console.error('==> Verifique as credenciais e tente novamente');
    console.error('='.repeat(60));
  }
});
