# WhatsApp Web JS API Server

WhatsApp Web API Server dengan webhook integration untuk Activepieces.

## Features

- ✅ Menerima pesan text dan media dari WhatsApp
- ✅ Download dan simpan media ke folder lokal
- ✅ Kirim webhook ke Activepieces saat menerima pesan
- ✅ File server untuk serve media via URL publik
- ✅ Session persistence (tidak perlu scan QR setiap kali)
- ✅ API endpoint untuk kirim pesan dan media
- ✅ Support reply message
- ✅ Support delay dan typing indicator

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API info |
| `/health` | GET | Health check |
| `/send-message` | POST | Send text message |
| `/send-media` | POST | Send media files |

## Deploy ke Railway (24/7 Uptime)

Lihat file `RAILWAY_DEPLOY.md` untuk panduan deploy ke Railway.app

URL Repo: https://github.com/dokumentasimjmbau-oss/whatsapp-web-js-api

## Local Development

```bash
npm install
node api-server.js
```

## Environment Variables

- `WEBHOOK_URL` - URL webhook untuk menerima pesan
- `NGROK_URL` - Public URL untuk serve media (optional)
- `PORT` - Port server (default: 3001)

## License

ISC