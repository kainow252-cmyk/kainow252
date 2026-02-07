/**
 * ProtegMais Backend v2.0
 * Servidor API REST para ClubFix
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'ProtegMais Backend v2.0 (API REST)',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Rotas ClubFix API v2.0
const clubfixRoutes = require('./routes/clubfix-v2');
app.use('/api/clubfix', clubfixRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint não encontrado',
        path: req.path
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Erro no servidor:', err);
    res.status(500).json({
        error: 'Erro interno do servidor',
        message: err.message
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('  ✅ ProtegMais Backend v2.0 (API REST)');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  🌐 Servidor: http://localhost:${PORT}`);
    console.log(`  📡 API ClubFix v2.0 carregada`);
    console.log(`  🔐 OAuth 2.0: ${process.env.CLUBFIX_CLIENT_ID ? 'Configurado' : 'NÃO CONFIGURADO'}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');
});

module.exports = app;
