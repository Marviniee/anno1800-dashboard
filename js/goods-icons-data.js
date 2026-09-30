// Referenzliste aller Waren-Icons unter assets/goods-icons/ (gleiche Icons
// wie in der Warenketten-Ansicht). Deutsche Anzeigenamen kommen aus
// data/de-translations.json über das Translations-Modul (js/translations.js).
//
// Enthält alle Waren aus den Warenketten (inkl. DLC-Welten). Neben
// "Charcoal_kiln" (siehe unten) sind auch "Tractorbarn", "Silo" und "Heater"
// ausgeschlossen: das sind im Quell-Repo als Knoten geführte Gebäude
// (Traktorscheune, Silo, Heizofen), keine Waren für die Insel-Erfassung.
//
// "Charcoal_kiln" wurde bewusst ausgeschlossen: es ist in den Ketten-Rohdaten
// nur eine alternative Icon-Variante für das Gut "Coal" (Neue-Welt-Kohle über
// die Köhlerei), zeigt aber das Gebäude-Icon (Ofen/Feuer) statt eines
// Kohle-Icons. Für die Insel-Erfassung gibt es mit "Coal" bereits das
// korrekte Rohstoff-Icon, ein zweiter "Kohle"-Eintrag mit falschem Bild wäre
// nur verwirrend.
const GOODS_ICON_LIST = [
  'Advanced_weapons', 'Alpaca_wool', 'Aluminium_Profiles', 'Atole',
  'Bauxite', 'Bear_Skin', 'Beef', 'Beer', 'Beeswax', 'Billiard_Tables',
  'Biscuits', 'Bowler_hats', 'Brass', 'Bread', 'Bricks', 'Calamari',
  'Camphor_wax', 'Candles', 'Canned_food', 'Caoutchouc', 'Carbon_filament',
  'Caribou_Meat', 'Celluloid', 'Cement', 'Ceramics', 'Champagne',
  'Chassis', 'Cherry_Wood', 'Chewing_Gum', 'Chocolate', 'Cigars',
  'Cinnamon', 'Citrus', 'Clay', 'Clay_Pipes', 'Coal', 'Cocoa',
  'Coconut_Oil', 'Coffee', 'Coffee_beans', 'Cognac', 'Copper', 'Corn',
  'Cotton', 'Cotton_fabric', 'Dried_Meat', 'Dung', 'Dynamite',
  'Electric_Cables', 'Elevators', 'Ethanol', 'Fans', 'Felt', 'Fertiliser',
  'Finery', 'Fish', 'Fish_Oil', 'Flour', 'Fried_plantains', 'Fuel', 'Furs',
  'Fur_Coats', 'Gas', 'Gas_power_plant', 'Glass', 'Glasses', 'Goat_Milk',
  'Gold', 'Gold_Ore', 'Goose_Feathers', 'Goulash', 'Grain', 'Gramophone',
  'Grapes', 'Helium', 'Herbs', 'Hibiscus_Petals', 'Hibiscus_Tea',
  'High_wheeler', 'Hops', 'Hot_sauce', 'Huskies', 'Husky_Sleds',
  'ice_cream', 'Indigo', 'Industrial_Lubricant', 'Iron', 'Jalea', 'jam',
  'Jewelry', 'Lacquer', 'Lanterns', 'Leather_Boots', 'Lemonade',
  'Light_bulb', 'Linen', 'Linseed', 'Lobsters', 'Malt', 'Mezcal', 'Milk',
  'Minerals', 'Motor', 'Mud_bricks', 'nandu_leather', 'Oil', 'Oil_Lamps',
  'Oil_Power_Plant', 'Orchid', 'Paper', 'Parkas', 'Pearls', 'Pemmican',
  'Perfumes', 'Pigments', 'Pigs', 'Plantains', 'Pocket_watch', 'Poncho',
  'Potato', 'Quartz_sand', 'Red_peppers', 'Reinforced_concrete', 'Resin',
  'Rum', 'Sails', 'Salt', 'Saltpeter', 'Sanga_Cow', 'Sausages', 'Schnapps',
  'Scooter', 'Scriptures', 'Seafood_Stew', 'Seal_Skin', 'Sewing_machines',
  'Shampoo', 'Sleds', 'Sleeping_Bags', 'Soap', 'soccer_balls', 'Souvenirs',
  'Spices', 'Steam_carriages', 'Steam_motors', 'Steel', 'Steel_beams',
  'Sugar', 'Sugar_cane', 'Tailored_Suits', 'Tallow', 'Tapestries',
  'Teff_Flour', 'Teff_Grass', 'Telephones', 'Timber', 'Tobacco',
  'Tortilla', 'Toys', 'Typewriters', 'Violins', 'Wansa_Wood', 'Weapons',
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

// Klassifikation der Rohstoffe in drei Bereiche - PRO WELT, weil dieselbe
// Ware je nach Welt anders gewonnen wird (z.B. Felle: Alte Welt Fruchtbarkeit
// "Jagdgründe", Arktis Jagdressource; Kohle: Alte Welt Mine, Arktis nur über
// die Köhlerei). In den Ketten-Rohdaten tauchen solche Varianten als eigene
// Knoten auf (Gold_Ore_n/Gold_Ore_a, Furs_o/Furs_a, Coal_o/Coal_a), im
// Datenmodell der Inseln gibt es aber nur eine gemeinsame Icon-ID - die
// Zuordnung hängt deshalb an der Welt der Insel (island.world).
//
//  - vorkommen: nicht anbaubare Rohstoffe, abgebaut/gejagt/gefangen, mit
//    Anzahl (Fundstellen bzw. Gebäude).
//  - fruchtbarkeiten: Feldfrüchte, die eine Fruchtbarkeit der Insel brauchen.
//    Binär (vorhanden oder nicht) - kein Mengenfeld.
//  - goods (Produzierte Güter): alles Übrige aus GOODS_ICON_LIST.

// Alte Welt, Neue Welt, Kap Trelawney: unverändert die bisherige, kuratierte
// Klassifikation (gemeinsame Liste für beide Hauptwelten).
//  - Saltpeter: Salpeterwerk braucht Küstenlage + Salpeter-Fruchtbarkeit,
//    ist also keine Mine.
//  - Furs (Jagdhütte) kommt auf Marvins Wunsch zu den Fruchtbarkeiten.
//  - Alpaca_wool bewusst NICHT: die Alpakafarm braucht nur Weidefläche.
const DEFAULT_CLASSIFICATION = {
  vorkommen: [
    'Bauxite', 'Cement', 'Clay', 'Coal', 'Copper', 'Gold_Ore', 'Iron', 'Oil',
    'Quartz_sand', 'Zinc',
  ],
  fruchtbarkeiten: [
    'Caoutchouc', 'Cocoa', 'Coffee_beans', 'Corn', 'Cotton', 'Furs', 'Grain',
    'Grapes', 'Hops', 'Pearls', 'Plantains', 'Potato', 'Red_peppers',
    'Saltpeter', 'Sugar_cane', 'Tobacco',
  ],
};

// DLC-Welten, geprüft an den .tex-Dateien des Quell-Repos (Explorer,
// Technician, Shepards, Elders: Gebäude + Welt-Markierung) und am
// Fandom-Wiki "Fertilities and resources". Jagd-, Fang- und Tierhaltungs-
// Ressourcen sind nicht anbaubar und zählen deshalb als Vorkommen.
const WORLD_CLASSIFICATION = {
  // Arktis: keine Fruchtbarkeiten.
  //  - Gold_Ore/Furs: eigene, weniger ergiebige Arktis-Varianten (Technician:
  //    1 Arktis-Goldmine ~ 2,5 der Neuen Welt, 1 Jagdhütte ~ 4 der Alten Welt).
  //  - Coal fehlt bewusst: Arktis-Kohle kommt laut Explorer.tex ("Coal_a")
  //    ausschließlich aus der Köhlerei (Holz), es gibt keine Kohlemine/-lager.
  //    Sie steht deshalb bei den Produzierten Gütern.
  //  - Kein Öl (weder Wiki noch Arktis-Ketten kennen einen Ölbohrturm dort).
  Arktis: {
    vorkommen: [
      'Bear_Skin', 'Caribou_Meat', 'Furs', 'Gas', 'Gold_Ore', 'Goose_Feathers',
      'Huskies', 'Seal_Skin', 'Whale_Oil',
    ],
    fruchtbarkeiten: [],
  },
  // Enbesa:
  //  - Clay ist in Elders.tex ausdrücklich als Enbesa-Variante markiert
  //    (Lehmsammler), Salt kommt aus der Saline (Shepards.tex).
  //  - Sanga-Kühe, Ziegenmilch, Hummer: Tierhaltung/Fang -> Vorkommen.
  //  - Quartz_sand und Tobacco fehlen bewusst: sie erscheinen in Elders.tex nur
  //    als Zutat (Laternen bzw. Tonpfeifen) OHNE Enbesa-Markierung, anders als
  //    Lehm im selben Rezept; Wiki führt beide nicht für Enbesa. Glas bzw.
  //    Tabak werden aus Alter bzw. Neuer Welt importiert.
  Enbesa: {
    vorkommen: ['Clay', 'Goat_Milk', 'Lobsters', 'Salt', 'Sanga_Cow'],
    fruchtbarkeiten: [
      'Beeswax', 'Hibiscus_Petals', 'Indigo', 'Linseed', 'Spices', 'Teff_Grass',
    ],
  },
};

function classificationFor(world) {
  const cls = WORLD_CLASSIFICATION[world] || DEFAULT_CLASSIFICATION;
  return {
    vorkommen: cls.vorkommen,
    fruchtbarkeiten: cls.fruchtbarkeiten,
    goods: GOODS_ICON_LIST.filter(
      (icon) => !cls.vorkommen.includes(icon) && !cls.fruchtbarkeiten.includes(icon)
    ),
  };
}
