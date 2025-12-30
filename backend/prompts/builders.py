from .policies import (
    PRIORITY_HIERARCHY,
    CORE_RULES_WITH_EXAMPLES,
    EPISTEMIC_CONTROL_POLICY,
    ESCAPE_HATCH_PROTOCOL,
    VALIDATION_CHECKLIST
)
from .templates import CORE_STRUCTURE_PROMPT

# =========================================================
# ENHANCED PROMPT BUILDERS
# =========================================================

def build_summarize_prompt(title, author, genre, year, context, source, partial=None, search_context=None):
    """Enhanced version with examples and hierarchy"""
    intro = f"""
<document_metadata>
Title         : {title}
Author        : {author}
Published Year: {year}
Genre/Category: {genre}
Data Source   : {source}
Description   : {context[:500] if context else "[Not available]"}
</document_metadata>

{PRIORITY_HIERARCHY}
{CORE_RULES_WITH_EXAMPLES}
{EPISTEMIC_CONTROL_POLICY}
{ESCAPE_HATCH_PROTOCOL}

<role_definition>
You are a PRINCIPAL INTELLIGENCE ANALYST specializing in high-density text compression
with strict epistemic discipline. Your output will be used for scholarly reference.

Core Competencies:
- Analytical rigor: separate data from interpretation
- Structural clarity: logical flow over narrative color
- Epistemic humility: acknowledge uncertainty explicitly
- Linguistic precision: clarity > language purity
</role_definition>

{search_context if search_context else ""}

<task>
Analyze the provided text and generate a structured analytical summary following
the template below. Prioritize epistemic accuracy over stylistic preferences.
</task>

<output_structure>
{CORE_STRUCTURE_PROMPT}
</output_structure>

{VALIDATION_CHECKLIST}

<final_reminder>
Before submitting:
1. Run through validation checklist
2. Verify no fabricated content
3. Check all interpretative constructs are labeled
4. Ensure at least ONE comparative axis in Section 3
5. Confirm first paragraph is 100-150 words with NO bullet points
</final_reminder>
"""
    
    if partial:
        intro += f"""
<recovery_mode>
PREVIOUS OUTPUT EXISTS. INCOMPLETE SECTION DETECTED.

INSTRUCTIONS:
- Identify first incomplete logical unit (paragraph, bullet, subsection)
- Continue ONLY from that point
- DO NOT repeat any completed content
- If boundary is ambiguous, skip to next major bullet/subsection

═══ PREVIOUS OUTPUT ═══
{partial}
═══ END PREVIOUS OUTPUT ═══

Continue from: [Identify and state the continuation point]
</recovery_mode>
"""
    return intro


def build_judge_prompt(title, author, genre, year, drafts):
    """Enhanced with conflict resolution"""
    valid_drafts = [d.strip() for d in drafts if d and str(d).strip()]
    formatted = "\n\n".join(
        [f"═══ DRAFT CANDIDATE {i+1} ═══\n{d}" for i, d in enumerate(valid_drafts)]
    )

    return f"""
<role>SENIOR CHIEF EDITOR — Final Synthesis</role>

{PRIORITY_HIERARCHY}
{CORE_RULES_WITH_EXAMPLES}
{EPISTEMIC_CONTROL_POLICY}
{ESCAPE_HATCH_PROTOCOL}

<task>
Synthesize multiple draft candidates into ONE epistemically sound Master Summary.

SYNTHESIS PROTOCOL:
1. Identify overlapping claims → verify against source → include if verified
2. Identify conflicting claims → document conflict OR choose most evidenced
3. Identify unique claims → evaluate epistemic basis → include if sound
4. Consolidate redundancy → preserve analytical density
5. Apply validation checklist → ensure all structural requirements met

CONFLICT RESOLUTION:
If drafts disagree:
- Prefer claim with explicit source citation
- If both cited, prefer more specific evidence
- If equally valid, include both with hedge: "Interpretasi alternatif menunjukkan..."
</task>

<input_drafts>
{formatted}
</input_drafts>

<output_structure_requirement>
{CORE_STRUCTURE_PROMPT}
</output_structure_requirement>

{VALIDATION_CHECKLIST}
"""


def build_section_synthesis_prompt(name, contents, t, a, g, y, dc, full, hints):
    """Enhanced with uncertainty protocol"""
    valid_contents = [c for c in contents if c and str(c).strip()]
    limit_char = 1000 if full else 4000

    fmt = "\n\n".join(
        [
            f"═══ SOURCE FRAGMENT {i+1} ═══\n{c[:limit_char]}{'...' if len(c) > limit_char else ''}"
            for i, c in enumerate(valid_contents)
        ]
    )

    hint = hints.get(name, "Synthesize with maximal epistemic discipline.")

    return f"""
<role>SECTION EDITOR — Focused Synthesis</role>

{PRIORITY_HIERARCHY}
{CORE_RULES_WITH_EXAMPLES}
{EPISTEMIC_CONTROL_POLICY}
{ESCAPE_HATCH_PROTOCOL}

<context>
Book: "{t}" by {a}
Genre: {g} | Year: {y}
</context>

<target_section>
{name}
</target_section>

<specific_instruction>
{hint}
</specific_instruction>

<source_materials>
{fmt if valid_contents else "[NO SOURCE AVAILABLE — APPLY ESCAPE HATCH PROTOCOL]"}
</source_materials>

<synthesis_protocol>
1. Extract all relevant claims from source fragments
2. Verify consistency across fragments
3. Construct logical narrative with epistemic tagging
4. If insufficient data:
   - Use linguistic hedging
   - Apply scope limiters
   - Add [Insufficient Data] marker if unavoidable
5. DO NOT fabricate specifics
</synthesis_protocol>

<output_requirements>
- Indonesian academic prose ONLY (no headers, no English paragraphs)
- All interpretative constructs must be labeled
- No generic statements without specific grounding
- Length: responsive to content availability (quality > quota)
</output_requirements>
"""


def build_critic_prompt(title, author, draft):
    """Enhanced with specific failure modes"""
    return f"""
<role>ACADEMIC PEER REVIEWER — Epistemic Audit</role>

{PRIORITY_HIERARCHY}
{CORE_RULES_WITH_EXAMPLES}
{EPISTEMIC_CONTROL_POLICY}

<task>
Audit draft for structural, analytical, and epistemic violations.

AUDIT CHECKLIST:
STRUCTURAL:
- Section count = 3?
- Headers in English?
- First paragraph = 100-150 words, no bullets?
- Section 3 has comparative axis?

EPISTEMIC:
- Any unlabeled interpretative constructs?
- Any causal claims without mechanism?
- Any genealogical claims without source/label?
- Any fabricated quotes or statistics?

LINGUISTIC:
- Any full English paragraphs?
- Any forced Indonesian translations that reduce clarity?
- Any promotional language?

ANALYTICAL:
- Argument separation clear (data/interpretation/normative)?
- Evidence typing present for major claims?
- Uncertainty appropriately expressed?
</task>

<draft_to_evaluate>
{draft[:8000]}
</draft_to_evaluate>

<output_schema>
Return ONLY valid JSON:
{{
  "score": [integer 0-100, where 100 = perfect compliance],
  "structural_issues": ["specific violation with location"],
  "epistemic_issues": ["specific violation with location"],
  "linguistic_issues": ["specific violation with location"],
  "analytical_issues": ["specific violation with location"],
  "fixes": ["concrete corrective instruction, prioritized by severity"]
}}

SCORING RUBRIC:
90-100: Minor issues only (style, word choice)
70-89: Moderate issues (missing labels, unclear hedging)
50-69: Serious issues (fabrication, unlabeled constructs, structural violations)
<50: Critical failures (multiple fabrications, wrong language in headers)
</output_schema>
"""


def build_refiner_prompt(title, author, draft, issues, fixes):
    """Enhanced with surgical editing protocol"""
    issues_block = "\n".join([f"- {i}" for i in issues]) if issues else "[No issues reported]"
    fixes_block = "\n".join([f"+ {f}" for f in fixes]) if fixes else "[No fixes required]"

    return f"""
<role>SENIOR REVISIONIST — Surgical Correction</role>

{PRIORITY_HIERARCHY}
{CORE_RULES_WITH_EXAMPLES}
{EPISTEMIC_CONTROL_POLICY}
{ESCAPE_HATCH_PROTOCOL}

<task>
Apply corrections to achieve full epistemic and structural compliance.

REVISION PROTOCOL:
1. Address all "Critical" and "High Priority" fixes first
2. Preserve all valid analytical content
3. Make minimal changes necessary (surgical editing)
4. Re-run validation checklist after revision
5. If new issues emerge, apply escape hatch protocol
</task>

<critique_report>
ISSUES IDENTIFIED:
{issues_block}

REQUIRED FIXES (in priority order):
{fixes_block}
</critique_report>

<original_draft>
{draft}
</original_draft>

<revision_instructions>
- Edit surgically: change only what violates rules
- Preserve voice and analytical structure where compliant
- If fix creates new conflict, apply priority hierarchy
- Add explicit markers where required ([Interpretative Construct], etc.)
- Output final publication-ready text
</revision_instructions>

{VALIDATION_CHECKLIST}

<final_check>
After revision, verify:
1. All reported issues resolved
2. No new violations introduced
3. Structural integrity maintained
4. Epistemic accuracy preserved
</final_check>
"""
