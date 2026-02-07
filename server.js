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
      hasClientId: !!process.env.CLUBFIX_CLIENT_ID
    }
  });
});

app.get('/api/test', function(req, res) {
  res.json({ 
    message: 'API funcionando!',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, function() {
  console.log('=================================');
  console.log('ProtegMais Backend v2.0');
  console.log('Servidor rodando na porta: ' + PORT);
  console.log('=================================');
});
