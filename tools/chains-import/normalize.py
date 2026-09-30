"""Normalisiert Icon-/Knoten-IDs auf eine eindeutige Schreibweise und
kopiert fehlende Icons (Quelle: case-insensitiver Treffer im Quell-Repo)."""
import json, os, shutil, sys
data = json.load(open(sys.argv[1]))
src_dir, assets = sys.argv[2], sys.argv[3]
existing = {f[:-4] for f in os.listdir(assets) if f.endswith('.png')}
src = {f[:-4].lower(): f for f in os.listdir(src_dir) if f.endswith('.png')}
canon = {i.lower(): i for i in existing}  # vorhandene Assets haben Vorrang
log = data['log']
renamed = set()

def c(name):
    key = name.lower()
    if key not in canon:
        canon[key] = name
    if canon[key] != name:
        renamed.add(f'{name} -> {canon[key]}')
    return canon[key]

for chain in data['chains']:
    for n in chain['nodes']:
        n['icon'] = n['good'] = c(n['icon'])
        pass
        if n['id'].lower() in canon or n['id'].lower() in src:
            n['id'] = c(n['id'])
        n['name'] = n['id'].replace('_', ' ')  # wie beim ersten Import: Name aus Knoten-ID
    for e in chain['edges']:
        for k in ('from', 'to'):
            if e[k].lower() in canon:
                e[k] = canon[e[k].lower()]
    t = chain['targetGood']
    t['id'] = t['icon'] = c(t['icon'])
    t['name'] = t['id'].replace('_', ' ')
    chain['id'] = chain['id']  # IDs bleiben (klein geschrieben)
copied, missing = [], []
for chain in data['chains']:
    for n in chain['nodes']:
        i = n['icon']
        dst = os.path.join(assets, i + '.png')
        if i in existing or os.path.exists(dst):
            continue
        s = src.get(i.lower())
        if s:
            shutil.copy(os.path.join(src_dir, s), dst)
            copied.append(f'{i}' + ('' if s == i + '.png' else f' (aus {s})'))
        else:
            missing.append(i)
log += [f'Icon-Schreibweise vereinheitlicht: {r}' for r in sorted(renamed)]
data['copied'] = copied
data['missing'] = missing
json.dump(data, sys.stdout, ensure_ascii=False, indent=2)
