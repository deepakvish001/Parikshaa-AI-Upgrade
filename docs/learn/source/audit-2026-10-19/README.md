# Owner ke v1 problems ka audit (19 Oct 2026)

Ek baar ke jaanch scripts (production code nahi; factory ke gates inhi ka pakka roop honge,
[../../PROBLEM-STANDARD.md](../../PROBLEM-STANDARD.md) §5). Reference solutions chalate hain, isliye sirf bharose
wali files par, apne sandbox me:

```bash
python3 -I audit.py ../problems-v1/series_batch*.json       # reference vs apne tests
python3 -I mutate.py ../problems-v1/series_batch*.json      # mutation score
python3 -I survivors.py . ../problems-v1/series_batch*.json # kaunse galat badlaav bache
```

Nateeja (19 Oct): 40 problems, 0 mismatch, 114 mutants me 11 bache (kill rate 90%).
