
import sys
import os
import shutil
from unittest.mock import patch

sys.path.append("d:/04_SOFTWARE/Script/06_GITHUB/Focus/Perpustakaan/backend")

from currency_manager import CurrencyManager

def test_currency_fallback():
    print("Testing CurrencyManager Fallback...")
    
    # 1. Backup existing cache
    cache_file = os.path.join("d:/04_SOFTWARE/Script/06_GITHUB/Focus/Perpustakaan/backend/data/currency_cache.json")
    backup_file = cache_file + ".bak"
    
    if os.path.exists(cache_file):
        shutil.move(cache_file, backup_file)
        print("Backed up existing cache.")
        
    try:
        cm = CurrencyManager()
        
        # 2. Mock requests.get to fail
        with patch('requests.get') as mock_get:
            mock_get.side_effect = Exception("Simulated Network Failure")
            
            rate = cm.get_usd_to_idr_rate()
            print(f"Fallback Rate Result: {rate}")
            
            if rate is None:
                print("PASS: Returned None on failure.")
            else:
                print(f"FAIL: Returned {rate} instead of None.")

    finally:
        # 3. Restore cache
        if os.path.exists(backup_file):
            shutil.move(backup_file, cache_file)
            print("Restored cache.")

if __name__ == "__main__":
    test_currency_fallback()
