const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { CONFIG } = require('../config');
const { requireAuth } = require('../middleware/auth');
const dashboard = require('../views/dashboard');
const lists = require('../views/lists');
const { getConfig: getWebhookConfig, updateConfig: updateWebhookConfig, testWebhook } = require('../utils/webhook');

// Flash messages helper
const flashMessages = new Map();

function setFlash(sessionId, type, message) {
    if (!flashMessages.has(sessionId)) {
        flashMessages.set(sessionId, []);
    }
    flashMessages.get(sessionId).push({ type, message });
    setTimeout(() => {
        if (flashMessages.has(sessionId)) {
            const msgs = flashMessages.get(sessionId);
            const idx = msgs.findIndex(m => m.type === type && m.message === message);
            if (idx > -1) msgs.splice(idx, 1);
        }
    }, 300000);
}

function getFlash(sessionId) {
    const msgs = flashMessages.get(sessionId) || [];
    flashMessages.delete(sessionId);
    return msgs;
}

// Pagination config
const ITEMS_PER_PAGE = 20;

// Store current QR code data (shared with main server)
let qrData = {
    currentQRCode: null,
    qrCodeTimestamp: null
};

// Function to update QR data (called from main server)
function updateQRData(qr, timestamp) {
    qrData.currentQRCode = qr;
    qrData.qrCodeTimestamp = timestamp;
}

// Admin Login Page
router.get('/login', (req, res) => {
    if (req.session.isAdmin) {
        return res.redirect('/admin/dashboard');
    }
    res.send(dashboard.getLoginPage(req.query.error === '1'));
});

// Admin Login POST
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === CONFIG.ADMIN_USERNAME && password === CONFIG.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        req.session.loginTime = new Date().toISOString();
        return res.redirect('/admin/dashboard');
    }
    
    res.redirect('/admin/login?error=1');
});

// Admin Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// Change Password Page
router.get('/change-password', requireAuth, (req, res) => {
    res.send(dashboard.getChangePasswordPage());
});

// Change Password POST
router.post('/change-password', requireAuth, (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    // Validasi
    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.send(dashboard.getChangePasswordPage('Semua field harus diisi'));
    }
    
    if (currentPassword !== CONFIG.ADMIN_PASSWORD) {
        return res.send(dashboard.getChangePasswordPage('Password saat ini salah'));
    }
    
    if (newPassword.length < 6) {
        return res.send(dashboard.getChangePasswordPage('Password baru minimal 6 karakter'));
    }
    
    if (newPassword !== confirmPassword) {
        return res.send(dashboard.getChangePasswordPage('Konfirmasi password tidak cocok'));
    }
    
    // Update password (di memory saja, untuk permanent perlu update env var)
    CONFIG.ADMIN_PASSWORD = newPassword;
    
    // Log untuk informasi
    console.log('🔑 Admin password changed successfully');
    console.log('⚠️  Note: Password will reset to default on server restart unless updated in environment variables');
    
    res.send(dashboard.getChangePasswordPage(null, true));
});

// Refresh QR Code
router.post('/refresh-qr', requireAuth, async (req, res) => {
    const client = req.app.get('whatsappClient');
    
    if (!client) {
        return res.json({ success: false, error: 'WhatsApp client not available' });
    }
    
    try {
        // If client is already ready, logout first to get new QR
        if (client.info) {
            console.log('🔄 Logging out to generate new QR code...');
            await client.logout();
            console.log('✅ Logout successful, new QR code will be generated');
        } else {
            console.log('🔄 QR refresh requested - new QR will be generated automatically');
        }
        
        res.json({ success: true, message: 'QR code refresh initiated. Please wait...' });
    } catch (err) {
        console.error('Error refreshing QR:', err);
        res.json({ success: false, error: err.message });
    }
});

// Admin Dashboard
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const client = req.app.get('whatsappClient');
        const isClientReady = client && client.info ? true : false;
        
        let clientInfo = null;
        let stats = null;
        let qrBase64 = null;
        
        if (isClientReady) {
            clientInfo = client.info;
            
            try {
                const chats = await client.getChats();
                const groups = chats.filter(c => c.isGroup);
                const contacts = await client.getContacts();
                
                stats = {
                    chats: chats.length,
                    groups: groups.length,
                    contacts: contacts.filter(c => c.isUser).length,
                    mediaFiles: fs.readdirSync(CONFIG.MEDIA_FOLDER).length
                };
            } catch (e) {
                console.error('Error fetching stats:', e.message);
            }
        } else if (qrData.currentQRCode) {
            // Generate QR base64 for display
            const qrPath = path.join(CONFIG.MEDIA_FOLDER, 'qrcode.png');
            if (fs.existsSync(qrPath)) {
                qrBase64 = fs.readFileSync(qrPath, 'base64');
            }
        }
        
        res.send(dashboard.getDashboardPage({
            isClientReady,
            clientInfo,
            currentQRCode: qrBase64,
            qrCodeTimestamp: qrData.qrCodeTimestamp,
            stats,
            apiKey: CONFIG.API_KEY
        }));
    } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.status(500).send('Error loading dashboard');
    }
});

// Chats List Page with Pagination
router.get('/chats', requireAuth, async (req, res) => {
    try {
        const client = req.app.get('whatsappClient');
        if (!client || !client.info) {
            return res.status(503).send('WhatsApp client not ready');
        }

        const page = parseInt(req.query.page) || 1;
        const search = req.query.search || '';
        
        const allChats = await client.getChats();
        
        // Filter by search
        let filteredChats = allChats;
        if (search) {
            filteredChats = allChats.filter(chat =>
                chat.name?.toLowerCase().includes(search.toLowerCase())
            );
        }
        
        // Pagination
        const totalCount = filteredChats.length;
        const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const paginatedChats = filteredChats.slice(startIndex, startIndex + ITEMS_PER_PAGE);
        
        const formattedChats = paginatedChats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name,
            isGroup: chat.isGroup
        }));
        
        res.send(lists.getChatsListPage({
            chats: formattedChats,
            currentPage: page,
            totalPages,
            totalCount,
            searchQuery: search
        }));
    } catch (error) {
        console.error('Error fetching chats list:', error);
        res.status(500).send('Error loading chats');
    }
});

// Groups List Page with Pagination
router.get('/groups', requireAuth, async (req, res) => {
    try {
        const client = req.app.get('whatsappClient');
        if (!client || !client.info) {
            return res.status(503).send('WhatsApp client not ready');
        }

        const page = parseInt(req.query.page) || 1;
        const search = req.query.search || '';
        
        const allChats = await client.getChats();
        let allGroups = allChats.filter(chat => chat.isGroup);
        
        // Filter by search
        if (search) {
            allGroups = allGroups.filter(group =>
                group.name?.toLowerCase().includes(search.toLowerCase())
            );
        }
        
        // Pagination
        const totalCount = allGroups.length;
        const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const paginatedGroups = allGroups.slice(startIndex, startIndex + ITEMS_PER_PAGE);
        
        const formattedGroups = paginatedGroups.map(group => ({
            id: group.id._serialized,
            name: group.name,
            participantCount: group.participants?.length || 0
        }));
        
        res.send(lists.getGroupsListPage({
            groups: formattedGroups,
            currentPage: page,
            totalPages,
            totalCount,
            searchQuery: search
        }));
    } catch (error) {
        console.error('Error fetching groups list:', error);
        res.status(500).send('Error loading groups');
    }
});

// Contacts List Page with Pagination
router.get('/contacts', requireAuth, async (req, res) => {
    try {
        const client = req.app.get('whatsappClient');
        if (!client || !client.info) {
            return res.status(503).send('WhatsApp client not ready');
        }

        const page = parseInt(req.query.page) || 1;
        const search = req.query.search || '';
        
        let allContacts = await client.getContacts();
        allContacts = allContacts.filter(c => c.number); // Only with numbers
        
        // Filter by search
        if (search) {
            allContacts = allContacts.filter(contact =>
                (contact.name?.toLowerCase().includes(search.toLowerCase())) ||
                (contact.number?.includes(search))
            );
        }
        
        // Pagination
        const totalCount = allContacts.length;
        const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const paginatedContacts = allContacts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
        
        const formattedContacts = paginatedContacts.map(contact => ({
            id: contact.id._serialized,
            name: contact.name,
            pushname: contact.pushname,
            number: contact.number,
            isBusiness: contact.isBusiness
        }));
        
        res.send(lists.getContactsListPage({
            contacts: formattedContacts,
            currentPage: page,
            totalPages,
            totalCount,
            searchQuery: search
        }));
    } catch (error) {
        console.error('Error fetching contacts list:', error);
        res.status(500).send('Error loading contacts');
    }
});

// Media Files List Page with Pagination
router.get('/media', requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        
        // Get all files from media folder
        const files = fs.readdirSync(CONFIG.MEDIA_FOLDER)
            .filter(file => !file.startsWith('temp_')) // Exclude temp files
            .map(file => {
                const filePath = path.join(CONFIG.MEDIA_FOLDER, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    size: stats.size,
                    mtime: stats.mtime
                };
            })
            .sort((a, b) => b.mtime - a.mtime); // Sort by newest first
        
        // Pagination
        const totalCount = files.length;
        const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const paginatedFiles = files.slice(startIndex, startIndex + ITEMS_PER_PAGE);
        
        res.send(lists.getMediaListPage({
            files: paginatedFiles,
            currentPage: page,
            totalPages,
            totalCount
        }));
    } catch (error) {
        console.error('Error fetching media list:', error);
        res.status(500).send('Error loading media files');
    }
});

// Webhook Settings Page
router.get('/webhook-settings', requireAuth, (req, res) => {
    const config = getWebhookConfig();
    const flash = getFlash(req.sessionID);
    res.send(dashboard.getWebhookSettingsPage(config, flash));
});

// Webhook Settings POST - Update configuration
router.post('/webhook-settings', requireAuth, (req, res) => {
    const { webhookUrl, enabled, message_create, message_revoke, group_join, group_leave, secret } = req.body;
    
    const newConfig = {
        url: webhookUrl?.trim() || '',
        enabled: enabled === 'on',
        events: {
            message_create: message_create === 'on',
            message_revoke: message_revoke === 'on',
            group_join: group_join === 'on',
            group_leave: group_leave === 'on'
        },
        secret: secret?.trim() || ''
    };
    
    const success = updateWebhookConfig(newConfig);
    
    if (success) {
        setFlash(req.sessionID, 'success', 'Webhook settings saved successfully!');
        console.log('✅ Webhook settings updated:', newConfig.url || '(empty)');
    } else {
        setFlash(req.sessionID, 'error', 'Failed to save webhook settings');
    }
    
    res.redirect('/admin/webhook-settings');
});

// Test Webhook API
router.post('/webhook-test', requireAuth, async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.json({ success: false, error: 'Webhook URL is required' });
    }
    
    console.log('🧪 Testing webhook:', url);
    const result = await testWebhook(url);
    
    if (result.success) {
        console.log('✅ Webhook test successful:', result.status);
    } else {
        console.log('❌ Webhook test failed:', result.error);
    }
    
    res.json(result);
});

module.exports = {
    router,
    updateQRData
};
