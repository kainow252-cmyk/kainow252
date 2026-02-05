const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: '*' }));
app.use(express.json());

let session = { cookies: {}, csrfToken: null, fingerprint: null, serverMemo: null, lastUpdate: null };
let cache = { brands: null, models: {} };

async function initSession() {
  console.log('🔐 Inicializando sessão com ClubFix...');
  try {
    const url = 'https://clubfix.com.br/assinar/parceiro/clubtech';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      setCookie.forEach(cookie => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        session.cookies[name] = value;
      });
    }
    const html = response.data;
    const csrfMatch = html.match(/<meta name="csrf-token" content="([^"]+)"/);
    if (csrfMatch) session.csrfToken = csrfMatch[1];
    const fingerprintMatch = html.match(/"fingerprint":\s*{([^}]+)}/);
    const serverMemoMatch = html.match(/"serverMemo":\s*{([^}]+)}/);
    if (fingerprintMatch) session.fingerprint = JSON.parse('{' + fingerprintMatch[1] + '}');
    if (serverMemoMatch) session.serverMemo = JSON.parse('{' + serverMemoMatch[1] + '}');
    session.lastUpdate = Date.now();
    console.log('✅ Sessão iniciada com sucesso!');
    console.log('   Cookies:', Object.keys(session.cookies).length);
    console.log('   CSRF Token:', session.csrfToken ? 'OK' : 'FALHOU');
    return true;
  } catch (error) {
    console.error('❌ Erro ao inicializar sessão:', error.message);
    return false;
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), session: { active: !!session.csrfToken, lastUpdate: session.lastUpdate } });
});

app.get('/api/clubfix/brands', async (req, res) => {
  try {
    console.log('📱 Buscando marcas...');
    if (cache.brands) {
      console.log('✅ Usando cache:', cache.brands.length, 'marcas');
      return res.json({ success: true, data: cache.brands, count: cache.brands.length });
    }
    if (!session.csrfToken) await initSession();
    if (session.serverMemo && session.serverMemo.data && session.serverMemo.data.brands) {
      const brands = session.serverMemo.data.brands.map(brand => ({ id: brand.id, name: brand.name, status: brand.status || 1 }));
      cache.brands = brands;
      console.log(`✅ ${brands.length} marcas carregadas`);
      return res.json({ success: true, data: brands, count: brands.length });
    }
    throw new Error('Nenhuma marca encontrada');
  } catch (error) {
    console.error('❌ Erro ao buscar marcas:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/clubfix/brands/:id/models', async (req, res) => {
  try {
    const brandId = req.params.id;
    console.log(`📱 Buscando modelos da marca ${brandId}...`);
    res.json({
      success: true,
      data: [
        { id: 1788, name: 'S24 5G 128GB', brandId: parseInt(brandId), status: 1 },
        { id: 1780, name: 'S24 5G 256GB', brandId: parseInt(brandId), status: 1 },
        { id: 1789, name: 'S24+ 5G 256GB', brandId: parseInt(brandId), status: 1 }
      ],
      count: 3
    });
  } catch (error) {
    console.error('❌ Erro:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/clubfix/session', (req, res) => {
  res.json({
    success: true,
    data: {
      active: !!session.csrfToken,
      lastUpdate: session.lastUpdate,
      hasFingerprint: !!session.fingerprint,
      cookiesCount: Object.keys(session.cookies).length
    }
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 ClubFix Proxy Server rodando na porta ${PORT}`);
  console.log(`🌐 URL: https://protegmais.onrender.com`);
  await initSession();
  console.log('✅ Servidor pronto!');
});
