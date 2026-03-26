// HTML Templates for Admin Dashboard

const { CONFIG } = require('../config');
const { getWebhookSettingsPage } = require('./webhook');

// Login Page HTML
function getLoginPage(error = false) {
    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - WhatsApp Web API</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
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
        h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
        p { color: #666; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; text-align: left; }
        label { display: block; margin-bottom: 8px; color: #333; font-weight: 500; }
        input {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input:focus { outline: none; border-color: #667eea; }
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
        .info strong { color: #333; }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">📱</div>
        <h1>WhatsApp Web API</h1>
        <p>Admin Dashboard Login</p>
        
        ${error ? '<div class="error">Username atau password salah!</div>' : ''}
        
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
</html>`;
}

// Dashboard Page HTML
function getDashboardPage({ isClientReady, clientInfo, currentQRCode, qrCodeTimestamp, stats, apiKey }) {
    let qrHtml = '';
    
    if (!isClientReady && currentQRCode) {
        qrHtml = `
            <div class="qr-section">
                <h2>📱 Scan QR Code</h2>
                <p>Scan QR code ini dengan WhatsApp mobile Anda untuk menghubungkan</p>
                <div class="qr-container">
                    <img src="data:image/png;base64,${currentQRCode}" alt="QR Code" width="300" height="300" id="qrImage">
                </div>
                <div class="qr-actions">
                    <button class="refresh-btn" onclick="refreshQR()" id="refreshBtn">🔄 Refresh QR Code</button>
                    <span class="qr-timestamp">Generated: ${new Date(qrCodeTimestamp).toLocaleString()}</span>
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
            </div>
        `;
    } else if (isClientReady) {
        qrHtml = `
            <div class="status-section success" id="connectedSection">
                <h2>✅ WhatsApp Terhubung</h2>
                <p>WhatsApp Web berhasil terhubung dan siap digunakan.</p>
                <div class="connection-info">
                    <p><strong>User:</strong> ${clientInfo.pushname}</p>
                    <p><strong>Nomor:</strong> ${clientInfo.wid.user}</p>
                    <p><strong>Platform:</strong> ${clientInfo.platform}</p>
                </div>
                <div style="margin-top:20px;">
                    <button class="logout-device-btn" onclick="logoutDevice()" id="logoutDeviceBtn">
                        🚪 Logout Device
                    </button>
                    <p style="color:#888;font-size:12px;margin-top:8px;">Hapus sesi WA dari server ini dan tampilkan QR code baru</p>
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
    
    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - WhatsApp Web API</title>
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
        .navbar h1 {
            font-size: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .navbar .user-menu {
            display: flex;
            align-items: center;
            gap: 15px;
            position: relative;
        }
        .dropdown {
            position: relative;
            display: inline-block;
        }
        .dropdown-btn {
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .dropdown-btn:hover { background: rgba(255,255,255,0.3); }
        .dropdown-content {
            display: none;
            position: absolute;
            right: 0;
            background: white;
            min-width: 200px;
            box-shadow: 0 8px 16px rgba(0,0,0,0.1);
            border-radius: 8px;
            z-index: 1000;
            margin-top: 5px;
        }
        .dropdown-content a, .dropdown-content button {
            color: #333;
            padding: 12px 16px;
            text-decoration: none;
            display: block;
            width: 100%;
            text-align: left;
            border: none;
            background: none;
            cursor: pointer;
            font-size: 14px;
        }
        .dropdown-content a:hover, .dropdown-content button:hover {
            background: #f5f5f5;
            border-radius: 8px;
        }
        .dropdown:hover .dropdown-content { display: block; }
        .container {
            max-width: 1200px;
            margin: 30px auto;
            padding: 0 20px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            text-decoration: none;
            display: block;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }
        .stat-icon { font-size: 30px; margin-bottom: 10px; }
        .stat-value { font-size: 32px; font-weight: bold; margin-bottom: 5px; }
        .stat-label { font-size: 14px; opacity: 0.9; }
        .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
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
        .qr-section { text-align: center; }
        .qr-section h2 { justify-content: center; }
        .qr-section p { color: #666; margin-bottom: 20px; }
        .qr-container {
            background: white;
            padding: 20px;
            border-radius: 12px;
            display: inline-block;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            margin-bottom: 15px;
        }
        .qr-container img { display: block; border-radius: 8px; }
        .qr-actions {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
        }
        .refresh-btn {
            padding: 10px 24px;
            background: #25D366;
            color: white;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .refresh-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(37, 211, 102, 0.4);
        }
        .refresh-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            pointer-events: none;
        }
        .qr-timestamp { color: #999; font-size: 12px; }
        .qr-instructions {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            text-align: left;
            max-width: 350px;
            margin: 0 auto;
        }
        .qr-instructions h4 { margin-bottom: 10px; color: #333; }
        .qr-instructions ol { padding-left: 20px; color: #666; }
        .qr-instructions li { margin: 8px 0; }
        .status-section { text-align: center; padding: 40px; }
        .status-section.success {
            background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
            border-radius: 12px;
        }
        .status-section.success h2 { color: #155724; justify-content: center; }
        .status-section.success p { color: #155724; margin-bottom: 20px; }
        .logout-device-btn {
            padding: 10px 24px;
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            color: white;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .logout-device-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(220, 53, 69, 0.4);
        }
        .logout-device-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .connection-info {
            background: white;
            padding: 20px;
            border-radius: 10px;
            display: inline-block;
            text-align: left;
        }
        .connection-info p { color: #333; margin: 8px 0; }
        .status-section.loading { text-align: center; }
        .status-section.loading h2 { color: #856404; justify-content: center; }
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
        .endpoints-list { list-style: none; }
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
        .api-key-section h3 { color: #856404; margin-bottom: 10px; }
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
            .dashboard-grid { grid-template-columns: 1fr; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <h1>📱 WhatsApp Web API Dashboard</h1>
        <div class="user-menu">
            <div class="dropdown">
                <button class="dropdown-btn">
                    👤 Admin ▼
                </button>
                <div class="dropdown-content">
                    <a href="/admin/webhook-settings">🔗 Webhook Settings</a>
                    <a href="/admin/change-password">🔑 Ganti Password</a>
                    <hr style="margin: 5px 0; border: none; border-top: 1px solid #eee;">
                    <a href="/admin/logout">🚪 Logout</a>
                </div>
            </div>
        </div>
    </nav>
    
    <div class="container">
        ${stats ? `
        <div class="stats-grid">
            <a href="/admin/chats" class="stat-card">
                <div class="stat-icon">💬</div>
                <div class="stat-value">${stats.chats}</div>
                <div class="stat-label">Total Chats →</div>
            </a>
            <a href="/admin/groups" class="stat-card">
                <div class="stat-icon">👥</div>
                <div class="stat-value">${stats.groups}</div>
                <div class="stat-label">Groups →</div>
            </a>
            <a href="/admin/contacts" class="stat-card">
                <div class="stat-icon">👤</div>
                <div class="stat-value">${stats.contacts}</div>
                <div class="stat-label">Contacts →</div>
            </a>
            <a href="/admin/media" class="stat-card">
                <div class="stat-icon">📁</div>
                <div class="stat-value">${stats.mediaFiles}</div>
                <div class="stat-label">Media Files →</div>
            </a>
        </div>
        ` : ''}
        
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
                    <code>Authorization: Bearer ${apiKey || 'Not set - API is open'}</code>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        let isConnected = ${isClientReady ? 'true' : 'false'};
        let lastQRTimestamp = ${qrCodeTimestamp || 'null'};
        
        // Function to update QR code image
        function updateQRCode(base64Data, timestamp) {
            const qrImage = document.getElementById('qrImage');
            const qrTimestamp = document.querySelector('.qr-timestamp');
            const btn = document.getElementById('refreshBtn');
            
            if (qrImage && base64Data) {
                qrImage.src = 'data:image/png;base64,' + base64Data;
                qrImage.style.opacity = '1';
                if (qrTimestamp) {
                    qrTimestamp.textContent = 'Generated: ' + new Date(timestamp).toLocaleString();
                }
                console.log('🔄 QR Code updated');
                
                // Reset button state when new QR appears
                if (btn && btn.disabled) {
                    btn.textContent = '🔄 Refresh QR Code';
                    btn.disabled = false;
                }
                
                // Clear timeout if QR appears
                if (qrRefreshTimeout) {
                    clearTimeout(qrRefreshTimeout);
                    qrRefreshTimeout = null;
                }
            }
        }
        
        // Function to show connected status
        function showConnectedStatus(clientInfo) {
            const qrSection = document.querySelector('.qr-section, .status-section.loading');
            if (qrSection) {
                qrSection.outerHTML = \`
                    <div class="status-section success" id="connectedSection">
                        <h2>✅ WhatsApp Terhubung</h2>
                        <p>WhatsApp Web berhasil terhubung dan siap digunakan.</p>
                        <div class="connection-info">
                            <p><strong>User:</strong> \${clientInfo.pushname}</p>
                            <p><strong>Nomor:</strong> \${clientInfo.wid}</p>
                            <p><strong>Platform:</strong> \${clientInfo.platform}</p>
                        </div>
                        <div style="margin-top:20px;">
                            <button class="logout-device-btn" onclick="logoutDevice()" id="logoutDeviceBtn">
                                🚪 Logout Device
                            </button>
                            <p style="color:#888;font-size:12px;margin-top:8px;">Hapus sesi WA dari server ini dan tampilkan QR code baru</p>
                        </div>
                    </div>
                \`;
                isConnected = true;
                console.log('✅ WhatsApp connected!');
            }
        }

        // Function to show disconnected / waiting QR status
        function showDisconnectedStatus() {
            const connectedSection = document.querySelector('.status-section.success, #connectedSection');
            if (connectedSection) {
                connectedSection.outerHTML = \`
                    <div class="status-section loading">
                        <h2>⏳ Menunggu QR Code...</h2>
                        <p>WA terputus. QR code akan muncul dalam beberapa saat...</p>
                        <div class="loading-spinner"></div>
                    </div>
                \`;
            }
            isConnected = false;
            wasConnected = false;
            console.log('⚠️ Showing disconnected state...');
        }

        // Function to logout device from dashboard
        async function logoutDevice() {
            const btn = document.getElementById('logoutDeviceBtn');
            if (!btn || btn.disabled) return;

            if (!confirm('Yakin ingin logout device ini? QR code baru akan muncul untuk scan ulang.')) return;

            btn.textContent = '⏳ Logging out...';
            btn.disabled = true;

            try {
                const response = await fetch('/admin/logout-device', { method: 'POST' });
                const data = await response.json();

                if (data.success) {
                    console.log('✅ Logout device success');
                    showDisconnectedStatus();
                    // Polling akan mendeteksi QR baru otomatis
                } else {
                    alert('Gagal logout device: ' + data.error);
                    btn.textContent = '🚪 Logout Device';
                    btn.disabled = false;
                }
            } catch (err) {
                console.error('Error:', err);
                alert('Terjadi kesalahan saat logout device');
                btn.textContent = '🚪 Logout Device';
                btn.disabled = false;
            }
        }
        
        // Function to refresh QR (without page reload)
        let qrRefreshTimeout = null;
        
        function refreshQR() {
            const btn = document.getElementById('refreshBtn');
            if (!btn || btn.disabled) return; // Prevent double-click
            
            // Clear any existing timeout
            if (qrRefreshTimeout) clearTimeout(qrRefreshTimeout);
            
            // Show loading placeholder on QR
            const qrImage = document.getElementById('qrImage');
            if (qrImage) {
                qrImage.style.opacity = '0.3';
            }
            
            btn.textContent = '⏳ Waiting for new QR...';
            btn.disabled = true;
            
            console.log('🔄 Refreshing QR code...');
            
            // Reset last timestamp to force update when new QR arrives
            lastQRTimestamp = null;
            
            fetch('/admin/refresh-qr', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log('✅ QR refresh initiated');
                        // Start polling for new QR immediately
                        pollQRStatus(true);
                        
                        // Set timeout - if QR doesn't appear in 30 seconds, reset button
                        qrRefreshTimeout = setTimeout(() => {
                            const btn = document.getElementById('refreshBtn');
                            const qrImage = document.getElementById('qrImage');
                            if (btn && btn.textContent.includes('Waiting')) {
                                btn.textContent = '🔄 Refresh QR Code';
                                btn.disabled = false;
                                if (qrImage) qrImage.style.opacity = '1';
                                console.log('⚠️ QR refresh timeout');
                                alert('QR code generation timed out. Please try again or refresh the page.');
                            }
                        }, 30000); // 30 seconds timeout
                    } else {
                        alert('Gagal refresh QR code: ' + data.error);
                        btn.textContent = '🔄 Refresh QR Code';
                        btn.disabled = false;
                        if (qrImage) qrImage.style.opacity = '1';
                    }
                })
                .catch(err => {
                    console.error('Error:', err);
                    alert('Terjadi kesalahan saat refresh QR code');
                    btn.textContent = '🔄 Refresh QR Code';
                    btn.disabled = false;
                    if (qrImage) qrImage.style.opacity = '1';
                });
        }
        
        // Poll QR status from server
        let wasConnected = isConnected;
        async function pollQRStatus(immediate = false) {
            try {
                const response = await fetch('/admin/qr-status');
                const data = await response.json();
                
                if (data.isConnected && !wasConnected) {
                    // Status changed to connected - update UI
                    showConnectedStatus(data.clientInfo);
                    wasConnected = true;
                    isConnected = true;
                } else if (!data.isConnected && wasConnected) {
                    // Status changed from connected to disconnected
                    wasConnected = false;
                    isConnected = false;
                    // Update UI tanpa reload - tampilkan loading spinner
                    console.log('⚠️ WhatsApp disconnected! Updating UI...');
                    showDisconnectedStatus();
                } else if (!data.isConnected && data.hasQR && data.qrCode) {
                    // Not connected but has QR code - update QR
                    // Check if QR code is new
                    if (data.timestamp !== lastQRTimestamp) {
                        updateQRCode(data.qrCode, data.timestamp);
                        lastQRTimestamp = data.timestamp;
                        
                        // Reset button state
                        const btn = document.querySelector('.refresh-btn');
                        if (btn) {
                            btn.textContent = '🔄 Refresh QR Code';
                            btn.disabled = false;
                        }
                    }
                }
            } catch (e) {
                console.error('Error polling QR status:', e);
            }
        }
        
        // Start polling every 2 seconds
        setInterval(() => pollQRStatus(), 2000);
        
        // Initial poll
        pollQRStatus();
    </script>
</body>
</html>`;
}

// Change Password Page HTML
function getChangePasswordPage(error = null, success = false) {
    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ganti Password - WhatsApp Web API</title>
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
        .navbar h1 { font-size: 20px; }
        .navbar a {
            color: white;
            text-decoration: none;
            padding: 8px 16px;
            background: rgba(255,255,255,0.2);
            border-radius: 6px;
        }
        .container {
            max-width: 500px;
            margin: 50px auto;
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
        .form-group { margin-bottom: 20px; }
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
        }
        input:focus { outline: none; border-color: #667eea; }
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
        .error {
            background: #fee;
            color: #c33;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .success {
            background: #d4edda;
            color: #155724;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <h1>🔑 Ganti Password</h1>
        <a href="/admin/dashboard">← Kembali</a>
    </nav>
    
    <div class="container">
        <div class="card">
            <h2>Ganti Password Admin</h2>
            <p>Masukkan password lama dan password baru Anda</p>
            
            ${error ? `<div class="error">${error}</div>` : ''}
            ${success ? `<div class="success">Password berhasil diubah! Silakan login ulang.</div>` : ''}
            
            <form action="/admin/change-password" method="POST">
                <div class="form-group">
                    <label for="currentPassword">Password Saat Ini</label>
                    <input type="password" id="currentPassword" name="currentPassword" required>
                </div>
                <div class="form-group">
                    <label for="newPassword">Password Baru</label>
                    <input type="password" id="newPassword" name="newPassword" required minlength="6">
                </div>
                <div class="form-group">
                    <label for="confirmPassword">Konfirmasi Password Baru</label>
                    <input type="password" id="confirmPassword" name="confirmPassword" required minlength="6">
                </div>
                <button type="submit" class="btn-primary">💾 Simpan Password Baru</button>
                <a href="/admin/dashboard" class="btn-secondary">Batal</a>
            </form>
        </div>
    </div>
</body>
</html>`;
}

module.exports = {
    getLoginPage,
    getDashboardPage,
    getChangePasswordPage,
    getWebhookSettingsPage
};
