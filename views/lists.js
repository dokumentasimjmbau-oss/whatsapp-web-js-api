// HTML Templates for Lists (Chats, Groups, Contacts, Media) with Pagination

const { CONFIG } = require('../config');

// Helper function for pagination
function generatePagination(currentPage, totalPages, baseUrl) {
    if (totalPages <= 1) return '';
    
    let html = '<div class="pagination">';
    
    // Previous button
    if (currentPage > 1) {
        html += `<a href="${baseUrl}?page=${currentPage - 1}" class="page-btn">← Prev</a>`;
    }
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        html += `<a href="${baseUrl}?page=1" class="page-btn">1</a>`;
        if (startPage > 2) html += `<span class="page-dots">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<span class="page-btn active">${i}</span>`;
        } else {
            html += `<a href="${baseUrl}?page=${i}" class="page-btn">${i}</a>`;
        }
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="page-dots">...</span>`;
        html += `<a href="${baseUrl}?page=${totalPages}" class="page-btn">${totalPages}</a>`;
    }
    
    // Next button
    if (currentPage < totalPages) {
        html += `<a href="${baseUrl}?page=${currentPage + 1}" class="page-btn">Next →</a>`;
    }
    
    html += '</div>';
    return html;
}

// Common CSS for list pages
const commonCSS = `
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
            max-width: 1200px;
            margin: 30px auto;
            padding: 0 20px;
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
            font-size: 24px;
        }
        .search-box {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 16px;
            margin-bottom: 20px;
        }
        .search-box:focus { outline: none; border-color: #667eea; }
        .stats-info {
            color: #666;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .list-container {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .list-item {
            display: flex;
            align-items: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
            border-left: 4px solid #667eea;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .list-item:hover {
            transform: translateX(5px);
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .list-item-icon {
            font-size: 24px;
            margin-right: 15px;
            width: 40px;
            text-align: center;
        }
        .list-item-content {
            flex: 1;
        }
        .list-item-title {
            font-weight: 600;
            color: #333;
            margin-bottom: 4px;
        }
        .list-item-subtitle {
            font-size: 13px;
            color: #666;
        }
        .list-item-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-group { background: #e3f2fd; color: #1976d2; }
        .badge-private { background: #e8f5e9; color: #388e3c; }
        .badge-admin { background: #fff3e0; color: #f57c00; }
        .pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            margin-top: 30px;
            flex-wrap: wrap;
        }
        .page-btn {
            padding: 8px 16px;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            text-decoration: none;
            color: #333;
            font-size: 14px;
            transition: all 0.2s;
        }
        .page-btn:hover {
            background: #667eea;
            color: white;
            border-color: #667eea;
        }
        .page-btn.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
        }
        .page-dots {
            color: #666;
            padding: 0 8px;
        }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #666;
        }
        .empty-state-icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        @media (max-width: 768px) {
            .container { margin: 15px auto; }
            .card { padding: 20px; }
        }
    </style>
`;

// Chats List Page
function getChatsListPage({ chats, currentPage, totalPages, totalCount, searchQuery }) {
    const itemsHtml = chats.map(chat => `
        <div class="list-item">
            <div class="list-item-icon">${chat.isGroup ? '👥' : '👤'}</div>
            <div class="list-item-content">
                <div class="list-item-title">${chat.name || 'Unknown'}</div>
                <div class="list-item-subtitle">${chat.id}</div>
            </div>
            <span class="list-item-badge ${chat.isGroup ? 'badge-group' : 'badge-private'}">
                ${chat.isGroup ? 'Group' : 'Private'}
            </span>
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daftar Chat - WhatsApp Web API</title>
    ${commonCSS}
</head>
<body>
    <nav class="navbar">
        <h1>💬 Daftar Chat</h1>
        <a href="/admin/dashboard">← Kembali</a>
    </nav>
    
    <div class="container">
        <div class="card">
            <h2>Semua Chat (${totalCount})</h2>
            
            <form method="GET" action="/admin/chats">
                <input type="text" name="search" class="search-box" 
                    placeholder="Cari chat..." value="${searchQuery || ''}">
            </form>
            
            <div class="stats-info">
                Menampilkan ${chats.length} dari ${totalCount} chat | Halaman ${currentPage} dari ${totalPages}
            </div>
            
            <div class="list-container">
                ${chats.length > 0 ? itemsHtml : `
                    <div class="empty-state">
                        <div class="empty-state-icon">📭</div>
                        <h3>Tidak ada chat ditemukan</h3>
                        <p>${searchQuery ? 'Coba kata kunci lain' : 'Belum ada chat'}</p>
                    </div>
                `}
            </div>
            
            ${generatePagination(currentPage, totalPages, '/admin/chats')}
        </div>
    </div>
</body>
</html>`;
}

// Groups List Page
function getGroupsListPage({ groups, currentPage, totalPages, totalCount, searchQuery }) {
    const itemsHtml = groups.map(group => `
        <div class="list-item">
            <div class="list-item-icon">👥</div>
            <div class="list-item-content">
                <div class="list-item-title">${group.name || 'Unknown Group'}</div>
                <div class="list-item-subtitle">${group.participantCount || 0} anggota • ${group.id}</div>
            </div>
            <span class="list-item-badge badge-group">Group</span>
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daftar Group - WhatsApp Web API</title>
    ${commonCSS}
</head>
<body>
    <nav class="navbar">
        <h1>👥 Daftar Group</h1>
        <a href="/admin/dashboard">← Kembali</a>
    </nav>
    
    <div class="container">
        <div class="card">
            <h2>Semua Group (${totalCount})</h2>
            
            <form method="GET" action="/admin/groups">
                <input type="text" name="search" class="search-box" 
                    placeholder="Cari group..." value="${searchQuery || ''}">
            </form>
            
            <div class="stats-info">
                Menampilkan ${groups.length} dari ${totalCount} group | Halaman ${currentPage} dari ${totalPages}
            </div>
            
            <div class="list-container">
                ${groups.length > 0 ? itemsHtml : `
                    <div class="empty-state">
                        <div class="empty-state-icon">👥</div>
                        <h3>Tidak ada group ditemukan</h3>
                        <p>${searchQuery ? 'Coba kata kunci lain' : 'Belum ada group'}</p>
                    </div>
                `}
            </div>
            
            ${generatePagination(currentPage, totalPages, '/admin/groups')}
        </div>
    </div>
</body>
</html>`;
}

// Contacts List Page
function getContactsListPage({ contacts, currentPage, totalPages, totalCount, searchQuery }) {
    const itemsHtml = contacts.map(contact => `
        <div class="list-item">
            <div class="list-item-icon">👤</div>
            <div class="list-item-content">
                <div class="list-item-title">${contact.name || contact.pushname || contact.number}</div>
                <div class="list-item-subtitle">${contact.number} • ${contact.id}</div>
            </div>
            ${contact.isBusiness ? '<span class="list-item-badge badge-admin">Business</span>' : ''}
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daftar Kontak - WhatsApp Web API</title>
    ${commonCSS}
</head>
<body>
    <nav class="navbar">
        <h1>👤 Daftar Kontak</h1>
        <a href="/admin/dashboard">← Kembali</a>
    </nav>
    
    <div class="container">
        <div class="card">
            <h2>Semua Kontak (${totalCount})</h2>
            
            <form method="GET" action="/admin/contacts">
                <input type="text" name="search" class="search-box" 
                    placeholder="Cari kontak..." value="${searchQuery || ''}">
            </form>
            
            <div class="stats-info">
                Menampilkan ${contacts.length} dari ${totalCount} kontak | Halaman ${currentPage} dari ${totalPages}
            </div>
            
            <div class="list-container">
                ${contacts.length > 0 ? itemsHtml : `
                    <div class="empty-state">
                        <div class="empty-state-icon">📇</div>
                        <h3>Tidak ada kontak ditemukan</h3>
                        <p>${searchQuery ? 'Coba kata kunci lain' : 'Belum ada kontak'}</p>
                    </div>
                `}
            </div>
            
            ${generatePagination(currentPage, totalPages, '/admin/contacts')}
        </div>
    </div>
</body>
</html>`;
}

// Media Files List Page
function getMediaListPage({ files, currentPage, totalPages, totalCount }) {
    const itemsHtml = files.map(file => {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        const ext = file.filename.split('.').pop().toLowerCase();
        let icon = '📄';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) icon = '🖼️';
        else if (['mp4', 'mov', 'avi'].includes(ext)) icon = '🎬';
        else if (['mp3', 'ogg', 'wav'].includes(ext)) icon = '🎵';
        else if (['pdf'].includes(ext)) icon = '📑';
        
        return `
        <div class="list-item" style="cursor: pointer;" onclick="window.open('/media/${file.filename}', '_blank')">
            <div class="list-item-icon">${icon}</div>
            <div class="list-item-content">
                <div class="list-item-title">${file.filename}</div>
                <div class="list-item-subtitle">${sizeMB} MB • ${new Date(file.mtime).toLocaleString()}</div>
            </div>
            <span class="list-item-badge badge-private">.${ext}</span>
        </div>
        `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daftar Media - WhatsApp Web API</title>
    ${commonCSS}
</head>
<body>
    <nav class="navbar">
        <h1>📁 Daftar Media</h1>
        <a href="/admin/dashboard">← Kembali</a>
    </nav>
    
    <div class="container">
        <div class="card">
            <h2>Semua File Media (${totalCount})</h2>
            
            <div class="stats-info">
                Menampilkan ${files.length} dari ${totalCount} file | Halaman ${currentPage} dari ${totalPages}
                <br><small>Klik file untuk melihat/download</small>
            </div>
            
            <div class="list-container">
                ${files.length > 0 ? itemsHtml : `
                    <div class="empty-state">
                        <div class="empty-state-icon">📁</div>
                        <h3>Tidak ada file media</h3>
                        <p>Folder media masih kosong</p>
                    </div>
                `}
            </div>
            
            ${generatePagination(currentPage, totalPages, '/admin/media')}
        </div>
    </div>
</body>
</html>`;
}

module.exports = {
    getChatsListPage,
    getGroupsListPage,
    getContactsListPage,
    getMediaListPage
};
