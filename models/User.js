const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please enter your name'],
        trim: true,
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Please enter your email'],
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Please enter a password'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    avatar: {
        type: String,
        default: 'default-avatar.png'
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    // OTP Fields
    otp: String,
    otpExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    lastLogin: Date,
    loginCount: {
        type: Number,
        default: 0
    },
    uploadsThisMonth: {
        type: Number,
        default: 0
    },
    monthlyResetDate: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return;

    this.password = await bcrypt.hash(this.password, 10);
});

// Update monthly upload count reset
userSchema.pre('save', function (next) {
    const now = new Date();
    const lastReset = new Date(this.monthlyResetDate);

    // Check if a month has passed since last reset
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        this.uploadsThisMonth = 0;
        this.monthlyResetDate = now;
    }

    this.updatedAt = now;
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Check if user can upload more files
userSchema.methods.canUpload = function () {
    return this.uploadsThisMonth < process.env.UPLOAD_LIMIT_PER_MONTH;
};

// Generate OTP
userSchema.methods.generateOTP = function () {
    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.otp = otp;
    this.otpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    return otp;
};

module.exports = mongoose.model('User', userSchema);