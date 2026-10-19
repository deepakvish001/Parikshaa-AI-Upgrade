import json, sys, subprocess, tempfile, os, re
OPS=[('<=','<'),('<','<='),('>=','>'),('>','>='),('==','!='),('!=','=='),('+ 1','+ 2'),('- 1','- 2'),('+1','+2'),('-1','-2'),('% 9','% 10'),('range(a, b+1)','range(a, b)'),('[-3:]','[-2:]'),(' and ',' or ')]
def mutants(code):
    out=[]
    for a,b in OPS:
        for m in re.finditer(re.escape(a), code):
            # skip operators inside the __main__ I/O block
            if code.rfind('__main__',0,m.start())!=-1: continue
            if a=='<' and code[m.start():m.start()+2] in ('<=','<<'): continue
            if a=='>' and code[m.start():m.start()+2] in ('>=','>>'): continue
            out.append(code[:m.start()]+b+code[m.end():])
    return out
def passes(code, tests):
    with tempfile.NamedTemporaryFile('w',suffix='.py',delete=False) as tf:
        tf.write(code); path=tf.name
    try:
        for t in tests:
            try:
                r=subprocess.run([sys.executable,'-I',path],input=t['input']+'\n',capture_output=True,text=True,timeout=5)
            except subprocess.TimeoutExpired:
                return False
            if r.stdout.strip()!=t['expected'].strip(): return False
        return True
    finally: os.unlink(path)
if __name__ != "__main__":
    pass
else:
  tm=0; ts=0; surv=[]
  for f in sys.argv[1:]:
      for p in json.load(open(f)):
          if p.get('sql_spec'): continue
          ref=p['reference_solution']['python3']; tests=p['sample_tests']+p['hidden_tests']
          ms=mutants(ref)
          s=[m for m in ms if passes(m,tests)]
          tm+=len(ms); ts+=len(s)
          if s: surv.append((p['slug'],len(ms),len(s)))
  print('mutants',tm,'survived',ts, 'kill rate %.0f%%'%(100*(tm-ts)/max(tm,1)))
  for x in surv: print(*x)
