const ApiKey = require('../models/ApiKey');
const Upload = require('../models/Upload');
const User = require('../models/User');

// @desc    Generate API key
// @route   POST /api/api-keys
// @access  Private
exports.generateApiKey = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a name for the API key'
            });
        }

        // Check if user has reached limit (max 5 keys)
        const existingKeys = await ApiKey.countDocuments({ user: req.user.id });
        if (existingKeys >= 5) {
            return res.status(400).json({
                success: false,
                error: 'Maximum API key limit (5) reached'
            });
        }

        // Create API key
        const apiKey = await ApiKey.create({
            user: req.user.id,
            name
        });

        res.status(201).json({
            success: true,
            message: 'API key generated successfully',
            data: {
                id: apiKey._id,
                key: apiKey.key,
                name: apiKey.name,
                createdAt: apiKey.createdAt,
                expiresAt: apiKey.expiresAt
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get all API keys
// @route   GET /api/api-keys
// @access  Private
exports.getApiKeys = async (req, res) => {
    try {
        const apiKeys = await ApiKey.find({ user: req.user.id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: apiKeys.map(key => ({
                id: key._id,
                name: key.name,
                key: key.isActive ? key.key : '••••••••',
                isActive: key.isActive,
                lastUsed: key.lastUsed,
                usageCount: key.usageCount,
                createdAt: key.createdAt,
                expiresAt: key.expiresAt
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Toggle API key status
// @route   PUT /api/api-keys/:id/toggle
// @access  Private
exports.toggleApiKey = async (req, res) => {
    try {
        const apiKey = await ApiKey.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                error: 'API key not found'
            });
        }

        apiKey.isActive = !apiKey.isActive;
        await apiKey.save();

        res.status(200).json({
            success: true,
            message: `API key ${apiKey.isActive ? 'activated' : 'deactivated'} successfully`,
            data: {
                id: apiKey._id,
                isActive: apiKey.isActive
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Delete API key
// @route   DELETE /api/api-keys/:id
// @access  Private
exports.deleteApiKey = async (req, res) => {
    try {
        const apiKey = await ApiKey.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                error: 'API key not found'
            });
        }

        await apiKey.deleteOne();

        res.status(200).json({
            success: true,
            message: 'API key deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get API usage stats
// @route   GET /api/api-keys/stats
// @access  Private
exports.getApiStats = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const apiKeys = await ApiKey.find({ user: req.user.id });
        const uploads = await Upload.find({ user: req.user.id });

        const apiUploads = uploads.filter(u => u.uploadMethod === 'api');

        res.status(200).json({
            success: true,
            data: {
                totalApiKeys: apiKeys.length,
                activeApiKeys: apiKeys.filter(k => k.isActive).length,
                totalApiUploads: apiUploads.length,
                uploadsThisMonth: user.uploadsThisMonth,
                uploadLimit: process.env.UPLOAD_LIMIT_PER_MONTH,
                usagePercentage: Math.round((user.uploadsThisMonth / process.env.UPLOAD_LIMIT_PER_MONTH) * 100),
                apiUsageCount: apiKeys.reduce((sum, key) => sum + key.usageCount, 0)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get API key usage stats (for external API clients)
// @route   GET /api/api-keys/usage
// @access  API Key
exports.getApiKeyUsage = async (req, res) => {
    try {
        const apiKey = req.apiKey;

        // Get stats for this specific API key
        const uploads = await Upload.find({
            user: apiKey.user,
            uploadMethod: 'api'
        });

        const user = await User.findById(apiKey.user);

        res.status(200).json({
            success: true,
            data: {
                keyName: apiKey.name,
                isActive: apiKey.isActive,
                lastUsed: apiKey.lastUsed,
                usageCount: apiKey.usageCount,
                totalUploads: uploads.length,
                uploadsThisMonth: user.uploadsThisMonth,
                uploadLimit: process.env.UPLOAD_LIMIT_PER_MONTH,
                usagePercentage: Math.round((user.uploadsThisMonth / process.env.UPLOAD_LIMIT_PER_MONTH) * 100),
                createdAt: apiKey.createdAt,
                expiresAt: apiKey.expiresAt
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};