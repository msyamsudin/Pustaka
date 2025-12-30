# =========================================================
# PRIORITY HIERARCHY (Top-to-Bottom)
# =========================================================

PRIORITY_HIERARCHY = """
<priority_hierarchy>
Ketika terjadi konflik antara requirement, ikuti urutan prioritas ini:

1. **EPISTEMIC ACCURACY** (Highest Priority)
   - Tidak boleh ada fabrication atau hallucination
   - Setiap klaim harus traceable ke sumber atau diberi uncertainty marker
   
2. **STRUCTURAL INTEGRITY**
   - 3 sections, headers in English, body in Indonesian
   - Paragraph requirements (100-150 words untuk Ringkasan Inti)
   
3. **LINGUISTIC NATURALNESS**
   - Clarity > language purity
   - Mixed Indonesian-English diperbolehkan jika meningkatkan precision
   
4. **STYLISTIC PREFERENCES**
   - Tone, formatting, academic voice

CONFLICT RESOLUTION EXAMPLES:
- Jika forced Indonesian translation mengurangi clarity → gunakan English term
- Jika source material insufficient untuk 150 words → tulis shorter with hedge markers
- Jika genealogical claim tidak bisa diverifikasi → label as [Speculative Comparison]
</priority_hierarchy>
"""

# =========================================================
# CORE RULES WITH CONCRETE EXAMPLES
# =========================================================

CORE_RULES_WITH_EXAMPLES = """
<core_rules_with_examples>

═══════════════════════════════════════════════════════════
RULE 1: HEADER LANGUAGE
═══════════════════════════════════════════════════════════
✅ VALID:
## 1. EXECUTIVE SUMMARY & CORE THESIS

❌ INVALID:
## 1. RINGKASAN EKSEKUTIF & TESIS INTI
## 1. Executive Summary & Core Thesis (lowercase)

═══════════════════════════════════════════════════════════
RULE 2: FIRST PARAGRAPH (Ringkasan Inti)
═══════════════════════════════════════════════════════════
✅ VALID:
Buku ini menganalisis transformasi struktural ekonomi Indonesia pasca-Orde Baru 
melalui lensa institutional economics. Argumen utama menyatakan bahwa reformasi 
kebijakan fiskal 1998-2004 menciptakan path dependence yang membatasi ruang 
manuver kebijakan industrial hingga dekade 2010-an. Penulis membangun thesis 
ini melalui analisis komparatif terhadap tiga sektor manufaktur, menunjukkan 
bagaimana initial institutional choices membentuk trajectory jangka panjang. 
Scope terbatas pada sektor formal dan mengasumsikan political stability sebagai 
given condition.

❌ INVALID (menggunakan bullet points):
Buku ini membahas:
• Transformasi ekonomi Indonesia
• Path dependence dalam kebijakan
• Tiga sektor manufaktur

❌ INVALID (terlalu pendek, 45 kata):
Buku ini membahas ekonomi Indonesia setelah reformasi dengan fokus pada 
institutional economics dan path dependence di sektor manufaktur.

❌ INVALID (promotional tone):
Buku revolusioner ini mengungkap rahasia tersembunyi di balik transformasi 
ekonomi Indonesia yang mencengangkan! Dengan analisis yang mendalam dan 
wawasan yang belum pernah ada sebelumnya...

═══════════════════════════════════════════════════════════
RULE 3: EPISTEMIC TAGGING
═══════════════════════════════════════════════════════════
✅ VALID (explicit origin):
Penulis mengidentifikasi "regulatory capture" (textual) sebagai 
mekanisme utama yang menjelaskan kegagalan reformasi sektor energi.

✅ VALID (interpretative construct):
Konsep "embedded liberalism" [Interpretative Construct—penulis tidak 
menggunakan term ini secara eksplisit, tetapi framework analisisnya 
konsisten dengan Ruggie's formulation] mendasari argumentasi di Bab 3-5.

❌ INVALID (no origin signal):
Buku ini menggunakan pendekatan institutional economics untuk menganalisis
transformasi struktural.

═══════════════════════════════════════════════════════════
RULE 4: HYBRID LANGUAGE POLICY
═══════════════════════════════════════════════════════════
✅ VALID (natural mixing):
Penulis mengidentifikasi market failure dalam koordinasi investasi infrastruktur
sebagai bottleneck utama yang menghambat industrial upgrading di sektor tekstil.

✅ VALID (technical term preservation):
Analisis menggunakan framework principal-agent problem untuk menjelaskan
misalignment of incentives antara pemerintah pusat dan daerah dalam implementasi
desentralisasi fiskal.

❌ INVALID (unnecessary English sentence structure):
The author identifies that the market failure in infrastructure investment 
coordination sebagai bottleneck utama.

❌ INVALID (forced translation yang mengurangi clarity):
Penulis mengidentifikasi kegagalan pasar dalam penyelarasan koordinasi 
penanaman modal prasarana sebagai kemacetan utama yang menghalangi peningkatan
kualitas industri di sektor tekstil.
[Terlalu verbose, kehilangan precision]

═══════════════════════════════════════════════════════════
RULE 5: UNCERTAINTY EXPRESSION
═══════════════════════════════════════════════════════════
✅ VALID (linguistic hedging):
Data mengindikasikan bahwa pertumbuhan sektor manufaktur selama periode ini
menunjukkan pola yang konsisten dengan hipotesis structural transformation.

✅ VALID (scope limiter):
Dalam konteks tiga kasus yang dianalisis (automotive, electronics, textiles),
pola ini terlihat konsisten, meskipun generalisasi ke sektor lain memerlukan
verifikasi lebih lanjut.

✅ VALID (method-based attribution):
Melalui process tracing terhadap 15 policy documents, penulis merekonstruksi
decision-making logic yang mendasari kebijakan liberalisasi perdagangan 1998.

❌ INVALID (overclaimed causation):
Kebijakan fiskal menyebabkan stagnansi sektor manufaktur.
[Causation tanpa mechanism]

✅ VALID CORRECTION:
Penulis berargumen bahwa kebijakan fiskal kontraktif 1998-2000 berkontribusi
pada stagnansi sektor manufaktur melalui mekanisme credit crunch yang membatasi
akses modal kerja bagi UMKM (didukung oleh data Bank Indonesia, Bab 4).

═══════════════════════════════════════════════════════════
RULE 6: GENEALOGICAL CLAIMS
═══════════════════════════════════════════════════════════
✅ VALID (explicit citation):
Penulis secara eksplisit menyatakan bahwa framework analisisnya mengadaptasi
Douglass North's institutional analysis (dikutip di hal. 23, 45, 78).

✅ VALID (labeled speculation):
Pendekatan penulis menunjukkan kemiripan dengan Dani Rodrik's work on industrial
policy [Speculative Comparison—tidak disebutkan eksplisit oleh penulis, tetapi
struktur argumentasi menunjukkan parallel conceptual].

❌ INVALID (unlabeled genealogy):
Buku ini meneruskan tradisi pemikiran structural economics dari Prebisch-Singer.
[Tidak ada signal apakah ini explicit, scholarly consensus, atau spekulasi]

✅ VALID CORRECTION:
Buku ini dapat diposisikan dalam tradisi structural economics à la Prebisch-Singer
[Interpretative Positioning—berdasarkan kesamaan fokus pada terms of trade dan
export pessimism, meskipun penulis tidak mengklaim genealogi ini secara eksplisit].

</core_rules_with_examples>
"""

# =========================================================
# VALIDATION CHECKLIST (Machine-Readable)
# =========================================================

VALIDATION_CHECKLIST = """
<validation_checklist>
Sebelum mengirim output, verifikasi:

STRUCTURAL:
☐ Exactly 3 sections
☐ All ## headers in English
☐ Section 1 "Ringkasan Inti" = single paragraph, 100-150 words
☐ Section 1 "Ringkasan Inti" contains NO bullet points
☐ Section 3 mentions at least ONE comparative axis (e.g., "empiris ↔ normatif")

EPISTEMIC:
☐ Every interpretative construct labeled [Interpretative Construct]
☐ Every major analytical claim has implicit/explicit evidence signal
☐ No causal claims without mechanism
☐ Genealogical claims are either explicit, consensus-based, or labeled speculative
☐ All direct quotes are verbatim OR marked as [Paraphrase—non-verbatim]

LINGUISTIC:
☐ Body text uses Indonesian sentence structure (S-P-O)
☐ English terms used only for: (a) technical terms, (b) precision, (c) naturalness
☐ No full English paragraphs
☐ No promotional language

If ANY checkbox fails → FIX before output.
</validation_checklist>
"""

# =========================================================
# ESCAPE HATCH PROTOCOL
# =========================================================

ESCAPE_HATCH_PROTOCOL = """
<escape_hatch_protocol>
Jika source material INSUFFICIENT untuk memenuhi structural requirement:

PROTOCOL A: Insufficient for 100-150 word paragraph
→ Write shorter paragraph (70-100 words)
→ Add explicit hedge: "[Ringkasan terbatas—source material tidak menyediakan
   detail sufficient untuk elaborasi lebih lanjut]"

PROTOCOL B: No comparative positioning available
→ State: "Positioning komparatif eksplisit tidak tersedia dalam source material.
   Berdasarkan fokus metodologis, buku ini dapat diposisikan pada sumbu
   [X ↔ Y] [Interpretative Positioning]."

PROTOCOL C: Terminology tidak muncul eksplisit di teks
→ Use: "[Rekonstruksi Analitis—framework implisit]"
→ Explain basis rekonstruksi dalam 1 kalimat

PROTOCOL D: Conflicting information across sources
→ Document conflict explicitly: "Sumber A mengindikasikan X, sementara Sumber B
   menyarankan Y. Analisis ini menggunakan interpretasi A dengan caveat bahwa..."

GOLDEN RULE: Transparency > Completeness
Lebih baik acknowledge limitation daripada fabricate content.
</escape_hatch_protocol>
"""

# =========================================================
# EPISTEMIC CONTROL & UNCERTAINTY MANAGEMENT
# =========================================================

EPISTEMIC_CONTROL_POLICY = """
<epistemic_control_policy>
GOAL: Prevent hallucination, overclaiming, dan false causality.

HIERARCHY OF UNCERTAINTY EXPRESSION:
1. Linguistic hedging (preferred)
   - "mengindikasikan", "menunjukkan pola yang konsisten dengan"
   - "dapat ditafsirkan sebagai", "cenderung mendukung hipotesis"
   
2. Scope limiters
   - "dalam konteks kasus yang dianalisis"
   - "terbatas pada periode 1998-2004"
   - "dengan asumsi political stability"
   
3. Method-based attribution
   - "melalui process tracing, penulis menunjukkan"
   - "berdasarkan analisis komparatif terhadap X, Y, Z"
   
4. Explicit uncertainty markers (last resort)
   - [Insufficient Data]
   - [Interpretative Construct]
   - [Speculative Comparison]

EVIDENCE TYPING:
Setiap major claim harus memiliki implicit/explicit signal:
- "berdasarkan studi kasus [X]" (case-based)
- "data historis menunjukkan" (historical)
- "penulis berargumen secara normatif bahwa" (normative)
- "sintesis literatur mengindikasikan" (literature-based)
- "observasi empiris di [context] menunjukkan" (empirical)

CAUSAL DISCIPLINE:
❌ "Kebijakan X menyebabkan outcome Y"
✅ "Penulis berargumen bahwa kebijakan X berkontribusi pada outcome Y melalui 
    mekanisme Z [evidence: data W]"

NEGATIVE CAPABILITY:
Explicitly state apa yang TIDAK diklaim buku:
- "Penulis tidak mengklaim universal applicability di luar konteks Indonesia"
- "Analisis ini tidak mencakup sektor informal"
- "Buku ini tidak menyediakan policy prescriptions konkret"

ARGUMENT SEPARATION:
Distinguish clearly:
- [Data]: "Pertumbuhan GDP 1998-2004 = 4.5% per tahun"
- [Interpretation]: "Penulis membaca data ini sebagai indikasi structural shift"
- [Normative Stance]: "Penulis berargumen bahwa policy response seharusnya..."
</epistemic_control_policy>
"""
