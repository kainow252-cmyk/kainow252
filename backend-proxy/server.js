const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', function(req, res) {
  res.json({ 
    status: 'OK', 
    service: 'ProtegMais Backend v2.0',
    timestamp: new Date().toISOString(),
    env: {
      port: PORT,
      nodeEnv: process.env.NODE_ENV || 'development',
      hasClientId: !!process.env.CLUBFIX_CLIENT_ID,
      hasClientSecret: !!process.env.CLUBFIX_CLIENT_SECRET,
      baseURL: process.env.CLUBFIX_BASE_URL || 'not set'
    }
  });
});

app.get('/api/test', function(req, res) {
  res.json({ 
    message: 'API funcionando!',
    timestamp: new Date().toISOString()
  });
});

try {
  const clubfixRoutes = require('./routes/clubfix-v2');
  app.use('/api/clubfix', clubfixRoutes);
  console.log('ClubFix routes carregadas');
} catch (error) {
  console.log('ClubFix routes nao encontradas');
}

app.use(function(err, req, res, next) {
  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor'
  });
});

app.listen(PORT, function() {
  console.log('=================================');
  console.log('ProtegMais Backend v2.0');
  console.log('Porta: ' + PORT);
  console.log('OAuth: ' + (process.env.CLUBFIX_CLIENT_ID ? 'Configurado' : 'Faltando'));
  console.log('=================================');
});
