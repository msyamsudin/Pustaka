import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Optional

import requests
import shutil
from pathlib import Path

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data', 'saved_summaries.json')
COVERS_DIR = os.path.join(os.path.dirname(__file__), 'covers')

class StorageManager:
    def __init__(self):
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        os.makedirs(COVERS_DIR, exist_ok=True)
        if not os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump([], f)

    def _load_data(self) -> List[Dict]:
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return self._migrate_if_needed(data)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _migrate_if_needed(self, data: List[Dict]) -> List[Dict]:
        """
        Migrate old flat summary list to new Book-grouped structure.
        Old: [{id, title, author, summary_content, ...}, ...]
        New: [{id, title, author, isbn, summaries: [{id, content, ...}]}, ...]
        """
        if not data:
            return []
        
        # Check if already migrated (check for 'summaries' list in first item)
        if 'summaries' in data[0]:
            return data

        print("Migrating old data schema to Grouped Books...")
        grouped_books = {}
        
        for item in data:
            # Create a unique key for the book
            isbn = item.get('metadata', {}).get('isbn', '')
            title = item.get('title', 'Unknown').strip()
            author = item.get('author', 'Unknown').strip()
            
            # Simple aggregation key: ISBN if present, else Title+Author
            key = isbn if isbn else f"{title}|{author}"
            
            if key not in grouped_books:
                grouped_books[key] = {
                    "id": str(uuid.uuid4()),
                    "title": title,
                    "author": author,
                    "isbn": isbn,
                    "created_at": item.get('timestamp'),
                    "last_updated": item.get('timestamp'),
                    "summaries": []
                }
            
            # Create summary variant
            variant = {
                "id": item['id'],
                "summary_content": item.get('summary_content', ''),
                "notes": item.get('notes', []), # Support notes field
                "usage_stats": item.get('usage_stats', {}),
                "metadata": item.get('metadata', {}),
                "timestamp": item.get('timestamp'),
                "provider": item.get('usage_stats', {}).get('provider', 'Unknown'),
                "model": item.get('usage_stats', {}).get('model', 'Unknown')
            }
            grouped_books[key]['summaries'].append(variant)
            
            # Update last_updated if this summary is newer
            if item.get('timestamp') > grouped_books[key]['last_updated']:
                 grouped_books[key]['last_updated'] = item.get('timestamp')

        new_data = list(grouped_books.values())
        # Sort books by last_updated descending
        new_data.sort(key=lambda x: x['last_updated'], reverse=True)
        
        self._save_data(new_data)
        return new_data

    def _save_data(self, data: List[Dict]):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _download_cover(self, url: str, book_id: str) -> str:
        """
        Downloads cover from URL and saves to covers/book_id.jpg.
        Returns the relative path 'covers/book_id.jpg' or original URL if failed.
        """
        if not url or not url.startswith('http'):
            return url

        try:
            response = requests.get(url, stream=True, timeout=10)
            if response.status_code == 200:
                # Create a safe filename usually based on book ID
                filename = f"{book_id}.jpg"
                file_path = os.path.join(COVERS_DIR, filename)
                
                with open(file_path, 'wb') as f:
                    response.raw.decode_content = True
                    shutil.copyfileobj(response.raw, f)
                
                return f"covers/{filename}"
        except Exception as e:
            print(f"Failed to download cover from {url}: {e}")
            
        return url

    def save_summary(self, summary_data: Dict) -> Dict:
        """
        Saves a summary. Groups by ISBN or Title+Author.
        Returns the summary variant object (with its ID).
        """
        data = self._load_data()
        
        isbn = summary_data.get('metadata', {}).get('isbn', '')
        title = summary_data['title'].strip()
        author = summary_data['author'].strip()
        genre = summary_data.get('metadata', {}).get('genre', '')
        published_date = summary_data.get('metadata', {}).get('publishedDate', '')
        
        target_book = None
        
        # 1. Try to find existing book
        for book in data:
            # Check ISBN match if valid
            if isbn and book.get('isbn') == isbn:
                target_book = book
                break
            # Check Title + Author match (case-insensitive for better UX)
            if (not isbn and 
                book['title'].lower() == title.lower() and 
                book['author'].lower() == author.lower()):
                target_book = book
                break
        
        timestamp = datetime.now().isoformat()
        variant_id = str(uuid.uuid4())
        
        new_variant = {
            "id": variant_id,
            "summary_content": summary_data['summary_content'],
            "notes": [], # Initialize empty notes
            "usage_stats": summary_data.get('usage_stats', {}),
            "metadata": summary_data.get('metadata', {}),
            "timestamp": timestamp,
            "provider": summary_data.get('usage_stats', {}).get('provider', 'Unknown'),
            "model": summary_data.get('usage_stats', {}).get('model', 'Unknown')
        }

        if target_book:
            # Append to existing
            target_book['summaries'].insert(0, new_variant)
            target_book['last_updated'] = timestamp
            # Update metadata if missing
            if not target_book.get('isbn') and isbn:
                target_book['isbn'] = isbn
            if not target_book.get('genre') and genre:
                target_book['genre'] = genre
            if not target_book.get('publishedDate') and published_date:
                target_book['publishedDate'] = published_date
            # Update cover if missing
            if not target_book.get('image_url'):
                 raw_url = summary_data.get('metadata', {}).get('image_url', '')
                 target_book['image_url'] = self._download_cover(raw_url, target_book['id'])
        else:
            # Create new book
            book_id = str(uuid.uuid4())
            raw_url = summary_data.get('metadata', {}).get('image_url', '')
            local_image_path = self._download_cover(raw_url, book_id)
            
            target_book = {
                "id": book_id,
                "title": title,
                "author": author,
                "genre": genre,
                "publishedDate": published_date,
                "isbn": isbn,
                "image_url": local_image_path,
                "created_at": timestamp,
                "last_updated": timestamp,
                "summaries": [new_variant]
            }
            data.insert(0, target_book)

        # Sort books by recency
        data.sort(key=lambda x: x['last_updated'], reverse=True)
        self._save_data(data)
        
        return new_variant

    def get_all_summaries(self) -> List[Dict]:
        """Returns list of Books, each containing list of summaries."""
        return self._load_data()

    def update_book_cover(self, book_id: str, new_url: str) -> Optional[str]:
        """
        Updates the cover for a specific book. Downloads the new image.
        Returns the new local path.
        """
        data = self._load_data()
        for book in data:
            if book['id'] == book_id:
                # Download new cover
                local_path = self._download_cover(new_url, book_id)
                book['image_url'] = local_path
                book['last_updated'] = datetime.now().isoformat()
                self._save_data(data)
                return local_path
        return None

    def update_book_metadata(self, book_id: str, title: str, author: str, isbn: str, genre: str = None) -> Optional[Dict]:
        """Updates basic metadata for a book."""
        data = self._load_data()
        book = next((b for b in data if b['id'] == book_id), None)
        
        if not book:
            return None
            
        book['title'] = title
        book['author'] = author
        book['isbn'] = isbn
        if genre is not None:
            book['genre'] = genre
        book['last_updated'] = datetime.now().isoformat()
        
        self._save_data(data)
        return book

    def delete_summary(self, summary_id: str) -> bool:
        """
        Deletes a specific summary variant.
        If a book has no summaries left, deletes the book too.
        """
        data = self._load_data()
        found = False
        
        for book in data:
            original_count = len(book['summaries'])
            book['summaries'] = [s for s in book['summaries'] if s['id'] != summary_id]
            
            if len(book['summaries']) < original_count:
                found = True
                # Update last_updated if needed, or leave it
                break
        
        if found:
            # Remove empty books
            data = [b for b in data if len(b['summaries']) > 0]
            self._save_data(data)
            return True
            
        return False

    def delete_book(self, book_id: str) -> bool:
        """Deletes an entire book and all its summaries."""
        data = self._load_data()
        initial_len = len(data)
        data = [b for b in data if b['id'] != book_id]
        
        if len(data) < initial_len:
            self._save_data(data)
            return True
        return False
    def update_summary_content(self, summary_id: str, new_content: str) -> bool:
        """Updates the content of a specific summary variant."""
        data = self._load_data()
        found = False
        
        for book in data:
            for variant in book['summaries']:
                if variant['id'] == summary_id:
                    variant['summary_content'] = new_content
                    variant['timestamp'] = datetime.now().isoformat() # Update variant timestamp
                    book['last_updated'] = datetime.now().isoformat() # Update book timestamp
                    found = True
                    break
            if found:
                break
        
    def add_note_to_summary(self, summary_id: str, note_data: Dict) -> Optional[Dict]:
        """Appends a note to a specific summary variant."""
        data = self._load_data()
        found_variant = None
        
        for book in data:
            for variant in book['summaries']:
                if variant['id'] == summary_id:
                    if 'notes' not in variant:
                        variant['notes'] = []
                    
                    # Ensure note has an ID and timestamp
                    if 'id' not in note_data:
                        note_data['id'] = str(uuid.uuid4())
                    if 'timestamp' not in note_data:
                        note_data['timestamp'] = datetime.now().isoformat()
                        
                    variant['notes'].append(note_data)
                    book['last_updated'] = datetime.now().isoformat()
                    found_variant = variant
                    break
            if found_variant:
                break
        
        if found_variant:
            data.sort(key=lambda x: x['last_updated'], reverse=True)
            self._save_data(data)
            return note_data
            
        return None
    def update_note_in_summary(self, summary_id: str, note_id: str, note_data: Dict) -> Optional[Dict]:
        """Updates an existing note in a specific summary variant."""
        data = self._load_data()
        found_note = None
        
        for book in data:
            for variant in book['summaries']:
                if variant['id'] == summary_id:
                    if 'notes' in variant:
                        for i, note in enumerate(variant['notes']):
                            if note.get('id') == note_id:
                                # Update fields
                                for key, value in note_data.items():
                                    note[key] = value
                                note['timestamp'] = datetime.now().isoformat()
                                found_note = note
                                break
                    if found_note:
                        book['last_updated'] = datetime.now().isoformat()
                        break
            if found_note:
                break
        
        if found_note:
            data.sort(key=lambda x: x['last_updated'], reverse=True)
            self._save_data(data)
            return found_note
            
        return None
    def delete_note_from_summary(self, summary_id: str, note_id: str) -> bool:
        """Removes a specific note from a summary variant."""
        data = self._load_data()
        found = False
        
        for book in data:
            for variant in book['summaries']:
                if variant['id'] == summary_id:
                    if 'notes' in variant:
                        original_count = len(variant['notes'])
                        variant['notes'] = [n for n in variant['notes'] if n.get('id') != note_id]
                        if len(variant['notes']) < original_count:
                            found = True
                            book['last_updated'] = datetime.now().isoformat()
                            break
            if found:
                break
        
        if found:
            self._save_data(data)
            return True
            
        return False
