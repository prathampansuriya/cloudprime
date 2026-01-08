const mongoose = require('mongoose');
const path = require('path');

const uploadSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fileName: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    fileType: {
        type: String,
        enum: ['image', 'video', 'document', 'other'],
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    filePath: {
        type: String,
        required: true
    },
    publicUrl: {
        type: String,
        required: true
    },
    uploadMethod: {
        type: String,
        enum: ['dashboard', 'api'],
        required: true
    },
    apiKeyUsed: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ApiKey'
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: () => new Date(+new Date() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    views: {
        type: Number,
        default: 0
    },
    downloads: {
        type: Number,
        default: 0
    }
});

// Get file extension
uploadSchema.virtual('extension').get(function () {
    return path.extname(this.fileName).toLowerCase();
});

// Check if file is expired
uploadSchema.virtual('isExpired').get(function () {
    return new Date() > this.expiresAt;
});

module.exports = mongoose.model('Upload', uploadSchema);