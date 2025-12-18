import json
import os
from typing import Dict, Optional

CONFIG_FILE = "user_config.json"

class ConfigManager:
    def __init__(self):
        self.config_file = CONFIG_FILE
        self._ensure_config_exists()

    def _ensure_config_exists(self):
        if not os.path.exists(self.config_file):
            self.save_config({
                "openrouter_key": "",
                "openrouter_model": "google/gemini-2.0-flash-exp:free"
            })

    def load_config(self) -> Dict:
        try:
            with open(self.config_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {}

    def save_config(self, config: Dict):
        with open(self.config_file, 'w') as f:
            json.dump(config, f, indent=4)

    def get_key(self, key_name: str) -> Optional[str]:
        config = self.load_config()
        return config.get(key_name)

    def set_key(self, key_name: str, value: str):
        config = self.load_config()
        config[key_name] = value
        self.save_config(config)
