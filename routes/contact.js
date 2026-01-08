const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');

// @desc    Send contact message
// @route   POST /api/contact
// @access  Public
router.post('/', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                error: 'Please provide all required fields'
            });
        }

        const contact = await Contact.create({
            name,
            email,
            subject,
            message,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: {
                id: contact._id,
                name: contact.name,
                email: contact.email,
                subject: contact.subject,
                createdAt: contact.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;