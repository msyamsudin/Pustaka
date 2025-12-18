# 📚 Pustaka+
Aplikasi AI Full-Stack untuk memverifikasi keberadaan buku dan membuat rangkuman faktual. Aplikasi ini memastikan buku benar-benar ada (melalui Google Books & OpenLibrary) sebelum menggunakan AI untuk merangkum isinya, demi mencegah halusinasi AI.

## ✨ Fitur Utama
- **Verifikasi Ganda**: Mengecek metadata buku ke sumber tepercaya (Google Books & OpenLibrary).
- **Rangkuman AI**: Menggunakan LLM (OpenRouter) untuk merangkum buku yang terverifikasi.
- **Provider**: **OpenRouter**

## 🛠️ Prasyarat
Pastikan Anda sudah menginstal:
- **Python 3.9+**
- **Node.js** (untuk Frontend React)

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

## 🔑 Konfigurasi API
Anda tidak perlu mengedit file `env` secara manual.
1. Buka aplikasi di browser.
2. Klik ikon **Gear (Pengaturan)** di pojok kanan atas.
3. Pilih Provider (Gemini atau OpenRouter).
4. Masukkan **API Key** Anda di kolom yang tersedia.
   - Aplikasi akan otomatis memvalidasi Key tersebut.
   - Jika menggunakan OpenRouter, daftar model akan muncul otomatis setelah validasi sukses.

## 📁 Struktur Proyek
- `/backend`: Logika server Python (FastAPI), Verifikasi, dan Summarizer.
- `/frontend`: Antarmuka pengguna (React + Vite).

## 📄 Lisensi
Proyek ini dilisensikan di bawah **MIT License**. Lihat file [LICENSE](LICENSE) untuk detail lebih lanjut.
