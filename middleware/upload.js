const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDirs = ['uploads/images', 'uploads/videos', 'uploads/documents', 'uploads/others'];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedImageTypes = /jpeg|jpg|png|gif|webp|bmp|svg/;
    const allowedVideoTypes = /mp4|webm|ogg|mov|avi|mkv/;
    const allowedDocumentTypes = /pdf|doc|docx|ppt|pptx|xls|xlsx|txt|rtf|odt/;

    const extname = path.extname(file.originalname).toLowerCase().replace('.', '');

    if (allowedImageTypes.test(extname)) {
        file.fileType = 'image';
        cb(null, true);
    } else if (allowedVideoTypes.test(extname)) {
        file.fileType = 'video';
        cb(null, true);
    } else if (allowedDocumentTypes.test(extname)) {
        file.fileType = 'document';
        cb(null, true);
    } else {
        file.fileType = 'other';
        cb(null, true);
        // Or reject: cb(new Error('File type not allowed'), false);
    }
};

// Storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folder = 'uploads/others';

        if (file.fileType === 'image') folder = 'uploads/images';
        else if (file.fileType === 'video') folder = 'uploads/videos';
        else if (file.fileType === 'document') folder = 'uploads/documents';

        cb(null, folder);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// Create upload middleware
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600 // 100MB default
    }
});

module.exports = upload;