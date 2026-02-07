// ClubFix Service v2.0 - API REST + OAuth 2.0
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

  // Autenticação OAuth 2.0
  async authenticate() {
    try {
      console.log('[AUTH] Autenticando com ClubFix...');
      
      const response = await axios.post(this.baseURL + '/oauth/token', {
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

      console.log('[AUTH] Token obtido! Expira em:', new Date(this.tokenExpiresAt).toISOString());
      return this.accessToken;
    } catch (error) {
      console.error('[AUTH] Erro:', error.response?.data || error.message);
      throw new Error('Falha na autenticação ClubFix');
    }
  }

  async ensureAuthenticated() {
    if (!this.accessToken || !this.tokenExpiresAt || Date.now() >= this.tokenExpiresAt - 60000) {
      await this.authenticate();
    }
    return this.accessToken;
  }

  async makeRequest(method, endpoint, data = null, params = null) {
    await this.ensureAuthenticated();

    const config = {
      method,
      url: this.baseURL + endpoint,
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
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
      console.error('[API ERROR]', method, endpoint, error.response?.data || error.message);
      
      // Retry se 401
      if (error.response?.status === 401) {
        console.log('[API] Token expirado, renovando...');
        this.accessToken = null;
        await this.ensureAuthenticated();
        config.headers.Authorization = 'Bearer ' + this.accessToken;
        const retryResponse = await axios(config);
        return retryResponse.data;
      }
      
      throw error;
    }
  }

  // BRANDS
  async getBrands() {
    if (this.cache.brands && Date.now() - this.cache.brands.timestamp < this.cacheExpiry) {
      console.log('[CACHE] Usando marcas em cache');
      return this.cache.brands.data;
    }

    console.log('[API] Buscando marcas...');
    const response = await this.makeRequest('GET', '/api/v1/brands');
    
    const brands = response.data.map(function(brand) {
      return {
        id: brand.id,
        name: brand.name,
        status: brand.status || 'active'
      };
    });

    this.cache.brands = {
      data: brands,
      timestamp: Date.now()
    };

    console.log('[API] ' + brands.length + ' marcas carregadas');
    return brands;
  }

  // MODELS
  async getModels(brandId) {
    const cacheKey = 'brand_' + brandId;
    
    if (this.cache.models[cacheKey] && Date.now() - this.cache.models[cacheKey].timestamp < this.cacheExpiry) {
      console.log('[CACHE] Usando modelos em cache');
      return this.cache.models[cacheKey].data;
    }

    console.log('[API] Buscando modelos da marca ' + brandId + '...');
    const response = await this.makeRequest('GET', '/api/v1/brands/' + brandId + '/models');
    
    const models = response.data.map(function(model) {
      return {
        id: model.id,
        name: model.name,
        brandId: brandId,
        status: model.status || 'active'
      };
    });

    this.cache.models[cacheKey] = {
      data: models,
      timestamp: Date.now()
    };

    console.log('[API] ' + models.length + ' modelos carregados');
    return models;
  }

  // QUOTATION
  async getQuotation(modelId, isUsed) {
    const cacheKey = 'model_' + modelId + '_used_' + isUsed;
    
    if (this.cache.quotations[cacheKey] && Date.now() - this.cache.quotations[cacheKey].timestamp < this.cacheExpiry) {
      console.log('[CACHE] Usando cotação em cache');
      return this.cache.quotations[cacheKey].data;
    }

    console.log('[API] Buscando cotação...');
    const response = await this.makeRequest('GET', '/api/v1/quotation', null, {
      model_id: modelId,
      is_used: isUsed
    });

    const quotation = {
      model: response.data.model,
      plans: response.data.plans.map(function(plan) {
        return {
          id: plan.id,
          name: plan.name,
          monthlyPrice: parseFloat(plan.monthly_price),
          annualPrice: parseFloat(plan.annual_price),
          coverage: plan.coverage,
          franchise: plan.franchise,
          lmi: plan.lmi
        };
      })
    };

    this.cache.quotations[cacheKey] = {
      data: quotation,
      timestamp: Date.now()
    };

    console.log('[API] ' + quotation.plans.length + ' planos carregados');
    return quotation;
  }

  clearCache() {
    this.cache = {
      brands: null,
      models: {},
      quotations: {}
    };
    console.log('[CACHE] Cache limpo');
  }
}

const clubfixService = new ClubFixService();
module.exports = clubfixService;
