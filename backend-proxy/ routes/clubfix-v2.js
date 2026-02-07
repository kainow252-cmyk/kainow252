const express = require('express');
const router = express.Router();
const clubfixService = require('../services/clubfixService-v2');

router.get('/brands', async function(req, res) {
  try {
    console.log('[GET /brands]');
    const brands = await clubfixService.getBrands();
    res.json({ success: true, data: brands });
  } catch (error) {
    console.error('[ERROR /brands]', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar marcas', details: error.message });
  }
});

router.get('/models/:brandId', async function(req, res) {
  try {
    const brandId = req.params.brandId;
    console.log('[GET /models/' + brandId + ']');
    const models = await clubfixService.getModels(brandId);
    res.json({ success: true, data: models });
  } catch (error) {
    console.error('[ERROR /models]', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar modelos', details: error.message });
  }
});

router.get('/quotation', async function(req, res) {
  try {
    const modelId = req.query.model_id;
    const isUsed = req.query.is_used === 'true';
    if (!modelId) {
      return res.status(400).json({ success: false, error: 'model_id obrigatorio' });
    }
    console.log('[GET /quotation] model=' + modelId);
    const quotation = await clubfixService.getQuotation(modelId, isUsed);
    res.json({ success: true, data: quotation });
  } catch (error) {
    console.error('[ERROR /quotation]', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar cotacao', details: error.message });
  }
});

router.post('/cache/clear', function(req, res) {
  try {
    clubfixService.clearCache();
    res.json({ success: true, message: 'Cache limpo' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro ao limpar cache' });
  }
});

module.exports = router;
