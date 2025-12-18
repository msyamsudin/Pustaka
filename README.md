# 📚 Pustaka+
Aplikasi yang berfungsi untuk merangkum sebuah buku menggunakan bantuan AI melalui OpenRouter atau Ollama. Untuk mencegah halusinasi AI, aplikasi akan memastikan bahwa buku yang akan dirangkum benar-benar ada (melalui Google Books & OpenLibrary) sebelum menggunakan AI untuk merangkum isinya.

## ✨ Fitur Utama
- **Verifikasi Ganda**: Mengecek metadata buku ke sumber tepercaya (Google Books & OpenLibrary).
- **Rangkuman AI**: Menggunakan LLM (OpenRouter atau Ollama) untuk merangkum buku yang terverifikasi.
- **Provider**: **OpenRouter** (Cloud) & **Ollama** (Lokal)

## 🛠️ Prasyarat
Pastikan Anda sudah menginstal:
- **Python 3.9+**
- **Node.js**
- **Ollama** (Hanya jika ingin menjalankan model AI secara lokal/offline)

## 📦 Instalasi

### 1. Instalasi Backend
Buka terminal di folder utama proyek:
```bash
pip install -r requirements.txt
```

### 2. Instalasi Frontend
Masuk ke folder frontend dan install dependencies:
```bash
cd frontend
npm install
cd ..
```

## 🚀 Cara Menjalankan Aplikasi

### Opsi 1: Otomatis (Termudah)
Cukup klik dua kali file **`run_app.bat`** di folder utama.
Ini akan membuka dua jendela terminal sekaligus (satu untuk Backend, satu untuk Frontend).

### Opsi 2: Manual (Dua Terminal)
Jika ingin menjalankan satu per satu:

**Terminal 1 (Backend):**
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Buka browser di: **http://localhost:5173**

## 🔑 Konfigurasi AI
Aplikasi ini mendukung dua metode penggunaan AI:

1. **Cloud (OpenRouter)**:
   - Klik status AI di pojok kanan atas.
   - Pilih tab **OpenRouter** dan masukkan API Key Anda.
   - Pilih model yang tersedia (Flash, Pro, dll).

2. **Lokal (Ollama)**:
   - Pastikan **Ollama** sudah terinstal dan sedang berjalan (`ollama serve`).
   - Klik status AI, pilih tab **Ollama**.
   - Masukkan Base URL Ollama (default: `http://localhost:11434`).
   - Pilih model lokal yang sudah Anda unduh (misal: `llama3`, `mistral`, `phi3`).

Konfigurasi disimpan secara otomatis di file `backend/config.json`.

## 📁 Struktur Proyek
- `/backend`: Logika server Python (FastAPI), Verifikasi, dan Summarizer.
- `/frontend`: Antarmuka pengguna (React + Vite).

## 📄 Lisensi
[LICENSE](LICENSE)