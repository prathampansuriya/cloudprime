const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const { generateToken, generateResetToken } = require('../utils/generateToken');
const { sendVerificationOTP, sendPasswordResetEmail } = require('../utils/emailService');
const crypto = require('crypto');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                error: 'User already exists'
            });
        }

        // Create user with unverified status
        const user = await User.create({
            name,
            email,
            password
        });

        // Generate and send OTP
        const otp = user.generateOTP();
        await user.save();

        await sendVerificationOTP(user, otp);

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email for OTP verification.',
            userId: user._id,
            email: user.email
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({
            email,
            otp,
            otpExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired OTP'
            });
        }

        // Mark user as verified
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpire = undefined;
        await user.save();

        // Generate token for immediate login
        const token = generateToken(user._id);

        // Set cookie
        res.cookie('token', token, {
            expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production'
        });

        res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                error: 'User already verified'
            });
        }

        // Generate new OTP
        const otp = user.generateOTP();
        await user.save();

        await sendVerificationOTP(user, otp);

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('Login attempt for email:', email);

        // Check if user exists
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            console.log('User not found:', email);
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        console.log('User found:', user.email);

        // Check if password matches
        const isMatch = await user.comparePassword(password);
        console.log('Password match:', isMatch);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Check if email is verified
        if (!user.isVerified) {
            // Generate and send new OTP if not verified
            const otp = user.generateOTP();
            await user.save();
            await sendVerificationOTP(user, otp);

            return res.status(401).json({
                success: false,
                error: 'Please verify your email first. A new OTP has been sent to your email.',
                requiresVerification: true,
                email: user.email
            });
        }

        // Update login info
        user.lastLogin = Date.now();
        user.loginCount += 1;
        await user.save();

        // Generate token
        const token = generateToken(user._id);
        console.log('Generated token for user:', user.email);

        // Set cookie
        res.cookie('token', token, {
            expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        // Return user data without password
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            isVerified: user.isVerified,
            uploadsThisMonth: user.uploadsThisMonth,
            monthlyResetDate: user.monthlyResetDate,
            createdAt: user.createdAt
        };

        console.log('Login successful for:', user.email);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: userResponse
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Generate reset token
        const { resetToken, hashedToken } = generateResetToken();

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
        await user.save();

        // Send reset email
        await sendPasswordResetEmail(user, resetToken);

        res.status(200).json({
            success: true,
            message: 'Password reset email sent'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        // Hash the token
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired reset token'
            });
        }

        // Update password
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        console.log('Get me called for user:', req.user ? req.user.email : 'No user');

        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Get API keys
        const apiKeys = await ApiKey.find({ user: req.user.id });

        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            isVerified: user.isVerified,
            uploadsThisMonth: user.uploadsThisMonth,
            monthlyResetDate: user.monthlyResetDate,
            createdAt: user.createdAt
        };

        res.status(200).json({
            success: true,
            user: userResponse,
            apiKeys
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Update profile
// @route   PUT /api/auth/update-profile
// @access  Private
exports.updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;

        const user = await User.findById(req.user.id);

        if (email && email !== user.email) {
            // Check if email is already taken
            const emailExists = await User.findOne({
                email,
                _id: { $ne: req.user.id }
            });

            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    error: 'Email already in use'
                });
            }

            user.email = email;
            user.isVerified = false;

            // Generate OTP for new email verification
            const otp = user.generateOTP();

            // Send verification OTP
            await sendVerificationOTP(user, otp);
        }

        if (name) {
            user.name = name;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: email && email !== user.email ?
                'Profile updated. Please verify your new email with the OTP sent.' :
                'Profile updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Logout user
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
    try {
        res.cookie('token', 'none', {
            expires: new Date(Date.now() + 10 * 1000),
            httpOnly: true
        });

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};