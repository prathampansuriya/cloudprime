const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimit');

// Apply rate limiting
router.use(uploadLimiter);

// Dashboard upload (protected)
router.post(
    '/upload-image',
    protect,
    upload.single('file'),
    uploadController.uploadViaDashboard
);

// Get user uploads
router.get('/', protect, uploadController.getUserUploads);

// Delete upload
router.delete('/:id', protect, uploadController.deleteUpload);

module.exports = router;