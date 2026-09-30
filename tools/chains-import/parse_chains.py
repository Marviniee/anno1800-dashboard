"""Parser für dotSp0T/Anno_1800_Chains_Consumption (.tex -> Ketten-JSON).

Pro \\tcbox werden Knoten-Makros, \\connect-Kanten und \\divider-Varianten
gelesen. Divider-Varianten übernehmen gegenseitig ihre ausgehenden Kanten
(Spiegelung), dann wird die Box in zusammenhängende Teilgraphen zerlegt; pro
Senke (Endprodukt) entsteht eine Kette mit allen Vorstufen.
"""
import json
import re
import sys
from collections import defaultdict

# Makro -> (Argumentanzahl, Feld-Indizes 1-basiert, fester Gebäudename)
# Felder: good, amount, building, id, cons, fsize, fcount
SIG = {
    'prodnode': (4, dict(good=2, amount=3, building=4)),
    'prodnodec': (5, dict(good=2, amount=3, building=4)),
    'prodnodefe': (4, dict(good=2, amount=3, building=4)),
    'prodnodefec': (5, dict(good=2, amount=3, building=4)),
    'prodnodelbld': (6, dict(good=2, amount=3, building=4, id=5)),
    'prodnodelbldfe': (6, dict(good=2, amount=3, building=4, id=5)),
    'consnode': (5, dict(good=2, amount=3, building=4, cons=5)),
    'consnodefe': (5, dict(good=2, amount=3, building=4, cons=5)),
    'consnodec': (6, dict(good=2, amount=3, building=4, cons=6)),
    'consnodelbld': (7, dict(good=2, amount=3, building=4, id=5, cons=7)),
    'farmnode': (6, dict(good=2, amount=3, building=4, fsize=5, fcount=6)),
    'farmnodep': (7, dict(good=2, amount=3, building=4, fsize=5, fcount=6)),
    'farmnodec': (7, dict(good=2, amount=3, building=4, fsize=5, fcount=6, cons=7)),
    'farmnodelbld': (8, dict(good=2, amount=3, building=4, fsize=5, fcount=6, id=7)),
    'hacfarmnode': (5, dict(good=2, amount=3, fsize=4, fcount=5), 'Hacienda Farm'),
    'hacbrewnode': (3, dict(good=2, amount=3), 'Hacienda Brewery'),
    'hacbrewnodecons': (4, dict(good=2, amount=3, cons=4), 'Hacienda Brewery'),
}
for prefix, bld in [('orchnodeold', 'Orchard (Old World)'), ('orchnodenew', 'Orchard (New World)'),
                    ('chemnodeold', 'Chemical Plant (Old World)'), ('chemnodenew', 'Chemical Plant (New World)'),
                    ('asslnode', 'Assembly Line'), ('arwsnode', "Artisans' Workshop")]:
    SIG[prefix] = (3, dict(good=2, amount=3), bld)
    SIG[prefix + 'cons'] = (4, dict(good=2, amount=3, cons=4), bld)
    SIG[prefix + 'c'] = (4, dict(good=2, amount=3), bld)

# Bekannte Quellfehler: (Datei, von, nach) -> Korrektur
EDGE_FIXES = {
    # Pfeil verkehrt herum: die Schokoladenfabrik braucht Zucker + Kakao.
    ('Obrero.tex', 'Chocolate', 'Sugar'): ('Sugar', 'Chocolate'),
    # Parfüm wird aus Orchideen gemischt, nicht umgekehrt.
    ('Artistas.tex', 'Perfumes', 'Orchid'): ('Orchid', 'Perfumes'),
    # Papiermühle verarbeitet Holz zu Papier, nicht umgekehrt.
    ('Elders.tex', 'Paper', 'Wood'): ('Wood', 'Paper'),
    ('Elders.tex', 'Scriptures', 'Paper'): ('Paper', 'Scriptures'),
}

# Umbenannte Icon-IDs wie in js/goods-icons-data.js (LEGACY_ICON_RENAMES)
ICON_RENAMES = {'Oilwell': 'Oil'}

log = []


def strip_comments(text):
    return '\n'.join(re.sub(r'(?<!\\)%.*$', '', line) for line in text.split('\n'))


def read_group(text, i):
    """Liest ab text[i] == '{' eine balancierte Gruppe, gibt (inhalt, ende) zurück."""
    assert text[i] == '{'
    depth = 0
    for j in range(i, len(text)):
        if text[j] == '{':
            depth += 1
        elif text[j] == '}':
            depth -= 1
            if depth == 0:
                return text[i + 1:j], j + 1
    raise ValueError('unbalanced')


def read_args(text, i, n=None):
    args = []
    while True:
        k = i
        while k < len(text) and text[k] in ' \t':
            k += 1
        if k < len(text) and text[k] == '{' and (n is None or len(args) < n):
            arg, i = read_group(text, k)
            args.append(arg)
        else:
            return args, i


def clean_building(raw):
    b = raw.replace('\\%27', "'").replace('%27', "'").replace('_', ' ').strip()
    return b


def parse_cons(raw):
    names = []
    for part in raw.split(','):
        part = part.strip()
        if not part:
            continue
        names.append(re.split(r'[/:]', part)[0].strip())
    return names


def good_name(good):
    return good.replace('_', ' ')


def parse_box(body, where):
    nodes = {}
    order = []
    edges = []
    dividers = []
    positions = {}
    for m in re.finditer(r'\\([a-zA-Z]+)', body):
        name = m.group(1)
        if name == 'connect':
            args, _ = read_args(body, m.end(), 2)
            edge = (args[0].strip(), args[1].strip())
            fix = EDGE_FIXES.get((where.split(' ')[0],) + edge)
            if fix:
                log.append(f'{where}: Quellfehler korrigiert: \\connect{{{edge[0]}}}{{{edge[1]}}} -> {fix[0]} -> {fix[1]}')
                edge = fix
            edges.append(edge)
            continue
        if name == 'divider':
            args, _ = read_args(body, m.end(), 2)
            dividers.append((args[0].strip(), args[1].strip()))
            continue
        if name not in SIG:
            continue
        sig = SIG[name]
        nargs, fields = sig[0], sig[1]
        args, _ = read_args(body, m.end())  # alle folgenden Gruppen
        if name == 'hacbrewnode' and len(args) == 5:
            # Quellfehler: Farm-Eingang mit hacbrewnode statt hacfarmnode
            log.append(f'{where}: \\hacbrewnode{{{args[1]}}} mit 5 Argumenten -> als \\hacfarmnode gelesen')
            name = 'hacfarmnode'
            sig = SIG[name]
            nargs, fields = sig[0], sig[1]
        if len(args) < nargs:
            raise ValueError(f'{where}: {name} erwartet {nargs} Argumente, hat {len(args)}: {args}')
        args = args[:nargs]
        get = lambda f: args[fields[f] - 1].strip() if f in fields else None
        good = get('good')
        icon = ICON_RENAMES.get(good, good)
        node_id = get('id') or good
        node_id = ICON_RENAMES.get(node_id, node_id)
        building = clean_building(get('building')) if 'building' in fields else sig[2]
        fsize, fcount = get('fsize'), get('fcount')
        pos = re.findall(r'-?[0-9.]+', args[0])
        positions[node_id] = float(pos[0]) if pos else None
        node = {
            'id': node_id,
            'good': icon,
            'name': good_name(icon),
            'icon': icon,
            'amount': get('amount'),
            'building': building,
            'consumedBy': parse_cons(get('cons')) if get('cons') else [],
        }
        if fsize:
            node['fieldInfo'] = f'{fcount}x ({fsize})'
        if node_id in nodes:
            log.append(f'{where}: Knoten-ID {node_id} doppelt, zweites Vorkommen ignoriert')
            continue
        nodes[node_id] = node
        order.append(node_id)
    edges = [(ICON_RENAMES.get(a, a), ICON_RENAMES.get(b, b)) for a, b in edges]
    # Layout fließt links -> rechts: Kante nach links ist verdächtig
    for a, b in edges:
        pa, pb = positions.get(a), positions.get(b)
        if pa is not None and pb is not None and pb <= pa and nodes[a]['good'] != nodes[b]['good']:
            log.append(f'{where}: WARNUNG Kante läuft im Layout nach links: {a} ({pa}) -> {b} ({pb})')
    return nodes, order, edges, dividers


def build_chains(nodes, order, edges, dividers, where):
    for a, b in edges + dividers:
        for x in (a, b):
            if x not in nodes:
                raise ValueError(f'{where}: Kante/Divider auf unbekannten Knoten {x}')

    for a, b in edges:
        if nodes[b].get('fieldInfo') and nodes[a]['good'] != nodes[b]['good']:
            log.append(f'{where}: WARNUNG Kante in eine Farm: {a} -> {b}')

    # Vergleichs-Boxen: Kanten zwischen zwei Varianten derselben Ware
    same = [(a, b) for a, b in edges if nodes[a]['good'] == nodes[b]['good']]
    if same:
        log.append(f'{where}: Vergleichs-Box (gleiche Ware verbunden: '
                   + ', '.join(f'{a}->{b}' for a, b in same) + ') - keine Warenkette, übersprungen')
        return []

    # Divider-Varianten gruppieren (transitiv) und Ausgänge spiegeln
    parent = {n: n for n in nodes}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for a, b in dividers:
        parent[find(a)] = find(b)
    groups = defaultdict(list)
    for n in nodes:
        groups[find(n)].append(n)
    edge_set = set(edges)
    for members in groups.values():
        if len(members) < 2:
            continue
        targets = {t for m in members for (s, t) in edges if s == m}
        for m in members:
            for t in targets:
                if (m, t) not in edge_set:
                    edge_set.add((m, t))
                    log.append(f'{where}: Divider-Variante gespiegelt: {m} -> {t}')
    edges = [e for e in edges] + [e for e in edge_set if e not in edges]

    out_deg = defaultdict(int)
    preds = defaultdict(list)
    for a, b in edges:
        out_deg[a] += 1
        preds[b].append(a)
    sinks = [n for n in order if out_deg[n] == 0]
    for n in sinks:
        b = nodes[n]['building'] or ''
        if preds[n] == [] and len(nodes) > 1 or nodes[n].get('fieldInfo') or 'Lumberjack' in b or b.endswith('Mine'):
            if len(nodes) > 1:
                log.append(f'{where}: WARNUNG Endprodukt ist Rohstoff/ohne Eingang: {n}')

    # Senken, die Divider-Varianten voneinander sind, gehören zu einer Kette
    # (z.B. Vergleich ohne Endprodukt) - hier nicht zu erwarten, aber loggen.
    chains = []
    for sink in sinks:
        anc = set()
        stack = [sink]
        while stack:
            x = stack.pop()
            if x in anc:
                continue
            anc.add(x)
            stack.extend(preds[x])
        # Varianten-Geschwister eines Knotens gehören mit in die Kette
        for n in list(anc):
            anc.update(groups[find(n)])
        if sink != sinks[0] and any(find(sink) == find(s) for s in sinks[:sinks.index(sink)]):
            continue  # Variante einer schon erfassten Senke
        chain_nodes = [n for n in order if n in anc]
        chain_edges = [{'from': a, 'to': b} for a, b in edges if a in anc and b in anc]
        level = {}

        def lvl(x, seen=()):
            if x in level:
                return level[x]
            ps = [p for p in preds[x] if p in anc]
            level[x] = 0 if not ps else 1 + max(lvl(p) for p in ps)
            return level[x]
        variants_of_sink = set(groups[find(sink)])
        result = []
        for n in chain_nodes:
            node = dict(nodes[n])
            node['level'] = lvl(n)
            node['isFinal'] = n == sink
            result.append(node)
        # Varianten der Senke (ohne eigene Kante) auf Senken-Level setzen
        for node in result:
            if node['id'] in variants_of_sink and node['id'] != sink:
                node['level'] = level[sink]
        chains.append((sink, result, chain_edges))
    if len(sinks) > 1:
        log.append(f'{where}: {len(sinks)} Endprodukte in einer Box -> getrennte Ketten ({", ".join(sinks)})')
    return chains


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def parse_file(path, only_section=None):
    text = strip_comments(open(path, encoding='utf-8').read())
    result = []
    sections = [(m.start(), m.group(1)) for m in re.finditer(r'\\section\*?\{([^}]*)\}', text)]
    for si, (start, title) in enumerate(sections):
        if only_section and title != only_section:
            continue
        end = sections[si + 1][0] if si + 1 < len(sections) else len(text)
        sec = text[start:end]
        boxes = [m.start() for m in re.finditer(r'\\tcbox\[|\\begin\{tcolorbox\}\[nodebox', sec)]
        box_idx = 0
        for bi, bstart in enumerate(boxes):
            bend = boxes[bi + 1] if bi + 1 < len(boxes) else len(sec)
            body = sec[bstart:bend]
            where = f'{path.split("/")[-1]} [{title}] Box {bi}'
            nodes, order, edges, dividers = parse_box(body, where)
            if not nodes:
                log.append(f'{where}: leere Box übersprungen')
                continue
            chains = build_chains(nodes, order, edges, dividers, where)
            if not chains:
                continue
            for ci, (sink, cnodes, cedges) in enumerate(chains):
                final = next(n for n in cnodes if n['isFinal'])
                result.append({
                    'id': f'{slug(title)}-{final["good"].lower()}-{box_idx}-{ci}',
                    'category': title,
                    'targetGood': {'id': final['good'], 'name': final['name'], 'icon': final['icon']},
                    'nodes': cnodes,
                    'edges': cedges,
                })
            box_idx += 1
    return result


if __name__ == '__main__':
    src = sys.argv[1]
    files = sys.argv[2:]
    chains = []
    for f in files:
        path, _, section = f.partition('#')
        chains += parse_file(f'{src}/{path}', section or None)
    json.dump({'chains': chains, 'log': log}, sys.stdout, ensure_ascii=False, indent=2)
