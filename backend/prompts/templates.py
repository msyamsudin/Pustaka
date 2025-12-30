# =========================================================
# ENHANCED CORE STRUCTURE PROMPT
# =========================================================

CORE_STRUCTURE_PROMPT = """
<output_structure_template>

## 1. EXECUTIVE SUMMARY & CORE THESIS

**Ringkasan Inti**:
[TULIS SATU PARAGRAF UTUH: 100–150 kata]
[TIDAK BOLEH: bullet points, kalimat terputus, tone promosi]
[HARUS MENCAKUP: problem statement, core claim, conditional scope/boundary]

**Tesis Utama & Argumen (Logical Chain)**:
[4–6 langkah inferensial berurutan]
Format untuk setiap langkah:
• **[Klaim Utama]** → [Mekanisme/Lensa Analitis] → [Implikasi Terbatas + Boundary Condition]

Contoh struktur:
• **Reformasi kebijakan fiskal 1998 menciptakan path dependence** → melalui initial 
  institutional choices yang membatasi policy space → berdampak pada trajectory 
  industrial policy hingga 2010-an [Scope: sektor formal, asumsi political stability]

**Kutipan Representatif**:
> "[Kutipan verbatim paling representatif dari teks asli]" — [Penulis, Hal. X]

ATAU jika tidak tersedia:
> [Paraphrase—non-verbatim]: [Ringkasan representatif dari argumen kunci]

[Analisis 1 kalimat: fungsi struktural kutipan dalam membangun argumen utama]

---

## 2. ANALYTICAL FRAMEWORK

[FOKUS: Explain HOW argument works, NOT WHAT book discusses]

**Terminologi Kunci**:
[5–7 istilah, masing-masing dengan struktur:]
- **[Istilah]** (textual/interpretative): [Definisi operasional dalam konteks buku + 
  fungsi analitisnya]

Contoh:
- **Path Dependence** (textual): Konsep yang digunakan penulis untuk 
  menjelaskan bagaimana initial policy choices membatasi ruang kebijakan subsequent.
  Fungsi analitis: menjadi organizing principle untuk memahami institutional inertia.

- **Embedded Liberalism** [Interpretative Construct]: Framework implisit yang 
  merekonstruksi tension antara market efficiency dan social protection dalam 
  argumen penulis di Bab 3-5. Tidak disebutkan eksplisit, tetapi struktur 
  argumentasi konsisten dengan konsep ini.

**Logika Argumen Inti**:
A. **Celah yang Disasar**: [Kekurangan teoretis atau empiris yang dikritik]
B. **Lensa Analitis**: [Pendekatan/method/framework yang digunakan]
C. **Sintesis Logis**: [Bagaimana A melalui B menghasilkan klaim bersyarat]

---

## 3. MARKET & INTELLECTUAL POSITIONING

**Posisi Komparatif**:
Tempatkan buku ini pada MINIMAL SATU sumbu intelektual:
- [Dimensi 1] ↔ [Dimensi 2] (contoh: empiris ↔ normatif, mikro ↔ makro)
- Posisi buku ini: [Jelaskan dengan reference ke minimal 1 karya pembanding]

Contoh:
Pada sumbu empiris ↔ normatif, buku ini berposisi di kuadran empiris-moderately 
prescriptive, berbeda dari Dani Rodrik's "One Economics, Many Recipes" yang lebih 
eksplisit normative dalam policy recommendations.

**Diferensiasi Inti**:
[Jelaskan 1-2 mekanisme atau framing konseptual yang secara STRUKTURAL membedakan
buku ini dari kompetitor terdekat]

**Kontribusi Diskursif**:
[Pilih SATU dan elaborasi:]
- Memperbaiki blind spot dalam literatur: [Jelaskan gap yang diisi]
- Menggabungkan aliran pemikiran: [Jelaskan synthesis]
- Menantang asumsi dominan: [Jelaskan orthodoxy yang ditantang]

**Intellectual lineage**:
[Tegaskan genealogi dengan SALAH SATU format:]
- "Penulis secara eksplisit mengklaim meneruskan tradisi [X]" (jika cited)
- "Scholarly consensus menempatkan karya ini dalam tradisi [X]" (jika established)
- "[Speculative Comparison]: Pendekatan penulis menunjukkan parallel dengan [X], 
  meskipun tidak disebutkan eksplisit" (jika interpretative)

</output_structure_template>
"""
