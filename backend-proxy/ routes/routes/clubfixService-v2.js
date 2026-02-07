const axios = require('axios');

class ClubFixService {
  constructor() {
    this.baseURL = process.env.CLUBFIX_BASE_URL || 'https://clubfix.com.br/webservice';
    this.clientId = process.env.CLUBFIX_CLIENT_ID;
    this.clientSecret = process.env.CLUBFIX_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.cache = { brands: null, models: {}, quotations: {} };
    this.cacheExpiry = 60 * 60 * 1000;
  }

  async authenticate() {
    try {
      console.log('[AUTH] Autenticando...');
      const response = await axios.post(this.baseURL + '/oauth/token', {
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: '*'
      }, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });
      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + ((response.data.expires_in || 3600) * 1000);
      console.log('[AUTH] Token obtido!');
      return this.accessToken;
    } catch (error) {
      console.error('[AUTH] Erro:', error.response?.data || error.message);
      throw new Error('Falha na autenticacao');
    }
  }

  async ensureAuthenticated() {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt - 60000) {
      await this.authenticate();
    }
    return this.accessToken;
  }

  async makeRequest(method, endpoint, data, params) {
    await this.ensureAuthenticated();
    const config = {
      method: method,
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
      console.error('[API ERROR]', method, endpoint, error.message);
      if (error.response && error.response.status === 401) {
        this.accessToken = null;
        await this.ensureAuthenticated();
        config.headers.Authorization = 'Bearer ' + this.accessToken;
        return (await axios(config)).data;
      }
      throw error;
    }
  }

  async getBrands() {
    if (this.cache.brands && Date.now() - this.cache.brands.timestamp < this.cacheExpiry) {
      return this.cache.brands.data;
    }
    console.log('[API] Buscando marcas...');
    const response = await this.makeRequest('GET', '/api/v1/brands');
    const brands = response.data.map(function(b) {
      return { id: b.id, name: b.name, status: b.status || 'active' };
    });
    this.cache.brands = { data: brands, timestamp: Date.now() };
    console.log('[API] ' + brands.length + ' marcas carregadas');
    return brands;
  }

  async getModels(brandId) {
    const key = 'brand_' + brandId;
    if (this.cache.models[key] && Date.now() - this.cache.models[key].timestamp < this.cacheExpiry) {
      return this.cache.models[key].data;
    }
    console.log('[API] Buscando modelos...');
    const response = await this.makeRequest('GET', '/api/v1/brands/' + brandId + '/models');
    const models = response.data.map(function(m) {
      return { id: m.id, name: m.name, brandId: brandId, status: m.status || 'active' };
    });
    this.cache.models[key] = { data: models, timestamp: Date.now() };
    console.log('[API] ' + models.length + ' modelos carregados');
    return models;
  }

  async getQuotation(modelId, isUsed) {
    const key = 'model_' + modelId + '_' + isUsed;
    if (this.cache.quotations[key] && Date.now() - this.cache.quotations[key].timestamp < this.cacheExpiry) {
      return this.cache.quotations[key].data;
    }
    console.log('[API] Buscando cotacao...');
    const response = await this.makeRequest('GET', '/api/v1/quotation', null, {
      model_id: modelId,
      is_used: isUsed
    });
    const quotation = {
      model: response.data.model,
      plans: response.data.plans.map(function(p) {
        return {
          id: p.id,
          name: p.name,
          monthlyPrice: parseFloat(p.monthly_price),
          annualPrice: parseFloat(p.annual_price),
          coverage: p.coverage,
          franchise: p.franchise,
          lmi: p.lmi
        };
      })
    };
    this.cache.quotations[key] = { data: quotation, timestamp: Date.now() };
    console.log('[API] ' + quotation.plans.length + ' planos carregados');
    return quotation;
  }

  clearCache() {
    this.cache = { brands: null, models: {}, quotations: {} };
    console.log('[CACHE] Limpo');
  }
}

module.exports = new ClubFixService();
