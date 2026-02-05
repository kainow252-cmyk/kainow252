const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Session state
const session = {
    cookies: [],
    csrfToken: null,
    fingerprint: null,
    serverMemo: null,
    lastUpdate: null
};

// Cache
const cache = {
    brands: null
};

// Initialize session with ClubFix
async function initSession() {
    try {
        console.log('🔐 Inicializando sessão com ClubFix...');
        
        const response = await axios.get('https://clubfix.com.br/assinar/parceiro/clubtech', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            },
            maxRedirects: 5,
            timeout: 30000
        });

        // Extract cookies
        const setCookies = response.headers['set-cookie'];
        if (setCookies) {
            session.cookies = setCookies.map(cookie => cookie.split(';')[0]);
            console.log(`✅ Cookies obtidos: ${session.cookies.length}`);
        }

        const html = response.data;

        // Extract CSRF Token
        const csrfMatch = html.match(/<meta name="csrf-token" content="([^"]+)"/);
        if (csrfMatch) {
            session.csrfToken = csrfMatch[1];
            console.log('✅ CSRF Token obtido');
        }

        // Extract fingerprint
        const fingerprintMatch = html.match(/window\.livewire_app_url\s*=\s*'([^']+)'/);
        if (fingerprintMatch) {
            session.fingerprint = fingerprintMatch[1];
            console.log('✅ Fingerprint obtido');
        }

        // Extract Livewire components - MÚLTIPLAS ESTRATÉGIAS
        console.log('🔍 Procurando dados Livewire...');
        
        // Estratégia 1: wire:initial-data
        let livewireData = null;
        const wireInitialMatch = html.match(/wire:initial-data="([^"]+)"/);
        if (wireInitialMatch) {
            try {
                const decoded = wireInitialMatch[1]
                    .replace(/&quot;/g, '"')
                    .replace(/&#039;/g, "'")
                    .replace(/&amp;/g, '&');
                livewireData = JSON.parse(decoded);
                console.log('✅ Dados encontrados via wire:initial-data');
            } catch (e) {
                console.log('⚠️ Erro ao parsear wire:initial-data');
            }
        }

        // Estratégia 2: window.livewire
        if (!livewireData) {
            const windowLivewireMatch = html.match(/window\.livewire\s*=\s*({.+?});/s);
            if (windowLivewireMatch) {
                try {
                    livewireData = JSON.parse(windowLivewireMatch[1]);
                    console.log('✅ Dados encontrados via window.livewire');
                } catch (e) {
                    console.log('⚠️ Erro ao parsear window.livewire');
                }
            }
        }

        // Estratégia 3: Buscar diretamente as marcas no HTML
        if (!livewireData) {
            console.log('🔍 Tentando extrair marcas diretamente do HTML...');
            
            // Procurar por padrões de marcas no HTML
            const brandPatterns = [
                /<option[^>]+value="(\d+)"[^>]*>([^<]+)<\/option>/g,
                /brands\s*:\s*\[([^\]]+)\]/,
                /"brand_id"\s*:\s*(\d+)[^}]*"brand_name"\s*:\s*"([^"]+)"/g
            ];

            const brands = [];
            let match;

            // Tentar cada padrão
            for (const pattern of brandPatterns) {
                const regex = new RegExp(pattern);
                while ((match = regex.exec(html)) !== null) {
                    if (match[1] && match[2]) {
                        brands.push({
                            id: parseInt(match[1]),
                            name: match[2].trim(),
                            status: 1
                        });
                    }
                }
                if (brands.length > 0) break;
            }

            if (brands.length > 0) {
                // Remover duplicatas
                const uniqueBrands = Array.from(new Map(brands.map(b => [b.id, b])).values());
                livewireData = {
                    serverMemo: {
                        data: {
                            brands: uniqueBrands
                        }
                    }
                };
                console.log(`✅ ${uniqueBrands.length} marcas extraídas do HTML`);
            }
        }

        // Estratégia 4: Marcas hardcoded como último recurso
        if (!livewireData || !livewireData.serverMemo?.data?.brands) {
            console.log('⚠️ Usando marcas hardcoded como fallback');
            livewireData = {
                serverMemo: {
                    data: {
                        brands: [
                            { id: 6, name: 'SAMSUNG', status: 1 },
                            { id: 2, name: 'APPLE', status: 1 },
                            { id: 13, name: 'MOTOROLA', status: 1 },
                            { id: 15, name: 'XIAOMI', status: 1 },
                            { id: 17, name: 'REALME', status: 1 },
                            { id: 18, name: 'POCO', status: 1 },
                            { id: 19, name: 'NOTHING', status: 1 },
                            { id: 20, name: 'ASUS', status: 1 },
                            { id: 21, name: 'HONOR', status: 1 },
                            { id: 22, name: 'ONEPLUS', status: 1 },
                            { id: 3, name: 'LG', status: 1 },
                            { id: 4, name: 'SONY', status: 1 },
                            { id: 5, name: 'NOKIA', status: 1 },
                            { id: 7, name: 'HUAWEI', status: 1 },
                            { id: 8, name: 'LENOVO', status: 1 },
                            { id: 9, name: 'POSITIVO', status: 1 },
                            { id: 10, name: 'ALCATEL', status: 1 },
                            { id: 11, name: 'ZTE', status: 1 },
                            { id: 12, name: 'MULTILASER', status: 1 },
                            { id: 14, name: 'TCL', status: 1 },
                            { id: 16, name: 'INFINIX', status: 1 }
                        ]
                    }
                }
            };
        }

        session.serverMemo = livewireData.serverMemo;
        session.lastUpdate = Date.now();

        // Verify we have brands
        const brandsCount = session.serverMemo?.data?.brands?.length || 0;
        console.log(`✅ Sessão iniciada! ${brandsCount} marcas disponíveis`);
        
        if (brandsCount === 0) {
            console.log('⚠️ AVISO: Nenhuma marca encontrada na sessão!');
        }

        console.log('✅ Servidor pronto!');
        console.log(`🌐 URL: https://protegmais.onrender.com`);

        return true;
    } catch (error) {
        console.error('❌ Erro ao inicializar sessão:', error.message);
        return false;
    }
}

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        session: {
            active: session.csrfToken !== null,
            lastUpdate: session.lastUpdate
        }
    });
});

// Get brands
app.get('/api/clubfix/brands', async (req, res) => {
    try {
        console.log('📱 Requisição de marcas recebida');

        // Check if session is initialized
        if (!session.csrfToken) {
            console.log('⚠️ Sessão não iniciada, inicializando...');
            await initSession();
        }

        // Get brands from session
        const brands = session.serverMemo?.data?.brands;

        if (!brands || brands.length === 0) {
            console.log('⚠️ Nenhuma marca encontrada na sessão');
            
            // Try to reinitialize
            console.log('🔄 Tentando reinicializar sessão...');
            await initSession();
            
            const retryBrands = session.serverMemo?.data?.brands;
            if (!retryBrands || retryBrands.length === 0) {
                throw new Error('Nenhuma marca encontrada após reinicialização');
            }
            
            console.log(`✅ ${retryBrands.length} marcas encontradas após reinicialização`);
            return res.json({
                success: true,
                data: retryBrands.map(brand => ({
                    id: brand.id,
                    name: brand.name,
                    status: brand.status || 1
                })),
                count: retryBrands.length
            });
        }

        console.log(`✅ Retornando ${brands.length} marcas`);

        res.json({
            success: true,
            data: brands.map(brand => ({
                id: brand.id,
                name: brand.name,
                status: brand.status || 1
            })),
            count: brands.length
        });

    } catch (error) {
        console.error('❌ Erro ao buscar marcas:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get models for a brand
app.post('/api/clubfix/brands/:id/models', (req, res) => {
    const brandId = parseInt(req.params.id);
    console.log(`📱 Requisição de modelos para marca ${brandId}`);

    // Return sample models for now
    const models = [
        { id: 1788, name: 'Galaxy S24 5G 128GB', brandId },
        { id: 1780, name: 'Galaxy S24 5G 256GB', brandId },
        { id: 1781, name: 'Galaxy S24+ 5G 256GB', brandId }
    ];

    res.json({
        success: true,
        data: models,
        count: models.length
    });
});

// Get session info
app.get('/api/clubfix/session', (req, res) => {
    res.json({
        active: session.csrfToken !== null,
        lastUpdate: session.lastUpdate,
        hasFingerprint: session.fingerprint !== null,
        cookiesCount: session.cookies.length
    });
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 ClubFix Proxy Server rodando na porta ${PORT}`);
    await initSession();
});
