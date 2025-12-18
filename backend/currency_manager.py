import os
import json
import time
import requests
from typing import Optional

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data', 'currency_cache.json')

class CurrencyManager:
    def __init__(self):
        self._ensure_data_dir()
        self.rate = self._load_cached_rate()

    def _ensure_data_dir(self):
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)

    def _load_cached_rate(self) -> Optional[float]:
        if not os.path.exists(DATA_FILE):
            return None
        
        try:
            with open(DATA_FILE, 'r') as f:
                data = json.load(f)
                timestamp = data.get('timestamp', 0)
                rate = data.get('rate')
                
                # Check if cache is older than 24 hours (86400 seconds)
                if time.time() - timestamp < 86400:
                    return rate
        except Exception as e:
            print(f"Error loading currency cache: {e}")
            
        return None

    def get_usd_to_idr_rate(self) -> Optional[float]:
        """
        Returns the current USD to IDR rate.
        Tries cache first, then API. 
        Returns None if everything fails.
        """
        if self.rate:
            return self.rate
        
        # Fetch from API
        try:
            response = requests.get("https://api.frankfurter.app/latest?from=USD&to=IDR", timeout=5)
            if response.status_code == 200:
                data = response.json()
                rate = data.get("rates", {}).get("IDR")
                if rate:
                    self._save_cache(rate)
                    return rate
        except Exception as e:
            print(f"Error fetching currency rate: {e}")
            
        # Fallback
        return None

    def _save_cache(self, rate: float):
        self.rate = rate
        try:
            with open(DATA_FILE, 'w') as f:
                json.dump({
                    "rate": rate,
                    "timestamp": time.time(),
                    "date": time.strftime("%Y-%m-%d %H:%M:%S")
                }, f)
        except Exception as e:
            print(f"Error saving currency cache: {e}")
