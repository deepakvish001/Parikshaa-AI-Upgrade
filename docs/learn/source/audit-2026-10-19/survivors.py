import json, sys, re
sys.path.insert(0, sys.argv[1])
from mutate import mutants, passes
for f in sys.argv[2:]:
    for p in json.load(open(f)):
        if p['slug'] not in ('valid-variable-name','pronic-number-check','toggle-bits-nibble','next-perfect-square','valid-sentence-check'): continue
        ref=p['reference_solution']['python3']; tests=p['sample_tests']+p['hidden_tests']
        for m in mutants(ref):
            if passes(m,tests):
                diff=[(a,b) for a,b in zip(ref.splitlines(),m.splitlines()) if a!=b]
                print(p['slug'],'|',diff[0][1].strip()[:90])
