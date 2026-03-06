// Configuration file
const path = require('path');

const CONFIG = {
    API_PORT: process.env.PORT || 3001,
    MEDIA_FOLDER: './media',
    API_KEY: process.env.API_KEY,
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
    SESSION_SECRET: process.env.SESSION_SECRET || 'whatsapp-web-secret-key-2025',
    WEBHOOK_URL: process.env.WEBHOOK_URL || 'https://cloud.activepieces.com/api/v1/webhooks/49mCt0eLl7F1pA7ey4dFH',
};

// Chrome executable paths for video support
const CHROME_EXECUTABLE_PATHS = {
    windows: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    windowsAlt: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    mac: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    linux: '/usr/bin/google-chrome-stable',
    linuxAlt: '/usr/bin/chromium-browser',
    railway: '/usr/bin/google-chrome-stable'
};

// Function to get base URL for media
function getBaseURL(req) {
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    }
    
    if (process.env.NGROK_URL) {
        return process.env.NGROK_URL;
    }
    
    if (req && req.headers && req.headers.host) {
        const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        return `${protocol}://${req.headers.host}`;
    }
    
    return `http://localhost:${CONFIG.API_PORT}`;
}

// Detect Chrome executable based on OS
function getChromeExecutablePath() {
    const fs = require('fs');
    const platform = process.platform;
    
    if (platform === 'win32') {
        if (fs.existsSync(CHROME_EXECUTABLE_PATHS.windows)) {
            return CHROME_EXECUTABLE_PATHS.windows;
        }
        if (fs.existsSync(CHROME_EXECUTABLE_PATHS.windowsAlt)) {
            return CHROME_EXECUTABLE_PATHS.windowsAlt;
        }
    } else if (platform === 'darwin') {
        if (fs.existsSync(CHROME_EXECUTABLE_PATHS.mac)) {
            return CHROME_EXECUTABLE_PATHS.mac;
        }
    } else if (platform === 'linux') {
        if (fs.existsSync(CHROME_EXECUTABLE_PATHS.linux)) {
            return CHROME_EXECUTABLE_PATHS.linux;
        }
        if (fs.existsSync(CHROME_EXECUTABLE_PATHS.linuxAlt)) {
            return CHROME_EXECUTABLE_PATHS.linuxAlt;
        }
    }
    
    return null;
}

module.exports = {
    CONFIG,
    CHROME_EXECUTABLE_PATHS,
    getBaseURL,
    getChromeExecutablePath
};
