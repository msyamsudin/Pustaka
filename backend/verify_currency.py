
import sys
import os
sys.path.append("d:/04_SOFTWARE/Script/06_GITHUB/Focus/Perpustakaan/backend")

from currency_manager import CurrencyManager

def test_currency_manager():
    print("Testing CurrencyManager...")
    cm = CurrencyManager()
    
    # Test 1: Fetch Rate
    rate = cm.get_usd_to_idr_rate()
    print(f"Current Rate: {rate}")
    
    if rate > 10000:
        print("PASS: Rate seems reasonable (> 10,000)")
    else:
        print("FAIL: Rate seems too low or invalid")
        
    # Test 2: Cache File Creation
    cache_file = os.path.join("d:/04_SOFTWARE/Script/06_GITHUB/Focus/Perpustakaan/backend/data/currency_cache.json")
    if os.path.exists(cache_file):
        print("PASS: Cache file created.")
        with open(cache_file, 'r') as f:
            print(f"Cache content: {f.read()}")
    else:
        print("FAIL: Cache file not found.")

if __name__ == "__main__":
    test_currency_manager()
