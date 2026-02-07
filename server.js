require('dotenv').config();
const express = require('express');
const cors = require('cors');
const clubfixRoutes = require('./routes/clubfix-v2');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['*'];

app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-credentials']
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'ProtegMais Backend v2.0 (API REST)',
    timestamp: new Date().toISOString(),
    oauth: process.env.CLUBFIX_CLIENT_ID ? 'configured' : 'missing'
  });
});

// ClubFix routes
app.use('/api/clubfix', clubfixRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'production' ? 'Erro interno' : err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║       🛡️  ProtegMais Backend v2.0 (API REST)          ║
║                                                        ║
║  🚀 Servidor rodando na porta ${PORT}                    ║
║  🔐 OAuth 2.0: ${process.env.CLUBFIX_CLIENT_ID ? '✅ Configurado' : '❌ Faltando'}     ║
║  🌐 Base URL: ${process.env.CLUBFIX_BASE_URL || 'Não definida'}              ║
║  📦 CORS: ${allowedOrigins.join(', ')}                              ║
║                                                        ║
║  Endpoints disponíveis:                                ║
║  • GET  /health                                        ║
║  • GET  /api/clubfix/brands                           ║
║  • GET  /api/clubfix/models/:brandId                  ║
║  • GET  /api/clubfix/quotation                        ║
║  • POST /api/clubfix/customers                        ║
║  • POST /api/clubfix/subscriptions                    ║
║  • POST /api/clubfix/payment/pix                      ║
║  • POST /api/clubfix/payment/credit-card              ║
║  • GET  /api/clubfix/subscriptions/:id                ║
║  • POST /api/cache/clear                              ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});
