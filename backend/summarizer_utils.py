import re
import time
from difflib import SequenceMatcher
from typing import Dict, List, Optional

# --- REGEX PATTERNS ---
REGEX_PATTERNS = {
    'markdown': re.compile(r'^#{1,3}\s*(?:\d+[\.\)]\s*)?(.+?)$'),
    'bold': re.compile(r'^\*\*\s*(?:\d+[\.\)]\s*)?(.+?)\s*\*\*$'),
    'numbered': re.compile(r'^\d+[\.\)]\s+([A-Z].{8,})$'),
    'caps': re.compile(r'^([A-Z][A-Z\s&\-\(\)]{9,})$'),
    'clean_header': re.compile(r'[^\w\s&]'),
    'normalize_space': re.compile(r'\s+'),
    'separator': re.compile(r"═{3,}.*?═{3,}", re.DOTALL),
    'dashes': re.compile(r"[-_=]{10,}"),
    'meta': re.compile(r"\(Rangkuman selesai.*?\)|\(Selesai.*?\)|\(Catatan:.*?\)|Rangkuman selesai.*$|Semoga bermanfaat.*$|^RANGKUMAN.*?:\s.*?$|^RANGKUMAN.*?$", re.IGNORECASE | re.MULTILINE),
    'excess_newlines': re.compile(r"\n{3,}")
}

def sanitize_input(text: str, max_length: int = 500) -> str:
    if not text: return ""
    sanitized = re.sub(r'[\`]', '', str(text))
    sanitized = re.sub(r'\n\n+', ' ', sanitized)
    return (sanitized[:max_length] + "...") if len(sanitized) > max_length else sanitized.strip()

def clean_output(text: str) -> str:
    text = REGEX_PATTERNS['separator'].sub("", text)
    text = REGEX_PATTERNS['dashes'].sub("", text)
    text = REGEX_PATTERNS['meta'].sub("", text)
    text = REGEX_PATTERNS['excess_newlines'].sub("\n\n", text)
    return text.strip()

def normalize_section_name(name: str, name_mappings: Dict[str, str] = None) -> str:
    if name.startswith('#'): 
        name = name.lstrip('#').strip()
    
    clean = REGEX_PATTERNS['clean_header'].sub('', name)
    clean = REGEX_PATTERNS['normalize_space'].sub(' ', clean).strip().upper()
    clean = re.sub(r'^[\d\.\)\s]+', '', clean).strip()
    
    if name_mappings and clean in name_mappings: 
        return name_mappings[clean]
    
    base = clean.split('(')[0].strip()
    if name_mappings:
        for key, val in name_mappings.items():
            if base in key or key in base: 
                return val
        
    return clean

def extract_sections(content: str, name_mappings: Dict[str, str] = None) -> Dict[str, str]:
    sections = {}
    curr = None
    buf = []
    lines = content.split('\n')
    
    for line in lines:
        s = line.strip()
        if not s:
            if curr: buf.append(line)
            continue
        
        match = (REGEX_PATTERNS['markdown'].match(s) or
                 REGEX_PATTERNS['bold'].match(s) or
                 REGEX_PATTERNS['numbered'].match(s))
        
        if not match and len(s) >= 10:
            c = REGEX_PATTERNS['caps'].match(s)
            if c:
                pot = c.group(1).strip()
                if any(kw in pot for kw in ['EXECUTIVE', 'ANALYTICAL', 'MARKET', 'THESIS', 'GLOSSARY']):
                    match = c
                if any(kw in pot for kw in ['STRATEGIC', 'ACTION', 'LIMITATIONS', 'CRITICAL']):
                    continue 

        if match:
            if curr: sections[curr] = '\n'.join(buf).strip()
            raw = match.group(1).strip()
            curr = normalize_section_name(raw, name_mappings)
            buf = []
        elif curr:
            buf.append(line)
    
    if curr and buf: sections[curr] = '\n'.join(buf).strip()
    return sections

def calculate_draft_diversity(drafts: List[str]) -> Dict:
    if len(drafts) < 2: return {"diversity_score": 0.0}
    samples = [d[:1000] for d in drafts]
    tot, cnt = 0, 0
    for i in range(len(samples)):
        for j in range(i+1, len(samples)):
            tot += SequenceMatcher(None, samples[i], samples[j]).ratio()
            cnt += 1
    return {"diversity_score": round(1 - (tot/cnt), 3) if cnt else 0}

def normalize_output_format(text: str) -> str:
    lines = text.split('\n'); res = []
    ptr = re.compile(r'^(\d+)[\.\)]\s+([A-Z].{10,})$')
    for line in lines:
        m = ptr.match(line.strip())
        if m: res.extend([f"## {m.group(1)}. {m.group(2)}", "", "---", ""])
        else: res.append(line)
    return re.sub(r'\n{4,}', '\n\n\n', '\n'.join(res)).strip()
