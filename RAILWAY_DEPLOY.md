# Deploy ke Railway.app

Panduan deploy WhatsApp Web JS API Server ke Railway.app untuk 24/7 uptime.

## Prerequisites

1. Akun GitHub
2. Akun Railway.app (daftar gratis di railway.app)

## Langkah Deploy

### 1. Push ke GitHub

```bash
# Inisialisasi git (jika belum)
git init

# Add semua file
git add .

# Commit
git commit -m "Initial commit for Railway deploy"

# Buat repo di GitHub, lalu push
git remote add origin https://github.com/username/whatsapp-web-js-api.git
git push -u origin main
```

### 2. Setup Railway

1. Login ke [railway.app](https://railway.app)
2. Klik "New Project"
3. Pilih "Deploy from GitHub repo"
4. Connect akun GitHub Anda
5. Pilih repository `whatsapp-web-js-api`
6. Railway akan otomatis detect Dockerfile dan deploy

### 3. Environment Variables

Tambahkan environment variables di Railway Dashboard:

| Variable | Value | Keterangan |
|----------|-------|------------|
| `WEBHOOK_URL` | `https://cloud.activepieces.com/api/v1/webhooks/...` | URL webhook Activepieces |
| `NGROK_URL` | (kosongkan/dari domain Railway) | Auto-generated |

**Cara set:**
1. Di project Railway, klik tab "Variables"
2. Klik "New Variable"
3. Masukkan nama dan value
4. Railway akan auto-restart service

### 4. Domain/URL

Railway akan generate URL otomatis:
- Format: `https://whatsapp-web-js-api-production.up.railway.app`
- URL ini permanen (tidak berubah seperti ngrok)

### 5. QR Code Scan

1. Buka logs di Railway dashboard
2. QR code akan muncul di logs
3. Scan dengan WhatsApp mobile
4. Session akan tersimpan otomatis

### 6. Update Webhook URL

Setelah deploy, update webhook URL di Activepieces:

```
https://whatsapp-web-js-api-production.up.railway.app
```

## Monitoring

### Health Check
```bash
curl https://your-app.up.railway.app/health
```

## Troubleshooting

### Build Failed
- Cek Dockerfile syntax
- Pastikan semua dependencies di package.json

### Session Lost
- Scan QR ulang via Railway logs

## Limitations (Free Tier)

- **512MB RAM** - Cukup untuk WhatsApp Web JS
- **1GB Disk** - Untuk media files
- Service sleep setelah inaktif

---

**Selamat!** WhatsApp bot Anda sekarang online 24/7! 🚀
