const http = require('http');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_PORT = process.env.PORT || 3001;
const MEDIA_FOLDER = './media';

// Konfigurasi
const CONFIG = {
    WEBHOOK_URL: process.env.WEBHOOK_URL || 'https://cloud.activepieces.com/api/v1/webhooks/49mCt0eLl7F1pA7ey4dFH',
    MEDIA_FOLDER: './media',
    NGROK_URL: process.env.NGROK_URL || ''
};

// Buat folder media jika belum ada
if (!fs.existsSync(MEDIA_FOLDER)) {
    fs.mkdirSync(MEDIA_FOLDER, { recursive: true });
}

// Inisialisasi client dengan LocalAuth untuk menyimpan session
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
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
        const timestamp = Date.now();
        const extension = media.mimetype.split('/')[1]?.split(';')[0] || 'bin';
        const filename = `${message.id.id}_${timestamp}.${extension}`;
        const filepath = path.join(MEDIA_FOLDER, filename);
        fs.writeFileSync(filepath, media.data, 'base64');
        console.log(`💾 Media disimpan: ${filepath}`);
        return { filename, mimetype: media.mimetype, filepath, size: media.data.length };
    } catch (error) {
        console.error('❌ Error downloading media:', error);
        return null;
    }
}

// Fungsi untuk kirim webhook
async function sendWebhook(data) {
    try {
        const response = await axios.post(CONFIG.WEBHOOK_URL, data, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });
        console.log(`📤 Webhook terkirim! Status: ${response.status}`);
    } catch (error) {
        console.error('❌ Error sending webhook:', error.message);
    }
}

// Fungsi untuk download file dari URL
async function downloadFileFromURL(url) {
    try {
        console.log(`📥 Downloading file from: ${url}`);
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 60000,
            maxContentLength: 50 * 1024 * 1024,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const contentType = response.headers['content-type'];
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        const urlObj = new URL(url);
        const filename = urlObj.pathname.split('/').pop() || 'file';
        console.log(`✅ File downloaded: ${filename}, Size: ${(base64.length / 1024).toFixed(2)}KB`);
        return { data: base64, mimetype: contentType || 'application/octet-stream', filename };
    } catch (error) {
        console.error('❌ Error downloading file:', error.message);
        throw new Error(`Failed to download file from URL: ${error.message}`);
    }
}

// Event: Message Create
client.on('message_create', async (message) => {
    try {
        console.log(`📩 Pesan dari ${message.from}: ${message.body?.substring(0, 50)}...`);
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
        if (message.hasMedia) {
            console.log('📎 Media terdeteksi, mendownload...');
            const mediaInfo = await downloadMedia(message);
            if (mediaInfo) {
                const mediaUrl = CONFIG.NGROK_URL ? `${CONFIG.NGROK_URL}/media/${mediaInfo.filename}` : `/media/${mediaInfo.filename}`;
                payload.message.media = { url: mediaUrl, filename: mediaInfo.filename, mimetype: mediaInfo.mimetype, size: mediaInfo.size, localPath: mediaInfo.filepath };
                console.log(`🔗 Media URL: ${mediaUrl}`);
            }
        }
        await sendWebhook(payload);
    } catch (error) {
        console.error('❌ Error processing message:', error);
    }
});

// Event: Message Revoke
client.on('message_revoke_everyone', async (after, before) => {
    const payload = {
        event: 'message_revoke',
        timestamp: Date.now(),
        message: { id: after.id.id, from: after.from, body: after.body, revokedAt: Date.now() }
    };
    await sendWebhook(payload);
});

// Parse JSON body
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch (e) { reject(e); }
        });
    });
}

// API Server
const server = http.createServer(async (req, res) => {
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

    // Root endpoint
    if (pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            message: 'WhatsApp Web JS API Server',
            version: '1.0.0',
            clientReady: client.info ? true : false,
            endpoints: {
                'POST /send-message': 'Send text message (supports reply)',
                'POST /send-media': 'Send media files (image, video, document, audio)',
                'GET /health': 'Health check status'
            },
            timestamp: Date.now()
        }));
        return;
    }

    // Health check
    if (pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now(), clientReady: client.info ? true : false }));
        return;
    }

    // Send message endpoint
    if (pathname === '/send-message' && req.method === 'POST') {
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
            if (simulateTyping && typingDuration) {
                const chat = await client.getChatById(to);
                await chat.sendStateTyping();
                await new Promise(resolve => setTimeout(resolve, typingDuration));
                await chat.clearState();
            }
            if (delay && delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
            let sentMessage;
            if (action === 'sendReply' && quotedMessageId) {
                try {
                    const quotedMsg = await client.getMessageById(quotedMessageId);
                    sentMessage = await quotedMsg.reply(message, to);
                } catch (replyError) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to reply. Make sure quotedMessageId is in serialized format', hint: 'Use full serialized message ID from webhook' }));
                    return;
                }
            } else {
                try {
                    const options = {};
                    if (mentions && Array.isArray(mentions)) options.mentions = mentions;
                    if (to.includes('@newsletter')) {
                        console.log(`📢 Sending to Channel/Newsletter: ${to}`);
                        const chat = await client.getChatById(to);
                        sentMessage = await chat.sendMessage(message);
                    } else {
                        sentMessage = await client.sendMessage(to, message, options);
                    }
                } catch (sendError) {
                    console.error('❌ Error in sendMessage:', sendError.message);
                    if (to.includes('@newsletter') && sendError.message.includes('getLastMsgKeyForAction')) {
                        throw new Error(`Failed to send to Channel/Newsletter. This feature may not be fully supported. Error: ${sendError.message}`);
                    }
                    throw sendError;
                }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, messageId: sentMessage.id.id, timestamp: Date.now(), to, delayed: delay ? true : false, delayMs: delay || 0, typingSimulated: simulateTyping ? true : false }));
        } catch (error) {
            console.error('❌ Error sending message:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Send media endpoint
    if (pathname === '/send-media' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { to, data, caption, delay, simulateTyping, typingDuration, sendAsVoice, sendAsSticker, sendAsDocument, quotedMessageId } = body;
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
            if (simulateTyping && typingDuration) {
                const chat = await client.getChatById(to);
                await chat.sendStateTyping();
                await new Promise(resolve => setTimeout(resolve, typingDuration));
                await chat.clearState();
            }
            if (delay && delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
            let mediaData, mediaMimetype, mediaFilename;
            if (data.startsWith('http://') || data.startsWith('https://')) {
                try {
                    console.log(`📥 Processing URL: ${data}`);
                    const downloaded = await downloadFileFromURL(data);
                    mediaData = downloaded.data;
                    mediaMimetype = body.mimetype || downloaded.mimetype;
                    mediaFilename = body.filename || downloaded.filename;
                    console.log(`✅ Download complete: ${mediaFilename}`);
                } catch (downloadError) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to download file from URL', details: downloadError.message }));
                    return;
                }
            } else {
                mediaData = data;
                mediaMimetype = body.mimetype;
                mediaFilename = body.filename || 'file';
            }
            if (!mediaMimetype) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing mimetype' }));
                return;
            }
            const options = { caption: caption || '' };
            if (sendAsVoice) options.sendAudioAsVoice = true;
            if (sendAsSticker) options.sendMediaAsSticker = true;
            if (sendAsDocument) options.sendMediaAsDocument = true;
            let sentMessage;
            const tempFilePath = path.join(MEDIA_FOLDER, `temp_${Date.now()}_${mediaFilename}`);
            try {
                fs.writeFileSync(tempFilePath, mediaData, 'base64');
                const mediaFromFile = MessageMedia.fromFilePath(tempFilePath);
                mediaFromFile.filename = mediaFilename;
                if (quotedMessageId) {
                    try {
                        const quotedMsg = await client.getMessageById(quotedMessageId);
                        sentMessage = await quotedMsg.reply(mediaFromFile, to, { caption: caption || '' });
                    } catch (replyError) {
                        console.error('❌ Error replying with media:', replyError.message);
                        sentMessage = await client.sendMessage(to, mediaFromFile, options);
                    }
                } else {
                    sentMessage = await client.sendMessage(to, mediaFromFile, options);
                }
                try { fs.unlinkSync(tempFilePath); } catch (e) {}
            } catch (fileError) {
                throw fileError;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, messageId: sentMessage.id.id, timestamp: Date.now(), to, filename: mediaFilename, mimetype: mediaMimetype, delayed: delay ? true : false, delayMs: delay || 0, typingSimulated: simulateTyping ? true : false, repliedTo: quotedMessageId || null }));
        } catch (error) {
            console.error('❌ Error sending media:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found', availableEndpoints: ['POST /send-message', 'POST /send-media', 'GET /health'] }));
});

server.listen(API_PORT, () => {
    console.log('🚀 Memulai WhatsApp Web Client dengan API Server...');
    console.log(`🌐 API akan tersedia di port ${API_PORT}`);
    console.log('⏳ Menunggu QR Code...');
});

client.initialize();

process.on('SIGINT', async () => {
    console.log('\n👋 Menutup client...');
    await client.destroy();
    server.close();
    process.exit(0);
});