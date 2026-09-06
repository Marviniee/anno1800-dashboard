// Referenzliste aller Waren-Icons unter assets/goods-icons/ (gleiche Icons
// wie in der Warenketten-Ansicht). Deutsche Anzeigenamen kommen aus
// data/de-translations.json über das Translations-Modul (js/translations.js).
const GOODS_ICON_LIST = [
  'Advanced_weapons', 'Alpaca_wool', 'Aluminium_Profiles', 'Bauxite', 'Beef',
  'Beer', 'Bowler_hats', 'Brass', 'Bread', 'Bricks', 'Canned_food',
  'Caoutchouc', 'Carbon_filament', 'Cement', 'Champagne', 'Charcoal_kiln',
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

// Automatisch aus data/production-chains.json abgeleitet (Node-level-Feld):
// ein Gut gehört zu RAW_MATERIAL_ICON_LIST, wenn es in JEDER Kette, in der es
// vorkommt, nur auf Level 0 auftritt (kein Vorprodukt - direkt aus einem
// Rohstoff-Gebäude wie Mine/Plantage/Ölfeld). Alle anderen (mindestens eine
// Vorstufe in mindestens einer Kette) gehören zu PRODUCED_GOOD_ICON_LIST.
// Beim Nachschlagen (September 2026, 90 Icons insgesamt) trat kein einziges
// Gut uneinheitlich auf (mal Level 0, mal höher) - die Trennung ist über
// alle Ketten hinweg eindeutig, keine Grenzfälle nötig.
const RAW_MATERIAL_ICON_LIST = [
  'Alpaca_wool', 'Bauxite', 'Beef', 'Caoutchouc', 'Cement', 'Charcoal_kiln',
  'Clay', 'Coal', 'Cocoa', 'Coffee_beans', 'Copper', 'Corn', 'Cotton',
  'Fish', 'Fish_Oil', 'Furs', 'Gold_Ore', 'Grain', 'Grapes', 'Hops', 'Iron',
  'Oilwell', 'Pearls', 'Pigs', 'Plantains', 'Potato', 'Quartz_sand',
  'Red_peppers', 'Saltpeter', 'Sugar_cane', 'Teff_Grass', 'Tobacco',
  'Wansa_Wood', 'Wood', 'Wool', 'Zinc',
];

const PRODUCED_GOOD_ICON_LIST = [
  'Advanced_weapons', 'Aluminium_Profiles', 'Beer', 'Bowler_hats', 'Brass',
  'Bread', 'Bricks', 'Canned_food', 'Carbon_filament', 'Champagne',
  'Chassis', 'Chocolate', 'Cigars', 'Coffee', 'Cotton_fabric', 'Dynamite',
  'Felt', 'Flour', 'Fried_plantains', 'Fur_Coats', 'Glass', 'Glasses',
  'Gold', 'Goulash', 'Gramophone', 'Helium', 'High_wheeler',
  'Industrial_Lubricant', 'Jewelry', 'Light_bulb', 'Malt', 'Mud_bricks',
  'Oil_Power_Plant', 'Pocket_watch', 'Poncho', 'Reinforced_concrete', 'Rum',
  'Sails', 'Sausages', 'Schnapps', 'Sewing_machines', 'Soap',
  'Steam_carriages', 'Steam_motors', 'Steel', 'Steel_beams', 'Sugar',
  'Tallow', 'Timber', 'Tortilla', 'Weapons', 'Windows', 'Wood_veneers',
  'Work_clothes',
];
