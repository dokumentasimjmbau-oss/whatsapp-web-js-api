const http = require('http');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode'); // For generating QR image
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_PORT = process.env.PORT || 3001; // Use Railway's PORT env variable or default to 3001
const MEDIA_FOLDER = './media';

// Security Configuration
const API_KEY = process.env.API_KEY;

// Middleware to check API Key
function authenticate(req, res, next) {
    // Skip auth if no API_KEY is set (development mode)
    if (!API_KEY) {
        return next();
    }
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token || token !== API_KEY) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Unauthorized',
            message: 'Missing or invalid API key. Provide API key in Authorization header: Bearer YOUR_API_KEY'
        }));
        return;
    }
    
    next();
}

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

// Inisialisasi client dengan LocalAuth untuk menyimpan session
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
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
        console.log(`📱 QR Code juga tersedia di: /qr (web page) atau /media/qrcode.png (image)`);
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

// Parse JSON body
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
    });
}

// API Server
const server = http.createServer(async (req, res) => {
    // Store current request for use in webhook handlers
    global.currentRequest = req;
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // QR Code endpoint - Display QR code as HTML page
    if (pathname === '/qr' && req.method === 'GET') {
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
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        } else {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: 'QR Code belum tersedia', 
                message: 'QR code akan muncul saat server pertama kali dijalankan. Silakan refresh halaman ini dalam beberapa saat.',
                clientReady: client.info ? true : false 
            }));
        }
        return;
    }

    // Root endpoint - API Info
    if (pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            message: 'WhatsApp Web JS API Server',
            version: '1.0.0',
            clientReady: client.info ? true : false,
            endpoints: {
                'GET /qr': 'Display QR code as HTML page (for Railway deployment)',
                'POST /send-message': 'Send text message (supports reply)',
                'POST /send-media': 'Send media files (image, video, document, audio)',
                'GET /health': 'Health check status'
            },
            documentation: 'See API_DOCUMENTATION.md for detailed usage',
            timestamp: Date.now()
        }));
        return;
    }

    // Health check
    if (pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            timestamp: Date.now(),
            clientReady: client.info ? true : false
        }));
        return;
    }

    // Serve media files
    if (pathname.startsWith('/media/') && req.method === 'GET') {
        const filename = pathname.replace('/media/', '');
        const filePath = path.join(MEDIA_FOLDER, filename);
        
        // Security: prevent directory traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid filename' }));
            return;
        }
        
        if (!fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
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
            
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400' // Cache 24 hours
            });
            res.end(file);
        } catch (err) {
            console.error('❌ Error serving media:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error reading file' }));
        }
        return;
    }

    // Send message endpoint (Protected with API Key)
    if (pathname === '/send-message' && req.method === 'POST') {
        // Check API Key
        const authResult = await new Promise((resolve) => {
            authenticate(req, res, () => resolve(true));
        });
        if (!authResult) return;
        
        try {
            const body = await parseBody(req);
            const { action, to, message, delay, simulateTyping, typingDuration, quotedMessageId, mentions } = body;

            if (!to || !message) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required fields: to, message' }));
                return;
            }

            if (!client.info) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'WhatsApp client not ready' }));
                return;
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
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        error: 'Failed to reply. Make sure quotedMessageId is in serialized format (e.g., false_628xxx@c.us_3EBxxx). Received: ' + quotedMessageId,
                        hint: 'For group messages, use action:"sendText" without quotedMessageId, or include the full serialized message ID from webhook'
                    }));
                    return;
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
                        console.log(`📢 Sending to Channel/Newsletter: ${to}`);
                        // For channels, we need to use a different approach
                        // Get the chat first
                        const chat = await client.getChatById(to);
                        sentMessage = await chat.sendMessage(message);
                    } else {
                        sentMessage = await client.sendMessage(to, message, options);
                    }
                } catch (sendError) {
                    console.error('❌ Error in sendMessage:', sendError.message);
                    // If it's a channel error, provide specific message
                    if (to.includes('@newsletter') && sendError.message.includes('getLastMsgKeyForAction')) {
                        throw new Error(`Failed to send to Channel/Newsletter. This feature may not be fully supported by whatsapp-web.js. Error: ${sendError.message}`);
                    }
                    throw sendError;
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                messageId: sentMessage.id.id,
                timestamp: Date.now(),
                to: to,
                delayed: delay ? true : false,
                delayMs: delay || 0,
                typingSimulated: simulateTyping ? true : false
            }));

        } catch (error) {
            console.error('❌ Error sending message:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Send media endpoint (Protected with API Key)
    if (pathname === '/send-media' && req.method === 'POST') {
        // Check API Key
        const authResult = await new Promise((resolve) => {
            authenticate(req, res, () => resolve(true));
        });
        if (!authResult) return;
        
        try {
            const body = await parseBody(req);
            const { action, to, type, mimetype, filename, data, caption, delay, simulateTyping, typingDuration, sendAsVoice, sendAsSticker, sendAsDocument, quotedMessageId } = body;

            if (!to || !data) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required fields: to, data' }));
                return;
            }

            if (!client.info) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'WhatsApp client not ready' }));
                return;
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
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        error: 'Failed to download file from URL',
                        details: downloadError.message,
                        url: data
                    }));
                    return;
                }
            } else {
                // Use provided base64 data
                console.log(`📎 Using provided base64 data`);
                mediaData = data;
                mediaMimetype = mimetype;
                mediaFilename = filename || 'file';
            }

            if (!mediaMimetype) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing mimetype. Provide mimetype or use a URL that returns Content-Type header' }));
                return;
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

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
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
            }));

        } catch (error) {
            console.error('❌ Error sending media:', error);
            console.error('Stack trace:', error.stack);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: error.message,
                type: error.name,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }));
        }
        return;
    }

    // Default response
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /qr',
            'GET /health',
            'GET /media/:filename',
            'POST /send-message',
            'POST /send-media'
        ]
    }));
});

// Start server and client
server.listen(API_PORT, () => {
    console.log('🚀 Memulai WhatsApp Web Client dengan API Server...');
    console.log(`🌐 API akan tersedia di port ${API_PORT}`);
    console.log('⏳ Menunggu QR Code...');
});

client.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Menutup client...');
    await client.destroy();
    server.close();
    process.exit(0);
});
