import re,subprocess,itertools,pathlib
f=pathlib.Path('src/data/generate.ts'); orig=f.read_text()
def variant(ampfloor, ampfreq, gapfloor, gaphi, alongfloor, warpamp, warpfv):
    s=orig
    for a,b in [('const FOLD_AMP_FLOOR = 0.5;',f'const FOLD_AMP_FLOOR = {ampfloor};'),
                ('const FOLD_AMP_FREQ_U = 0.0036;',f'const FOLD_AMP_FREQ_U = {ampfreq};'),
                ('const GAP_FLOOR = 0.3;',f'const GAP_FLOOR = {gapfloor};'),
                ('const GAP_HI = 0.62;',f'const GAP_HI = {gaphi};'),
                ('const ALONG_FLOOR = 0.84;',f'const ALONG_FLOOR = {alongfloor};'),
                ('const WARP_AMP_M = 30;',f'const WARP_AMP_M = {warpamp};'),
                ('const WARP_FREQ_V = 0.0054;',f'const WARP_FREQ_V = {warpfv};')]:
        assert s.count(a)==1,(a)
        s=s.replace(a,b)
    return s
rows=[]
grid=list(itertools.product([0.62,0.74],[0.0036],[0.5,0.66],[0.5,0.58],[0.84,0.9],[24,34,44],[0.006,0.011]))
print('configs:',len(grid),flush=True)
for cfg in grid:
    f.write_text(variant(*cfg))
    r=subprocess.run(['npx','tsx','.tune/check.ts'],capture_output=True,text=True)
    m=re.search(r'WORST (\S+) ([\d.]+)% \| hot=(\d+) \| beltCells=(\d+) beltCV=([\d.]+) flips=(\d+)',r.stdout)
    if not m:
        print('FAIL',cfg,r.stderr[-200:],flush=True); continue
    w=float(m.group(2)); hot=int(m.group(3)); cv=float(m.group(5)); fl=int(m.group(6))
    rows.append((w,hot,cv,fl,cfg))
    print(f'{cfg} -> worst={w:.2f}%({m.group(1)}) hot={hot} cv={cv:.3f} flips={fl}',flush=True)
f.write_text(orig)
ok=[r for r in rows if r[0]<=4.3 and r[1]>220]
ok.sort(key=lambda r:-(r[2]*1000+r[3]/10))
print('\n--- PASSING, ranked by texture ---',flush=True)
for r in ok[:12]: print(f'worst={r[0]:.2f}% hot={r[1]} cv={r[2]:.3f} flips={r[3]} cfg={r[4]}',flush=True)
print('passing:',len(ok),'of',len(rows),flush=True)
