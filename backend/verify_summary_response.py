import requests
import json
import time

def test_summary():
    url = "http://127.0.0.1:8000/api/summarize"
    # Mock data that mimics verified output
    payload = {
        "metadata": [{
            "source": "Test",
            "title": "Clean Code",
            "authors": ["Robert C. Martin"],
            "description": "A book about code quality."
        }],
        # No API key to trigger mock response or use env if set
        "api_key": "test_key", 
        "model": "google/gemini-pro"
    }
    
    try:
        print(f"Sending request to {url}...")
        start = time.time()
        response = requests.post(url, json=payload)
        end = time.time()
        
        print(f"Request took: {round(end-start, 2)}s")
        
        if response.status_code == 200:
            data = response.json()
            print("\nResponse Status: 200 OK")
            print("Keys in response:", data.keys())
            
            if "cost_estimate" in data:
                print("Cost Estimate:", data["cost_estimate"])
                
            if "duration_seconds" in data:
                print(f"Duration Seconds: {data['duration_seconds']}")
            else:
                print("FAIL: 'duration_seconds' key MISSING in response!")
                
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_summary()
