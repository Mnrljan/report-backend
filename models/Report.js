// backend/models/Report.js (REVISI)

const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reportNumberManual: { type: String, required: true },
    serviceId: { type: String, required: true },
    serviceName: { type: String, required: true },

    // A. DATA UMUM 
    // HILANGKAN FIELD 'type'
    namaPemilik: { type: String },         
    alamat: { type: String },              
    namaKontraktor: { type: String },      
    lokasiPemeriksaan: { type: String },   
    instalasiPemasangan: { type: String }, 
    jenis: { type: String },               
    // <<< FIELD 'type' DIHILANGKAN DARI SINI >>>
    instalasi: { type: String },           
    suratPenunjukan: { type: String },     
    pengesahanGambar: { type: String },    
    noSuket: { type: String },             
    
    expertName: { type: String, default: 'Muhammad Rifki Fauzan, S.T.' }, 
    expertCertNo: { type: String, default: '5/22610/AS.01.04/XI/2024' },

    status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'COMPLETED'], default: 'DRAFT' },
    inspectionDate: { type: Date, required: true },
    submissionDate: { type: Date }, 

    formData: { type: mongoose.Schema.Types.Mixed, default: {} },

    // <<< FIELD 'photos' DIHILANGKAN DARI SINI >>>
    
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);