import concurrent.futures
import json
import re
import time
from difflib import SequenceMatcher
from threading import Lock
from typing import Dict, Generator, List, Optional

import requests
from openai import OpenAI

from currency_manager import CurrencyManager


class BookSummarizerError(Exception):
    """Base exception for BookSummarizer errors"""
    pass


class BookSummarizer:
    # --- KONFIGURASI 3 SECTION (DIPERBARUI) ---
    STANDARD_SECTIONS = [
        "EXECUTIVE SUMMARY & CORE THESIS",
        "ANALYTICAL FRAMEWORK",
        "MARKET & INTELLECTUAL POSITIONING"
    ]
    
    SECTION_KEYWORDS = {
        "EXECUTIVE SUMMARY & CORE THESIS": ["executive", "summary", "core thesis", "ringkasan", "tesis", "quote", "kutipan"],
        "ANALYTICAL FRAMEWORK": ["analytical", "framework", "glossary", "reasoning", "blueprint", "architecture", "kerangka", "istilah", "glosarium"],
        "MARKET & INTELLECTUAL POSITIONING": ["market", "positioning", "comparative", "komparatif", "posisi", "competitor", "pesaing"]
    }

    # Mapping tetap dibutuhkan untuk membaca format lama jika ada, 
    # tapi fokus utama adalah memproduksi format baru.
    NAME_MAPPINGS = {
        "EXECUTIVE ANALYTICAL BRIEF": "EXECUTIVE SUMMARY & CORE THESIS",
        "CORE THESIS & KEY ARGUMENTS": "EXECUTIVE SUMMARY & CORE THESIS",
        "REPRESENTATIVE SYNTHESIS": "EXECUTIVE SUMMARY & CORE THESIS",
        
        "CONCEPTUAL ARCHITECTURE": "ANALYTICAL FRAMEWORK",
        "GLOSSARY OF DENSITY": "ANALYTICAL FRAMEWORK",
        "REASONING BLUEPRINT": "ANALYTICAL FRAMEWORK",
        
        "COMPARATIVE POSITIONING": "MARKET & INTELLECTUAL POSITIONING",
    }

    # Cache & Locks
    _pricing_cache = {}
    _pricing_cache_lock = Lock()
    _pricing_cache_timestamp = 0
    PRICING_CACHE_TTL = 3600

    def __init__(
        self, 
        api_key: Optional[str] = None, 
        model_name: Optional[str] = None, 
        provider: str = "OpenRouter", 
        base_url: Optional[str] = None, 
        timeout: int = 300, 
        max_retries: int = 3
    ):
        self.api_key = api_key
        self.model_name = model_name or "google/gemini-2.0-flash-exp:free"
        self.provider = provider
        self.base_url = base_url or "http://localhost:11434"
        self.timeout = timeout
        self.max_retries = max_retries
        self.currency_manager = CurrencyManager()
        self._client_lock = Lock()
        
        # Pre-compile Regex
        self._regex_patterns = {
            'markdown': re.compile(r'^#{1,3}\s*(?:\d+[\.\)]\s*)?(.+?)$'),
            'bold': re.compile(r'^\*\*\s*(?:\d+[\.\)]\s*)?(.+?)\s*\*\*$'),
            'numbered': re.compile(r'^\d+[\.\)]\s+([A-Z].{8,})$'),
            'caps': re.compile(r'^([A-Z][A-Z\s&\-\(\)]{9,})$'),
            'clean_header': re.compile(r'[^\w\s&]'),
            'normalize_space': re.compile(r'\s+'),
            'separator': re.compile(r"═{3,}.*?═{3,}", re.DOTALL),
            'dashes': re.compile(r"[-_=]{10,}"),
            'meta': re.compile(r"\(Rangkuman selesai.*?\)|\(Selesai.*?\)|\(Catatan:.*?\)|Rangkuman selesai.*$|Semoga bermanfaat.*$|^RANGKUMAN.*?:\s.*?$|^RANGKUMAN.*?$", re.IGNORECASE | re.MULTILINE),
            'excess_newlines': re.compile(r"\n{3,}")
        }

        self._initialize_client()

    def _initialize_client(self):
        try:
            if self.provider == "OpenRouter" and self.api_key:
                self.client = OpenAI(
                    base_url="https://openrouter.ai/api/v1",
                    api_key=self.api_key,
                    default_headers={"HTTP-Referer": "http://localhost:5173", "X-Title": "Pustaka+"},
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
                self._verify_ollama_connection()
            else:
                self.client = None
        except Exception as e:
            print(f"Init error: {e}")
            self.client = None

    def _verify_ollama_connection(self):
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code != 200:
                raise BookSummarizerError(f"Ollama error {response.status_code}")
        except requests.exceptions.RequestException as e:
            raise BookSummarizerError(f"Cannot connect to Ollama: {str(e)}")

    @staticmethod
    def _sanitize_input(text: str, max_length: int = 500) -> str:
        if not text: return ""
        sanitized = re.sub(r'[\`]', '', str(text))
        sanitized = re.sub(r'\n\n+', ' ', sanitized)
        return (sanitized[:max_length] + "...") if len(sanitized) > max_length else sanitized.strip()

    def _extract_metadata(self, book_metadata: List[Dict]) -> Dict[str, str]:
        if not book_metadata: raise BookSummarizerError("Empty metadata")
        primary = book_metadata[0]
        
        def get_val(k):
            for s in book_metadata:
                if s.get(k): return s.get(k)
            return ""

        return {
            "title": self._sanitize_input(primary.get("title", "Unknown"), 200),
            "author": self._sanitize_input(", ".join(primary.get("authors", [])) if isinstance(primary.get("authors"), list) else str(primary.get("authors", "")), 200),
            "genre": self._sanitize_input(get_val("genre"), 100),
            "year": str(primary.get("publishedDate", get_val("publishedDate"))).split("-")[0],
            "description": get_val("description")
        }

    # --- PROMPT CONSTRUCTION (UPDATED TO 3 SECTIONS) ---

    def _get_full_prompt(self, title: str, author: str, genre: str, year: str, 
                         context_description: str, source_note: str, 
                         partial_content: Optional[str] = None, 
                         mode: str = "summarize", 
                         drafts: Optional[List[str]] = None) -> str:
        
        if not title or not author: raise BookSummarizerError("Missing title/author")
        
        if mode == "judge" and drafts:
            return self._build_judge_prompt(title, author, genre, year, drafts)

        return self._build_summarize_prompt(title, author, genre, year, context_description, source_note, partial_content)

    def _build_summarize_prompt(self, title: str, author: str, genre: str, year: str, 
                                context: str, source: str, partial: Optional[str]) -> str:
        """Prompt yang meminta AI menggabungkan konten menjadi 3 Section Padat"""
        
        intro = f"""<document_metadata>
Title         : {title}
Author        : {author}
Published Year: {year}
Genre/Category: {genre}
Data Source   : {source}
Description   : {context[:500] if context else "[Not available]"}
</document_metadata>

<role_definition>
You are a KNOWLEDGE SYNTHESIS ENGINE focused on efficiency and density.
Your goal is to transform content into 3 CONSOLIDATED SUPER-SECTIONS.
</role_definition>

<data_precision_policy>
1. Wrap synthesized/estimated quantitative data with `[[ ]]`.
2. Use illustrative ranges for large numbers.
3. Soften causal claims to correlational where appropriate.
</data_precision_policy>

<output_structure>
CRITICAL: YOU MUST PRODUCE EXACTLY THESE 3 HEADINGS. DO NOT ADD OR REMOVE SECTIONS.

## 1. EXECUTIVE SUMMARY & CORE THESIS
[Structure: Paragraph (Summary) + Bullets (Key Arguments) + Blockquote (Iconic Quote)]
- **Core Summary**: One cohesive paragraph (100-150 words) covering thesis, methodology, key findings, and limitations.
- **Core Thesis & Arguments**: 4-6 bullet points. Format: • **[Claim]**: [Elaboration] → [Implications].
- **Representative Quote**: > "Verbatim or best-fit quote" — Author. Followed by 1-2 sentences of analysis.

## 2. ANALYTICAL FRAMEWORK
[Structure: Technical Terms (Glossary) + Logic Blueprint (Reasoning)]
- **Glossary of Density**: 5-8 KEY technical terms redefined/operationalized in the book. Format: **[Term]**: Definition.
- **Reasoning Blueprint**: 
  A. Gap Identified (What's missing?)
  B. Methodology/Proposed Solution (Author's approach)
  C. Synthesis & Rational Conclusions (Proven result)

## 3. MARKET & INTELLECTUAL POSITIONING
[Structure: Contextual Analysis]
- **Direct Competitors**: Contrast with 1-2 seminal works.
- **Unique Selling Proposition (USP)**: Specific value not found elsewhere.
- **Intellectual Heritage**: School of thought built upon or challenged.
</output_structure>

<linguistic_guidelines>
- Body content in **Bahasa Indonesia** (Formal-Academic).
- Headers in **English** (as shown above).
- Maximum density. No filler.
</linguistic_guidelines>
"""
        
        if partial:
            return intro + f"\n<recovery_mode>CONTINUE from interruption:\n---\n{partial}\n---\nSKIP completed sections.</recovery_mode>"
        
        return intro

    def _build_judge_prompt(self, title: str, author: str, genre: str, year: str, drafts: List[str]) -> str:
        """Prompt untuk menggabungkan draft menjadi 3 Section Final"""
        valid_drafts = [d.strip() for d in drafts if d and str(d).strip()]
        formatted = "\n\n".join([f"═══ DRAFT {i+1} ═══\n{d}" for i, d in enumerate(valid_drafts)])
        
        return f"""<role>SENIOR EDITOR: Synthesize into 3 CONSOLIDATED SECTIONS.</role>

<task>Synthesize {len(valid_drafts)} drafts for: "{title}" by {author}.</task>

<drafts>{formatted}</drafts>

<instructions>
1. Merge content: Combine 'Core Summary', 'Key Arguments', and 'Quote' into Section 1.
2. Merge 'Glossary' and 'Reasoning Blueprint' into Section 2.
3. Keep 'Positioning' as the final distinct section.
4. Eliminate redundant strategic steps or limitations unless they are vital to positioning.
5. Output ONLY the 3 sections below.
6. Body content MUST be in Bahasa Indonesia (Formal-Academic). Headers MUST remain in English.
</instructions>

<output_structure>
{chr(10).join([f"- ## {i+1}. {s}" for i, s in enumerate(self.STANDARD_SECTIONS)])}
</output_structure>"""

    # --- API HELPERS ---

    def _summarize_ollama(self, prompt: str, start_time: float) -> Dict:
        try:
            r = requests.post(f"{self.base_url}/api/generate", json={"model": self.model_name, "prompt": prompt, "stream": False}, timeout=self.timeout)
            if r.status_code != 200: return {"error": r.text}
            d = r.json()
            return {
                "content": self._clean_output(d.get("response", "")),
                "usage": {"prompt_tokens": d.get("prompt_eval_count", 0), "completion_tokens": d.get("eval_count", 0), "total_tokens": d.get("prompt_eval_count", 0) + d.get("eval_count", 0)},
                "duration_seconds": round(time.time() - start_time, 2)
            }
        except Exception as e: return {"error": str(e)}

    def _synthesize_section(self, prompt: str, start_time: float) -> Dict:
        print(f"[API_CALL] Preparing request. Prompt Length: {len(prompt)} chars...")
        
        for i in range(self.max_retries):
            try:
                if self.provider == "Ollama": 
                    res = self._summarize_ollama(prompt, start_time)
                    if "error" in res:
                        print(f"[ERROR_Ollama] {res['error']}")
                    return res
                
                if not self.client: return {"error": "No client", "error_type": "ClientError"}
                
                with self._client_lock:
                    c = self.client.chat.completions.create(
                        model=self.model_name, 
                        messages=[{"role": "user", "content": prompt}], 
                        temperature=0.7
                    )
                
                u = c.usage
                content = c.choices[0].message.content

                if not content or len(content.strip()) == 0:
                    err_msg = "API returned empty content (Possible Filter/Safety refusal)"
                    print(f"[ERROR_CONTENT] {err_msg}")
                    return {"error": err_msg, "error_type": "EmptyContent"}
                    
                print(f"[SUCCESS] Received {u.completion_tokens} tokens.")
                return {
                    "content": self._clean_output(content),
                    "usage": {"prompt_tokens": u.prompt_tokens, "completion_tokens": u.completion_tokens, "total_tokens": u.total_tokens}
                }
            
            except Exception as e:
                error_msg = str(e)
                error_type = "GenericError"
                
                if "429" in error_msg or "rate" in error_msg.lower():
                    error_type = "RateLimitError"
                    print(f"[ERROR_API] Rate Limit Hit! Sleeping 5s...")
                    time.sleep(5)
                elif "timeout" in error_msg.lower():
                    error_type = "TimeoutError"
                    print(f"[ERROR_API] Timeout. Retrying...")
                    time.sleep(2)
                elif "context" in error_msg.lower() or "length" in error_msg.lower():
                    error_type = "ContextLengthError"
                    print(f"[ERROR_API] Prompt too long for model context!")
                    break 
                else:
                    print(f"[ERROR_API] Generic Error ({i+1}/{self.max_retries}): {error_msg}")
                    time.sleep(1)
                
                if i == self.max_retries - 1: 
                    return {"error": f"Retry failed ({error_type})", "error_type": error_type, "details": error_msg}
                    
        return {"error": "Unknown failure", "error_type": "Unknown"}

    # --- SYNTHESIS LOGIC (UPDATED FOR 3 SECTIONS) ---

    def summarize_synthesize(self, title: str, author: str, genre: str, year: str, 
                             drafts: List[str], diversity_analysis: Dict = None) -> Generator[Dict, None, None]:
        
        print(f"=== STARTING SYNTHESIS for '{title}' ===")
        if not drafts: 
            print("[FATAL] No drafts provided.")
            yield {"error": "No drafts"}; return
        
        diversity_analysis = diversity_analysis or self._calculate_draft_diversity(drafts)
        yield {"status": "Analyzing draft architecture...", "progress": 5}

        start_time = time.time()
        all_sections_data = [self._extract_sections(d) for d in drafts]
        
        section_tasks = []
        for i, section_name in enumerate(self.STANDARD_SECTIONS):
            section_contents = []
            
            for draft_idx, sections in enumerate(all_sections_data):
                matched = self._match_section_in_draft(section_name, sections, draft_idx)
                if matched: 
                    section_contents.append(matched)
                    print(f"[MATCH] Found '{section_name}' in Draft {draft_idx+1}")
            
            use_full_context = (len(section_contents) == 0)
            
            if use_full_context:
                print(f"[FALLBACK] No match found for '{section_name}'. Will use FULL CONTEXT (truncated).")
            
            context_source = drafts if use_full_context else section_contents
            
            section_tasks.append({
                "name": section_name, "contents": context_source, 
                "use_full_context": use_full_context, "index": i
            })

        # PARALLEL SYNTHESIS (Maks 3 task sekarang)
        synthesized_sections = {}
        section_metadata = {}
        total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        completed = 0
        errors_count = 0
        
        print(f"=== STARTING PARALLEL REQUESTS ({len(section_tasks)} tasks) ===")
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(3, 3)) as executor:
            future_to_task = {executor.submit(self._synthesize_section, 
                                             self._create_section_synthesis_prompt(
                                                 t["name"], t["contents"], title, author, genre, year, len(drafts), t["use_full_context"]
                                             ), start_time): t for t in section_tasks}

            for future in concurrent.futures.as_completed(future_to_task):
                task = future_to_task[future]
                try:
                    res = future.result()
                    if "error" not in res:
                        synthesized_sections[task["name"]] = res["content"]
                        if "usage" in res:
                            for k in total_usage: total_usage[k] += res["usage"][k]
                        
                        if not task["use_full_context"] and task["contents"]:
                            sims = [SequenceMatcher(None, c, res["content"]).ratio() for c in task["contents"]]
                            dom = sims.index(max(sims)) + 1
                            section_metadata[task["name"]] = f"draft_{dom}_dominant" if max(sims) > 0.7 else "merged"
                        else:
                            section_metadata[task["name"]] = "generated"
                    else:
                        errors_count += 1
                        print(f"[FAILED] Section '{task['name']}' failed. Reason: {res.get('error_type', 'Unknown')}")
                except Exception as e: 
                    errors_count += 1
                    print(f"[CRASH] Section {task['name']} crashed: {e}")
                
                completed += 1
                yield {"status": f"Synthesizing: {task['name']}", "progress": 10 + int((completed / len(section_tasks)) * 80)}

        print(f"=== SYNTHESIS COMPLETE. Success: {len(synthesized_sections)}, Errors: {errors_count} ===")

        # RECONSTRUCT DOCUMENT
        final_parts = []
        for std_name in self.STANDARD_SECTIONS:
            best_key = next((k for k in synthesized_sections if self._normalize_section_name(k) == self._normalize_section_name(std_name)), None)
            if best_key:
                final_parts.append(f"## {std_name}")
                final_parts.append(synthesized_sections[best_key])
                final_parts.append("")

        content = "\n".join(final_parts).strip()
        
        if len(content) < 500:
            reason = "Content length too short."
            if errors_count == len(section_tasks):
                reason = "ALL SECTIONS FAILED (API Error)."
            elif len(synthesized_sections) == 0:
                reason = "NO SECTIONS GENERATED."
            
            print(f"[RESCUE MODE] Triggered! Reason: {reason}")
            content = "# SYNTHETIC CONSOLIDATION (FALLBACK)\n\n" + "\n\n".join(drafts[:2])

        yield {
            "content": content, "done": True, "progress": 100,
            "usage": total_usage, "model": self.model_name, "provider": self.provider,
            "cost_estimate": self._calculate_cost(total_usage.get("prompt_tokens", 0), total_usage.get("completion_tokens", 0)),
            "duration_seconds": round(time.time() - start_time, 2),
            "is_synthesized": True, "draft_count": len(drafts),
            "synthesis_metadata": {"section_sources": section_metadata, "diversity_score": diversity_analysis.get("diversity_score", 0)}
        }

    def _match_section_in_draft(self, target: str, draft_sections: Dict, draft_idx: int) -> Optional[str]:
        if target in draft_sections: return draft_sections[target]
        
        norm_target = self._normalize_section_name(target)
        
        potential_sources = []
        for old_name, new_name in self.NAME_MAPPINGS.items():
            if self._normalize_section_name(new_name) == norm_target:
                potential_sources.append(old_name)
        
        found_contents = []
        for old_name in potential_sources:
            norm_old = self._normalize_section_name(old_name)
            for k, v in draft_sections.items():
                if self._normalize_section_name(k) == norm_old:
                    found_contents.append(v)
        
        if found_contents:
            return "\n\n".join(found_contents)

        for k, v in draft_sections.items():
            if self._normalize_section_name(k) == norm_target: return v
            
        return None

    def _create_section_synthesis_prompt(self, name: str, contents: List[str], t: str, a: str, g: str, y: str, dc: int, full: bool) -> str:
        valid_contents = [c for c in contents if c and str(c).strip()]
        
        if not valid_contents:
            return f"""<role>ACADEMIC EDITOR</role>
<task>Generate the "{name}" section for: "{t}" by {a}.</task>
<instruction>No source material. Generate high-quality placeholder.</instruction>"""

        limit_char = 800 if full else 3000 
        
        fmt = "\n\n".join([
            f"═══ SOURCE {i+1} ═══\n{c[:limit_char]}..." if full else f"═══ DRAFT {i+1} ═══\n{c}" 
            for i, c in enumerate(valid_contents)
        ])
        
        # HINTS DIPERBARUI HANYA UNTUK 3 SECTION
        hints = {
            "EXECUTIVE SUMMARY & CORE THESIS": "Merge Summary, Key Arguments, and Iconic Quote into one cohesive section.",
            "ANALYTICAL FRAMEWORK": "Merge Glossary definitions and Reasoning Blueprint (Gap, Method, Conclusion) here.",
            "MARKET & INTELLECTUAL POSITIONING": "Focus on competitors, USP, and intellectual heritage."
            # 'STRATEGIC ACTION PLAN' dan 'CRITICAL LIMITATIONS' dihapus dari hints
        }
        
        hint = hints.get(name, "Synthesize the content for this section.")
        
        return f"""<role>ACADEMIC EDITOR</role>
<context>BOOK: "{t}" by {a}</context>
<task>{hint}</task>
<material>{fmt}</material>
<instructions>
1. Output body content MUST be in Bahasa Indonesia.
2. High density.
3. Use `[[...]]` for data.
4. Do not include header (##) in response.
</instructions>"""

    def _normalize_section_name(self, name: str) -> str:
        if name.startswith('#'): 
            name = name.lstrip('#').strip()
        
        clean = self._regex_patterns['clean_header'].sub('', name)
        clean = self._regex_patterns['normalize_space'].sub(' ', clean).strip().upper()
        clean = re.sub(r'^[\d\.\)\s]+', '', clean).strip()
        
        if clean in self.NAME_MAPPINGS: 
            return self.NAME_MAPPINGS[clean]
        
        base = clean.split('(')[0].strip()
        for key, val in self.NAME_MAPPINGS.items():
            if base in key or key in base: 
                return val
            
        return clean

    def _extract_sections(self, content: str) -> Dict[str, str]:
        sections = {}
        curr = None
        buf = []
        lines = content.split('\n')
        
        print(f"[DEBUG] _extract_sections: Processing content length {len(content)} chars...")

        for line in lines:
            s = line.strip()
            if not s:
                if curr: buf.append(line)
                continue
            
            match = (self._regex_patterns['markdown'].match(s) or
                     self._regex_patterns['bold'].match(s) or
                     self._regex_patterns['numbered'].match(s))
            
            if not match and len(s) >= 10:
                c = self._regex_patterns['caps'].match(s)
                if c:
                    pot = c.group(1).strip()
                    if any(kw in pot for kw in ['EXECUTIVE', 'ANALYTICAL', 'MARKET', 'THESIS', 'GLOSSARY']):
                        match = c
                    # Filter keyword untuk section yang dihapus agar tidak terbaca sebagai header baru
                    if any(kw in pot for kw in ['STRATEGIC', 'ACTION', 'LIMITATIONS', 'CRITICAL']):
                        continue 

            if match:
                if curr: sections[curr] = '\n'.join(buf).strip()
                raw = match.group(1).strip()
                curr = self._normalize_section_name(raw)
                buf = []
            elif curr:
                buf.append(line)
        
        if curr and buf: sections[curr] = '\n'.join(buf).strip()
        
        print(f"[DEBUG] Extracted {len(sections)} sections: {list(sections.keys())}")
        return sections

    def _calculate_draft_diversity(self, drafts: List[str]) -> Dict:
        if len(drafts) < 2: return {"diversity_score": 0.0}
        samples = [d[:1000] for d in drafts]
        tot, cnt = 0, 0
        for i in range(len(samples)):
            for j in range(i+1, len(samples)):
                tot += SequenceMatcher(None, samples[i], samples[j]).ratio()
                cnt += 1
        return {"diversity_score": round(1 - (tot/cnt), 3) if cnt else 0}

    # --- UTILITIES ---

    def _clean_output(self, text: str) -> str:
        text = self._regex_patterns['separator'].sub("", text)
        text = self._regex_patterns['dashes'].sub("", text)
        text = self._regex_patterns['meta'].sub("", text)
        text = self._regex_patterns['excess_newlines'].sub("\n\n", text)
        return text.strip()

    def _calculate_cost(self, p_t: int, c_t: int) -> Dict:
        if self.model_name.endswith(":free"): return {"total_usd": 0.0, "total_idr": 0, "currency": "USD", "is_free": True}
        pricing = self._get_pricing_info()
        if pricing:
            cost = (p_t * float(pricing.get("prompt", 0))) + (c_t * float(pricing.get("completion", 0)))
            rate = self.currency_manager.get_usd_to_idr_rate() or 15000
            return {"total_usd": round(cost, 6), "total_idr": round(cost*rate), "currency": "USD", "is_free": False}
        return {"total_usd": None, "total_idr": None, "currency": "USD", "is_free": False}

    def _get_pricing_info(self) -> Optional[Dict]:
        if self.model_name in self._pricing_cache: return self._pricing_cache[self.model_name]
        fb = {"google/gemini-2.0-flash-exp:free": {"prompt": 0, "completion": 0}, "openai/gpt-4o": {"prompt": 5.0, "completion": 15.0}}
        res = fb.get(self.model_name)
        if res: self._pricing_cache[self.model_name] = res
        return res

    # --- PUBLIC METHODS (Stream & Summarize Skeletons) ---
    
    def summarize(self, book_metadata: List[Dict]) -> Dict:
        """Non-streaming summarize"""
        try:
            m = self._extract_metadata(book_metadata)
            p = self._get_full_prompt(m["title"], m["author"], m["genre"], m["year"], m["description"], "info")
            if not p: return {"error": "Prompt failed"}
            
            start = time.time()
            if self.provider == "Ollama":
                r = self._summarize_ollama(p, start)
                if "content" in r: r["content"] = self._normalize_output_format(r["content"])
                return r
            
            if not self.client: return {"error": "No client"}
            with self._client_lock:
                c = self.client.chat.completions.create(model=self.model_name, messages=[{"role": "user", "content": p}])
            
            u = c.usage
            return {
                "content": self._normalize_output_format(self._clean_output(c.choices[0].message.content)),
                "usage": {"prompt_tokens": u.prompt_tokens, "completion_tokens": u.completion_tokens, "total_tokens": u.total_tokens},
                "model": self.model_name, "provider": self.provider,
                "cost_estimate": self._calculate_cost(u.prompt_tokens, u.completion_tokens),
                "duration_seconds": round(time.time() - start, 2)
            }
        except Exception as e: return {"error": str(e)}

    def summarize_stream(self, book_metadata: List[Dict], partial_content: Optional[str] = None) -> Generator[str, None, None]:
        """Streaming summarize"""
        try:
            m = self._extract_metadata(book_metadata)
            p = self._get_full_prompt(m["title"], m["author"], m["genre"], m["year"], m["description"], "info", partial_content)
            if not p: yield f"data: {json.dumps({'error': 'Prompt failed'})}\n\n"; return
            
            start = time.time()
            if self.provider == "Ollama":
                yield from self._stream_ollama(p, start)
            else:
                if not self.client: yield f"data: {json.dumps({'error': 'No client'})}\n\n"; return
                with self._client_lock:
                    stream = self.client.chat.completions.create(model=self.model_name, messages=[{"role": "user", "content": p}], stream=True, stream_options={"include_usage": True})
                
                parts = []; usage = None
                for chunk in stream:
                    if hasattr(chunk, 'usage') and chunk.usage: usage = {k:getattr(chunk.usage, k) for k in ['prompt_tokens', 'completion_tokens', 'total_tokens']}
                    if chunk.choices and chunk.choices[0].delta.content:
                        parts.append(chunk.choices[0].delta.content)
                        yield f"data: {json.dumps({'content': chunk.choices[0].delta.content})}\n\n"
                
                stats = {'done': True, 'duration_seconds': round(time.time()-start, 2), 'model': self.model_name, 'provider': self.provider}
                if usage:
                    stats['usage'] = usage
                    stats['cost_estimate'] = self._calculate_cost(usage['prompt_tokens'], usage['completion_tokens'])
                yield f"data: {json.dumps(stats)}\n\n"
        except Exception as e: yield f"data: {json.dumps({'error': str(e)})}\n\n"

    def _stream_ollama(self, prompt: str, start: float) -> Generator[str, None, None]:
        try:
            r = requests.post(f"{self.base_url}/api/generate", json={"model": self.model_name, "prompt": prompt, "stream": True}, stream=True, timeout=self.timeout)
            if r.status_code != 200: yield f"data: {json.dumps({'error': r.text})}\n\n"; return
            for line in r.iter_lines():
                if line:
                    d = json.loads(line.decode('utf-8'))
                    if d.get("response"): yield f"data: {json.dumps({'content': d['response']})}\n\n"
                    if d.get("done"):
                        yield f"data: {json.dumps({'done': True, 'duration_seconds': round(time.time()-start, 2), 'model': self.model_name, 'provider': 'Ollama', 'usage': {'prompt_tokens': d.get('prompt_eval_count', 0), 'completion_tokens': d.get('eval_count', 0), 'total_tokens': d.get('prompt_eval_count', 0)+d.get('eval_count', 0)}})}\n\n"
        except Exception as e: yield f"data: {json.dumps({'error': str(e)})}\n\n"

    def _normalize_output_format(self, text: str) -> str:
        lines = text.split('\n'); res = []
        ptr = re.compile(r'^(\d+)[\.\)]\s+([A-Z].{10,})$')
        for line in lines:
            m = ptr.match(line.strip())
            if m: res.extend([f"## {m.group(1)}. {m.group(2)}", "", "---", ""])
            else: res.append(line)
        return re.sub(r'\n{4,}', '\n\n\n', '\n'.join(res)).strip()

    def elaborate(self, selection: str, query: str, full_context: str = "", history: List[Dict[str, str]] = None) -> Dict:
        if not selection: 
            return {"error": "No text selected"}

        selection = self._sanitize_input(selection, 1000)
        query = self._sanitize_input(query, 500)
        full_context = self._sanitize_input(full_context, 5000) if full_context else ""
        
        history_text = ""
        if history:
            formatted_history = [
                f"{'User' if m.get('role') == 'user' else 'AI'}: {self._sanitize_input(m.get('content', ''), 1000)}" 
                for m in history
            ]
            history_text = "\n".join(formatted_history)

        prompt = f"""<role>
You are a SUBJECT MATTER EXPERT and ACADEMIC TUTOR specializing in deep explanation.
</role>

<context>
The user is reading a synthesized intelligence brief and has highlighted a specific passage.
FULL CONTEXT (Excerpts):
...{full_context}...
</context>

<selection>
"{selection}"
</selection>

{f'<conversation_history>{history_text}</conversation_history>' if history_text else ''}

<query>
User Question: "{query if query else 'Jelaskan konsep ini lebih detail dan berikan konteks tambahan.'}"
</query>

<instructions>
1. **Direct Answer**: Address the user's specific question regarding the selected text immediately.
2. **Contextual Awareness**: Use the full context to ensure the explanation fits the book's broader narrative.
3. **Deep Dive (if no specific question)**:
   - Define key jargon/terms used in the selection.
   - Explain the "Why": Why does this concept matter theoretically or practically?
   - Provide a concrete or hypothetical example if the concept is abstract.
4. **Tone**: Analytical, university-level, yet accessible.
5. **Output**: Indonesian.
</instructions>"""

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
            
            usage = completion.usage
            content = completion.choices[0].message.content
            
            return {
                "content": self._clean_output(content),
                "usage": {
                    "prompt_tokens": usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens
                },
                "model": self.model_name,
                "provider": self.provider,
                "cost_estimate": self._calculate_cost(usage.prompt_tokens, usage.completion_tokens),
                "duration_seconds": round(time.time() - start_time, 2)
            }
        except Exception as e:
            return {"error": f"Elaboration failed: {str(e)}"}

    def summarize_tournament(self, book_metadata: List[Dict], n: int = 3) -> Dict:
        """
        Generate multiple summaries (drafts) concurrently, then synthesize the best one.
        Menghasilkan 3 Section Padat.
        """
        if not book_metadata: 
            return {"error": "Empty metadata provided"}
        
        if n < 1: 
            return {"error": "Tournament requires at least 1 draft"}

        drafts = []
        usage_total = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        durations = []
        
        # Phase 1: Generate Drafts Secara Paralel (Format 3 section baru)
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(n, 3)) as executor:
            future_to_draft = {executor.submit(self.summarize, book_metadata): i for i in range(n)}
            
            for future in concurrent.futures.as_completed(future_to_draft):
                try:
                    res = future.result()
                    if "content" in res:
                        drafts.append(res["content"])
                        if "usage" in res:
                            for k in usage_total: 
                                usage_total[k] += res["usage"][k]
                        if "duration_seconds" in res:
                            durations.append(res["duration_seconds"])
                except Exception as e:
                    print(f"Tournament Draft Error: {e}")
                    continue

        if not drafts:
            return {"error": "Failed to generate any drafts"}

        # Phase 2: Synthesis (Judge)
        try:
            metadata = self._extract_metadata(book_metadata)
            judge_prompt = self._get_full_prompt(
                metadata["title"], metadata["author"], metadata["genre"], 
                metadata["year"], "", "", 
                mode="judge", 
                drafts=drafts
            )
            
            start_judge = time.time()
            
            if self.provider == "Ollama":
                judge_res = self._summarize_ollama(judge_prompt, start_judge)
                if "error" in judge_res: 
                    raise Exception(judge_res["error"])
                final_content = judge_res["content"]
                j_usage = judge_res["usage"]
            else:
                if not self.client: 
                    raise BookSummarizerError("AI client not initialized")
                
                with self._client_lock:
                    completion = self.client.chat.completions.create(
                        model=self.model_name,
                        messages=[{"role": "user", "content": judge_prompt}]
                    )
                
                j_usage_obj = completion.usage
                j_usage = {
                    "prompt_tokens": j_usage_obj.prompt_tokens,
                    "completion_tokens": j_usage_obj.completion_tokens,
                    "total_tokens": j_usage_obj.total_tokens
                }
                final_content = self._clean_output(completion.choices[0].message.content)

            for k in usage_total: 
                usage_total[k] += j_usage[k]
            
            avg_duration = sum(durations) / len(durations) if durations else 0
            duration_judge = round(time.time() - start_judge, 2)

            return {
                "content": self._normalize_output_format(final_content),
                "usage": usage_total,
                "model": self.model_name,
                "provider": self.provider,
                "cost_estimate": self._calculate_cost(usage_total["prompt_tokens"], usage_total["completion_tokens"]),
                "duration_seconds": round(avg_duration + duration_judge, 2),
                "is_enhanced": True,
                "draft_count": len(drafts),
                "format": "3_sections_consolidated"
            }
        except Exception as e:
            return {
                "error": f"Judging failed: {str(e)}", 
                "fallback": drafts[0] if drafts else "Failed to generate drafts",
                "usage": usage_total
            }

    def summarize_tournament_stream(self, book_metadata: List[Dict], n: int = 3) -> Generator[str, None, None]:
        """
        Stream tournament process: Drafting -> Synthesis.
        Menghasilkan 3 Section Padat.
        """
        if not book_metadata:
            yield f"data: {json.dumps({'error': 'Empty metadata'})}\n\n"
            return

        drafts = []
        usage_total = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        durations = []

        yield f"data: {json.dumps({'status': f'Generating {n} draft(s) (3-section format)...', 'progress': 5})}\n\n"
        
        # Phase 1: Draft Generation (Concurrent)
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(n, 3)) as executor:
            future_to_idx = {executor.submit(self.summarize, book_metadata): i for i in range(n)}
            
            completed = 0
            for future in concurrent.futures.as_completed(future_to_idx):
                try:
                    res = future.result()
                    if "content" in res:
                        drafts.append(res["content"])
                        if "usage" in res:
                            for k in usage_total: 
                                usage_total[k] += res["usage"][k]
                        if "duration_seconds" in res: 
                            durations.append(res["duration_seconds"])
                        
                        completed += 1
                        progress = 5 + int((completed / n) * 60)
                        yield f"data: {json.dumps({'status': f'Draft {completed}/{n} completed', 'progress': progress})}\n\n"
                except Exception as e:
                    print(f"Stream Tournament Draft Error: {e}")
                    continue

        if not drafts:
            yield f"data: {json.dumps({'error': 'Failed to generate any drafts'})}\n\n"
            return

        # Phase 2: Judging/Synthesis (Streaming)
        try:
            metadata = self._extract_metadata(book_metadata)
            judge_prompt = self._get_full_prompt(
                metadata["title"], metadata["author"], metadata["genre"], 
                metadata["year"], "", "", 
                mode="judge", 
                drafts=drafts
            )
            
            yield f"data: {json.dumps({'status': 'Synthesizing final artifact (3 sections)...', 'progress': 70})}\n\n"
            
            start_judge = time.time()
            
            if self.provider == "Ollama":
                for chunk in self._stream_ollama(judge_prompt, start_judge):
                    if "done" in chunk:
                        try:
                            d = json.loads(chunk[6:])
                            if "usage" in d:
                                u = d["usage"]
                                for k in usage_total: usage_total[k] += u[k]
                        except: pass
                    yield chunk
            else:
                if not self.client:
                    yield f"data: {json.dumps({'error': 'Client not initialized'})}\n\n"
                    return

                with self._client_lock:
                    stream = self.client.chat.completions.create(
                        model=self.model_name,
                        messages=[{"role": "user", "content": judge_prompt}],
                        stream=True,
                        stream_options={"include_usage": True}
                    )

                content_buffer = []
                final_usage = None
                
                for chunk in stream:
                    if hasattr(chunk, 'usage') and chunk.usage:
                        final_usage = {
                            "prompt_tokens": chunk.usage.prompt_tokens,
                            "completion_tokens": chunk.usage.completion_tokens,
                            "total_tokens": chunk.usage.total_tokens
                        }

                    if chunk.choices and len(chunk.choices) > 0:
                        c = chunk.choices[0].delta.content
                        if c:
                            content_buffer.append(c)
                            yield f"data: {json.dumps({'content': c})}\n\n"

                if final_usage:
                    for k in usage_total: 
                        usage_total[k] += final_usage[k]
                
                avg_duration = sum(durations) / len(durations) if durations else 0
                duration_judge = round(time.time() - start_judge, 2)

                yield f"data: {json.dumps({
                    'done': True, 'progress': 100,
                    'usage': usage_total,
                    'cost_estimate': self._calculate_cost(usage_total.get('prompt_tokens', 0), usage_total.get('completion_tokens', 0)),
                    'duration_seconds': round(avg_duration + duration_judge, 2),
                    'is_enhanced': True,
                    'draft_count': len(drafts),
                    'format': '3_sections_consolidated'
                })}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': f'Judging failed: {str(e)}'})}\n\n"