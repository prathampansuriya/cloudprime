const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const generateResetToken = () => {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    return { resetToken, hashedToken };
};

module.exports = {
    generateToken,
    generateVerificationToken,
    generateResetToken
};