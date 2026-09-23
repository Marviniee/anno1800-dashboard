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
  'Advanced_weapons', 'Alpaca_wool', 'Aluminium_Profiles', 'Bauxite',
  'Bear_Skin', 'Beef', 'Beer', 'Beeswax', 'Bowler_hats', 'Brass', 'Bread',
  'Bricks', 'Canned_food', 'Caoutchouc', 'Carbon_filament', 'Caribou_Meat',
  'Cement', 'Champagne', 'Chassis', 'Chocolate', 'Cigars', 'Clay', 'Coal',
  'Cocoa', 'Coffee', 'Coffee_beans', 'Copper', 'Corn', 'Cotton',
  'Cotton_fabric', 'Dynamite', 'Felt', 'Fish', 'Fish_Oil', 'Flour',
  'Fried_plantains', 'Furs', 'Fur_Coats', 'Gas', 'Glass', 'Glasses',
  'Goat_Milk', 'Gold', 'Gold_Ore', 'Goose_Feathers', 'Goulash', 'Grain',
  'Gramophone', 'Grapes', 'Helium', 'Hibiscus_Petals', 'High_wheeler',
  'Hops', 'Huskies', 'Indigo', 'Industrial_Lubricant', 'Iron', 'Jewelry',
  'Light_bulb', 'Linseed', 'Lobsters', 'Malt', 'Mud_bricks', 'Oil',
  'Oil_Power_Plant', 'Pearls', 'Pigs', 'Plantains', 'Pocket_watch',
  'Poncho', 'Potato', 'Quartz_sand', 'Red_peppers', 'Reinforced_concrete',
  'Rum', 'Sails', 'Salt', 'Saltpeter', 'Sanga_Cow', 'Sausages', 'Schnapps',
  'Seal_Skin', 'Sewing_machines', 'Soap', 'Spices', 'Steam_carriages',
  'Steam_motors', 'Steel', 'Steel_beams', 'Sugar', 'Sugar_cane', 'Tallow',
  'Teff_Grass', 'Timber', 'Tobacco', 'Tortilla', 'Wansa_Wood', 'Weapons',
  'Whale_Oil', 'Windows', 'Wood', 'Wood_veneers', 'Wool', 'Work_clothes',
  'Zinc',
];

// Umbenannte Icon-IDs (alt -> neu), damit gespeicherte Inseln/Routen mit der
// alten ID beim Laden automatisch migriert werden:
//  - "Oilwell" zeigte das Bohrturm-Gebäude (Quell-Repo nutzt es auch für das
//    Gut, gleiche Fehlerklasse wie früher Kohle/Köhlerei). Das eigentliche
//    Waren-Icon ist das Öl-Fass (oil.png im Quell-Repo) -> ID "Oil".
const LEGACY_ICON_RENAMES = {
  Oilwell: 'Oil',
};

function canonicalIconId(id) {
  return LEGACY_ICON_RENAMES[id] || id;
}

// VORKOMMEN: echte Boden-/Minen-/Steinbruch-Funde, die abgebaut werden - kein
// Fruchtbarkeitswert nötig, keine Feldfrucht. Anzahl der Vorkommen ist
// sinnvoll (mehrere Fundstellen pro Insel möglich).
//
// DLC-Welten laut Fandom-Wiki "Fertilities and resources" (Tabelle "Regional
// Resources"):
//  - Kap Trelawney: identisch zur Alten Welt, keine eigenen Einträge nötig.
//  - Arktis: Golderz + Gas. Kein Öl (Wiki listet für die Arktis nur diese
//    beiden; auch die Arktis-Ketten im Quell-Repo enthalten keinen Ölbohrturm).
//  - Enbesa: nur Lehm. Salz ist dort KEIN Vorkommen, sondern überall
//    verfügbar ("Regional Abundance", Saline) -> Produzierte Güter.
//    Quarzsand ist in Enbesa gar kein eigener Rohstoff (Glas für Laternen
//    kommt aus der Alten Welt).
const RAW_MATERIAL_ICON_LIST = [
  'Bauxite', 'Cement', 'Clay', 'Coal', 'Copper', 'Gas', 'Gold_Ore', 'Iron',
  'Oil', 'Quartz_sand', 'Zinc',
];

// FRUCHTBARKEITEN: angebaute Feldfrüchte bzw. Farmen, die im Spiel eine
// Fruchtbarkeit auf der Insel benötigen (verifiziert: Plantains/Caoutchouc/
// Pearls brauchen jeweils eine Fruchtbarkeit; Alpaca_wool ausdrücklich NICHT
// - die Alpakafarm braucht nur Weideflächen, keine Fruchtbarkeit, deshalb
// dort nicht gelistet). Furs (Jagdgründe/Hunting Cabin) ist streng genommen
// kein Ackerbau, kommt aber auf Marvins Wunsch bewusst hier rein statt bei
// Vorkommen oder Produzierte Güter. Saltpeter wurde korrigiert: das
// Salpeterwerk braucht Küstenlage + eine Salpeter-Fruchtbarkeit, ist also
// keine Mine wie Eisen/Kohle. Fruchtbarkeit ist im Spiel binär (vorhanden
// oder nicht) - kein Mengenfeld, nur Auswahl.
//
// DLC-Welten laut Fandom-Wiki "Fertilities and resources" (Tabelle "Regional
// Fertilities"), Icons aus dem Quell-Repo dotSp0T/Anno_1800_Chains_Consumption:
//  - Kap Trelawney: identisch zur Alten Welt.
//  - Arktis: Wale (Whale_Oil), Karibus (Caribou_Meat), Robben (Seal_Skin),
//    Bären (Bear_Skin), Pelztiere (Furs, schon vorhanden). Die Arktis-Wälder
//    sind dort ebenfalls eine Fruchtbarkeit, Holz bleibt aber bei den
//    Produzierten Gütern, weil die Listen weltübergreifend gelten und Holz in
//    Alter/Neuer Welt überall verfügbar ist.
//  - Enbesa: Flachs (Linseed), Hibiskus, Tef (Teff_Grass, früher bei den
//    Produzierten Gütern - korrigiert), Indigo, Gewürze, Hummer (Lobsters),
//    Bienen (Beeswax).
const FERTILITY_ICON_LIST = [
  'Bear_Skin', 'Beeswax', 'Caoutchouc', 'Caribou_Meat', 'Cocoa',
  'Coffee_beans', 'Corn', 'Cotton', 'Furs', 'Grain', 'Grapes',
  'Hibiscus_Petals', 'Hops', 'Indigo', 'Linseed', 'Lobsters', 'Pearls',
  'Plantains', 'Potato', 'Red_peppers', 'Saltpeter', 'Seal_Skin', 'Spices',
  'Sugar_cane', 'Teff_Grass', 'Tobacco', 'Whale_Oil',
];

// PRODUZIERTE GÜTER: alles Übrige - per Gebäude/Verarbeitung entstanden,
// oder (mangels eigener Kategorie) Farm-/Fischerei-Rohstoffe ohne
// Fruchtbarkeitsbedarf, die in ihrer Welt überall verfügbar sind (Wiki:
// "Regional Abundances"): Alpaca_wool, Beef, Fish, Fish_Oil, Pigs,
// Wansa_Wood, Wood, Wool sowie aus den DLC-Welten Goose_Feathers und
// Huskies (Arktis), Goat_Milk, Sanga_Cow und Salt (Enbesa).
const PRODUCED_GOOD_ICON_LIST = GOODS_ICON_LIST.filter(
  (icon) => !RAW_MATERIAL_ICON_LIST.includes(icon) && !FERTILITY_ICON_LIST.includes(icon)
);
