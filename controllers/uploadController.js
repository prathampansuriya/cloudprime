
const Upload = require('../models/Upload');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const { getFileType, formatFileSize } = require('../utils/helpers');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

exports.uploadViaDashboard = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Please upload a file' });
        }

        const user = await User.findById(req.user.id);

        if (!user.canUpload()) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: `Monthly upload limit (${process.env.UPLOAD_LIMIT_PER_MONTH}) reached`
            });
        }

        // Create FormData for the Django API request
        const formData = new FormData();
        formData.append('image', fs.createReadStream(req.file.path), {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        // Send to Django API
        const djangoResponse = await axios.post(
            'https://imageserve.pythonanywhere.com/user/api/v2/upload-image/',
            formData,
            {
                headers: {
                    ...formData.getHeaders()
                }
            }
        );

        // Remove local temp file
        fs.unlinkSync(req.file.path);

        const djangoData = djangoResponse.data;
        const fileType = getFileType(req.file.originalname);

        const upload = await Upload.create({
            user: req.user.id,
            fileName: cloudinaryResult.public_id,
            originalName: req.file.originalname,
            fileType,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            filePath: req.file.path,
            publicUrl: djangoData.image_url || djangoData.image,
            uploadMethod: 'dashboard'
        });

        user.uploadsThisMonth += 1;
        await user.save();

        res.status(201).json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                id: upload._id,
                fileName: upload.fileName,
                originalName: upload.originalName,
                fileType: upload.fileType,
                fileSize: formatFileSize(upload.fileSize),
                mimeType: upload.mimeType,
                publicUrl: upload.publicUrl,
                uploadedAt: upload.uploadedAt
            }
        });

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.uploadViaApi = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'Please upload a file' });

        if (!req.user.canUpload()) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: `Monthly upload limit (${process.env.UPLOAD_LIMIT_PER_MONTH}) reached`
            });
        }

        // Create FormData for the Django API request
        const formData = new FormData();
        formData.append('image', fs.createReadStream(req.file.path), {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        // Send to Django API
        const djangoResponse = await axios.post(
            'https://imageserve.pythonanywhere.com/user/api/v2/upload-image/',
            formData,
            {
                headers: {
                    ...formData.getHeaders()
                }
            }
        );

        // Remove local temp file
        fs.unlinkSync(req.file.path);

        const djangoData = djangoResponse.data;
        const fileType = getFileType(req.file.originalname);

        const upload = await Upload.create({
            user: req.user.id,
            fileName: cloudinaryResult.public_id,
            originalName: req.file.originalname,
            fileType,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            filePath: req.file.path,
            publicUrl: djangoData.image_url || djangoData.image,
            uploadMethod: 'api',
            apiKeyUsed: req.apiKey._id
        });

        const user = await User.findById(req.user.id);
        user.uploadsThisMonth += 1;
        await user.save();

        res.status(201).json({
            success: true,
            message: 'File uploaded successfully via API',
            data: {
                id: upload._id,
                fileName: upload.fileName,
                originalName: upload.originalName,
                fileType: upload.fileType,
                fileSize: formatFileSize(upload.fileSize),
                mimeType: upload.mimeType,
                publicUrl: upload.publicUrl,
                uploadedAt: upload.uploadedAt,
                expiresAt: upload.expiresAt
            }
        });

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: error.message });
    }
};


// @desc    Get user uploads
// @route   GET /api/uploads
// @access  Private
exports.getUserUploads = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const uploads = await Upload.find({ user: req.user.id })
            .sort({ uploadedAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Upload.countDocuments({ user: req.user.id });

        // Format uploads
        const formattedUploads = uploads.map(upload => ({
            id: upload._id,
            fileName: upload.fileName,
            originalName: upload.originalName,
            fileType: upload.fileType,
            fileSize: formatFileSize(upload.fileSize), // Formatted size
            fileSizeBytes: upload.fileSize, // Add original bytes
            mimeType: upload.mimeType,
            publicUrl: upload.publicUrl,
            uploadedAt: upload.uploadedAt,
            expiresAt: upload.expiresAt,
            views: upload.views,
            downloads: upload.downloads,
            uploadMethod: upload.uploadMethod
        }));

        res.status(200).json({
            success: true,
            data: formattedUploads,
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

// @desc    Delete upload
// @route   DELETE /api/uploads/:id
// @access  Private
exports.deleteUpload = async (req, res) => {
    try {
        const upload = await Upload.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!upload) {
            return res.status(404).json({
                success: false,
                error: 'Upload not found'
            });
        }

        // Delete file from filesystem
        if (fs.existsSync(upload.filePath)) {
            fs.unlinkSync(upload.filePath);
        }

        // Delete from database
        await upload.deleteOne();

        // Decrease user's upload count
        const user = await User.findById(req.user.id);
        if (user.uploadsThisMonth > 0) {
            user.uploadsThisMonth -= 1;
            await user.save();
        }

        res.status(200).json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
