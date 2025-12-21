# 📚 Pustaka+
Aplikasi yang berfungsi untuk mensintesis beragam konsep kunci hingga nilai aplikatif menggunakan bantuan AI.

## ✨ Fitur Utama
- **Analytical Briefing Engine**: Menghasilkan analisis mendalam dengan struktur 9-bagian (Identitas, Sinopsis, Konsep Kunci, Analisis Kontekstual, hingga Applied Value), bukan sekadar ringkasan biasa.
- **Book Verification**: Memverifikasi keberadaan buku melalui Google Books & OpenLibrary untuk mencegah halusinasi AI.
- **Analytical Refining Mode**: Menghasilkan 3 draf ringkasan awal secara paralel lalu melakukan tahap pemurnian (*refining*) untuk akurasi dan kepadatan informasi maksimal.
- **Smart Resume**: Kemampuan melanjutkan proses perangkuman yang terputus tanpa harus mengulang dari awal.
- **Library Management**: Simpan, kelola, dan baca kembali hasil analisis buku Anda kapan saja dalam antarmuka *Saved Library* yang elegan.
- **Multiple AI Providers**: Dukungan untuk **OpenRouter** (Cloud), **Groq** (Ultra-fast Cloud), dan **Ollama** (Lokal/Offline Privacy).
- **Tanya AI**: Tanya AI tentang konsep kunci, analisis kontekstual, atau applied value dari hasil rangkuman. Kemudian simpan sebagai catatan.

## 🛠️ Prasyarat
Pastikan kamu sudah menginstal:
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

1. **Cloud (OpenRouter & Groq)**:
   - Klik status AI di pojok kanan atas.
   - Pilih tab **OpenRouter** atau **Groq** dan masukkan API Key kamu.
   - Pilih model yang tersedia (misal: `llama-3.3-70b-versatile` untuk Groq).

2. **Lokal (Ollama)**:
   - Pastikan **Ollama** sudah terinstal dan sedang berjalan (`ollama serve`).
   - Klik status AI, pilih tab **Ollama**.
   - Masukkan Base URL Ollama (default: `http://localhost:11434`).
   - Pilih model lokal yang sudah kamu unduh (misal: `llama3`, `mistral`, `phi3`).

Konfigurasi disimpan secara otomatis di file `user_config.json`.

## 📁 Struktur Proyek
- `/backend`: Logika server Python (FastAPI), Verifikasi, dan Summarizer.
- `/frontend`: Antarmuka pengguna (React + Vite).

## 📄 Lisensi
[LICENSE](LICENSE)