import json, sys, subprocess, tempfile, os, glob
files = sys.argv[1:]
tot=0; mism=0; rows=[]
for f in files:
    data=json.load(open(f))
    for p in data:
        if p.get('sql_spec'): 
            rows.append((os.path.basename(f), p['slug'], 'SQL', len(p.get('sample_tests',[])), len(p.get('hidden_tests',[])), '-', '-')); continue
        ref=p['reference_solution'].get('python3')
        tests=p['sample_tests']+p['hidden_tests']
        maxlen=max(len(t['input']) for t in tests)
        bad=[]
        with tempfile.NamedTemporaryFile('w',suffix='.py',delete=False) as tf:
            tf.write(ref); path=tf.name
        for t in tests:
            r=subprocess.run([sys.executable,'-I',path],input=t['input']+'\n',capture_output=True,text=True,timeout=10)
            out=r.stdout.strip()
            if out!=t['expected'].strip(): bad.append((t['input'][:20],t['expected'],out))
        os.unlink(path)
        tot+=1; mism+= bool(bad)
        rows.append((os.path.basename(f)[9:21], p['slug'], p['difficulty'], len(p['sample_tests']), len(p['hidden_tests']), maxlen, len(bad)))
for r in rows: print(*r, sep=' | ')
print('problems',tot,'with mismatches',mism)
