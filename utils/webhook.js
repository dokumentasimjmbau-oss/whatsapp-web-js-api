// Webhook configuration manager
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CONFIG_FILE = path.join(__dirname, '..', 'webhook-config.json');

// Default webhook config
const defaultConfig = {
    url: process.env.WEBHOOK_URL || '',
    enabled: true,
    events: {
        message_create: true,
        message_revoke: true,
        group_join: false,
        group_leave: false
    },
    secret: '', // For webhook signature verification (optional)
    retryAttempts: 3,
    timeout: 30000
};

// Load config from file
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            const savedConfig = JSON.parse(data);
            return { ...defaultConfig, ...savedConfig };
        }
    } catch (error) {
        console.error('❌ Error loading webhook config:', error.message);
    }
    return { ...defaultConfig };
}

// Save config to file
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Error saving webhook config:', error.message);
        return false;
    }
}

// Get current config
let webhookConfig = loadConfig();

// Update config
function updateConfig(newConfig) {
    webhookConfig = { ...webhookConfig, ...newConfig };
    return saveConfig(webhookConfig);
}

// Get current config (by reference)
function getConfig() {
    return webhookConfig;
}

// Test webhook
async function testWebhook(url) {
    const testPayload = {
        event: 'test',
        timestamp: Date.now(),
        message: {
            id: 'test-message-id',
            from: '628123456789@s.whatsapp.net',
            to: '628987654321@s.whatsapp.net',
            body: 'Test webhook message',
            type: 'test'
        }
    };

    try {
        const response = await axios.post(url, testPayload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'WhatsApp-Web-JS-Webhook/1.0'
            },
            timeout: 30000
        });

        return {
            success: true,
            status: response.status,
            data: response.data
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        };
    }
}

// Send webhook
async function sendWebhook(event, data) {
    const config = getConfig();

    // Check if webhook is configured and enabled
    if (!config.url || !config.enabled) {
        console.log('ℹ️ Webhook not configured or disabled');
        return { sent: false, reason: 'Not configured or disabled' };
    }

    // Check if event is enabled
    const eventKey = event.replace(/_/g, '_');
    if (!config.events[eventKey]) {
        console.log(`ℹ️ Webhook event ${event} is disabled`);
        return { sent: false, reason: 'Event disabled' };
    }

    const payload = {
        event,
        timestamp: Date.now(),
        ...data
    };

    // Add signature if secret is configured
    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'WhatsApp-Web-JS-Webhook/1.0'
    };

    if (config.secret) {
        const crypto = require('crypto');
        const signature = crypto
            .createHmac('sha256', config.secret)
            .update(JSON.stringify(payload))
            .digest('hex');
        headers['X-Webhook-Signature'] = signature;
    }

    let lastError;
    for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
        try {
            const response = await axios.post(config.url, payload, {
                headers,
                timeout: config.timeout
            });

            console.log(`📤 Webhook sent (${event})! Status: ${response.status}`);
            return {
                sent: true,
                status: response.status,
                attempts: attempt
            };
        } catch (error) {
            lastError = error;
            console.error(`❌ Webhook attempt ${attempt} failed:`, error.message);

            if (attempt < config.retryAttempts) {
                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, attempt - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    console.error(`❌ Webhook failed after ${config.retryAttempts} attempts:`, lastError.message);
    return {
        sent: false,
        error: lastError.message,
        status: lastError.response?.status,
        attempts: config.retryAttempts
    };
}

module.exports = {
    loadConfig,
    saveConfig,
    getConfig,
    updateConfig,
    testWebhook,
    sendWebhook,
    CONFIG_FILE
};
