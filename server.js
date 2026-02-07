require('dotenv').config();
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
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, function() {
  console.log('Servidor rodando na porta ' + PORT);
});
