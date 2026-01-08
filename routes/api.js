const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const uploadController = require('../controllers/uploadController');
const { protect, apiKeyAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { apiLimiter } = require('../middleware/rateLimit');

// Apply rate limiting
router.use(apiLimiter);

// API Key management (protected)
router.post('/api-keys', protect, apiController.generateApiKey);
router.get('/api-keys', protect, apiController.getApiKeys);
router.put('/api-keys/:id/toggle', protect, apiController.toggleApiKey);
router.delete('/api-keys/:id', protect, apiController.deleteApiKey);
router.get('/api-keys/stats', protect, apiController.getApiStats);
router.get('/api-keys/usage', apiKeyAuth, apiController.getApiKeyUsage);

// API endpoint for external uploads (requires API key)
router.post(
    '/v1/upload-image/',
    apiKeyAuth,
    upload.single('file'),
    uploadController.uploadViaApi
);

module.exports = router;