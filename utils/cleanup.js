const fs = require('fs');
const path = require('path');
const { CONFIG } = require('../config');

// Auto-cleanup function untuk menghapus media lama
function cleanupOldMedia() {
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 jam dalam milliseconds
    const now = Date.now();
    
    try {
        const files = fs.readdirSync(CONFIG.MEDIA_FOLDER);
        let deletedCount = 0;
        let savedSpace = 0;
        
        files.forEach(file => {
            // Skip file yang tidak boleh dihapus
            if (file === 'qrcode.png' || file.startsWith('temp_')) return;
            
            const filePath = path.join(CONFIG.MEDIA_FOLDER, file);
            
            try {
                const stats = fs.statSync(filePath);
                const age = now - stats.mtime.getTime();
                
                if (age > MAX_AGE) {
                    const fileSize = stats.size;
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    savedSpace += fileSize;
                }
            } catch (err) {
                // Skip file yang tidak bisa di-stat/unlink
            }
        });
        
        if (deletedCount > 0) {
            const savedMB = (savedSpace / 1024 / 1024).toFixed(2);
            console.log(`🗑️ Auto-cleanup: Deleted ${deletedCount} old files, saved ${savedMB} MB`);
        }
    } catch (err) {
        console.error('❌ Error during media cleanup:', err.message);
    }
}

// Initialize cleanup
function initCleanup() {
    console.log('🧹 Initializing media auto-cleanup (deletes files older than 24h)...');
    cleanupOldMedia();
    
    // Jalankan cleanup setiap jam
    setInterval(cleanupOldMedia, 60 * 60 * 1000);
}

module.exports = {
    cleanupOldMedia,
    initCleanup
};
