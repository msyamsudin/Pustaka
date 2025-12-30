import concurrent.futures
import json
import re
import time
from difflib import SequenceMatcher
from threading import Lock
from typing import Dict, Generator, AsyncGenerator, List, Optional

import requests
import anyio
from openai import OpenAI

from currency_manager import CurrencyManager
import prompt_templates
import summarizer_utils


class BookSummarizerError(Exception):
    """Base exception for BookSummarizer errors"""
    pass


class BookSummarizer:
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
        max_retries: int = 3,
        search_config: Optional[Dict] = None
    ):
        self.api_key = api_key.strip() if api_key else None
        
        # Validation: check if the key is actually a log message (common corruption)
        if self.api_key and (self.api_key.startswith("INFO:") or self.api_key.startswith("ERROR:")):
            print(f"[AUTH_WARNING] API Key appears to be a corrupted log message: {self.api_key[:20]}...")
            self.api_key = None # Treat as missing so it doesn't try to use it
            self.init_error = "API Key Anda tampak rusak (berisi log server). Harap masukkan ulang API Key yang benar di Pengaturan."
        self.model_name = (model_name or "google/gemini-2.0-flash-exp:free").strip()
        self.provider = provider.capitalize() if provider else "OpenRouter"
        if self.provider == "Openrouter": self.provider = "OpenRouter" # Fix capitalization
        self.base_url = base_url or "http://localhost:11434"
        self.timeout = timeout
        self.max_retries = max_retries
        self.currency_manager = CurrencyManager()
        self._client_lock = Lock()
        
        # Initialize search aggregator if enabled
        self.search_aggregator = None
        if search_config:
            try:
                from search_service import create_search_aggregator
                self.search_aggregator = create_search_aggregator(search_config)
                if self.search_aggregator:
                    print("[SEARCH] Search enrichment enabled")
            except Exception as e:
                print(f"[SEARCH_WARNING] Failed to initialize search: {e}")
        
        self._initialize_client()

    def _initialize_client(self):
        try:
            if self.provider == "OpenRouter" and self.api_key:
                # Mask API Key for logging (showing first 4 and last 4)
                masked_key = f"{self.api_key[:4]}...{self.api_key[-4:]}" if len(self.api_key) > 8 else "***"
                print(f"[INIT] Initializing OpenRouter client with key: {masked_key} (len={len(self.api_key)})")
                
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
            print(f"[RETRY_INIT] Error during client initialization: {e}")
            self.client = None
            # Also catch specific error to help user
            self.init_error = str(e)

    def _verify_ollama_connection(self):
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code != 200:
                raise BookSummarizerError(f"Ollama error {response.status_code}")
        except requests.exceptions.RequestException as e:
            raise BookSummarizerError(f"Cannot connect to Ollama: {str(e)}")


    def _extract_metadata(self, book_metadata: List[Dict]) -> Dict[str, str]:
        if not book_metadata: raise BookSummarizerError("Empty metadata")
        primary = book_metadata[0]
        
        def get_val(k):
            for s in book_metadata:
                if s.get(k): return s.get(k)
            return ""

        return {
            "title": summarizer_utils.sanitize_input(primary.get("title", "Unknown"), 200),
            "author": summarizer_utils.sanitize_input(", ".join(primary.get("authors", [])) if isinstance(primary.get("authors"), list) else str(primary.get("authors", "")), 200),
            "genre": summarizer_utils.sanitize_input(get_val("genre"), 100),
            "year": str(primary.get("publishedDate", get_val("publishedDate"))).split("-")[0],
            "description": get_val("description")
        }

    # --- PROMPT CONSTRUCTION (UPDATED TO 3 SECTIONS) ---

    def _get_full_prompt(self, title: str, author: str, genre: str, year: str, 
                         context_description: str, source_note: str, 
                         partial_content: Optional[str] = None, 
                         mode: str = "summarize", 
                         drafts: Optional[List[str]] = None,
                         search_context: Optional[str] = None) -> str:
        
        if not title or not author: raise BookSummarizerError("Missing title/author")
        
        if mode == "judge" and drafts:
            return prompt_templates.build_judge_prompt(title, author, genre, year, drafts)

        return prompt_templates.build_summarize_prompt(title, author, genre, year, context_description, source_note, partial_content, search_context)


    # --- API HELPERS ---

    def _summarize_ollama(self, prompt: str, start_time: float) -> Dict:
        try:
            r = requests.post(f"{self.base_url}/api/generate", json={"model": self.model_name, "prompt": prompt, "stream": False}, timeout=self.timeout)
            if r.status_code != 200: return {"error": r.text}
            d = r.json()
            return {
                "content": summarizer_utils.clean_output(d.get("response", "")),
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
                    "content": summarizer_utils.clean_output(content),
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

    async def summarize_synthesize(self, title: str, author: str, genre: str, year: str, 
                             drafts: List[str], diversity_analysis: Dict = None, 
                             search_results: Optional[Dict] = None) -> AsyncGenerator[Dict, None]:
        
        print(f"=== STARTING SYNTHESIS for '{title}' ===")
        if not drafts: 
            print("[FATAL] No drafts provided.")
            yield {"error": "No drafts"}; return
        
        diversity_analysis = diversity_analysis or summarizer_utils.calculate_draft_diversity(drafts)
        yield {"status": "Analyzing draft architecture...", "progress": 5}

        start_time = time.time()
        all_sections_data = [summarizer_utils.extract_sections(d, prompt_templates.NAME_MAPPINGS) for d in drafts]
        
        section_tasks = []
        for i, section_name in enumerate(prompt_templates.STANDARD_SECTIONS):
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
        
        async with anyio.create_task_group() as tg:
            send_stream, receive_stream = anyio.create_memory_object_stream()
            
            async def run_section_synthesis(task):
                try:
                    hints = {
                        "EXECUTIVE SUMMARY & CORE THESIS": "Integrasikan Ringkasan Inti, Tesis Utama & Argumen, dan Kutipan Ikonik menjadi satu bagian yang kohesif.",
                        "ANALYTICAL FRAMEWORK": "Gabungkan Glosarium Terminologi dan Blueprint Penalaran (Celah, Metode, Konvergensi) di sini.",
                        "MARKET & INTELLECTUAL POSITIONING": "Fokus pada Kompetitor Langsung, USP, dan Warisan Intelektual."
                    }
                    prompt = prompt_templates.build_section_synthesis_prompt(
                        task["name"], task["contents"], title, author, genre, year, len(drafts), task["use_full_context"], hints
                    )
                    res = await anyio.to_thread.run_sync(self._synthesize_section, prompt, start_time)
                    await send_stream.send((task, res))
                except Exception as e:
                    await send_stream.send((task, {"error": str(e), "error_type": "Crash"}))

            for task in section_tasks:
                tg.start_soon(run_section_synthesis, task)
            
            # Background task to close the stream when all tasks are done
            async def closer():
                pass # tg will block anyway, we use receive_stream.receive() in a loop
            
            for _ in range(len(section_tasks)):
                task, res = await receive_stream.receive()
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
                
                completed += 1
                yield {"status": f"Synthesizing: {task['name']}", "progress": 10 + int((completed / len(section_tasks)) * 80)}

        print(f"=== SYNTHESIS COMPLETE. Success: {len(synthesized_sections)}, Errors: {errors_count} ===")

        # RECONSTRUCT DOCUMENT
        final_parts = []
        for std_name in prompt_templates.STANDARD_SECTIONS:
            best_key = next((k for k in synthesized_sections if summarizer_utils.normalize_section_name(k, prompt_templates.NAME_MAPPINGS) == summarizer_utils.normalize_section_name(std_name, prompt_templates.NAME_MAPPINGS)), None)
            if best_key:
                final_parts.append(f"## {std_name}")
                final_parts.append(synthesized_sections[best_key])
                final_parts.append("")

        content = "\n".join(final_parts).strip()
        
        # Append references
        refs_markdown = self._generate_references_markdown(search_results if search_results else {})
        if refs_markdown:
            content += refs_markdown
        
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
        
        norm_target = summarizer_utils.normalize_section_name(target, prompt_templates.NAME_MAPPINGS)
        
        potential_sources = []
        for old_name, new_name in prompt_templates.NAME_MAPPINGS.items():
            if summarizer_utils.normalize_section_name(new_name, prompt_templates.NAME_MAPPINGS) == norm_target:
                potential_sources.append(old_name)
        
        found_contents = []
        for old_name in potential_sources:
            norm_old = summarizer_utils.normalize_section_name(old_name, prompt_templates.NAME_MAPPINGS)
            for k, v in draft_sections.items():
                if summarizer_utils.normalize_section_name(k, prompt_templates.NAME_MAPPINGS) == norm_old:
                    found_contents.append(v)
        
        if found_contents:
            return "\n\n".join(found_contents)

        for k, v in draft_sections.items():
            if summarizer_utils.normalize_section_name(k, prompt_templates.NAME_MAPPINGS) == norm_target: return v
            
        return None


    def _generate_references_markdown(self, search_results: Dict) -> str:
        """Generates a structured tag for external references for premium frontend rendering."""
        if not search_results: return ""
        
        brave = search_results.get('brave_results', [])
        wiki_summary = search_results.get('wikipedia_summary')
        wiki_url = search_results.get('wikipedia_url')
        
        if not brave and not wiki_summary: return ""
        
        # We use a special tag that the frontend will parse. 
        # We don't include the markdown header here so the frontend has full control.
        lines = ["", "[REF_SECTION]"]
        
        idx = 1
        if wiki_summary:
            title = wiki_summary.split('.')[0].strip() if '.' in wiki_summary else wiki_summary.strip()
            title = (title[:100] + '...') if len(title) > 100 else title
            lines.append(f"{idx}. **Wikipedia**: [{title}]({wiki_url})")
            idx += 1
            
        for res in brave:
            lines.append(f"{idx}. **Search**: [{res['title']}]({res['url']})")
            idx += 1
        
        lines.append("[/REF_SECTION]")
        return "\n".join(lines)

    def _extract_perplexity_citations(self, completion_obj) -> Optional[Dict]:
        """
        Extracts citations from Perplexity Sonar API response.
        Perplexity provides citations in the response object, either as:
        - 'citations': array of URLs
        - 'search_results': object with detailed metadata (title, url, published_date)
        
        Returns structured citation data or None if not a Perplexity model.
        Note: OpenRouter may not pass through Perplexity citations metadata.
        """
        # Only process for Perplexity/Sonar models
        if not self.model_name or not any(keyword in self.model_name.lower() for keyword in ['perplexity', 'sonar']):
            return None
        
        try:
            # Check if completion object has citations or search_results
            citations_data = None
            
            # Try to get from completion object attributes
            if hasattr(completion_obj, 'citations'):
                citations_data = {'citations': completion_obj.citations}
            elif hasattr(completion_obj, 'search_results'):
                citations_data = {'search_results': completion_obj.search_results}
            
            # Also check in the raw response if available
            if not citations_data and hasattr(completion_obj, 'model_extra'):
                extra = completion_obj.model_extra or {}
                if 'citations' in extra:
                    citations_data = {'citations': extra['citations']}
                elif 'search_results' in extra:
                    citations_data = {'search_results': extra['search_results']}
            
            # Check in choices[0].message or delta if available
            if not citations_data and hasattr(completion_obj, 'choices'):
                if completion_obj.choices and len(completion_obj.choices) > 0:
                    choice = completion_obj.choices[0]
                    
                    # For non-streaming responses (ChatCompletion)
                    if hasattr(choice, 'message'):
                        message = choice.message
                        if hasattr(message, 'citations'):
                            citations_data = {'citations': message.citations}
                    
                    # For streaming responses (ChatCompletionChunk) - check delta
                    elif hasattr(choice, 'delta'):
                        delta = choice.delta
                        if hasattr(delta, 'citations'):
                            citations_data = {'citations': delta.citations}
            
            if not citations_data:
                return None
            
            # Process citations into structured format
            structured_citations = []
            
            # Handle 'citations' array format (simple URLs)
            if 'citations' in citations_data and isinstance(citations_data['citations'], list):
                for idx, url in enumerate(citations_data['citations'], 1):
                    if url:
                        structured_citations.append({
                            'index': idx,
                            'url': url,
                            'title': f'Source {idx}',  # Fallback title
                            'type': 'citation'
                        })
            
            # Handle 'search_results' format (detailed metadata)
            elif 'search_results' in citations_data and isinstance(citations_data['search_results'], list):
                for idx, result in enumerate(citations_data['search_results'], 1):
                    if isinstance(result, dict):
                        structured_citations.append({
                            'index': idx,
                            'url': result.get('url', ''),
                            'title': result.get('title', f'Source {idx}'),
                            'published_date': result.get('published_date', ''),
                            'type': 'search_result'
                        })
            
            if structured_citations:
                print(f"[SONAR_CITATIONS] Extracted {len(structured_citations)} citations from Perplexity response")
                return {
                    'provider': 'perplexity_sonar',
                    'model': self.model_name,
                    'citations': structured_citations,
                    'total_count': len(structured_citations)
                }
            
        except Exception as e:
            print(f"[SONAR_CITATIONS_ERROR] Failed to extract citations: {e}")
        
        return None

    def _calculate_cost(self, p_t: int, c_t: int) -> Dict:
        if self.model_name.endswith(":free"): return {"total_usd": 0.0, "total_idr": 0, "currency": "USD", "is_free": True}
        pricing = self._get_pricing_info()
        if pricing:
            cost = (p_t * float(pricing.get("prompt", 0))) + (c_t * float(pricing.get("completion", 0)))
            rate = self.currency_manager.get_usd_to_idr_rate() or 15000
            return {"total_usd": round(cost, 6), "total_idr": round(cost*rate), "currency": "USD", "is_free": False}
        return {"total_usd": None, "total_idr": None, "currency": "USD", "is_free": False}

    def _get_pricing_info(self) -> Optional[Dict]:
        """Gets pricing info for the current model, fetching from OpenRouter if needed."""
        now = time.time()
        
        with self._pricing_cache_lock:
            # 1. Check if cache is still valid
            if (self.model_name in self._pricing_cache and 
                (now - self._pricing_cache_timestamp) < self.PRICING_CACHE_TTL):
                return self._pricing_cache[self.model_name]

            # 2. Hardcoded fallbacks
            fb = {
                "google/gemini-2.0-flash-exp:free": {"prompt": 0, "completion": 0},
                "openai/gpt-4o": {"prompt": 5.0e-6, "completion": 15.0e-6}, # Fixed scaling (per token)
                "openai/gpt-4o-mini": {"prompt": 0.15e-6, "completion": 0.6e-6}
            }
            if self.model_name in fb:
                self._pricing_cache[self.model_name] = fb[self.model_name]
                return fb[self.model_name]

            # 3. Dynamic Fetch for OpenRouter
            if self.provider == "OpenRouter":
                try:
                    print(f"[PRICING] Fetching dynamic pricing from OpenRouter for {self.model_name}...")
                    response = requests.get("https://openrouter.ai/api/v1/models", timeout=10)
                    if response.status_code == 200:
                        data = response.json()
                        models = data.get("data", [])
                        for m in models:
                            m_id = m.get("id")
                            p = m.get("pricing")
                            if m_id and p:
                                # Store all models in cache while we're at it
                                self._pricing_cache[m_id] = {
                                    "prompt": float(p.get("prompt", 0)),
                                    "completion": float(p.get("completion", 0))
                                }
                        
                        self._pricing_cache_timestamp = now
                        return self._pricing_cache.get(self.model_name)
                except Exception as e:
                    print(f"[ERROR] Failed to fetch OpenRouter pricing: {e}")

        return None

    # --- PUBLIC METHODS (Stream & Summarize Skeletons) ---
    
    def summarize(self, book_metadata: List[Dict], search_context: Optional[str] = None) -> Dict:
        """Non-streaming summarize"""
        try:
            m = self._extract_metadata(book_metadata)
            
            search_results = {}
            if self.search_aggregator and not search_context:
                try:
                    def evaluation_wrapper(results, book_info):
                        return self._evaluate_search_relevance(results, book_info)
                    
                    search_results = self.search_aggregator.search(
                        m["title"], m["author"], m.get("genre", ""),
                        evaluation_wrapper
                    )
                    search_context = self.search_aggregator.format_for_prompt(search_results)
                except Exception as e:
                    print(f"[SEARCH_WARNING] Non-streaming search failed: {e}")

            p = self._get_full_prompt(m["title"], m["author"], m["genre"], m["year"], m["description"], "info", search_context=search_context)
            if not p: return {"error": "Prompt failed"}
            
            start = time.time()
            if self.provider == "Ollama":
                r = self._summarize_ollama(p, start)
                if "content" in r: 
                    r["content"] = summarizer_utils.normalize_output_format(r["content"])
                    # Append references
                    refs_markdown = self._generate_references_markdown(search_results if search_results else {})
                    if refs_markdown:
                        r["content"] += refs_markdown
                return r
            
            if not self.client: return {"error": "No client"}
            with self._client_lock:
                c = self.client.chat.completions.create(model=self.model_name, messages=[{"role": "user", "content": p}])
            
            # Extract Perplexity citations if available
            sonar_citations = self._extract_perplexity_citations(c)
            
            u = c.usage
            final_content = summarizer_utils.normalize_output_format(summarizer_utils.clean_output(c.choices[0].message.content))
            
            # Append references
            refs_markdown = self._generate_references_markdown(search_results if search_results else {})
            if refs_markdown:
                final_content += refs_markdown
                
            res = {
                "content": final_content,
                "usage": {"prompt_tokens": u.prompt_tokens, "completion_tokens": u.completion_tokens, "total_tokens": u.total_tokens},
                "model": self.model_name, "provider": self.provider,
                "cost_estimate": self._calculate_cost(u.prompt_tokens, u.completion_tokens),
                "duration_seconds": round(time.time() - start, 2)
            }
            
            # Add Perplexity citations if available
            if sonar_citations:
                res["sonar_citations"] = sonar_citations
            
            if search_results and search_results.get("search_metadata"):
                res["search_metadata"] = search_results["search_metadata"]
                res["search_sources"] = {
                    'brave': [{'title': r['title'], 'url': r['url']} for r in search_results.get('brave_results', [])],
                    'wikipedia': {
                        'title': search_results.get('wikipedia_summary', '')[:100] + '...',
                        'url': search_results.get('wikipedia_url', '')
                    } if search_results.get('wikipedia_summary') else None
                }
            return res
        except Exception as e: return {"error": str(e)}

    def _evaluate_search_relevance(self, results: List[Dict], book_info: Dict) -> List[str]:
        """
        Uses AI to evaluate the relevance and quality of search results.
        Returns a list of labels ("scholarly", "general", or "shallow").
        """
        if not results: return []
        
        # Prepare a very compact representation of results for evaluation
        formatted_results = []
        for i, r in enumerate(results):
            formatted_results.append(f"[{i}] Title: {r.get('title')}\nSnippet: {r.get('snippet')[:200]}\nURL: {r.get('url')}")
        
        results_str = "\n---\n".join(formatted_results)
        
        prompt = f"""<role>SCHOLARLY & QUALITY RELEVANCE EVALUATOR</role>
<context>Book: "{book_info.get('title')}" by {book_info.get('author')}</context>
<task>Evaluate the ACADEMIC WEIGHT and CONTENT QUALITY of the following search results.</task>

<results>
{results_str}
</results>

<instructions>
1. Categorize each result into ONE of these three levels:
   - "scholarly": Journal articles, academic publishers (University Presses), critical reviews by scholars, historical manuscripts, or peer-reviewed findings.
   - "general": High-quality long-form articles, reputable news analysis (International/Verified Media), detailed book reviews from verified enthusiasts/critics, or institutional reports.
   - "shallow": Generic blog posts (WordPress, Blogspot), book catalogs/commerce (Online Stores/Marketplaces), shallow buzzword-filled summaries, or unrelated content.
2. Return a JSON object with a "relevance" key containing an array of strings (the labels).
3. Example: {{"relevance": ["scholarly", "general", "shallow"]}}
</instructions>
RESPONSE ONLY WITH THE JSON OBJECT."""

        try:
            start_time = time.time()
            if self.provider == "Ollama":
                res = self._summarize_ollama(prompt, start_time)
                content = res.get("content", "{}")
            else:
                if not self.client:
                    print("[RELEVANCE_EVAL_WARNING] AI client not initialized for evaluation, skipping AI check.")
                    return ["general"] * len(results)
                    
                with self._client_lock:
                    c = self.client.chat.completions.create(
                        model=self.model_name,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.0,
                        response_format={"type": "json_object"} if "gemini" not in self.model_name.lower() else None
                    )
                content = c.choices[0].message.content
            
            # Parse JSON object
            data = json.loads(content)
            relevance_labels = data.get("relevance")
            
            if isinstance(relevance_labels, list) and len(relevance_labels) == len(results):
                return [str(x).lower() for x in relevance_labels]
            
            print(f"[RELEVANCE_EVAL_DEBUG] Fallback: AI response was not a valid object with 'relevance' list: {content}")
        except Exception as e:
            # Improved error handling for debugging
            error_msg = str(e)
            if "401" in error_msg or "Unauthorized" in error_msg:
                print(f"[RELEVANCE_EVAL_AUTH_ERROR] Provider: {self.provider}, Model: {self.model_name}")
                print(f"[RELEVANCE_EVAL_AUTH_ERROR] Error Details: {error_msg}")
                if self.api_key:
                    masked_key = f"{self.api_key[:4]}...{self.api_key[-4:]}" if len(self.api_key) > 8 else "***"
                    print(f"[RELEVANCE_EVAL_AUTH_ERROR] Active Key: {masked_key}")
            else:
                print(f"[RELEVANCE_EVAL_ERROR] {repr(e)}")
            
        # Fallback: mark as general if AI fails
        return ["general"] * len(results)

    async def summarize_stream(self, book_metadata: List[Dict], partial_content: Optional[str] = None) -> AsyncGenerator[str, None]:
        """Streaming summarize"""
        try:
            m = self._extract_metadata(book_metadata)
            
            # Perform search if enabled
            search_context_str = ""
            search_metadata = {}
            search_results = {}
            if self.search_aggregator:
                print(f"[SEARCH] Starting search for: {m['title']} by {m['author']}")
                yield f"data: {json.dumps({'status': 'Searching and verifying external sources...', 'progress': 3})}\n\n"
                try:
                    # Define a synchronous wrapper for the evaluation callback
                    def evaluation_wrapper(results, book_info):
                        return self._evaluate_search_relevance(results, book_info)
                    
                    search_results = await anyio.to_thread.run_sync(
                        self.search_aggregator.search, 
                        m["title"], m["author"], m.get("genre", ""),
                        evaluation_wrapper
                    )
                    
                    print(f"[SEARCH] Raw search results: brave={len(search_results.get('brave_results', []))}, wiki={bool(search_results.get('wikipedia_summary'))}")
                    print(f"[SEARCH] Search metadata: {search_results.get('search_metadata', {})}")
                    
                    search_context_str = self.search_aggregator.format_for_prompt(search_results)
                    search_metadata = search_results.get("search_metadata", {})
                    if search_metadata.get("total_sources", 0) > 0:
                        print(f"[SEARCH] Found {search_metadata['total_sources']} verified sources ({search_metadata.get('iterations', 1)} iterations)")
                    else:
                        print(f"[SEARCH] No sources found. Errors: {search_metadata.get('errors', [])}")
                except Exception as e:
                    print(f"[SEARCH_WARNING] Search failed, continuing without enrichment: {e}")
                    import traceback
                    traceback.print_exc()
            
            # Build prompt with search context
            p = self._get_full_prompt(
                m["title"], m["author"], m["genre"], m["year"], 
                m["description"], "info", partial_content, "summarize", None, search_context_str
            )
            if not p: yield f"data: {json.dumps({'error': 'Prompt failed'})}\n\n"; return
            
            start = time.time()
            if self.provider == "Ollama":
                async for chunk in self._stream_ollama(p, start, search_results):
                    yield chunk
            else:
                if not self.client: 
                    err_ext = f" (Init Error: {getattr(self, 'init_error', 'None')})"
                    yield f"data: {json.dumps({'error': f'No client in summarize_stream{err_ext}'})}\n\n"
                    return
                
                # OpenAI streaming completion is blocking in its generator, but we can wrap it
                def get_stream():
                    with self._client_lock:
                        return self.client.chat.completions.create(
                            model=self.model_name, 
                            messages=[{"role": "user", "content": p}], 
                            stream=True, 
                            stream_options={"include_usage": True}
                        )
                
                stream = await anyio.to_thread.run_sync(get_stream)
                
                parts = []; usage = None; last_chunk_obj = None
                
                # Iterating over the stream is blocking
                while True:
                    try:
                        chunk = await anyio.to_thread.run_sync(next, stream, None)
                        if chunk is None: break
                        
                        # Store last chunk for citation extraction
                        last_chunk_obj = chunk
                        
                        if hasattr(chunk, 'usage') and chunk.usage: 
                            usage = {k:getattr(chunk.usage, k) for k in ['prompt_tokens', 'completion_tokens', 'total_tokens']}
                        
                        if chunk.choices and chunk.choices[0].delta.content:
                            c = chunk.choices[0].delta.content
                            parts.append(c)
                            yield f"data: {json.dumps({'content': c})}\n\n"
                    except StopIteration:
                        break

                # Append references to common markdown output
                refs_markdown = self._generate_references_markdown(search_results if search_results else {})
                if refs_markdown:
                    yield f"data: {json.dumps({'content': refs_markdown})}\n\n"
                
                # Extract Perplexity citations from last chunk if available
                sonar_citations = None
                if last_chunk_obj:
                    sonar_citations = self._extract_perplexity_citations(last_chunk_obj)
                
                stats = {'done': True, 'duration_seconds': round(time.time()-start, 2), 'model': self.model_name, 'provider': self.provider}
                if usage:
                    stats['usage'] = usage
                    stats['cost_estimate'] = self._calculate_cost(usage['prompt_tokens'], usage['completion_tokens'])
                
                # Add Perplexity citations if available
                if sonar_citations:
                    stats['sonar_citations'] = sonar_citations
                
                if search_metadata or (search_results and search_results.get("search_metadata")):
                    actual_meta = search_metadata if search_metadata else search_results.get("search_metadata", {})
                    stats['search_enriched'] = actual_meta.get('total_sources', 0) > 0
                    stats['search_metadata'] = actual_meta
                    stats['search_sources'] = {
                        'brave': [{'title': r['title'], 'url': r['url']} for r in search_results.get('brave_results', [])],
                        'wikipedia': {
                            'title': search_results.get('wikipedia_summary', '')[:100] + '...',
                            'url': search_results.get('wikipedia_url', '')
                        } if search_results.get('wikipedia_summary') else None
                    }
                yield f"data: {json.dumps(stats)}\n\n"
        except Exception as e: yield f"data: {json.dumps({'error': str(e)})}\n\n"

    async def _stream_ollama(self, prompt: str, start: float, search_results: Optional[Dict] = None) -> AsyncGenerator[str, None]:
        try:
            def make_request():
                return requests.post(
                    f"{self.base_url}/api/generate", 
                    json={"model": self.model_name, "prompt": prompt, "stream": True}, 
                    stream=True, 
                    timeout=self.timeout
                )
            
            r = await anyio.to_thread.run_sync(make_request)
            if r.status_code != 200: yield f"data: {json.dumps({'error': r.text})}\n\n"; return
            
            # r.iter_lines is also blocking
            iterator = r.iter_lines()
            while True:
                line = await anyio.to_thread.run_sync(next, iterator, None)
                if line is None: break
                
                if line:
                    d = json.loads(line.decode('utf-8'))
                    if d.get("response"): yield f"data: {json.dumps({'content': d['response']})}\n\n"
                    if d.get("done"):
                        # Append references before final stats
                        refs_markdown = self._generate_references_markdown(search_results if search_results else {})
                        if refs_markdown:
                            yield f"data: {json.dumps({'content': refs_markdown})}\n\n"

                        yield f"data: {json.dumps({
                            'done': True, 
                            'duration_seconds': round(time.time()-start, 2), 
                            'model': self.model_name, 
                            'provider': 'Ollama', 
                            'usage': {
                                'prompt_tokens': d.get('prompt_eval_count', 0), 
                                'completion_tokens': d.get('eval_count', 0), 
                                'total_tokens': d.get('prompt_eval_count', 0)+d.get('eval_count', 0)
                            }
                        })}\n\n"
        except Exception as e: yield f"data: {json.dumps({'error': str(e)})}\n\n"


    def elaborate(self, selection: str, query: str, full_context: str = "", history: List[Dict[str, str]] = None) -> Dict:
        if not selection: 
            return {"error": "No text selected"}

        selection = summarizer_utils.sanitize_input(selection, 1000)
        query = summarizer_utils.sanitize_input(query, 500)
        full_context = summarizer_utils.sanitize_input(full_context, 5000) if full_context else ""
        
        history_text = ""
        if history:
            formatted_history = [
                f"{'User' if m.get('role') == 'user' else 'AI'}: {summarizer_utils.sanitize_input(m.get('content', ''), 1000)}" 
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
                "content": summarizer_utils.clean_output(content),
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
        
        # Perform search if enabled
        search_context_str = ""
        search_results = {}
        if self.search_aggregator:
            try:
                def evaluation_wrapper(results, book_info):
                    return self._evaluate_search_relevance(results, book_info)
                
                m = self._extract_metadata(book_metadata)
                search_results = self.search_aggregator.search(
                    m["title"], m["author"], m.get("genre", ""),
                    evaluation_wrapper
                )
                search_context_str = self.search_aggregator.format_for_prompt(search_results)
            except Exception as e:
                print(f"[SEARCH_WARNING] Tournament search failed: {e}")

        # Phase 1: Generate Drafts Secara Paralel (Format 3 section baru)
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(n, 3)) as executor:
            future_to_draft = {executor.submit(self.summarize, book_metadata, search_context_str): i for i in range(n)}
            
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
                final_content = summarizer_utils.clean_output(completion.choices[0].message.content)
                
                # Extract Perplexity citations if available
                sonar_citations = self._extract_perplexity_citations(completion)

            for k in usage_total: 
                usage_total[k] += j_usage[k]
            
            avg_duration = sum(durations) / len(durations) if durations else 0
            duration_judge = round(time.time() - start_judge, 2)

            res_content = summarizer_utils.normalize_output_format(final_content)
            
            # Append references
            refs_markdown = self._generate_references_markdown(search_results if search_results else {})
            if refs_markdown:
                res_content += refs_markdown
                
            res = {
                "content": res_content,
                "usage": usage_total,
                "model": self.model_name,
                "provider": self.provider,
                "cost_estimate": self._calculate_cost(usage_total["prompt_tokens"], usage_total["completion_tokens"]),
                "duration_seconds": round(avg_duration + duration_judge, 2),
                "is_enhanced": True,
                "draft_count": len(drafts),
                "format": "3_sections_consolidated"
            }
            
            # Add Perplexity citations if available
            if sonar_citations:
                res["sonar_citations"] = sonar_citations
            
            if search_results and search_results.get("search_metadata"):
                res["search_metadata"] = search_results["search_metadata"]
                res["search_sources"] = {
                    'brave': [{'title': r['title'], 'url': r['url']} for r in search_results.get('brave_results', [])],
                    'wikipedia': {
                        'title': search_results.get('wikipedia_summary', '')[:100] + '...',
                        'url': search_results.get('wikipedia_url', '')
                    } if search_results.get('wikipedia_summary') else None
                }
            return res
        except Exception as e:
            return {
                "error": f"Judging failed: {str(e)}", 
                "fallback": drafts[0] if drafts else "Failed to generate drafts",
                "usage": usage_total
            }

    async def summarize_tournament_stream(self, book_metadata: List[Dict], n: int = 3) -> AsyncGenerator[str, None]:
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
        
        # Perform search if enabled for tournament mode as well
        search_context_str = ""
        search_results = {}
        if self.search_aggregator:
            yield f"data: {json.dumps({'status': 'Searching and verifying external scholarly sources...', 'progress': 7})}\n\n"
            try:
                def evaluation_wrapper(results, book_info):
                    return self._evaluate_search_relevance(results, book_info)
                
                m = self._extract_metadata(book_metadata)
                search_results = await anyio.to_thread.run_sync(
                    self.search_aggregator.search, 
                    m["title"], m["author"], m.get("genre", ""),
                    evaluation_wrapper
                )
                search_context_str = self.search_aggregator.format_for_prompt(search_results)
            except Exception as e:
                print(f"[SEARCH_WARNING] Tournament search failed: {e}")

        # Phase 1: Draft Generation (Concurrent)
        async with anyio.create_task_group() as tg:
            send_stream, receive_stream = anyio.create_memory_object_stream()
            
            async def run_draft(idx):
                try:
                    # Pass search_context_str if it exists
                    search_context = search_context_str if 'search_context_str' in locals() else ""
                    res = await anyio.to_thread.run_sync(self.summarize, book_metadata, search_context)
                    await send_stream.send(res)
                except Exception as e:
                    await send_stream.send({"error": str(e)})

            for i in range(n):
                tg.start_soon(run_draft, i)
            
            completed = 0
            for _ in range(n):
                res = await receive_stream.receive()
                if "content" in res:
                    drafts.append(res["content"])
                    if "usage" in res:
                        for k in usage_total: usage_total[k] += res["usage"][k]
                    if "duration_seconds" in res: durations.append(res["duration_seconds"])
                    
                    completed += 1
                    progress = 5 + int((completed / n) * 60)
                    yield f"data: {json.dumps({'status': f'Draft {completed}/{n} completed', 'progress': progress})}\n\n"
                else:
                    print(f"Stream Tournament Draft Error: {res.get('error')}")

        if not drafts:
            yield f"data: {json.dumps({'error': 'Failed to generate any drafts'})}\n\n"
            return

        # Phase 2: Judging/Synthesis (Streaming with Robustness)
        max_attempts = 2
        last_error = None
        
        for attempt in range(max_attempts):
            try:
                metadata = self._extract_metadata(book_metadata)
                judge_prompt = self._get_full_prompt(
                    metadata["title"], metadata["author"], metadata["genre"], 
                    metadata["year"], "", "", 
                    mode="judge", 
                    drafts=drafts
                )
                
                status_msg = 'Synthesizing final artifact...' if attempt == 0 else f'Synthesizing final artifact (Retry {attempt})...'
                yield f"data: {json.dumps({'status': status_msg, 'progress': 70 + (attempt * 10)})}\n\n"
                
                start_judge = time.time()
                
                if self.provider == "Ollama":
                    async for chunk in self._stream_ollama(judge_prompt, start_judge, search_results):
                        if "done" in chunk:
                            try:
                                d = json.loads(chunk[6:])
                                if "usage" in d:
                                    u = d["usage"]
                                    for k in usage_total: usage_total[k] += u[k]
                            except: pass
                        yield chunk
                    return # Success
                else:
                    if not self.client:
                        yield f"data: {json.dumps({'error': 'Client not initialized'})}\n\n"
                        return

                    def get_stream():
                        with self._client_lock:
                            return self.client.chat.completions.create(
                                model=self.model_name,
                                messages=[{"role": "user", "content": judge_prompt}],
                                stream=True,
                                stream_options={"include_usage": True}
                            )

                    stream = await anyio.to_thread.run_sync(get_stream)

                    content_buffer = []
                    final_usage = None
                    
                    while True:
                        try:
                            chunk = await anyio.to_thread.run_sync(next, stream, None)
                            if chunk is None: break

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
                        except StopIteration:
                            break

                    # Append references
                    refs_markdown = self._generate_references_markdown(search_results if search_results else {})
                    if refs_markdown:
                        yield f"data: {json.dumps({'content': refs_markdown})}\n\n"

                    if final_usage:
                        for k in usage_total: 
                            usage_total[k] += final_usage[k]
                    
                    avg_duration = sum(durations) / len(durations) if durations else 0
                    duration_judge = round(time.time() - start_judge, 2)

                    stats = {
                        'done': True, 'progress': 100,
                        'usage': usage_total,
                        'model': self.model_name,
                        'provider': self.provider,
                        'cost_estimate': self._calculate_cost(usage_total.get('prompt_tokens', 0), usage_total.get('completion_tokens', 0)),
                        'duration_seconds': round(avg_duration + duration_judge, 2),
                        'is_enhanced': True,
                        'draft_count': len(drafts),
                        'format': '3_sections_consolidated'
                    }
                    if search_results and search_results.get("search_metadata"):
                        stats["search_metadata"] = search_results["search_metadata"]
                        stats["search_sources"] = {
                            'brave': [{'title': r['title'], 'url': r['url']} for r in search_results.get('brave_results', [])],
                            'wikipedia': {
                                'title': search_results.get('wikipedia_summary', '')[:100] + '...',
                                'url': search_results.get('wikipedia_url', '')
                            } if search_results.get('wikipedia_summary') else None
                        }
                    yield f"data: {json.dumps(stats)}\n\n"
                    return # Success

            except Exception as e:
                last_error = str(e)
                print(f"[RETRY_JUDGE] Attempt {attempt+1} failed: {last_error}")
                if attempt < max_attempts - 1:
                    await anyio.sleep(2) # Brief pause before retry
                else:
                    # Final attempt fallback to NON-STREAMING if available
                    yield f"data: {json.dumps({'status': 'Streaming failed. Attempting stable non-streaming synthesis...', 'progress': 90})}\n\n"
                    try:
                        if self.provider == "Ollama":
                            # Fallback for Ollama should use its own non-stream logic
                            res_obj = await anyio.to_thread.run_sync(self._summarize_ollama, judge_prompt, start_judge)
                            content = res_obj.get("content", "")
                            u_dict = res_obj.get("usage", {})
                            for k in usage_total:
                                usage_total[k] += u_dict.get(k, 0)
                        else:
                            if not self.client:
                                raise BookSummarizerError("AI client not initialized (Fallback)")
                            
                            def run_non_stream():
                                with self._client_lock:
                                    return self.client.chat.completions.create(
                                        model=self.model_name,
                                        messages=[{"role": "user", "content": judge_prompt}],
                                        stream=False
                                    )
                            
                            res_obj = await anyio.to_thread.run_sync(run_non_stream)
                            content = res_obj.choices[0].message.content
                            u = res_obj.usage
                            for k in usage_total: 
                                usage_total[k] += getattr(u, k, 0)
                            
                        yield f"data: {json.dumps({'content': content})}\n\n"
                        stats = {
                            'done': True, 'progress': 100,
                            'usage': usage_total,
                            'model': self.model_name,
                            'provider': self.provider,
                            'is_enhanced': True,
                            'is_fallback_used': True,
                            'duration_seconds': round(time.time() - start_judge, 2)
                        }
                        if search_results and search_results.get("search_metadata"):
                            stats["search_metadata"] = search_results["search_metadata"]
                            stats["search_sources"] = {
                                'brave': [{'title': r['title'], 'url': r['url']} for r in search_results.get('brave_results', [])],
                                'wikipedia': {
                                    'title': search_results.get('wikipedia_summary', '')[:100] + '...',
                                    'url': search_results.get('wikipedia_url', '')
                                } if search_results.get('wikipedia_summary') else None
                            }
                        yield f"data: {json.dumps(stats)}\n\n"
                    except Exception as e2:
                        yield f"data: {json.dumps({'error': f'All synthesis attempts failed. Last error: {str(e2)}'})}\n\n"

    async def summarize_iterative_stream(self, book_metadata: List[Dict], max_iterations: int = 3, target_score: int = 90, critic_model: Optional[str] = None) -> AsyncGenerator[str, None]:
        """
        Iterative Self-Correction Mode:
        Draft -> Critic (Score) -> Refine -> Loop until Target Score or Max Iterations.
        """
        start_time = time.time()
        if not book_metadata:
            yield f"data: {json.dumps({'error': 'Empty metadata'})}\n\n"
            return
            
        # 1. Setup & Search
        m = self._extract_metadata(book_metadata)
        search_context_str = ""
        search_results = {}
        
        yield f"data: {json.dumps({'status': 'Initializing Iterative Mode...', 'progress': 2})}\n\n"
        
        if self.search_aggregator:
            yield f"data: {json.dumps({'status': 'Searching for high-quality context...', 'progress': 5})}\n\n"
            try:
                def evaluation_wrapper(results, book_info):
                    return self._evaluate_search_relevance(results, book_info)
                
                search_results = await anyio.to_thread.run_sync(
                    self.search_aggregator.search, 
                    m["title"], m["author"], m.get("genre", ""),
                    evaluation_wrapper
                )
                search_context_str = self.search_aggregator.format_for_prompt(search_results)
            except Exception as e:
                print(f"[SEARCH_WARNING] Iterative search failed: {e}")

        # 2. Initial Draft
        current_draft = ""
        usage_total = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        best_draft = {"content": "", "score": 0, "iteration": 0}
        
        yield f"data: {json.dumps({'event': 'draft', 'status': 'Generating Initial Draft...', 'progress': 10})}\n\n"
        
        try:
            # First draft using standard summarize
            # We don't stream here because we need the full text for the critic
            res = await anyio.to_thread.run_sync(self.summarize, book_metadata, search_context_str)
            if "error" in res:
                yield f"data: {json.dumps({'error': f'Initial draft failed: {res["error"]}'})}\n\n"
                return
                
            current_draft = res.get("content", "")
            if "usage" in res:
                for k in usage_total: usage_total[k] += res["usage"][k]
            
            # Initialize best draft
            best_draft = {"content": current_draft, "score": 0, "iteration": 0} # Score unknown yet
            
            yield f"data: {json.dumps({'event': 'draft_complete', 'content': current_draft, 'progress': 20})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'error': f'Draft generation error: {str(e)}'})}\n\n"
            return

        # 3. Iteration Loop
        prev_score = 0
        stagnation_counter = 0
        
        for i in range(max_iterations):
            iter_num = i + 1
            yield f"data: {json.dumps({'event': 'critic_start', 'status': f'Critic analyzing Draft {iter_num}...', 'progress': 20 + (i * 20)})}\n\n"
            
            # --- CRITIC PHASE ---
            try:
                critic_res = await self._evaluate_draft_quality(
                    m["title"], m["author"], current_draft, 
                    model_override=critic_model
                )
                
                # Validation & Fallback for Critic
                score = critic_res.get("score", 0)
                issues = critic_res.get("issues", [])
                fixes = critic_res.get("fixes", [])
                
                # Update best draft if better
                if score > best_draft["score"]:
                    best_draft = {"content": current_draft, "score": score, "iteration": iter_num}
                
                # Emit Score Event
                yield f"data: {json.dumps({
                    'event': 'score', 
                    'score': score, 
                    'issues': issues, 
                    'fixes': fixes,
                    'iteration': iter_num
                })}\n\n"
                
                # --- DECISION GATES ---
                
                # 1. Target Reached
                if score >= target_score:
                    yield f"data: {json.dumps({'event': 'loop_exit', 'reason': 'target_met', 'msg': f'Target score reached ({score})'})}\n\n"
                    break
                    
                # 2. Acceptance Threshold + Minor Issues
                acceptance_score = target_score - 10 # e.g. 80
                if score >= acceptance_score and (len(issues) <= 1 or "minor" in str(issues).lower()):
                    yield f"data: {json.dumps({'event': 'loop_exit', 'reason': 'acceptable', 'msg': 'Acceptable score with minor issues.'})}\n\n"
                    break
                    
                # 3. Stagnation Guard
                score_delta = score - prev_score
                if iter_num > 1 and score_delta < 5:
                    stagnation_counter += 1
                    if stagnation_counter >= 2:
                        yield f"data: {json.dumps({'event': 'loop_exit', 'reason': 'stagnation', 'msg': 'Score stagnation detected.'})}\n\n"
                        break
                else:
                    stagnation_counter = 0
                    
                prev_score = score
                
                # 4. Max Iterations Reached (Check loop end)
                if i == max_iterations - 1:
                     yield f"data: {json.dumps({'event': 'loop_exit', 'reason': 'max_iter', 'msg': 'Max iterations reached.'})}\n\n"
                     break
                
                # --- REFINEMENT PHASE ---
                yield f"data: {json.dumps({'event': 'refine_start', 'status': f'Refining Draft {iter_num}...', 'progress': 25 + (i * 20)})}\n\n"
                
                refine_prompt = prompt_templates.build_refiner_prompt(m["title"], m["author"], current_draft, issues, fixes)
                
                # Run refinement
                # We use a lower temperature for refinement to stick to instructions
                refine_res = await self._run_completion(refine_prompt, temperature=0.5)
                
                if "content" in refine_res:
                    current_draft = summarizer_utils.clean_output(refine_res["content"])
                    if "usage" in refine_res:
                         for k in usage_total: usage_total[k] += refine_res["usage"][k]
                         
                    yield f"data: {json.dumps({'event': 'refine_complete', 'content': current_draft})}\n\n"
                else:
                    yield f"data: {json.dumps({'error': 'Refinement produced empty content'})}\n\n"
                    break # Stop if refinement fails
                    
            except Exception as e:
                print(f"[ITERATION_ERROR] {e}")
                # Use best draft so far
                yield f"data: {json.dumps({'error': f'Iteration error: {str(e)}. Returning best result.'})}\n\n"
                break

        # 4. Final Finalization
        yield f"data: {json.dumps({'status': 'Finalizing...', 'progress': 95})}\n\n"
        
        final_content = best_draft["content"]
        
        # Normalize format one last time to be sure
        final_content = summarizer_utils.normalize_output_format(final_content)
        
        # Append references
        refs_markdown = self._generate_references_markdown(search_results if search_results else {})
        if refs_markdown:
            final_content += refs_markdown
            
        # Yield the final polished content to replace whatever is in the frontend
        yield f"data: {json.dumps({'event': 'refine_complete', 'content': final_content})}\n\n"

        stats = {
            'done': True, 'progress': 100,
            'usage': usage_total,
            'model': self.model_name,
            'provider': self.provider,
            'cost_estimate': self._calculate_cost(usage_total.get('prompt_tokens', 0), usage_total.get('completion_tokens', 0)),
            'duration_seconds': round(time.time() - start_time, 2),
            'is_enhanced': True,
            'draft_count': iter_num,
            'final_score': best_draft["score"],
            'format': 'iterative_refined'
        }
        
        if search_results and search_results.get("search_metadata"):
             stats["search_metadata"] = search_results["search_metadata"]
             stats["search_sources"] = {
                'brave': [{'title': r['title'], 'url': r['url']} for r in search_results.get('brave_results', [])],
                'wikipedia': {
                    'title': search_results.get('wikipedia_summary', '')[:100] + '...',
                    'url': search_results.get('wikipedia_url', '')
                } if search_results.get('wikipedia_summary') else None
            }
            
        yield f"data: {json.dumps(stats)}\n\n"


    async def _evaluate_draft_quality(self, title: str, author: str, draft: str, model_override: Optional[str] = None) -> Dict:
        """Runs the Critic prompt and parses JSON output."""
        prompt = prompt_templates.build_critic_prompt(title, author, draft)
        
        # Use a specific client if override is provided, otherwise default
        # Simple for now: just use standard client but maybe different model name if we supported switching per request
        # Since `model_override` might require a different client instance (e.g. invalid API key for main client), 
        # we'll stick to the current client for now unless we implement multi-client management.
        # But we CAN switch the model parameter if the provider supports it.
        
        model_to_use = model_override if model_override and model_override != "same" else self.model_name
        
        try:
            res = await self._run_completion(prompt, model=model_to_use, temperature=0.2, json_mode=True)
            content = res.get("content", "{}")
            
            # Clean JSON markdown blocks if present
            if "```json" in content:
                content = content.replace("```json", "").replace("```", "")
            
            data = json.loads(content)
            return data
        except Exception as e:
            print(f"[CRITIC_FAIL] {e}")
            return {"score": 0, "issues": ["Critic failed to parse"], "fixes": []}

    async def _run_completion(self, prompt: str, model: str = None, temperature: float = 0.7, json_mode: bool = False) -> Dict:
        """Helper for async completion"""
        model = model or self.model_name
        start = time.time()
        
        if self.provider == "Ollama":
             # We can't easily use model_override with Ollama properly without verifying it exists, 
             # so we ignore override for Ollama or assume user knows what they are doing.
             # JSON mode for Ollama is supported via format="json"
             try:
                 req_json = {"model": model, "prompt": prompt, "stream": False, "options": {"temperature": temperature}}
                 if json_mode: req_json["format"] = "json"
                 
                 r = await anyio.to_thread.run_sync(
                     lambda: requests.post(f"{self.base_url}/api/generate", json=req_json, timeout=self.timeout)
                 )
                 if r.status_code != 200: return {"error": r.text}
                 d = r.json()
                 return {
                     "content": d.get("response", ""),
                     "usage": {"prompt_tokens": d.get("prompt_eval_count", 0), "completion_tokens": d.get("eval_count", 0), "total_tokens": d.get("prompt_eval_count", 0) + d.get("eval_count", 0)}
                 }
             except Exception as e: return {"error": str(e)}
        else:
             if not self.client: return {"error": "No client"}
             
             def call_api():
                 with self._client_lock:
                     params = {
                         "model": model,
                         "messages": [{"role": "user", "content": prompt}],
                         "temperature": temperature
                     }
                     if json_mode and "gemini" not in model.lower(): # Gemini via OpenAI compat sometimes dislikes this param
                         params["response_format"] = {"type": "json_object"}
                         
                     return self.client.chat.completions.create(**params)
             
             c = await anyio.to_thread.run_sync(call_api)
             u = c.usage
             return {
                 "content": c.choices[0].message.content,
                 "usage": {"prompt_tokens": u.prompt_tokens, "completion_tokens": u.completion_tokens, "total_tokens": u.total_tokens}
             }


