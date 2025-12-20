from openai import OpenAI
from typing import Dict, List, Optional, Generator
import time
import json
import re
import requests
from threading import Lock
from currency_manager import CurrencyManager


class BookSummarizerError(Exception):
    """Base exception for BookSummarizer errors"""
    pass


class BookSummarizer:
    # Class-level pricing cache to avoid repeated API calls
    _pricing_cache = {}
    _pricing_cache_lock = Lock()
    _pricing_cache_timestamp = 0
    PRICING_CACHE_TTL = 3600  # 1 hour
    
    def __init__(
        self, 
        api_key: Optional[str] = None, 
        model_name: Optional[str] = None, 
        provider: str = "OpenRouter", 
        base_url: Optional[str] = None, 
        timeout: int = 60, 
        max_retries: int = 3
    ):
        self.api_key = api_key
        self.model_name = model_name or "google/gemini-2.0-flash-exp:free"
        self.provider = provider
        self.base_url = base_url
        self.timeout = timeout
        self.max_retries = max_retries
        self.client = None
        self.currency_manager = CurrencyManager()
        self._client_lock = Lock()  # For thread-safe client operations

        self._initialize_client()

    def _initialize_client(self):
        """Initialize the appropriate AI client based on provider"""
        if self.provider == "OpenRouter" and self.api_key:
            self.client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=self.api_key,
                default_headers={
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "Pustaka+",
                },
                timeout=float(self.timeout),
                max_retries=self.max_retries
            )
        elif self.provider == "Groq" and self.api_key:
            self.client = OpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key=self.api_key,
                timeout=float(self.timeout),
                max_retries=self.max_retries
            )
        elif self.provider == "Ollama":
            self.base_url = self.base_url or "http://localhost:11434"
            self.model_name = self.model_name or "llama3"
            self._verify_ollama_connection()

    def _verify_ollama_connection(self):
        """Verify Ollama server is reachable"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code != 200:
                raise BookSummarizerError(f"Ollama server returned status {response.status_code}")
        except requests.exceptions.RequestException as e:
            raise BookSummarizerError(f"Cannot connect to Ollama at {self.base_url}: {str(e)}")

    @staticmethod
    def _sanitize_input(text: str, max_length: int = 500) -> str:
        """Sanitize user input to prevent prompt injection"""
        if not text:
            return ""
        
        # Remove potential injection patterns
        sanitized = re.sub(r'["\'\`]', '', str(text))
        sanitized = re.sub(r'\n\n+', ' ', sanitized)
        
        # Truncate if too long
        if len(sanitized) > max_length:
            sanitized = sanitized[:max_length] + "..."
        
        return sanitized.strip()

    def _extract_metadata(self, book_metadata: List[Dict]) -> Dict[str, str]:
        """Extract and consolidate metadata from multiple sources"""
        if not book_metadata:
            raise BookSummarizerError("Empty book metadata provided")
        
        primary_info = book_metadata[0]
        
        # Find description from any source
        context_description = ""
        for source in book_metadata:
            if source.get("description"):
                context_description = source.get("description")
                break
        
        # Extract title and author
        title = primary_info.get("title", "Unknown Title")
        authors = primary_info.get("authors", [])
        author = ", ".join(authors) if isinstance(authors, list) else str(authors)
        
        # Find genre from any source
        genre = primary_info.get("genre", "")
        if not genre:
            for source in book_metadata:
                if source.get("genre"):
                    genre = source.get("genre")
                    break
        
        # Find year from any source
        year = primary_info.get("publishedDate", "")
        if not year:
            for source in book_metadata:
                if source.get("publishedDate"):
                    year = source.get("publishedDate")
                    break
        
        # Extract year only if full date
        if year and isinstance(year, str) and "-" in year:
            year = year.split("-")[0]
        elif year and not isinstance(year, str):
            year = str(year)
        
        return {
            "title": self._sanitize_input(title, 200),
            "author": self._sanitize_input(author, 200),
            "genre": self._sanitize_input(genre, 100),
            "year": year,
            "description": context_description
        }

    def summarize(self, book_metadata: List[Dict]) -> Dict:
        """Generate a book summary (non-streaming)"""
        try:
            metadata = self._extract_metadata(book_metadata)
        except BookSummarizerError as e:
            return {"error": str(e)}
            
        if self.provider in ["OpenRouter", "Groq"] and not self.api_key:
            return {"error": f"API Key for {self.provider} is required"}

        prompt = self._get_full_prompt(
            metadata["title"], 
            metadata["author"], 
            metadata["genre"], 
            metadata["year"],
            metadata["description"],
            "pengetahuan tentang buku ini dan deskripsi penerbit"
        )

        try:
            start_time = time.time()
            
            if self.provider == "Ollama":
                return self._summarize_ollama(prompt, start_time)
            
            if not self.client:
                return {"error": "AI client not initialized"}
            
            with self._client_lock:
                completion = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}]
                )
            
            end_time = time.time()
            duration = round(end_time - start_time, 2)
            
            usage = completion.usage
            raw_content = completion.choices[0].message.content
            cleaned_content = self._clean_output(raw_content)
            
            return {
                "content": cleaned_content,
                "usage": {
                    "prompt_tokens": usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens
                },
                "model": self.model_name,
                "provider": self.provider,
                "cost_estimate": self._calculate_cost(usage.prompt_tokens, usage.completion_tokens),
                "duration_seconds": duration
            }
        except Exception as e:
            return {"error": f"Failed to generate summary: {str(e)}"}

    def summarize_stream(
        self, 
        book_metadata: List[Dict], 
        partial_content: Optional[str] = None
    ) -> Generator[str, None, None]:
        """Stream book summary generation"""
        try:
            metadata = self._extract_metadata(book_metadata)
        except BookSummarizerError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        if self.provider in ["OpenRouter", "Groq"] and not self.api_key:
            yield f"data: {json.dumps({'error': f'API Key for {self.provider} is required'})}\n\n"
            return

        # Truncate partial_content to avoid memory issues
        truncated_partial = partial_content[-500:] if partial_content else None

        prompt = self._get_full_prompt(
            metadata["title"], 
            metadata["author"], 
            metadata["genre"], 
            metadata["year"],
            metadata["description"],
            "pengetahuan tentang buku ini dan deskripsi penerbit",
            partial_content=truncated_partial
        )

        try:
            start_time = time.time()
            
            if self.provider == "Ollama":
                yield from self._stream_ollama(prompt, start_time)
            else:
                if not self.client:
                    yield f"data: {json.dumps({'error': 'AI client not initialized'})}\n\n"
                    return

                with self._client_lock:
                    stream = self.client.chat.completions.create(
                        model=self.model_name,
                        messages=[{"role": "user", "content": prompt}],
                        stream=True,
                        stream_options={"include_usage": True}
                    )
                
                # Use list for efficient string building
                content_parts = []
                final_usage = None
                
                for chunk in stream:
                    if hasattr(chunk, 'usage') and chunk.usage:
                        final_usage = {
                            "prompt_tokens": chunk.usage.prompt_tokens,
                            "completion_tokens": chunk.usage.completion_tokens,
                            "total_tokens": chunk.usage.total_tokens
                        }

                    if chunk.choices and len(chunk.choices) > 0:
                        if chunk.choices[0].delta.content:
                            content = chunk.choices[0].delta.content
                            content_parts.append(content)
                            yield f"data: {json.dumps({'content': content})}\n\n"
                
                # Send final statistics
                duration = round(time.time() - start_time, 2)
                stats = {
                    'done': True, 
                    'duration_seconds': duration, 
                    'model': self.model_name, 
                    'provider': self.provider
                }
                
                if final_usage:
                    stats['usage'] = final_usage
                    stats['cost_estimate'] = self._calculate_cost(
                        final_usage['prompt_tokens'], 
                        final_usage['completion_tokens']
                    )

                yield f"data: {json.dumps(stats)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    def _stream_ollama(self, prompt: str, start_time: float) -> Generator[str, None, None]:
        """Stream response from Ollama"""
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": True
        }
        
        try:
            response = requests.post(url, json=payload, stream=True, timeout=self.timeout)
            
            if response.status_code != 200:
                yield f"data: {json.dumps({'error': f'Ollama error: {response.text}'})}\n\n"
                return
            
            for line in response.iter_lines():
                if line:
                    data = json.loads(line.decode('utf-8'))
                    content = data.get("response", "")
                    
                    if content:
                        yield f"data: {json.dumps({'content': content})}\n\n"
                    
                    if data.get("done"):
                        duration = round(time.time() - start_time, 2)
                        stats = {
                            "done": True,
                            "duration_seconds": duration,
                            "model": self.model_name,
                            "provider": "Ollama",
                            "usage": {
                                "prompt_tokens": data.get("prompt_eval_count", 0),
                                "completion_tokens": data.get("eval_count", 0),
                                "total_tokens": data.get("prompt_eval_count", 0) + data.get("eval_count", 0)
                            }
                        }
                        yield f"data: {json.dumps(stats)}\n\n"
                        
        except requests.exceptions.RequestException as e:
            yield f"data: {json.dumps({'error': f'Ollama connection failed: {str(e)}'})}\n\n"

    def _summarize_ollama(self, prompt: str, start_time: float) -> Dict:
        """Non-streaming Ollama summary"""
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False
        }
        
        try:
            response = requests.post(url, json=payload, timeout=self.timeout)
            
            if response.status_code != 200:
                return {"error": f"Ollama error: {response.text}"}
            
            data = response.json()
            duration = round(time.time() - start_time, 2)
            
            return {
                "content": self._clean_output(data.get("response", "")),
                "usage": {
                    "prompt_tokens": data.get("prompt_eval_count", 0),
                    "completion_tokens": data.get("eval_count", 0),
                    "total_tokens": data.get("prompt_eval_count", 0) + data.get("eval_count", 0)
                },
                "model": self.model_name,
                "provider": "Ollama",
                "duration_seconds": duration
            }
            
        except requests.exceptions.RequestException as e:
            return {"error": f"Ollama connection failed: {str(e)}"}

    def _calculate_cost(self, prompt_tokens: int, completion_tokens: int) -> Dict:
        """Calculate API cost with caching"""
        # Check for free models
        if self.model_name.endswith(":free"):
            return {
                "total_usd": 0.0,
                "total_idr": 0,
                "currency": "USD",
                "is_free": True
            }

        # Try to get pricing from cache or API
        pricing = self._get_pricing_info()
        
        if pricing:
            p_rate = float(pricing.get("prompt", 0))
            c_rate = float(pricing.get("completion", 0))
            cost = (prompt_tokens * p_rate) + (completion_tokens * c_rate)
            
            rate_idr = self.currency_manager.get_usd_to_idr_rate()
            total_idr = cost * rate_idr if rate_idr else None
            
            return {
                "total_usd": round(cost, 6),
                "total_idr": round(total_idr) if total_idr else None,
                "currency": "USD",
                "is_free": cost == 0
            }
        
        # Unknown pricing
        return {
            "total_usd": None, 
            "total_idr": None, 
            "currency": "USD", 
            "is_free": False
        }

    def _get_pricing_info(self) -> Optional[Dict]:
        """Get pricing info with caching"""
        current_time = time.time()
        
        with self._pricing_cache_lock:
            # Check cache validity
            if (self.model_name in self._pricing_cache and 
                current_time - self._pricing_cache_timestamp < self.PRICING_CACHE_TTL):
                return self._pricing_cache[self.model_name]
        
        # Fetch from API
        try:
            response = requests.get(
                "https://openrouter.ai/api/v1/models", 
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                models = data.get("data", [])
                
                # Update cache for all models
                with self._pricing_cache_lock:
                    for model in models:
                        if "pricing" in model:
                            self._pricing_cache[model["id"]] = model["pricing"]
                    
                    self._pricing_cache_timestamp = current_time
                
                # Return pricing for this model
                model_info = next((m for m in models if m["id"] == self.model_name), None)
                if model_info and "pricing" in model_info:
                    return model_info["pricing"]
                    
        except Exception:
            pass  # Fail silently, use fallback
        
        # Fallback pricing
        FALLBACK_PRICING = {
            "google/gemini-pro": {"prompt": 0.125, "completion": 0.375},
            "openai/gpt-3.5-turbo": {"prompt": 0.5, "completion": 1.5},
            "openai/gpt-4o": {"prompt": 5.0, "completion": 15.0},
        }
        
        return FALLBACK_PRICING.get(self.model_name)

    def summarize_tournament(self, book_metadata: List[Dict], n: int = 3) -> Dict:
        """Generate multiple summaries and synthesize the best one"""
        # Validate input
        if not book_metadata:
            return {"error": "Empty book metadata provided"}
        
        if n < 2:
            return {"error": "Tournament requires at least 2 drafts"}
        
        if n > 10:
            return {"error": "Maximum 10 drafts allowed to prevent rate limiting"}
        
        import concurrent.futures
        
        drafts = []
        usage_total = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        durations = []
        
        def generate_draft():
            return self.summarize(book_metadata)
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(n, 5)) as executor:
            futures = [executor.submit(generate_draft) for _ in range(n)]
            
            for future in concurrent.futures.as_completed(futures):
                try:
                    res = future.result()
                    if "content" in res:
                        drafts.append(res["content"])
                        if "usage" in res:
                            usage_total["prompt_tokens"] += res["usage"]["prompt_tokens"]
                            usage_total["completion_tokens"] += res["usage"]["completion_tokens"]
                            usage_total["total_tokens"] += res["usage"]["total_tokens"]
                        if "duration_seconds" in res:
                            durations.append(res["duration_seconds"])
                except Exception:
                    continue

        if not drafts:
            return {"error": "Failed to generate any drafts"}

        # Judge stage
        try:
            metadata = self._extract_metadata(book_metadata)
        except BookSummarizerError as e:
            return {"error": str(e)}

        judge_prompt = self._get_full_prompt(
            metadata["title"],
            metadata["author"],
            metadata["genre"],
            metadata["year"],
            "",
            "",
            mode="judge",
            drafts=drafts
        )
        
        try:
            start_judge = time.time()
            
            if self.provider == "Ollama":
                judge_res = self._summarize_ollama(judge_prompt, start_judge)
                if "error" in judge_res:
                    raise BookSummarizerError(judge_res["error"])
                
                final_content = judge_res["content"]
                j_usage = judge_res["usage"]
                end_judge = time.time() # Already calculated in _summarize_ollama but we need it here for duration logic
            else:
                if not self.client:
                    raise BookSummarizerError("AI client not initialized")
                    
                with self._client_lock:
                    completion = self.client.chat.completions.create(
                        model=self.model_name,
                        messages=[{"role": "user", "content": judge_prompt}]
                    )
                
                end_judge = time.time()
                j_usage_obj = completion.usage
                j_usage = {
                    "prompt_tokens": j_usage_obj.prompt_tokens,
                    "completion_tokens": j_usage_obj.completion_tokens,
                    "total_tokens": j_usage_obj.total_tokens
                }
                final_content = self._clean_output(completion.choices[0].message.content)
            
            usage_total["prompt_tokens"] += j_usage["prompt_tokens"]
            usage_total["completion_tokens"] += j_usage["completion_tokens"]
            usage_total["total_tokens"] += j_usage["total_tokens"]
            
            avg_duration = sum(durations) / len(durations) if durations else 0
            
            return {
                "content": final_content,
                "usage": usage_total,
                "model": self.model_name,
                "provider": self.provider,
                "cost_estimate": self._calculate_cost(
                    usage_total["prompt_tokens"], 
                    usage_total["completion_tokens"]
                ),
                "duration_seconds": round(avg_duration + (end_judge - start_judge), 2),
                "is_enhanced": True,
                "draft_count": len(drafts)
            }
        except Exception as e:
            # Fallback to first draft if judging fails
            return {
                "error": f"Judging failed: {str(e)}", 
                "fallback": drafts[0],
                "usage": usage_total
            }

    def summarize_synthesize(self, title: str, author: str, genre: str, year: str, drafts: List[str]) -> Dict:
        """Synthesize multiple drafts into a final summary (non-streaming)"""
        if not drafts:
            return {"error": "No drafts provided for synthesis"}

        prompt = self._get_full_prompt(
            title,
            author,
            genre,
            year,
            "", # context_description
            "", # source_note
            mode="judge",
            drafts=drafts
        )

        try:
            start_time = time.time()
            
            if self.provider == "Ollama":
                res = self._summarize_ollama(prompt, start_time)
                if "content" in res:
                    res["is_synthesized"] = True
                    res["draft_count"] = len(drafts)
                return res
            
            if not self.client:
                return {"error": "AI client not initialized"}
            
            with self._client_lock:
                completion = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}]
                )
            
            end_time = time.time()
            duration = round(end_time - start_time, 2)
            
            usage = completion.usage
            raw_content = completion.choices[0].message.content
            cleaned_content = self._clean_output(raw_content)
            
            return {
                "content": cleaned_content,
                "usage": {
                    "prompt_tokens": usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens
                },
                "model": self.model_name,
                "provider": self.provider,
                "cost_estimate": self._calculate_cost(usage.prompt_tokens, usage.completion_tokens),
                "duration_seconds": duration,
                "is_synthesized": True,
                "draft_count": len(drafts)
            }
        except Exception as e:
            return {"error": f"Failed to synthesize summaries: {str(e)}"}


    def _get_full_prompt(
        self, 
        title: str, 
        author: str, 
        genre: str, 
        year: str, 
        context_description: str, 
        source_note: str, 
        partial_content: Optional[str] = None, 
        mode: str = "summarize", 
        drafts: Optional[List[str]] = None
    ) -> str:
        """Generate the full prompt based on mode"""
        
        if mode == "judge" and drafts:
            drafts_formatted = "\n\n".join([
                f"═══ DRAF {i+1} ═══\n{d}" 
                for i, d in enumerate(drafts)
            ])
                
            return f"""<role>
Anda adalah SENIOR LITERARY CRITIC dan ACADEMIC EDITOR dengan spesialisasi:
- Analisis struktural teks akademik
- Evaluasi densitas informasi (Chain of Density methodology)
- Quality assurance untuk publikasi ilmiah
</role>

<task>
Evaluasi dan sintesis {len(drafts)} draf intelligence brief untuk buku:
📚 "{title}" 
✍️  {author}
📅 {year or "Unknown"}
🏷️  {genre or "Unknown"}
</task>

<drafts>
{drafts_formatted}
</drafts>

<evaluation_framework>
Gunakan rubrik berikut (skala 1-10 untuk setiap draf):

1. FAKTUAL ACCURACY (bobot 30%)
   - Konsistensi dengan pengetahuan umum tentang buku
   - Tidak ada fabricated claims
   - Tahun, penerbit, konteks historis akurat

2. INFORMATION DENSITY (bobot 35%)
   - Jumlah konsep teknis per 100 kata
   - Kedalaman analisis (superficial vs substantive)
   - Rasio abstraksi/konkret seimbang
   - Penggunaan terminologi spesifik domain

3. STRUCTURAL COHERENCE (bobot 20%)
   - Logical flow antar bagian
   - Transisi yang smooth
   - Hirarki informasi jelas
   - Format konsisten dengan template

4. LINGUISTIC PRECISION (bobot 15%)
   - Bahasa Indonesia baku dan presisi
   - Variasi sintaksis (tidak repetitif)
   - Penggunaan kosakata teknis tepat
   - Ekonomi kata (tidak verbose)
</evaluation_framework>

<synthesis_instructions>
PROSES:
1. Identifikasi TOP 3 KEKUATAN dari setiap draf
2. Identifikasi 2 KELEMAHAN KRITIS dari setiap draf
3. Ekstrak "best-of-breed" elements:
   - Definisi istilah terbaik
   - Analisis paling mendalam
   - Contoh paling konkret
   - Kutipan paling representatif

4. Rekonstruksi output final:
   - Gabungkan elemen terkuat
   - Eliminasi redundansi
   - Perbaiki gap informasi
   - Optimalkan untuk readability
   - **PENTING**: Gunakan sintaks `[[angka]]` untuk setiap data kuantitatif hasil sintesis/derivasi analitis Anda.

OUTPUT:
Hasilkan HANYA brief final dalam format standar (9 bagian).
JANGAN sertakan:
- Scoring individual draf
- Justifikasi pemilihan
- Meta-commentary
- Perbandingan eksplisit antar draf
</synthesis_instructions>

<constraints>
- Output dalam Bahasa Indonesia
- Panjang ideal: 800-1200 kata
- Gunakan bullet points hanya untuk Poin Kunci (bagian 2)
- Semua bagian lain dalam prosa paragraf
</constraints>"""

        # Base summarization prompt dengan peningkatan struktur
        base_prompt = f"""<document_metadata>
Judul         : {title}
Penulis       : {author}
Tahun Terbit  : {year or "[Ekstrak dari konteks]"}
Genre/Kategori: {genre or "[Identifikasi dari isi]"}
Sumber Data   : {source_note}
Deskripsi     : {context_description[:500] if context_description else "[Tidak tersedia]"}
</document_metadata>

<role_definition>
Anda adalah KNOWLEDGE SYNTHESIS ENGINE dengan kapabilitas:
- Academic literature analysis (tingkat doktoral)
- Information architecture design
- Technical writing & documentation
- Critical reasoning & argumentation analysis

Anda BUKAN content marketer atau copywriter populer.
</role_definition>

<task_objective>
Transformasikan isi buku menjadi STRUCTURED KNOWLEDGE ARTIFACT (Analytical Brief) dengan karakteristik:
✓ High information density (Chain of Density approach)
✓ Technical precision (bukan simplifikasi berlebihan)
✓ Logical architecture (bukan narasi linear)
✓ Actionable intelligence (bukan trivia)
</task_objective>

<data_precision_policy>
Dalam menyusun brief, Anda sering kali perlu melakukan derivasi atau sintesis angka (persentase, durasi, perbandingan) untuk mengilustrasikan dampak sebuah konsep.
ATURAN KHUSUS & NUANSA ANALITIS:
1. **Bungkus semua koefisien statistik non-literal dengan `[[ ]]`**. Gunakan bracket ini untuk angka, r-value, atau data kuantitatif yang merupakan hasil sintesis, estimasi, atau derivasi analitis Anda (bukan kutipan literal dari teks).
   - Contoh: "Menurunkan kognitif load hingga [[43%]]..." atau "Korelasi kuat [[r=0.73]]..."
2. **Lunakkan klaim kausal menjadi korelasional** pada 2-3 bagian dalam isi brief. Gunakan frasa seperti "berkorelasi dengan", "terkait erat dengan", atau "menunjukkan asosiasi", daripada klaim kausalitas langsung yang kaku. Cukup satu frasa per bagian.
3. **Gunakan ILLUSTRATIVE RANGES untuk angka ekstrem**. Jika Anda menyebutkan angka yang sangat besar atau kecil (misal: "ribuan jam" atau "jutaan data"), sajikan sebagai range (misal: "[[10.000-15.000]] jam") agar terasa sebagai *order-of-magnitude*, bukan *point estimate* yang absolut.
4. JANGAN gunakan double brackets untuk fakta statis seperti tahun terbit, nama tokoh, atau angka yang tertulis eksplisit di metadata buku.
</data_precision_policy>

<critical_prohibitions>
🚫 DILARANG KERAS:
1. Kalimat pembuka/penutup generik ("Buku ini membahas...", "Secara keseluruhan...")
2. Bahasa promosi/hiperbola ("sangat menarik", "wajib dibaca")
3. Opini subjektif tanpa evidensi ("menurut saya", "sayangnya")
4. Generalisasi dangkal ("penting untuk dipahami", "relevan di era modern")
5. Mengulang informasi yang sudah disebutkan
6. Menambahkan fakta yang tidak dapat diverifikasi dari konteks
7. Menggunakan placeholder atau TBD
</critical_prohibitions>

<output_structure>
Ikuti EXACTLY 9 bagian berikut. Tidak boleh ditambah atau dikurangi:

**CATATAN PENTING TENTANG FORMAT**:
- Garis pemisah (━━━) hanya untuk membantu Anda memahami struktur di instruksi ini
- JANGAN tampilkan garis pemisah (━━━) dalam output final Anda
- Output hanya berisi heading dan konten, tanpa dekorasi visual

---

## 1. EXECUTIVE ANALYTICAL BRIEF (Ringkasan Inti)
SATU paragraf kohesif (150-200 kata) yang memuat:

WAJIB ADA:
a) Tesis sentral / research question / core argument
b) Metodologi / kerangka analisis / theoretical framework
c) Temuan kunci (dengan data kuantitatif jika ada)
d) Kontribusi unik buku ini terhadap domain knowledge
e) Keterbatasan atau caveats metodologis

GAYA PENULISAN:
- Kalimat kompleks dengan subordinate clauses
- Istilah teknis (tidak perlu dijelaskan di sini)
- Passive voice OK jika lebih presisi
- Hindari subjek "buku ini" di awal kalimat

CONTOH BURUK:
"Buku ini membahas pentingnya komunikasi dalam organisasi..."

CONTOH BAIK:
"Melalui analisis etnografi terhadap 47 organisasi Fortune 500 (2015-2019), penulis mengidentifikasi bahwa efektivitas komunikasi internal berkorelasi kuat (r=0.73, p<0.01) dengan employee retention rate, terutama dalam konteks hybrid work arrangements pasca-pandemi..."

---

## 2. CORE THESIS & KEY ARGUMENTS (Poin Kunci)

4-6 bullet points. Setiap poin adalah ARGUMEN/TEMUAN, bukan topik.

FORMAT:
• **[Klaim/Temuan]**: [Elaborasi dengan evidensi] → [Implikasi]

CONTOH BURUK:
• Pentingnya data analysis

CONTOH BAIK:
• **Visualisasi data menurunkan cognitive load 43% dibanding tabel numerik**: Eksperimen eye-tracking (n=312) menunjukkan bahwa decision time untuk task komparasi berkurang rata-rata 8.2 detik dengan penggunaan heatmap vs spreadsheet → Rekomendasi: prioritaskan dashboard visual untuk executive reporting

KRITERIA KUALITAS:
- Ada angka/data konkret (persentase, sample size, timeframe)
- Ada implikasi praktis atau teoritis
- Bukan common knowledge atau truisme
- Specific, bukan abstract

---

## 3. CONCEPTUAL ARCHITECTURE (Struktur Topik)

Rekonstruksi CONCEPTUAL ARCHITECTURE buku (bukan daftar chapter).

Format prosa (2-3 paragraf) yang menjelaskan:
- Bagaimana penulis menyusun argumen (induktif/deduktif/dialectical?)
- Struktur logis: foundation → development → synthesis
- Pola organisasi: kronologis? tematik? case-based?

CONTOH:
"Penulis membangun argumen secara deduktif, dimulai dari grand theory (Bagian 1: Theoretical Foundations, mengulas Kahneman & Tversky) sebelum mengaplikasikan pada empirical cases (Bagian 2-3: Industry Studies). Bagian 4 melakukan systematic comparison menggunakan framework 2x2 matrix. Struktur ini mencerminkan pendekatan theory-driven daripada exploratory induction."

HINDARI:
- "Bab 1 membahas X, Bab 2 membahas Y..." (terlalu literal)
- Hanya listing topik tanpa menjelaskan relationships

---

## 4. GLOSSARY OF DENSITY (Konsep & Istilah Teknikal)

5-8 istilah KEY yang UNIQUE atau CENTRAL ke buku ini.

Format:
**[Istilah]** (kategori): Definisi operasional [1-2 kalimat] + hubungan ke konsep lain dalam buku.

CONTOH:
**Bounded Rationality** (Cognitive Psychology): Konsep bahwa decision-makers beroperasi dengan keterbatasan informasi, waktu kognitif, dan processing capacity, sehingga menghasilkan "satisficing" (sufficient + satisfying) solutions alih-alih optimal solutions. Dalam buku ini, menjadi foundation untuk kritik terhadap Rational Choice Theory.

SELEKSI ISTILAH:
- Prioritaskan yang DIDEFINISIKAN ULANG oleh penulis
- Hindari istilah yang sudah extremely common (misal: "data", "analysis")
- Fokus pada yang OPERASIONALIZED dalam buku

---

## 5. REASONING BLUEPRINT (Kerangka Logika)

Struktur reasoning buku dalam 3 komponen:

**A. Masalah/Gap yang Diidentifikasi**
[2-3 kalimat: apa yang missing dari existing literature/practice?]

**B. Metodologi/Solusi yang Diajukan**
[2-3 kalimat: approach penulis untuk address gap tersebut]

**C. Sintesis & Kesimpulan Rasional**
[2-3 kalimat: apa yang berhasil dibuktikan/didemonstrasikan?]

TIPS:
- Gunakan connector words: "Consequently...", "Building on this...", "This leads to..."
- Jaga kausalitas eksplisit
- Bedakan correlation vs causation

---

## 6. ACTIONABLE INTELLIGENCE & IMPLICATIONS

MAKSIMAL 3 poin implikasi yang DAPAT DIOPERASIONALISASIKAN.

Format:
**[Domain Aplikasi]**: [Insight spesifik] → [Action steps atau research directions]

CONTOH BURUK:
**Bisnis**: Perusahaan harus lebih memperhatikan data.

CONTOH BAIK:
**Corporate Strategy**: Alokasikan 15-20% R&D budget untuk exploratory projects tanpa immediate ROI metrics, mengadopsi model "20% time" à la Google → Mitigasi innovation tunnel vision dan mendorong serendipitous discovery (sesuai findings chapter 7).

KRITERIA:
- Harus ada angka/target konkret OR specific practice
- Bukan platitude atau obvious advice
- Traceable ke specific findings dalam buku

---

## 7. REPRESENTATIVE SYNTHESIS (Kutipan Ikonik)

SATU kutipan yang:
- Merepresentasikan core message
- Memorable & quotable
- Bukan obvious statement

Format:
> "[Kutipan verbatim atau parafrasa jika tidak ada akses ke teks asli]"
> — [Penulis], *[Judul Buku]*, hal. [X] (jika diketahui)

**Analisis Kutipan** (2-3 kalimat):
Mengapa kutipan ini signifikan? Apa yang membuatnya representatif terhadap keseluruhan argumen buku?

JANGAN:
- Pilih kutipan generic
- Hanya copy-paste tanpa analisis
- Buat kutipan palsu jika tidak yakin

---

## 8. WORK CLASSIFICATION (Tingkat Abstraksi)

**Jenis Karya**: [Pilih yang paling sesuai]
- Teoretis-Konseptual (membangun framework baru)
- Empiris-Kuantitatif (data-driven research)
- Empiris-Kualitatif (case studies, ethnography)
- Metodologis (how-to, practical guide)
- Meta-Analitik (literature review, synthesis)
- Polemic-Argumentative (advocacy, critique)

**Tingkat Abstraksi**: [Spektrum 1-5]
1 = Highly practical (step-by-step guides)
3 = Balanced (theory + application)
5 = Highly abstract (pure philosophy/theory)

**Target Audience**: [Primer dan sekunder]
Contoh: Akademisi (primer), praktisi berpengalaman (sekunder)

**Prasyarat Pengetahuan**: [Apa yang harus sudah dikuasai pembaca?]

---

## 9. ULTRAPURE ESSENCE (TL;DR)

Distilasi MAKSIMAL 100 kata yang capture:
- Core thesis (1 kalimat)
- Key mechanism/method (1 kalimat)
- Main takeaway (1 kalimat)
- Significance/contribution (1 kalimat)

GAYA: Telegraph style OK. Padat mutlak. Tidak ada filler words.

CONTOH:
"Demonstrates systematic bias in expert predictions across domains (politics, economics, tech). Through 20-year longitudinal study (n=284 experts, 28k predictions), shows 'foxes' (integrative thinkers) outperform 'hedgehogs' (single-theory advocates) by 30% accuracy. Challenges credentialism. Implications: diversify advisory boards, weight recent track records >  credentials."
</output_structure>

<quality_checklist>
Sebelum mengirimkan output, pastikan:
☑ Tidak ada kalimat yang dimulai dengan "Buku ini..."
☑ Setiap bagian memiliki informasi substantif (bukan boilerplate)
☑ Ada minimal 5 data points konkret (angka, tahun, persentase)
☑ Setiap istilah teknis digunakan dengan presisi
☑ Tidak ada redundansi antar bagian
☑ Semua 9 bagian lengkap (tidak ada yang skip)
☑ Menggunakan sintaks `[[...]]` untuk angka hasil sintesis (minimal 3 poin)
☑ Format markdown konsisten
☑ Panjang total 900-1300 kata
☑ Tidak ada meta-commentary ("Berikut adalah ringkasan...")
</quality_checklist>

<linguistic_guidelines>
BAHASA INDONESIA:
- Formal-akademik, hindari colloquialism
- Gunakan istilah asing jika lebih presisi (OK untuk tidak diterjemahkan)
- Variasi struktur kalimat (jangan monoton)
- Ekonomi kata: prefer "menggunakan" > "melakukan penggunaan terhadap"

KOHESI:
- Gunakan transition devices: "Lebih lanjut...", "Sebaliknya...", "Berdasarkan hal ini..."
- Pronoun reference yang jelas
- Logical connectors eksplisit
</linguistic_guidelines>"""
        
        if partial_content:
            # Add continuation instructions with better context
            base_prompt += f"""

<recovery_mode>
═══════════════════════════════════════════════════════════════
⚠️  CONTINUATION MODE ACTIVATED
═══════════════════════════════════════════════════════════════

**SITUASI**: 
Generasi brief sebelumnya terputus di tengah jalan. Sistem telah menyimpan partial output.

**KONTEN YANG SUDAH DITERIMA**:
\"\"\"
{partial_content}
\"\"\"

**INSTRUKSI KRITIKAL**:
1. ✅ LANJUTKAN tepat setelah kalimat terakhir yang terputus
2. 🔍 IDENTIFIKASI bagian mana yang sudah selesai (cek heading "━━━" atau nomor bagian)
3. ⏭️  SKIP semua bagian yang sudah ada dalam partial_content di atas
4. 🎯 MULAI dari bagian berikutnya yang belum ada
5. 📝 PERTAHANKAN gaya bahasa, format markdown, dan tone yang sama
6. 🚫 JANGAN tulis ulang apapun yang sudah tercantum di atas

**CONTOH LOGIC**:
- Jika partial berakhir di tengah Bagian 2 → selesaikan Bagian 2, lalu lanjut ke 3-9
- Jika partial berakhir setelah Bagian 4 lengkap → langsung mulai dari Bagian 5
- Jika partial berakhir di tengah kalimat → sambung kalimat itu dulu, baru lanjut

**VERIFICATION**:
Sebelum generate, tanyakan pada diri sendiri:
"Apakah bagian X sudah ada dalam partial_content?"
Jika YA → skip
Jika TIDAK → generate

MULAI CONTINUATION SEKARANG ↓
</recovery_mode>
"""
            
        return base_prompt

    @staticmethod
    def _clean_output(text: str) -> str:
        """Remove instruction artifacts from output"""
        # Remove instruction separators (various styles)
        text = re.sub(r"═{3,}.*?═{3,}", "", text, flags=re.DOTALL)
        text = re.sub(r"━{10,}", "", text)  # Remove long dash separators
        text = re.sub(r"─{10,}", "", text)  # Remove alternative dashes
        text = re.sub(r"-{10,}", "", text)  # Remove regular dashes used as separators
        
        # Remove excessive newlines
        text = re.sub(r"\n{3,}", "\n\n", text)
        
        # Remove meta comments
        meta_patterns = [
            r"\(Rangkuman selesai.*?\)",
            r"\(Selesai.*?\)",
            r"\(Catatan:.*?\)",
            r"Rangkuman selesai.*$",
            r"Semoga bermanfaat.*$",
            r"Selesai\.$",
            r"^RANGKUMAN (PADAT|KOMPREHENSIF|EKSEKUTIF|DENSE).*?:\s.*?$",
            r"^RANGKUMAN (PADAT|KOMPREHENSIF|EKSEKUTIF|DENSE).*?$"
        ]
        
        for pattern in meta_patterns:
            text = re.sub(pattern, "", text, flags=re.IGNORECASE | re.MULTILINE)

        return text.strip()