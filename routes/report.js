// backend/routes/report.js

const express = require('express');
const Report = require('../models/Report'); // Import Model yang sudah jadi
const { protect, admin } = require('../middleware/authMiddleware'); 
// const { upload } = require('../middleware/uploadMiddleware'); 
// const cloudinary = require('../config/cloudinaryConfig'); 
const router = express.Router();

// Import untuk Route Download
const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const ImageModule = require('docxtemplater-image-module'); 
const fetch = require('node-fetch');

const imageOpts = {
    centered: false,
    getImage: function(tagValue) {
        if (!tagValue || !tagValue.url) {
            return Promise.resolve(null);
        }
        return fetch(tagValue.url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch image: ${response.statusText}`);
                }
                return response.buffer();
            });
    },
    getSize: function(img, tagValue) {
        return [tagValue.width || 400, tagValue.height || 300]; 
    }
};

// Helper untuk konversi angka ke Romawi
const toRoman = (num) => {
    if (isNaN(num)) return '';
    const lookup = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
    let roman = '', i;
    for (i in lookup) {
        while (num >= lookup[i]) {
            roman += i;
            num -= lookup[i];
        }
    }
    return roman;
};

const modules = [new ImageModule(imageOpts)];

// @route DELETE /api/reports/all
// @desc Admin menghapus SEMUA laporan
// @access Private/Admin
router.delete('/all', protect, admin, async (req, res) => {
    try {
        const result = await Report.deleteMany({}); 
        res.status(200).json({ 
            message: `${result.deletedCount} laporan berhasil dihapus.`,
            deletedCount: result.deletedCount 
        });
    } catch (error) {
        console.error('Delete All Reports Error:', error);
        res.status(500).json({ message: 'Gagal menghapus semua laporan.' });
    }
});

// @route POST /api/reports
// @desc Admin membuat laporan baru (tahap awal)
// @access Private/Admin
router.post('/', protect, admin, async (req, res) => {
    const { 
        serviceId, serviceName, inspectionDate, reportNumberManual,
        // GANTI NAMA FIELD DI SINI AGAR SAMA PERSIS DENGAN PAYLOAD DARI FRONT-END
        ownerName, address, contractorName, location, installerName, // <<-- Dari payload
        jenis, instalasi, appointmentLetter, drawingApproval, noSukeD // <<-- Dari payload
    } = req.body;

    // VALIDASI DASAR
    if (!serviceId || !serviceName || !inspectionDate) {
        return res.status(400).json({ message: 'Service ID, Nama Layanan, dan Tanggal Inspeksi wajib diisi.' });
    }

    try {
        
        const newReport = new Report({
            reportNumberManual,
            serviceId,
            serviceName,
            inspectionDate,
            
            // MAP KEY FRONT-END ke FIELD MODEL MONGOOSE
            namaPemilik: ownerName, // <== MAPPING: ownerName (FE) -> namaPemilik (Model)
            alamat: address,
            namaKontraktor: contractorName,
            lokasiPemeriksaan: location,
            instalasiPemasangan: installerName,
            jenis: jenis,
            instalasi: instalasi,
            suratPenunjukan: appointmentLetter,
            pengesahanGambar: drawingApproval,
            noSuket: noSukeD,
            
            status: 'DRAFT', 
        });

        const createdReport = await newReport.save();
        
        // Buat tautan unik untuk Inspektur
        const inspectorLink = `${req.protocol}://${req.get('host')}/reports/${createdReport._id}`;
        
        res.status(201).json({
            message: 'Laporan baru berhasil dibuat. Kirim tautan ini ke Inspektur.',
            report: createdReport,
            inspectorLink: inspectorLink,
        });

    } catch (error) {
        // Logging error yang membantu
        console.error('SERVER ERROR (POST /api/reports):', error); 
        res.status(500).json({ message: 'Gagal membuat laporan.', error: error.message });
    }
});


// @route GET /api/reports?page=...&limit=...
// @desc Mengambil semua laporan dengan paginasi (Default: 10 per halaman)
// @access Private/Admin
router.get('/', protect, admin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        const startIndex = (page - 1) * limit;
        
        // Dapatkan total dokumen untuk Paginasi
        const totalReports = await Report.countDocuments();
        const totalPages = Math.ceil(totalReports / limit);

        // Ambil data laporan sesuai paginasi, diurutkan berdasarkan tanggal terbaru
        const reports = await Report.find({})
            .sort({ createdAt: -1 }) // Urutkan dari yang terbaru
            .limit(limit)
            .skip(startIndex);

        // Kirim data laporan beserta metadata paginasi
        res.json({
            reports,
            currentPage: page,
            totalPages: totalPages,
            totalReports: totalReports
        });

    } catch (error) {
        console.error('Get Reports Error:', error);
        res.status(500).json({ message: 'Gagal mengambil data laporan.' });
    }
});


// @route GET /api/reports/:id
// @desc Admin/Inspektur melihat detail laporan
// @access Public (untuk Inspektur)
router.get('/:id', async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);

        if (!report) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan.' });
        }
        res.status(200).json(report);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil detail laporan.', error: error.message });
    }
});


// @route PUT/PATCH /api/reports/:id
// @desc Inspektur mengirim data dan gambar laporan
// @access Public (melalui tautan unik)
router.patch('/:id', async (req, res) => {
    const reportId = req.params.id;
    const formData = req.body.formData || {};

    try {
        let report = await Report.findById(reportId);

        if (!report) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan.' });
        }

        report.formData = formData;
        report.status = 'SUBMITTED';
        report.submissionDate = new Date();

        const updatedReport = await report.save();
        
        res.status(200).json({ message: 'Laporan berhasil dikirim dan disubmit!', report: updatedReport });

    } catch (error) {
        console.error('Upload or Update Error:', error);
        res.status(500).json({ message: 'Gagal memproses laporan Inspektur.', error: error.message });
    }
});


// @route GET /api/reports/download/:id
// @desc Admin mengunduh laporan Word
// @access Private/Admin
router.get('/download/:id', protect, admin, async (req, res) => {
    const reportId = req.params.id;

    try {
        const report = await Report.findById(reportId);

        if (!report) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan.' });
        }
        
        // 1. Baca Template Laporan Word
        const templatePath = path.resolve(__dirname, '..', 'templates', 'template-laporan.docx');
        const content = fs.readFileSync(templatePath, 'binary');
        
        const today = new Date();
        const inspectionDate = report.inspectionDate;
        
        // 1. Hitung Tanggal Pemeriksaan Kembali (2 tahun)
        const nextInspectionDate = new Date(inspectionDate);
        nextInspectionDate.setFullYear(inspectionDate.getFullYear() + 2);
        
        // 2. Tentukan Kode Layanan dan Bulan Romawi
        const reportMonth = today.getMonth() + 1;
        const romanMonth = toRoman(reportMonth);
        // DEFINISIKAN SERVICE CODE DI SINI
        const serviceCode = 'IPP';

        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        const finalFormData = {};
        for (const key in report.formData) {
            if (report.formData.hasOwnProperty(key)) {
                // Jika nilai string kosong, null, atau undefined, ganti dengan 'N/A'
                finalFormData[key] = report.formData[key] || 'N/A';
            }
        }

        // 2. Siapkan Data untuk Diisi
        const dataToFill = {
            // KOREKSI UTAMA: Tambahkan field halaman sampul/kop surat
            NamaPerusahaan: report.namaPemilik || 'N/A', // Asumsi: NamaPerusahaan di cover sama dengan NamaPemilik
            AlamatPerusahaan: report.alamat || 'N/A',   // Asumsi: AlamatPerusahaan di cover sama dengan Alamat
            
            // --- A. DATA UMUM (Mapping yang sudah ada) ---
            NomorLaporan: report.reportNumberManual || 'N/A', // Cth: 055
            BulanLaporan: romanMonth,                       // Cth: X
            ServiceCode: serviceCode,
            TanggalPemeriksaan: new Date(inspectionDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
            TahunLaporan: new Date(inspectionDate).getFullYear(),

            NamaPemilik: report.namaPemilik || 'N/A',
            Alamat: report.alamat || 'N/A',
            NamaKontraktor: report.namaKontraktor || 'N/A',
            LokasiPemeriksaan: report.lokasiPemeriksaan || 'N/A',
            InstalatirPemasangan: report.instalasiPemasangan || 'N/A',
            Jenis: report.jenis || 'N/A',
            Instalasi: report.instalasi || 'N/A',
            SuratPenunjukan: report.suratPenunjukan || 'N/A',
            PengesahanGambar: report.pengesahanGambar || 'N/A',
            NoSuket: report.noSuket || 'N/A',
            
            NamaAhli: report.expertName, 
            NomorSertifikat: report.expertCertNo,

            // ... (sertakan report.toObject() jika Anda memiliki placeholder umum lainnya)
            // ...report.toObject(), 

            // --- C. DATA TEKNIS (AKAN DITAMBAHKAN DI BAGIAN BERIKUTNYA) ---
            ...finalFormData,

            // --- E. SARAN ---
            TanggalPemeriksaanKembali: nextInspectionDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
            TanggalLaporan: today.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }), // Tanggal saat laporan dibuat/diunduh

            ProsesPemeriksaanSatu: 'GAMBAR DIINPUT MANUAL OLEH ADMIN',
        };
        
        // 3. Isi Placeholder
        let buf;

        try {
            doc.setData(dataToFill);
            doc.render();
            
            // 4. Hasilkan File dan Simpan ke 'buf'
            buf = doc.getZip().generate({ // Hapus 'const' karena sudah dideklarasikan di luar 'try'
                type: 'nodebuffer',
                compression: 'DEFLATE',
            });
            
        } catch (error) {
            console.error('Docxtemplater rendering error:', JSON.stringify({ error: error }, replaceErrors));
            return res.status(500).json({ message: 'Gagal mengisi template laporan.' });
        }
        
        // --- LOGIKA PENGIRIMAN FILE (SEKARANG BERJALAN DI LUAR CATCH DOCXTEMPLATER) ---
        
        // 5. Penamaan File
        // Pastikan variabel 'report' memiliki properti yang benar
        const reportNum = report.reportNumberManual || 'N_A'; 
        const safeReportNum = reportNum.toString().replace(/\//g, '-'); 

        const fileName = `Laporan-${safeReportNum}-${report.serviceId}.docx`;

        // 6. Kirim sebagai Unduhan
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(buf); // <<-- 'buf' SEKARANG DIKENAL DI SINI

        } catch (error) {
            console.error('Download Report Error:', error);
            res.status(500).json({ message: 'Server error saat memproses unduhan.' });
        }
});

// @route DELETE /api/reports/:id
// @desc Admin menghapus laporan
// @access Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
    const reportId = req.params.id;

    try {
        const report = await Report.findById(reportId);

        if (!report) {
            return res.status(404).json({ message: 'Laporan tidak ditemukan.' });
        }

        await report.deleteOne(); 
        
        res.status(200).json({ message: 'Laporan berhasil dihapus.' });
    } catch (error) {
        console.error('Delete Report Error:', error);
        // Biarkan 500 karena CastError sudah terjadi
        res.status(500).json({ message: 'Gagal menghapus laporan.' });
    }
});

// Helper untuk log error Docxtemplater
function replaceErrors(key, value) {
    if (value instanceof Error) {
        return Object.getOwnPropertyNames(value).reduce(function(error, name) {
            error[name] = value[name];
            return error;
        }, {});
    }
    return value;
}

module.exports = router;