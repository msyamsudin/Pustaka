
import requests
import json
import os
import sys

# Add backend directory to sys.path to import modules
sys.path.append("d:/04_SOFTWARE/Script/06_GITHUB/Focus/Perpustakaan/backend")

from storage_manager import StorageManager
from verifier import BookVerifier

def test_download_cover():
    print("Testing _download_cover...")
    sm = StorageManager()
    # Test valid image
    test_url = "https://covers.openlibrary.org/b/id/8311266-S.jpg"
    test_id = "test_download_id"
    
    result = sm._download_cover(test_url, test_id)
    print(f"Download result: {result}")
    
    # Check file existence
    covers_dir = os.path.join("d:/04_SOFTWARE/Script/06_GITHUB/Focus/Perpustakaan/backend/covers")
    expected_full_path = os.path.join(covers_dir, f"{test_id}.jpg")
    
    if os.path.exists(expected_full_path):
        print("PASS: Image file created.")
    else:
        print(f"FAIL: Image file not found at {expected_full_path}")

def test_search_covers():
    print("\nTesting search_book_covers...")
    verifier = BookVerifier()
    results = verifier.search_book_covers("Clean Code")
    print(f"Found {len(results)} results.")
    if len(results) > 0:
        print("PASS: Search returned results.")
        print(f"Sample: {results[0]}")
    else:
        print("FAIL: No results found for 'Clean Code'.")

def test_api_endpoints():
    print("\nTesting API Endpoints (Requires backend running on localhost:8000)...")
    try:
        # Test Search
        resp = requests.get("http://127.0.0.1:8000/api/covers/search?query=Refactoring")
        if resp.status_code == 200:
            print(f"PASS: /api/covers/search status 200. Results: {len(resp.json())}")
        else:
            print(f"FAIL: /api/covers/search returned {resp.status_code}")
            
        # Test Static File Serve (assuming test_download_cover ran first)
        resp = requests.get("http://127.0.0.1:8000/covers/test_download_id.jpg")
        if resp.status_code == 200:
             print("PASS: /covers/test_download_id.jpg served.")
        else:
             print(f"FAIL: /covers/test_download_id.jpg returned {resp.status_code}")
             
    except Exception as e:
        print(f"FAIL: API connection error: {e}")

if __name__ == "__main__":
    test_download_cover()
    test_search_covers()
    test_api_endpoints()
