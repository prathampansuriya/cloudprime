const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        default: () => crypto.randomBytes(32).toString('hex')
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Please provide a name for your API key'],
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastUsed: Date,
    usageCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: () => new Date(+new Date() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
    }
});

// Update last used timestamp
apiKeySchema.methods.updateLastUsed = function () {
    this.lastUsed = new Date();
    this.usageCount += 1;
    return this.save();
};

module.exports = mongoose.model('ApiKey', apiKeySchema);