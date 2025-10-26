// backend/routes/auth.js

const express = require('express');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const router = express.Router();

// @route POST /api/auth/register
// @desc Registrasi user baru (Admin/Inspektur)
// @access Public (Biasanya ini hanya diakses sekali atau oleh Super Admin)
router.post('/register', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ message: 'Username, password, dan role wajib diisi.' });
    }
    
    // Pastikan role yang dimasukkan valid
    if (role !== 'Admin' && role !== 'Inspektur') {
        return res.status(400).json({ message: 'Role harus Admin atau Inspektur.' });
    }

    try {
        // 1. Cek apakah user sudah ada
        const userExists = await User.findOne({ username });

        if (userExists) {
            return res.status(400).json({ message: 'Username sudah terdaftar.' });
        }

        // 2. Buat user baru. Hashing password terjadi secara otomatis di Model User (pre('save')).
        const user = await User.create({
            username,
            password,
            role,
        });

        // 3. Jika berhasil, kirim data user dan token
        if (user) {
            res.status(201).json({
                _id: user._id,
                username: user.username,
                role: user.role,
                token: generateToken(user._id),
                message: 'Registrasi berhasil!'
            });
        }

    } catch (error) {
        res.status(500).json({ message: 'Gagal melakukan registrasi.', error: error.message });
    }
});

// @route POST /api/auth/login
// @desc Login Admin
// @access Public
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // 1. Cek User
    const user = await User.findOne({ username });

    if (user && user.role === 'Admin' && (await user.matchPassword(password))) {
        // 2. Jika sukses, kirim data user dan token
        res.json({
            _id: user._id,
            username: user.username,
            role: user.role,
            token: generateToken(user._id),
        });
    } else {
        // 3. Gagal login
        res.status(401).json({ message: 'Invalid credentials or not authorized as Admin' });
    }
});

module.exports = router;