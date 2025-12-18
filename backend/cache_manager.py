import json
import os
from typing import List, Dict, Optional
from datetime import datetime

CACHE_FILE = os.path.join(os.path.dirname(__file__), 'data', 'verified_cache.json')

class CacheManager:
    def __init__(self):
        self._ensure_cache_dir()

    def _ensure_cache_dir(self):
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        if not os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump([], f)

    def _load_cache(self) -> List[Dict]:
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_cache(self, data: List[Dict]):
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def get_cached_book(self, isbn: str = None, title: str = None, author: str = None) -> Optional[Dict]:
        cache = self._load_cache()
        
        # Clean inputs
        clean_isbn = isbn.strip().replace('-', '') if isbn else None
        clean_title = title.strip().lower() if title else None
        clean_author = author.strip().lower() if author else None

        for book in cache:
            # Match by ISBN
            if clean_isbn and book.get('isbn'):
                cached_isbn = book['isbn'].replace('-', '')
                if clean_isbn == cached_isbn:
                    return book
            
            # Match by Title + Author
            if clean_title and clean_author:
                cached_title = book.get('title', '').lower()
                cached_author = (book.get('authors', [])[0] if book.get('authors') else '').lower()
                if clean_title == cached_title and clean_author == cached_author:
                    return book
                    
        return None

    def save_to_cache(self, book_data: Dict):
        cache = self._load_cache()
        
        # Check if already exists to avoid duplicates
        isbn = book_data.get('isbn')
        title = book_data.get('title')
        author = book_data.get('authors', [None])[0] if book_data.get('authors') else None
        
        if self.get_cached_book(isbn, title, author):
            return

        # Add timestamp
        book_data['cached_at'] = datetime.now().isoformat()
        cache.insert(0, book_data)
        
        # Limit cache size to 1000 entries
        if len(cache) > 1000:
            cache = cache[:1000]
            
        self._save_cache(cache)
