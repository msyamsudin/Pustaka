# =========================================================
# LAYER 2: OUTPUT FORMAT (STRUCTURE)
# =========================================================

CORE_STRUCTURE_PROMPT = """
<output_structure_template>

## 1. EXECUTIVE SUMMARY & LOGICAL CHAIN

### 1a. EXECUTIVE SUMMARY
[TULIS SATU PARAGRAF UTUH: 100–150 kata]
[KEHARUSAN: Berbentuk naratif prose, tone objektif/akademis]
[LARANGAN: Tidak boleh ada bullet points, list, atau sub-heading di sini]
[CAKUPAN: Problem statement, core claim, dan conditional scope buku]

### 1b. TESIS UTAMA & ARGUMEN (LOGICAL CHAIN)
[4–6 langkah inferensial berurutan yang menunjukkan alur berpikir penulis]
[KEHARUSAN: Menggunakan bullet points dan simbol panah (→)]
Format untuk setiap langkah:
• **[Klaim Utama]** → [Mekanisme/Lensa Analitis] → [Implikasi Terbatas + Boundary Condition]

---

**Kutipan Representatif**:
> "[Kutipan verbatim paling representatif]" — [Penulis, Hal. X]
ATAU jika tidak tersedia (WAJIB label):
> [Paraphrase—non-verbatim]: [Ringkasan representatif dari argumen kunci]

[Analisis 1 kalimat: fungsi struktural kutipan dalam membangun argumen utama]

---

## 2. ANALYTICAL FRAMEWORK

[FOKUS: Jelaskan BAGAIMANA argumen bekerja secara mekanis, bukan hanya APA yang dibahas]

**Terminologi Kunci**:
[5–7 istilah kunci dengan struktur:]
- **[Istilah]** (textual/interpretative): [Definisi operasional dalam konteks buku + fungsi analitisnya]

**Logika Argumen Inti**:
A. **Celah yang Disasar**: [Kekurangan teoretis atau empiris yang dikritik penulis]
B. **Lensa Analitis**: [Pendekatan/metode/framework yang digunakan]
C. **Sintesis Logis**: [Bagaimana A melalui B menghasilkan klaim bersyarat]

---

## 3. MARKET & INTELLECTUAL POSITIONING

**Posisi Komparatif**:
Tempatkan buku ini pada MINIMAL SATU sumbu intelektual (misal: empiris ↔ normatif, mikro ↔ makro):
- Posisi buku: [Jelaskan dengan referensi ke minimal 1 karya/aliran pembanding]

**Diferensiasi Inti**:
[Jelaskan 1-2 mekanisme atau framing konseptual yang secara STRUKTURAL membedakan buku ini dari kompetitor/literatur sejenis]

**Kontribusi Diskursif**:
[Jelaskan bagaimana buku ini memperbaiki blind spot, menggabungkan aliran pemikiran, atau menantang ortodoksi]

**Intellectual Lineage**:
[Tegaskan genealogi intelektual penulis (Explicit/Scholarly Consensus/Speculative Comparison)]

</output_structure_template>
"""
