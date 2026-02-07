/**
 * ClubFix API Routes - v2.0
 * 
 * Rotas RESTful para integração com ClubFix API oficial
 */

const express = require('express');
const router = express.Router();
const clubfixService = require('../services/clubfixService-v2');

/**
 * 📱 LISTAR MARCAS
 */
router.get('/brands', async (req, res) => {
    try {
        const { page = 1, per_page = 50 } = req.query;
        
        console.log('📱 GET /api/clubfix/brands');
        
        const brands = await clubfixService.getBrands(
            parseInt(page),
            parseInt(per_page)
        );
        
        res.json({
            success: true,
            data: brands,
            total: brands.length
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar marcas:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 📱 LISTAR MODELOS DE UMA MARCA
 */
router.get('/models/:brandId', async (req, res) => {
    try {
        const { brandId } = req.params;
        const { page = 1, per_page = 100 } = req.query;
        
        console.log(`📱 GET /api/clubfix/models/${brandId}`);
        
        const models = await clubfixService.getModels(
            parseInt(brandId),
            parseInt(page),
            parseInt(per_page)
        );
        
        res.json({
            success: true,
            data: models,
            total: models.length
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar modelos:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 💰 BUSCAR COTAÇÃO (PLANOS)
 */
router.get('/quotation', async (req, res) => {
    try {
        const { model_id, is_used = 'false' } = req.query;
        
        if (!model_id) {
            return res.status(400).json({
                success: false,
                error: 'model_id é obrigatório'
            });
        }
        
        console.log(`💰 GET /api/clubfix/quotation?model_id=${model_id}&is_used=${is_used}`);
        
        const quotation = await clubfixService.getQuotation(
            parseInt(model_id),
            is_used === 'true'
        );
        
        res.json({
            success: true,
            data: quotation
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar cotação:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 👤 CRIAR CLIENTE
 */
router.post('/customers', async (req, res) => {
    try {
        const customerData = req.body;
        
        console.log('👤 POST /api/clubfix/customers');
        
        const customer = await clubfixService.createCustomer(customerData);
        
        res.status(201).json({
            success: true,
            data: customer
        });
        
    } catch (error) {
        console.error('❌ Erro ao criar cliente:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 📝 CRIAR ASSINATURA
 */
router.post('/subscriptions', async (req, res) => {
    try {
        const subscriptionData = req.body;
        
        console.log('📝 POST /api/clubfix/subscriptions');
        
        const subscription = await clubfixService.createSubscription(subscriptionData);
        
        res.status(201).json({
            success: true,
            data: subscription
        });
        
    } catch (error) {
        console.error('❌ Erro ao criar assinatura:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 💳 PROCESSAR PAGAMENTO PIX
 */
router.post('/payment/pix', async (req, res) => {
    try {
        const { subscription_id } = req.body;
        
        console.log('💳 POST /api/clubfix/payment/pix');
        
        const payment = await clubfixService.processPaymentPix(subscription_id);
        
        res.json({
            success: true,
            data: payment
        });
        
    } catch (error) {
        console.error('❌ Erro ao gerar Pix:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 💳 PROCESSAR PAGAMENTO CARTÃO
 */
router.post('/payment/credit-card', async (req, res) => {
    try {
        const { subscription_id, card } = req.body;
        
        console.log('💳 POST /api/clubfix/payment/credit-card');
        
        const payment = await clubfixService.processPaymentCreditCard(subscription_id, card);
        
        res.json({
            success: true,
            data: payment
        });
        
    } catch (error) {
        console.error('❌ Erro ao processar pagamento:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 🗑️ LIMPAR CACHE
 */
router.post('/cache/clear', (req, res) => {
    try {
        console.log('🗑️ POST /api/cache/clear');
        clubfixService.clearCache();
        
        res.json({
            success: true,
            message: 'Cache limpo com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao limpar cache:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
