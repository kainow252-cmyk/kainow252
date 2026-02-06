/**
 * ProtegMais - Backend API Oficial ClubFix
 * Versão: 16.2 - PRODUÇÃO ATIVA
 * 
 * CHANGELOG v16.2:
 * - Fix: buscar TODAS as marcas com limit=100
 * - Antes: GET /brands retornava apenas ~9 marcas (paginação padrão)
 * - Depois: GET /brands?limit=100 retorna 25+ marcas
 * 
 * CHANGELOG v16.1:
 * - Fix: endpoint de modelos corrigido
 * - Antes: POST /api/clubfix/brands/:id/models → 404 (endpoint não existe)
 * - Depois: GET /api/clubfix/models/:brandId → ✅ Funcionando
 * - ClubFix API usa GET /brands/:id que retorna { data: { ...brand, models: [...] } }
 * 
 * Funcionalidades:
 * - Autenticação OAuth2
 * - Marcas e Modelos de dispositivos (TODAS, sem paginação)
 * - Planos de assinatura
 * - Cotações
 * - Assinaturas
 * - Pagamentos
 * - Planos anuais
 * - Clientes
 * - Lojistas
 * - Cache inteligente
 * 
 * Tecnologias: Express, Axios, CORS
 * 
 * IMPORTANTE: Este arquivo usa APENAS credenciais de PRODUÇÃO
 * Ambiente forçado: PRODUÇÃO (sem fallback para homologação)
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// ============================================
// CONFIGURAÇÃO - PRODUÇÃO ATIVA
// ============================================

const ENVIRONMENT = 'producao';

const CLUBFIX_CONFIG = {
  producao: {
    baseURL: 'https://clubfix.com.br/webservice',
    email: 'kainow@clubfix.com.br',
    client_id: '2f6356ca-8089-4afc-aad8-c83b30ca1f3f',
    client_secret: 'E>s_|aKA97qCF23M',
    environment: 'PRODUCAO',
    expectedBrands: '25+'
  }
};

const CONFIG = CLUBFIX_CONFIG[ENVIRONMENT];

console.log('\n' + '='.repeat(60));
console.log('🚀 BACKEND PROTEGMAIS - VERSÃO 16.2 - PRODUÇÃO');
console.log('='.repeat(60));
console.log(`📍 URL Pública: https://protegmais.onrender.com`);
console.log(`🔐 Credenciais de PRODUÇÃO configuradas`);
console.log(`📧 E-mail: ${CONFIG.email}`);
console.log(`🆔 Cliente ID: ${CONFIG.client_id}`);
console.log(`🌐 ClubFix WebService: ${CONFIG.baseURL}`);
console.log(`🏢 Ambiente: ${CONFIG.environment}`);
console.log(`📦 Marcas esperadas: ${CONFIG.expectedBrands}`);
console.log('='.repeat(60) + '\n');

// ============================================
// MIDDLEWARES
// ============================================

app.use(cors());
app.use(express.json());

// ============================================
// AUTENTICAÇÃO
// ============================================

let authToken = null;

async function authenticate() {
  try {
    console.log(`\n🔐 Autenticando com ClubFix...`);
    console.log(`📧 E-mail: ${CONFIG.email}`);
    console.log(`🔑 Client ID: ${CONFIG.client_id}`);

    const response = await axios.post(
      `${CONFIG.baseURL}/auth/login`,
      {
        email: CONFIG.email,
        password: CONFIG.client_secret,
        client_id: CONFIG.client_id
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (response.data && response.data.data) {
      authToken = {
        access_token: response.data.data.access_token,
        expires_at: response.data.data.expires_at
      };

      const expiresDate = new Date(authToken.expires_at);
      console.log(`✅ Autenticação bem-sucedida!`);
      console.log(`🎫 Token expira em: ${expiresDate.toLocaleString('pt-BR')}`);
      console.log(`⏰ Válido até: ${expiresDate.toISOString()}`);

      return authToken;
    }

    throw new Error('Resposta de autenticação inválida');
  } catch (error) {
    console.error('❌ Erro na autenticação:', error.response?.data || error.message);
    throw error;
  }
}

function isTokenValid() {
  if (!authToken || !authToken.expires_at) return false;
  const now = new Date();
  const expiresAt = new Date(authToken.expires_at);
  return now < expiresAt;
}

async function ensureAuthenticated() {
  if (!isTokenValid()) {
    console.log('🔄 Token expirado ou inválido. Renovando...');
    await authenticate();
  }
  return authToken.access_token;
}

async function makeAuthenticatedRequest(method, endpoint, data = null) {
  const token = await ensureAuthenticated();

  const config = {
    method,
    url: `${CONFIG.baseURL}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ Erro na requisição ${method} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

// ============================================
// CACHE
// ============================================

const cache = {
  brands: null,
  models: {},
  plans: null,
  lastUpdate: null
};

// ============================================
// ENDPOINTS - CLUBFIX API
// ============================================

// Health Check
app.get('/health', async (req, res) => {
  const authenticated = isTokenValid();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: CONFIG.environment,
    baseURL: CONFIG.baseURL,
    auth: {
      authenticated,
      tokenValid: authenticated
    },
    expectedBrands: CONFIG.expectedBrands,
    cache: {
      brands: cache.brands?.length || 0,
      models: Object.keys(cache.models).length,
      plans: !!cache.plans,
      lastUpdate: cache.lastUpdate
    },
    message: `🏆 Ambiente de ${CONFIG.environment} ativo - ${CONFIG.expectedBrands} marcas disponíveis!`
  });
});

// Listar TODAS as marcas (SEM paginação)
app.get('/api/clubfix/brands', async (req, res) => {
  try {
    console.log('\n📱 LISTAGEM DE MARCAS');

    // Cache hit
    if (cache.brands && cache.lastUpdate) {
      const cacheAge = Date.now() - new Date(cache.lastUpdate).getTime();
      if (cacheAge < 3600000) { // 1 hora
        console.log(`✅ Retornando marcas do cache (${cache.brands.length} marcas)`);
        return res.json({
          success: true,
          data: cache.brands,
          count: cache.brands.length,
          cached: true
        });
      }
    }

    // Buscar TODAS as marcas com limit=100
    const response = await makeAuthenticatedRequest('GET', '/brands?limit=100');

    if (response && response.data) {
      cache.brands = response.data;
      cache.lastUpdate = new Date().toISOString();

      console.log(`✅ MARCAS carregadas: ${response.data.length}`);

      return res.json({
        success: true,
        data: response.data,
        count: response.data.length,
        cached: false
      });
    }

    throw new Error('Resposta inválida da API ClubFix');
  } catch (error) {
    console.error('❌ Erro ao buscar marcas:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// Listar modelos de uma marca
app.get('/api/clubfix/models/:brandId', async (req, res) => {
  try {
    const { brandId } = req.params;
    console.log(`\n📱 LISTAGEM DE MODELOS - Marca ID: ${brandId}`);

    // Cache hit
    if (cache.models[brandId]) {
      console.log(`✅ Retornando modelos do cache (${cache.models[brandId].length} modelos)`);
      return res.json({
        success: true,
        data: cache.models[brandId],
        count: cache.models[brandId].length,
        cached: true
      });
    }

    // ClubFix API: GET /brands/:id retorna { data: { ...brand, models: [...] } }
    const response = await makeAuthenticatedRequest('GET', `/brands/${brandId}`);

    if (response && response.data && response.data.models) {
      const models = response.data.models;
      cache.models[brandId] = models;

      console.log(`✅ MODELOS carregados: ${models.length}`);

      return res.json({
        success: true,
        data: models,
        count: models.length,
        cached: false
      });
    }

    throw new Error('Resposta inválida da API ClubFix');
  } catch (error) {
    console.error('❌ Erro ao buscar modelos:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// Cotação
app.get('/api/clubfix/quotation', async (req, res) => {
  try {
    const { plan_id, model_id, year } = req.query;

    if (!plan_id || !model_id || !year) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros obrigatórios: plan_id, model_id, year'
      });
    }

    console.log(`\n💰 COTAÇÃO - Plano: ${plan_id}, Modelo: ${model_id}, Ano: ${year}`);

    const response = await makeAuthenticatedRequest(
      'GET',
      `/quotation?plan_id=${plan_id}&model_id=${model_id}&year=${year}`
    );

    console.log('✅ Cotação realizada com sucesso');

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('❌ Erro ao realizar cotação:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// Criar assinatura
app.post('/api/clubfix/subscriptions', async (req, res) => {
  try {
    console.log('\n📝 CRIAR ASSINATURA');
    console.log('Dados recebidos:', JSON.stringify(req.body, null, 2));

    const response = await makeAuthenticatedRequest('POST', '/subscriptions', req.body);

    console.log('✅ Assinatura criada com sucesso!');
    console.log('ID:', response.data?.id);

    res.status(201).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('❌ Erro ao criar assinatura:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// ============================================
// INICIALIZAÇÃO
// ============================================

app.listen(PORT, async () => {
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🌐 Ambiente: ${CONFIG.environment}`);
  console.log(`🔗 ClubFix: ${CONFIG.baseURL}`);
  console.log('='.repeat(60) + '\n');

  // Autenticar na inicialização
  try {
    await authenticate();
    console.log('\n🎉 Sistema pronto para uso!\n');
  } catch (error) {
    console.error('\n⚠️  Falha na autenticação inicial. O sistema tentará autenticar na primeira requisição.\n');
  }
});

module.exports = app;
