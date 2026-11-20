#!/usr/bin/env python3
"""Build an isolated combined QX candidate; never modify the live subscription."""
from pathlib import Path
from collections import Counter
import json
import re
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/"Rules/QX-V2.5-All-Rules.list"
UPSTREAM=ROOT/"Rules/staging/QX-Third-Party-Candidate.list"
OUT=ROOT/"Rules/staging/QX-V2.5-Merged-Candidate.list"
REPORT=ROOT/"Rules/staging/QX-V2.5-Merge-Report.json"
KINDS={"host","host-suffix","host-keyword","host-wildcard","ip-cidr","ip6-cidr","ip-asn","user-agent"}
def read(path):
    result=[]
    for no,raw in enumerate(path.read_text(encoding="utf-8").splitlines(),1):
        line=raw.strip()
        if not line or line.startswith("#"):continue
        parts=[p.strip() for p in line.split(",")]
        if len(parts) not in (3,4) or parts[0] not in KINDS:
            raise ValueError(f"Invalid rule {path.name}:{no}: {line}")
        if len(parts)==4 and (parts[3]!="no-resolve" or parts[0] not in ("ip-cidr","ip6-cidr")):
            raise ValueError(f"Invalid option {path.name}:{no}: {line}")
        result.append((parts[0],parts[1],parts[2],line))
    return result
def main():
    base,external=read(BASE),read(UPSTREAM)
    if len(base)<108 or len(external)<240:
        raise ValueError(f"Unexpected count drop: base={len(base)}, external={len(external)}")
    seen={}
    conflicts=[]
    dupes=0
    output=[]
    for group,records in (("local",base),("third-party",external)):
        for kind,pattern,policy,line in records:
            key=(kind,pattern.lower())
            if key in seen:
                if seen[key][0]!=policy:
                    conflicts.append({"match":key,"first":seen[key],"second":[policy,group]})
                else:dupes+=1
                continue
            seen[key]=(policy,group)
            output.append(line)
    if conflicts:
        raise ValueError("Conflicting exact-match policies: "+json.dumps(conflicts[:12],ensure_ascii=False))
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text("# STAGING ONLY — NOT ACTIVE; requires device parse and route-order verification\n"
                   "# Base rules first to preserve dedicated AI and existing local priority\n"
                   "# Generated from local bundle plus reviewed blackmatrix7 upstream rules\n\n"
                   +"\n".join(output)+"\n",encoding="utf-8")
    REPORT.write_text(json.dumps({"base":len(base),"upstream":len(external),"duplicates_removed":dupes,
      "combined":len(output),"by_type":dict(Counter(x.split(",")[0] for x in output)),
      "status":"staging_only_not_device_validated"},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"STAGING READY: {len(output)} rules, {dupes} duplicates removed")
if __name__=="__main__":main()
