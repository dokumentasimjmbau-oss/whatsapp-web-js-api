# WhatsApp Web JS API Documentation

Dokumentasi lengkap untuk WhatsApp Web JS Media Server dengan webhook integration.

## 📋 Daftar Isi

- [Overview](#overview)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Webhook Format](#webhook-format)
- [Sending Messages](#sending-messages-http-request-format)
  - [Kirim Pesan Teks](#1-kirim-pesan-teks)
  - [Kirim Media/File](#2-kirim-mediafile)
  - [Kirim Status (Story)](#3-kirim-status-story)
  - [Format ID Chat](#4-format-id-chat)
  - [Kirim dengan Reply](#5-kirim-pesan-dengan-reply)
  - [Kirim dengan Mention](#6-kirim-pesan-dengan-mention)
  - [Delay Pesan](#7-delay-pesan-typing-indicator)
  - [Request Fields Reference](#8-request-fields-reference)
- [Message Types](#message-types)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Overview

Project ini menyediakan:
- WhatsApp Web Client untuk menerima pesan
- File Server untuk serve media (port 3002)
- Webhook integration ke Activepieces
- Session persistence (tidak perlu scan QR berulang)

---

## Installation

```bash
# Clone/Navigate ke folder
cd whatsapp-web-js-dokumentasimjmbau

# Install dependencies
npm install

# Jalankan file server (Terminal 1)
node server.js

# Jalankan WhatsApp client (Terminal 2)
node index.js
```

---

## Configuration

Edit `index.js` untuk mengubah konfigurasi:

```javascript
const CONFIG = {
    WEBHOOK_URL: 'https://cloud.activepieces.com/api/v1/webhooks/49mCt0eLl7F1pA7ey4dFH',
    MEDIA_FOLDER: './media',
    NGROK_URL: 'https://agaze-elizabeth-groovelike.ngrok-free.dev'
};
```

### Config Options

| Parameter | Type | Description |
|-----------|------|-------------|
| `WEBHOOK_URL` | string | URL webhook Activepieces |
| `MEDIA_FOLDER` | string | Path folder penyimpanan media |
| `NGROK_URL` | string | Public URL dari ngrok |

---

## API Endpoints

### 1. Health Check

**Endpoint:** `GET /health`

**Description:** Cek status server

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1772590971643
}
```

---

### 2. List Media Files

**Endpoint:** `GET /media`

**Description:** Mendapatkan daftar semua file media

**Response:**
```json
{
  "files": [
    {
      "filename": "A550D9DE363C51A836B533ACF708401B_1772590971464.jpeg",
      "url": "/media/A550D9DE363C51A836B533ACF708401B_1772590971464.jpeg",
      "size": 320920
    }
  ]
}
```

---

### 3. Get Media File

**Endpoint:** `GET /media/:filename`

**Description:** Mengambil/mendownload file media

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | Yes | Nama file media |

**Response:** File binary dengan content-type sesuai MIME type

**Error Response:**
```json
{
  "error": "File not found"
}
```

---

## Webhook Format

Webhook dikirim ke Activepieces saat menerima pesan WhatsApp.

### HTTP Method
`POST`

### Headers
```
Content-Type: application/json
```

### Body Format

#### Text Message
```json
{
  "event": "message",
  "timestamp": 1772590971375,
  "message": {
    "id": "A550D9DE363C51A836B533ACF708401B",
    "serialized": "false_120363040848451142@g.us_A550D9DE363C51A836B533ACF708401B",
    "from": "120363040848451142@g.us",
    "to": "62858101919954@c.us",
    "body": "Coba photo",
    "type": "chat",
    "timestamp": 1772590971,
    "hasMedia": false,
    "author": "149645384806501@lid",
    "deviceType": "android",
    "isGroupMsg": true
  }
}
```

#### Media Message (Image/Video/PDF)
```json
{
  "event": "message",
  "timestamp": 1772590971375,
  "message": {
    "id": "A550D9DE363C51A836B533ACF708401B",
    "serialized": "false_120363040848451142@g.us_A550D9DE363C51A836B533ACF708401B",
    "from": "120363040848451142@g.us",
    "to": "62858101919954@c.us",
    "body": "Coba photo",
    "type": "image",
    "timestamp": 1772590971,
    "hasMedia": true,
    "author": "149645384806501@lid",
    "deviceType": "android",
    "isGroupMsg": true,
    "media": {
      "url": "https://agaze-elizabeth-groovelike.ngrok-free.dev/media/A550D9DE363C51A836B533ACF708401B_1772590971464.jpeg",
      "filename": "A550D9DE363C51A836B533ACF708401B_1772590971464.jpeg",
      "mimetype": "image/jpeg",
      "size": 320920,
      "localPath": "media\\A550D9DE363C51A836B533ACF708401B_1772590971464.jpeg"
    }
  }
}
```

### Message Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique message ID (short format) |
| `serialized` | string | **Full serialized ID untuk reply** (contoh: `false_120363...@g.us_A58B...`) |
| `from` | string | Sender ID (format: number@c.us atau group@g.us) |
| `to` | string | Recipient ID |
| `body` | string | Message content/caption |
| `type` | string | Message type: `chat`, `image`, `video`, `document`, `audio` |
| `timestamp` | number | Unix timestamp |
| `hasMedia` | boolean | Apakah pesan memiliki media |
| `author` | string | Author ID (untuk grup) |
| `deviceType` | string | Device sender: `android`, `ios`, `web` |
| `isGroupMsg` | boolean | Apakah pesan dari grup |

**⚠️ Penting untuk Reply:**
- Gunakan `{{message.serialized}}` untuk `quotedMessageId`
- **Jangan** gunakan `{{message.id}}` untuk reply!

### Media Object

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Public URL untuk akses media |
| `filename` | string | Nama file media |
| `mimetype` | string | MIME type file |
| `size` | number | Ukuran file dalam bytes |
| `localPath` | string | Path lokal file |

---

## Sending Messages (HTTP Request Format)

Untuk mengirim pesan via HTTP Request (untuk integration dengan Activepieces atau sistem lain), gunakan format JSON berikut.

**Base URL:** `http://localhost:3001` (atau URL server Anda)
**Headers:**
```
Content-Type: application/json
```

---

### 1. Kirim Pesan Teks

#### Ke Private Chat
**Endpoint:** `POST /send-message`

**Request Body:**
```json
{
  "action": "sendText",
  "to": "628123456789@c.us",
  "message": "Halo, ini pesan test!"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "ABCD123456789",
  "timestamp": 1772590971
}
```

---

#### Ke Group Chat
**Endpoint:** `POST /send-message`

**Request Body:**
```json
{
  "action": "sendText",
  "to": "120363040848451142@g.us",
  "message": "Halo semua, ini pesan ke grup!"
}
```

---

#### Ke Channel (Newsletter)
**Endpoint:** `POST /send-message`

**Request Body:**
```json
{
  "action": "sendText",
  "to": "123456789012345678@newsletter",
  "message": "Halo subscribers!"
}
```

---

### 2. Kirim Media/File

**Support dua cara:**
1. **Base64** - Kirim data base64 langsung
2. **URL** - Kirim URL gambar/file (akan di-download otomatis)

#### Kirim Gambar dari URL (Recommended)
**Endpoint:** `POST /send-media`

**Request Body:**
```json
{
  "action": "sendMedia",
  "to": "628123456789@c.us",
  "type": "image",
  "data": "https://example.com/image.jpg",
  "caption": "Ini caption gambar"
}
```

---

#### Kirim Gambar dengan Base64
**Endpoint:** `POST /send-media`

**Request Body:**
```json
{
  "action": "sendMedia",
  "to": "628123456789@c.us",
  "type": "image",
  "mimetype": "image/jpeg",
  "filename": "image.jpg",
  "data": "base64_encoded_image_data_here",
  "caption": "Ini caption gambar"
}
```

---

#### Kirim Video dari URL
**Endpoint:** `POST /send-media`

**Request Body:**
```json
{
  "action": "sendMedia",
  "to": "628123456789@c.us",
  "type": "video",
  "data": "https://example.com/video.mp4",
  "caption": "Ini caption video"
}
```

---

#### Kirim PDF/Document dari URL
**Endpoint:** `POST /send-media`

**Request Body:**
```json
{
  "action": "sendMedia",
  "to": "628123456789@c.us",
  "type": "document",
  "data": "https://example.com/document.pdf",
  "caption": "Ini dokumen PDF"
}
```

---

#### Kirim Audio/Voice Note (PTT)
**Endpoint:** `POST /send-media`

**Request Body:**
```json
{
  "action": "sendMedia",
  "to": "628123456789@c.us",
  "type": "audio",
  "mimetype": "audio/mp3",
  "filename": "audio.mp3",
  "data": "base64_encoded_audio_data_here",
  "sendAsVoice": true
}
```

---

#### Reply dengan Gambar (URL)
**Endpoint:** `POST /send-media`

**Request Body:**
```json
{
  "action": "sendMedia",
  "to": "120363040848451142@g.us",
  "type": "image",
  "data": "https://example.com/image.jpg",
  "caption": "Ini balasan dengan gambar",
  "quotedMessageId": "false_120363040848451142@g.us_A59B7F14968C30C051E815F04F16DA03_149645384806501@lid",
  "simulateTyping": true,
  "typingDuration": 2000
}
```

**Note:** Reply dengan media akan mengirim gambar terlebih dahulu, kemudian reply dengan caption (jika ada).

---

### 3. Kirim Status (Story)

#### Status Teks
**Endpoint:** `POST /send-message`

**Request Body:**
```json
{
  "action": "sendText",
  "to": "status@broadcast",
  "message": "Ini status saya!"
}
```

#### Status Gambar
**Endpoint:** `POST /send-media`

**Request Body:**
```json
{
  "action": "sendMedia",
  "to": "status@broadcast",
  "type": "image",
  "mimetype": "image/jpeg",
  "filename": "status.jpg",
  "data": "base64_encoded_image_data_here"
}
```

**Catatan:** Status hanya bisa dilihat oleh kontak yang sudah save nomor Anda.

---

### 4. Format ID Chat

| Tipe | Format | Contoh |
|------|--------|--------|
| Private | `number@c.us` | `628123456789@c.us` |
| Group | `groupID@g.us` | `120363040848451142@g.us` |
| Channel | `channelID@newsletter` | `123456789012345678@newsletter` |
| Status | `status@broadcast` | `status@broadcast` |

---

### 5. Kirim Pesan dengan Reply

**Endpoint:** `POST /send-message`

**Request Body:**
```json
{
  "action": "sendReply",
  "to": "628123456789@c.us",
  "message": "Ini balasan pesan",
  "quotedMessageId": "ABCD123456789"
}
```

---

### 6. Kirim Pesan dengan Mention

**Endpoint:** `POST /send-message`

**Request Body:**
```json
{
  "action": "sendText",
  "to": "120363040848451142@g.us",
  "message": "Halo @628123456789",
  "mentions": ["628123456789@c.us"]
}
```

---

### 7. Delay Pesan (Typing Indicator)

Untuk mensimulasikan typing dan menambahkan delay sebelum mengirim pesan.

#### Dengan Delay (Miliseconds)
**Endpoint:** `POST /send-message`

**Request Body:**
```json
{
  "action": "sendText",
  "to": "628123456789@c.us",
  "message": "Halo, ini pesan dengan delay!",
  "delay": 3000
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "ABCD123456789",
  "timestamp": 1772590971,
  "delayed": true,
  "delayMs": 3000
}
```

---

### Catatan Penting untuk Reply Message

⚠️ **Format `quotedMessageId` harus serialized ID lengkap**, bukan hanya short ID.

**❌ Salah:**
```json
{
  "action": "sendReply",
  "to": "120363040848451142@g.us",
  "message": "Balasan",
  "quotedMessageId": "A58BE4CE4F43E6CEDB05794BAF2F699D"
}
```

**✅ Benar:**
```json
{
  "action": "sendReply",
  "to": "120363040848451142@g.us",
  "message": "Balasan",
  "quotedMessageId": "false_120363040848451142@g.us_A58BE4CE4F43E6CEDB05794BAF2F699D"
}
```

**Cara mendapatkan serialized ID:**
Dari webhook yang diterima, gunakan field `message.serialized`:
```json
{
  "action": "sendReply",
  "to": "{{message.from}}",
  "message": "Balasan untuk: {{message.body}}",
  "quotedMessageId": "{{message.serialized}}"
}
```

**⚠️ Jangan gunakan `{{message.id}}` untuk reply!**

**Alternatif jika tidak punya serialized ID:**
Gunakan `action: "sendText"` biasa tanpa `quotedMessageId`:
```json
{
  "action": "sendText",
  "to": "{{message.from}}",
  "message": "Balasan pesan"
}
```

#### Dengan Typing Indicator
**Endpoint:** `POST /send-message`

**Request Body:**
```json
{
  "action": "sendText",
  "to": "628123456789@c.us",
  "message": "Halo, ini pesan dengan typing indicator!",
  "simulateTyping": true,
  "typingDuration": 2000
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "ABCD123456789",
  "timestamp": 1772590971,
  "typingSimulated": true,
  "typingDurationMs": 2000
}
```

#### Kombinasi Delay + Typing
**Endpoint:** `POST /send-message`

**Request Body:**
```json
{
  "action": "sendText",
  "to": "628123456789@c.us",
  "message": "Halo, ini pesan lengkap dengan delay dan typing!",
  "delay": 1000,
  "simulateTyping": true,
  "typingDuration": 3000
}
```

---

### 8. Request Fields Reference

#### Text Message Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | Yes | `"sendText"` atau `"sendReply"` |
| `to` | string | Yes | Target chat ID |
| `message` | string | Yes | Isi pesan |
| `quotedMessageId` | string | No | ID pesan yang direply (untuk action: sendReply) |
| `mentions` | array | No | Array user IDs untuk mention |
| `delay` | number | No | Delay dalam miliseconds sebelum kirim |
| `simulateTyping` | boolean | No | Tampilkan typing indicator |
| `typingDuration` | number | No | Durasi typing indicator (ms) |

#### Media Message Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | Yes | `"sendMedia"` |
| `to` | string | Yes | Target chat ID |
| `type` | string | Yes | `"image"`, `"video"`, `"document"`, `"audio"` |
| `data` | string | Yes | **URL** atau **Base64** data |
| `mimetype` | string | No | MIME type (auto-detect jika dari URL) |
| `filename` | string | No | Nama file (auto-detect jika dari URL) |
| `caption` | string | No | Caption untuk media |
| `sendAsVoice` | boolean | No | Kirim audio sebagai voice note (PTT) |
| `sendAsSticker` | boolean | No | Kirim gambar sebagai sticker |
| `sendAsDocument` | boolean | No | Kirim media sebagai dokumen |
| `delay` | number | No | Delay dalam miliseconds sebelum kirim |
| `simulateTyping` | boolean | No | Tampilkan typing indicator |
| `typingDuration` | number | No | Durasi typing indicator (ms) |
| `quotedMessageId` | string | No | Serialized ID untuk reply (gunakan `{{message.serialized}}`) |

---

## Message Types

| Type | Description | Has Media |
|------|-------------|-----------|
| `chat` | Text message | No |
| `image` | Image/Photo | Yes |
| `video` | Video | Yes |
| `document` | PDF/Docs | Yes |
| `audio` | Voice message | Yes |
| `ptt` | Push to talk | Yes |
| `sticker` | Sticker | Yes |
| `location` | Location share | No |
| `vcard` | Contact card | No |

---

## Error Handling

### Server Errors

| Status Code | Description |
|-------------|-------------|
| `200` | Success |
| `404` | File not found |
| `500` | Internal server error |

### Webhook Errors

Jika webhook gagal terkirim, error akan di-log ke console:
```
❌ Error sending webhook: Error message
```

---

## Examples

### cURL - Health Check
```bash
curl https://agaze-elizabeth-groovelike.ngrok-free.dev/health
```

### cURL - List Media
```bash
curl https://agaze-elizabeth-groovelike.ngrok-free.dev/media
```

### cURL - Download Media
```bash
curl https://agaze-elizabeth-groovelike.ngrok-free.dev/media/A550D9DE363C51A836B533ACF708401B_1772590971464.jpeg \
  --output downloaded_image.jpeg
```

### JavaScript - Fetch Media
```javascript
const response = await fetch('https://agaze-elizabeth-groovelike.ngrok-free.dev/media/filename.jpeg');
const blob = await response.blob();
```

### cURL - Send Text Message
```bash
curl -X POST http://localhost:3001/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sendText",
    "to": "628123456789@c.us",
    "message": "Halo dari API!"
  }'
```

### cURL - Send Image
```bash
curl -X POST http://localhost:3001/send-media \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sendMedia",
    "to": "628123456789@c.us",
    "type": "image",
    "mimetype": "image/jpeg",
    "filename": "photo.jpg",
    "data": "base64_encoded_data_here",
    "caption": "Ini foto saya"
  }'
```

### Activepieces - HTTP Request
```
Method: POST
URL: http://localhost:3001/send-message
Headers:
  Content-Type: application/json

Body (JSON):
{
  "action": "sendText",
  "to": "628123456789@c.us",
  "message": "Pesan otomatis dari Activepieces"
}
```

### cURL - Send Message with Delay
```bash
curl -X POST http://localhost:3001/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sendText",
    "to": "628123456789@c.us",
    "message": "Pesan ini akan terkirim setelah 5 detik",
    "delay": 5000,
    "simulateTyping": true,
    "typingDuration": 3000
  }'
```

### Activepieces - Send with Delay
```
Method: POST
URL: http://localhost:3001/send-message
Headers:
  Content-Type: application/json

Body (JSON):
{
  "action": "sendText",
  "to": "628123456789@c.us",
  "message": "Halo, ini pesan dengan delay",
  "delay": 3000,
  "simulateTyping": true,
  "typingDuration": 2000
}
```

### Activepieces - Reply with Image from URL
```
Method: POST
URL: http://localhost:3001/send-media
Headers:
  Content-Type: application/json

Body (JSON):
{
  "action": "sendMedia",
  "to": "{{message.from}}",
  "type": "image",
  "data": "https://example.com/gambar.jpg",
  "caption": "Ini balasan gambar",
  "quotedMessageId": "{{message.serialized}}",
  "simulateTyping": true,
  "typingDuration": 2000
}
```

### Activepieces - Reply to Group Message with Image
```
Method: POST
URL: http://localhost:3001/send-media
Headers:
  Content-Type: application/json

Body (JSON):
{
  "action": "sendMedia",
  "to": "{{message.from}}",
  "type": "image",
  "data": "https://akcdn.detik.net.id/community/media/visual/2020/09/20/jenis-jenis-kucing-peliharaan-12.jpeg",
  "caption": "Ini balasan untuk: {{message.body}}",
  "quotedMessageId": "{{message.serialized}}",
  "simulateTyping": true,
  "typingDuration": 2000
}
```

---

## Ngrok Setup

Untuk public URL:

```bash
# Install ngrok (jika belum)
# https://ngrok.com/download

# Jalankan ngrok
ngrok http 3002

# Copy URL https yang muncul
# Example: https://xxxxx.ngrok-free.dev

# Update NGROK_URL di index.js
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Jalankan WhatsApp client |
| `npm run server` | Jalankan file server |
| `npm run dev` | Jalankan client + server bersamaan |

---

## Troubleshooting

### QR Code Muncul Terus
- Session tersimpan di `.wwebjs_auth/`
- Jangan hapus folder ini
- Scan sekali, kemudian session persist

### Media Tidak Tersimpan
- Cek folder `media/` ada dan writable
- Cek permission folder

### Webhook Tidak Terkirim
- Cek URL webhook di konfigurasi
- Cek koneksi internet
- Lihat log error di terminal

### Ngrok URL Berubah
- URL ngrok free berubah setiap restart
- Update `NGROK_URL` di `index.js`
- Restart WhatsApp client

---

## References

- [whatsapp-web.js Documentation](https://docs.wwebjs.dev/)
- [WhatsApp Web](https://web.whatsapp.com)
- [Activepieces](https://cloud.activepieces.com)
- [Ngrok](https://ngrok.com)

---

**Catatan:** WhatsApp Web unofficial - gunakan dengan risiko sendiri!
