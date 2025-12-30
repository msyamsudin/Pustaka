"""
Enhanced Prompt Templates for BookSummarizer Engine v2.0
IMPROVEMENTS:
- Concrete examples for every major rule
- Conflict resolution protocol
- Simplified hierarchy with clear priorities
- Machine-readable validation checklist
- Escape hatches for edge cases

NOTE: This file is now a facade for the modularized prompts package.
"""

from prompts import *

__version__ = "2.0.0"
__improvements__ = [
    "Added concrete examples for all major rules",
    "Implemented priority hierarchy for conflict resolution",
    "Added escape hatch protocol for edge cases",
    "Created machine-readable validation checklist",
    "Enhanced epistemic control with evidence typing",
    "Improved linguistic guidelines with naturalness examples",
    "Added surgical editing protocol for refinement",
    "Included scoring rubric for critic evaluation",
    "Modularized structure into backend/prompts package"
]