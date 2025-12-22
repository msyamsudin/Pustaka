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
        timeout: int = 300, 
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
        except Exception as e:
            return {"error": f"Failed to extract metadata: {str(e)}"}
            
        if self.provider in ["OpenRouter", "Groq"] and not self.api_key:
            return {"error": f"API Key for {self.provider} is required"}

        try:
            prompt = self._get_full_prompt(
                metadata["title"], 
                metadata["author"], 
                metadata["genre"], 
                metadata["year"],
                metadata["description"],
                "knowledge about this book and publisher's description"
            )
        except BookSummarizerError as e:
            return {"error": str(e)}
        except Exception as e:
            return {"error": f"Failed to generate prompt: {str(e)}"}
        
        # Validate prompt is not empty
        if not prompt or len(prompt.strip()) < 100:
            return {"error": "Generated prompt is too short or empty"}

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
        except Exception as e:
            yield f"data: {json.dumps({'error': f'Failed to extract metadata: {str(e)}'})}\n\n"
            return

        if self.provider in ["OpenRouter", "Groq"] and not self.api_key:
            yield f"data: {json.dumps({'error': f'API Key for {self.provider} is required'})}\n\n"
            return

        # Truncate partial_content to avoid memory issues
        truncated_partial = partial_content[-500:] if partial_content else None

        try:
            prompt = self._get_full_prompt(
                metadata["title"], 
                metadata["author"], 
                metadata["genre"], 
                metadata["year"],
                metadata["description"],
                "knowledge about this book and publisher's description",
                partial_content=truncated_partial
            )
        except BookSummarizerError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return
        except Exception as e:
            yield f"data: {json.dumps({'error': f'Failed to generate prompt: {str(e)}'})}\n\n"
            return
        
        # Validate prompt is not empty
        if not prompt or len(prompt.strip()) < 100:
            yield f"data: {json.dumps({'error': 'Generated prompt is too short or empty'})}\n\n"
            return

        yield f"data: {json.dumps({'status': 'Connecting to intelligence grid...'})}\n\n"

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

    def summarize_tournament_stream(self, book_metadata: List[Dict], n: int = 3) -> Generator[str, None, None]:
        """Stream multiple summaries generation and synthesis"""
        # Validate input
        if not book_metadata:
            yield f"data: {json.dumps({'error': 'Empty book metadata provided'})}\n\n"
            return
        
        if n < 1:
            yield f"data: {json.dumps({'error': 'Tournament requires at least 1 draft'})}\n\n"
            return

        import concurrent.futures
        
        drafts = []
        usage_total = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        durations = []
        
        def generate_draft():
            return self.summarize(book_metadata)
        
        last_error = "Unknown error"
        yield f"data: {json.dumps({'content': '', 'status': f'Generating {n} draft(s)...', 'progress': 5})}\n\n"
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(n, 5)) as executor:
            futures = [executor.submit(generate_draft) for _ in range(n)]
            
            for i, future in enumerate(concurrent.futures.as_completed(futures)):
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
                        
                        # Draft progress (0-75%)
                        progress = 5 + int(((i + 1) / n) * 70)
                        yield f"data: {json.dumps({'content': '', 'status': f'Draft {i+1}/{n} completed...', 'progress': progress})}\n\n"
                    elif "error" in res:
                        last_error = res["error"]
                except Exception as e:
                    last_error = str(e)
                    continue

        if not drafts:
            yield f"data: {json.dumps({'error': f'Failed to generate any drafts. Cause: {last_error}'})}\n\n"
            return

        # Judge stage
        try:
            metadata = self._extract_metadata(book_metadata)
        except BookSummarizerError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

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
        
        yield f"data: {json.dumps({'content': '', 'status': 'Refining & synthesizing final artifact...', 'progress': 80})}\n\n"
        
        try:
            start_judge = time.time()
            content_parts = []
            final_usage = None
            
            if self.provider == "Ollama":
                for chunk in self._stream_ollama(judge_prompt, start_judge):
                    # Inject progress into Ollama chunks if possible, or just pass through
                    # To keep it simple, we'll let the frontend handle the increment if it's already at 80%
                    yield chunk
                    
                    try:
                        if chunk.startswith("data: "):
                            raw_data = json.loads(chunk[6:])
                            if "content" in raw_data:
                                content_parts.append(raw_data["content"])
                            if raw_data.get("done") and "usage" in raw_data:
                                final_usage = raw_data["usage"]
                    except:
                        pass
            else:
                if not self.client:
                    yield f"data: {json.dumps({'error': 'AI client not initialized'})}\n\n"
                    return

                with self._client_lock:
                    stream = self.client.chat.completions.create(
                        model=self.model_name,
                        messages=[{"role": "user", "content": judge_prompt}],
                        stream=True,
                        stream_options={"include_usage": True}
                    )
                
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
                            # Add increasing progress during refinement stream (80-99%)
                            # We don't know the exact length, so we'll just slowly climb
                            current_prog = min(80 + (len(content_parts) // 10), 99)
                            yield f"data: {json.dumps({'content': content, 'progress': current_prog})}\n\n"
            
            # Final stats
            end_judge = time.time()
            if final_usage:
                usage_total["prompt_tokens"] += final_usage["prompt_tokens"]
                usage_total["completion_tokens"] += final_usage["completion_tokens"]
                usage_total["total_tokens"] += final_usage["total_tokens"]
            
            avg_duration = sum(durations) / len(durations) if durations else 0
            
            stats = {
                "done": True,
                "progress": 100,
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
            yield f"data: {json.dumps(stats)}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'error': f'Judging failed: {str(e)}'})}\n\n"

    def summarize_tournament(self, book_metadata: List[Dict], n: int = 3) -> Dict:
        """Generate multiple summaries and synthesize the best one"""
        # Validate input
        if not book_metadata:
            return {"error": "Empty book metadata provided"}
        
        if n < 1:
            return {"error": "Tournament requires at least 1 draft"}
        
        if n > 10:
            return {"error": "Maximum 10 drafts allowed to prevent rate limiting"}
        
        import concurrent.futures
        
        drafts = []
        usage_total = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        durations = []
        
        def generate_draft():
            return self.summarize(book_metadata)
        last_error = "Unknown error"
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
                    elif "error" in res:
                        last_error = res["error"]
                except Exception as e:
                    last_error = str(e)
                    continue

        if not drafts:
            return {"error": f"Failed to generate any drafts. Cause: {last_error}"}

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
                end_judge = time.time()
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

    def summarize_synthesize(self, title: str, author: str, genre: str, year: str, drafts: List[str], diversity_analysis: Dict = None) -> Generator[Dict, None, None]:
        """Synthesize multiple drafts into a final summary using section-by-section approach"""
        if not drafts:
            yield {"error": "No drafts provided for synthesis"}
            return
        
        # Calculate diversity if not provided
        if not diversity_analysis:
            diversity_analysis = self._calculate_draft_diversity(drafts)
        
        yield {"status": "Analyzing draft architecture...", "progress": 5}
        
        # Standard section names in intelligence brief
        STANDARD_SECTIONS = [
            "EXECUTIVE ANALYTICAL BRIEF (Core Summary)",
            "CORE THESIS & KEY ARGUMENTS (Key Points)",
            "CONCEPTUAL ARCHITECTURE (Topic Structure)",
            "GLOSSARY OF DENSITY (Technical Concepts & Terms)",
            "REASONING BLUEPRINT (Logic Framework)",
            "ACTIONABLE INTELLIGENCE & IMPLICATIONS",
            "REPRESENTATIVE SYNTHESIS (Iconic Quote)",
            "COMPARATIVE POSITIONING",
            "IMPLEMENTATION ROADMAP",
            "CRITICAL EVALUATION & LIMITATIONS"
        ]
        
        try:
            start_time = time.time()
            
            
            # Extract sections from all drafts
            all_sections = []
            for draft in drafts:
                sections = self._extract_sections(draft)
                all_sections.append(sections)
            
            # CRITICAL FIX: Use UNION of all sections, not intersection
            # This ensures we process ALL sections from ALL drafts
            all_section_names = set()
            for sections in all_sections:
                all_section_names.update(sections.keys())
            
            # If no sections found at all, fall back to whole-document synthesis
            if not all_section_names:
                yield {"status": "Analysis failed to identify discrete sections. Falling back to technical synthesis...", "progress": 15}
                # Call fallback and yield its results
                fallback_result = self._synthesize_whole_document(title, author, genre, year, drafts, start_time)
                yield {**fallback_result, "progress": 100, "done": True}
                return
            
            # Synthesize each section independently
            synthesized_sections = {}
            section_metadata = {}
            total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            
            # Initialize synthesis tracking metrics
            unique_insights_count = 0
            conflict_resolutions = 0
            
            total_sections = len(all_section_names)
            for i, section_name in enumerate(sorted(all_section_names)):
                # Yield progress for sections
                prog = 10 + int((i / total_sections) * 80)
                yield {"status": f"Synthesizing section: {section_name}...", "progress": prog}
                # Extract this section from drafts that have it
                section_contents = []
                for sections in all_sections:
                    if section_name in sections:
                        section_contents.append(sections[section_name])
                
                # Skip if no content (shouldn't happen, but safety check)
                if not section_contents:
                    continue
                
                # If only one draft has this section, use it directly without synthesis
                if len(section_contents) == 1:
                    synthesized_sections[section_name] = section_contents[0]
                    section_metadata[section_name] = "single_source"
                    continue
                
                # Create section-specific synthesis prompt
                section_prompt = self._create_section_synthesis_prompt(
                    section_name, section_contents, title, author, genre, year, len(drafts)
                )
                
                # Synthesize this section
                section_result = self._synthesize_section(section_prompt, start_time)
                
                if "error" in section_result:
                    # Log the error for debugging
                    print(f"⚠️ Section synthesis failed for '{section_name}': {section_result['error']}")
                    
                    # FALLBACK: Use content from first draft instead of failing completely
                    if section_contents:
                        synthesized_sections[section_name] = section_contents[0]
                        section_metadata[section_name] = "synthesis_failed_using_fallback"
                    else:
                        section_metadata[section_name] = "synthesis_failed"
                    continue
                
                synthesized_sections[section_name] = section_result["content"]
                
                # Track which draft dominated (simple heuristic: most similar to result)
                from difflib import SequenceMatcher
                similarities = [SequenceMatcher(None, content, section_result["content"]).ratio() 
                               for content in section_contents]
                dominant_draft = similarities.index(max(similarities)) + 1
                
                if max(similarities) > 0.7:
                    section_metadata[section_name] = f"draft_{dominant_draft}_dominant"
                else:
                    section_metadata[section_name] = "merged"
                
                # Accumulate usage
                if "usage" in section_result:
                    total_usage["prompt_tokens"] += section_result["usage"]["prompt_tokens"]
                    total_usage["completion_tokens"] += section_result["usage"]["completion_tokens"]
                    total_usage["total_tokens"] += section_result["usage"]["total_tokens"]
            
            
            # Reconstruct full document from synthesized sections
            final_content_parts = []
            section_counter = 1
            
            # Create a mapping of keywords to standard sections for better matching
            section_keywords = {
                "EXECUTIVE ANALYTICAL BRIEF": ["executive", "analytical", "brief", "core summary"],
                "CORE THESIS & KEY ARGUMENTS": ["core", "thesis", "key arguments", "key points"],
                "CONCEPTUAL ARCHITECTURE": ["conceptual", "architecture", "topic structure"],
                "GLOSSARY OF DENSITY": ["glossary", "density", "technical concepts", "terms"],
                "REASONING BLUEPRINT": ["reasoning", "blueprint", "logic framework"],
                "ACTIONABLE INTELLIGENCE & IMPLICATIONS": ["actionable", "intelligence", "implications"],
                "REPRESENTATIVE SYNTHESIS": ["representative", "synthesis", "iconic", "quote"],
                "COMPARATIVE POSITIONING": ["comparative", "positioning"],
                "IMPLEMENTATION ROADMAP": ["implementation", "roadmap"],
                "CRITICAL EVALUATION & LIMITATIONS": ["critical", "evaluation", "limitations"]
            }
            
            for section_name in STANDARD_SECTIONS:
                # Try to find matching section with multiple strategies
                matched_section = None
                
                # Strategy 1: Exact match (case-insensitive)
                for synth_section in synthesized_sections.keys():
                    if section_name.upper() == synth_section.upper():
                        matched_section = synth_section
                        break
                
                # Strategy 2: Bidirectional substring match
                if not matched_section:
                    section_base = section_name.split('(')[0].strip().upper()
                    for synth_section in synthesized_sections.keys():
                        synth_base = synth_section.split('(')[0].strip().upper()
                        # Check both directions
                        if section_base in synth_base or synth_base in section_base:
                            matched_section = synth_section
                            break
                
                # Strategy 3: Keyword-based matching
                if not matched_section:
                    section_base = section_name.split('(')[0].strip()
                    keywords = section_keywords.get(section_base, [])
                    
                    for synth_section in synthesized_sections.keys():
                        synth_upper = synth_section.upper()
                        # Check if at least 2 keywords match
                        matches = sum(1 for kw in keywords if kw.upper() in synth_upper)
                        if matches >= 2:
                            matched_section = synth_section
                            break
                
                if matched_section:
                    final_content_parts.append(f"## {section_counter}. {matched_section}")
                    final_content_parts.append(synthesized_sections[matched_section])
                    final_content_parts.append("")  # Empty line between sections
                    section_counter += 1
            
            # Fallback: Add any synthesized sections that weren't matched
            # This ensures no synthesized content is lost
            for section_name, content in synthesized_sections.items():
                # Check if the section_name (or a normalized version) has already been added
                # This check is more robust than the previous one
                already_added = False
                for part in final_content_parts:
                    if part.startswith("## "):
                        # Extract section name from "## 1. SECTION NAME"
                        added_section_name = part.split(". ", 1)[1] if ". " in part else ""
                        if self._normalize_section_name(added_section_name) == self._normalize_section_name(section_name):
                            already_added = True
                            break
                
                if not already_added:
                    final_content_parts.append(f"## {section_counter}. {section_name}")
                    final_content_parts.append(content)
                    final_content_parts.append("")
                    section_counter += 1
            
            # FINAL SAFETY CHECK: If reconstructed content is too short, use a raw fallback
            final_content = "\n".join(final_content_parts).strip()
            if len(final_content) < 500 and len(drafts) > 0:
                print(f"⚠️ Synthesis produced suspiciously short content ({len(final_content)} chars). Using raw merge fallback.")
                fallback_parts = [f"# SYNTHETIC CONSOLIDATION (RESCUE MODE)\n"]
                for i, draft in enumerate(drafts):
                    fallback_parts.append(f"### VERSION {i+1} SOURCE\n{draft}\n")
                final_content = "\n".join(fallback_parts)

            yield {"status": "Finalizing analytical brief...", "progress": 95}
            
            duration = round(time.time() - start_time, 2)
            
            yield {
                "content": final_content,
                "done": True,
                "progress": 100,
                "usage": total_usage,
                "model": self.model_name,
                "provider": self.provider,
                "cost_estimate": self._calculate_cost(total_usage["prompt_tokens"], total_usage["completion_tokens"]),
                "duration_seconds": duration,
                "is_synthesized": True,
                "draft_count": len(drafts),
                "synthesis_method": "section_by_section",
                "sections_analyzed": len(synthesized_sections),
                "synthesis_metadata": {
                    "section_sources": section_metadata,
                    "unique_insights_count": unique_insights_count,
                    "conflict_resolutions": conflict_resolutions,
                    "diversity_score": diversity_analysis.get("diversity_score", 0)
                }
            }
            
        except Exception as e:
            return {"error": f"Failed to synthesize summaries: {str(e)}"}
    
    def _synthesize_whole_document(self, title: str, author: str, genre: str, year: str, drafts: List[str], start_time: float) -> Dict:
        """Fallback to whole-document synthesis if section extraction fails"""
        prompt = self._get_full_prompt(
            title, author, genre, year, "", "", mode="judge", drafts=drafts
        )
        
        try:
            if self.provider == "Ollama":
                res = self._summarize_ollama(prompt, start_time)
                if "content" in res:
                    res["is_synthesized"] = True
                    res["draft_count"] = len(drafts)
                    res["synthesis_method"] = "whole_document_fallback"
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
            
            return {
                "content": self._clean_output(completion.choices[0].message.content),
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
                "draft_count": len(drafts),
                "synthesis_method": "whole_document_fallback"
            }
        except Exception as e:
            return {"error": f"Failed to synthesize: {str(e)}"}
    
    def _create_section_synthesis_prompt(self, section_name: str, section_contents: List[str], 
                                         title: str, author: str, genre: str, year: str, draft_count: int) -> str:
        """Create prompt for synthesizing a specific section"""
        
        # Format section contents
        formatted_contents = "\n\n".join([
            f"═══ DRAFT {i+1} - {section_name} ═══\n{content}"
            for i, content in enumerate(section_contents)
        ])
        
        return f"""<section_synthesis_task>
You are synthesizing ONLY the "{section_name}" section from {draft_count} intelligence brief drafts.

BOOK CONTEXT:
📚 "{title}" by {author} ({year}, {genre})

SECTION CONTENT FROM EACH DRAFT:
{formatted_contents}

SYNTHESIS INSTRUCTIONS:
1. Apply evaluation rubric:
   - Factual Accuracy (30%): Consistency, no fabrications
   - Information Density (35%): Technical concepts, depth of analysis
   - Structural Coherence (20%): Logical flow, transitions
   - Linguistic Precision (15%): Standard Indonesian, word economy

2. Extract "best-of-breed" elements:
   - Best term definitions
   - Deepest analysis
   - Most concrete examples
   - Most representative quotes

3. Merge complementary information from different drafts

4. Resolve conflicts by prioritizing factual accuracy

5. Preserve unique insights if they add substantive value

6. Use `[[number]]` syntax for synthesized quantitative data

OUTPUT REQUIREMENTS:
- LANGUAGE: Write the content in **Indonesian (Bahasa Indonesia)** using a formal-academic tone.
- Generate ONLY the synthesized content for "{section_name}".
- Do not include the header in your response, as it will be added automatically.
- No meta-commentary or introductions.
- Do NOT mention which draft you're using
- Maintain the original section format (prose or bullet points as appropriate)

Begin synthesis:
</section_synthesis_task>"""
    
    def _synthesize_section(self, prompt: str, start_time: float) -> Dict:
        """Synthesize a single section using AI with retry logic"""
        max_retries = 3
        retry_delay = 1  # seconds
        
        for attempt in range(max_retries):
            try:
                if self.provider == "Ollama":
                    return self._summarize_ollama(prompt, start_time)
                
                if not self.client:
                    return {"error": "AI client not initialized"}
                
                with self._client_lock:
                    completion = self.client.chat.completions.create(
                        model=self.model_name,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.7  # Slightly higher for synthesis creativity
                    )
                
                usage = completion.usage
                content = self._clean_output(completion.choices[0].message.content)
                
                return {
                    "content": content,
                    "usage": {
                        "prompt_tokens": usage.prompt_tokens,
                        "completion_tokens": usage.completion_tokens,
                        "total_tokens": usage.total_tokens
                    }
                }
            except Exception as e:
                error_msg = str(e)
                
                # Check if it's a rate limit error
                if "rate" in error_msg.lower() or "429" in error_msg:
                    if attempt < max_retries - 1:
                        wait_time = retry_delay * (2 ** attempt)  # Exponential backoff
                        print(f"⏳ Rate limit hit, waiting {wait_time}s before retry {attempt + 1}/{max_retries}")
                        time.sleep(wait_time)
                        continue
                
                # If last attempt or non-retryable error, return error
                if attempt == max_retries - 1:
                    return {"error": f"Section synthesis failed after {max_retries} attempts: {error_msg}"}
                
                # For other errors, retry with short delay
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    continue
        
        return {"error": "Section synthesis failed: max retries exceeded"}


    
    def _normalize_section_name(self, section_name: str) -> str:
        """Normalize section names to handle Indonesian/English variations"""
        # Mapping of Indonesian to English section names
        name_mappings = {
            "ESENSI ULTRAMURNI": "EXECUTIVE ANALYTICAL BRIEF",
            "RINGKASAN EKSEKUTIF": "EXECUTIVE ANALYTICAL BRIEF",
            "TESIS INTI": "CORE THESIS & KEY ARGUMENTS",
            "ARGUMEN KUNCI": "CORE THESIS & KEY ARGUMENTS",
            "ARSITEKTUR KONSEPTUAL": "CONCEPTUAL ARCHITECTURE",
            "GLOSARIUM DENSITAS": "GLOSSARY OF DENSITY",
            "KAMUS ISTILAH": "GLOSSARY OF DENSITY",
            "BLUEPRINT PENALARAN": "REASONING BLUEPRINT",
            "KERANGKA LOGIKA": "REASONING BLUEPRINT",
            "INTELIJEN AKSI": "ACTIONABLE INTELLIGENCE & IMPLICATIONS",
            "IMPLIKASI PRAKTIS": "ACTIONABLE INTELLIGENCE & IMPLICATIONS",
            "EVALUASI KRITIS": "CRITICAL EVALUATION & LIMITATIONS",
            "KETERBATASAN": "CRITICAL EVALUATION & LIMITATIONS",
            "POSISI KOMPARATIF": "COMPARATIVE POSITIONING",
            "PERBANDINGAN": "COMPARATIVE POSITIONING",
            "PETA JALAN IMPLEMENTASI": "IMPLEMENTATION ROADMAP",
            "ROADMAP": "IMPLEMENTATION ROADMAP",
            "SINTESIS REPRESENTATIF": "REPRESENTATIVE SYNTHESIS",
            "KUTIPAN IKONIK": "REPRESENTATIVE SYNTHESIS"
        }
        
        # Extract base name (before parentheses)
        base_name = section_name.split('(')[0].strip().upper()
        
        # Check if it matches any known mapping
        for indo_name, eng_name in name_mappings.items():
            if indo_name in base_name or base_name in indo_name:
                return eng_name
        
        # If already in English or unknown, return as is
        return base_name
    
    def _extract_sections(self, content: str) -> Dict[str, str]:
        """Extract sections from intelligence brief based on markdown headers"""
        import re
        
        # Permissive section headers (## 1. NAME or ##NAME or ### NAME)
        # Supports various spacing and levels (though we favor ##)
        section_pattern = r'^#{2,3}\s*(?:\d+[\.\)]\s*)?(.+?)$'
        
        sections = {}
        current_section = None
        current_content = []
        
        lines = content.split('\n')
        
        for line in lines:
            match = re.match(section_pattern, line.strip())
            if match:
                # Save previous section
                if current_section:
                    sections[current_section] = '\n'.join(current_content).strip()
                
                # Start new section with normalized name
                raw_section_name = match.group(1).strip()
                current_section = self._normalize_section_name(raw_section_name)
                current_content = []
            elif current_section:
                current_content.append(line)
        
        # Save last section! (CRITICAL FIX)
        if current_section and current_content:
            sections[current_section] = '\n'.join(current_content).strip()
        
        return sections
    
    def _calculate_draft_diversity(self, drafts: List[str]) -> Dict:
        """Calculate diversity metrics for drafts"""
        from difflib import SequenceMatcher
        
        if len(drafts) < 2:
            return {
                "diversity_score": 0.0,
                "similarity_matrix": [[1.0]],
                "most_different_sections": [],
                "interpretation": "single_draft"
            }
        
        # Calculate pairwise similarities
        n = len(drafts)
        similarity_matrix = [[0.0] * n for _ in range(n)]
        
        for i in range(n):
            for j in range(n):
                if i == j:
                    similarity_matrix[i][j] = 1.0
                else:
                    ratio = SequenceMatcher(None, drafts[i], drafts[j]).ratio()
                    similarity_matrix[i][j] = round(ratio, 3)
        
        # Calculate average similarity (excluding diagonal)
        total_similarity = 0
        count = 0
        for i in range(n):
            for j in range(i + 1, n):
                total_similarity += similarity_matrix[i][j]
                count += 1
        
        avg_similarity = total_similarity / count if count > 0 else 0
        diversity_score = round(1 - avg_similarity, 3)
        
        # Analyze section-level differences
        most_different_sections = []
        try:
            # Extract sections from all drafts
            all_sections = [self._extract_sections(d) for d in drafts]
            
            # Find common section names
            common_sections = set(all_sections[0].keys())
            for sections in all_sections[1:]:
                common_sections &= set(sections.keys())
            
            # Calculate diversity per section
            section_diversity = {}
            for section_name in common_sections:
                section_contents = [s[section_name] for s in all_sections]
                section_similarities = []
                
                for i in range(len(section_contents)):
                    for j in range(i + 1, len(section_contents)):
                        sim = SequenceMatcher(None, section_contents[i], section_contents[j]).ratio()
                        section_similarities.append(sim)
                
                if section_similarities:
                    avg_sim = sum(section_similarities) / len(section_similarities)
                    section_diversity[section_name] = 1 - avg_sim
            
            # Get top 3 most different sections
            sorted_sections = sorted(section_diversity.items(), key=lambda x: x[1], reverse=True)
            most_different_sections = [s[0] for s in sorted_sections[:3]]
        except:
            # If section extraction fails, continue without section-level analysis
            pass
        
        # Interpretation
        if diversity_score < 0.15:
            interpretation = "very_similar"
        elif diversity_score < 0.40:
            interpretation = "moderate_diversity"
        else:
            interpretation = "high_diversity"
        
        return {
            "diversity_score": diversity_score,
            "similarity_matrix": similarity_matrix,
            "most_different_sections": most_different_sections,
            "interpretation": interpretation
        }


    def elaborate(self, selection: str, query: str, full_context: str = "", history: List[Dict[str, str]] = None) -> Dict:
        """Elaborate on a selected text based on user query"""
        if not selection:
            return {"error": "No text selected"}

        # Sanitize
        selection = self._sanitize_input(selection, 1000)
        query = self._sanitize_input(query, 500)
        full_context = self._sanitize_input(full_context, 5000) if full_context else ""
        
        # Format history
        history_text = ""
        if history:
            history_lines = []
            for msg in history:
                role = "User" if msg.get("role") == "user" else "AI"
                content = self._sanitize_input(msg.get("content", ""), 1000)
                history_lines.append(f"{role}: {content}")
            history_text = "\n".join(history_lines)

        prompt = f"""<role>
You are a SUBJECT MATTER EXPERT and ACADEMIC TUTOR.
</role>

<context>
The user is reading a summary and has highlighted a specific passage.
CONTEXT (Excerpts):
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
1. Directly answer the user's question regarding the selected text.
2. If previous conversation exists, maintain context.
3. If the user didn't ask a specific question, provide a comprehensive elaboration:
   - Define key terms/jargon used in the selection.
   - explain the implications or "why this matters".
   - Provide a concrete example if abstract.
4. Keep the tone analytical yet accessible (University level).
5. Output in Indonesian.
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
            
            end_time = time.time()
            duration = round(end_time - start_time, 2)
            
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
                "duration_seconds": duration
            }
        except Exception as e:
            return {"error": f"Elaboration failed: {str(e)}"}


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
        
        # Sanitize all inputs
        title = str(title).strip() if title else ""
        author = str(author).strip() if author else ""
        genre = str(genre).strip() if genre else "Unknown"
        year = str(year).strip() if year else "Unknown"
        context_description = str(context_description).strip() if context_description else ""
        source_note = str(source_note).strip() if source_note else "knowledge about this book"
        
        # Validate critical fields with informative error messages
        missing_fields = []
        if not title:
            missing_fields.append("title")
        if not author:
            missing_fields.append("author")
        
        if missing_fields:
            fields_str = " and ".join(missing_fields)
            raise BookSummarizerError(
                f"Missing required metadata: {fields_str}. "
                f"The verification source did not provide complete book information. "
                f"Please try verifying with different search terms or check if the book exists in multiple sources."
            )
        
        if mode == "judge" and drafts:
            # Validate drafts
            if not drafts or not any(drafts):
                raise BookSummarizerError("Valid drafts are required for judge mode")
            
            # Filter out empty drafts
            valid_drafts = [d.strip() for d in drafts if d and str(d).strip()]
            if not valid_drafts:
                raise BookSummarizerError("No valid drafts found for synthesis")
            
            drafts_formatted = "\n\n".join([
                f"═══ DRAFT {i+1} ═══\n{d}" 
                for i, d in enumerate(valid_drafts)
            ])
                
            return f"""<role>
You are a SENIOR LITERARY CRITIC and ACADEMIC EDITOR with expertise in:
- Structural text analysis
- Information density evaluation (Chain of Density methodology)
- Quality assurance for academic publications
</role>

<task>
Evaluate and synthesize {len(valid_drafts)} intelligence brief drafts for the book:
📚 "{title}" 
✍️  {author}
📅 {year}
🏷️  {genre}
</task>

<drafts>
{drafts_formatted}
</drafts>

<evaluation_framework>
Use the following rubric (1-10 scale for each draft):

1. FACTUAL ACCURACY (30% weight)
   - Consistency with general knowledge about the book
   - No fabricated claims
   - Year, publisher, historical context accuracy

2. INFORMATION DENSITY (35% weight)
   - Number of technical concepts per 100 words
   - Depth of analysis (superficial vs substantive)
   - Balanced abstraction/concrete ratio
   - Domain-specific terminology usage

3. STRUCTURAL COHERENCE (20% weight)
   - Logical flow between sections
   - Smooth transitions
   - Clear information hierarchy
   - Consistent formatting with template

4. LINGUISTIC PRECISION (15% weight)
   - Standard and precise Indonesian language
   - Syntactic variety (not repetitive)
   - Proper technical vocabulary usage
   - Word economy (not verbose)
</evaluation_framework>

<synthesis_instructions>
PROCESS:
1. Identify TOP 3 STRENGTHS from each draft
2. Identify 2 CRITICAL WEAKNESSES from each draft
3. Extract "best-of-breed" elements:
   - Best term definitions
   - Deepest analysis
   - Most concrete examples
   - Most representative quotes

4. Reconstruct final output:
   - Combine strongest elements
   - Eliminate redundancy
   - Fill information gaps
   - Optimize for readability
   - **IMPORTANT**: Use `[[number]]` syntax for all quantitative data derived from your analytical synthesis.

OUTPUT:
Generate ONLY the final brief in standard format (10 sections).
DO NOT include:
- Individual draft scoring
- Selection justification
- Meta-commentary
- Explicit cross-draft comparisons
</synthesis_instructions>

<constraints>
- Output in Indonesian language
- Ideal length: 800-1200 words
- Use bullet points only for Key Points (section 2)
- All other sections in prose paragraphs
</constraints>"""

        # Base summarization prompt with enhanced structure
        base_prompt = f"""<document_metadata>
Title         : {title}
Author        : {author}
Published Year: {year}
Genre/Category: {genre}
Data Source   : {source_note}
Description   : {context_description[:500] if context_description else "[Not available]"}
</document_metadata>

<role_definition>
You are a KNOWLEDGE SYNTHESIS ENGINE with capabilities in:
- Academic literature analysis (doctoral level)
- Information architecture design
- Technical writing & documentation
- Critical reasoning & argumentation analysis

You are NOT a content marketer or popular copywriter.
</role_definition>

<task_objective>
Transform book content into a STRUCTURED KNOWLEDGE ARTIFACT (Analytical Brief) with these characteristics:
✓ High information density (Chain of Density approach)
✓ Technical precision (not over-simplification)
✓ Logical architecture (not linear narrative)
✓ Actionable intelligence (not trivia)
</task_objective>

<data_precision_policy>
When composing the brief, you often need to derive or synthesize numbers (percentages, durations, comparisons) to illustrate a concept's impact.
SPECIAL RULES & ANALYTICAL NUANCES:
1. **Wrap all non-literal statistical coefficients with `[[ ]]`**. Use these brackets for numbers, r-values, or quantitative data that are the result of your synthesis, estimates, or analytical derivations (not literal quotes from text).
   - Example: "Reduces cognitive load by [[43%]]..." or "Strong correlation [[r=0.73]]..."
2. **Soften causal claims to correlational** in 2-3 sections of the brief. Use phrases like "correlates with", "closely associated with", or "shows association", rather than rigid direct causal claims. Just one phrase per section is sufficient.
3. **Use ILLUSTRATIVE RANGES for extreme numbers**. If mentioning very large or small numbers (e.g., "thousands of hours" or "millions of data points"), present as ranges (e.g., "[[10,000-15,000]] hours") to convey *order-of-magnitude* rather than absolute *point estimates*.
4. DO NOT use double brackets for static facts like publication year, names, or numbers explicitly stated in book metadata.
</data_precision_policy>

<critical_prohibitions>
🚫 STRICTLY FORBIDDEN:
1. Generic opening/closing sentences ("This book discusses...", "Overall...")
2. Promotional language/hyperbole ("very interesting", "must-read")
3. Subjective opinions without evidence ("in my opinion", "unfortunately")
4. Shallow generalizations ("important to understand", "relevant in modern times")
5. Repeating already mentioned information
6. Adding unverifiable facts from context
7. Using placeholders or TBD
</critical_prohibitions>

<output_structure>
**CRITICAL: USE THESE EXACT SECTION HEADERS**
You MUST use these EXACT section headers (copy-paste them exactly as shown):
- ## 1. EXECUTIVE ANALYTICAL BRIEF (Core Summary)
- ## 2. CORE THESIS & KEY ARGUMENTS (Key Points)
- ## 3. CONCEPTUAL ARCHITECTURE (Topic Structure)
- ## 4. GLOSSARY OF DENSITY (Technical Concepts & Terms)
- ## 5. REASONING BLUEPRINT (Logic Framework)
- ## 6. ACTIONABLE INTELLIGENCE & IMPLICATIONS
- ## 7. REPRESENTATIVE SYNTHESIS (Iconic Quote)
- ## 8. COMPARATIVE POSITIONING
- ## 9. IMPLEMENTATION ROADMAP
- ## 10. CRITICAL EVALUATION & LIMITATIONS

DO NOT translate, modify, or paraphrase these headers.
DO NOT use Indonesian translations like "GLOSARIUM DENSITAS" or "BLUEPRINT PENALARAN".
Use the ENGLISH headers exactly as shown above.

Follow EXACTLY these 10 sections. Cannot be added or reduced:

**IMPORTANT NOTE ABOUT FORMAT**:
- Separator lines (━━━) are only to help you understand structure in these instructions
- DO NOT display separator lines (━━━) in your final output
- Output only contains headings and content, without visual decorations

---

## 1. EXECUTIVE ANALYTICAL BRIEF (Core Summary)
ONE cohesive paragraph (150-200 words) that includes:

REQUIRED:
a) Central thesis / research question / core argument
b) Methodology / analytical framework / theoretical framework
c) Key findings (with quantitative data if available)
d) Unique contribution of this book to domain knowledge
e) Methodological limitations or caveats

WRITING STYLE:
- Complex sentences with subordinate clauses
- Technical terms (no need to explain here)
- Passive voice OK if more precise
- Avoid "this book" as sentence subject

BAD EXAMPLE:
"This book discusses the importance of communication in organizations..."

GOOD EXAMPLE:
"Through ethnographic analysis of 47 Fortune 500 organizations (2015-2019), the author identifies that internal communication effectiveness strongly correlates (r=0.73, p<0.01) with employee retention rates, especially in post-pandemic hybrid work contexts..."

---

## 2. CORE THESIS & KEY ARGUMENTS (Key Points)

4-6 bullet points. Each point is an ARGUMENT/FINDING, not a topic.

FORMAT:
• **[Claim/Finding]**: [Elaboration with evidence] → [Implications]

BAD EXAMPLE:
• The importance of data analysis

GOOD EXAMPLE:
• **Data visualization reduces cognitive load by 43% compared to numeric tables**: Eye-tracking experiments (n=312) show that decision time for comparison tasks decreased by an average of 8.2 seconds using heatmaps vs spreadsheets → Recommendation: prioritize visual dashboards for executive reporting

QUALITY CRITERIA:
- Contains concrete numbers/data (percentages, sample sizes, timeframes)
- Has practical or theoretical implications
- Not common knowledge or truisms
- Specific, not abstract

---

## 3. CONCEPTUAL ARCHITECTURE (Topic Structure)

Reconstruct the book's CONCEPTUAL ARCHITECTURE (not chapter listing).

Prose format (2-3 paragraphs) explaining:
- How the author structures arguments (inductive/deductive/dialectical?)
- Logical structure: foundation → development → synthesis
- Organization pattern: chronological? thematic? case-based?

EXAMPLE:
"The author builds arguments deductively, starting from grand theory (Part 1: Theoretical Foundations, reviewing Kahneman & Tversky) before applying to empirical cases (Parts 2-3: Industry Studies). Part 4 conducts systematic comparison using a 2x2 matrix framework. This structure reflects a theory-driven rather than exploratory induction approach."

AVOID:
- "Chapter 1 discusses X, Chapter 2 discusses Y..." (too literal)
- Only listing topics without explaining relationships

---

## 4. GLOSSARY OF DENSITY (Technical Concepts & Terms)

5-8 KEY terms that are UNIQUE or CENTRAL to this book.

Format:
**[Term]** (category): Operational definition [1-2 sentences] + relationship to other concepts in the book.

EXAMPLE:
**Bounded Rationality** (Cognitive Psychology): The concept that decision-makers operate with limited information, cognitive time, and processing capacity, resulting in "satisficing" (sufficient + satisfying) solutions rather than optimal solutions. In this book, it becomes the foundation for critique of Rational Choice Theory.

TERM SELECTION:
- Prioritize terms REDEFINED by the author
- Avoid extremely common terms (e.g., "data", "analysis")
- Focus on those OPERATIONALIZED in the book

---

## 5. REASONING BLUEPRINT (Logic Framework)

The book's reasoning structure in 3 components:

**A. Problem/Gap Identified**
[2-3 sentences: what's missing from existing literature/practice?]

**B. Methodology/Solution Proposed**
[2-3 sentences: author's approach to address the gap]

**C. Synthesis & Rational Conclusions**
[2-3 sentences: what was successfully proven/demonstrated?]

TIPS:
- Use connector words: "Consequently...", "Building on this...", "This leads to..."
- Maintain explicit causality
- Distinguish correlation vs causation

---

## 6. ACTIONABLE INTELLIGENCE & IMPLICATIONS

MAXIMUM 3 OPERATIONALIZABLE implication points.

Format:
**[Application Domain]**: [Specific insight] → [Action steps or research directions]

BAD EXAMPLE:
**Business**: Companies should pay more attention to data.

GOOD EXAMPLE:
**Corporate Strategy**: Allocate 15-20% of R&D budget to exploratory projects without immediate ROI metrics, adopting Google's "20% time" model → Mitigates innovation tunnel vision and encourages serendipitous discovery (per chapter 7 findings).

CRITERIA:
- Must have concrete numbers/targets OR specific practices
- Not platitudes or obvious advice
- Traceable to specific findings in the book

---

## 7. REPRESENTATIVE SYNTHESIS (Iconic Quote)

ONE quote that:
- Represents the core message
- Memorable & quotable
- Not an obvious statement

Format:
> "[Verbatim quote or paraphrase if no access to original text]"
> — [Author], *[Book Title]*, p. [X] (if known)

**Quote Analysis** (2-3 sentences):
Why is this quote significant? What makes it representative of the entire argument?

DON'T:
- Choose generic quotes
- Only copy-paste without analysis
- Fabricate quotes if uncertain

---

---

## 8. COMPARATIVE POSITIONING

Evaluate the book's position relative to the domain's landscape:
- **Direct Competitors**: Contrast with 1-2 other seminal works or authors.
- **Unique Selling Proposition (USP)**: What is the specific value not found elsewhere?
- **Intellectual Heritage**: Which school of thought does it build upon or challenge?

EXAMPLE:
"Unlike Sinek's 'Start with Why' (broad inspiration), this work provides granular operational metrics. It challenges the 'Lean Startup' consensus by advocating for deep-tech investment before market validation. Philosophically, it aligns with Neo-Institutionalism while diverging on agency theory."

---

## 9. IMPLEMENTATION ROADMAP

A 3-stage tactical application plan derived from the book:

**Phase 1: Diagnosis & Baseline (Weeks 1-4)**
[Actionable steps to assess current state using book's framework]

**Phase 2: Core Intervention (Month 2-6)**
[Main implementation steps and milestones]

**Phase 3: Sustainability & Optimization (Ongoing)**
[How to maintain gains and iterate]

CRITERIA:
- Must be practical, not "continue learning"
- Based on the book's specific methodology

---

## 10. CRITICAL EVALUATION & LIMITATIONS

A rigorous academic critique (not a "review"):
- **Analytical Gaps**: What specific scenarios or variables were ignored?
- **Methodological Constraints**: Sample size issues, geographical bias, or time-period limitations.
- **Logical Critical Points**: Identify any potential fallacies or circular reasonings.

EXAMPLE:
"The dataset relies heavily on Western industrial contexts (1995-2015), potentially limiting applicability in emerging digital economies. Centrally, the 'Hyper-Efficiency' model assumes perfect information flow, an assumption often violated in decentralized organizational structures. Further research is needed on low-trust environments."

DONT:
- Only list "good points"
- Be overly negative without evidence
- Be vague (e.g., "The book is too long")

STYLE: Telegraph style OK. Maximum density. No filler words.

EXAMPLE:
"Demonstrates systematic bias in expert predictions across domains (politics, economics, tech). Through 20-year longitudinal study (n=284 experts, 28k predictions), shows 'foxes' (integrative thinkers) outperform 'hedgehogs' (single-theory advocates) by 30% accuracy. Challenges credentialism. Implications: diversify advisory boards, weight recent track records > credentials."
</output_structure>

<quality_checklist>
Before submitting output, ensure:
☑ No sentences starting with "This book..." or "Buku ini..."
☑ Each section has substantive information (not boilerplate)
☑ At least 5 concrete data points (numbers, years, percentages)
☑ Every technical term used with precision
☑ No redundancy between sections
☑ All 10 sections complete (none skipped)
☑ Using `[[...]]` syntax for synthesized numbers (minimum 3 points)
☑ Consistent markdown formatting
☑ Total length 900-1300 words
☑ No meta-commentary ("Here is the summary...")
</quality_checklist>

<linguistic_guidelines>
INDONESIAN LANGUAGE:
- **IMPORTANT**: Write all body content and analysis in **Bahasa Indonesia**.
- Keep section headers (e.g., ## 1. EXECUTIVE ANALYTICAL BRIEF...) in **English** as specified in the <output_structure>.
- Formal-academic tone, avoid colloquialism.
- Use foreign terms if more precise (OK not to translate).
- Vary sentence structure (not monotonous).
- Word economy: prefer "menggunakan" > "melakukan penggunaan terhadap".

COHESION:
- Use transition devices: "Lebih lanjut...", "Sebaliknya...", "Berdasarkan hal ini..."
- Clear pronoun reference
- Explicit logical connectors
</linguistic_guidelines>"""

        if partial_content:
            base_prompt += f"""

<recovery_mode>
CONTINUE writing the Analytical Brief for the book "{title}".

**CURRENT STATE**:
The summary was interrupted. Below is the content generated so far:
---
{partial_content}
---

**INSTRUCTIONS FOR CONTINUATION**:
1. 🧠 ANALYZE the partial content above to identify which section was being written.
2. 🔄 RESUME immediately from the exact point of interruption.
3. ⏭️ SKIP all sections already present in the partial content.
4. 🎯 START from the next missing section or complete the current one.
5. 📝 MAINTAIN the same academic tone, technical density, and formatting.
6. 🚫 DO NOT repeat any content already provided above.

**CONTINUATION LOGIC**:
- If partial ends mid-Section 2 → complete Section 2, then continue to 3-10.
- If partial ends after Section 4 → start immediately from Section 5.
- If partial ends mid-sentence → complete that specific sentence first.

START CONTINUATION NOW ↓
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