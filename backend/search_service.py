import requests
import time
import re
from typing import Dict, List, Optional, Tuple
from threading import Lock


# List of domains to exclude from search results to ensure relevance
EXCLUDED_DOMAINS = [
    "gramedia.com",
    "play.google.com",
    "tokopedia.com",
    "shopee.co.id",
    "bukalapak.com",
    "blibli.com",
    "lazada.co.id",
    "deepublishstore.com",
    "goodreads.com",
    "wordpress.com",
    "blogspot.com",
    "medium.com",
    "scribd.com",
    "academia.edu"  # Sometimes good, but often noisy; can be removed if specific papers are needed
]

# Keywords to append to queries to find informative content
RELEVANCE_KEYWORDS = [
    "review",
    "analisis",
    "bedah buku",
    "sinopsis",
    "summary",
    "inti sari"
]


class BraveSearchClient:
    """Client for Brave Search API integration"""
    
    def __init__(self, api_key: Optional[str] = None, timeout: int = 10):
        self.api_key = api_key
        self.timeout = timeout
        self.base_url = "https://api.search.brave.com/res/v1/web/search"
        self._lock = Lock()
    
    def search(self, query: str, count: int = 5) -> Dict:
        """
        Search using Brave Search API
        
        Args:
            query: Search query string
            count: Number of results to return (max 20)
            
        Returns:
            Dict with search results or error
        """
        if not self.api_key:
            return {"error": "Brave API key not configured", "results": []}
        
        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": self.api_key
        }
        
        params = {
            "q": query,
            "count": min(count, 20)  # Max 20 per API docs
        }
        
        try:
            with self._lock:
                response = requests.get(
                    self.base_url,
                    headers=headers,
                    params=params,
                    timeout=self.timeout
                )
            
            if response.status_code == 200:
                data = response.json()
                results = []
                
                # Extract web results
                for item in data.get("web", {}).get("results", []):
                    results.append({
                        "title": item.get("title", ""),
                        "snippet": item.get("description", ""),
                        "url": item.get("url", ""),
                        "relevance_score": 1.0  # Brave doesn't provide scores
                    })
                
                return {
                    "results": results,
                    "total": len(results),
                    "query": query
                }
            
            elif response.status_code == 401:
                return {"error": "Invalid Brave API key", "results": []}
            elif response.status_code == 429:
                return {"error": "Rate limit exceeded", "results": []}
            else:
                return {"error": f"API error: {response.status_code}", "results": []}
                
        except requests.exceptions.Timeout:
            return {"error": "Search timeout", "results": []}
        except Exception as e:
            return {"error": f"Search failed: {str(e)}", "results": []}


class WikipediaSearchClient:
    """Client for Wikipedia API integration"""
    
    def __init__(self, timeout: int = 10):
        self.timeout = timeout
        self.base_url = "https://{lang}.wikipedia.org/w/api.php"
        self._lock = Lock()
    
    def search(self, query: str, lang: str = "id") -> Dict:
        """
        Search Wikipedia and get article summary
        
        Args:
            query: Search query (book title or author)
            lang: Language code (id=Indonesian, en=English)
            
        Returns:
            Dict with summary and URL or error
        """
        # Try Indonesian first, then English as fallback
        languages = [lang, "en"] if lang == "id" else ["en"]
        
        for current_lang in languages:
            result = self._search_lang(query, current_lang)
            if result and not result.get("error"):
                return result
        
        return {"error": "No Wikipedia article found", "summary": "", "url": ""}
    
    def _search_lang(self, query: str, lang: str) -> Optional[Dict]:
        """Search Wikipedia in specific language"""
        url = self.base_url.format(lang=lang)
        
        # First, search for the page
        search_params = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "format": "json",
            "srlimit": 1
        }
        
        try:
            with self._lock:
                response = requests.get(url, params=search_params, timeout=self.timeout)
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            search_results = data.get("query", {}).get("search", [])
            
            if not search_results:
                return None
            
            # Get the page title
            page_title = search_results[0].get("title")
            
            # Get the extract (summary)
            extract_params = {
                "action": "query",
                "prop": "extracts|info",
                "exintro": True,
                "explaintext": True,
                "titles": page_title,
                "format": "json",
                "inprop": "url"
            }
            
            with self._lock:
                extract_response = requests.get(url, params=extract_params, timeout=self.timeout)
            
            if extract_response.status_code != 200:
                return None
            
            extract_data = extract_response.json()
            pages = extract_data.get("query", {}).get("pages", {})
            
            if not pages:
                return None
            
            # Get first page
            page = next(iter(pages.values()))
            summary = page.get("extract", "")
            page_url = page.get("fullurl", "")
            
            if summary:
                return {
                    "summary": summary[:1000],  # Limit to 1000 chars
                    "url": page_url,
                    "title": page_title,
                    "language": lang
                }
            
            return None
            
        except requests.exceptions.Timeout:
            return {"error": "Wikipedia timeout"}
        except Exception as e:
            return {"error": f"Wikipedia search failed: {str(e)}"}


class SearchAggregator:
    """Aggregates search results from multiple sources"""
    
    def __init__(self, brave_api_key: Optional[str] = None, 
                 enable_brave: bool = True,
                 enable_wikipedia: bool = True,
                 max_results: int = 5,
                 timeout: int = 10):
        self.brave_client = BraveSearchClient(brave_api_key, timeout) if enable_brave else None
        self.wiki_client = WikipediaSearchClient(timeout) if enable_wikipedia else None
        self.max_results = max_results
    
    def search(self, title: str, author: str, genre: str = "", relevance_evaluator: Optional[callable] = None) -> Dict:
        """
        Aggregate search results from all enabled sources with iterative refinement
        
        Args:
            title: Book title
            author: Book author
            genre: Book genre (optional, for better context)
            relevance_evaluator: Async callback function(results, book_info) -> List[bool]
            
        Returns:
            Aggregated search results with metadata
        """
        start_time = time.time()
        results = {
            "brave_results": [],
            "wikipedia_summary": "",
            "wikipedia_url": "",
            "search_metadata": {
                "total_sources": 0,
                "search_duration_ms": 0,
                "queries_used": 0,
                "iterations": 0,
                "errors": []
            }
        }
        
        book_info = {"title": title, "author": author, "genre": genre}
        informative_results = []
        max_iterations = 2
        min_informative_needed = 3
        
        # 1. Wikipedia Search (Single attempt)
        if self.wiki_client:
            wiki_result = self.wiki_client.search(title, lang="id")
            results["search_metadata"]["queries_used"] += 1
            if "error" in wiki_result:
                wiki_result = self.wiki_client.search(author, lang="id")
                results["search_metadata"]["queries_used"] += 1
            
            if "error" not in wiki_result and wiki_result.get("summary"):
                results["wikipedia_summary"] = wiki_result.get("summary", "")
                results["wikipedia_url"] = wiki_result.get("url", "")
                results["search_metadata"]["total_sources"] += 1

        # 2. Iterative Brave Search
        current_iteration = 0
        seen_urls = set()
        
        # Define search phases with academic and global focus
        search_phases = [
            # Phase 1: High-level scholarly/academic search (Bilingual)
            {
                "relevance_term": '(historiography OR "critical review" OR "scholarly analysis" OR "analisis akademik" OR "edisi kritis")',
                "desc": "Scholarly/Historiographical search"
            },
            # Phase 2: Targeted deep-dive into research/journals
            {
                "relevance_term": '("journal article" OR "research paper" OR "academic publisher" OR "peer-reviewed")',
                "desc": "Academic peer-review search"
            }
        ]

        while current_iteration < max_iterations and len(informative_results) < min_informative_needed:
            phase = search_phases[current_iteration]
            results["search_metadata"]["iterations"] += 1
            
            # Construct Query - SIMPLIFIED to avoid 422 errors
            base_query = f'"{title}" {author}'
            
            # Simplify exclusion - only exclude most problematic domains
            critical_excludes = ["gramedia.com", "tokopedia.com", "shopee.co.id", "goodreads.com"]
            exclusion_query = " ".join([f"-site:{domain}" for domain in critical_excludes])
            
            # Simplified relevance term - avoid complex boolean operators that cause 422
            simple_relevance = "review OR analysis OR summary"
            
            brave_query = f"{base_query} {simple_relevance} {exclusion_query}"
            
            print(f"[SEARCH_DEBUG] Iteration {current_iteration + 1} query: {brave_query[:100]}...")
            
            # Perform Search
            if self.brave_client and self.brave_client.api_key:
                brave_res = self.brave_client.search(brave_query, self.max_results)
                results["search_metadata"]["queries_used"] += 1
                
                if "error" in brave_res:
                    error_msg = f"Brave (Iter {current_iteration+1}): {brave_res['error']}"
                    results["search_metadata"]["errors"].append(error_msg)
                    print(f"[SEARCH_ERROR] {error_msg}")
                    
                    # If rate limit or auth error, stop trying
                    if "Rate limit" in brave_res['error'] or "Invalid" in brave_res['error']:
                        print(f"[SEARCH_ERROR] Critical error, stopping search iterations")
                        break
                else:
                    new_results = []
                    for r in brave_res.get("results", []):
                        if r['url'] not in seen_urls:
                            # Pre-filter by domain as well (manual check just in case API missed it)
                            is_excluded = any(domain in r['url'].lower() for domain in EXCLUDED_DOMAINS)
                            if not is_excluded:
                                new_results.append(r)
                                seen_urls.add(r['url'])
                    
                    if new_results:
                        if relevance_evaluator:
                            # Evaluate relevance using AI callback
                            try:
                                # relevance_evaluator returns a list of labels ("scholarly", "general", "shallow")
                                relevance_labels = relevance_evaluator(new_results, book_info)
                                for idx, label in enumerate(relevance_labels):
                                    if label in ["scholarly", "general"]:
                                        res_to_add = new_results[idx]
                                        res_to_add['quality_label'] = label
                                        informative_results.append(res_to_add)
                            except Exception as e:
                                results["search_metadata"]["errors"].append(f"AI Eval failed: {e}")
                                # Fallback: take all non-excluded results if AI fails
                                informative_results.extend(new_results)
                        else:
                            informative_results.extend(new_results)
            
            current_iteration += 1
            if len(informative_results) >= min_informative_needed:
                break
                
        results["brave_results"] = informative_results[:self.max_results]
        results["search_metadata"]["total_sources"] += len(results["brave_results"])

        # Calculate duration
        duration_ms = int((time.time() - start_time) * 1000)
        results["search_metadata"]["search_duration_ms"] = duration_ms
        
        return results
    
    def format_for_prompt(self, search_results: Dict) -> str:
        """
        Format search results for inclusion in AI prompt
        
        Args:
            search_results: Results from search() method
            
        Returns:
            Formatted string for prompt injection
        """
        if not search_results or search_results["search_metadata"]["total_sources"] == 0:
            return ""
        
        sections = []
        
        # Wikipedia section
        if search_results.get("wikipedia_summary"):
            sections.append(f"""<wikipedia_context>
{search_results['wikipedia_summary']}
Reference: Wikipedia [High Weight]
</wikipedia_context>""")
        
        # Brave/Web results section
        if search_results.get("brave_results"):
            web_sources = []
            for idx, result in enumerate(search_results["brave_results"][:5], 1):
                # Extract domain name for cleaner reference
                match = re.search(r'https?://(?:www\.)?([^/]+)', result['url'])
                domain = match.group(1) if match else result['url']
                
                label = result.get('quality_label', 'general').upper()
                
                web_sources.append(
                    f"{idx}. **{result['title']}**\n   {result['snippet']}\n   Reference: {domain} [Quality: {label}]"
                )
            
            if web_sources:
                sections.append(f"""<web_search_results>
{chr(10).join(web_sources)}
</web_search_results>""")
        
        if not sections:
            return ""
        
        return f"""
<external_context>
The following external information was found about this book through web search and Wikipedia.
Use this to enrich your analysis, verify facts, and provide additional context.

{chr(10).join(sections)}
</external_context>
"""


# Convenience function for easy import
def create_search_aggregator(config: Dict) -> Optional[SearchAggregator]:
    """
    Create SearchAggregator from config dictionary
    
    Args:
        config: Configuration dict with keys:
            - brave_api_key: Optional[str]
            - enable_search_enrichment: bool
            - search_max_results: int
            - search_timeout: int
            
    Returns:
        SearchAggregator instance or None if disabled
    """
    if not config.get("enable_search_enrichment", False):
        return None
    
    return SearchAggregator(
        brave_api_key=config.get("brave_api_key"),
        enable_brave=bool(config.get("brave_api_key")),
        enable_wikipedia=True,  # Wikipedia doesn't need API key
        max_results=config.get("search_max_results", 5),
        timeout=config.get("search_timeout", 10)
    )
