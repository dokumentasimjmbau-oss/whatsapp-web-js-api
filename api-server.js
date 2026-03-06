const express = require('express');
const session = require('express-session');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode'); // For generating QR image
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const API_PORT = process.env.PORT || 3001; // Use Railway's PORT env variable or default to 3001
const MEDIA_FOLDER = './media';

// Security Configuration
const API_KEY = process.env.API_KEY;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'whatsapp-web-secret-key-2025';

// Parse JSON body
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enable CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Session middleware for admin dashboard
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Store current QR code data
let currentQRCode = null;
let qrCodeTimestamp = null;

// Konfigurasi
const CONFIG = {
    WEBHOOK_URL: process.env.WEBHOOK_URL || 'https://cloud.activepieces.com/api/v1/webhooks/49mCt0eLl7F1pA7ey4dFH',
    MEDIA_FOLDER: './media',
    NGROK_URL: process.env.NGROK_URL || null // Will be auto-detected from Railway or request
};

// Function to get base URL for media
function getBaseURL(req) {
    // Priority 1: Use Railway public domain from env
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    }
    
    // Priority 2: Use NGROK_URL from env
    if (process.env.NGROK_URL) {
        return process.env.NGROK_URL;
    }
    
    // Priority 3: Use request host
    if (req && req.headers && req.headers.host) {
        const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        return `${protocol}://${req.headers.host}`;
    }
    
    // Fallback: localhost
    return `http://localhost:${API_PORT}`;
}

// Buat folder media jika belum ada
if (!fs.existsSync(MEDIA_FOLDER)) {
    fs.mkdirSync(MEDIA_FOLDER, { recursive: true });
}

// 🗑️ Auto-cleanup function untuk menghapus media lama
function cleanupOldMedia() {
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 jam dalam milliseconds
    const now = Date.now();
    
    try {
        const files = fs.readdirSync(MEDIA_FOLDER);
        let deletedCount = 0;
        let savedSpace = 0;
        
        files.forEach(file => {
            // Skip file yang tidak boleh dihapus
            if (file === 'qrcode.png' || file.startsWith('temp_')) return;
            
            const filePath = path.join(MEDIA_FOLDER, file);
            
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

// Jalankan cleanup setiap jam
setInterval(cleanupOldMedia, 60 * 60 * 1000);

// Cleanup juga saat startup
console.log('🧹 Initializing media auto-cleanup (deletes files older than 24h)...');
cleanupOldMedia();

// Chrome executable path configuration for video support
// Video/GIF requires Google Chrome (not Chromium) due to H.264 licensing
const CHROME_EXECUTABLE_PATHS = {
    windows: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    windowsAlt: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    mac: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    linux: '/usr/bin/google-chrome-stable',
    linuxAlt: '/usr/bin/chromium-browser',
    railway: '/usr/bin/google-chrome-stable'
};

// Detect Chrome executable based on OS
function getChromeExecutablePath() {
    const platform = process.platform;
    
    if (platform === 'win32') {
        // Check Windows paths
        if (fs.existsSync(CHROME_EXECUTABLE_PATHS.windows)) {
            return CHROME_EXECUTABLE_PATHS.windows;
        }
        if (fs.existsSync(CHROME_EXECUTABLE_PATHS.windowsAlt)) {
            return CHROME_EXECUTABLE_PATHS.windowsAlt;
        }
    } else if (platform === 'darwin') {
        // Check macOS path
        if (fs.existsSync(CHROME_EXECUTABLE_PATHS.mac)) {
            return CHROME_EXECUTABLE_PATHS.mac;
        }
    } else if (platform === 'linux') {
        // Check Linux paths
        if (fs.existsSync(CHROME_EXECUTABLE_PATHS.linux)) {
            return CHROME_EXECUTABLE_PATHS.linux;
        }
        if (fs.existsSync(CHROME_EXECUTABLE_PATHS.linuxAlt)) {
            return CHROME_EXECUTABLE_PATHS.linuxAlt;
        }
    }
    
    return null; // Chrome not found, will use Chromium (video won't work)
}

// Get Chrome path from env or auto-detect
const chromePath = process.env.CHROME_PATH || getChromeExecutablePath();

if (chromePath) {
    console.log(`✅ Google Chrome detected: ${chromePath}`);
    console.log('📹 Video/GIF sending will be ENABLED');
} else {
    console.log('⚠️ Google Chrome not detected. Video/GIF sending may not work.');
    console.log('   To enable video support, install Google Chrome or set CHROME_PATH environment variable.');
}

// Inisialisasi client dengan LocalAuth untuk menyimpan session
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: chromePath || undefined
    }
});

// Event: QR Code
client.on('qr', async (qr) => {
    console.log('🔍 Scan QR Code ini dengan WhatsApp Anda:');
    qrcode.generate(qr, { small: true });
    
    // Save QR code for web display
    currentQRCode = qr;
    qrCodeTimestamp = Date.now();
    
    // Generate QR code image
    try {
        const qrPath = path.join(MEDIA_FOLDER, 'qrcode.png');
        await QRCode.toFile(qrPath, qr, {
            type: 'png',
            width: 400,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
        console.log(`📱 QR Code juga tersedia di: /admin/dashboard atau /qr (web page)`);
    } catch (err) {
        console.error('❌ Error generating QR image:', err.message);
    }
});

// Event: Client Ready
client.on('ready', () => {
    console.log('✅ Client siap! WhatsApp Web berhasil terhubung.');
    console.log(`🌐 API Server berjalan di port ${API_PORT}`);
    console.log(`📁 Media akan disimpan di folder: ${MEDIA_FOLDER}`);
    console.log(`🔗 Webhook URL: ${CONFIG.WEBHOOK_URL}`);
    console.log(`🔐 Admin Dashboard: http://localhost:${API_PORT}/admin/login`);
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
        const filepath = path.join(MEDIA_FOLDER, filename);

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

// Fungsi untuk download file dari URL dan convert ke base64
async function downloadFileFromURL(url) {
    try {
        console.log(`📥 Downloading file from: ${url}`);
        
        // Check file size first with HEAD request
        try {
            const headResponse = await axios.head(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const contentLength = headResponse.headers['content-length'];
            if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB limit
                throw new Error(`File too large: ${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB. Max 50MB allowed.`);
            }
            
            console.log(`📊 File size: ${contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) + 'MB' : 'Unknown'}`);
        } catch (headError) {
            console.log('⚠️ Could not get file size, continuing anyway...');
        }
        
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 60000, // 60 seconds timeout for large files
            maxContentLength: 50 * 1024 * 1024, // 50MB max
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const contentType = response.headers['content-type'];
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        
        // Extract filename from URL
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const filename = pathname.split('/').pop() || 'file';
        
        console.log(`✅ File downloaded: ${filename}, Size: ${(base64.length / 1024).toFixed(2)}KB, Type: ${contentType}`);
        
        return {
            data: base64,
            mimetype: contentType || 'application/octet-stream',
            filename: filename
        };
    } catch (error) {
        console.error('❌ Error downloading file:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        }
        throw new Error(`Failed to download file from URL: ${error.message}`);
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
                serialized: message.id._serialized,
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
        // Note: We need to store req for later use in webhook
        const currentReq = global.currentRequest;
        
        if (message.hasMedia) {
            console.log('📎 Media terdeteksi, mendownload...');
            const mediaInfo = await downloadMedia(message);
            
            if (mediaInfo) {
                // Buat URL publik untuk media menggunakan base URL yang terdeteksi
                const baseURL = getBaseURL(currentReq);
                const mediaUrl = `${baseURL}/media/${mediaInfo.filename}`;
                
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

// Middleware to check API Key
function authenticateAPI(req, res, next) {
    // Skip auth if no API_KEY is set (development mode)
    if (!API_KEY) {
        return next();
    }
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token || token !== API_KEY) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing or invalid API key. Provide API key in Authorization header: Bearer YOUR_API_KEY'
        });
    }
    
    next();
}

// Middleware to check admin authentication
function requireAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.redirect('/admin/login');
}

// ==================== ADMIN DASHBOARD ROUTES ====================

// Admin Login Page
app.get('/admin/login', (req, res) => {
    if (req.session.isAdmin) {
        return res.redirect('/admin/dashboard');
    }
    
    res.send(`
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - WhatsApp Web API</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 100%;
            max-width: 400px;
            text-align: center;
        }
        .logo {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 24px;
        }
        p {
            color: #666;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }
        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
        }
        input {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        }
        .error {
            background: #fee;
            color: #c33;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .info {
            margin-top: 20px;
            padding: 15px;
            background: #f0f4ff;
            border-radius: 8px;
            font-size: 13px;
            color: #666;
        }
        .info strong {
            color: #333;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">📱</div>
        <h1>WhatsApp Web API</h1>
        <p>Admin Dashboard Login</p>
        
        ${req.query.error === '1' ? '<div class="error">Username atau password salah!</div>' : ''}
        
        <form action="/admin/login" method="POST">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required placeholder="Masukkan username">
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required placeholder="Masukkan password">
            </div>
            <button type="submit">🔐 Login</button>
        </form>
        
        <div class="info">
            <strong>Default Credentials:</strong><br>
            Username: <code>admin</code><br>
            Password: <code>admin123</code><br><br>
            <small>Ganti password di environment variable ADMIN_PASSWORD untuk keamanan.</small>
        </div>
    </div>
</body>
</html>`);
});

// Admin Login POST
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        req.session.loginTime = new Date().toISOString();
        return res.redirect('/admin/dashboard');
    }
    
    res.redirect('/admin/login?error=1');
});

// Admin Logout
app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// Admin Dashboard
app.get('/admin/dashboard', requireAuth, async (req, res) => {
    try {
        const isClientReady = client.info ? true : false;
        let qrHtml = '';
        let statsHtml = '';
        
        if (!isClientReady && currentQRCode) {
            const qrPath = path.join(MEDIA_FOLDER, 'qrcode.png');
            if (fs.existsSync(qrPath)) {
                const qrBase64 = fs.readFileSync(qrPath, 'base64');
                qrHtml = `
                    <div class="qr-section">
                        <h2>📱 Scan QR Code</h2>
                        <p>Scan QR code ini dengan WhatsApp mobile Anda untuk menghubungkan</p>
                        <div class="qr-container">
                            <img src="data:image/png;base64,${qrBase64}" alt="QR Code" width="300" height="300">
                        </div>
                        <div class="qr-instructions">
                            <h4>Cara Scan:</h4>
                            <ol>
                                <li>Buka WhatsApp di HP Anda</li>
                                <li>Ketuk Menu (⋮) → <strong>Linked Devices</strong></li>
                                <li>Ketuk <strong>Link a Device</strong></li>
                                <li>Scan QR code di atas</li>
                            </ol>
                        </div>
                        <div class="qr-timestamp">Generated: ${new Date(qrCodeTimestamp).toLocaleString()}</div>
                    </div>
                `;
            }
        } else if (isClientReady) {
            qrHtml = `
                <div class="status-section success">
                    <h2>✅ WhatsApp Terhubung</h2>
                    <p>WhatsApp Web berhasil terhubung dan siap digunakan.</p>
                    <div class="connection-info">
                        <p><strong>User:</strong> ${client.info.pushname}</p>
                        <p><strong>Nomor:</strong> ${client.info.wid.user}</p>
                        <p><strong>Platform:</strong> ${client.info.platform}</p>
                    </div>
                </div>
            `;
        } else {
            qrHtml = `
                <div class="status-section loading">
                    <h2>⏳ Menunggu QR Code...</h2>
                    <p>QR code akan muncul dalam beberapa saat...</p>
                    <div class="loading-spinner"></div>
                </div>
            `;
        }
        
        // Get stats if client is ready
        if (isClientReady) {
            try {
                const chats = await client.getChats();
                const groups = chats.filter(c => c.isGroup);
                const contacts = await client.getContacts();
                
                statsHtml = `
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">💬</div>
                            <div class="stat-value">${chats.length}</div>
                            <div class="stat-label">Total Chats</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">👥</div>
                            <div class="stat-value">${groups.length}</div>
                            <div class="stat-label">Groups</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">👤</div>
                            <div class="stat-value">${contacts.filter(c => c.isUser).length}</div>
                            <div class="stat-label">Contacts</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📁</div>
                            <div class="stat-value">${fs.readdirSync(MEDIA_FOLDER).length}</div>
                            <div class="stat-label">Media Files</div>
                        </div>
                    </div>
                `;
            } catch (e) {
                statsHtml = '<p class="error">Gagal memuat statistik</p>';
            }
        }
        
        res.send(`
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - WhatsApp Web API</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f7fa;
            min-height: 100vh;
        }
        .navbar {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .navbar h1 {
            font-size: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .navbar .user-info {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .navbar .logout-btn {
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            text-decoration: none;
            font-size: 14px;
            transition: background 0.3s;
        }
        .navbar .logout-btn:hover {
            background: rgba(255,255,255,0.3);
        }
        .container {
            max-width: 1200px;
            margin: 30px auto;
            padding: 0 20px;
        }
        .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .card h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .qr-section {
            text-align: center;
        }
        .qr-section h2 {
            justify-content: center;
        }
        .qr-section p {
            color: #666;
            margin-bottom: 20px;
        }
        .qr-container {
            background: white;
            padding: 20px;
            border-radius: 12px;
            display: inline-block;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .qr-container img {
            display: block;
            border-radius: 8px;
        }
        .qr-instructions {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            text-align: left;
            max-width: 350px;
            margin: 0 auto;
        }
        .qr-instructions h4 {
            margin-bottom: 10px;
            color: #333;
        }
        .qr-instructions ol {
            padding-left: 20px;
            color: #666;
        }
        .qr-instructions li {
            margin: 8px 0;
        }
        .qr-timestamp {
            margin-top: 15px;
            color: #999;
            font-size: 12px;
        }
        .status-section {
            text-align: center;
            padding: 40px;
        }
        .status-section.success {
            background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
            border-radius: 12px;
        }
        .status-section.success h2 {
            color: #155724;
            justify-content: center;
        }
        .status-section.success p {
            color: #155724;
            margin-bottom: 20px;
        }
        .connection-info {
            background: white;
            padding: 20px;
            border-radius: 10px;
            display: inline-block;
            text-align: left;
        }
        .connection-info p {
            color: #333;
            margin: 8px 0;
        }
        .status-section.loading {
            text-align: center;
        }
        .status-section.loading h2 {
            color: #856404;
            justify-content: center;
        }
        .loading-spinner {
            width: 50px;
            height: 50px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-top: 20px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }
        .stat-icon {
            font-size: 30px;
            margin-bottom: 10px;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-label {
            font-size: 14px;
            opacity: 0.9;
        }
        .endpoints-list {
            list-style: none;
        }
        .endpoints-list li {
            padding: 12px 15px;
            margin-bottom: 10px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .endpoints-list .method {
            display: inline-block;
            padding: 4px 10px;
            background: #667eea;
            color: white;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin-right: 10px;
        }
        .endpoints-list .path {
            font-family: monospace;
            font-weight: 600;
            color: #333;
        }
        .endpoints-list .desc {
            color: #666;
            font-size: 13px;
            margin-top: 5px;
        }
        .api-key-section {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 10px;
            padding: 20px;
            margin-top: 20px;
        }
        .api-key-section h3 {
            color: #856404;
            margin-bottom: 10px;
        }
        .api-key-section code {
            background: white;
            padding: 10px 15px;
            border-radius: 6px;
            display: inline-block;
            font-family: monospace;
            color: #333;
            word-break: break-all;
        }
        @media (max-width: 768px) {
            .dashboard-grid {
                grid-template-columns: 1fr;
            }
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <h1>📱 WhatsApp Web API Dashboard</h1>
        <div class="user-info">
            <span>👤 Admin</span>
            <a href="/admin/logout" class="logout-btn">Logout</a>
        </div>
    </nav>
    
    <div class="container">
        ${statsHtml}
        
        <div class="dashboard-grid">
            <div class="card">
                ${qrHtml}
            </div>
            
            <div class="card">
                <h2>🔗 API Endpoints</h2>
                <ul class="endpoints-list">
                    <li>
                        <span class="method">GET</span>
                        <span class="path">/health</span>
                        <div class="desc">Health check status</div>
                    </li>
                    <li>
                        <span class="method">GET</span>
                        <span class="path">/chats</span>
                        <div class="desc">Daftar semua chat</div>
                    </li>
                    <li>
                        <span class="method">GET</span>
                        <span class="path">/groups</span>
                        <div class="desc">Daftar semua grup</div>
                    </li>
                    <li>
                        <span class="method">GET</span>
                        <span class="path">/contacts</span>
                        <div class="desc">Daftar kontak</div>
                    </li>
                    <li>
                        <span class="method">POST</span>
                        <span class="path">/send-message</span>
                        <div class="desc">Kirim pesan teks</div>
                    </li>
                    <li>
                        <span class="method">POST</span>
                        <span class="path">/send-media</span>
                        <div class="desc">Kirim media (gambar, video, dokumen)</div>
                    </li>
                </ul>
                
                <div class="api-key-section">
                    <h3>🔑 API Key</h3>
                    <p>Gunakan API key ini di header Authorization:</p>
                    <code>Authorization: Bearer ${API_KEY || 'Not set - API is open'}</code>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Auto refresh untuk cek status koneksi
        setInterval(async () => {
            try {
                const response = await fetch('/health');
                const data = await response.json();
                if (data.clientReady && document.querySelector('.status-section.loading')) {
                    location.reload();
                }
            } catch (e) {}
        }, 5000);
    </script>
</body>
</html>`);
    } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.status(500).send('Error loading dashboard');
    }
});

// ==================== PUBLIC ROUTES ====================

// QR Code endpoint - Display QR code as HTML page (public)
app.get('/qr', (req, res) => {
    const qrPath = path.join(MEDIA_FOLDER, 'qrcode.png');
    if (fs.existsSync(qrPath) && currentQRCode) {
        const qrBase64 = fs.readFileSync(qrPath, 'base64');
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp QR Code</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            max-width: 90%;
        }
        h1 { margin-bottom: 10px; font-size: 28px; }
        p { margin-bottom: 30px; opacity: 0.9; }
        .qr-container {
            background: white;
            padding: 20px;
            border-radius: 15px;
            display: inline-block;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .qr-container img {
            display: block;
            max-width: 100%;
            height: auto;
        }
        .instructions {
            margin-top: 30px;
            padding: 20px;
            background: rgba(255,255,255,0.15);
            border-radius: 10px;
            text-align: left;
            max-width: 400px;
        }
        .instructions h3 { margin-top: 0; }
        .instructions ol { text-align: left; padding-left: 20px; }
        .instructions li { margin: 10px 0; }
        .status {
            margin-top: 20px;
            padding: 10px 20px;
            border-radius: 20px;
            background: rgba(255,255,255,0.2);
            font-size: 14px;
        }
        .refresh-btn {
            margin-top: 20px;
            padding: 12px 30px;
            background: #25D366;
            color: white;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .refresh-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(37, 211, 102, 0.4);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📱 Scan QR Code</h1>
        <p>Scan QR code ini dengan WhatsApp mobile Anda</p>
        
        <div class="qr-container">
            <img src="data:image/png;base64,${qrBase64}" alt="WhatsApp QR Code" width="400" height="400">
        </div>
        
        <div class="instructions">
            <h3>📝 Cara Scan:</h3>
            <ol>
                <li>Buka WhatsApp di HP Anda</li>
                <li>Ketuk Menu (⋮) → <strong>Linked Devices</strong></li>
                <li>Ketuk <strong>Link a Device</strong></li>
                <li>Scan QR code di atas</li>
            </ol>
        </div>
        
        <div class="status">
            ⏳ Menunggu scan QR code...<br>
            <small>Generated: ${new Date(qrCodeTimestamp).toLocaleString()}</small>
        </div>
        
        <button class="refresh-btn" onclick="location.reload()">🔄 Refresh QR Code</button>
    </div>
    
    <script>
        // Auto refresh setiap 30 detik untuk cek apakah sudah tersambung
        setInterval(async () => {
            try {
                const response = await fetch('/health');
                const data = await response.json();
                if (data.clientReady) {
                    document.querySelector('.status').innerHTML = '✅ <strong>Berhasil tersambung!</strong><br><small>Anda bisa menutup halaman ini.</small>';
                    document.querySelector('.status').style.background = 'rgba(37, 211, 102, 0.3)';
                }
            } catch (e) {}
        }, 5000);
    </script>
</body>
</html>`;
        res.send(html);
    } else {
        res.status(503).json({ 
            error: 'QR Code belum tersedia', 
            message: 'QR code akan muncul saat server pertama kali dijalankan. Silakan refresh halaman ini dalam beberapa saat.',
            clientReady: client.info ? true : false 
        });
    }
});

// Root endpoint - API Info
app.get('/', (req, res) => {
    res.json({
        message: 'WhatsApp Web JS API Server',
        version: '1.0.0',
        clientReady: client.info ? true : false,
        endpoints: {
            'GET /qr': 'Display QR code as HTML page',
            'GET /admin/login': 'Admin Dashboard Login',
            'GET /admin/dashboard': 'Admin Dashboard (requires login)',
            'POST /send-message': 'Send text message (supports reply)',
            'POST /send-media': 'Send media files (image, video, document, audio)',
            'GET /health': 'Health check status'
        },
        documentation: 'See API_DOCUMENTATION.md for detailed usage',
        timestamp: Date.now()
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        clientReady: client.info ? true : false
    });
});

// ==================== API ROUTES (Protected with API Key) ====================

// Serve media files
app.get('/media/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(MEDIA_FOLDER, filename);
    
    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    try {
        const file = fs.readFileSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        
        // Set content type based on extension
        const contentTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.pdf': 'application/pdf',
            '.mp3': 'audio/mpeg',
            '.ogg': 'audio/ogg'
        };
        
        const contentType = contentTypes[ext] || 'application/octet-stream';
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24 hours
        res.send(file);
    } catch (err) {
        console.error('❌ Error serving media:', err.message);
        res.status(500).json({ error: 'Error reading file' });
    }
});

// Get all chats (Protected with API Key)
app.get('/chats', authenticateAPI, async (req, res) => {
    try {
        if (!client.info) {
            return res.status(503).json({ error: 'WhatsApp client not ready' });
        }

        const chats = await client.getChats();
        const formattedChats = chats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name,
            isGroup: chat.isGroup,
            isMuted: chat.isMuted,
            unreadCount: chat.unreadCount,
            timestamp: chat.timestamp,
            pinned: chat.pinned,
            archived: chat.archived
        }));

        res.json({
            success: true,
            count: formattedChats.length,
            chats: formattedChats
        });
    } catch (error) {
        console.error('❌ Error fetching chats:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get all groups (Protected with API Key)
app.get('/groups', authenticateAPI, async (req, res) => {
    try {
        if (!client.info) {
            return res.status(503).json({ error: 'WhatsApp client not ready' });
        }

        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        
        const formattedGroups = await Promise.all(groups.map(async group => {
            let participants = [];
            try {
                participants = group.participants.map(p => ({
                    id: p.id._serialized,
                    isAdmin: p.isAdmin,
                    isSuperAdmin: p.isSuperAdmin
                }));
            } catch (e) {
                // Some groups might not have accessible participants
            }

            return {
                id: group.id._serialized,
                name: group.name,
                description: group.description || null,
                participants: participants,
                participantCount: participants.length,
                isMuted: group.isMuted,
                unreadCount: group.unreadCount,
                timestamp: group.timestamp,
                createdAt: group.createdAt || null
            };
        }));

        res.json({
            success: true,
            count: formattedGroups.length,
            groups: formattedGroups
        });
    } catch (error) {
        console.error('❌ Error fetching groups:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get all contacts (Protected with API Key)
app.get('/contacts', authenticateAPI, async (req, res) => {
    try {
        if (!client.info) {
            return res.status(503).json({ error: 'WhatsApp client not ready' });
        }

        const contacts = await client.getContacts();
        const formattedContacts = contacts
            .filter(contact => contact.number) // Only contacts with phone numbers
            .map(contact => ({
                id: contact.id._serialized,
                number: contact.number,
                name: contact.name || contact.pushname || null,
                pushname: contact.pushname || null,
                shortName: contact.shortName || null,
                isBusiness: contact.isBusiness,
                isEnterprise: contact.isEnterprise,
                isMyContact: contact.isMyContact,
                isUser: contact.isUser,
                isGroup: contact.isGroup,
                profilePicUrl: null // Will be populated if needed
            }));

        res.json({
            success: true,
            count: formattedContacts.length,
            contacts: formattedContacts
        });
    } catch (error) {
        console.error('❌ Error fetching contacts:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get all channels/newsletters (Protected with API Key)
app.get('/channels', authenticateAPI, async (req, res) => {
    try {
        if (!client.info) {
            return res.status(503).json({ error: 'WhatsApp client not ready' });
        }

        const chats = await client.getChats();
        const channels = chats.filter(chat =>
            chat.id && chat.id._serialized && chat.id._serialized.includes('@newsletter')
        );

        const formattedChannels = channels.map(channel => {
            // Safely access channel properties with null checks
            try {
                return {
                    id: channel.id?._serialized || 'unknown',
                    name: channel.name || 'Unknown Channel',
                    description: channel.description || null,
                    subscriberCount: channel.subscriberCount || null,
                    isMuted: channel.isMuted || false,
                    unreadCount: channel.unreadCount || 0,
                    timestamp: channel.timestamp || null
                };
            } catch (e) {
                console.error('❌ Error formatting channel:', e.message);
                return {
                    id: 'unknown',
                    name: 'Error loading channel',
                    description: null,
                    subscriberCount: null,
                    isMuted: false,
                    unreadCount: 0,
                    timestamp: null
                };
            }
        });

        res.json({
            success: true,
            count: formattedChannels.length,
            channels: formattedChannels
        });
    } catch (error) {
        console.error('❌ Error fetching channels:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get info about logged in user (Protected with API Key)
app.get('/me', authenticateAPI, async (req, res) => {
    try {
        if (!client.info) {
            return res.status(503).json({ error: 'WhatsApp client not ready' });
        }

        const me = client.info;
        
        res.json({
            success: true,
            user: {
                id: me.wid._serialized,
                number: me.wid.user,
                name: me.pushname || null,
                platform: me.platform,
                isBusiness: me.isBusiness || false,
                isEnterprise: me.isEnterprise || false
            }
        });
    } catch (error) {
        console.error('❌ Error fetching user info:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Send message endpoint (Protected with API Key)
app.post('/send-message', authenticateAPI, async (req, res) => {
    try {
        const { action, to, message, delay, simulateTyping, typingDuration, quotedMessageId, mentions } = req.body;

        if (!to || !message) {
            return res.status(400).json({ error: 'Missing required fields: to, message' });
        }

        if (!client.info) {
            return res.status(503).json({ error: 'WhatsApp client not ready' });
        }

        // Simulate typing if requested
        if (simulateTyping && typingDuration) {
            const chat = await client.getChatById(to);
            await chat.sendStateTyping();
            await new Promise(resolve => setTimeout(resolve, typingDuration));
            await chat.clearState();
        }

        // Delay if requested
        if (delay && delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        let sentMessage;

        if (action === 'sendReply' && quotedMessageId) {
            // Reply to specific message
            try {
                const quotedMsg = await client.getMessageById(quotedMessageId);
                sentMessage = await quotedMsg.reply(message, to);
            } catch (replyError) {
                console.error('❌ Error replying to message:', replyError.message);
                return res.status(400).json({ 
                    error: 'Failed to reply. Make sure quotedMessageId is in serialized format (e.g., false_628xxx@c.us_3EBxxx). Received: ' + quotedMessageId,
                    hint: 'For group messages, use action:"sendText" without quotedMessageId, or include the full serialized message ID from webhook'
                });
            }
        } else {
            // Send new message
            try {
                const options = {};
                if (mentions && Array.isArray(mentions)) {
                    options.mentions = mentions;
                }
                
                // Check if target is a Channel/Newsletter
                if (to.includes('@newsletter')) {
                    console.log(`📢 Attempting to send to Channel/Newsletter: ${to}`);
                    console.log(`⚠️  WARNING: Channel/Newsletter support is experimental in whatsapp-web.js`);
                    
                    try {
                        // For channels, try to get the chat first
                        const chat = await client.getChatById(to);
                        
                        if (!chat) {
                            throw new Error('Chat object is null or undefined');
                        }
                        
                        // Try to send message using chat.sendMessage
                        sentMessage = await chat.sendMessage(message);
                        console.log(`✅ Message sent to Channel/Newsletter successfully`);
                    } catch (channelError) {
                        console.error('❌ Channel/Newsletter send error:', channelError.message);
                        
                        // Provide a clear error message about the limitation
                        const errorMsg = `Failed to send to Channel/Newsletter (${to}). ` +
                                       `This feature is not fully supported by whatsapp-web.js library. ` +
                                       `Error: ${channelError.message}. ` +
                                       `You can only receive messages from channels, but sending TO channels is limited by WhatsApp Web.`;
                        
                        return res.status(400).json({ 
                            error: errorMsg,
                            type: 'CHANNEL_NOT_SUPPORTED',
                            suggestion: 'Consider using regular groups (g.us) for sending messages, or check if you are the channel admin.'
                        });
                    }
                } else {
                    sentMessage = await client.sendMessage(to, message, options);
                }
            } catch (sendError) {
                console.error('❌ Error in sendMessage:', sendError.message);
                throw sendError;
            }
        }

        res.json({
            success: true,
            messageId: sentMessage.id.id,
            timestamp: Date.now(),
            to: to,
            delayed: delay ? true : false,
            delayMs: delay || 0,
            typingSimulated: simulateTyping ? true : false
        });

    } catch (error) {
        console.error('❌ Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send media endpoint (Protected with API Key)
app.post('/send-media', authenticateAPI, async (req, res) => {
    try {
        const { action, to, type, mimetype, filename, data, caption, delay, simulateTyping, typingDuration, sendAsVoice, sendAsSticker, sendAsDocument, quotedMessageId } = req.body;

        if (!to || !data) {
            return res.status(400).json({ error: 'Missing required fields: to, data' });
        }

        if (!client.info) {
            return res.status(503).json({ error: 'WhatsApp client not ready' });
        }

        // Simulate typing if requested
        if (simulateTyping && typingDuration) {
            const chat = await client.getChatById(to);
            await chat.sendStateTyping();
            await new Promise(resolve => setTimeout(resolve, typingDuration));
            await chat.clearState();
        }

        // Delay if requested
        if (delay && delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        let mediaData, mediaMimetype, mediaFilename;

        // Check if data is URL or base64
        if (data.startsWith('http://') || data.startsWith('https://')) {
            try {
                // Download from URL
                console.log(`📥 Processing URL: ${data}`);
                const downloaded = await downloadFileFromURL(data);
                mediaData = downloaded.data;
                mediaMimetype = mimetype || downloaded.mimetype;
                mediaFilename = filename || downloaded.filename;
                console.log(`✅ Download complete: ${mediaFilename}, Type: ${mediaMimetype}`);
            } catch (downloadError) {
                console.error('❌ Download failed:', downloadError.message);
                return res.status(400).json({ 
                    error: 'Failed to download file from URL',
                    details: downloadError.message,
                    url: data
                });
            }
        } else {
            // Use provided base64 data
            console.log(`📎 Using provided base64 data`);
            mediaData = data;
            mediaMimetype = mimetype;
            mediaFilename = filename || 'file';
        }

        if (!mediaMimetype) {
            return res.status(400).json({ error: 'Missing mimetype. Provide mimetype or use a URL that returns Content-Type header' });
        }

        // Create MessageMedia
        const media = new MessageMedia(mediaMimetype, mediaData, mediaFilename);

        // Send options
        const options = {
            caption: caption || ''
        };

        if (sendAsVoice) {
            options.sendAudioAsVoice = true;
        }
        if (sendAsSticker) {
            options.sendMediaAsSticker = true;
        }
        if (sendAsDocument) {
            options.sendMediaAsDocument = true;
        }

        let sentMessage;

        // Save media to file first (more reliable)
        const tempFilePath = path.join(MEDIA_FOLDER, `temp_${Date.now()}_${mediaFilename}`);
        try {
            fs.writeFileSync(tempFilePath, mediaData, 'base64');
            console.log(`💾 Media saved to temp file: ${tempFilePath}`);
            
            // Create MessageMedia from file path
            const mediaFromFile = MessageMedia.fromFilePath(tempFilePath);
            mediaFromFile.filename = mediaFilename;
            
            // Handle reply with media
            if (quotedMessageId) {
                try {
                    // Get the quoted message
                    const quotedMsg = await client.getMessageById(quotedMessageId);
                    
                    // Reply with media
                    sentMessage = await quotedMsg.reply(mediaFromFile, to, { caption: caption || '' });
                    console.log('✅ Media reply sent successfully');
                } catch (replyError) {
                    console.error('❌ Error replying with media:', replyError.message);
                    // Fallback: just send media without reply
                    sentMessage = await client.sendMessage(to, mediaFromFile, options);
                }
            } else {
                sentMessage = await client.sendMessage(to, mediaFromFile, options);
            }
            
            // Clean up temp file
            try {
                fs.unlinkSync(tempFilePath);
                console.log(`🗑️ Temp file deleted: ${tempFilePath}`);
            } catch (cleanupError) {
                console.log('⚠️ Could not delete temp file:', cleanupError.message);
            }
        } catch (fileError) {
            console.error('❌ Error handling media file:', fileError.message);
            throw fileError;
        }

        res.json({
            success: true,
            messageId: sentMessage.id.id,
            timestamp: Date.now(),
            to: to,
            mediaType: type,
            filename: mediaFilename,
            mimetype: mediaMimetype,
            delayed: delay ? true : false,
            delayMs: delay || 0,
            typingSimulated: simulateTyping ? true : false,
            repliedTo: quotedMessageId || null
        });

    } catch (error) {
        console.error('❌ Error sending media:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ 
            error: error.message,
            type: error.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /qr',
            'GET /admin/login',
            'GET /admin/dashboard',
            'GET /health',
            'GET /me',
            'GET /chats',
            'GET /groups',
            'GET /contacts',
            'GET /channels',
            'GET /media/:filename',
            'POST /send-message',
            'POST /send-media'
        ]
    });
});

// Start server and client
app.listen(API_PORT, () => {
    console.log('🚀 Memulai WhatsApp Web Client dengan API Server...');
    console.log(`🌐 API akan tersedia di port ${API_PORT}`);
    console.log(`🔐 Admin Dashboard: http://localhost:${API_PORT}/admin/login`);
    console.log('⏳ Menunggu QR Code...');
});

client.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Menutup client...');
    await client.destroy();
    process.exit(0);
});
