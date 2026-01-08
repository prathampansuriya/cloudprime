const User = require('../models/User');
const Upload = require('../models/Upload');
const ApiKey = require('../models/ApiKey');
const Contact = require('../models/Contact');
const AdminLog = require('../models/AdminLog');
const { generateStats } = require('../utils/helpers');

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
    try {
        const [
            usersStats,
            uploadsStats,
            apiKeysStats,
            contactsStats,
            recentUsers,
            recentUploads,
            storageUsage
        ] = await Promise.all([
            generateStats(User),
            generateStats(Upload),
            generateStats(ApiKey),
            generateStats(Contact),
            User.find().sort({ createdAt: -1 }).limit(5).select('name email role createdAt'),
            Upload.find().sort({ uploadedAt: -1 }).limit(10).populate('user', 'name email'),
            Upload.aggregate([
                {
                    $group: {
                        _id: null,
                        totalSize: { $sum: '$fileSize' }
                    }
                }
            ])
        ]);

        // Get users by role
        const usersByRole = await User.aggregate([
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get uploads by type
        const uploadsByType = await Upload.aggregate([
            {
                $group: {
                    _id: '$fileType',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get daily uploads for last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const dailyUploads = await Upload.aggregate([
            {
                $match: {
                    uploadedAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$uploadedAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    users: usersStats,
                    uploads: uploadsStats,
                    apiKeys: apiKeysStats,
                    contacts: contactsStats,
                    storageUsage: storageUsage[0]?.totalSize || 0
                },
                charts: {
                    usersByRole,
                    uploadsByType,
                    dailyUploads
                },
                recent: {
                    users: recentUsers,
                    uploads: recentUploads
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const users = await User.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('-password');

        const total = await User.countDocuments();

        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
exports.updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid role'
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Prevent self-demotion
        if (user._id.toString() === req.user.id && role === 'user') {
            return res.status(400).json({
                success: false,
                error: 'Cannot change your own role to user'
            });
        }

        user.role = role;
        await user.save();

        // Log the action
        await AdminLog.create({
            admin: req.user.id,
            action: 'UPDATE_ROLE',
            resource: 'User',
            resourceId: user._id,
            details: { oldRole: user.role, newRole: role },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: `User role updated to ${role}`,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Prevent self-deletion
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete your own account'
            });
        }

        // Delete user's uploads and API keys
        await Promise.all([
            Upload.deleteMany({ user: user._id }),
            ApiKey.deleteMany({ user: user._id })
        ]);

        await user.deleteOne();

        // Log the action
        await AdminLog.create({
            admin: req.user.id,
            action: 'DELETE',
            resource: 'User',
            resourceId: user._id,
            details: { email: user.email },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get all uploads (admin)
// @route   GET /api/admin/uploads
// @access  Private/Admin
exports.getAllUploads = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const uploads = await Upload.find()
            .sort({ uploadedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'name email')
            .populate('apiKeyUsed', 'name');

        const total = await Upload.countDocuments();

        res.status(200).json({
            success: true,
            data: uploads,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Delete upload (admin)
// @route   DELETE /api/admin/uploads/:id
// @access  Private/Admin
exports.adminDeleteUpload = async (req, res) => {
    try {
        const upload = await Upload.findById(req.params.id)
            .populate('user');

        if (!upload) {
            return res.status(404).json({
                success: false,
                error: 'Upload not found'
            });
        }

        // Delete file from filesystem
        const fs = require('fs');
        if (fs.existsSync(upload.filePath)) {
            fs.unlinkSync(upload.filePath);
        }

        // Decrease user's upload count
        if (upload.user) {
            const user = await User.findById(upload.user._id);
            if (user.uploadsThisMonth > 0) {
                user.uploadsThisMonth -= 1;
                await user.save();
            }
        }

        await upload.deleteOne();

        // Log the action
        await AdminLog.create({
            admin: req.user.id,
            action: 'DELETE',
            resource: 'Upload',
            resourceId: upload._id,
            details: { fileName: upload.fileName, user: upload.user?.email },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Upload deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get all API keys (admin)
// @route   GET /api/admin/api-keys
// @access  Private/Admin
exports.getAllApiKeys = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const apiKeys = await ApiKey.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'name email');

        const total = await ApiKey.countDocuments();

        res.status(200).json({
            success: true,
            data: apiKeys,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get all contacts
// @route   GET /api/admin/contacts
// @access  Private/Admin
exports.getAllContacts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const contacts = await Contact.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Contact.countDocuments();

        res.status(200).json({
            success: true,
            data: contacts,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Update contact status
// @route   PUT /api/admin/contacts/:id/status
// @access  Private/Admin
exports.updateContactStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!['new', 'read', 'replied', 'closed'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status'
            });
        }

        const contact = await Contact.findById(req.params.id);

        if (!contact) {
            return res.status(404).json({
                success: false,
                error: 'Contact message not found'
            });
        }

        contact.status = status;

        if (status === 'replied') {
            contact.repliedAt = new Date();
            contact.repliedBy = req.user.id;
        }

        await contact.save();

        res.status(200).json({
            success: true,
            message: `Contact status updated to ${status}`,
            data: contact
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Get admin logs
// @route   GET /api/admin/logs
// @access  Private/Admin
exports.getAdminLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const logs = await AdminLog.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('admin', 'name email')
            .populate('resourceId');

        const total = await AdminLog.countDocuments();

        res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};