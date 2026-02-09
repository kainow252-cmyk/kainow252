1	/**
     2	 * ClubFix Service v3.0 - OFICIAL
     3	 * Baseado 100% na documentação oficial: https://homolog.clubfix.com.br/webservice
     4	 * 
     5	 * ENDPOINTS PRINCIPAIS:
     6	 * - POST /auth/login - Autenticação
     7	 * - POST /customers - Criar cliente
     8	 * - GET /brands - Listar marcas
     9	 * - GET /brands/{id}/models - Listar modelos de uma marca
    10	 * - GET /plans - Listar planos
    11	 * - GET /quotation - Cotar todos os planos
    12	 * - GET /plans/{planId}/quotation - Cotar um plano específico
    13	 * - POST /subscriptions - Criar assinatura
    14	 * - POST /subscriptions/{id}/payment - Processar pagamento
    15	 */
    16	
    17	const axios = require('axios');
    18	
    19	class ClubFixServiceV3 {
    20	    constructor() {
    21	        // USA A URL DE PRODUÇÃO (pois as credenciais são de produção)
    22	        this.baseURL = process.env.CLUBFIX_BASE_URL || 'https://clubfix.com.br/webservice';
    23	        this.clientId = process.env.CLUBFIX_CLIENT_ID;
    24	        this.clientSecret = process.env.CLUBFIX_CLIENT_SECRET;
    25	        this.email = process.env.CLUBFIX_EMAIL || 'kainow@clubfix.com.br';
    26	        this.password = process.env.CLUBFIX_PASSWORD || 'Kainow@27923746';
    27	        
    28	        this.token = {
    29	            accessToken: null,
    30	            expiresAt: null
    31	        };
    32	        
    33	        // Cache para otimização
    34	        this.cache = {
    35	            brands: null,
    36	            models: {},
    37	            plans: null,
    38	            lastUpdate: null
    39	        };
    40	
    41	        // Cliente HTTP
    42	        this.client = axios.create({
    43	            baseURL: this.baseURL,
    44	            timeout: 30000,
    45	            headers: {
    46	                'Content-Type': 'application/json',
    47	                'Accept': 'application/json'
    48	            }
    49	        });
    50	
    51	        console.log('📱 ClubFix Service v3.0 OFICIAL (PRODUÇÃO) inicializado');
    52	        console.log(`Base URL: ${this.baseURL}`);
    53	        console.log('⚠️ Usando URL de PRODUÇÃO (credenciais de produção)');
    54	    }
    55	
    56	    /**
    57	     * Retorna informações do serviço
    58	     */
    59	    getInfo() {
    60	        return {
    61	            baseURL: this.baseURL,
    62	            authenticated: !!this.token.accessToken,
    63	            tokenExpiresAt: this.token.expiresAt,
    64	            cacheStats: {
    65	                brands: this.cache.brands ? this.cache.brands.length : 0,
    66	                models: Object.keys(this.cache.models).length,
    67	                plans: this.cache.plans ? this.cache.plans.length : 0,
    68	                lastUpdate: this.cache.lastUpdate
    69	            }
    70	        };
    71	    }
    72	
    73	    /**
    74	     * AUTENTICAÇÃO - Conforme Documentação Oficial
    75	     * POST /auth/login
    76	     * Header: X-CREDENTIALS: base64(email:password)
    77	     * Body: { client_id, client_secret }
    78	     * Response: { access_token, token_type, expires_in }
    79	     */
    80	    async authenticate() {
    81	        if (!this.clientId || !this.clientSecret) {
    82	            throw new Error('CLIENT_ID e CLIENT_SECRET são obrigatórios');
    83	        }
    84	
    85	        if (!this.email || !this.password) {
    86	            throw new Error('EMAIL e PASSWORD são obrigatórios');
    87	        }
    88	
    89	        console.log('\n🔐 Autenticando na API ClubFix OFICIAL...');
    90	        console.log(`Email: ${this.email}`);
    91	        console.log(`Client ID: ${this.clientId}`);
    92	        console.log(`Base URL: ${this.baseURL}`);
    93	
    94	        try {
    95	            // Criar X-CREDENTIALS header (base64 de email:password) conforme documentação
    96	            const credentials = Buffer.from(`${this.email}:${this.password}`).toString('base64');
    97	            
    98	            console.log('📝 POST /auth/login');
    99	            console.log(`X-CREDENTIALS: ${credentials.substring(0, 20)}...`);
