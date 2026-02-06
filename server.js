/**
 * ProtegMais - Backend API Oficial ClubFix
 * Versão: 18.0 - FORMATO CORRETO (Resposta do TI)
 * 
 * CHANGELOG v18.0:
 * - Implementa formato correto fornecido pelo TI ClubFix
 * - Header x-credentials: base64(email:senha)
 * - Body apenas com client_id e client_secret
 * - Ambiente de homologação funcionando
 * 
 * Formato correto descoberto pelo TI ClubFix:
 * Headers: x-credentials: base64("email:senha")
 * Body: { client_id, client_secret }
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// ============================================
// CONFIGURAÇÃO - FORMATO CORRETO DO TI
// ============================================

const CONFIG = {
  // Homologação (fornecido pelo TI)
  homolog: {
    baseURL: 'https://homolog.clubfix.com.br/webservice',
    email: 'kainow@clubfix.com.br',
    password: 'Kainow@27923746',
    client_id: '96639fd2-7598-46a7-89e8-05b84c7f3b6b',
    client_secret: 'CLUBFIX698497c880cb41770297288',
    environment: 'HOMOLOGACAO',
    expectedBrands: '6'
  },
  // Produção (ainda precisa confirmar)
  producao: {
    baseURL: 'https://clubfix.com.br/webservice',
    email: 'kainow@clubfix.com.br',
    password: 'Kainow@27923746',
    client_id: '2f6356ca-8089-4afc-aad8-c83b30ca1f3f',
    client_secret: 'CLUBFIX6986445f624d31770407007',
    environment: 'PRODUCAO',
    expectedBrands: '25+'
  }
};

// Usar homologação por padrão (depois mudamos para produção)
const ACTIVE_CONFIG = CONFIG.homolog;

console.log('\n' + '='.repeat(60));
console.log('🚀 BACKEND PROTEGMAIS - VERSÃO 18.0 - FORMATO CORRETO');
console.log('='.repeat(60));
console.log(`📍 URL Pública: https://protegmais.onrender.com`);
console.log(`🔐 Formato CORRETO fornecido pelo TI ClubFix`);
console.log(`📧 E-mail: ${ACTIVE_CONFIG.email}`);
console.log(`🆔 Cliente ID: ${ACTIVE_CONFIG.client_id}`);
console.log(`🌐 ClubFix WebService: ${ACTIVE_CONFIG.baseURL}`);
console.log(`🏢 Ambiente: ${ACTIVE_CONFIG.environment}`);
console.log(`📦 Marcas esperadas: ${ACTIVE_CONFIG.expectedBrands}`);
console.log(`🔑 Header: x-credentials com Base64`);
console.log('='.repeat(60) + '\n');

// ============================================
// MIDDLEWARES
// ============================================

app.use(cors());
app.use(express.json());

// ============================================
// AUTENTICAÇÃO - FORMATO CORRETO
// ============================================

let authToken = null;

async function authenticate() {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔐 AUTENTICAÇÃO - FORMATO CORRETO DO TI`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📧 E-mail: ${ACTIVE_CONFIG.email}`);
    console.log(`🔑 Client ID: ${ACTIVE_CONFIG.client_id}`);
    console.log(`🕐 Timestamp: ${new Date().toISOString()}\n`);

    // Gerar x-credentials: base64(email:senha)
    const credentials = Buffer.from(
      `${ACTIVE_CONFIG.email}:${ACTIVE_CONFIG.password}`
    ).toString('base64');

    console.log(`🔐 x-credentials gerado: ${credentials.substring(0, 30)}...\n`);

    // Payload: apenas client_id e client_secret
    const payload = {
      client_id: ACTIVE_CONFIG.client_id,
      client_secret: ACTIVE_CONFIG.client_secret
    };

    console.log(`📤 Payload:\n${JSON.stringify(payload, null, 2)}\n`);

    // Fazer requisição
    const response = await axios.post(
      `${ACTIVE_CONFIG.baseURL}/auth/login`,
      payload,
      {
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'x-credentials': credentials
        },
        timeout: 10000
      }
    );

    // Extrair token
    const token = response.data?.access_token || response.data?.data?.access_token;
    const expires = response.data?.expires_at || response.data?.data?.expires_at;

    if (!token) {
      throw new Error('Resposta sem access_token');
    }

    authToken = {
      access_token: token,
      expires_at: expires || new Date(Date.now() + 3600000).toISOString()
    };

    console.log(`${'='.repeat(60)}`);
    console.log(`✅✅✅ AUTENTICAÇÃO BEM-SUCEDIDA! ✅✅✅`);
    console.log(`${'='.repeat(60)}`);
    console.log(`🎫 Token: ${authToken.access_token.substring(0, 50)}...`);
    console.log(`⏰ Expira em: ${new Date(authToken.expires_at).toLocaleString('pt-BR')}`);
    console.log(`📅 ISO: ${authToken.expires_at}`);
    console.log(`${'='.repeat(60)}\n`);

    return authToken;

  } catch (error) {
    console.error(`\n${'='.repeat(60)}`);
    console.error('❌ ERRO NA AUTENTICAÇÃO');
    console.error(`${'='.repeat(60)}`);
    console.error(`🚨 Status: ${error.response?.status}`);
    console.error(`📦 Resposta: ${JSON.stringify(error.response?.data)}`);
    console.error(`💬 Mensagem: ${error.message}`);
    console.error(`${'='.repeat(60)}\n`);
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
    url: `${ACTIVE_CONFIG.baseURL}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    timeout: 10000
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
    version: '18.0-formato-correto',
    timestamp: new Date().toISOString(),
    environment: ACTIVE_CONFIG.environment,
    baseURL: ACTIVE_CONFIG.baseURL,
    auth: {
      authenticated,
      tokenValid: authenticated
    },
    expectedBrands: ACTIVE_CONFIG.expectedBrands,
    cache: {
      brands: cache.brands?.length || 0,
      models: Object.keys(cache.models).length,
      plans: !!cache.plans,
      lastUpdate: cache.lastUpdate
    },
    message: `🏆 Ambiente de ${ACTIVE_CONFIG.environment} - ${ACTIVE_CONFIG.expectedBrands} marcas disponíveis!`
  });
});

// Listar TODAS as marcas
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

    // Buscar marcas
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

    // Buscar modelos
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
  console.log(`🌐 Ambiente: ${ACTIVE_CONFIG.environment}`);
  console.log(`🔗 ClubFix: ${ACTIVE_CONFIG.baseURL}`);
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
