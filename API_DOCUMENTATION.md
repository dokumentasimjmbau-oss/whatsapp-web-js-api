# WhatsApp Web JS API Documentation

Dokumentasi lengkap untuk WhatsApp Web JS Media Server dengan webhook integration.

## 📋 Daftar Isi

- [Overview](#overview)
- [Installation](#installation)
- [Configuration](#configuration)
- [Authentication](#authentication)
- [Admin Dashboard](#admin-dashboard)
- [Fetching Data Endpoints](#fetching-data-endpoints)
- [API Endpoints](#api-endpoints)
- [Webhook Format](#webhook-format)
- [Sending Messages](#sending-messages-http-request-format)
  - [Kirim Pesan Teks](#1-kirim-pesan-teks)
  - [Kirim Media/File](#2-kirim-mediafile)
  - [Kirim Video](#kirim-video-dari-url)
  - [Kirim Status (Story)](#3-kirim-status-story)
- [Sending Video dengan Activepieces](#-sending-video-dengan-activepieces)
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
- API Server dengan webhook integration ke Activepieces
- Session persistence (tidak perlu scan QR berulang)
- Auto-cleanup media files (24 jam)
- API Key authentication untuk keamanan

---

## Installation

```bash
# Clone/Navigate ke folder
cd whatsapp-web-js-dokumentasimjmbau

# Install dependencies
npm install

# Jalankan API Server
node api-server.js
```

Akses QR code scanner di: `http://localhost:3001/qr`

---

## Configuration

Konfigurasi diatur melalui **Environment Variables**:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_KEY` | **Yes** | - | API key untuk authentication |
| `ADMIN_USERNAME` | No | admin | Username untuk admin dashboard |
| `ADMIN_PASSWORD` | No | admin123 | Password untuk admin dashboard |
| `SESSION_SECRET` | No | (auto) | Secret key untuk session encryption |
| `PORT` | No | 3001 | Port server |
| `WEBHOOK_URL` | No | (hardcoded) | URL webhook Activepieces |
| `RAILWAY_PUBLIC_DOMAIN` | Auto | - | Auto-generated oleh Railway |

**Untuk Railway Deployment:**
Set variables di Railway Dashboard → Variables tab.

**Untuk Local Development:**
Buat file `.env` atau set variables di terminal:
```bash
export API_KEY=your-secret-key
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=your-secure-password
export SESSION_SECRET=your-session-secret-key
export PORT=3001
```

**⚠️ Penting:** Ganti default password `admin123` dengan password yang kuat di production!

---

## Authentication

Untuk keamanan, endpoint **POST /send-message** dan **POST /send-media** memerlukan API Key.

### Setup API Key

1. Set environment variable `API_KEY` di Railway Dashboard:
   - Buka project di Railway
   - Go to Variables tab
   - Add `API_KEY` = `your-secret-api-key-here`
   - Deploy ulang

2. Gunakan API Key di request header:
   ```
   Authorization: Bearer YOUR_API_KEY
   ```

### Contoh Request dengan API Key

```bash
curl -X POST https://your-app.up.railway.app/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-api-key" \
  -d '{
    "action": "sendText",
    "to": "628123456789@c.us",
    "message": "Hello!"
  }'
```

### Error Response (Invalid API Key)

```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid API key. Provide API key in Authorization header: Bearer YOUR_API_KEY"
}
```

### Catatan

- Jika `API_KEY` tidak di-set di environment variables, autentikasi akan dimatikan (development mode)
- QR code endpoint (`/qr`) dan health check (`/health`) tetap terbuka untuk memudahkan setup
- Incoming webhook dari WhatsApp tidak memerlukan API key karena datang dari server WhatsApp

---

## Admin Dashboard

API WhatsApp Web JS sekarang dilengkapi dengan **Admin Dashboard** yang dapat diakses melalui browser untuk memudahkan manajemen dan monitoring.

### Login Admin

**URL:** `GET /admin/login`

**Default Credentials:**
- Username: `admin`
- Password: `admin123` ⚠️ **Ganti segera di production!**

**Cara mengganti credentials:**
Set environment variables di Railway:
```
ADMIN_USERNAME=your-username
ADMIN_PASSWORD=your-strong-password
SESSION_SECRET=random-secret-string
```

### Dashboard Features

Setelah login, dashboard menampilkan:

#### 1. Connection Status
- Status koneksi WhatsApp (Connected/Disconnected)
- Informasi user yang terhubung (nama, nomor, platform)

#### 2. QR Code Scanner
- Jika belum terhubung: Menampilkan QR code untuk scan
- Auto-refresh status setiap 5 detik
- Petunjuk cara scan QR code

#### 3. Statistics Dashboard
| Statistic | Description |
|-----------|-------------|
| Total Chats | Jumlah semua chat (private + grup) |
| Groups | Jumlah grup WhatsApp |
| Contacts | Jumlah kontak tersimpan |
| Media Files | Jumlah file di folder media |

#### 4. API Endpoints Reference
Daftar semua endpoint API dengan method dan deskripsi.

#### 5. API Key Display
Menampilkan API key yang aktif untuk copy-paste ke integrations.

### Accessing Dashboard

**Local Development:**
```
http://localhost:3001/admin/login
```

**Railway Deployment:**
```
https://whatsapp-web-js-api-production-2cf4.up.railway.app/admin/login
```

### Logout

Klik tombol **Logout** di navbar untuk keluar dari dashboard.

Session akan otomatis expire setelah 24 jam.

---

## Fetching Data Endpoints

Endpoint berikut memerlukan **API Key** di header `Authorization: Bearer YOUR_API_KEY`.

### 1. Get My Info
**Endpoint:** `GET /me`

**Description:** Mendapatkan informasi nomor WA yang sedang login

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "62858101919954@c.us",
    "number": "62858101919954",
    "name": "Your Name",
    "platform": "android",
    "isBusiness": false,
    "isEnterprise": false
  }
}
```

### 2. Get All Chats
**Endpoint:** `GET /chats`

**Description:** Mendapatkan semua chat (private + grup)

**Response:**
```json
{
  "success": true,
  "count": 150,
  "chats": [
    {
      "id": "628123456789@c.us",
      "name": "John Doe",
      "isGroup": false,
      "unreadCount": 5
    },
    {
      "id": "120363040848451142@g.us",
      "name": "Group Name",
      "isGroup": true,
      "unreadCount": 12
    }
  ]
}
```

### 3. Get All Groups
**Endpoint:** `GET /groups`

**Description:** Mendapatkan detail semua grup WA beserta participant list

**Response:**
```json
{
  "success": true,
  "count": 10,
  "groups": [
    {
      "id": "120363040848451142@g.us",
      "name": "Nama Grup",
      "description": "Deskripsi grup",
      "participants": [
        {
          "id": "628123456789@c.us",
          "isAdmin": true,
          "isSuperAdmin": true
        }
      ],
      "participantCount": 25
    }
  ]
}
```

### 4. Get All Contacts
**Endpoint:** `GET /contacts`

**Description:** Mendapatkan semua kontak yang tersimpan di WhatsApp

**Response:**
```json
{
  "success": true,
  "count": 200,
  "contacts": [
    {
      "id": "628123456789@c.us",
      "number": "628123456789",
      "name": "Contact Name",
      "pushname": "Display Name",
      "isBusiness": false,
      "isMyContact": true
    }
  ]
}
```

### 5. Get All Channels
**Endpoint:** `GET /channels`

**Description:** Mendapatkan semua channel/newsletter yang diikuti

**Response:**
```json
{
  "success": true,
  "count": 5,
  "channels": [
    {
      "id": "123456789012345678@newsletter",
      "name": "Channel Name",
      "description": "Channel description",
      "subscriberCount": 1000
    }
  ]
}
```

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

#### Ke Channel (Newsletter) - ⚠️ Limited Support
**Endpoint:** `POST /send-message`

**⚠️ IMPORTANT:** Sending messages TO channels/newsletters is **NOT fully supported** by whatsapp-web.js library. You can receive messages from channels, but sending TO channels has limitations.

**Request Body:**
```json
{
  "action": "sendText",
  "to": "123456789012345678@newsletter",
  "message": "Halo subscribers!"
}
```

**Expected Error:**
```json
{
  "error": "Failed to send to Channel/Newsletter (123456789012345678@newsletter). This feature is not fully supported by whatsapp-web.js library...",
  "type": "CHANNEL_NOT_SUPPORTED",
  "suggestion": "Consider using regular groups (g.us) for sending messages, or check if you are the channel admin."
}
```

**Workaround:**
- Use regular WhatsApp Groups (`@g.us`) instead of channels for sending messages
- Channels are primarily for receiving updates, not for bot interactions
- Only channel admins can post to channels via WhatsApp mobile app

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

**Response:**
```json
{
  "success": true,
  "messageId": "ABC123DEF456",
  "timestamp": 1772590971,
  "to": "628123456789@c.us",
  "mediaType": "video",
  "filename": "video.mp4",
  "mimetype": "video/mp4"
}
```

**⚠️ Catatan Penting untuk Video:**
- Server menggunakan **Google Chrome Stable** (bukan Chromium) untuk mendukung format video H.264/AAC
- Format yang didukung: MP4 (H.264 codec), MOV
- Ukuran maksimal: 50MB
- Video akan diproses dan dikirim sebagai file attachment

---

#### Kirim Video dengan Base64
**Endpoint:** `POST /send-media`

**Request Body:**
```json
{
  "action": "sendMedia",
  "to": "628123456789@c.us",
  "type": "video",
  "mimetype": "video/mp4",
  "filename": "video.mp4",
  "data": "base64_encoded_video_data_here",
  "caption": "Ini video dari base64"
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

### Base URL
- **Local:** `http://localhost:3001`
- **Railway:** `https://whatsapp-web-js-api-production-2cf4.up.railway.app`

### cURL - Health Check
```bash
curl https://whatsapp-web-js-api-production-2cf4.up.railway.app/health
```

### cURL - Download Media
```bash
curl https://whatsapp-web-js-api-production-2cf4.up.railway.app/media/A550D9DE363C51A836B533ACF708401B_1772590971464.jpeg \
  --output downloaded_image.jpeg
```

### JavaScript - Fetch Media
```javascript
const response = await fetch('https://whatsapp-web-js-api-production-2cf4.up.railway.app/media/filename.jpeg');
const blob = await response.blob();
```

### cURL - Send Text Message (with API Key)
```bash
curl -X POST https://whatsapp-web-js-api-production-2cf4.up.railway.app/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wa-api-key-2025-secure-token-xyz789" \
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
  Authorization: Bearer YOUR_API_KEY

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

## 🎬 Sending Video dengan Activepieces

### Overview
WhatsApp Web JS API mendukung pengiriman video MP4 dengan codec H.264. Server menggunakan Google Chrome Stable (bukan Chromium) untuk memastikan video dapat diproses dengan benar.

### Activepieces - Send Video from URL
```
Method: POST
URL: https://whatsapp-web-js-api-production.up.railway.app/send-media
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_API_KEY

Body (JSON):
{
  "action": "sendMedia",
  "to": "628123456789@c.us",
  "type": "video",
  "data": "https://example.com/video.mp4",
  "caption": "Check out this video!",
  "simulateTyping": true,
  "typingDuration": 3000
}
```

### Activepieces - Send Video dengan Reply
```
Method: POST
URL: https://whatsapp-web-js-api-production.up.railway.app/send-media
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_API_KEY

Body (JSON):
{
  "action": "sendMedia",
  "to": "{{message.from}}",
  "type": "video",
  "data": "https://example.com/video.mp4",
  "caption": "Ini video yang Anda minta",
  "quotedMessageId": "{{message.serialized}}",
  "simulateTyping": true,
  "typingDuration": 2000
}
```

### Activepieces - Send Video ke Group
```
Method: POST
URL: https://whatsapp-web-js-api-production.up.railway.app/send-media
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_API_KEY

Body (JSON):
{
  "action": "sendMedia",
  "to": "120363040848451142@g.us",
  "type": "video",
  "data": "https://example.com/video.mp4",
  "caption": "Video untuk semua anggota grup",
  "simulateTyping": true,
  "typingDuration": 3000
}
```

### Video Requirements
| Parameter | Value | Keterangan |
|-----------|-------|------------|
| Format | MP4, MOV | MP4 (H.264 codec) direkomendasikan |
| Max Size | 50MB | Batasan WhatsApp Web |
| Duration | Unlimited | Tergantung ukuran file |
| Caption | Max 1024 chars | Teks keterangan video |

---

## Deployment

### Railway Deployment (Recommended)

Aplikasi ini sudah di-deploy di Railway dengan URL permanen:
```
https://whatsapp-web-js-api-production-2cf4.up.railway.app
```

**Fitur Railway:**
- ✅ URL permanen (tidak berubah seperti ngrok)
- ✅ Auto-restart jika crash
- ✅ 24/7 uptime (dengan ping regular)
- ✅ Environment variables management
- ✅ Auto-cleanup media files (24 jam)

**Cara Deploy ke Railway:**
Lihat `RAILWAY_DEPLOY.md` untuk panduan lengkap.

### Local Development

Untuk development lokal:
```bash
# Install dependencies
npm install

# Set environment variables
export API_KEY=your-secret-key
export PORT=3001

# Jalankan server
node api-server.js

# Akses QR scanner
curl http://localhost:3001/qr
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Jalankan API server (api-server.js) |
| `node api-server.js` | Jalankan API server secara langsung |

**Catatan:** Project ini sekarang menggunakan single file `api-server.js` yang menggabungkan WhatsApp client dan API server.

---

## Troubleshooting

### QR Code Muncul Terus
- Session tersimpan di `.wwebjs_auth/`
- Jangan hapus folder ini
- Scan sekali, kemudian session persist
- Jika session hilang, deploy ulang ke Railway atau hapus folder `.wwebjs_auth/` untuk scan ulang

### Media Tidak Tersimpan
- Cek folder `media/` ada dan writable
- Cek permission folder
- Di Railway: storage bersifat ephemeral (hilang saat redeploy), gunakan endpoint `/media/:filename` segera

### Webhook Tidak Terkirim
- Cek `WEBHOOK_URL` di Railway Variables
- Cek URL webhook valid di Activepieces
- Lihat log error di Railway dashboard

### API Key Error (401 Unauthorized)
- Pastikan `API_KEY` sudah di-set di Railway Variables
- Pastikan header `Authorization: Bearer YOUR_API_KEY` ada di request
- Untuk development tanpa API key, hapus variable `API_KEY`

### Media URL Tidak Bisa Diakses
- Pastikan menggunakan Railway domain, bukan ngrok
- URL format: `https://whatsapp-web-js-api-production-2cf4.up.railway.app/media/filename`
- Media hanya tersedia selama 24 jam (auto-cleanup)

### Video Tidak Bisa Dikirim / Format Tidak Didukung
**Error:** Video gagal terkirim atau penerima tidak bisa memutar video

**Solusi:**
- ✅ Pastikan format video adalah **MP4 dengan codec H.264** (paling kompatibel)
- ✅ Ukuran video maksimal **50MB**
- ✅ Cek log server: pastikan ada pesan `✅ Google Chrome detected: /usr/bin/google-chrome-stable`
- ✅ Jika log menunjukkan Chromium (bukan Chrome), deploy ulang ke Railway
- ✅ Untuk format lain (MOV, AVI), konversi ke MP4 terlebih dahulu

**Cek Status Server:**
```bash
curl https://whatsapp-web-js-api-production.up.railway.app/health
```

**Konversi Video ke MP4 (H.264):**
```bash
# Menggunakan FFmpeg
ffmpeg -i input.mov -c:v libx264 -c:a aac -strict experimental output.mp4
```

### Video Terkirim Tapi Tidak Bisa Diputar di WhatsApp
- WhatsApp Web mungkin perlu waktu untuk memproses video
- Coba kirim ulang setelah beberapa menit
- Pastikan video tidak corrupt
- Test dengan video MP4 yang diketahui berfungsi

---

## References

- [whatsapp-web.js Documentation](https://docs.wwebjs.dev/)
- [WhatsApp Web](https://web.whatsapp.com)
- [Activepieces](https://cloud.activepieces.com)
- [Ngrok](https://ngrok.com)

---

**Catatan:** WhatsApp Web unofficial - gunakan dengan risiko sendiri!
