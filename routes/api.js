const express = require('express');
const router = express.Router();
const { MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');
const { CONFIG, getBaseURL } = require('../config');
const { authenticateAPI } = require('../middleware/auth');

// Convert audio to OGG Opus (required format for WhatsApp voice notes)
function convertToOggOpus(inputPath) {
    const outputPath = inputPath.replace(/\.[^/.]+$/, '') + '_converted.ogg';
    try {
        execSync(`ffmpeg -y -i "${inputPath}" -c:a libopus -b:a 64k -ar 48000 -ac 1 "${outputPath}"`, {
            timeout: 60000,
            stdio: 'pipe'
        });
        console.log(`✅ Audio converted to OGG Opus: ${outputPath}`);
        return outputPath;
    } catch (err) {
        console.error('❌ ffmpeg conversion failed:', err.message);
        return null;
    }
}

// Download file from URL
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
            if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
                throw new Error(`File too large: ${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB. Max 50MB allowed.`);
            }
        } catch (headError) {
            console.log('⚠️ Could not get file size, continuing anyway...');
        }
        
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 60000,
            maxContentLength: 50 * 1024 * 1024,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const contentType = response.headers['content-type'];
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const filename = pathname.split('/').pop() || 'file';
        
        console.log(`✅ File downloaded: ${filename}, Size: ${(base64.length / 1024).toFixed(2)}KB`);
        
        return {
            data: base64,
            mimetype: contentType || 'application/octet-stream',
            filename: filename
        };
    } catch (error) {
        console.error('❌ Error downloading file:', error.message);
        throw new Error(`Failed to download file from URL: ${error.message}`);
    }
}

// Get all chats
router.get('/chats', authenticateAPI, async (req, res) => {
    try {
        const client = req.app.get('whatsappClient');
        if (!client || !client.info) {
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

// Get all groups
router.get('/groups', authenticateAPI, async (req, res) => {
    try {
        const client = req.app.get('whatsappClient');
        if (!client || !client.info) {
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
            } catch (e) {}

            return {
                id: group.id._serialized,
                name: group.name,
                description: group.description || null,
                participants: participants,
                participantCount: participants.length,
                isMuted: group.isMuted,
                unreadCount: group.unreadCount,
                timestamp: group.timestamp
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

// Get all contacts
router.get('/contacts', authenticateAPI, async (req, res) => {
    try {
        const client = req.app.get('whatsappClient');
        if (!client || !client.info) {
            return res.status(503).json({ error: 'WhatsApp client not ready' });
        }

        const contacts = await client.getContacts();
        const formattedContacts = contacts
            .filter(contact => contact.number)
            .map(contact => ({
                id: contact.id._serialized,
                number: contact.number,
                name: contact.name || contact.pushname || null,
                pushname: contact.pushname || null,
                isBusiness: contact.isBusiness,
                isMyContact: contact.isMyContact,
                isUser: contact.isUser
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

// Get all channels
router.get('/channels', authenticateAPI, async (req, res) => {
    try {
        const client = req.app.get('whatsappClient');
        if (!client || !client.info) {
            return res.status(503).json({ error: 'WhatsApp client not ready' });
        }

        const chats = await client.getChats();
        const channels = chats.filter(chat =>
            chat.id && chat.id._serialized && chat.id._serialized.includes('@newsletter')
        );

        const formattedChannels = channels.map(channel => ({
            id: channel.id?._serialized || 'unknown',
            name: channel.name || 'Unknown Channel',
            description: channel.description || null,
            subscriberCount: channel.subscriberCount || null,
            isMuted: channel.isMuted || false,
            unreadCount: channel.unreadCount || 0
        }));

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

// Get info about logged in user
router.get('/me', authenticateAPI, async (req, res) => {
    try {
        const client = req.app.get('whatsappClient');
        if (!client || !client.info) {
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
                isBusiness: me.isBusiness || false
            }
        });
    } catch (error) {
        console.error('❌ Error fetching user info:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Send message
router.post('/send-message', authenticateAPI, async (req, res) => {
    try {
        const client = req.app.get('whatsappClient');
        if (!client || !client.info) {
            return res.status(503).json({ error: 'WhatsApp client not ready' });
        }

        const { action, to, message, delay, simulateTyping, typingDuration, quotedMessageId, mentions } = req.body;

        if (!to || !message) {
            return res.status(400).json({ error: 'Missing required fields: to, message' });
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

        // Check if target is a channel (@newsletter)
        const isChannel = to.includes('@newsletter');
        
        if (isChannel) {
            // For channels, try different approaches
            try {
                // Method 1: Try to get the chat and use channel.sendMessage()
                const chat = await client.getChatById(to);
                sentMessage = await chat.sendMessage(message);
            } catch (channelError) {
                console.log('⚠️ Method 1 failed for channel, trying method 2:', channelError.message);
                try {
                    // Method 2: Try using client.sendMessage directly (works in some versions)
                    sentMessage = await client.sendMessage(to, message, options);
                } catch (method2Error) {
                    console.log('⚠️ Method 2 also failed for channel:', method2Error.message);
                    // Method 3: Try fetching channel directly
                    try {
                        const chats = await client.getChats();
                        const channelChat = chats.find(c => c.id._serialized === to);
                        if (channelChat && channelChat.sendMessage) {
                            sentMessage = await channelChat.sendMessage(message);
                        } else {
                            throw new Error('Channel not found in chat list');
                        }
                    } catch (method3Error) {
                        console.error('❌ All methods failed for channel:', method3Error);
                        return res.status(400).json({ 
                            error: 'Failed to send message to channel. Channel may not be accessible.',
                            details: method3Error.message
                        });
                    }
                }
            }
        } else if (action === 'sendReply' && quotedMessageId) {
            // Regular chat with reply
            try {
                // Try to get message by id (support both id formats)
                let quotedMsg;
                
                try {
                    quotedMsg = await client.getMessageById(quotedMessageId);
                } catch (error) {
                    console.log(`⚠️ Fallback: Trying to find message with serialized ID`);
                    
                    // Fallback: Search through messages in the chat
                    const chat = await client.getChatById(to);
                    const messages = await chat.fetchMessages({ limit: 50 });
                    quotedMsg = messages.find(msg => 
                        msg.id._serialized === quotedMessageId || 
                        msg.id.id === quotedMessageId
                    );
                    
                    if (!quotedMsg) {
                        throw new Error('Message not found');
                    }
                }
                
                sentMessage = await quotedMsg.reply(message, to);
            } catch (replyError) {
                console.error('❌ Error replying to message:', replyError);
                return res.status(400).json({ 
                    error: 'Failed to reply. Make sure quotedMessageId is valid.',
                    hint: 'Use serialized message ID from webhook',
                    details: replyError.message
                });
            }
        } else {
            // Regular chat without reply
            const chatOptions = {};
            if (mentions && Array.isArray(mentions)) {
                chatOptions.mentions = mentions;
            }
            
            sentMessage = await client.sendMessage(to, message, chatOptions);
        }

        res.json({
            success: true,
            messageId: sentMessage.id.id,
            timestamp: Date.now(),
            to: to,
            delayed: delay ? true : false,
            typingSimulated: simulateTyping ? true : false
        });

    } catch (error) {
        console.error('❌ Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send media
router.post('/send-media', authenticateAPI, async (req, res) => {
    try {
        const client = req.app.get('whatsappClient');
        if (!client || !client.info) {
            return res.status(503).json({ error: 'WhatsApp client not ready' });
        }

        const { to, type, mimetype, filename, data, caption, delay, simulateTyping, typingDuration, sendAsVoice, sendAsDocument, quotedMessageId } = req.body;

        if (!to || !data) {
            return res.status(400).json({ error: 'Missing required fields: to, data' });
        }

        // Simulate typing if requested (wrapped in try-catch so failure doesn't block sending)
        if (simulateTyping && typingDuration) {
            try {
                const chat = await client.getChatById(to);
                await chat.sendStateTyping();
                await new Promise(resolve => setTimeout(resolve, typingDuration));
                await chat.clearState();
            } catch (typingError) {
                console.log('⚠️ simulateTyping gagal, lanjut kirim media:', typingError.message);
            }
        }

        // Delay if requested
        if (delay && delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        let mediaData, mediaMimetype, mediaFilename;

        // Check if data is URL or base64
        if (data.startsWith('http://') || data.startsWith('https://')) {
            try {
                const downloaded = await downloadFileFromURL(data);
                mediaData = downloaded.data;
                mediaMimetype = mimetype || downloaded.mimetype;
                mediaFilename = filename || downloaded.filename;
            } catch (downloadError) {
                return res.status(400).json({ 
                    error: 'Failed to download file from URL',
                    details: downloadError.message
                });
            }
        } else {
            mediaData = data;
            mediaMimetype = mimetype;
            mediaFilename = filename || 'file';
        }

        if (!mediaMimetype) {
            return res.status(400).json({ error: 'Missing mimetype' });
        }

        // Send options
        const options = { caption: caption || '' };
        if (sendAsVoice) options.sendAudioAsVoice = true;
        if (sendAsDocument) options.sendMediaAsDocument = true;

        console.log(`📤 Sending media: ${mediaFilename}, mimetype: ${mediaMimetype}, sendAsVoice: ${!!sendAsVoice}`);

        // Save to temp file with correct extension
        const tempFilePath = path.join(CONFIG.MEDIA_FOLDER, `temp_${Date.now()}_${mediaFilename}`);
        fs.writeFileSync(tempFilePath, mediaData, 'base64');

        let finalFilePath = tempFilePath;
        let finalMimetype = mediaMimetype;
        let convertedPath = null;

        // Auto-convert audio to OGG Opus for sendAsVoice (WhatsApp only accepts OGG/Opus for voice notes)
        if (sendAsVoice && mediaMimetype && mediaMimetype.startsWith('audio/') && !mediaMimetype.includes('ogg')) {
            console.log(`🔄 Converting audio to OGG Opus for voice note compatibility...`);
            convertedPath = convertToOggOpus(tempFilePath);
            if (convertedPath) {
                finalFilePath = convertedPath;
                finalMimetype = 'audio/ogg; codecs=opus';
                console.log(`✅ Using converted OGG Opus file`);
            } else {
                console.log(`⚠️ Conversion failed, trying original file...`);
            }
        }

        let media;
        try {
            media = MessageMedia.fromFilePath(finalFilePath);
            media.filename = mediaFilename;
            if (finalMimetype) media.mimetype = finalMimetype;
        } catch (fileError) {
            console.log('⚠️ fromFilePath gagal, fallback ke base64:', fileError.message);
            media = new MessageMedia(finalMimetype || mediaMimetype, mediaData, mediaFilename);
        }

        let sentMessage;

        if (quotedMessageId) {
            try {
                const quotedMsg = await client.getMessageById(quotedMessageId);
                sentMessage = await quotedMsg.reply(media, to, options);
            } catch (replyError) {
                console.log('⚠️ Reply gagal, kirim sebagai pesan baru:', replyError.message);
                sentMessage = await client.sendMessage(to, media, options);
            }
        } else {
            sentMessage = await client.sendMessage(to, media, options);
        }

        // Clean up temp files
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
        if (convertedPath) { try { fs.unlinkSync(convertedPath); } catch (e) {} }

        res.json({
            success: true,
            messageId: sentMessage.id.id,
            timestamp: Date.now(),
            to: to,
            filename: mediaFilename,
            mimetype: mediaMimetype,
            delayed: delay ? true : false,
            typingSimulated: simulateTyping ? true : false
        });

    } catch (error) {
        console.error('❌ Error sending media:', error);
        res.status(500).json({ error: error.message });
    }
});

// Forward message
// Body: { messageId?, chatId?, to (string|array), limit? }
// - messageId: forward a specific message by its serialized ID
// - chatId: forward the latest `limit` messages from a chat (default 1)
// - to: single chatId string or array of chatId strings
router.post('/forward-message', authenticateAPI, async (req, res) => {
    try {
        const client = req.app.get('whatsappClient');
        if (!client || !client.info) {
            return res.status(503).json({ error: 'WhatsApp client not ready' });
        }

        const { messageId, chatId, to, limit = 1 } = req.body;

        // Validate: need a source
        if (!messageId && !chatId) {
            return res.status(400).json({ error: 'Missing required field: messageId or chatId' });
        }

        // Validate: need a destination
        if (!to) {
            return res.status(400).json({ error: 'Missing required field: to' });
        }

        // Normalize destinations to array
        const destinations = Array.isArray(to) ? to : [to];
        if (destinations.length === 0) {
            return res.status(400).json({ error: 'Field "to" must not be empty' });
        }

        // Collect messages to forward
        let messagesToForward = [];

        if (messageId) {
            // Source: specific message by ID
            try {
                const msg = await client.getMessageById(messageId);
                if (!msg) throw new Error('Message not found');
                messagesToForward.push(msg);
            } catch (err) {
                return res.status(404).json({
                    error: 'Message not found',
                    details: err.message,
                    hint: 'Use serialized message ID (e.g. from webhook payload)'
                });
            }
        } else {
            // Source: latest N messages from a chat
            try {
                const chat = await client.getChatById(chatId);
                const fetchLimit = Math.min(Math.max(parseInt(limit) || 1, 1), 20); // cap at 20
                const messages = await chat.fetchMessages({ limit: fetchLimit });
                if (!messages || messages.length === 0) {
                    return res.status(404).json({ error: 'No messages found in the specified chat' });
                }
                messagesToForward = messages;
            } catch (err) {
                return res.status(404).json({
                    error: 'Chat not found or cannot fetch messages',
                    details: err.message
                });
            }
        }

        // Forward each message to each destination
        const results = [];
        let successCount = 0;
        let failCount = 0;

        for (const msg of messagesToForward) {
            for (const dest of destinations) {
                try {
                    const forwarded = await msg.forward(dest);
                    results.push({
                        success: true,
                        sourceMessageId: msg.id._serialized,
                        to: dest,
                        forwardedMessageId: forwarded?.id?._serialized || null,
                        type: msg.type,
                        hasMedia: msg.hasMedia
                    });
                    successCount++;
                } catch (fwdErr) {
                    results.push({
                        success: false,
                        sourceMessageId: msg.id._serialized,
                        to: dest,
                        error: fwdErr.message
                    });
                    failCount++;
                }
            }
        }

        res.json({
            success: failCount === 0,
            summary: {
                total: results.length,
                succeeded: successCount,
                failed: failCount
            },
            results
        });

    } catch (error) {
        console.error('❌ Error forwarding message:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
