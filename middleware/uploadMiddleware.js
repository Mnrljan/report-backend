// backend/middleware/uploadMiddleware.js

const multer = require('multer');

// Gunakan memory storage agar file dipegang di memori (buffer) sebelum diupload ke Cloudinary
const storage = multer.memoryStorage(); 

// Middleware utama Multer
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Batasan 10MB per file
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file gambar yang diizinkan!'), false);
        }
    }
});

module.exports = { upload };