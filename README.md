# Pustaka+

<img width="1317" height="941" alt="image" src="https://github.com/user-attachments/assets/cb084b99-a1c3-49cc-b1c8-4e4d1f8b4127" />


Aplikasi yang berfungsi untuk mensintesis beragam konsep kunci hingga nilai aplikatif menggunakan bantuan AI.

## Fitur Utama
- **Analytical Briefing Engine**: Menghasilkan analisis mendalam dengan struktur **3-bagian utama** (*Executive Summary & Core Thesis*, *Analytical Framework*, dan *Market & Intellectual Positioning*) yang fokus pada logika argumen dan posisi intelektual karya.
- **Section-by-Section Synthesis**: Sebuah proses yang menggabungkan berbagai versi rangkuman dengan membedah tiap bagian secara independen untuk menjaga detail data dan struktur hasil akhir.
- **Iterative Self-Correction**: Mekanisme audit otomatis di mana AI bertindak sebagai kritikus untuk mengevaluasi draf, kemudian melakukan revisi mandiri hingga mencapai target kualitas yang ditentukan.
- **Enhanced Verification & Search**: Verifikasi data buku via Google Books & OpenLibrary, serta fitur *Search Enrichment* (Brave Search Engine & Wikipedia).
- **Multi-Version Library**: Simpan berbagai versi rangkuman untuk satu buku (misal: perbandingan antar model AI) dan kelola dalam *Saved Library*.
- **Multiple AI Providers**: Dukungan untuk **OpenRouter**, **Groq**, dan **Ollama** (Lokal).
- **Analytical Refining Mode**: Menghasilkan draf ringkasan awal secara paralel (level kedalaman 1-10 via **Draft Depth slider**) lalu melakukan tahap pemurnian (*refining*).
- **Smart Resume**: Kemampuan melanjutkan proses perangkuman yang terputus tanpa harus mengulang dari awal.
- **Tanya AI & Notes**: Interaksi tanya-jawab kontekstual dengan hasil rangkuman, serta fitur pencatatan (*Note Taking*) yang terintegrasi.

## Instalasi

Pastikan kamu sudah menginstal:
- **Python 3.9+**
- **Node.js**
- **Ollama** (Hanya jika ingin menjalankan model AI secara lokal/offline)

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

## Cara Menjalankan Aplikasi

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

## Konfigurasi AI
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

## Struktur Proyek
- `/backend`: Logika server Python (FastAPI), Verifikasi, dan Summarizer.
- `/frontend`: Antarmuka pengguna (React + Vite).

## Lisensi
[LICENSE](LICENSE)