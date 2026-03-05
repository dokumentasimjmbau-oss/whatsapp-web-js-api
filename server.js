const http = require('http');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const MEDIA_FOLDER = './media';
const PORT = 3002; // Port untuk file server

// Buat folder media jika belum ada
if (!fs.existsSync(MEDIA_FOLDER)) {
    fs.mkdirSync(MEDIA_FOLDER, { recursive: true });
}

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Parse URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Health check endpoint
    if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
        return;
    }

    // Media serving endpoint: /media/:filename
    if (pathname.startsWith('/media/')) {
        const filename = path.basename(pathname); // Prevent directory traversal
        const filepath = path.join(MEDIA_FOLDER, filename);

        // Check if file exists
        if (!fs.existsSync(filepath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
        }

        // Get MIME type
        const mimeType = mime.lookup(filepath) || 'application/octet-stream';

        // Read and serve file
        fs.readFile(filepath, (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Error reading file' }));
                return;
            }

            res.writeHead(200, { 
                'Content-Type': mimeType,
                'Content-Length': data.length,
                'Cache-Control': 'public, max-age=86400' // Cache 24 jam
            });
            res.end(data);
        });
        return;
    }

    // List media files
    if (pathname === '/media') {
        fs.readdir(MEDIA_FOLDER, (err, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Error reading directory' }));
                return;
            }

            const fileList = files.map(file => ({
                filename: file,
                url: `/media/${file}`,
                size: fs.statSync(path.join(MEDIA_FOLDER, file)).size
            }));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ files: fileList }));
        });
        return;
    }

    // Default response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        message: 'WhatsApp Web JS Media Server',
        endpoints: {
            health: '/health',
            media: '/media',
            file: '/media/:filename'
        }
    }));
});

server.listen(PORT, () => {
    console.log(`📁 File Server berjalan di port ${PORT}`);
    console.log(`📂 Media folder: ${path.resolve(MEDIA_FOLDER)}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`📋 List media: http://localhost:${PORT}/media`);
});

module.exports = server;