# Warenketten-Import

Erzeugt `data/production-chains.json` aus den `.tex`-Rezeptdaten von
[dotSp0T/Anno_1800_Chains_Consumption](https://github.com/dotSp0T/Anno_1800_Chains_Consumption)
(CC BY-SA 4.0) und kopiert fehlende Icons nach `assets/goods-icons/`.

```bash
git clone https://github.com/dotSp0T/Anno_1800_Chains_Consumption.git /tmp/anno-src
python3 tools/chains-import/parse_chains.py /tmp/anno-src \
  "main.tex#Farmer Consumables" Materials.tex Workers.tex Jornalero.tex Artisans.tex \
  Engineer.tex Investors.tex Obrero.tex Explorer.tex Technician.tex Shepards.tex \
  Elders.tex Scholars.tex Artistas.tex Hacienda.tex Tourist.tex SkyGeneral.tex \
  SkyEngineers.tex SkyInvestors.tex Bright_Harvest.tex > /tmp/chains.json
python3 tools/chains-import/normalize.py /tmp/chains.json /tmp/anno-src/icons assets/goods-icons > /tmp/chains-norm.json
```

Aus `/tmp/chains-norm.json` wird nur der Schlüssel `chains` übernommen
(`json.dumps(..., ensure_ascii=False, indent=2)`, ohne abschließenden
Zeilenumbruch). `parse-log.json` ist das Protokoll des letzten Laufs.

Nicht importiert (Bonus-/Effekt-Tabellen ohne Güterfluss): `Palace.tex`,
`museum.tex`, `zoo.tex`, `Patents.tex`, `Airmail.tex`, `DropSupplies.tex`,
`Services.tex` (sowie `Recipes.tex`, `IronTower.tex`, `Garden.tex`).

## Was der Parser macht

- Jede `\tcbox`/`\begin{tcolorbox}[nodebox` ist eine Box; `\divider`-Varianten
  (z.B. Alte/Neue Welt) übernehmen gegenseitig ihre ausgehenden Kanten, dann
  wird die Box pro Endprodukt in eine eigene Kette zerlegt.
- Vergleichs-Boxen (Kante zwischen zwei Varianten derselben Ware, z.B.
  Arktis- vs. Neue-Welt-Goldmine, Traktor-/Silo-/Dünger-Bonus) sind keine
  Warenketten und werden übersprungen.
- Icon-IDs werden auf eine Schreibweise vereinheitlicht (die `.tex`-Dateien
  referenzieren viele Icons in anderer Groß-/Kleinschreibung als die Dateien,
  was auf GitHub Pages nicht lädt).
- Plausibilitätschecks: Kante, die im Layout nach links läuft (Ketten fließen
  links -> rechts), Kante in eine Farm, Rohstoff als Endprodukt.

## Korrigierte Quellfehler (`EDGE_FIXES`, Hacienda-Sonderfall)

- `Obrero.tex`: `\connect{Chocolate}{Sugar}` verkehrt herum (Schokolade braucht Zucker + Kakao).
- `Artistas.tex`: `\connect{Perfumes}{Orchid}` verkehrt herum.
- `Elders.tex`: `\connect{Paper}{Wood}` und `\connect{Scriptures}{Paper}` verkehrt herum.
- `Hacienda.tex`: `\hacbrewnode` für Kartoffel/Gewürze mit 5 Argumenten -> als `\hacfarmnode` gelesen.
- Gut „Öl“ nutzt im Quell-Repo das Gebäude-Icon `Oilwell` -> `Oil` (Fass, `oil.png`).
