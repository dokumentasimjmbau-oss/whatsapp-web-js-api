const fs = require('fs');
const path = require('path');

// Gunakan absolute path agar aman di Railway maupun lokal
const MEDIA_FOLDER = path.join(__dirname, '..', 'media');

// File yang tidak boleh dihapus apapun kondisinya
const PROTECTED_FILES = ['qrcode.png', '.gitkeep', '.gitignore'];

// Maksimal umur file sebelum dihapus: 24 jam
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Interval cleanup: setiap 24 jam
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Hapus file media yang sudah lebih dari 24 jam.
 * Dipanggil sekali saat server start, lalu otomatis setiap 24 jam.
 */
function cleanupOldMedia() {
    const now = Date.now();
    const startTime = new Date().toISOString();
    console.log(`\n🧹 [${startTime}] Memulai auto-cleanup folder /media...`);

    // Pastikan folder ada sebelum dibaca
    if (!fs.existsSync(MEDIA_FOLDER)) {
        console.log('ℹ️  Folder /media belum ada, cleanup dilewati.');
        return;
    }

    try {
        const files = fs.readdirSync(MEDIA_FOLDER);
        let deletedCount = 0;
        let skippedCount = 0;
        let savedBytes = 0;
        let keptCount = 0;

        files.forEach(file => {
            // Skip file yang dilindungi
            if (PROTECTED_FILES.includes(file)) {
                skippedCount++;
                return;
            }

            const filePath = path.join(MEDIA_FOLDER, file);

            try {
                const stats = fs.statSync(filePath);

                // Skip jika bukan file biasa (folder, symlink, dll)
                if (!stats.isFile()) {
                    skippedCount++;
                    return;
                }

                const ageMs = now - stats.mtimeMs;

                if (ageMs > MAX_AGE_MS) {
                    savedBytes += stats.size;
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    console.log(`   🗑️  Dihapus: ${file} (umur: ${Math.round(ageMs / 3600000)}j)`);
                } else {
                    keptCount++;
                }
            } catch (fileErr) {
                console.warn(`   ⚠️  Gagal proses file ${file}: ${fileErr.message}`);
            }
        });

        const savedMB = (savedBytes / 1024 / 1024).toFixed(2);
        console.log(`✅ Cleanup selesai: ${deletedCount} dihapus (${savedMB} MB), ${keptCount} dipertahankan, ${skippedCount} dilewati.`);
        console.log(`⏰ Cleanup berikutnya dalam 24 jam.\n`);

    } catch (err) {
        console.error(`❌ Error saat cleanup /media: ${err.message}`);
    }
}

/**
 * Inisialisasi cleanup saat server start.
 * - Jalankan cleanup pertama kali saat boot
 * - Jadwalkan cleanup otomatis setiap 24 jam
 */
function initCleanup() {
    console.log('🧹 Media auto-cleanup aktif: file > 24 jam akan dihapus setiap 24 jam.');
    console.log(`📁 Target folder: ${MEDIA_FOLDER}`);

    // Pastikan folder media ada sejak awal
    if (!fs.existsSync(MEDIA_FOLDER)) {
        fs.mkdirSync(MEDIA_FOLDER, { recursive: true });
        console.log('📁 Folder /media dibuat otomatis.');
    }

    // Jalankan cleanup pertama saat server start
    cleanupOldMedia();

    // Jadwalkan setiap 24 jam
    setInterval(cleanupOldMedia, CLEANUP_INTERVAL_MS);
}

/**
 * Fungsi utilitas: kembalikan info folder media saat ini
 * (total file, total ukuran)
 */
function getMediaFolderStats() {
    if (!fs.existsSync(MEDIA_FOLDER)) return { fileCount: 0, totalSizeBytes: 0, totalSizeMB: '0.00' };

    try {
        const files = fs.readdirSync(MEDIA_FOLDER);
        let totalBytes = 0;
        let fileCount = 0;

        files.forEach(file => {
            if (PROTECTED_FILES.includes(file)) return;
            const filePath = path.join(MEDIA_FOLDER, file);
            try {
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    totalBytes += stats.size;
                    fileCount++;
                }
            } catch (_) {}
        });

        return {
            fileCount,
            totalSizeBytes: totalBytes,
            totalSizeMB: (totalBytes / 1024 / 1024).toFixed(2)
        };
    } catch (err) {
        return { fileCount: 0, totalSizeBytes: 0, totalSizeMB: '0.00' };
    }
}

module.exports = {
    cleanupOldMedia,
    initCleanup,
    getMediaFolderStats,
    MEDIA_FOLDER
};
