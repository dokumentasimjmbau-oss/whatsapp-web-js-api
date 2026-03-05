const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Konfigurasi
const CONFIG = {
    WEBHOOK_URL: 'https://cloud.activepieces.com/api/v1/webhooks/49mCt0eLl7F1pA7ey4dFH',
    MEDIA_FOLDER: './media',
    NGROK_URL: 'https://agaze-elizabeth-groovelike.ngrok-free.dev'
};

// Buat folder media jika belum ada
if (!fs.existsSync(CONFIG.MEDIA_FOLDER)) {
    fs.mkdirSync(CONFIG.MEDIA_FOLDER, { recursive: true });
}

// Inisialisasi client dengan LocalAuth untuk menyimpan session
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Event: QR Code
client.on('qr', (qr) => {
    console.log('🔍 Scan QR Code ini dengan WhatsApp Anda:');
    qrcode.generate(qr, { small: true });
});

// Event: Client Ready
client.on('ready', () => {
    console.log('✅ Client siap! WhatsApp Web berhasil terhubung.');
    console.log(`📁 Media akan disimpan di folder: ${CONFIG.MEDIA_FOLDER}`);
    console.log(`🔗 Webhook URL: ${CONFIG.WEBHOOK_URL}`);
});

// Event: Authenticated
client.on('authenticated', () => {
    console.log('🔐 Authenticated! Session tersimpan.');
});

// Event: Auth Failure
client.on('auth_failure', (msg) => {
    console.error('❌ Auth failure:', msg);
});

// Event: Disconnected
client.on('disconnected', (reason) => {
    console.log('⚠️ Client disconnected:', reason);
});

// Fungsi untuk download dan simpan media
async function downloadMedia(message) {
    try {
        if (!message.hasMedia) return null;

        const media = await message.downloadMedia();
        if (!media) return null;

        // Generate filename
        const timestamp = Date.now();
        const extension = media.mimetype.split('/')[1]?.split(';')[0] || 'bin';
        const filename = `${message.id.id}_${timestamp}.${extension}`;
        const filepath = path.join(CONFIG.MEDIA_FOLDER, filename);

        // Simpan file
        fs.writeFileSync(filepath, media.data, 'base64');
        console.log(`💾 Media disimpan: ${filepath}`);

        return {
            filename: filename,
            mimetype: media.mimetype,
            filepath: filepath,
            size: media.data.length
        };
    } catch (error) {
        console.error('❌ Error downloading media:', error);
        return null;
    }
}

// Fungsi untuk kirim webhook
async function sendWebhook(data) {
    try {
        const response = await axios.post(CONFIG.WEBHOOK_URL, data, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        console.log(`📤 Webhook terkirim! Status: ${response.status}`);
    } catch (error) {
        console.error('❌ Error sending webhook:', error.message);
    }
}

// Event: Message Create (Menerima pesan)
client.on('message_create', async (message) => {
    try {
        console.log(`📩 Pesan dari ${message.from}: ${message.body?.substring(0, 50)}...`);

        // Prepare webhook payload
        const payload = {
            event: 'message',
            timestamp: Date.now(),
            message: {
                id: message.id.id,
                from: message.from,
                to: message.to,
                body: message.body,
                type: message.type,
                timestamp: message.timestamp,
                hasMedia: message.hasMedia,
                author: message.author,
                deviceType: message.deviceType,
                isGroupMsg: message.from.includes('@g.us')
            }
        };

        // Jika ada media, download dan tambahkan ke payload
        if (message.hasMedia) {
            console.log('📎 Media terdeteksi, mendownload...');
            const mediaInfo = await downloadMedia(message);
            
            if (mediaInfo) {
                // Buat URL publik untuk media
                const mediaUrl = `${CONFIG.NGROK_URL}/media/${mediaInfo.filename}`;
                
                payload.message.media = {
                    url: mediaUrl,
                    filename: mediaInfo.filename,
                    mimetype: mediaInfo.mimetype,
                    size: mediaInfo.size,
                    localPath: mediaInfo.filepath
                };
                console.log(`🔗 Media URL: ${mediaUrl}`);
            }
        }

        // Kirim webhook
        await sendWebhook(payload);

    } catch (error) {
        console.error('❌ Error processing message:', error);
    }
});

// Event: Message Revoke (Pesan dihapus)
client.on('message_revoke_everyone', async (after, before) => {
    const payload = {
        event: 'message_revoke',
        timestamp: Date.now(),
        message: {
            id: after.id.id,
            from: after.from,
            body: after.body,
            revokedAt: Date.now()
        }
    };
    await sendWebhook(payload);
});

// Start client
console.log('🚀 Memulai WhatsApp Web Client...');
console.log('⏳ Menunggu QR Code...');
client.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Menutup client...');
    await client.destroy();
    process.exit(0);
});