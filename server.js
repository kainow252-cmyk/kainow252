/**
 * ProtegMais - Backend API Oficial ClubFix
 * Versão: 16.4 - MULTI-AUTH (Testa múltiplos formatos)
 * 
 * CHANGELOG v16.4:
 * - Implementa múltiplos formatos de autenticação
 * - Formato 1: email + password + client_id
 * - Formato 2: email + password + client_id + client_secret
 * - Formato 3: OAuth2 grant_type=password
 * - Fallback automático se um formato falhar
 * 
 * Credenciais Oficiais Confirmadas:
 * E-mail: kainow@clubfix.com.br
 * Senha: Kainow@27923746
 * Client ID: 2f6356ca-8089-4afc-aad8-c83b30ca1f3f
 * Client Secret: CLUBFIX6986445f624d31770407007
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// ============================================
// CONFIGURAÇÃO - PRODUÇÃO ATIVA
// ============================================

const CONFIG = {
  baseURL: 'https://clubfix.com.br/webservice',
  email: 'kainow@clubfix.com.br',
  password: 'Kainow@27923746',
  client_id: '2f6356ca-8089-4afc-aad8-c83b30ca1f3f',
  client_secret: 'CLUBFIX6986445f624d31770407007',
  environment: 'PRODUCAO',
  expectedBrands: '25+'
};

console.log('\n' + '='.repeat(60));
console.log('🚀 BACKEND PROTEGMAIS - VERSÃO 16.4 - MULTI-AUTH');
console.log('='.repeat(60));
console.log(`📍 URL Pública: https://protegmais.onrender.com`);
console.log(`🔐 Credenciais OFICIAIS configuradas`);
console.log(`📧 E-mail: ${CONFIG.email}`);
console.log(`🆔 Cliente ID: ${CONFIG.client_id}`);
console.log(`🌐 ClubFix WebService: ${CONFIG.baseURL}`);
console.log(`🏢 Ambiente: ${CONFIG.environment}`);
console.log(`📦 Marcas esperadas: ${CONFIG.expectedBrands}`);
console.log(`🧪 Modo: MULTI-AUTH (testa vários formatos)`);
console.log('='.repeat(60) + '\n');

// ============================================
// MIDDLEWARES
// ============================================

app.use(cors());
app.use(express.json());

// ============================================
// AUTENTICAÇÃO MULTI-FORMATO
// ============================================

let authToken = null;

async function authenticateFormat1() {
  console.log(`\n🧪 [FORMATO 1] Testando: email + password + client_id`);
  
  const payload = {
    email: CONFIG.email,
    password: CONFIG.password,
    client_id: CONFIG.client_id
  };

  console.log(`📤 Payload: ${JSON.stringify(payload, null, 2)}`);

  try {
    const response = await axios.post(
      `${CONFIG.baseURL}/auth/login`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (response.data && response.data.data && response.data.data.access_token) {
      console.log(`✅ [FORMATO 1] Sucesso!`);
      return response.data.data;
    }
    
    throw new Error('Resposta inválida');
  } catch (error) {
    console.log(`❌ [FORMATO 1] Falhou: ${error.response?.data?.mensagem || error.message}`);
    return null;
  }
}

async function authenticateFormat2() {
  console.log(`\n🧪 [FORMATO 2] Testando: email + password + client_id + client_secret`);
  
  const payload = {
    email: CONFIG.email,
    password: CONFIG.password,
    client_id: CONFIG.client_id,
    client_secret: CONFIG.client_secret
  };

  console.log(`📤 Payload: ${JSON.stringify({...payload, client_secret: '***'}, null, 2)}`);

  try {
    const response = await axios.post(
      `${CONFIG.baseURL}/auth/login`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (response.data && response.data.data && response.data.data.access_token) {
      console.log(`✅ [FORMATO 2] Sucesso!`);
      return response.data.data;
    }
    
    throw new Error('Resposta inválida');
  } catch (error) {
    console.log(`❌ [FORMATO 2] Falhou: ${error.response?.data?.mensagem || error.message}`);
    return null;
  }
}

async function authenticateFormat3() {
  console.log(`\n🧪 [FORMATO 3] Testando: OAuth2 grant_type=password`);
  
  const payload = {
    grant_type: 'password',
    username: CONFIG.email,
    password: CONFIG.password,
    client_id: CONFIG.client_id,
    client_secret: CONFIG.client_secret
  };

  console.log(`📤 Payload: ${JSON.stringify({...payload, password: '***', client_secret: '***'}, null, 2)}`);

  try {
    const response = await axios.post(
      `${CONFIG.baseURL}/auth/login`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (response.data && response.data.access_token) {
      console.log(`✅ [FORMATO 3] Sucesso!`);
      return {
        access_token: response.data.access_token,
        expires_at: response.data.expires_at || new Date(Date.now() + 3600000).toISOString()
      };
    }
    
    throw new Error('Resposta inválida');
  } catch (error) {
    console.log(`❌ [FORMATO 3] Falhou: ${error.response?.data?.mensagem || error.message}`);
    return null;
  }
}

async function authenticateFormat4() {
  console.log(`\n🧪 [FORMATO 4] Testando: Basic Auth + Body`);
  
  const basicAuth = Buffer.from(`${CONFIG.client_id}:${CONFIG.client_secret}`).toString('base64');
  
  const payload = {
    email: CONFIG.email,
    password: CONFIG.password
  };

  console.log(`📤 Headers: Authorization: Basic ${basicAuth.substring(0, 20)}...`);
  console.log(`📤 Payload: ${JSON.stringify({...payload, password: '***'}, null, 2)}`);

  try {
    const response = await axios.post(
      `${CONFIG.baseURL}/auth/login`,
      payload,
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Basic ${basicAuth}`
        } 
      }
    );

    if (response.data && response.data.data && response.data.data.access_token) {
      console.log(`✅ [FORMATO 4] Sucesso!`);
      return response.data.data;
    }
    
    throw new Error('Resposta inválida');
  } catch (error) {
    console.log(`❌ [FORMATO 4] Falhou: ${error.response?.data?.mensagem || error.message}`);
    return null;
  }
}

async function authenticate() {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔐 INICIANDO AUTENTICAÇÃO MULTI-FORMATO`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📧 E-mail: ${CONFIG.email}`);
    console.log(`🔑 Client ID: ${CONFIG.client_id}`);
    console.log(`🕐 Timestamp: ${new Date().toISOString()}`);

    // Testar formato 1
    let result = await authenticateFormat1();
    if (result) {
      authToken = result;
      console.log(`\n✅ AUTENTICAÇÃO BEM-SUCEDIDA COM FORMATO 1!`);
      logTokenInfo();
      return authToken;
    }

    // Testar formato 2
    result = await authenticateFormat2();
    if (result) {
      authToken = result;
      console.log(`\n✅ AUTENTICAÇÃO BEM-SUCEDIDA COM FORMATO 2!`);
      logTokenInfo();
      return authToken;
    }

    // Testar formato 3
    result = await authenticateFormat3();
    if (result) {
      authToken = result;
      console.log(`\n✅ AUTENTICAÇÃO BEM-SUCEDIDA COM FORMATO 3!`);
      logTokenInfo();
      return authToken;
    }

    // Testar formato 4
    result = await authenticateFormat4();
    if (result) {
      authToken = result;
      console.log(`\n✅ AUTENTICAÇÃO BEM-SUCEDIDA COM FORMATO 4!`);
      logTokenInfo();
      return authToken;
    }

    // Nenhum formato funcionou
    throw new Error('Todos os formatos de autenticação falharam');

  } catch (error) {
    console.error(`\n${'='.repeat(60)}`);
    console.error('❌ ERRO CRÍTICO: AUTENTICAÇÃO FALHOU EM TODOS OS FORMATOS');
    console.error(`${'='.repeat(60)}`);
    console.error(`🚨 Erro: ${error.message}`);
    console.error(`\n⚠️ AÇÕES NECESSÁRIAS:`);
    console.error(`1. Verificar se as credenciais estão corretas`);
    console.error(`2. Verificar se a conta está ativa no painel ClubFix`);
    console.error(`3. Entrar em contato com suporte ClubFix`);
    console.error(`4. Verificar documentação da API para formato correto`);
    console.error(`${'='.repeat(60)}\n`);
    throw error;
  }
}

function logTokenInfo() {
  const expiresDate = new Date(authToken.expires_at);
  console.log(`🎫 Token: ${authToken.access_token.substring(0, 50)}...`);
  console.log(`⏰ Expira em: ${expiresDate.toLocaleString('pt-BR')}`);
  console.log(`📅 ISO: ${authToken.expires_at}`);
  console.log(`${'='.repeat(60)}\n`);
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
    version: '16.4-multi-auth',
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

// Listar TODAS as marcas
app.get('/api/clubfix/brands', async (req, res) => {
  try {
    console.log('\n📱 LISTAGEM DE MARCAS');

    if (cache.brands && cache.lastUpdate) {
      const cacheAge = Date.now() - new Date(cache.lastUpdate).getTime();
      if (cacheAge < 3600000) {
        console.log(`✅ Retornando marcas do cache (${cache.brands.length} marcas)`);
        return res.json({
          success: true,
          data: cache.brands,
          count: cache.brands.length,
          cached: true
        });
      }
    }

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

    if (cache.models[brandId]) {
      console.log(`✅ Retornando modelos do cache (${cache.models[brandId].length} modelos)`);
      return res.json({
        success: true,
        data: cache.models[brandId],
        count: cache.models[brandId].length,
        cached: true
      });
    }

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

  try {
    await authenticate();
    console.log('\n🎉 Sistema pronto para uso!\n');
  } catch (error) {
    console.error('\n⚠️ Falha na autenticação inicial. O sistema tentará autenticar na primeira requisição.\n');
  }
});

module.exports = app;
