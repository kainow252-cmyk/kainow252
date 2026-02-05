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
    brands: null,
    models: {}
};

// Initialize session with ClubFix
async function initSession() {
    try {
        console.log('==> Inicializando sessao com ClubFix...');
        
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
            console.log(`==> Cookies obtidos: ${session.cookies.length}`);
        }

        const html = response.data;

        // Extract CSRF Token
        const csrfMatch = html.match(/<meta name="csrf-token" content="([^"]+)"/);
        if (csrfMatch) {
            session.csrfToken = csrfMatch[1];
            console.log('==> CSRF Token obtido');
        }

        // Extract fingerprint
        const fingerprintMatch = html.match(/window\.livewire_app_url\s*=\s*'([^']+)'/);
        if (fingerprintMatch) {
            session.fingerprint = fingerprintMatch[1];
            console.log('==> Fingerprint obtido');
        }

        // Extract Livewire data
        console.log('==> Procurando dados Livewire...');
        
        let livewireData = null;
        const wireInitialMatch = html.match(/wire:initial-data="([^"]+)"/);
        if (wireInitialMatch) {
            try {
                const decoded = wireInitialMatch[1]
                    .replace(/&quot;/g, '"')
                    .replace(/&#039;/g, "'")
                    .replace(/&amp;/g, '&');
                livewireData = JSON.parse(decoded);
                console.log('==> Dados Livewire encontrados via wire:initial-data');
            } catch (e) {
                console.log('==> AVISO: Erro ao parsear wire:initial-data');
            }
        }

        // Fallback to hardcoded brands
        if (!livewireData || !livewireData.serverMemo?.data?.brands) {
            console.log('==> AVISO: Usando marcas hardcoded como fallback');
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

        const brandsCount = session.serverMemo?.data?.brands?.length || 0;
        console.log(`==> Sessao iniciada! ${brandsCount} marcas disponiveis`);
        console.log('==> Servidor PRONTO!');
        console.log(`==> URL: https://protegmais.onrender.com`);

        return true;
    } catch (error) {
        console.error('==> ERRO ao inicializar sessao:', error.message);
        return false;
    }
}

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
        console.log('==> Requisicao de marcas recebida');

        if (!session.csrfToken) {
            console.log('==> Sessao nao iniciada, inicializando...');
            await initSession();
        }

        const brands = session.serverMemo?.data?.brands;

        if (!brands || brands.length === 0) {
            console.log('==> AVISO: Nenhuma marca encontrada na sessao');
            await initSession();
            
            const retryBrands = session.serverMemo?.data?.brands;
            if (!retryBrands || retryBrands.length === 0) {
                throw new Error('Nenhuma marca encontrada apos reinicializacao');
            }
            
            console.log(`==> ${retryBrands.length} marcas encontradas apos reinicializacao`);
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

        console.log(`==> Retornando ${brands.length} marcas`);

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
        console.error('==> ERRO ao buscar marcas:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get models for a brand - COM LOGS DETALHADOS
app.post('/api/clubfix/brands/:id/models', async (req, res) => {
    const brandId = parseInt(req.params.id);
    
    try {
        console.log('');
        console.log('='.repeat(60));
        console.log(`==> REQUISICAO DE MODELOS - Marca ID: ${brandId}`);
        console.log('='.repeat(60));

        // Check cache
        const cacheKey = `brand_${brandId}`;
        if (cache.models && cache.models[cacheKey]) {
            console.log(`==> Retornando ${cache.models[cacheKey].length} modelos do CACHE`);
            return res.json({
                success: true,
                data: cache.models[cacheKey],
                count: cache.models[cacheKey].length,
                cached: true
            });
        }

        if (!cache.models) {
            cache.models = {};
        }

        // Check session
        if (!session.csrfToken || !session.fingerprint) {
            console.log('==> AVISO: Sessao invalida, reinicializando...');
            await initSession();
        }

        console.log('==> Preparando requisicao Livewire...');
        console.log(`    CSRF Token: ${session.csrfToken ? 'OK' : 'FALTANDO'}`);
        console.log(`    Fingerprint: ${session.fingerprint ? 'OK' : 'FALTANDO'}`);
        console.log(`    Cookies: ${session.cookies.length}`);

        // Livewire request
        const livewirePayload = {
            fingerprint: {
                id: session.fingerprint || 'default',
                name: 'subscription-form',
                locale: 'pt_BR',
                path: '/assinar/parceiro/clubtech',
                method: 'GET',
                v: 'acj'
            },
            serverMemo: session.serverMemo,
            updates: [
                {
                    type: 'callMethod',
                    payload: {
                        method: 'updatedBrandId',
                        params: [brandId]
                    }
                }
            ]
        };

        console.log('==> Fazendo requisicao Livewire para ClubFix...');
        
        const response = await axios.post(
            'https://clubfix.com.br/livewire/message/subscription-form',
            livewirePayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Livewire': 'true',
                    'X-CSRF-TOKEN': session.csrfToken,
                    'Cookie': session.cookies.join('; '),
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://clubfix.com.br/assinar/parceiro/clubtech'
                },
                timeout: 30000
            }
        );

        console.log(`==> Resposta recebida! Status: ${response.status}`);

        // Update session
        if (response.data.serverMemo) {
            session.serverMemo = response.data.serverMemo;
            console.log('==> ServerMemo atualizado');
        }

        // Extract models
        let models = [];
        
        if (response.data.serverMemo?.data?.models) {
            models = response.data.serverMemo.data.models;
            console.log(`==> SUCESSO! Encontrados ${models.length} modelos em serverMemo.data.models`);
        } else if (response.data.effects?.returns) {
            console.log('==> Tentando extrair de effects.returns...');
            console.log(`==> effects.returns:`, JSON.stringify(response.data.effects.returns).substring(0, 200));
        } else {
            console.log('==> AVISO: Estrutura de resposta desconhecida');
            console.log(`==> Chaves disponiveis:`, Object.keys(response.data));
        }

        if (!models || models.length === 0) {
            console.log('==> AVISO: Nenhum modelo encontrado, usando FALLBACK');
            models = [
                { id: 1788, name: 'Galaxy S24 5G 128GB', brandId },
                { id: 1780, name: 'Galaxy S24 5G 256GB', brandId },
                { id: 1781, name: 'Galaxy S24+ 5G 256GB', brandId }
            ];
        } else {
            console.log(`==> CACHE: Salvando ${models.length} modelos`);
            cache.models[cacheKey] = models.map(model => ({
                id: model.id,
                name: model.name || model.model_name,
                brandId: brandId
            }));
        }

        console.log('='.repeat(60));
        console.log('');

        res.json({
            success: true,
            data: models.map(model => ({
                id: model.id,
                name: model.name || model.model_name,
                brandId: brandId
            })),
            count: models.length,
            real: models.length > 3
        });

    } catch (error) {
        console.error('');
        console.error('='.repeat(60));
        console.error('==> ERRO AO BUSCAR MODELOS');
        console.error(`==> Mensagem: ${error.message}`);
        console.error(`==> Status: ${error.response?.status}`);
        console.error(`==> Data: ${JSON.stringify(error.response?.data || {}).substring(0, 200)}`);
        console.error('='.repeat(60));
        console.error('');
        
        // Fallback
        res.json({
            success: true,
            data: [
                { id: 1788, name: 'Galaxy S24 5G 128GB', brandId },
                { id: 1780, name: 'Galaxy S24 5G 256GB', brandId },
                { id: 1781, name: 'Galaxy S24+ 5G 256GB', brandId }
            ],
            count: 3,
            error: error.message,
            fallback: true
        });
    }
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
    console.log('');
    console.log('='.repeat(60));
    console.log('==> ClubFix Proxy Server INICIADO');
    console.log(`==> Porta: ${PORT}`);
    console.log('='.repeat(60));
    console.log('');
    await initSession();
});
