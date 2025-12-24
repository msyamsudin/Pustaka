import requests
import json
import re
from datetime import datetime
from typing import List, Dict, Optional

class NotionManager:
    def __init__(self, api_key: str, database_id: str):
        self.api_key = api_key
        self.database_id = database_id
        self.base_url = "https://api.notion.com/v1"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28"
        }

    def create_summary_page(self, title: str, author: str, summary_content: str, metadata: Optional[Dict] = None) -> Dict:
        """
        Creates a new page in the configured Notion database.
        """
        url = f"{self.base_url}/pages"
        
        # Prepare properties
        properties = {
            "Name": {
                "title": [
                    {
                        "text": {
                            "content": title
                        }
                    }
                ]
            },
            "Author": {
                "rich_text": [
                    {
                        "text": {
                            "content": author
                        }
                    }
                ]
            },
            "Date": {
                "date": {
                    "start": datetime.now().isoformat()
                }
            }
        }
        
        if metadata and metadata.get("provider"):
            properties["Provider"] = {
                "rich_text": [
                    {
                        "text": {
                            "content": metadata.get("provider")
                        }
                    }
                ]
            }

        if metadata and metadata.get("model"):
            properties["AI Model"] = {
                "rich_text": [
                    {
                        "text": {
                            "content": metadata.get("model")
                        }
                    }
                ]
            }

        if metadata and metadata.get("isbn"):
            properties["ISBN"] = {
                "rich_text": [
                    {
                        "text": {
                            "content": metadata.get("isbn")
                        }
                    }
                ]
            }
            
        if metadata and metadata.get("genre"):
            properties["Genre"] = {
                "rich_text": [
                    {
                        "text": {
                            "content": metadata.get("genre")
                        }
                    }
                ]
            }

        # Parse markdown content into Notion blocks
        children = self._markdown_to_blocks(summary_content)

        payload = {
            "parent": {"database_id": self.database_id},
            "properties": properties,
            "children": children
        }

        try:
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            error_detail = response.json() if 'response' in locals() and response.content else str(e)
            return {"error": f"Notion API Error: {error_detail}"}

    def _markdown_to_blocks(self, content: str) -> List[Dict]:
        """
        Converts markdown text into a list of Notion block objects.
        Supports: Headings (# to ######), Bold (**), Bullet points (- or *), Blockquotes (>), and Paragraphs.
        """
        blocks = []
        # 1. Normalisasi line endings (handle \r\n, \r, and \n)
        content = content.replace('\r\n', '\n').replace('\r', '\n')
        
        # 2. Bersihkan marker internal Pustaka+ (intel-synth) sebelum parsing
        content = re.sub(r'\[\[(.*?)\]\]', r'\1', content)
        
        lines = content.split('\n')
        
        for line in lines:
            # 3. Clean line carefully: strip whitespace and invisible control characters
            line = line.strip()
            line = re.sub(r'[\u200b\u200c\u200d\u200e\u200f\ufeff]', '', line)
            
            if not line:
                continue

            # 4. Headings: Deteksi tanda pagar di awal baris
            # Kita gunakan regex yang sangat eksplisit untuk menangkap tanda pagar
            h_match = re.search(r'^(#+)\s+(.+)$', line)
            if h_match:
                level = len(h_match.group(1))
                text_content = h_match.group(2).strip()
                
                # Double-check: buang sisa-sisa tanda pagar di awal (kasus ## ## Teks)
                text_content = text_content.lstrip('#').strip()
                
                if text_content:
                    level = min(level, 3)
                    type_name = f"heading_{level}"
                    blocks.append({
                        "object": "block",
                        "type": type_name,
                        type_name: {"rich_text": self._text_to_rich_text(text_content)}
                    })
                    continue
            
            # 5. Bullet Lists: Deteksi -, *, atau + di awal baris
            list_match = re.match(r'^[\-\*\+]\s+(.*)', line)
            if list_match:
                text_content = list_match.group(1).strip()
                # Hindari heading di dalam list (bersihkan jika ada)
                text_content = text_content.lstrip('#').strip()
                
                blocks.append({
                    "object": "block",
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {"rich_text": self._text_to_rich_text(text_content)}
                })
                continue
                
            # 6. Blockquotes: Deteksi > di awal baris
            if line.startswith('>'):
                quote_text = line.lstrip('>').strip()
                quote_text = quote_text.lstrip('#').strip() # Bersihkan jika > ## Teks
                
                blocks.append({
                    "object": "block",
                    "type": "quote",
                    "quote": {"rich_text": self._text_to_rich_text(quote_text)}
                })
                continue
            
            # 7. Horizontal Rule: Deteksi baris yang hanya berisi ---, ***, atau ___
            if re.match(r'^[\-\*_]{3,}$', line):
                blocks.append({
                    "object": "block",
                    "type": "divider",
                    "divider": {}
                })
                continue
            
            # 8. Regular Paragraph: Default jika tidak ada yang cocok
            # Terakhir, pastikan baris biasa ini tidak "sengaja" membawa tanda pagar di depannya
            # jika AI gagal memicu regex heading di atas karena format yang aneh
            if line.startswith('#'):
                # Jika masih ada baris yang diawali # tapi gagal ditangkap sebagai heading block,
                # kemungkinan spasinya aneh. Kita coba konversi paksa atau bersihkan.
                clean_line = line.lstrip('#').strip()
                if not clean_line: continue
                blocks.append({
                    "object": "block",
                    "type": "heading_3",
                    "heading_3": {"rich_text": self._text_to_rich_text(clean_line)}
                })
            else:
                blocks.append({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": self._text_to_rich_text(line)}
                })
        
        # Batasi jumlah blocks (Notion API limit per request biasanya 100 children)
        return blocks[:100]

    def _text_to_rich_text(self, text: str) -> List[Dict]:
        """
        Parses bold (**) and italic (*) markdown within a string and converts to Notion rich_text objects.
        """
        if not text:
            return []

        # Bersihkan marker internal jika masih ada
        text = re.sub(r'\[\[(.*?)\]\]', r'\1', text)
        
        parts = []
        # Regex untuk mendeteksi bold, italic, atau teks biasa (Greedy)
        # Urutan penting: Bold+Italic (***), Bold (**), Italic (*)
        pattern = r'(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|[^\*]+)'
        segments = re.findall(pattern, text)
        
        for seg in segments:
            if seg.startswith('***') and seg.endswith('***'):
                content = seg[3:-3]
                if content:
                    parts.append({
                        "type": "text",
                        "text": {"content": content},
                        "annotations": {"bold": True, "italic": True}
                    })
            elif seg.startswith('**') and seg.endswith('**'):
                content = seg[2:-2]
                if content:
                    parts.append({
                        "type": "text",
                        "text": {"content": content},
                        "annotations": {"bold": True}
                    })
            elif seg.startswith('*') and seg.endswith('*'):
                content = seg[1:-1]
                if content:
                    parts.append({
                        "type": "text",
                        "text": {"content": content},
                        "annotations": {"italic": True}
                    })
            else:
                if seg:
                    parts.append({
                        "type": "text",
                        "text": {"content": seg}
                    })
        
        return parts
