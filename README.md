# WhatsApp Web JS dengan Media Support

Project ini menggunakan [`whatsapp-web.js`](https://github.com/pedroslopez/whatsapp-web.js) untuk menerima pesan WhatsApp dengan support media (gambar/video) dan mengirim webhook ke Activepieces.

## 🚀 Fitur

- ✅ Menerima pesan text dan media dari WhatsApp
- ✅ Download dan simpan media ke folder lokal
- ✅ Kirim webhook ke Activepieces saat menerima pesan
- ✅ File server untuk serve media via URL publik
- ✅ Session persistence (tidak perlu scan QR setiap kali)

---

## 📋 Prerequisites

- Node.js (v16+)
- Chrome/Chromium browser
- Ngrok (untuk public URL)

---

## 🛠️ Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Konfigurasi

Edit file [`index.js`](index.js) dan sesuaikan konfigurasi:

```javascript
const CONFIG = {
    WEBHOOK_URL: 'https://cloud.activepieces.com/api/v1/webhooks/49mCt0k0f9hmx7z6nsvk7stsqv',
    MEDIA_FOLDER: './media',
    NGROK_URL: 'https://agaze-elizabeth-groovelike.ngrok-free.dev'
};
```

**⚠️ Penting**: Update `NGROK_URL` setiap kali ngrok di-restart!

### 3. Jalankan File Server (Terminal 1)

File server untuk serve media files:

```bash
npm run server
# atau
node server.js
```

Server akan berjalan di port `3002`.

### 4. Jalankan WhatsApp Client (Terminal 2)

```bash
npm start
# atau
node index.js
```

### 5. Scan QR Code

- QR code akan muncul di terminal
- Scan dengan WhatsApp mobile app (Menu → Linked Devices)

---

## 🌐 Ngrok Setup

### Jalankan Ngrok (Terminal 3)

```bash
ngrok http 3002
```

Copy URL https yang muncul (contoh: `https://xxxxx.ngrok-free.dev`) dan update di [`index.js`](index.js):

```javascript
NGROK_URL: 'https://xxxxx.ngrok-free.dev'
```

**⚠️ PERINGATAN**: URL ngrok berubah setiap restart. Jika ngrok di-restart:
1. Copy URL baru
2. Update `NGROK_URL` di `index.js`
3. Restart WhatsApp client: `npm start`

---

## 📁 Struktur Folder

```
whatsapp-web-js-media/
├── index.js              # WhatsApp client utama
├── server.js             # File server untuk media
├── package.json          # Dependencies & scripts
├── README.md             # Dokumentasi ini
├── media/                # Folder untuk simpan media
│   ├── xxx_image.jpeg
│   ├── xxx_video.mp4
│   └── ...
└── .wwebjs_auth/         # Session storage (auto-generated)
    └── session/
```

---

## 📤 Format Webhook

Webhook dikirim ke Activepieces dengan format:

### Text Message
```json
{
  "event": "message",
  "timestamp": 1772585845225,
  "message": {
    "id": "message_id",
    "from": "628123456789@c.us",
    "to": "628987654321@c.us",
    "body": "Isi pesan",
    "type": "chat",
    "timestamp": 1772585845,
    "hasMedia": false,
    "isGroupMsg": false
  }
}
```

### Media Message
```json
{
  "event": "message",
  "timestamp": 1772585845225,
  "message": {
    "id": "message_id",
    "from": "628123456789@c.us",
    "to": "628987654321@c.us",
    "body": "Caption gambar",
    "type": "image",
    "timestamp": 1772585845,
    "hasMedia": true,
    "isGroupMsg": false,
    "media": {
      "url": "https://agaze-elizabeth-groovelike.ngrok-free.dev/media/message_id_1234567890.jpeg",
      "filename": "message_id_1234567890.jpeg",
      "mimetype": "image/jpeg",
      "size": 240690,
      "localPath": "./media/message_id_1234567890.jpeg"
    }
  }
}
```

---

## 🔗 Endpoint File Server

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/health` | GET | Health check |
| `/media` | GET | List semua file media |
| `/media/:filename` | GET | Download file media |

**Contoh akses media:**
```
https://agaze-elizabeth-groovelike.ngrok-free.dev/media/message_id_1234567890.jpeg
```

---

## 📝 Scripts

| Command | Deskripsi |
|---------|-----------|
| `npm start` | Jalankan WhatsApp client |
| `npm run server` | Jalankan file server |
| `npm run dev` | Jalankan client + server bersamaan |

---

## ⚠️ Troubleshooting

### Error: "Cannot find module 'whatsapp-web.js'"
```bash
npm install
```

### Error: "Failed to launch browser"
Pastikan Chrome/Chromium terinstall di sistem.

### Media tidak tersimpan
- Cek folder `media/` sudah ada
- Cek permission write ke folder
- Lihat log error di terminal

### Webhook tidak terkirim
- Cek URL webhook di `index.js`
- Cek koneksi internet
- Lihat log error di terminal

### QR Code muncul terus
- Session tersimpan di `.wwebjs_auth/`
- Jangan hapus folder ini
- Scan QR code sekali, kemudian session akan persist

---

## 📞 Referensi

- [whatsapp-web.js Documentation](https://docs.wwebjs.dev/)
- [WhatsApp Web](https://web.whatsapp.com)
- [Activepieces](https://cloud.activepieces.com)

---

**Catatan**: WhatsApp Web unofficial - gunakan dengan risiko sendiri!