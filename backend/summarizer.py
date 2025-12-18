from openai import OpenAI
from typing import Dict, List
import time
import json
from currency_manager import CurrencyManager


class BookSummarizer:
    def __init__(self, api_key: str = None, model_name: str = None, provider: str = "OpenRouter", base_url: str = None, timeout: int = 60, max_retries: int = 3):
        self.api_key = api_key
        self.model_name = model_name or "google/gemini-2.0-flash-exp:free"
        self.provider = provider
        self.base_url = base_url
        self.timeout = timeout
        self.max_retries = max_retries
        self.client = None
        self.currency_manager = CurrencyManager()

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
        elif self.provider == "Ollama":
             self.base_url = self.base_url or "http://localhost:11434"
             self.model_name = self.model_name or "llama3"

    def summarize(self, book_metadata: List[Dict]) -> Dict:
        if self.provider == "OpenRouter" and not self.api_key:
            return {"error": "Error: API Key tidak ditemukan."}

        # Consolidated metadata
        primary_info = book_metadata[0]
        context_description = ""
        for source in book_metadata:
            if source.get("description"):
                context_description = source.get("description")
                break
        
        title = primary_info.get("title", "Unknown Title")
        author = ", ".join(primary_info.get("authors", [])) if isinstance(primary_info.get("authors"), list) else primary_info.get("authors", "")

        # Tambahan variabel yang bisa Anda masukkan:
        source_note = "pengetahuan tentang buku ini dan deskripsi penerbit"

        prompt = f"""
        (Instruksi yang sama seperti sebelumnya...)
        [Isi Prompt Disembunyikan untuk Kejelasan]
        Data Buku: {title} by {author}. Context: {context_description}
        """
        
        # Real prompt usage
        prompt = self._get_full_prompt(title, author, context_description, source_note)

        try:
            start_time = time.time()
            
            if self.provider == "Ollama":
                return self._summarize_ollama(prompt, start_time)
            
            if not self.client:
                return {"error": "Error: AI client not initialized."}
            
            completion = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "user", "content": prompt}
                ]
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
                "provider": "OpenRouter",
                "cost_estimate": self._calculate_cost(usage.prompt_tokens, usage.completion_tokens),
                "duration_seconds": duration
            }
        except Exception as e:
            return {"error": f"Error generating summary: {str(e)}"}

    def summarize_stream(self, book_metadata: List[Dict]):
        """Generator that yields chunks of the summary."""
        if self.provider == "OpenRouter" and not self.api_key:
            yield f"data: {json.dumps({'error': 'Error: API Key tidak ditemukan.'})}\n\n"
            return

        # Consolidated metadata
        primary_info = book_metadata[0]
        context_description = ""
        for source in book_metadata:
            if source.get("description"):
                context_description = source.get("description")
                break
        
        title = primary_info.get("title", "Unknown Title")
        author = ", ".join(primary_info.get("authors", [])) if isinstance(primary_info.get("authors"), list) else primary_info.get("authors", "")
        source_note = "pengetahuan tentang buku ini dan deskripsi penerbit"
        prompt = self._get_full_prompt(title, author, context_description, source_note)

        try:
            start_time = time.time()
            if self.provider == "Ollama":
                yield from self._stream_ollama(prompt, start_time)
            else:
                if not self.client:
                    yield f"data: {json.dumps({'error': 'Error: AI client not initialized.'})}\n\n"
                    return

                stream = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    stream=True,
                    stream_options={"include_usage": True}
                )
                
                full_content = ""
                final_usage = None
                for chunk in stream:
                    # Capture usage information if provided (usually in the last chunk)
                    if hasattr(chunk, 'usage') and chunk.usage:
                        final_usage = {
                            "prompt_tokens": chunk.usage.prompt_tokens,
                            "completion_tokens": chunk.usage.completion_tokens,
                            "total_tokens": chunk.usage.total_tokens
                        }

                    if chunk.choices and len(chunk.choices) > 0:
                        if chunk.choices[0].delta.content:
                            content = chunk.choices[0].delta.content
                            full_content += content
                            yield f"data: {json.dumps({'content': content})}\n\n"
                
                # Final chunk with stats
                duration = round(time.time() - start_time, 2)
                stats = {
                    'done': True, 
                    'duration_seconds': duration, 
                    'model': self.model_name, 
                    'provider': 'OpenRouter'
                }
                
                if final_usage:
                    stats['usage'] = final_usage
                    # Also include cost estimate if usage is available
                    stats['cost_estimate'] = self._calculate_cost(final_usage['prompt_tokens'], final_usage['completion_tokens'])

                yield f"data: {json.dumps(stats)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    def _stream_ollama(self, prompt: str, start_time: float):
        import requests
        import json
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": True
        }
        
        try:
            # We use stream=True in requests for line-by-line reading
            response = requests.post(url, json=payload, stream=True, timeout=self.timeout)
            if response.status_code == 200:
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
            else:
                yield f"data: {json.dumps({'error': f'Ollama Error: {response.text}'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': f'Failed to connect to Ollama: {str(e)}'})}\n\n"

    def _get_full_prompt(self, title, author, context_description, source_note):
        return f"""
        Anda adalah asisten AI spesialis analisis literatur kelas dunia yang mahir dalam mengekstrak informasi padat (dense information).
        
        Tugas Anda adalah membuat rangkuman buku yang sangat informatif menggunakan teknik **Chain of Density**.
        
        ═══════════════════════════════════════════════════════════════
        DATA BUKU
        ═══════════════════════════════════════════════════════════════
        - Judul: {title}
        - Penulis: {author}
        - Konteks/Deskripsi: {context_description}
        
        ═══════════════════════════════════════════════════════════════
        PROSES BERPIKIR (INTERNAL - CHAIN OF DENSITY)
        ═══════════════════════════════════════════════════════════════
        Sebelum memberikan output final, lakukan langkah berikut di dalam memori Anda:
        1. Identifikasi 5-8 **Missing Entities**: Cari istilah teknis, nama konsep unik, hukum/prinsip, atau data spesifik yang ada dalam buku ini (berdasarkan pengetahuan luas Anda) yang tidak disebutkan dalam deskripsi mentah di atas.
        2. Buat draf rangkuman yang mengintegrasikan entitas-entitas padat tersebut tanpa membuatnya bertele-tele.
        3. Pastikan output final bersifat spesifik, bukan generalitas. Hindari kata-kata "menginspirasi", "bermanfaat", "luar biasa" tanpa diikuti alasan teknis/konkret.

        ═══════════════════════════════════════════════════════════════
        FORMAT OUTPUT FINAL (WAJIB)
        ═══════════════════════════════════════════════════════════════

        1. **Metadata Buku**
           * Judul: {title}
           * Penulis: {author}
           * Tahun Terbit: [Tahun]
           * Genre / Topik: [Genre Spesifik]
           * Sumber: {source_note}

        2. **Ringkasan Inti (DENSE Executive Summary)**
           [Tuliskan 3–4 paragraf yang sangat padat informasi. Setiap kalimat harus mengandung setidaknya satu konsep spesifik atau fakta nyata dari buku. Jangan gunakan bahasa brosur/pemasaran. Fokus pada "Mekanisme" dan "Logika" buku.]

        3. **Poin Kunci & Argumen Utama**
           * [Sebutkan argumen A: Sertakan data/istilah spesifik]
           * [Sebutkan argumen B: Sertakan data/istilah spesifik]
           * [Lanjutkan...]

        4. **Struktur & Rekonstruksi Topik**
           [Gunakan pengetahuan Anda untuk menyusun struktur bab/topik yang paling akurat]
           **Bagian 1: [Judul Spesifik]**
           * [Poin detail]
           **Bagian 2: [Judul Spesifik]**
           * [Poin detail]

        5. **Konsep & Istilah Teknikal (Glossary of Density)**
           * **[Istilah Spesifik 1]** → [Definisi mendalam & aplikasi dalam buku]
           * **[Istilah Spesifik 2]** → [Definisi mendalam & aplikasi dalam buku]
           * [Total 5-7 istilah]

        6. **Kerangka Logika (The Blueprint)**
           * **Masalah Awal**: [Apa akar masalahnya?]
           * **Metodologi/Solusi**: [Bagaimana penulis memecahkannya?]
           * **Sintesis Akal**: [Apa kesimpulan intelektualnya?]

        7. **Actionable Insights / Implikasi**
           * [Insight 1: Harus konkret, bukan filosofis umum]
           * [Insight 2: Harus konkret]

        8. **Kutipan Ikonik**
           > "[Kutipan]" → [Analisis mengapa kutipan ini mendefinisikan isi buku]

        9. **Tingkat Abstraksi & Klasifikasi**
           * [Apakah ini Taksonomi, Manual Praktis, atau Dialektika Teoretis?]

        10. **TL;DR (Ultrapure Essence)**
            [Satu paragraf maksimal 150 kata yang merangkum keseluruhan sistem pemikiran buku tanpa sisa.]

        ═══════════════════════════════════════════════════════════════
        ATURAN KETAT
        ═══════════════════════════════════════════════════════════════
        - Bahasa: Indonesia Profesional/Akademik.
        - DENSITY: Jika ada kalimat yang bisa dihapus tanpa kehilangan informasi spesifik, hapus atau ganti dengan informasi yang lebih padat.
        - SPESIFIK: Jangan bilang "Habit sangat penting", katakan "Atomic habits bekerja melalui mekanisme 'Environment Design' dan 'Identity-based change'".
        - JANGAN mengulang instruksi ini dalam jawaban.
        """

    def _calculate_cost(self, prompt_tokens: int, completion_tokens: int) -> dict:
        # 1. Check for Free Models (Generic)
        if self.model_name.endswith(":free"):
            return {
                "total_usd": 0.0,
                "total_idr": 0,
                "currency": "USD",
                "is_free": True
            }

        try:
            # 2. Fetch Dynamic Pricing from OpenRouter
            import requests # Import here to avoid global dep if not needed elsewhere
            response = requests.get("https://openrouter.ai/api/v1/models")
            
            if response.status_code == 200:
                data = response.json()
                all_models = data.get("data", [])
                
                # Find our model
                model_info = next((m for m in all_models if m["id"] == self.model_name), None)
                
                if model_info and "pricing" in model_info:
                    pricing = model_info["pricing"]
                    # OpenRouter returns pricing string per token? Or per 1M?
                    # Docs: "prompt": "0.00000005" (Cost per token)
                    # Let's verify standard OpenRouter format. Usually it's strictly per-token float string.
                    
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
        except Exception as e:
            print(f"Failed to fetch dynamic pricing: {e}")

        # 3. Fallback to Hardcoded (Minimal backup)
        PRICING = {
             "google/gemini-pro": {"prompt": 0.125, "completion": 0.375}, # per 1M
             "openai/gpt-3.5-turbo": {"prompt": 0.5, "completion": 1.5},
             "openai/gpt-4o": {"prompt": 5.0, "completion": 15.0},
        }
        
        rates = PRICING.get(self.model_name)
        if rates:
             cost_prompt = (prompt_tokens / 1_000_000) * rates["prompt"]
             cost_completion = (completion_tokens / 1_000_000) * rates["completion"]
             total_usd = cost_prompt + cost_completion
             total_usd = cost_prompt + cost_completion
             rate_idr = self.currency_manager.get_usd_to_idr_rate()
             total_idr = total_usd * rate_idr if rate_idr else None
             
             return {
                "total_usd": round(total_usd, 6),
                "total_idr": round(total_idr) if total_idr else None,
                "currency": "USD",
                "is_free": total_usd == 0
             }

        # 4. Unknown
        return {"total_usd": None, "total_idr": None, "currency": "USD", "is_free": False}

    def _clean_output(self, text: str) -> str:
        """Removes instruction artifacts that sometimes leak into the output."""
        import re
        # Remove divider lines like "══════ INSTRUKSI & FORMAT OUTPUT ══════"
        # Matches runs of 3+ '=' followed by text and more '='
        pattern = r"═{3,}.*?═{3,}"
        cleaned = re.sub(pattern, "", text, flags=re.DOTALL)
        
        # Cleanup extra newlines
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()
