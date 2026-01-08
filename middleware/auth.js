const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');

exports.protect = async (req, res, next) => {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    // Check for token in query string (for testing)
    else if (req.query && req.query.token) {
        token = req.query.token;
    }

    // If no token
    if (!token) {
        console.log('No token found in request');
        return res.status(401).json({
            success: false,
            error: 'Not authorized to access this route'
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded:', decoded);

        // Get user from database
        const user = await User.findById(decoded.id);

        if (!user) {
            console.log('User not found for ID:', decoded.id);
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if user is verified
        if (!user.isVerified) {
            return res.status(401).json({
                success: false,
                error: 'Please verify your email before accessing this route'
            });
        }

        // Attach user to request object
        req.user = user;
        console.log('User attached to request:', user.email);

        next();
    } catch (err) {
        console.error('JWT verification error:', err.message);

        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired'
            });
        }

        return res.status(401).json({
            success: false,
            error: 'Not authorized to access this route'
        });
    }
};

exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};

exports.apiKeyAuth = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: 'API key is required'
        });
    }

    try {
        const key = await ApiKey.findOne({
            key: apiKey,
            isActive: true,
            expiresAt: { $gt: new Date() }
        }).populate('user');

        if (!key) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired API key'
            });
        }

        req.apiKey = key;
        req.user = key.user;

        // Update last used
        await key.updateLastUsed();

        next();
    } catch (err) {
        console.error('API key auth error:', err);
        return res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
};