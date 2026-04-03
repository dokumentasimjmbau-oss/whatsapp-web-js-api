const express = require('express');
const session = require('express-session');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Load configuration
const { CONFIG, getChromeExecutablePath, getBaseURL } = require('./config');

// Load routes
const publicRoutes = require('./routes/public');
const apiRoutes = require('./routes/api');
const { router: adminRoutes, updateQRData } = require('./routes/admin');

// Load utilities
const { initCleanup } = require('./utils/cleanup');
const { sendWebhook, getConfig: getWebhookConfig } = require('./utils/webhook');

// Initialize Express app
const app = express();

// Parse JSON body
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve media folder as static files (untuk akses URL media)
app.use('/media', express.static(path.join(__dirname, 'media')));

// Enable CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Session middleware for admin dashboard
app.use(session({
    secret: CONFIG.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Create media folder if not exists
if (!fs.existsSync(CONFIG.MEDIA_FOLDER)) {
    fs.mkdirSync(CONFIG.MEDIA_FOLDER, { recursive: true });
}

// Initialize cleanup
initCleanup();

// Chrome configuration for video support
const chromePath = process.env.CHROME_PATH || getChromeExecutablePath();

if (chromePath) {
    console.log(`✅ Google Chrome detected: ${chromePath}`);
    console.log('📹 Video/GIF sending will be ENABLED');
} else {
    console.log('⚠️ Google Chrome not detected. Video/GIF sending may not work.');
}

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: chromePath || undefined,
        protocolTimeout: 300000  // 300 detik (dinaikkan dari 120s) — untuk file besar & traffic tinggi
    }
});

// Store QR code data
let currentQRCode = null;
let qrCodeTimestamp = null;

// Event: QR Code
client.on('qr', async (qr) => {
    console.log('🔍 Scan QR Code ini dengan WhatsApp Anda:');
    qrcode.generate(qr, { small: true });
    
    currentQRCode = qr;
    qrCodeTimestamp = Date.now();
    
    // Update QR data for admin routes
    updateQRData(qr, qrCodeTimestamp);
    
    // Generate QR code image
    try {
        const qrPath = path.join(CONFIG.MEDIA_FOLDER, 'qrcode.png');
        await QRCode.toFile(qrPath, qr, {
            type: 'png',
            width: 400,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
        });
        console.log(`📱 QR Code tersedia di: /admin/dashboard atau /qr`);
        
        // Update app.set for real-time access via API
        app.set('currentQRCode', currentQRCode);
        app.set('qrCodeTimestamp', qrCodeTimestamp);
    } catch (err) {
        console.error('❌ Error generating QR image:', err.message);
    }
});

// Event: Client Ready
client.on('ready', () => {
    console.log('✅ Client siap! WhatsApp Web berhasil terhubung.');
    console.log(`🌐 API Server berjalan di port ${CONFIG.API_PORT}`);
    console.log(`🔐 Admin Dashboard: http://localhost:${CONFIG.API_PORT}/admin/login`);
    
    // Log webhook status
    const webhookConfig = getWebhookConfig();
    if (webhookConfig.url) {
        console.log(`🔗 Webhook URL: ${webhookConfig.url}`);
        console.log(`📡 Webhook Enabled: ${webhookConfig.enabled ? '✅' : '❌'}`);
    } else {
        console.log('⚠️ Webhook URL not configured. Set in /admin/webhook-settings');
    }
});

// Event: Authenticated
client.on('authenticated', () => {
    console.log('🔐 Authenticated! Session tersimpan.');
});

// Event: Disconnected
client.on('disconnected', async (reason) => {
    console.log('⚠️ Client disconnected:', reason);

    // Reset QR state agar dashboard tidak stuck
    currentQRCode = null;
    qrCodeTimestamp = null;
    updateQRData(null, null);
    app.set('currentQRCode', null);
    app.set('qrCodeTimestamp', null);

    // Hapus file QR lama jika ada
    const { CONFIG: cfg } = require('./config');
    const qrFilePath = require('path').join(cfg.MEDIA_FOLDER, 'qrcode.png');
    if (require('fs').existsSync(qrFilePath)) {
        try { require('fs').unlinkSync(qrFilePath); } catch(e) {}
    }

    // Re-initialize setelah 3 detik agar koneksi benar-benar putus dulu
    console.log('🔄 Re-initializing WhatsApp client untuk generate QR baru...');
    setTimeout(async () => {
        try {
            await client.initialize();
        } catch (e) {
            console.log('⚠️ Re-init info:', e.message);
        }
    }, 3000);
});

 // Event: Message Create
client.on('message_create', async (message) => {
    console.log(`📩 Pesan dari ${message.from}: ${message.body?.substring(0, 50)}...`);

    // Build base message payload
    const msgPayload = {
        id: message.id._serialized || message.id.id,
        serializedId: message.id._serialized,
        originalId: message.id.id,
        from: message.from,
        to: message.to,
        body: message.body,
        type: message.type,
        timestamp: message.timestamp,
        hasMedia: message.hasMedia,
        author: message.author,
        deviceType: message.deviceType,
        isGroupMsg: message.from.includes('@g.us')
    };

    // Download media jika ada (image, video, document, voice, audio, sticker, dll)
    if (message.hasMedia) {
        try {
            // Deteksi apakah ini voice message
            const isVoice = message.type === 'ptt' || // ptt = push-to-talk (voice note WA)
                            message.type === 'audio' ||
                            (message.type === 'voice');

            console.log(`📥 Mendownload media [${message.type}] dari pesan ${message.id.id}...`);
            // Timeout guard: batalkan download jika > 60 detik agar tidak blokir proses lain
            const downloadTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Download timeout (60s)')), 60000)
            );
            const media = await Promise.race([message.downloadMedia(), downloadTimeout]);

            if (media && media.data) {
                // Tentukan mimetype & ekstensi
                const mimeType = media.mimetype || 'application/octet-stream';
                let ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';

                // Voice note WA biasanya dikirim sebagai audio/ogg; codecs=opus
                // Pastikan ekstensi .ogg agar mudah dikenali modul speech-to-text
                if (isVoice && (ext === 'ogg' || mimeType.includes('ogg'))) {
                    ext = 'ogg';
                } else if (isVoice && mimeType.includes('mpeg')) {
                    ext = 'mp3';
                }

                const filename = `${message.id.id}_${Date.now()}.${ext}`;
                const filePath = path.join(CONFIG.MEDIA_FOLDER, filename);

                // Simpan file ke disk
                const buffer = Buffer.from(media.data, 'base64');
                fs.writeFileSync(filePath, buffer);

                // Tentukan base URL — prioritas:
                // 1. BASE_URL (env var custom, paling reliable, set manual di Railway)
                // 2. RAILWAY_PUBLIC_DOMAIN (env var otomatis Railway jika domain di-generate)
                // 3. fallback localhost (hanya untuk dev lokal)
                const baseURL = process.env.BASE_URL
                    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
                    || `http://localhost:${CONFIG.API_PORT}`;

                const mediaUrl = `${baseURL}/media/${filename}`;
                console.log(`✅ Media [${message.type}] tersimpan: ${filename} → ${mediaUrl}`);

                msgPayload.mediaUrl = mediaUrl;
                msgPayload.mediaFilename = filename;
                msgPayload.mediaMimetype = mimeType;
                msgPayload.isVoice = isVoice; // true jika voice note, false jika media lain
            }
        } catch (mediaErr) {
            console.error(`❌ Gagal download media:`, mediaErr.message);
            msgPayload.mediaError = mediaErr.message;
        }
    }

    const payload = { message: msgPayload };
    await sendWebhook('message_create', payload);
});

// Event: Message Revoke
client.on('message_revoke_everyone', async (after, before) => {
    const payload = {
        message: {
            id: after.id.id,
            from: after.from,
            body: after.body,
            revokedAt: Date.now()
        }
    };
    
    await sendWebhook('message_revoke', payload);
});

// Event: Group Join
client.on('group_join', async (notification) => {
    const payload = {
        notification: {
            chatId: notification.chatId,
            author: notification.author,
            body: notification.body,
            type: notification.type
        }
    };
    
    await sendWebhook('group_join', payload);
});

// Event: Group Leave
client.on('group_leave', async (notification) => {
    const payload = {
        notification: {
            chatId: notification.chatId,
            author: notification.author,
            body: notification.body,
            type: notification.type
        }
    };
    
    await sendWebhook('group_leave', payload);
});

// Store base URL getter in app
app.locals.getBaseURL = getBaseURL;

// Make client available to routes
app.set('whatsappClient', client);
app.set('currentQRCode', currentQRCode);
app.set('qrCodeTimestamp', qrCodeTimestamp);

// Routes
app.use('/', publicRoutes);
app.use('/admin', adminRoutes);
app.use('/', apiRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /qr',
            'GET /admin/login',
            'GET /admin/dashboard',
            'GET /health',
            'GET /chats',
            'GET /groups',
            'GET /contacts',
            'POST /send-message',
            'POST /send-media'
        ]
    });
});

// Start server and client
app.listen(CONFIG.API_PORT, () => {
    console.log('🚀 Memulai WhatsApp Web Client dengan API Server...');
    console.log(`🌐 API akan tersedia di port ${CONFIG.API_PORT}`);
    console.log('⏳ Menunggu QR Code...');
});

client.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Menutup client...');
    await client.destroy();
    process.exit(0);
});
