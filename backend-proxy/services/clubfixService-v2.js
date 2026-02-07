require('dotenv').config();
const axios = require('axios');

class ClubFixService {
  constructor() {
    this.baseURL = process.env.CLUBFIX_BASE_URL || 'https://clubfix.com.br/webservice';
    this.clientId = process.env.CLUBFIX_CLIENT_ID;
    this.clientSecret = process.env.CLUBFIX_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.cache = {
      brands: null,
      models: {},
      quotations: {}
    };
    this.cacheExpiry = 60 * 60 * 1000; // 1 hora
  }

  // ============================================
  // AUTENTICAÇÃO OAuth 2.0
  // ============================================

  async authenticate() {
    try {
      console.log('[AUTH] Autenticando com ClubFix OAuth 2.0...');
      
      const response = await axios.post(`${this.baseURL}/oauth/token`, {
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: '*'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      this.accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiresAt = Date.now() + (expiresIn * 1000);

      console.log('[AUTH] ✅ Autenticado com sucesso!');
      console.log(`[AUTH] Token expira em: ${new Date(this.tokenExpiresAt).toISOString()}`);
      
      return this.accessToken;
    } catch (error) {
      console.error('[AUTH] ❌ Erro na autenticação:', error.response?.data || error.message);
      throw new Error('Falha na autenticação com ClubFix API');
    }
  }

  async ensureAuthenticated() {
    // Verifica se o token existe e ainda é válido
    if (!this.accessToken || !this.tokenExpiresAt || Date.now() >= this.tokenExpiresAt - 60000) {
      await this.authenticate();
    }
    return this.accessToken;
  }

  async makeRequest(method, endpoint, data = null, params = null) {
    await this.ensureAuthenticated();

    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (data) config.data = data;
    if (params) config.params = params;

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`[API ERROR] ${method} ${endpoint}:`, error.response?.data || error.message);
      
      // Se erro 401, tenta renovar token
      if (error.response?.status === 401) {
        console.log('[API] Token expirado, renovando...');
        this.accessToken = null;
        await this.ensureAuthenticated();
        
        // Retry request
        config.headers.Authorization = `Bearer ${this.accessToken}`;
        const retryResponse = await axios(config);
        return retryResponse.data;
      }
      
      throw error;
    }
  }

  // ============================================
  // BRANDS (Marcas)
  // ============================================

  async getBrands() {
    // Verifica cache
    if (this.cache.brands && Date.now() - this.cache.brands.timestamp < this.cacheExpiry) {
      console.log('[CACHE] Usando marcas em cache');
      return this.cache.brands.data;
    }

    console.log('[API] Buscando marcas da ClubFix...');
    const response = await this.makeRequest('GET', '/api/v1/brands');
    
    const brands = response.data.map(brand => ({
      id: brand.id,
      name: brand.name,
      status: brand.status || 'active'
    }));

    // Armazena no cache
    this.cache.brands = {
      data: brands,
      timestamp: Date.now()
    };

    console.log(`[API] ✅ ${brands.length} marcas carregadas`);
    return brands;
  }

  // ============================================
  // MODELS (Modelos)
  // ============================================

  async getModels(brandId) {
    const cacheKey = `brand_${brandId}`;
    
    // Verifica cache
    if (this.cache.models[cacheKey] && Date.now() - this.cache.models[cacheKey].timestamp < this.cacheExpiry) {
      console.log(`[CACHE] Usando modelos da marca ${brandId} em cache`);
      return this.cache.models[cacheKey].data;
    }

    console.log(`[API] Buscando modelos da marca ${brandId}...`);
    const response = await this.makeRequest('GET', `/api/v1/brands/${brandId}/models`);
    
    const models = response.data.map(model => ({
      id: model.id,
      name: model.name,
      brandId: brandId,
      status: model.status || 'active'
    }));

    // Armazena no cache
    this.cache.models[cacheKey] = {
      data: models,
      timestamp: Date.now()
    };

    console.log(`[API] ✅ ${models.length} modelos carregados`);
    return models;
  }

  // ============================================
  // QUOTATION (Cotação/Planos)
  // ============================================

  async getQuotation(modelId, isUsed = false) {
    const cacheKey = `model_${modelId}_used_${isUsed}`;
    
    // Verifica cache
    if (this.cache.quotations[cacheKey] && Date.now() - this.cache.quotations[cacheKey].timestamp < this.cacheExpiry) {
      console.log(`[CACHE] Usando cotação do modelo ${modelId} em cache`);
      return this.cache.quotations[cacheKey].data;
    }

    console.log(`[API] Buscando cotação para modelo ${modelId} (usado: ${isUsed})...`);
    const response = await this.makeRequest('GET', '/api/v1/quotation', null, {
      model_id: modelId,
      is_used: isUsed
    });

    const quotation = {
      model: response.data.model,
      plans: response.data.plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        monthlyPrice: parseFloat(plan.monthly_price),
        annualPrice: parseFloat(plan.annual_price),
        coverage: plan.coverage,
        franchise: plan.franchise,
        lmi: plan.lmi // Limite Máximo de Indenização
      }))
    };

    // Armazena no cache
    this.cache.quotations[cacheKey] = {
      data: quotation,
      timestamp: Date.now()
    };

    console.log(`[API] ✅ ${quotation.plans.length} planos carregados`);
    return quotation;
  }

  // ============================================
  // CUSTOMER (Cliente)
  // ============================================

  async createCustomer(customerData) {
    console.log('[API] Criando cliente...');
    const response = await this.makeRequest('POST', '/api/v1/customers', {
      name: customerData.name,
      email: customerData.email,
      document: customerData.document,
      phone: customerData.phone,
      birthdate: customerData.birthdate
    });

    console.log('[API] ✅ Cliente criado com sucesso');
    return response.data;
  }

  // ============================================
  // SUBSCRIPTION (Assinatura)
  // ============================================

  async createSubscription(subscriptionData) {
    console.log('[API] Criando assinatura...');
    const response = await this.makeRequest('POST', '/api/v1/subscriptions', {
      customer: subscriptionData.customer,
      device: subscriptionData.device,
      plan: subscriptionData.plan,
      address: subscriptionData.address
    });

    console.log('[API] ✅ Assinatura criada com sucesso');
    return response.data;
  }

  async getSubscription(subscriptionId) {
    console.log(`[API] Buscando assinatura ${subscriptionId}...`);
    const response = await this.makeRequest('GET', `/api/v1/subscriptions/${subscriptionId}`);
    return response.data;
  }

  // ============================================
  // PAYMENT (Pagamento)
  // ============================================

  async generatePixPayment(subscriptionId) {
    console.log(`[API] Gerando pagamento PIX para assinatura ${subscriptionId}...`);
    const response = await this.makeRequest('POST', '/api/v1/payments/pix', {
      subscription_id: subscriptionId
    });

    console.log('[API] ✅ Pagamento PIX gerado com sucesso');
    return {
      pixCode: response.data.pix_code,
      qrCodeImage: response.data.qr_code_image,
      expiresAt: response.data.expires_at,
      amount: response.data.amount
    };
  }

  async processCreditCardPayment(subscriptionId, cardData) {
    console.log(`[API] Processando pagamento com cartão para assinatura ${subscriptionId}...`);
    const response = await this.makeRequest('POST', '/api/v1/payments/credit-card', {
      subscription_id: subscriptionId,
      card_number: cardData.number,
      card_holder: cardData.holder,
      card_expiry: cardData.expiry,
      card_cvv: cardData.cvv
    });

    console.log('[API] ✅ Pagamento processado com sucesso');
    return response.data;
  }

  // ============================================
  // CACHE
  // ============================================

  clearCache() {
    console.log('[CACHE] Limpando cache...');
    this.cache = {
      brands: null,
      models: {},
      quotations: {}
    };
    console.log('[CACHE] ✅ Cache limpo');
  }
}

// Singleton instance
const clubfixService = new ClubFixService();
module.exports = clubfixService;
