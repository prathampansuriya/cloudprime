const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// Protect all admin routes
router.use(protect);
router.use(authorize('admin'));

// Dashboard stats
router.get('/stats', adminController.getDashboardStats);

// User management
router.get('/users', adminController.getAllUsers);
router.put('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);

// Upload management
router.get('/uploads', adminController.getAllUploads);
router.delete('/uploads/:id', adminController.adminDeleteUpload);

// API Key management
router.get('/api-keys', adminController.getAllApiKeys);

// Contact management
router.get('/contacts', adminController.getAllContacts);
router.put('/contacts/:id/status', adminController.updateContactStatus);

// Admin logs
router.get('/logs', adminController.getAdminLogs);

module.exports = router;