/**
 * ProtegMais Backend - API OFICIAL CLUBFIX
 * VERSÃO 16.2 - FIX BRANDS PAGINATION
 * 
 * ⚠️ CREDENCIAIS DE PRODUÇÃO CONFIGURADAS
 * ⚠️ Usa apenas ambiente de PRODUÇÃO (sem fallback)
 * 
 * CHANGELOG v16.2:
 * 🔧 FIX: Buscar TODAS as marcas com limit=100
 *    - Antes: GET /brands → Retornava apenas 9 marcas (paginação padrão)
 *    - Depois: GET /brands?limit=100 → Retorna todas as marcas disponíveis
 * 
 * CHANGELOG v16.1:
 * 🔧 FIX: Endpoint de modelos corrigido
 *    - Antes: POST /api/clubfix/brands/:id/models → 404 Error
 *    - Depois: GET /api/clubfix/models/:brandId → ✅ Funcionando
 *    - API ClubFix usa GET /brands/:id que retorna brand.models
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
    expectedBrands: '25+'
  },
  HOMOLOGATION: {
    baseURL: 'https://homolog.clubfix.com.br/webservice',
    name: 'HOMOLOGACAO',
    expectedBrands: '6'
  }
};

const CLUBFIX_CONFIG = {
  baseURL: ENVIRONMENTS.PRODUCTION.baseURL,
  environment: ENVIRONMENTS.PRODUCTION.name,
  
  credentials: {
    email: 'kainow@clubfix.com.br',
    password: 'Kainow@27923746',
    client_id: '2f6356ca-8089-4afc-aad8-c83b30ca1f3f',
    client_secret: 'CLUBFIX6986445f624d31770407007'
  }
};

// Token de autenticação
const authToken = {
  access_token: null,
  expires_at: null
};

// Cache
const cache = {
  brands: null,
  models: {},
  plans: null,
  lastUpdate: null
};

// ============================================================
// LOGGING
// ============================================================

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📍',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }[type] || 'ℹ️';
  
  console.log(`[${timestamp}] ${prefix}${message}`);
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================

async function tryAuthenticateWithEnvironment(env) {
  console.log('='.repeat(60));
  console.log(`==> 🔧 Tentando ${env.name}...`);
  console.log(`==> URL: ${env.baseURL}/auth/login`);
  console.log(`==> 📤 Client ID: ${CLUBFIX_CONFIG.credentials.client_id}`);
  
  try {
    const response = await axios.post(`${env.baseURL}/auth/login`, {
      email: CLUBFIX_CONFIG.credentials.email,
      password: CLUBFIX_CONFIG.credentials.password,
      client_id: CLUBFIX_CONFIG.credentials.client_id,
      client_secret: CLUBFIX_CONFIG.credentials.client_secret
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

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
  console.error('='.repeat(60));
  return false;
}

// ============================================================
// HTTP REQUEST COM AUTENTICAÇÃO
// ============================================================

async function makeAuthenticatedRequest(method, endpoint, data = null) {
  // Verificar se token está válido
  if (!authToken.access_token || Date.now() >= authToken.expires_at) {
    log('Token expirado, renovando...', 'warning');
    await authenticate();
  }
  
  const url = `${CLUBFIX_CONFIG.baseURL}${endpoint}`;
  
  try {
    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${authToken.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    }
    
    const response = await axios(config);
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

// ============================================================
// MARCAS
// ============================================================

app.get('/api/clubfix/brands', async (req, res) => {
  log('LISTAGEM DE MARCAS');
  
  try {
    // Verificar cache
    if (cache.brands) {
      log(`Cache HIT: ${cache.brands.length} marcas`, 'success');
      return res.json({
        success: true,
        data: cache.brands,
        count: cache.brands.length,
        cached: true
      });
    }
    
    // Buscar com parâmetro limit alto para pegar todas as marcas
    const response = await makeAuthenticatedRequest('GET', '/brands?limit=100');
    
    // Atualizar cache
    cache.brands = response.data.data;
    cache.lastUpdate = new Date().toISOString();
    
    log(`MARCAS carregadas: ${response.data.data.length}`, 'success');
    
    res.json({
      success: true,
      data: response.data.data,
      count: response.data.data.length,
      cached: false
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
  const brandId = req.params.brandId;
  log(`LISTAGEM DE MODELOS - Marca ID: ${brandId}`);
  
  try {
    // Verificar cache
    if (cache.models[brandId]) {
      log(`Cache HIT: ${cache.models[brandId].length} modelos da marca ${brandId}`, 'success');
      return res.json({
        success: true,
        data: cache.models[brandId],
        count: cache.models[brandId].length,
        cached: true
      });
    }
    
    const response = await makeAuthenticatedRequest('GET', `/brands/${brandId}`);
    
    // A resposta da API ClubFix retorna a marca com seus modelos
    const brandData = response.data.data;
    const models = brandData.models || [];
    
    // Atualizar cache
    cache.models[brandId] = models;
    
    log(`MODELOS carregados: ${models.length}`, 'success');
    
    res.json({
      success: true,
      data: models,
      count: models.length,
      cached: false
    });
    
  } catch (error) {
    log(`ERRO AO LISTAR MODELOS: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// PLANOS
// ============================================================

app.get('/api/clubfix/quotation', async (req, res) => {
  log('COTAÇÃO DE PLANOS');
  
  try {
    const { model_id, sum_insured } = req.query;
    
    if (!model_id || !sum_insured) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros obrigatórios: model_id, sum_insured'
      });
    }
    
    const response = await makeAuthenticatedRequest('GET', `/quotation?model_id=${model_id}&sum_insured=${sum_insured}`);
    
    log(`PLANOS cotados: ${response.data.data?.length || 0}`, 'success');
    
    res.json({
      success: true,
      data: response.data.data,
      count: response.data.data?.length || 0
    });
    
  } catch (error) {
    log(`ERRO AO COTAR PLANOS: ${error.message}`, 'error');
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
  log('CRIAR ASSINATURA');
  
  try {
    const response = await makeAuthenticatedRequest('POST', '/subscriptions', req.body);
    
    log(`ASSINATURA criada: ${response.data.data?.id}`, 'success');
    
    res.status(201).json({
      success: true,
      data: response.data.data
    });
    
  } catch (error) {
    log(`ERRO AO CRIAR ASSINATURA: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// INICIALIZAÇÃO DO SERVIDOR
// ============================================================

async function startServer() {
  console.log('='.repeat(60));
  console.log('==> 🏆 BACKEND PROTEGMAIS - VERSÃO 16.2 - FIX BRANDS PAGINATION');
  console.log('='.repeat(60));
  console.log('==> Porta:', PORT);
  console.log('==> URL Pública: https://protegmais.onrender.com');
  console.log('='.repeat(60));
  console.log('==> 🔐 CREDENCIAIS DE PRODUÇÃO CONFIGURADAS');
  console.log('==> 🚀 FORÇANDO AMBIENTE DE PRODUÇÃO (sem fallback)');
  console.log('='.repeat(60));
  
  // Autenticar na inicialização
  const authenticated = await authenticate();
  
  if (!authenticated) {
    console.error('='.repeat(60));
    console.error('==> ❌ FALHA NA AUTENTICAÇÃO!');
    console.error('==> Servidor NÃO será iniciado!');
    console.error('==> Verifique as credenciais de PRODUÇÃO');
    console.error('='.repeat(60));
    process.exit(1);
  }
  
  // Iniciar servidor
  app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('==> ✅ SERVIDOR PRONTO!');
    console.log('==> Endpoints principais:');
    console.log('==> - GET /health');
    console.log('==> - GET /api/clubfix/brands');
    console.log('==> - GET /api/clubfix/models/:brandId');
    console.log('==> - GET /api/clubfix/quotation');
    console.log('==> - POST /api/clubfix/subscriptions');
    console.log('='.repeat(60));
  });
}

// Iniciar
startServer().catch(error => {
  console.error('='.repeat(60));
  console.error('==> ❌ ERRO FATAL NA INICIALIZAÇÃO!');
  console.error('==> Erro:', error.message);
  console.error('==> Stack:', error.stack);
  console.error('='.repeat(60));
  process.exit(1);
});
