// backend/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Asumsi library ini diinstal

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['Admin', 'Inspektur'], required: true, default: 'Admin' },
    // Di proyek ini, hanya Admin yang perlu login. Inspektur menggunakan tautan unik.
});

// Method untuk membandingkan password saat login
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Middleware untuk hash password sebelum disimpan
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);