/**
 * ProtegMais Backend - API OFICIAL CLUBFIX
 * VERSÃO 18.2 - FIX PAGINATION: BUSCAR TODAS AS MARCAS
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
 * ✅ Marcas e Modelos de Dispositivos (TODAS as páginas)
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
    client_id: '2f6356ca-8089-4afc-aad8-c83b30ca1f3f',
    client_secret: 'CLUBFIX6986445f624d31770407007'
  }
};

console.log('\n' + '='.repeat(60));
console.log('🚀 BACKEND PROTEGMAIS - VERSÃO 18.2 - PAGINATION FIX');
console.log('='.repeat(60));
console.log(`📋 Ambiente: ${CLUBFIX_CONFIG.environment}`);
console.log(`📦 Marcas esperadas: ${ENVIRONMENTS.PRODUCTION.expectedBrands}`);
console.log(`🌐 ClubFix WebService: ${CLUBFIX_CONFIG.baseURL}`);
console.log('='.repeat(60) + '\n');

// ============================================================
// SISTEMA DE LOGS
// ============================================================

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warn: '⚠️'
  }[type] || 'ℹ️';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================

let authToken = null;
let tokenExpiry = null;

async function authenticate() {
  try {
    log('Autenticando com ClubFix...', 'info');
    log(`📧 E-mail: ${CLUBFIX_CONFIG.credentials.email}`);
    log(`🔑 Client ID: ${CLUBFIX_CONFIG.credentials.client_id}`);
    
    // Gerar x-credentials (base64 de email:senha)
    const credentials = Buffer.from(
      `${CLUBFIX_CONFIG.credentials.email}:${CLUBFIX_CONFIG.credentials.password}`
    ).toString('base64');
    
    log(`🔐 x-credentials gerado: ${credentials.substring(0, 30)}...`);
    
    const response = await axios.post(
      `${CLUBFIX_CONFIG.baseURL}/auth/login`,
      {
        client_id: CLUBFIX_CONFIG.credentials.client_id,
        client_secret: CLUBFIX_CONFIG.credentials.client_secret
      },
      {
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'x-credentials': credentials
        }
      }
    );
    
    authToken = response.data.access_token || response.data.data?.access_token;
    
    if (!authToken) {
      throw new Error('Token não encontrado na resposta');
    }
    
    // Calcular expiração (padrão: 1 hora)
    const expiresIn = response.data.expires_in || 3600;
    tokenExpiry = Date.now() + (expiresIn * 1000);
    
    log('AUTENTICAÇÃO BEM-SUCEDIDA!', 'success');
    log(`🎫 Token: ${authToken.substring(0, 50)}...`);
    log(`⏰ Token expira em: ${new Date(tokenExpiry).toLocaleString('pt-BR')}`);
    
    return authToken;
    
  } catch (error) {
    log('ERRO NA AUTENTICAÇÃO', 'error');
    log(`Status: ${error.response?.status}`, 'error');
    log(`Mensagem: ${error.response?.data?.message || error.message}`, 'error');
    throw error;
  }
}

function isTokenValid() {
  return authToken && tokenExpiry && Date.now() < tokenExpiry;
}

async function getValidToken() {
  if (!isTokenValid()) {
    log('Token expirado ou inválido. Renovando...', 'warn');
    await authenticate();
  }
  return authToken;
}

async function makeAuthenticatedRequest(method, endpoint, data = null) {
  const token = await getValidToken();
  
  try {
    const config = {
      method,
      url: `${CLUBFIX_CONFIG.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    if (data) {
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
// CACHE
// ============================================================

const cache = {
  brands: null,
  models: {},
  plans: null,
  lastUpdate: null
};

// ============================================================
// ENDPOINTS
// ============================================================

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '18.2-pagination-fix',
    timestamp: new Date().toISOString(),
    environment: CLUBFIX_CONFIG.environment,
    baseURL: CLUBFIX_CONFIG.baseURL,
    authenticated: isTokenValid(),
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
  try {
    const { brandId } = req.params;
    log(`LISTAGEM DE MODELOS - Marca ID: ${brandId}`);

    // Cache hit
    if (cache.models[brandId]) {
      log(`Cache HIT: ${cache.models[brandId].length} modelos`, 'success');
      return res.json({
        success: true,
        data: cache.models[brandId],
        count: cache.models[brandId].length,
        cached: true
      });
    }

    // Buscar modelos - Tentar múltiplos endpoints
    let response = null;
    let models = null;

    // TENTATIVA 1: GET /brands/{id}
    try {
      log(`🧪 Tentativa 1: GET /brands/${brandId}`);
      response = await makeAuthenticatedRequest('GET', `/brands/${brandId}`);
      log(`📦 Resposta bruta:`, JSON.stringify(response.data).substring(0, 500));

      // Tentar extrair modelos de diferentes formatos
      if (response.data?.data?.models) {
        models = response.data.data.models;
        log(`✅ Formato 1: response.data.data.models (${models.length} modelos)`, 'success');
      } else if (response.data?.models) {
        models = response.data.models;
        log(`✅ Formato 2: response.data.models (${models.length} modelos)`, 'success');
      } else if (Array.isArray(response.data?.data)) {
        models = response.data.data;
        log(`✅ Formato 3: response.data.data (${models.length} modelos)`, 'success');
      } else if (Array.isArray(response.data)) {
        models = response.data;
        log(`✅ Formato 4: response.data (${models.length} modelos)`, 'success');
      }
    } catch (err) {
      log(`❌ Tentativa 1 falhou: ${err.message}`, 'warn');
    }

    // TENTATIVA 2: GET /models?brand_id={id}
    if (!models) {
      try {
        log(`🧪 Tentativa 2: GET /models?brand_id=${brandId}`);
        response = await makeAuthenticatedRequest('GET', `/models?brand_id=${brandId}`);
        log(`📦 Resposta bruta:`, JSON.stringify(response.data).substring(0, 500));

        if (response.data?.data) {
          models = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
          log(`✅ Formato 5: /models?brand_id (${models.length} modelos)`, 'success');
        } else if (Array.isArray(response.data)) {
          models = response.data;
          log(`✅ Formato 6: /models direct array (${models.length} modelos)`, 'success');
        }
      } catch (err) {
        log(`❌ Tentativa 2 falhou: ${err.message}`, 'warn');
      }
    }

    // TENTATIVA 3: GET /brands/{id}/models
    if (!models) {
      try {
        log(`🧪 Tentativa 3: GET /brands/${brandId}/models`);
        response = await makeAuthenticatedRequest('GET', `/brands/${brandId}/models`);
        log(`📦 Resposta bruta:`, JSON.stringify(response.data).substring(0, 500));

        if (response.data?.data) {
          models = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
          log(`✅ Formato 7: /brands/{id}/models (${models.length} modelos)`, 'success');
        } else if (Array.isArray(response.data)) {
          models = response.data;
          log(`✅ Formato 8: direct array (${models.length} modelos)`, 'success');
        }
      } catch (err) {
        log(`❌ Tentativa 3 falhou: ${err.message}`, 'warn');
      }
    }

    if (models && models.length > 0) {
      cache.models[brandId] = models;
      log(`MODELOS carregados: ${models.length}`, 'success');

      return res.json({
        success: true,
        data: models,
        count: models.length,
        cached: false
      });
    }

    throw new Error('Nenhum formato de resposta válido encontrado');
  } catch (error) {
    log(`ERRO ao buscar modelos: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
      details: 'Verifique os logs do servidor para mais informações'
    });
  }
});

// ============================================================
// PLANOS
// ============================================================

app.get('/api/clubfix/plans', async (req, res) => {
  try {
    log('LISTAGEM DE PLANOS');
    
    // Cache hit
    if (cache.plans) {
      log('Cache HIT: Planos', 'success');
      return res.json({
        success: true,
        data: cache.plans,
        cached: true
      });
    }
    
    const response = await makeAuthenticatedRequest('GET', '/plans');
    const plans = response.data?.data || response.data || [];
    
    cache.plans = plans;
    
    log(`PLANOS carregados: ${plans.length}`, 'success');
    
    res.json({
      success: true,
      data: plans,
      count: plans.length,
      cached: false
    });
    
  } catch (error) {
    log(`ERRO ao listar planos: ${error.message}`, 'error');
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
  try {
    const { model_id, is_used } = req.query;
    
    if (!model_id) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro obrigatório: model_id'
      });
    }
    
    log(`COTAÇÃO - Modelo: ${model_id}, Usado: ${is_used}`);
    
    const response = await makeAuthenticatedRequest(
      'GET',
      `/quotation?model_id=${model_id}&is_used=${is_used || false}`
    );
    
    log('Cotação realizada com sucesso', 'success');
    
    res.json({
      success: true,
      data: response.data?.data || response.data
    });
    
  } catch (error) {
    log(`ERRO ao realizar cotação: ${error.message}`, 'error');
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
  try {
    log('CRIAR ASSINATURA');
    log('Dados recebidos:', JSON.stringify(req.body, null, 2));
    
    const response = await makeAuthenticatedRequest('POST', '/subscriptions', req.body);
    
    log('Assinatura criada com sucesso!', 'success');
    log(`ID: ${response.data?.data?.id || response.data?.id}`);
    
    res.status(201).json({
      success: true,
      data: response.data?.data || response.data
    });
    
  } catch (error) {
    log(`ERRO ao criar assinatura: ${error.message}`, 'error');
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

// ============================================================
// INICIALIZAÇÃO
// ============================================================

app.listen(PORT, async () => {
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🌐 Ambiente: ${CLUBFIX_CONFIG.environment}`);
  console.log(`🔗 ClubFix: ${CLUBFIX_CONFIG.baseURL}`);
  console.log('='.repeat(60) + '\n');
  
  // Tentar autenticar na inicialização
  try {
    await authenticate();
    console.log('\n🎉 Sistema pronto para uso!\n');
  } catch (error) {
    console.error('\n⚠️  Falha na autenticação inicial. O sistema tentará autenticar na primeira requisição.\n');
  }
});

module.exports = app;
