#!/usr/bin/env python3
"""Fail-closed read-only review of staged Quantumult X rewrite resources."""
from pathlib import Path
import json
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"Rewrites/QX-All-Rewrites.conf"
DENY=re.compile(r"(spotify|premium|crack|unlock|vip|bank|payment|login|account|appleid|icloud|chatgpt|openai|claude|gemini)",re.I)
# This audit deliberately does not approve or execute any rewrite. It checks the
# default empty/staged state and blocks accidental unreviewed production changes.
def main():
    lines=SOURCE.read_text(encoding="utf-8").splitlines()
    active=[(i,x.strip()) for i,x in enumerate(lines,1) if x.strip() and not x.lstrip().startswith(("#",";"))]
    if active:
        print("BLOCKED: non-comment rewrite directives require explicit review:")
        for i,x in active[:15]:
            print(f"  line {i}: "+("sensitive target redacted" if DENY.search(x) else x[:120]))
        return 1
    print(json.dumps({"resource":str(SOURCE.relative_to(ROOT)),"active_directives":0,
                      "status":"safe_empty_staging_only","mitm_enabled_by_this_file":False},ensure_ascii=False))
    return 0
if __name__=="__main__":
    sys.exit(main())
