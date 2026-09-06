// Referenzliste aller Waren-Icons unter assets/goods-icons/ (gleiche Icons
// wie in der Warenketten-Ansicht). Deutsche Anzeigenamen kommen aus
// data/de-translations.json über das Translations-Modul (js/translations.js).
//
// "Charcoal_kiln" wurde bewusst ausgeschlossen: es ist in den Ketten-Rohdaten
// nur eine alternative Icon-Variante für das Gut "Coal" (Neue-Welt-Kohle über
// die Köhlerei), zeigt aber das Gebäude-Icon (Ofen/Feuer) statt eines
// Kohle-Icons. Für die Insel-Erfassung gibt es mit "Coal" bereits das
// korrekte Rohstoff-Icon, ein zweiter "Kohle"-Eintrag mit falschem Bild wäre
// nur verwirrend.
const GOODS_ICON_LIST = [
  'Advanced_weapons', 'Alpaca_wool', 'Aluminium_Profiles', 'Bauxite', 'Beef',
  'Beer', 'Bowler_hats', 'Brass', 'Bread', 'Bricks', 'Canned_food',
  'Caoutchouc', 'Carbon_filament', 'Cement', 'Champagne',
  'Chassis', 'Chocolate', 'Cigars', 'Clay', 'Coal', 'Cocoa', 'Coffee',
  'Coffee_beans', 'Copper', 'Corn', 'Cotton', 'Cotton_fabric', 'Dynamite',
  'Felt', 'Fish', 'Fish_Oil', 'Flour', 'Fried_plantains', 'Fur_Coats',
  'Furs', 'Glass', 'Glasses', 'Gold', 'Gold_Ore', 'Goulash', 'Grain',
  'Gramophone', 'Grapes', 'Helium', 'High_wheeler', 'Hops',
  'Industrial_Lubricant', 'Iron', 'Jewelry', 'Light_bulb', 'Malt',
  'Mud_bricks', 'Oil_Power_Plant', 'Oilwell', 'Pearls', 'Pigs', 'Plantains',
  'Pocket_watch', 'Poncho', 'Potato', 'Quartz_sand', 'Red_peppers',
  'Reinforced_concrete', 'Rum', 'Sails', 'Saltpeter', 'Sausages',
  'Schnapps', 'Sewing_machines', 'Soap', 'Steam_carriages', 'Steam_motors',
  'Steel', 'Steel_beams', 'Sugar', 'Sugar_cane', 'Tallow', 'Teff_Grass',
  'Timber', 'Tobacco', 'Tortilla', 'Wansa_Wood', 'Weapons', 'Windows',
  'Wood', 'Wood_veneers', 'Wool', 'Work_clothes', 'Zinc',
];

// VORKOMMEN: echte Boden-/Minen-/Steinbruch-Funde, die abgebaut werden - kein
// Fruchtbarkeitswert nötig, keine Feldfrucht. Anzahl der Vorkommen ist
// sinnvoll (mehrere Fundstellen pro Insel möglich).
const RAW_MATERIAL_ICON_LIST = [
  'Bauxite', 'Cement', 'Clay', 'Coal', 'Copper', 'Gold_Ore', 'Iron',
  'Oilwell', 'Quartz_sand', 'Saltpeter', 'Zinc',
];

// FRUCHTBARKEITEN: angebaute Feldfrüchte bzw. Farmen, die im Spiel eine
// Fruchtbarkeit auf der Insel benötigen (verifiziert: Plantains/Caoutchouc/
// Pearls brauchen jeweils eine Fruchtbarkeit; Alpaca_wool ausdrücklich NICHT
// - die Alpakafarm braucht nur Weideflächen, keine Fruchtbarkeit, deshalb
// dort nicht gelistet). Fruchtbarkeit ist im Spiel binär (vorhanden oder
// nicht) - kein Mengenfeld, nur Auswahl.
const FERTILITY_ICON_LIST = [
  'Caoutchouc', 'Cocoa', 'Coffee_beans', 'Corn', 'Cotton', 'Grain', 'Grapes',
  'Hops', 'Pearls', 'Plantains', 'Potato', 'Red_peppers', 'Sugar_cane',
  'Tobacco',
];

// PRODUZIERTE GÜTER: alles Übrige - per Gebäude/Verarbeitung entstanden,
// oder (mangels eigener Kategorie) Farm-/Jagd-/Fischerei-Rohstoffe ohne
// Fruchtbarkeitsbedarf (Alpaca_wool, Beef, Fish, Fish_Oil, Furs, Pigs,
// Teff_Grass, Wansa_Wood, Wood, Wool).
const PRODUCED_GOOD_ICON_LIST = GOODS_ICON_LIST.filter(
  (icon) => !RAW_MATERIAL_ICON_LIST.includes(icon) && !FERTILITY_ICON_LIST.includes(icon)
);
