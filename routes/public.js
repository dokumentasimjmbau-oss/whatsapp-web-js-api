const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { CONFIG } = require('../config');

// QR Code Page (public access)
router.get('/qr', (req, res) => {
    const client = req.app.get('whatsappClient');
    const currentQRCode = req.app.get('currentQRCode');
    const qrCodeTimestamp = req.app.get('qrCodeTimestamp');
    
    const qrPath = path.join(CONFIG.MEDIA_FOLDER, 'qrcode.png');
    
    if (fs.existsSync(qrPath) && currentQRCode) {
        const qrBase64 = fs.readFileSync(qrPath, 'base64');
        const html = `<!DOCTYPE html>
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
            message: 'QR code akan muncul saat server pertama kali dijalankan.',
            clientReady: client && client.info ? true : false 
        });
    }
});

// Health Check
router.get('/health', (req, res) => {
    const client = req.app.get('whatsappClient');
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        clientReady: client && client.info ? true : false
    });
});

// Serve media files
router.get('/media/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(CONFIG.MEDIA_FOLDER, filename);
    
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
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(file);
    } catch (err) {
        console.error('❌ Error serving media:', err.message);
        res.status(500).json({ error: 'Error reading file' });
    }
});

// Root endpoint - API Info
router.get('/', (req, res) => {
    const client = req.app.get('whatsappClient');
    res.json({
        message: 'WhatsApp Web JS API Server',
        version: '1.0.0',
        clientReady: client && client.info ? true : false,
        endpoints: {
            'GET /qr': 'Display QR code as HTML page',
            'GET /admin/login': 'Admin Dashboard Login',
            'GET /admin/dashboard': 'Admin Dashboard (requires login)',
            'GET /health': 'Health check status',
            'POST /send-message': 'Send text message',
            'POST /send-media': 'Send media files'
        },
        timestamp: Date.now()
    });
});

module.exports = router;
