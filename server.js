const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs'); // Add this import

// Load env vars
dotenv.config();

// Route files
const auth = require('./routes/auth');
const upload = require('./routes/upload');
const api = require('./routes/api');
const admin = require('./routes/admin');
const contact = require('./routes/contact');

// Connect to database
const connectDB = require('./config/database');
connectDB();

// Create express app
const app = express();

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie parser
app.use(cookieParser());

// Security headers
app.use(helmet({
    contentSecurityPolicy: false,
}));

const allowedOrigins = [
    'http://localhost:3000',
    'https://cloudprime.netlify.app'
];

// CORS
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS not allowed'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Logging
app.use(morgan('dev'));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    if (req.method === 'POST' || req.method === 'PUT') {
        console.log('Body:', req.body);
    }
    next();
});


// Mount routers BEFORE static files
app.use('/api/auth', auth);
app.use('/api/uploads', upload); // This should come BEFORE static files
app.use('/api', api);
app.use('/api/admin', admin);
app.use('/api/contact', contact);


// Test endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);

    res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Server Error'
    });
});

// 404 handler
app.use((req, res) => {
    console.log('404 - Route not found:', req.originalUrl, 'Method:', req.method);
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    console.log(`Backend URL: ${process.env.BACKEND_URL || `http://localhost:${PORT}`}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    server.close(() => process.exit(1));
});