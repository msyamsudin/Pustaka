import requests
import json

def test_ollama_endpoints():
    base_url = "http://127.0.0.1:8000/api"
    
    print("1. Testing /api/models for Ollama...")
    try:
        # Note: This might fail if Ollama is not running locally, but we check if backend handles it
        payload = {
            "provider": "Ollama",
            "base_url": "http://localhost:11434"
        }
        res = requests.post(f"{base_url}/models", json=payload)
        print(f"Status: {res.status_code}")
        print(f"Response: {json.dumps(res.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")

    print("\n2. Testing /api/config for Ollama settings...")
    try:
        payload = {
            "provider": "Ollama",
            "ollama_base_url": "http://localhost:11434",
            "ollama_model": "phi3"
        }
        res = requests.post(f"{base_url}/config", json=payload)
        print(f"Status: {res.status_code}")
        print(f"Response: {json.dumps(res.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_ollama_endpoints()
