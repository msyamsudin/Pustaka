import requests
import json

def test_verification():
    # Test case: Clean Code (usually has description on Google Books)
    url = "http://127.0.0.1:8000/api/verify"
    payload = {
        "title": "Clean Code",
        "author": "Robert C. Martin"
    }
    
    try:
        print(f"Sending request to {url}...")
        print(f"Payload: {payload}")
        response = requests.post(url, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            print("\nResponse Status: 200 OK")
            print(f"Is Valid: {data.get('is_valid')}")
            
            sources = data.get('sources', [])
            print(f"\nSources Found: {len(sources)}")
            
            for i, source in enumerate(sources):
                print(f"\n--- Source {i+1}: {source.get('source')} ---")
                print(f"Title: {source.get('title')}")
                desc = source.get('description')
                print(f"Description Length: {len(desc) if desc else 0}")
                print(f"Description Preview: {desc[:100] if desc else 'N/A'}")
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_verification()
