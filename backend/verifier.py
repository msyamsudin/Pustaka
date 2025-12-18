import requests
from typing import Dict, Optional, List, Tuple

class BookVerifier:
    def __init__(self):
        self.google_books_url = "https://www.googleapis.com/books/v1/volumes"
        self.open_library_url = "https://openlibrary.org/search.json"

    def check_google_books(self, isbn: str = None, title: str = None, author: str = None) -> Optional[Dict]:
        """
        Check for book existence in Google Books API.
        """
        params = {}
        query_parts = []
        if isbn:
            query_parts.append(f"isbn:{isbn}")
        if title:
            query_parts.append(f"intitle:{title}")
        if author:
            query_parts.append(f"inauthor:{author}")
        
        if not query_parts:
            return None

        params["q"] = "+".join(query_parts)
        params["maxResults"] = 1
        
        try:
            response = requests.get(self.google_books_url, params=params)
            if response.status_code == 200:
                data = response.json()
                if "items" in data and len(data["items"]) > 0:
                    book_info = data["items"][0]["volumeInfo"]
                    return {
                        "source": "Google Books",
                        "title": book_info.get("title"),
                        "authors": book_info.get("authors", []),
                        "isbn": self._extract_isbn_google(book_info.get("industryIdentifiers", [])),
                        "publishedDate": book_info.get("publishedDate"),
                        "description": book_info.get("description", ""),
                        "image_url": book_info.get("imageLinks", {}).get("thumbnail", "").replace("http://", "https://")
                    }
        except Exception as e:
            print(f"Error checking Google Books: {e}")
        return None

    def check_open_library(self, isbn: str = None, title: str = None, author: str = None) -> Optional[Dict]:
        """
        Check for book existence in OpenLibrary API.
        """
        params = {}
        query_parts = []
        if isbn:
            query_parts.append(f"isbn:{isbn}") # OpenLibrary supports direct q=isbn:xxx or explicit fields
            params["isbn"] = isbn
        if title:
            params["title"] = title
            query_parts.append(title)
        if author:
            params["author"] = author
            query_parts.append(author)

        if not params and not query_parts:
            return None
            
        # Using the search API for broader matching if generic fields provided
        # If ISBN is strictly provided, we can search by that.
        
        try:
            response = requests.get(self.open_library_url, params=params)
            if response.status_code == 200:
                data = response.json()
                if "docs" in data and len(data["docs"]) > 0:
                    book_info = data["docs"][0]
                    return {
                        "source": "OpenLibrary",
                        "title": book_info.get("title"),
                        "authors": book_info.get("author_name", []),
                        "isbn": book_info.get("isbn", [""])[0], # Just take first
                        "publishedDate": book_info.get("first_publish_year"),
                        "description": "", # Search API rarely gives full desc.
                        "image_url": f"https://covers.openlibrary.org/b/id/{book_info.get('cover_i')}-L.jpg" if book_info.get('cover_i') else ""
                    }
        except Exception as e:
            print(f"Error checking Open Library: {e}")
        return None

    def _extract_isbn_google(self, identifiers) -> str:
        for ident in identifiers:
            if ident["type"] in ["ISBN_13", "ISBN_10"]:
                return ident["identifier"]
        return ""

    def validate_book(self, isbn: str = "", title: str = "", author: str = "") -> Tuple[bool, List[Dict], str]:
        """
        Validates book existence using multiple sources.
        Checks local storage and cache first, then external APIs.
        Returns: (is_verified, info_sources, message)
        """
        from storage_manager import StorageManager
        from cache_manager import CacheManager
        
        storage_manager = StorageManager()
        cache_manager = CacheManager()
        
        # 1. Check Saved Library (StorageManager)
        saved_books = storage_manager.get_all_summaries()
        target_isbn = isbn.strip().replace('-', '') if isbn else None
        target_title = title.strip().lower() if title else None
        target_author = author.strip().lower() if author else None

        for book in saved_books:
            match = False
            if target_isbn and book.get('isbn'):
                if target_isbn == book['isbn'].replace('-', ''):
                    match = True
            elif target_title and target_author:
                if book['title'].lower() == target_title and book['author'].lower() == target_author:
                    match = True
            
            if match:
                cached_source = {
                    "source": "Pustaka (Tersimpan)",
                    "title": book['title'],
                    "authors": [book['author']],
                    "isbn": book.get('isbn', ''),
                    "image_url": book.get('image_url', ''),
                    "description": "Buku ini sudah ada di perpustakaan Anda."
                }
                return True, [cached_source], "Verifikasi Berhasil (Ditemukan di Perpustakaan)"

        # 2. Check Verification Cache (CacheManager)
        cached_book = cache_manager.get_cached_book(isbn, title, author)
        if cached_book:
            # Wrap in source format
            cached_source = cached_book.copy()
            cached_source["source"] = f"{cached_book.get('source', 'Sesi Sebelumnya')} (Cached)"
            return True, [cached_source], "Verifikasi Berhasil (Ditemukan di Cache)"

        # 3. External API Calls
        sources = []
        
        gb_data = self.check_google_books(isbn, title, author)
        if gb_data:
            sources.append(gb_data)
            
        ol_data = self.check_open_library(isbn, title, author)
        if ol_data:
            sources.append(ol_data)
            
        # Verification Logic
        if len(sources) >= 2:
            # Cache the first successful result
            cache_manager.save_to_cache(sources[0])
            return True, sources, "Verifikasi Berhasil (2+ Sumber)"
        elif len(sources) == 1:
            # Also cache partial results for speed next time
            cache_manager.save_to_cache(sources[0])
            return False, sources, "Verifikasi Parsial (1 Sumber)"
        else:
            return False, [], "Tidak Ditemukan di Sumber Manapun"

    def search_book_covers(self, query: str) -> List[Dict]:
        """
        Searches for books loosely to find cover images.
        Returns list of {url, source, title, author}
        """
        results = []
        
        # 1. Google Books
        try:
            params = {"q": query, "maxResults": 5}
            response = requests.get(self.google_books_url, params=params)
            if response.status_code == 200:
                data = response.json()
                for item in data.get("items", []):
                    info = item.get("volumeInfo", {})
                    thumb = info.get("imageLinks", {}).get("thumbnail")
                    if thumb:
                        results.append({
                            "url": thumb.replace("http://", "https://"),
                            "source": "Google Books",
                            "title": info.get("title", "Unknown"),
                            "author": ", ".join(info.get("authors", []))
                        })
        except Exception as e:
            print(f"Error searching covers in Google Books: {e}")

        # 2. Open Library
        try:
            params = {"q": query, "limit": 5}
            response = requests.get(self.open_library_url, params=params)
            if response.status_code == 200:
                data = response.json()
                for item in data.get("docs", []):
                    cover_i = item.get("cover_i")
                    if cover_i:
                        results.append({
                            "url": f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg",
                            "source": "OpenLibrary",
                            "title": item.get("title", "Unknown"),
                            "author": ", ".join(item.get("author_name", []))
                        })
        except Exception as e:
             print(f"Error searching covers in Open Library: {e}")
             
        return results
