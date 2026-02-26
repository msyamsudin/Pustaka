from typing import List, Optional, Union
from engine_params import (
    DRAFT_TRUNCATION_FULL,
    DRAFT_TRUNCATION_PARTIAL,
    CRITIC_DRAFT_CHAR_LIMIT,
    CONTEXT_PREVIEW_CHARS,
    AVG_CHARS_PER_TOKEN
)
from utils import estimate_tokens, safe_truncate, validate_prompt_length
from .policies import (
    META_INSTRUCTION,
    PRIORITY_HIERARCHY,
    EPISTEMIC_CONTROL_POLICY,
    FALLBACK_CONDITIONS,
    ESCAPE_HATCH_PROTOCOL,
    CORE_RULES_WITH_EXAMPLES,
    VALIDATION_CHECKLIST
)
from .templates import CORE_STRUCTURE_PROMPT

# =========================================================
# INTERNAL HELPERS
# =========================================================

def _format_draft_candidates(drafts: List[str]) -> str:
    """Standardized formatting for multiple LLM responses."""
    valid_drafts = [d.strip() for d in drafts if d and str(d).strip()]
    if not valid_drafts:
        return "[NO VALID DRAFTS PROVIDED]"
    
    return "\n\n".join(
        [f"═══ DRAFT CANDIDATE {i+1} ═══\n{d}" for i, d in enumerate(valid_drafts)]
    )

def _validate_core_metadata(title: str, author: str):
    """Raise error if basic metadata is missing."""
    if not title or not author:
        raise ValueError("Title and Author are mandatory fields for prompt generation.")

# =========================================================
# ENHANCED PROMPT BUILDERS
# =========================================================

def build_summarize_prompt(
    title: str, 
    author: str, 
    genre: str, 
    year: Union[int, str], 
    context: str, 
    source: str, 
    partial: Optional[str] = None, 
    search_context: Optional[str] = None
) -> str:
    """Enhanced version with 3-layer architecture, examples, and meta-instructions."""
    _validate_core_metadata(title, author)
    
    context_preview = context[:CONTEXT_PREVIEW_CHARS] if context else "[Not available]"
    
    prompt = f"""
<document_metadata>
Title         : {title}
Author        : {author}
Published Year: {year}
Genre/Category: {genre}
Data Source   : {source}
Description   : {context_preview}
</document_metadata>

{META_INSTRUCTION}

{PRIORITY_HIERARCHY}

<role_definition>
You are a PRINCIPAL INTELLIGENCE ANALYST specializing in high-density text compression
with strict epistemic discipline. Your output will be used for scholarly reference.
</role_definition>

# =========================================================
# LAYER 1: ANALYTICAL RULES
# =========================================================
{EPISTEMIC_CONTROL_POLICY}
{FALLBACK_CONDITIONS}
{ESCAPE_HATCH_PROTOCOL}

# =========================================================
# LAYER 2: OUTPUT FORMAT
# =========================================================
<task>
Analyze the provided text and generate a structured analytical summary following
the template below.
</task>

{search_context if search_context else ""}

<output_structure>
{CORE_STRUCTURE_PROMPT}
</output_structure>

# =========================================================
# LAYER 3: EXAMPLES & VALIDATION
# =========================================================
{CORE_RULES_WITH_EXAMPLES}
{VALIDATION_CHECKLIST}

<final_reminder>
Before submitting:
1. Run through validation checklist
2. Verify no fabricated content
3. Ensure Section 1a is narrative ONLY and Section 1b is logical chain ONLY
4. Confirm at least ONE comparative axis in Section 3
5. Apply Fallback Conditions if data is insufficient
</final_reminder>
"""
    
    if partial:
        prompt += f"""
<recovery_mode>
PREVIOUS OUTPUT EXISTS. INCOMPLETE SECTION DETECTED.

INSTRUCTIONS:
- Identify first incomplete logical unit
- Continue ONLY from that point
- DO NOT repeat any completed content

═══ PREVIOUS OUTPUT ═══
{partial}
═══ END PREVIOUS OUTPUT ═══
</recovery_mode>
"""
    
    validate_prompt_length(prompt)
    return prompt


def build_judge_prompt(
    title: str, 
    author: str, 
    genre: str, 
    year: Union[int, str], 
    drafts: List[str]
) -> str:
    """Synthesizes multiple drafts into one master version."""
    _validate_core_metadata(title, author)
    formatted = _format_draft_candidates(drafts)

    prompt = f"""
<role>SENIOR CHIEF EDITOR — Final Synthesis</role>

{META_INSTRUCTION}
{PRIORITY_HIERARCHY}

<task>
Synthesize multiple draft candidates into ONE epistemically sound Master Summary.

SYNTHESIS PROTOCOL:
1. Identify overlapping claims → verify against source → include if verified
2. Identify conflicting claims → document conflict OR choose most evidenced
3. Identify unique claims → evaluate epistemic basis → include if sound
4. Consolidate redundancy → preserve analytical density
5. Apply validation checklist → ensure all structural requirements met
</task>

<input_drafts>
{formatted}
</input_drafts>

<target_structure>
{CORE_STRUCTURE_PROMPT}
</target_structure>

{EPISTEMIC_CONTROL_POLICY}
{FALLBACK_CONDITIONS}
{ESCAPE_HATCH_PROTOCOL}
{VALIDATION_CHECKLIST}
"""
    validate_prompt_length(prompt)
    return prompt


def build_section_synthesis_prompt(
    name: str, 
    contents: List[str], 
    t: str, 
    a: str, 
    g: str, 
    y: Union[int, str], 
    full: bool, 
    hints: dict
) -> str:
    """Focused synthesis for individual sections with token safety."""
    limit_tokens = (DRAFT_TRUNCATION_FULL if full else DRAFT_TRUNCATION_PARTIAL) // AVG_CHARS_PER_TOKEN
    valid_contents = [safe_truncate(c, limit_tokens) for c in contents if c and str(c).strip()]

    fmt = "\n\n".join(
        [f"═══ SOURCE FRAGMENT {i+1} ═══\n{c}" for i, c in enumerate(valid_contents)]
    )

    hint = hints.get(name, "Synthesize with maximal epistemic discipline.")

    prompt = f"""
<role>SECTION EDITOR — Focused Synthesis</role>

{META_INSTRUCTION}
{PRIORITY_HIERARCHY}

<context>
Book: "{t}" by {a} | Genre: {g} | Year: {y}
Target Section: {name}
</context>

<specific_instruction>
{hint}
</specific_instruction>

<source_materials>
{fmt if valid_contents else "[NO SOURCE AVAILABLE — APPLY ESCAPE HATCH PROTOCOL]"}
</source_materials>

{EPISTEMIC_CONTROL_POLICY}
{FALLBACK_CONDITIONS}
{ESCAPE_HATCH_PROTOCOL}

<synthesis_protocol>
1. Extract all relevant claims from source fragments
2. Verify consistency across fragments. If conflict, use most detailed source.
3. Construct logical narrative with epistemic tagging
4. If insufficient data: apply Fallback Conditions.
</synthesis_protocol>
"""
    validate_prompt_length(prompt)
    return prompt


def build_critic_prompt(title: str, author: str, draft: str) -> str:
    """Audit draft for structural and epistemic violations."""
    _validate_core_metadata(title, author)
    truncated_draft = safe_truncate(draft, CRITIC_DRAFT_CHAR_LIMIT // AVG_CHARS_PER_TOKEN)
    
    return f"""
<role>ACADEMIC PEER REVIEWER — Epistemic Audit</role>

{META_INSTRUCTION}
{PRIORITY_HIERARCHY}
{EPISTEMIC_CONTROL_POLICY}

<task>
Audit draft for structural, analytical, and epistemic violations. Return JSON.
</task>

<draft_to_evaluate>
{truncated_draft}
</draft_to_evaluate>

<output_schema>
Return ONLY valid JSON:
{{
  "score": [0-100],
  "structural_issues": [],
  "epistemic_issues": [],
  "fixes": ["prioritized corrective instructions"]
}}
</output_schema>
"""


def build_refiner_prompt(title: str, author: str, draft: str, issues: List[str], fixes: List[str]) -> str:
    """Surgical revision based on critic feedback."""
    _validate_core_metadata(title, author)
    issues_block = "\n".join([f"- {i}" for i in issues]) if issues else "[No issues]"
    fixes_block = "\n".join([f"+ {f}" for f in fixes]) if fixes else "[No fixes]"

    return f"""
<role>SENIOR REVISIONIST — Surgical Correction</role>

{META_INSTRUCTION}
{PRIORITY_HIERARCHY}
{EPISTEMIC_CONTROL_POLICY}
{FALLBACK_CONDITIONS}
{ESCAPE_HATCH_PROTOCOL}

<critique_report>
ISSUES: {issues_block}
FIXES: {fixes_block}
</critique_report>

<original_draft>
{draft}
</original_draft>

<revision_instructions>
- Apply corrections surgically.
- Preserve analytical integrity.
- Output final publication-ready Indonesian text.
</revision_instructions>

{VALIDATION_CHECKLIST}
"""
