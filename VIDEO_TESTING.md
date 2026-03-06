# 🎬 Testing Kirim Video WhatsApp

Panduan lengkap untuk testing pengiriman video MP4 via WhatsApp Web JS API.

## 📋 Prasyarat

1. **Scan QR Code** terlebih dahulu di: https://whatsapp-web-js-api-production-2cf4.up.railway.app/qr
2. Pastikan status API menunjukkan `clientReady: true`:
   ```bash
   curl https://whatsapp-web-js-api-production-2cf4.up.railway.app/health
   ```
3. Siapkan **API Key** (jika sudah di-set di Railway Variables)

---

## 🧪 Testing dengan cURL

### 1. Test Kirim Video dari URL

```bash
curl -X POST https://whatsapp-web-js-api-production-2cf4.up.railway.app/send-media \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "action": "sendMedia",
    "to": "628123456789@c.us",
    "type": "video",
    "data": "https://www.w3schools.com/html/mov_bbb.mp4",
    "caption": "Testing kirim video MP4! 🎬"
  }'
```

**Catatan:** Ganti `628123456789@c.us` dengan nomor WhatsApp tujuan (format: 62xxxxxxxxxx@c.us)

---

### 2. Test Kirim Video dengan Reply

```bash
curl -X POST https://whatsapp-web-js-api-production-2cf4.up.railway.app/send-media \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "action": "sendMedia",
    "to": "628123456789@c.us",
    "type": "video",
    "data": "https://www.w3schools.com/html/mov_bbb.mp4",
    "caption": "Ini video yang Anda minta",
    "quotedMessageId": "false_628123456789@c.us_ABC123DEF456",
    "simulateTyping": true,
    "typingDuration": 3000
  }'
```

---

### 3. Test Kirim Video ke Group

```bash
curl -X POST https://whatsapp-web-js-api-production-2cf4.up.railway.app/send-media \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "action": "sendMedia",
    "to": "120363040848451142@g.us",
    "type": "video",
    "data": "https://www.w3schools.com/html/mov_bbb.mp4",
    "caption": "Video untuk semua anggota grup! 🎥"
  }'
```

---

### 4. Test dengan Video Sample Publik

Berikut beberapa URL video sample yang bisa digunakan untuk testing:

| URL | Format | Ukuran |
|-----|--------|--------|
| `https://www.w3schools.com/html/mov_bbb.mp4` | MP4 (H.264) | ~2MB |
| `http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4` | MP4 (H.264) | ~158MB |
| `http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4` | MP4 (H.264) | ~43MB |

**⚠️ Perhatian:** Video dengan ukuran >50MB mungkin gagal karena batasan server.

---

## 🔄 Testing dengan ActivePieces

### Setup HTTP Request Module

1. Tambahkan **HTTP Request** module di ActivePieces
2. Konfigurasi sebagai berikut:

```
Method: POST
URL: https://whatsapp-web-js-api-production-2cf4.up.railway.app/send-media
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_API_KEY

Body (JSON):
{
  "action": "sendMedia",
  "to": "628123456789@c.us",
  "type": "video",
  "data": "https://www.w3schools.com/html/mov_bbb.mp4",
  "caption": "Video dari ActivePieces! 🎬",
  "simulateTyping": true,
  "typingDuration": 3000
}
```

### Dengan Dynamic Data (dari Webhook)

```
Method: POST
URL: https://whatsapp-web-js-api-production-2cf4.up.railway.app/send-media
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_API_KEY

Body (JSON):
{
  "action": "sendMedia",
  "to": "{{message.from}}",
  "type": "video",
  "data": "{{video_url}}",
  "caption": "Ini video yang Anda minta: {{message.body}}",
  "quotedMessageId": "{{message.serialized}}",
  "simulateTyping": true,
  "typingDuration": 2000
}
```

---

## ✅ Expected Response

### Success Response
```json
{
  "success": true,
  "messageId": "ABC123DEF456GHI789",
  "timestamp": 1772755913031,
  "to": "628123456789@c.us",
  "mediaType": "video",
  "filename": "mov_bbb.mp4",
  "mimetype": "video/mp4",
  "delayed": false,
  "delayMs": 0,
  "typingSimulated": true,
  "repliedTo": null
}
```

### Error Response (Client Not Ready)
```json
{
  "error": "WhatsApp client not ready"
}
```
**Solusi:** Scan QR code di https://whatsapp-web-js-api-production-2cf4.up.railway.app/qr

### Error Response (Invalid API Key)
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid API key. Provide API key in Authorization header: Bearer YOUR_API_KEY"
}
```
**Solusi:** Pastikan header `Authorization: Bearer YOUR_API_KEY` sudah benar

### Error Response (File Too Large)
```json
{
  "error": "Failed to download file from URL",
  "details": "File too large: 158.45MB. Max 50MB allowed."
}
```
**Solusi:** Gunakan video dengan ukuran lebih kecil (<50MB)

---

## 🔍 Troubleshooting

### Video Tidak Terkirim

1. **Cek Status Server:**
   ```bash
   curl https://whatsapp-web-js-api-production-2cf4.up.railway.app/health
   ```
   Pastikan `clientReady: true`

2. **Cek Logs:**
   ```bash
   railway logs
   ```
   Pastikan ada pesan: `✅ Google Chrome detected: /usr/bin/google-chrome-stable`

3. **Cek Chrome Detection:**
   Jika log menunjukkan Chromium (bukan Chrome), deploy ulang:
   ```bash
   railway up
   ```

### Video Terkirim Tapi Tidak Bisa Diputar

- Pastikan format video adalah **MP4 (H.264 codec)**
- Coba gunakan video sample dari daftar di atas
- Cek apakah video corrupt dengan memutarnya di browser

### Video Lambat Terkirim

- Video besar membutuhkan waktu lebih lama untuk di-download dan diproses
- Tunggu beberapa detik setelah mengirim request
- Cek logs untuk melihat progress download

---

## 📊 Log Server yang Diharapkan

Saat mengirim video, log server akan menunjukkan:

```
📥 Processing URL: https://www.w3schools.com/html/mov_bbb.mp4
📊 File size: 1.95MB
✅ File downloaded: mov_bbb.mp4, Size: 2671.73KB, Type: video/mp4
💾 Media saved to temp file: media/temp_1234567890123_mov_bbb.mp4
✅ Media sent successfully
🗑️ Temp file deleted: media/temp_1234567890123_mov_bbb.mp4
```

---

## 🎥 Format Video yang Didukung

| Format | Codec | Status |
|--------|-------|--------|
| MP4 | H.264 | ✅ Fully Supported |
| MP4 | H.265/HEVC | ⚠️ May not work on all devices |
| MOV | H.264 | ✅ Supported |
| AVI | - | ❌ Not supported |
| MKV | - | ❌ Not supported |
| WEBM | - | ⚠️ Limited support |

**Rekomendasi:** Gunakan MP4 dengan H.264 codec untuk kompatibilitas terbaik.

---

## 📝 Catatan Penting

1. **Server menggunakan Google Chrome Stable** (bukan Chromium) untuk mendukung video H.264
2. **Ukuran maksimal video:** 50MB
3. **Video di-download ke server** terlebih dahulu sebelum dikirim ke WhatsApp
4. **Auto-cleanup:** File temp akan dihapus otomatis setelah terkirim
5. **Session persist:** Setelah scan QR, session akan tersimpan (tidak perlu scan ulang)

---

## 🚀 Siap Testing!

Setelah scan QR code, Anda bisa langsung menggunakan command curl di atas atau setup ActivePieces untuk mengirim video secara otomatis.

**URL API:** https://whatsapp-web-js-api-production-2cf4.up.railway.app
**QR Code:** https://whatsapp-web-js-api-production-2cf4.up.railway.app/qr

Selamat mencoba! 🎬✨