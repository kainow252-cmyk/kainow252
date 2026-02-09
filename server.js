/**
 * ProtegMais Backend v2.0
 * API REST para integração com ClubFix
 * 
 * Features:
 * - OAuth 2.0 Authentication
 * - RESTful API endpoints
 * - CORS habilitado
 * - Logs detalhados
 * - Health check
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// ===================================
// MIDDLEWARE
// ===================================

// CORS
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-credentials']
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${req.method} ${req.path}`);
    next();
});

// ===================================
// HEALTH CHECK
// ===================================

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'ProtegMais Backend v2.0 (API REST)',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        oauth: process.env.CLUBFIX_CLIENT_ID ? 'Configurado' : 'NÃO CONFIGURADO'
    });
});

// ===================================
// ROTAS CLUBFIX API v2.0
// ===================================

const clubfixRoutes = require('./routes/clubfix-v2');
app.use('/api/clubfix', clubfixRoutes);

// ===================================
// ROTAS CLUBFIX API v3.0 OFICIAL
// ===================================

const clubfixV3Routes = require('./routes/clubfix-v3');
app.use('/api/clubfix/v3', clubfixV3Routes);

// ===================================
// ROTA RAIZ
// ===================================

app.get('/', (req, res) => {
    res.json({
        service: 'ProtegMais Backend v2.0',
        version: '2.0.0',
        documentation: 'https://docs.clubfix.com.br/api-reference/introduction',
        apis: {
            v2: {
                description: 'API v2.0 (produção)',
                endpoints: {
                    health: '/health',
                    brands: '/api/clubfix/brands',
                    models: '/api/clubfix/models/:brandId',
                    quotation: '/api/clubfix/quotation?model_id=:modelId',
                    customers: '/api/clubfix/customers',
                    subscriptions: '/api/clubfix/subscriptions',
                    payment_pix: '/api/clubfix/payment/pix',
                    payment_card: '/api/clubfix/payment/credit-card'
                }
            },
            v3: {
                description: 'API v3.0 OFICIAL (homologação)',
                baseUrl: 'https://homolog.clubfix.com.br/webservice',
                endpoints: {
                    health: '/api/clubfix/v3/health',
                    info: '/api/clubfix/v3/info',
                    brands: '/api/clubfix/v3/brands',
                    models: '/api/clubfix/v3/brands/:brandId/models',
                    plans: '/api/clubfix/v3/plans',
                    quotation: '/api/clubfix/v3/quotation?model_id=:modelId',
                    quotation_plan: '/api/clubfix/v3/plans/:planId/quotation?model_id=:modelId',
                    customers: '/api/clubfix/v3/customers',
                    get_customer: '/api/clubfix/v3/customers/:document',
                    subscriptions: '/api/clubfix/v3/subscriptions',
                    get_subscription: '/api/clubfix/v3/subscriptions/:subscriptionId',
                    payment: '/api/clubfix/v3/subscriptions/:subscriptionId/payment'
                }
            }
        }
    });
});

// ===================================
// 404 HANDLER
// ===================================

app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint não encontrado',
        path: req.path,
        method: req.method,
        message: 'Verifique a documentação em /health'
    });
});

// ===================================
// ERROR HANDLER
// ===================================

app.use((err, req, res, next) => {
    console.error('❌ Erro no servidor:', err);
    
    res.status(err.status || 500).json({
        error: 'Erro interno do servidor',
        message: err.message,
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

// ===================================
// INICIAR SERVIDOR
// ===================================

app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ ProtegMais Backend v2.0 (API REST ClubFix)');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  🌐 Servidor rodando em: http://localhost:${PORT}`);
    console.log(`  📡 Rotas ClubFix v2.0: CARREGADAS`);
    console.log(`  📡 Rotas ClubFix v3.0: CARREGADAS`);
    console.log(`  🔐 OAuth 2.0: ${process.env.CLUBFIX_CLIENT_ID ? '✅ CONFIGURADO' : '❌ NÃO CONFIGURADO'}`);
    console.log(`  🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  🔗 Base URL ClubFix: ${process.env.CLUBFIX_BASE_URL || 'NÃO CONFIGURADO'}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 Endpoints disponíveis:');
    console.log('  GET    /health');
    console.log('  GET    /');
    console.log('  GET    /api/clubfix/brands');
    console.log('  GET    /api/clubfix/models/:brandId');
    console.log('  GET    /api/clubfix/quotation');
    console.log('  POST   /api/clubfix/customers');
    console.log('  POST   /api/clubfix/subscriptions');
    console.log('  ');
    console.log('  📡 Rotas v3.0 OFICIAL:');
    console.log('  GET    /api/clubfix/v3/health');
    console.log('  GET    /api/clubfix/v3/info');
    console.log('  GET    /api/clubfix/v3/brands');
    console.log('  GET    /api/clubfix/v3/brands/:brandId/models');
    console.log('  GET    /api/clubfix/v3/plans');
    console.log('  GET    /api/clubfix/v3/quotation');
    console.log('  POST   /api/clubfix/v3/customers');
    console.log('  POST   /api/clubfix/v3/subscriptions');
    console.log('  POST   /api/clubfix/v3/subscriptions/:id/payment');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    
    // Avisos importantes
    if (!process.env.CLUBFIX_CLIENT_ID || !process.env.CLUBFIX_CLIENT_SECRET) {
        console.log('⚠️  ATENÇÃO: Credenciais OAuth 2.0 NÃO configuradas!');
        console.log('   Configure as variáveis de ambiente:');
        console.log('   - CLUBFIX_CLIENT_ID');
        console.log('   - CLUBFIX_CLIENT_SECRET');
        console.log('   - CLUBFIX_BASE_URL');
        console.log('');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

module.exports = app;
