/**
 * ProtegMais - Backend API Oficial ClubFix
 * Versão: 17.1 - AUTENTICAÇÃO AGRESSIVA
 * 
 * CHANGELOG v17.1:
 * - Testa TODOS os endpoints possíveis de autenticação
 * - Testa múltiplas URLs base
 * - Testa com e sem HTTPS
 * - Credenciais confirmadas que funcionaram antes
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// ============================================
// CONFIGURAÇÃO - CREDENCIAIS QUE FUNCIONARAM
// ============================================

const CONFIG = {
  email: 'kainow@clubfix.com.br',
  password: 'Kainow@27923746',
  client_id: '2f6356ca-8089-4afc-aad8-c83b30ca1f3f',
  client_secret: 'CLUBFIX6986445f624d31770407007',
  environment: 'PRODUCAO',
  expectedBrands: '25+'
};

console.log('\n' + '='.repeat(60));
console.log('🚀 BACKEND PROTEGMAIS - VERSÃO 17.1 - AUTH AGRESSIVO');
console.log('='.repeat(60));
console.log(`📍 URL Pública: https://protegmais.onrender.com`);
console.log(`🔐 Credenciais que FUNCIONARAM ANTES`);
console.log(`📧 E-mail: ${CONFIG.email}`);
console.log(`🆔 Cliente ID: ${CONFIG.client_id}`);
console.log(`🏢 Ambiente: ${CONFIG.environment}`);
console.log(`🧪 Modo: TESTA TODOS OS ENDPOINTS`);
console.log('='.repeat(60) + '\n');

// ============================================
// MIDDLEWARES
// ============================================

app.use(cors());
app.use(express.json());

// ============================================
// AUTENTICAÇÃO AGRESSIVA
// ============================================

let authToken = null;
let workingEndpoint = null;

// Lista completa de URLs e endpoints para testar
const AUTH_CONFIGS = [
  // Produção
  { base: 'https://clubfix.com.br/webservice', endpoint: '/auth/login' },
  { base: 'https://clubfix.com.br/webservice', endpoint: '/login' },
  { base: 'https://clubfix.com.br/webservice', endpoint: '/oauth/token' },
  { base: 'https://clubfix.com.br/webservice', endpoint: '/api/auth/login' },
  { base: 'https://clubfix.com.br/webservice', endpoint: '/v1/auth/login' },
  { base: 'https://clubfix.com.br/webservice', endpoint: '/auth/token' },
  
  // API alternativa
  { base: 'https://api.clubfix.com.br', endpoint: '/auth/login' },
  { base: 'https://api.clubfix.com.br', endpoint: '/login' },
  { base: 'https://api.clubfix.com.br', endpoint: '/oauth/token' },
  { base: 'https://api.clubfix.com.br', endpoint: '/v1/auth/login' },
  
  // Webservice sem path
  { base: 'https://clubfix.com.br', endpoint: '/webservice/auth/login' },
  { base: 'https://clubfix.com.br', endpoint: '/api/auth/login' },
  { base: 'https://clubfix.com.br', endpoint: '/auth/login' },
  
  // WWW
  { base: 'https://www.clubfix.com.br/webservice', endpoint: '/auth/login' },
  { base: 'https://www.clubfix.com.br', endpoint: '/webservice/auth/login' },
  
  // Homologação (fallback)
  { base: 'https://homolog.clubfix.com.br/webservice', endpoint: '/auth/login' },
];

// Payloads diferentes para testar
const PAYLOADS = [
  // Formato 1: Básico
  (config) => ({
    email: config.email,
    password: config.password,
    client_id: config.client_id
  }),
  
  // Formato 2: Com client_secret
  (config) => ({
    email: config.email,
    password: config.password,
    client_id: config.client_id,
    client_secret: config.client_secret
  }),
  
  // Formato 3: OAuth2 password grant
  (config) => ({
    grant_type: 'password',
    username: config.email,
    password: config.password,
    client_id: config.client_id,
    client_secret: config.client_secret
  }),
  
  // Formato 4: OAuth2 client_credentials
  (config) => ({
    grant_type: 'client_credentials',
    client_id: config.client_id,
    client_secret: config.client_secret,
    scope: 'api'
  }),
  
  // Formato 5: Apenas credenciais
  (config) => ({
    username: config.email,
    password: config.password
  }),
];

async function testAuth(baseURL, endpoint, payloadFn, payloadName) {
  const fullURL = `${baseURL}${endpoint}`;
  const payload = payloadFn(CONFIG);
  
  try {
    const response = await axios.post(fullURL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });

    // Verificar se tem token na resposta
    const token = response.data?.access_token || response.data?.data?.access_token;
    const expires = response.data?.expires_at || response.data?.data?.expires_at;
    
    if (token) {
      return {
        success: true,
        token,
        expires,
        config: { baseURL, endpoint, payloadName }
      };
    }
    
    return { success: false, error: 'Resposta sem token' };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status,
      error: error.response?.data?.mensagem || error.message
    };
  }
}

async function authenticate() {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔐 INICIANDO AUTENTICAÇÃO AGRESSIVA`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📧 E-mail: ${CONFIG.email}`);
    console.log(`🔑 Client ID: ${CONFIG.client_id}`);
    console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
    console.log(`🧪 Total de testes: ${AUTH_CONFIGS.length * PAYLOADS.length}\n`);

    let testNumber = 0;
    const totalTests = AUTH_CONFIGS.length * PAYLOADS.length;

    for (const authConfig of AUTH_CONFIGS) {
      for (let i = 0; i < PAYLOADS.length; i++) {
        testNumber++;
        const payloadName = `Formato ${i + 1}`;
        
        console.log(`[${testNumber}/${totalTests}] ${authConfig.base}${authConfig.endpoint} - ${payloadName}`);

        const result = await testAuth(
          authConfig.base,
          authConfig.endpoint,
          PAYLOADS[i],
          payloadName
        );

        if (result.success) {
          authToken = {
            access_token: result.token,
            expires_at: result.expires || new Date(Date.now() + 3600000).toISOString()
          };
          workingEndpoint = result.config;

          console.log(`\n${'='.repeat(60)}`);
          console.log(`✅✅✅ SUCESSO! AUTENTICAÇÃO FUNCIONOU! ✅✅✅`);
          console.log(`${'='.repeat(60)}`);
          console.log(`🎯 URL Base: ${workingEndpoint.baseURL}`);
          console.log(`🎯 Endpoint: ${workingEndpoint.endpoint}`);
          console.log(`🎯 Payload: ${workingEndpoint.payloadName}`);
          console.log(`🎫 Token: ${authToken.access_token.substring(0, 50)}...`);
          console.log(`⏰ Expira em: ${new Date(authToken.expires_at).toLocaleString('pt-BR')}`);
          console.log(`${'='.repeat(60)}\n`);

          return authToken;
        }
        
        // Log apenas erros importantes
        if (result.status === 401) {
          console.log(`   ❌ 401 - Não autorizado`);
        } else if (result.status === 404) {
          console.log(`   ⚠️  404 - Endpoint não existe`);
        } else if (result.status === 500) {
          console.log(`   🚨 500 - Erro no servidor`);
        }
      }
    }

    // Nenhuma combinação funcionou
    throw new Error(`Todos os ${totalTests} testes falharam`);

  } catch (error) {
    console.error(`\n${'='.repeat(60)}`);
    console.error('❌ ERRO CRÍTICO: NENHUMA COMBINAÇÃO FUNCIONOU');
    console.error(`${'='.repeat(60)}`);
    console.error(`🚨 ${error.message}`);
    console.error(`\n⚠️ POSSÍVEIS CAUSAS:`);
    console.error(`1. ❌ API ClubFix está temporariamente fora do ar`);
    console.error(`2. ❌ Credenciais foram desativadas/alteradas`);
    console.error(`3. ❌ IP do Render.com foi bloqueado`);
    console.error(`4. ❌ Endpoint de autenticação mudou completamente`);
    console.error(`\n💡 AÇÕES:`);
    console.error(`1. Entre em contato com TI ClubFix URGENTE`);
    console.error(`2. Peça para verificar se credenciais estão ativas`);
    console.error(`3. Solicite documentação atualizada da API`);
    console.error(`4. Peça exemplo de requisição funcionando`);
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
  if (!workingEndpoint) {
    throw new Error('Sistema não autenticado');
  }

  const token = await ensureAuthenticated();

  const config = {
    method,
    url: `${workingEndpoint.baseURL}${endpoint}`,
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
    version: '17.1-auth-agressivo',
    timestamp: new Date().toISOString(),
    environment: CONFIG.environment,
    auth: {
      authenticated,
      tokenValid: authenticated,
      workingEndpoint: workingEndpoint || 'Não descoberto ainda'
    },
    expectedBrands: CONFIG.expectedBrands,
    cache: {
      brands: cache.brands?.length || 0,
      models: Object.keys(cache.models).length,
      plans: !!cache.plans,
      lastUpdate: cache.lastUpdate
    },
    message: workingEndpoint 
      ? `✅ Autenticado com ${workingEndpoint.baseURL}${workingEndpoint.endpoint}`
      : '⚠️ Aguardando autenticação'
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
  console.log('='.repeat(60) + '\n');

  try {
    await authenticate();
    console.log('\n🎉 Sistema pronto para uso!\n');
  } catch (error) {
    console.error('\n⚠️ Falha na autenticação. Verifique os logs acima.\n');
  }
});

module.exports = app;
