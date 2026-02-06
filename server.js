/**
 * ProtegMais - Backend API Oficial ClubFix
 * Versão: 17.0 - TOKEN DE INTEGRAÇÃO DIRETO
 * 
 * CHANGELOG v17.0:
 * - Usa token de integração fornecido pelo TI ClubFix
 * - Sem necessidade de autenticação OAuth2
 * - Token fixo no header Authorization
 * 
 * Token de Integração fornecido pelo TI ClubFix:
 * $2y$10$pt5q/GMnEBvAVBVYgrYk1.Wo8w5Y1tk2kqtPWRv.QJIRz24aNdlca
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// ============================================
// CONFIGURAÇÃO - PRODUÇÃO COM TOKEN DIRETO
// ============================================

const CONFIG = {
  baseURL: 'https://clubfix.com.br/webservice',
  integrationToken: '$2y$10$pt5q/GMnEBvAVBVYgrYk1.Wo8w5Y1tk2kqtPWRv.QJIRz24aNdlca',
  email: 'kainow@clubfix.com.br',
  client_id: '2f6356ca-8089-4afc-aad8-c83b30ca1f3f',
  environment: 'PRODUCAO',
  expectedBrands: '25+'
};

console.log('\n' + '='.repeat(60));
console.log('🚀 BACKEND PROTEGMAIS - VERSÃO 17.0 - TOKEN DIRETO');
console.log('='.repeat(60));
console.log(`📍 URL Pública: https://protegmais.onrender.com`);
console.log(`🔐 Usando TOKEN DE INTEGRAÇÃO do TI ClubFix`);
console.log(`📧 E-mail: ${CONFIG.email}`);
console.log(`🆔 Cliente ID: ${CONFIG.client_id}`);
console.log(`🌐 ClubFix WebService: ${CONFIG.baseURL}`);
console.log(`🏢 Ambiente: ${CONFIG.environment}`);
console.log(`📦 Marcas esperadas: ${CONFIG.expectedBrands}`);
console.log(`🔑 Token: ${CONFIG.integrationToken.substring(0, 20)}...`);
console.log('='.repeat(60) + '\n');

// ============================================
// MIDDLEWARES
// ============================================

app.use(cors());
app.use(express.json());

// ============================================
// REQUISIÇÕES COM TOKEN DIRETO
// ============================================

async function makeRequest(method, endpoint, data = null) {
  const config = {
    method,
    url: `${CONFIG.baseURL}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${CONFIG.integrationToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    timeout: 10000
  };

  if (data) {
    config.data = data;
  }

  try {
    console.log(`📡 Requisição: ${method} ${endpoint}`);
    const response = await axios(config);
    console.log(`✅ Sucesso: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Erro: ${method} ${endpoint}`);
    console.error(`   Status: ${error.response?.status}`);
    console.error(`   Mensagem: ${error.response?.data?.mensagem || error.message}`);
    throw error;
  }
}

// Testar conexão
async function testConnection() {
  console.log('\n🧪 TESTANDO CONEXÃO COM CLUBFIX...\n');
  
  // Teste 1: Endpoint /brands
  try {
    console.log('📝 Teste 1: GET /brands?limit=100');
    const response = await makeRequest('GET', '/brands?limit=100');
    
    if (response && response.data) {
      console.log(`✅ SUCESSO! ${response.data.length} marcas encontradas`);
      return true;
    }
  } catch (error) {
    console.log('❌ Teste 1 falhou');
  }

  // Teste 2: Endpoint alternativo /api/brands
  try {
    console.log('\n📝 Teste 2: GET /api/brands?limit=100');
    const response = await makeRequest('GET', '/api/brands?limit=100');
    
    if (response && response.data) {
      console.log(`✅ SUCESSO! ${response.data.length} marcas encontradas`);
      return true;
    }
  } catch (error) {
    console.log('❌ Teste 2 falhou');
  }

  // Teste 3: Com header X-API-Key
  try {
    console.log('\n📝 Teste 3: GET /brands com X-API-Key');
    const response = await axios.get(`${CONFIG.baseURL}/brands?limit=100`, {
      headers: {
        'X-API-Key': CONFIG.integrationToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (response && response.data) {
      console.log(`✅ SUCESSO! ${response.data.data?.length || 0} marcas encontradas`);
      return true;
    }
  } catch (error) {
    console.log('❌ Teste 3 falhou');
  }

  // Teste 4: Com header Authorization (sem Bearer)
  try {
    console.log('\n📝 Teste 4: GET /brands com Authorization (sem Bearer)');
    const response = await axios.get(`${CONFIG.baseURL}/brands?limit=100`, {
      headers: {
        'Authorization': CONFIG.integrationToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (response && response.data) {
      console.log(`✅ SUCESSO! ${response.data.data?.length || 0} marcas encontradas`);
      return true;
    }
  } catch (error) {
    console.log('❌ Teste 4 falhou');
  }

  console.log('\n❌ TODOS OS TESTES FALHARAM');
  console.log('⚠️  Entre em contato com TI ClubFix para confirmar:');
  console.log('   1. Token está correto e ativo?');
  console.log('   2. Qual o formato correto do header?');
  console.log('   3. Qual o endpoint correto?');
  
  return false;
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
  res.json({
    status: 'ok',
    version: '17.0-token-direto',
    timestamp: new Date().toISOString(),
    environment: CONFIG.environment,
    baseURL: CONFIG.baseURL,
    tokenConfigured: !!CONFIG.integrationToken,
    expectedBrands: CONFIG.expectedBrands,
    cache: {
      brands: cache.brands?.length || 0,
      models: Object.keys(cache.models).length,
      plans: !!cache.plans,
      lastUpdate: cache.lastUpdate
    },
    message: `🏆 Token de integração configurado - ${CONFIG.expectedBrands} marcas disponíveis!`
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
    const response = await makeRequest('GET', '/brands?limit=100');

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
    const response = await makeRequest('GET', `/brands/${brandId}`);

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

    const response = await makeRequest(
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

    const response = await makeRequest('POST', '/subscriptions', req.body);

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

  // Testar conexão
  try {
    const success = await testConnection();
    if (success) {
      console.log('\n🎉 Sistema pronto para uso!\n');
    } else {
      console.log('\n⚠️  Sistema rodando mas aguardando confirmação do TI ClubFix.\n');
    }
  } catch (error) {
    console.error('\n⚠️  Erro ao testar conexão. Verifique com TI ClubFix.\n');
  }
});

module.exports = app;
