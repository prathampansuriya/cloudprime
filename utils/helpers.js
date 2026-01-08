const path = require('path');
const fs = require('fs');
const moment = require('moment');

const getFileType = (filename) => {
    const ext = path.extname(filename).toLowerCase().replace('.', '');

    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const videoTypes = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
    const documentTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'rtf', 'odt'];

    if (imageTypes.includes(ext)) return 'image';
    if (videoTypes.includes(ext)) return 'video';
    if (documentTypes.includes(ext)) return 'document';
    return 'other';
};

// utils/helpers.js
const formatFileSize = (bytes) => {
    // Convert to number if it's a string
    const numBytes = Number(bytes);

    // Check if it's a valid number
    if (isNaN(numBytes) || numBytes === 0) {
        return '0 Bytes';
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(numBytes) / Math.log(k));

    return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getPublicUrl = (filePath) => {
    // For production, use relative path from uploads directory
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Extract the path after 'uploads' folder
    const uploadsIndex = normalizedPath.indexOf('uploads/');

    // Debug logging
    console.log('Generating public URL:');
    console.log('Original path:', filePath);
    console.log('Normalized path:', normalizedPath);
    console.log('Uploads index:', uploadsIndex);

    if (uploadsIndex !== -1) {
        const relativePath = normalizedPath.substring(uploadsIndex + 7); // +7 to skip 'uploads/'

        // Remove any leading slash from relativePath
        const cleanRelativePath = relativePath.replace(/^\//, '');

        const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

        // Ensure no double slashes
        const backendUrlClean = backendUrl.replace(/\/$/, ''); // Remove trailing slash if exists

        const url = `${backendUrlClean}/api/uploads/${cleanRelativePath}`;

        console.log('Generated URL:', url);
        return url;
    }

    // Fallback - try to extract filename
    const filename = path.basename(normalizedPath);
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const backendUrlClean = backendUrl.replace(/\/$/, ''); // Remove trailing slash

    // Check which folder the file might be in
    let folder = 'images'; // Default
    if (normalizedPath.includes('/videos/')) folder = 'videos';
    else if (normalizedPath.includes('/documents/')) folder = 'documents';
    else if (normalizedPath.includes('/others/')) folder = 'others';

    const url = `${backendUrlClean}/api/uploads/${folder}/${filename}`;

    console.log('Fallback URL:', url);
    return url;
};

const deleteFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.unlink(filePath, (err) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    resolve(true); // File doesn't exist
                } else {
                    reject(err);
                }
            } else {
                resolve(true);
            }
        });
    });
};

const generateStats = async (model, filters = {}) => {
    const today = moment().startOf('day');
    const weekAgo = moment().subtract(7, 'days').startOf('day');
    const monthAgo = moment().subtract(30, 'days').startOf('day');

    const total = await model.countDocuments(filters);
    const todayCount = await model.countDocuments({
        ...filters,
        createdAt: { $gte: today.toDate() }
    });
    const weekCount = await model.countDocuments({
        ...filters,
        createdAt: { $gte: weekAgo.toDate() }
    });
    const monthCount = await model.countDocuments({
        ...filters,
        createdAt: { $gte: monthAgo.toDate() }
    });

    return { total, todayCount, weekCount, monthCount };
};

module.exports = {
    getFileType,
    formatFileSize,
    getPublicUrl,
    deleteFile,
    generateStats
};