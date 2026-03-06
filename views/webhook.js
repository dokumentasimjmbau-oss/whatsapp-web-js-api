// Webhook Settings Page HTML
const path = require('path');

function getWebhookSettingsPage(config, flash = []) {
    const flashHtml = flash.map(f => {
        const bgColor = f.type === 'success' ? '#d4edda' : '#fee';
        const textColor = f.type === 'success' ? '#155724' : '#c33';
        return `<div style="background: ${bgColor}; color: ${textColor}; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;">${f.message}</div>`;
    }).join('');

    const isEnabled = config.enabled ? 'checked' : '';
    const messageCreateChecked = config.events.message_create ? 'checked' : '';
    const messageRevokeChecked = config.events.message_revoke ? 'checked' : '';
    const groupJoinChecked = config.events.group_join ? 'checked' : '';
    const groupLeaveChecked = config.events.group_leave ? 'checked' : '';

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Webhook Settings - WhatsApp Web API</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
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
        .navbar h1 { font-size: 20px; display: flex; align-items: center; gap: 10px; }
        .navbar a {
            color: white;
            text-decoration: none;
            padding: 8px 16px;
            background: rgba(255,255,255,0.2);
            border-radius: 6px;
        }
        .container {
            max-width: 800px;
            margin: 30px auto;
            padding: 0 20px;
        }
        .card {
            background: white;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .card h2 {
            color: #333;
            margin-bottom: 10px;
            font-size: 24px;
        }
        .card p {
            color: #666;
            margin-bottom: 30px;
        }
        .form-group { margin-bottom: 25px; }
        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
        }
        input[type="text"], input[type="password"], input[type="number"] {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input[type="text"]:focus, input[type="password"]:focus, input[type="number"]:focus {
            outline: none;
            border-color: #667eea;
        }
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        }
        .checkbox-group input[type="checkbox"] {
            width: 20px;
            height: 20px;
            cursor: pointer;
        }
        .checkbox-group label {
            margin-bottom: 0;
            cursor: pointer;
        }
        .events-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        .events-section h3 {
            color: #333;
            margin-bottom: 15px;
            font-size: 16px;
        }
        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 60px;
            height: 34px;
        }
        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 34px;
        }
        .slider:before {
            position: absolute;
            content: "";
            height: 26px;
            width: 26px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }
        input:checked + .slider {
            background-color: #667eea;
        }
        input:checked + .slider:before {
            transform: translateX(26px);
        }
        .btn-primary {
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
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        }
        .btn-secondary {
            display: block;
            width: 100%;
            padding: 14px;
            background: #f0f0f0;
            color: #333;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            text-align: center;
            text-decoration: none;
            margin-top: 10px;
        }
        .btn-test {
            padding: 10px 20px;
            background: #25D366;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            margin-top: 10px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
        }
        .status-active {
            background: #d4edda;
            color: #155724;
        }
        .status-inactive {
            background: #f8d7da;
            color: #721c24;
        }
        .info-box {
            background: #e3f2fd;
            border-left: 4px solid #2196F3;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .info-box h4 {
            color: #1976D2;
            margin-bottom: 8px;
        }
        .info-box p {
            color: #555;
            margin: 0;
            font-size: 14px;
        }
        #testResult {
            margin-top: 10px;
            padding: 12px;
            border-radius: 8px;
            font-size: 14px;
            display: none;
        }
        .test-success {
            background: #d4edda;
            color: #155724;
        }
        .test-fail {
            background: #fee;
            color: #c33;
        }
        .webhook-url-display {
            background: #f0f0f0;
            padding: 12px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 13px;
            word-break: break-all;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <h1>🔗 Webhook Settings</h1>
        <a href="/admin/dashboard">← Kembali ke Dashboard</a>
    </nav>
    
    <div class="container">
        <div class="card">
            <h2>Configure Webhook URL</h2>
            <p>Set the webhook URL to receive WhatsApp event notifications</p>
            
            ${flashHtml}
            
            <div class="info-box">
                <h4>ℹ️ What is this?</h4>
                <p>Webhook will send POST requests to your URL when messages are received, revoked, or when users join/leave groups. You can use this to integrate with automation tools like Activepieces, Zapier, or your own server.</p>
            </div>
            
            <form action="/admin/webhook-settings" method="POST">
                <div class="form-group">
                    <label>Current Configuration:</label>
                    <div class="webhook-url-display">
                        ${config.url || 'Not configured'} 
                        ${config.url ? `<span class="status-badge ${config.enabled ? 'status-active' : 'status-inactive'}">${config.enabled ? '● Active' : '● Paused'}</span>` : ''}
                    </div>
                </div>
                
                <div class="form-group">
                    <div class="checkbox-group">
                        <label class="toggle-switch">
                            <input type="checkbox" name="enabled" ${isEnabled}>
                            <span class="slider"></span>
                        </label>
                        <label for="enabled" style="margin-left: 10px;"><strong>Enable Webhook</strong></label>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="webhookUrl">Webhook URL</label>
                    <input type="text" id="webhookUrl" name="webhookUrl" placeholder="https://example.com/webhook" value="${config.url}">
                    <button type="button" class="btn-test" onclick="testWebhook()">🧪 Test Webhook</button>
                    <div id="testResult"></div>
                </div>
                
                <div class="events-section">
                    <h3>📢 Events to Send</h3>
                    <div class="checkbox-group">
                        <input type="checkbox" id="message_create" name="message_create" ${messageCreateChecked}>
                        <label for="message_create">Message Received (message_create)</label>
                    </div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="message_revoke" name="message_revoke" ${messageRevokeChecked}>
                        <label for="message_revoke">Message Revoked (message_revoke_everyone)</label>
                    </div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="group_join" name="group_join" ${groupJoinChecked}>
                        <label for="group_join">Group Join (group_join)</label>
                    </div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="group_leave" name="group_leave" ${groupLeaveChecked}>
                        <label for="group_leave">Group Leave (group_leave)</label>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="secret">Webhook Secret (Optional)</label>
                    <input type="password" id="secret" name="secret" placeholder="Leave empty for no signature" value="${config.secret}">
                    <small style="color: #666; display: block; margin-top: 5px;">Used to sign webhook payloads for verification</small>
                </div>
                
                <button type="submit" class="btn-primary">💾 Save Settings</button>
                <a href="/admin/dashboard" class="btn-secondary">Batal</a>
            </form>
        </div>
    </div>
    
    <script>
        async function testWebhook() {
            const url = document.getElementById('webhookUrl').value;
            const resultDiv = document.getElementById('testResult');
            
            if (!url) {
                resultDiv.style.display = 'block';
                resultDiv.className = 'test-fail';
                resultDiv.innerHTML = '❌ Please enter a webhook URL first';
                return;
            }
            
            resultDiv.style.display = 'block';
            resultDiv.className = '';
            resultDiv.innerHTML = '🔄 Testing webhook...';
            
            try {
                const response = await fetch('/admin/webhook-test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    resultDiv.className = 'test-success';
                    resultDiv.innerHTML = '✅ Webhook test successful!<br>Status: ' + data.status + '<br>Response: ' + JSON.stringify(data.data).substring(0, 200);
                } else {
                    resultDiv.className = 'test-fail';
                    resultDiv.innerHTML = '❌ Webhook test failed!<br>Error: ' + data.error + (data.status ? '<br>Status: ' + data.status : '');
                }
            } catch (err) {
                resultDiv.className = 'test-fail';
                resultDiv.innerHTML = '❌ Error: ' + err.message;
            }
        }
    </script>
</body>
</html>`;
}

module.exports = { getWebhookSettingsPage };
