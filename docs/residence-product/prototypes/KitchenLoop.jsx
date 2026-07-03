import { useState, useMemo } from "react";
import { Drumstick, ShoppingCart, CalendarDays, Snowflake, AlertTriangle, MapPin, Package, ChefHat, Boxes, Plus, Minus, BookOpen, Link2, Camera, PenLine, Check, X, Flame, DollarSign, Receipt, Heart, ScanLine } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// KITCHEN LOOP — household menu / grocery / freezer / recipe tile
//
// PURPOSE: One weekly loop. Recipes link ingredients to real stock; cooking a
//          meal DEPLETES that stock; whatever drops below its reorder line
//          flows to an order grouped BY SUPPLIER (Costco / online / ranch / Amazon).
// DEPENDENCIES: react, lucide-react. In-memory only (no storage APIs).
//
// IMPORT PATHS (prototype: logic+layout real, fetch/OCR mocked):
//   1. URL    — paste link → (mock) parse JSON-LD → fill fields
//   2. Photo  — book page / handwritten card → (mock) OCR → REVIEW before save
//   3. Manual — clean form you type into
// Every imported recipe keeps its SOURCE (url or photo) so the original is never lost.
// Each ingredient links to an inventory item → that link makes auto-deplete real.
// ─────────────────────────────────────────────────────────────────────────────

const RANCHES = [
  { name: "Veteran's Liberty Ranch", note: "In Liberty Hill — beef, pork, lamb, chicken, eggs" },
  { name: "Liberty Hill Farms Meat Co.", note: "In town — Angus, whole/half/quarter" },
  { name: "Bastrop Cattle Co.", note: "Bastrop — own processing, free custom butchery" },
  { name: "Smithville butcher", note: "~1 hr — local beef only (current source)" },
];

// channel: costco | online | amazon | self (garden/home-raised — never ordered)
const seedPantry = [
  { id: "p1", name: "Milk", level: 0.5, reorderAt: 0.5, full: 2, unit: "gal", channel: "costco", cat: "dairy" },
  { id: "p2", name: "Paper towels", level: 1, reorderAt: 1, full: 2, unit: "pk", channel: "costco", cat: "paper" },
  { id: "p3", name: "Toilet paper", level: 1, reorderAt: 1, full: 2, unit: "pk", channel: "costco", cat: "paper" },
  { id: "p4", name: "Tomatoes", level: 0.6, reorderAt: 0.3, full: 1, unit: "pk", channel: "costco", cat: "produce" },
  { id: "p5", name: "San Pellegrino", level: 0.7, reorderAt: 0.3, full: 1, unit: "case", channel: "costco", cat: "drinks" },
  { id: "p6", name: "Coffee", level: 3, reorderAt: 2, full: 6, unit: "bags", channel: "amazon", cat: "drinks" },
  { id: "p7", name: "Orange juice", level: 0.25, reorderAt: 0.5, full: 1, unit: "gal", channel: "heb", cat: "breakfast" },
  { id: "p8", name: "Bacon", level: 1, reorderAt: 1, full: 3, unit: "pk", channel: "heb", cat: "breakfast" },
  { id: "p9", name: "Eggs", level: 0.5, reorderAt: 0.5, full: 2, unit: "doz", channel: "heb", cat: "breakfast" },
  { id: "p10", name: "Lunch meat", level: 0.5, reorderAt: 1, full: 2, unit: "lb", channel: "heb", cat: "lunch" },
  { id: "p11", name: "Sandwich bread", level: 1, reorderAt: 1, full: 2, unit: "loaf", channel: "heb", cat: "lunch" },
  { id: "p12", name: "Pickles", level: 0.75, reorderAt: 0.25, full: 1, unit: "jar", channel: "heb", cat: "lunch" },
  { id: "p13", name: "Chips", level: 1, reorderAt: 1, full: 2, unit: "bag", channel: "heb", cat: "lunch" },
  { id: "p14", name: "Frozen french fries", level: 1, reorderAt: 0.5, full: 2, unit: "bag", channel: "heb", cat: "frozen" },
  { id: "p15", name: "Mustard", level: 1, reorderAt: 0.25, full: 1, unit: "btl", channel: "heb", cat: "condiment" },
  { id: "p16", name: "Ketchup", level: 1.5, reorderAt: 0.25, full: 2, unit: "btl", channel: "heb", cat: "condiment" },
  { id: "p17", name: "Tortillas", level: 0.5, reorderAt: 0.5, full: 1, unit: "pk", channel: "heb", cat: "pantry" },
  { id: "p18", name: "Garlic powder", level: 0.1, reorderAt: 0.2, full: 1, unit: "jar", channel: "heb", cat: "spice" },
  { id: "p19", name: "Cumin", level: 0.15, reorderAt: 0.2, full: 1, unit: "jar", channel: "heb", cat: "spice" },
  { id: "p20", name: "Paprika", level: 0.8, reorderAt: 0.2, full: 1, unit: "jar", channel: "heb", cat: "spice" },
  { id: "p21", name: "Pasta", level: 1, reorderAt: 1, full: 2, unit: "box", channel: "heb", cat: "pantry" },
  { id: "p22", name: "Salad greens", level: 0.5, reorderAt: 1, full: 2, unit: "bag", channel: "heb", cat: "produce" },
  { id: "p23", name: "Olive oil", level: 0.7, reorderAt: 0.25, full: 1, unit: "btl", channel: "heb", cat: "pantry" },
  { id: "p24", name: "Garden tomatoes", level: 0.4, reorderAt: 0, full: 1, unit: "basket", channel: "self", cat: "produce" },
  { id: "p25", name: "Mayonnaise", level: 1, reorderAt: 0.3, full: 1, unit: "oz", sizeOz: 32, channel: "costco", cat: "condiment" },
  // Household consumables — not food, same reorder mechanic. scope: shared|personal
  { id: "h1", name: "Laundry detergent", level: 0.6, reorderAt: 0.3, full: 1, unit: "jug", channel: "costco", cat: "cleaning", scope: "shared" },
  { id: "h2", name: "Clorox / bleach", level: 0.4, reorderAt: 0.3, full: 2, unit: "btl", channel: "heb", cat: "cleaning", scope: "shared" },
  { id: "h3", name: "Dish soap", level: 0.8, reorderAt: 0.25, full: 1, unit: "btl", channel: "heb", cat: "cleaning", scope: "shared" },
  { id: "h4", name: "Trash bags", level: 1, reorderAt: 0.5, full: 1, unit: "box", channel: "costco", cat: "cleaning", scope: "shared" },
  { id: "h5", name: "Sponges", level: 0.5, reorderAt: 0.25, full: 1, unit: "pk", channel: "amazon", cat: "cleaning", scope: "shared" },
  { id: "h6", name: "Hand soap", level: 0.7, reorderAt: 0.3, full: 1, unit: "btl", channel: "heb", cat: "cleaning", scope: "shared" },
  // Beverages incl. alcohol — scope:personal so it isn't surfaced to every member/viewer
  { id: "w1", name: "Red wine", level: 4, reorderAt: 2, full: 12, unit: "btl", channel: "heb", cat: "beverage", scope: "personal" },
  { id: "w2", name: "White wine", level: 2, reorderAt: 2, full: 6, unit: "btl", channel: "costco", cat: "beverage", scope: "personal" },
];

// REMEMBERED PRICES — built from receipts over time, not a live API.
// Each entry: { store, total, sizeOz, date, confidence }. Per-oz = total / sizeOz.
// confidence: CONFIRMED (from a receipt) | ESTIMATED (typed) — your cost_confidence concept.
const seedPrices = {
  p25: [ // Mayonnaise
    { store: "Costco", total: 7.49, sizeOz: 32, date: "2026-06-02", confidence: "CONFIRMED" },
    { store: "HEB", total: 4.99, sizeOz: 16, date: "2026-05-18", confidence: "CONFIRMED" },
  ],
  p9: [ // Eggs (per dozen)
    { store: "HEB", total: 3.79, sizeOz: 12, date: "2026-06-10", confidence: "CONFIRMED" }, // sizeOz used as count here
    { store: "Costco", total: 6.49, sizeOz: 24, date: "2026-05-30", confidence: "CONFIRMED" },
  ],
  p23: [ // Olive oil
    { store: "Costco", total: 16.99, sizeOz: 67, date: "2026-04-12", confidence: "CONFIRMED" },
    { store: "HEB", total: 9.49, sizeOz: 25, date: "2026-06-01", confidence: "CONFIRMED" },
  ],
  p6: [ // Coffee (per bag rather than oz — sizeOz = bags)
    { store: "Amazon", total: 38.94, sizeOz: 6, date: "2026-06-05", confidence: "CONFIRMED" },
  ],
};

// Best (lowest) per-unit price per store, from history.
function bestByStore(entries) {
  const byStore = {};
  (entries || []).forEach((e) => {
    const per = e.total / e.sizeOz;
    if (!byStore[e.store] || per < byStore[e.store].per) byStore[e.store] = { per, ...e };
  });
  return Object.values(byStore).sort((a, b) => a.per - b.per);
}

// ── INGREDIENT FORM + SUBSTITUTION ───────────────────────────────────────────
// A recipe line ("1 tsp ground cumin") must resolve to a SPECIFIC jar. Ground and
// seed are the SAME ingredient but DIFFERENT items — separate jars, never silently
// swapped. The DERIVED part is the ontology: it knows they're related, the convert
// ratio, AND the use-signal (seed = long-cook/bloom; powder = instant flavor).
// So a substitution is offered CONDITIONALLY on the dish's cook style.

// gramsPerTsp: density bridge so "1 tsp" actually moves the right jar by the right %.
const FORM_DB = {
  cumin: {
    ground: { jarGrams: 45, gramsPerTsp: 2.1 },
    seed:   { jarGrams: 50, gramsPerTsp: 2.6, grindable: true },
    // seed → ground when you grind: ~1.25 tsp seed yields ~1 tsp ground (fluffs up)
    grindRatio: 1.25,
  },
};

// Decide what to do when a recipe wants `wantForm` of `ingredient` and the shelf has
// `haveForms` (e.g. ["seed"]). cookStyle: "long" (braise/roast) | "quick" (skillet).
function resolveForm({ ingredient, wantForm, haveForms, hasGrinder, cookStyle }) {
  const has = haveForms.includes(wantForm);
  if (has) return { action: "use", note: `You have ${wantForm} — draws from that jar.` };
  const alt = haveForms.find((f) => f !== wantForm);
  if (!alt) return { action: "buy", note: `No ${ingredient} on the shelf in any form — add to list.` };
  // We have a different form. Can we substitute well?
  const db = FORM_DB[ingredient];
  if (alt === "seed" && wantForm === "ground") {
    if (hasGrinder && cookStyle === "long")
      return { action: "grind", confidence: "DERIVED",
        note: `Out of ground, but you have seed + a grinder. This dish cooks long, so grinding fresh is a fine — even better — swap. ~${db.grindRatio}× seed by volume = the ground called for.` };
    if (hasGrinder && cookStyle === "quick")
      return { action: "grind-warn", confidence: "DERIVED",
        note: `You could grind seed, but this is a quick dish — grinding mid-cook is friction. Better to keep ground stocked for instant flavor.` };
    return { action: "buy", confidence: "DERIVED",
      note: `Have seed, no grinder — seed won't dissolve in time. Buy ground.` };
  }
  if (alt === "ground" && wantForm === "seed")
    return { action: "warn", confidence: "DERIVED",
      note: `Recipe wants whole seed (for blooming/texture); you only have ground. Ground will work for flavor but loses the toasted pop. Use it or buy seed.` };
  return { action: "use", note: `Using ${alt}.` };
}

// MAKE-RECIPES — a recipe that PRODUCES a stockable item, the household version of
// Cost-to-Produce. yieldOz = how much one batch makes (same unit as the produced item).
// Each ingredient has a per-unit cost + the amount used. Make-cost/unit = Σcost ÷ yield.
// timeMin is labor, surfaced but NOT auto-priced (you decide what your time is worth).
const seedMakeRecipes = [
  {
    id: "mk1", produces: "p25", producesName: "Mayonnaise", yieldOz: 16, timeMin: 10,
    note: "Regina's mayo — 2 yolks, oil, lemon, mustard, salt.",
    ingredients: [
      { name: "Egg yolks (2)", cost: 0.63, confidence: "CONFIRMED" },   // 2 of a $3.79/doz dozen
      { name: "Olive oil (8 oz)", cost: 3.04, confidence: "CONFIRMED" }, // 8 oz @ $0.38/oz (HEB)
      { name: "Lemon (½)", cost: 0.35, confidence: "ESTIMATED" },
      { name: "Mustard + salt", cost: 0.15, confidence: "ESTIMATED" },
    ],
    // What's actually IN it — the axis Yuka can't show for homemade. flag: clean | additive
    homeLabel: [
      { name: "Egg yolks", flag: "clean" },
      { name: "Olive oil", flag: "clean" },
      { name: "Lemon juice", flag: "clean" },
      { name: "Mustard", flag: "clean" },
      { name: "Salt", flag: "clean" },
    ],
    // A typical store jar label (illustrative). Additives flagged with a plain-language why.
    storeLabel: [
      { name: "Soybean oil", flag: "clean" },
      { name: "Water", flag: "clean" },
      { name: "Eggs", flag: "clean" },
      { name: "Vinegar", flag: "clean" },
      { name: "Sugar", flag: "additive", why: "added sweetener" },
      { name: "Salt", flag: "clean" },
      { name: "Natural flavors", flag: "additive", why: "undisclosed blend" },
      { name: "Calcium disodium EDTA", flag: "additive", why: "preservative / sequestrant" },
    ],
  },
];

// Compute make-vs-buy for a produced item.
function makeVsBuy(mk, prices) {
  const ingCost = mk.ingredients.reduce((s, i) => s + i.cost, 0);
  const makePerOz = ingCost / mk.yieldOz;
  const anyEstimated = mk.ingredients.some((i) => i.confidence === "ESTIMATED");
  const makeConfidence = anyEstimated ? "ESTIMATED" : "CONFIRMED";
  const buy = bestByStore(prices[mk.produces])[0]; // cheapest remembered buy
  const buyPerOz = buy ? buy.per : null;
  const savePerOz = buyPerOz != null ? buyPerOz - makePerOz : null;
  const savePct = buyPerOz ? (savePerOz / buyPerOz) * 100 : null;
  return { ingCost, makePerOz, makeConfidence, buy, buyPerOz, savePerOz, savePct };
}

// ── HEALTH CARD ──────────────────────────────────────────────────────────────
// Two doors fill a health card:
//  • BARCODE  → national product DB lookup → ingredients + additives → DERIVED score
//  • HOMEMADE → your own recipe's clean ingredient list → CONFIRMED
// We compute OUR OWN score from open additive data — NOT the Yuka rating (no public
// API; their DB is their business). Method mirrors the public approach but is ours.
// confidence: CONFIRMED (you made it) | DERIVED (from a DB that may be stale/wrong)
//             | UNKNOWN (no data). The physical label always wins over the DB.

// Mocked national-DB barcode lookups, keyed by pantry id. Illustrative payloads.
const seedBarcodeDB = {
  p25: { // store mayo jar
    name: "Store-brand Mayonnaise, 32 oz", upc: "0007800001234",
    ingredients: ["Soybean oil", "Water", "Eggs", "Vinegar", "Sugar", "Salt", "Natural flavors", "Calcium disodium EDTA"],
    additives: [
      { name: "Sugar", risk: "low", why: "added sweetener" },
      { name: "Natural flavors", risk: "moderate", why: "undisclosed blend" },
      { name: "Calcium disodium EDTA", risk: "moderate", why: "preservative / sequestrant" },
    ],
    nutriFlags: ["high fat"],
  },
  p14: { // frozen fries
    name: "Frozen French Fries, 32 oz", upc: "0007800009876",
    ingredients: ["Potatoes", "Vegetable oil", "Dextrose", "Sodium acid pyrophosphate", "Salt"],
    additives: [
      { name: "Dextrose", risk: "low", why: "added sugar for browning" },
      { name: "Sodium acid pyrophosphate", risk: "moderate", why: "color preservative" },
    ],
    nutriFlags: ["fried", "high sodium"],
  },
};

// Compute a 0–100 health score + letter grade from a payload.
// Simple, transparent: start at 100, subtract for additives by risk and nutri flags.
function scoreHealth({ additives = [], nutriFlags = [] }) {
  let score = 100;
  additives.forEach((a) => { score -= a.risk === "high" ? 30 : a.risk === "moderate" ? 12 : 4; });
  nutriFlags.forEach(() => { score -= 8; });
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 75 ? "A" : score >= 50 ? "B" : score >= 25 ? "C" : "D";
  const color = score >= 75 ? "#3E7C5A" : score >= 50 ? "#B08227" : "#C2552E";
  return { score, grade, color };
}

// Build a card for an item from whichever door applies.
function healthCard(item, barcodeDB, makeRecipes) {
  const mk = makeRecipes.find((m) => m.produces === item.id);
  const home = mk ? {
    door: "HOMEMADE", confidence: "CONFIRMED",
    ingredients: mk.homeLabel?.map((i) => i.name) || [],
    additives: [], nutriFlags: [],
  } : null;
  const db = barcodeDB[item.id];
  const bought = db ? {
    door: "BARCODE", confidence: "DERIVED", name: db.name,
    ingredients: db.ingredients, additives: db.additives, nutriFlags: db.nutriFlags || [],
  } : null;
  return {
    home: home ? { ...home, ...scoreHealth(home) } : null,
    bought: bought ? { ...bought, ...scoreHealth(bought) } : null,
  };
}

const CATS = { dairy: "Dairy", breakfast: "Breakfast / juice", lunch: "Lunch kit", drinks: "Drinks", produce: "Produce", frozen: "Frozen", condiment: "Condiments", spice: "Spices", paper: "Paper goods", pantry: "Dry pantry", cleaning: "Cleaning & household", beverage: "Wine & spirits" };
const CAT_ORDER = ["dairy", "breakfast", "lunch", "drinks", "produce", "frozen", "condiment", "spice", "paper", "pantry", "cleaning", "beverage"];

const CHANNELS = {
  heb: { label: "HEB", icon: ShoppingCart, color: "#3E7C5A" },
  costco: { label: "Costco", icon: Package, color: "#4F6D8C" },
  amazon: { label: "Amazon", icon: Package, color: "#C2552E" },
};

// ── VARIANT MEMORY ───────────────────────────────────────────────────────────
// "Honey" isn't one thing. The reorder is a CHOICE among the variants you've actually
// bought, remembered from receipts (sku = stable Costco item number = provably same
// product). Two axes: VARIANT (wildflower vs Texas raw) and SIZE (44oz vs 24oz, where
// per-oz is the honest comparison). lastBought drives the "same as last time" default.
const VARIANT_MEMORY = {
  honey: {
    need: "Honey", axis: "variant",
    options: [
      { sku: "0000111", name: "KS Wildflower Honey", store: "Costco", size: 48, unit: "oz", price: 13.99, lastBought: "2026-03-02" },
      { sku: "0000222", name: "KS Texas Raw Unfiltered Honey", store: "Costco", size: 40, unit: "oz", price: 16.49, lastBought: "2026-05-10" },
    ],
  },
  ketchup: {
    need: "Ketchup", axis: "size",
    options: [
      { sku: "0000333", name: "Heinz Ketchup 44oz", store: "HEB", size: 44, unit: "oz", price: 4.98, lastBought: "2026-05-28" },
      { sku: "0000334", name: "Heinz Ketchup 24oz", store: "HEB", size: 24, unit: "oz", price: 3.29, lastBought: "2026-02-14" },
    ],
  },
};
function daysAgo(ymdStr, today) {
  const d = new Date(ymdStr + "T00:00:00");
  return Math.round((today - d) / 86400000);
}

// ── LOCAL SOURCE FINDER ──────────────────────────────────────────────────────
// "Look around me by ZIP" — same mechanism as the organic-meat search. A source is
// DISCOVERED near you, not hardcoded. Farmers markets are a source TYPE like the ranch:
// found by location, carrying day/season. (In the live app this calls the places/maps
// connector; here the result is seeded with real-area markets to show the experience.)
const MARKET_RESULTS = [
  { name: "Liberty Hill Farmers Market", where: "Liberty Hill · 3 mi", day: "Saturdays 9–1", season: "Apr–Nov", note: "Produce, eggs, local honey." },
  { name: "Leander Farmers Market", where: "Leander · 11 mi", day: "Saturdays 9–1", season: "year-round", note: "Veg, meat, baked goods." },
  { name: "Cedar Park Farmers Market", where: "Cedar Park · 16 mi", day: "Saturdays 9–1", season: "year-round", note: "Large; produce + prepared foods." },
];



// CATEGORY GROUPS — items that live together and run out quietly. A whiteboard "?"
// next to one ("snack bags?") means "check the whole family while you're at it."
const GROUPS = {
  bags: { label: "Storage bags", members: ["Snack bags", "Sandwich bags", "Quart freezer bags", "Gallon freezer bags", "2-gallon storage bags"] },
  spices: { label: "Spice rack", members: ["Onion powder", "Garlic powder", "Cumin", "Paprika", "Black pepper"] },
  cleaning: { label: "Cleaning supplies", members: ["Dish soap", "Clorox / bleach", "Sponges", "Hand soap", "Trash bags"] },
};
// Which group does a captured text belong to (for the "check the neighbors" sweep)?
function groupFor(text) {
  const t = text.toLowerCase();
  if (/bag/.test(t)) return "bags";
  if (/(powder|cumin|paprika|pepper|spice|salt)/.test(t)) return "spices";
  if (/(soap|bleach|clorox|sponge|detergent|trash)/.test(t)) return "cleaning";
  return null;
}

// SHELF SCAN (mock) — reflects the real spice-cabinet photos. The point is HONESTY
// about coverage: a single photo only reads the front row of a deep cabinet.
const SHELF_SCAN = {
  read: [ // CONFIRMED — clearly legible, front-facing
    "Organic Thyme", "Tarragon (HEB)", "Organic Fennel", "Cracked Rosemary", "Rubbed Sage",
    "Coriander (Spice Hunter)", "Chile Lime Seasoning", "Tikka Masala",
    "Whole Cloves", "Coriander Seed (McCormick)", "Cumin Seed (McCormick)", "Ground Mustard",
    "Garlic powder", "Turmeric", "Whole Mustard Seed", "Star Anise", "Smokey Mo's TX BBQ Rub",
    "Whole Cinnamon Sticks", "Cinnamon", "Dill", "Oregano", "Cumin", "Whole Nutmeg",
    "Black Sesame Seeds", "Ginger", "Spanish Saffron",
  ],
  unread: 14,  // jars visible behind the front row that couldn't be read
  // near-duplicates spotted across shelves — the actionable bit
  dupes: [
    { name: "Cumin", count: 3, where: "McCormick seed + Gourmet Collection + handwritten jar" },
    { name: "Coriander", count: 2, where: "McCormick seed + Spice Hunter" },
    { name: "Mustard", count: 2, where: "ground + whole seed" },
    { name: "Turmeric", count: 2, where: "Simply Organic + handwritten jar" },
    { name: "Tikka Masala", count: 2, where: "two jars, different shelves" },
  ],
};

// PURCHASE HISTORY — where things were actually bought, from past receipts.
// This is what lets the app say "you usually get this at Costco" instead of guessing.
const seedHistory = {
  "onion powder": ["heb", "heb", "costco"],   // mostly HEB, once Costco
  "snack bags": ["costco", "costco"],          // always Costco — override the HEB guess
  "ziploc": ["costco"],
  "paper plates": ["costco"],
};

// Resolve a store for a captured item. Receipt history wins; else infer from keywords;
// else default HEB. Returns { store, basis } so the UI can be honest about WHY.
function guessStore(text, history) {
  const key = text.trim().toLowerCase();
  const hist = history[key];
  if (hist?.length) {
    const counts = {};
    hist.forEach((s) => { counts[s] = (counts[s] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return { store: top[0], basis: `bought here ${top[1]}/${hist.length}× before` };
  }
  const kw = [
    [/(paper|towel|napkin|tissue|trash|bulk|case|plates|ziploc|foil)/, "costco"],
    [/(coffee|sponge|battery|batteries|filter)/, "amazon"],
  ];
  for (const [re, store] of kw) if (re.test(key)) return { store, basis: "inferred from type" };
  return { store: "heb", basis: "default" };
}

// Freezer stock. type bird|meat; freezer 1 birds, 2 red meat
const seedBank = [
  { id: "b1", name: "Whole birds (~6 lb)", have: 6, reorder: 2, unit: "birds", freezer: 1, channel: "self" },
  { id: "b2", name: "Hamburger", have: 15, reorder: 5, unit: "lb", freezer: 2, channel: "ranch" },
  { id: "b3", name: "Sausage links", have: 6, reorder: 2, unit: "links", freezer: 2, channel: "ranch" },
  { id: "b4", name: "Pork (chops/roast)", have: 4, reorder: 3, unit: "lb", freezer: 2, channel: "ranch" },
  { id: "b5", name: "Lamb", have: 3, reorder: 2, unit: "lb", freezer: 2, channel: "ranch" },
];

const seedCooked = [
  { id: "c1", name: "Regina's Ragu", have: 4, unit: "bags" },
  { id: "c2", name: "Chili", have: 2, unit: "bags" },
  { id: "c3", name: "Soup", have: 3, unit: "bags" },
];

// RECIPES — ingredients link to stock by {ref, kind}: kind 'pantry'|'bank', ref = id.
// qty is how much ONE cook depletes (in that item's unit). source preserved.
const seedRecipes = [
  {
    id: "r1", title: "Taco skillet", style: "P", servings: 4,
    source: { type: "manual", label: "Family recipe" },
    ingredients: [
      { ref: "b2", kind: "bank", name: "Hamburger", qty: 1.5, unit: "lb" },
      { ref: "p17", kind: "pantry", name: "Tortillas", qty: 0.5, unit: "pk" },
      { ref: "p19", kind: "pantry", name: "Cumin", qty: 0.05, unit: "jar" },
      { ref: "p20", kind: "pantry", name: "Paprika", qty: 0.05, unit: "jar" },
    ],
    steps: ["Brown the hamburger with cumin and paprika.", "Warm tortillas.", "Plate and top."],
  },
  {
    id: "r2", title: "Pork chops + pasta", style: "P", servings: 4,
    source: { type: "url", label: "allrecipes.com/pork-chops" },
    ingredients: [
      { ref: "b4", kind: "bank", name: "Pork (chops/roast)", qty: 2, unit: "lb" },
      { ref: "p21", kind: "pantry", name: "Pasta", qty: 0.5, unit: "box" },
      { ref: "p23", kind: "pantry", name: "Olive oil", qty: 0.05, unit: "btl" },
    ],
    steps: ["Sear chops in olive oil.", "Boil pasta.", "Rest, slice, serve."],
  },
  {
    id: "r3", title: "Grilled chicken + salad", style: "G", servings: 4,
    source: { type: "photo", label: "Grandma's card (photo kept)" },
    ingredients: [
      { ref: "b1", kind: "bank", name: "Whole birds (~6 lb)", qty: 1, unit: "birds" },
      { ref: "p22", kind: "pantry", name: "Salad greens", qty: 1, unit: "bag" },
      { ref: "p18", kind: "pantry", name: "Garlic powder", qty: 0.05, unit: "jar" },
    ],
    steps: ["Spatchcock and season the bird.", "Grill.", "Toss salad, serve."],
  },
  {
    id: "r4", title: "Spaghetti", style: "P", servings: 4,
    source: { type: "manual", label: "House staple" },
    ingredients: [
      { ref: "p21", kind: "pantry", name: "Pasta", qty: 0.5, unit: "box" },
      { ref: "p19", kind: "pantry", name: "Salt (cooking)", qty: 0.1, unit: "box" },
    ],
    steps: ["Bring ~3 qt water to a hard boil.", "Salt it heavily, then add pasta.", "Cook to al dente, sauce immediately."],
    // Technique notes — Regina's voice, typed: teach | correct | pair
    notes: [
      { type: "teach", source: "regina", text: "Salt the water like the sea — about a heavy handful (≈3 Tbsp) per pound of pasta in ~3 qt water. Most of it drains away; what stays seasons the pasta from the inside so it never tastes flat." },
      { type: "correct", source: "regina", text: "Don't oil the pasta to keep it from sticking — the oil coats the noodles and makes the sauce slide right off. Stir in the first minute instead, and sauce it the second it drains." },
      { type: "pair", source: "regina", text: "Match shape to sauce: ridged or tubular shapes (rigatoni, penne) grab thick meat sauces; long strands (spaghetti, linguine) want smoother, oilier sauces that cling." },
    ],
  },
];

// Technique note styling by type.
const NOTE_TYPE = {
  teach:   { label: "TECHNIQUE", color: "#3E7C5A", bg: "#E4EEE8" },
  correct: { label: "COMMON MYTH", color: "#C2552E", bg: "#FBE3DA" },
  pair:    { label: "PAIRING", color: "#4F6D8C", bg: "#EAF0F5" },
};

// ── DATES / WEEKS ────────────────────────────────────────────────────────────
// weekStart = 0..6 (Sun..Sat) — the household's shopping day = day one of the week.
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WD_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
// The start-of-week date for the week containing `d`, given weekStart weekday.
function weekStartOf(d, weekStart) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() - weekStart + 7) % 7;
  return addDays(x, -diff);
}
function sameDay(a, b) { return ymd(a) === ymd(b); }
// Build the 7 day-cells for a week starting at `start`.
function weekDays(start) { return Array.from({ length: 7 }, (_, i) => addDays(start, i)); }
// Build a month grid (weeks of 7), aligned to weekStart, covering the month of `monthAnchor`.
function monthGrid(monthAnchor, weekStart) {
  const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const gridStart = weekStartOf(first, weekStart);
  const weeks = [];
  let cur = gridStart;
  for (let w = 0; w < 6; w++) {
    const days = weekDays(cur);
    weeks.push(days);
    cur = addDays(cur, 7);
    // stop once we've passed the month and completed a week
    if (days[6].getMonth() !== monthAnchor.getMonth() && days[0].getMonth() !== monthAnchor.getMonth() && w >= 3) break;
  }
  return weeks;
}


const STYLE = {
  G: { label: "Grill", color: "#C2552E" }, P: { label: "One-pan", color: "#3E7C5A" },
  W: { label: "Whole bird", color: "#B08227" }, L: { label: "Leftovers", color: "#6B7280" },
  F: { label: "Freezer meal", color: "#4F6D8C" },
};
const FREEZERS = { 1: "Freezer 1 · Birds", 2: "Freezer 2 · Beef / Pork / Lamb", 3: "Freezer 3 · Cooked batches" };

export default function KitchenLoop() {
  const [tab, setTab] = useState("week");
  const [pantry, setPantry] = useState(seedPantry);
  const [bank, setBank] = useState(seedBank);
  const [cooked, setCooked] = useState(seedCooked);
  const [recipes, setRecipes] = useState(seedRecipes);
  const [prices, setPrices] = useState(seedPrices);
  const today = new Date(2026, 5, 17); // prototype "today" = Wed Jun 17 2026
  const [weekStart, setWeekStart] = useState(4); // 4 = Thursday (shopping day)
  const [selectedWeek, setSelectedWeek] = useState(() => ymd(weekStartOf(new Date(2026, 5, 17), 4)));
  const [monthAnchor, setMonthAnchor] = useState(new Date(2026, 5, 1));
  // plans keyed by week-start ymd → array of 7 recipe ids (or null). Seed current week.
  const [plans, setPlans] = useState(() => ({
    [ymd(weekStartOf(new Date(2026, 5, 17), 4))]: ["r3", "r1", null, "r4", null, "r1", "r3"],
    [ymd(addDays(weekStartOf(new Date(2026, 5, 17), 4), -7))]: ["r1", "r2", "r3", null, "r4", "r1", null], // last week (history)
  }));
  const [ranch, setRanch] = useState(RANCHES[0].name);
  const [toast, setToast] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [capture, setCapture] = useState([]);
  const [captureText, setCaptureText] = useState("");
  const [scan, setScan] = useState(null); // null | {busy} | {lines:[{text,checked}]}
  const [sweep, setSweep] = useState(null); // null | { group, checks:{member:bool} }
  const [shelfScan, setShelfScan] = useState(null); // null | {busy} | SHELF_SCAN result
  const [fd, setFd] = useState({ have: "seed", grinder: true, cook: "long" }); // form demo
  const [cookPrompt, setCookPrompt] = useState(null); // recipe awaiting "before you cook"
  const [rpChoice, setRpChoice] = useState({}); // variant-memory key -> chosen option index
  const [marketZip, setMarketZip] = useState("78642");
  const [marketSearch, setMarketSearch] = useState(null); // null | "busy" | "done"

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  // Selected week: its start date, the 7 dates, whether it's past/current/future.
  const selStart = new Date(selectedWeek + "T00:00:00");
  const curWeekStart = weekStartOf(today, weekStart);
  const selDays = weekDays(selStart);
  const isPastWeek = selStart < curWeekStart && !sameDay(selStart, curWeekStart);
  const isCurrentWeek = sameDay(selStart, curWeekStart);
  const plan = plans[selectedWeek] || [null, null, null, null, null, null, null];
  const setPlan = (next) => {
    const arr = typeof next === "function" ? next(plan) : next;
    setPlans((p) => ({ ...p, [selectedWeek]: arr }));
  };
  // When weekStart changes, re-snap the selected week to the new boundary.
  const changeWeekStart = (wd) => {
    setWeekStart(wd);
    setSelectedWeek(ymd(weekStartOf(selStart, wd)));
  };
  const gotoWeek = (startDate) => setSelectedWeek(ymd(startDate));

  // Capture inbox actions ----------------------------------------------------
  const addCapture = () => {
    const text = captureText.trim();
    if (!text) return;
    // door 1: does it already match a tracked item? then just nudge, don't create.
    const match = pantry.find((p) => p.name.toLowerCase() === text.toLowerCase());
    if (match) {
      setCaptureText("");
      flash(`"${match.name}" is already tracked — set its level on the Pantry tab instead of capturing it.`);
      return;
    }
    const g = guessStore(text, seedHistory);
    setCapture((xs) => [...xs, { id: "cap" + Date.now(), text, ...g, status: "pending", track: true }]);
    setCaptureText("");
  };
  const setCapStore = (id, store) =>
    setCapture((xs) => xs.map((c) => c.id === id ? { ...c, store, basis: "you set it" } : c));

  // Camera door: read the physical fridge whiteboard. MOCKED vision read.
  const scanWhiteboard = () => {
    setScan({ busy: true });
    setTimeout(() => {
      // Read from the real fridge photo: green shopping column only.
      // Onion powder = confident (slip "POOUDER" auto-corrected).
      // "Snack bags?" — the ? means "check the whole bag family while you're at it,"
      // not doubt about snack bags. So it opens a category sweep on commit.
      setScan({ lines: [
        { text: "Onion powder", checked: true },
        { text: "Snack bags", checked: true, sweep: "bags", note: "you wrote “?” — check the rest of the bags too" },
      ] });
    }, 1000);
  };
  const toggleScanLine = (i) =>
    setScan((s) => ({ ...s, lines: s.lines.map((l, n) => n === i ? { ...l, checked: !l.checked } : l) }));
  const editScanLine = (i, text) =>
    setScan((s) => ({ ...s, lines: s.lines.map((l, n) => n === i ? { ...l, text } : l) }));
  const commitScan = () => {
    const adds = scan.lines.filter((l) => l.checked && l.text.trim());
    setCapture((xs) => [
      ...xs,
      ...adds.map((l) => {
        const t = l.text.trim();
        return { id: "cap" + Date.now() + Math.random().toString(36).slice(2, 5), text: t, ...guessStore(t, seedHistory), status: "pending", track: true };
      }),
    ]);
    // If any added line flagged a category sweep, open the shelf-check next.
    const sweepLine = adds.find((l) => l.sweep);
    setScan(null);
    if (sweepLine) {
      const g = GROUPS[sweepLine.sweep];
      const checks = {};
      g.members.forEach((m) => { checks[m] = m.toLowerCase() === sweepLine.text.toLowerCase(); }); // the one you wrote starts checked
      setSweep({ group: sweepLine.sweep, checks });
    } else {
      flash(`Added ${adds.length} item(s) from the whiteboard. Stores guessed from your history — correct any below.`);
    }
  };
  const toggleSweep = (member) =>
    setSweep((s) => ({ ...s, checks: { ...s.checks, [member]: !s.checks[member] } }));
  const commitSweep = () => {
    const picked = Object.entries(sweep.checks).filter(([, v]) => v).map(([m]) => m);
    setCapture((xs) => {
      const have = new Set(xs.map((c) => c.text.toLowerCase()));
      const news = picked.filter((m) => !have.has(m.toLowerCase()))
        .map((m) => ({ id: "cap" + Date.now() + Math.random().toString(36).slice(2, 5), text: m, ...guessStore(m, seedHistory), status: "pending", track: true }));
      return [...xs, ...news];
    });
    const label = GROUPS[sweep.group].label;
    setSweep(null);
    flash(`${label} checked — ${picked.length} item(s) on the list.`);
  };

  const toggleTrack = (id) =>
    setCapture((xs) => xs.map((c) => c.id === id ? { ...c, track: !c.track } : c));
  const sendToList = () =>
    setCapture((xs) => xs.map((c) => c.status === "pending" ? { ...c, status: "listed" } : c));
  // Mock: a receipt comes back. Items listed for that store are marked bought;
  // tracked ones promote to real pantry inventory with a confirmed store.
  const reconcileReceipt = (store) => {
    let promoted = 0;
    setCapture((xs) => xs.map((c) => {
      if (c.status !== "listed" || c.store !== store) return c;
      if (c.track) {
        promoted++;
        setPantry((ps) => [...ps, {
          id: "p" + Date.now() + Math.floor(Math.random() * 999),
          name: c.text, level: 1, reorderAt: 0.3, full: 1, unit: "ea", channel: store, cat: "pantry",
        }]);
      }
      return { ...c, status: "bought" };
    }));
    flash(`${CHANNELS[store]?.label || store} receipt reconciled — ${promoted} item(s) became tracked inventory. Anything not on the receipt stays on the list.`);
  };

  const low = (p) => p.level <= p.reorderAt;
  const orderByChannel = (ch) => pantry.filter((p) => p.channel === ch && low(p));
  const meatOrder = bank.filter((b) => b.channel === "ranch" && b.have <= b.reorder);

  // THE CORE ACTION: cook a recipe → deplete every linked ingredient from real stock.
  const cookRecipe = (recipe) => {
    // If the dish carries technique notes, show the "before you cook" prompt first.
    if (recipe.notes?.length) { setCookPrompt(recipe); return; }
    doCook(recipe);
  };
  const doCook = (recipe) => {
    const shortfalls = [];
    recipe.ingredients.forEach((ing) => {
      if (ing.kind === "pantry") {
        const it = pantry.find((p) => p.id === ing.ref);
        if (it && it.level < ing.qty) shortfalls.push(`${it.name} (need ${ing.qty}, have ${fmt(it.level)})`);
      } else {
        const it = bank.find((b) => b.id === ing.ref);
        if (it && it.have < ing.qty) shortfalls.push(`${it.name} (need ${ing.qty}, have ${it.have})`);
      }
    });
    setPantry((xs) => xs.map((p) => {
      const ing = recipe.ingredients.find((i) => i.kind === "pantry" && i.ref === p.id);
      return ing ? { ...p, level: Math.max(0, p.level - ing.qty) } : p;
    }));
    setBank((xs) => xs.map((b) => {
      const ing = recipe.ingredients.find((i) => i.kind === "bank" && i.ref === b.id);
      return ing ? { ...b, have: Math.max(0, b.have - ing.qty) } : b;
    }));
    setCookPrompt(null);
    flash(shortfalls.length
      ? `Cooked ${recipe.title} — but stock ran short: ${shortfalls.join(", ")}`
      : `Cooked ${recipe.title}. Stock depleted; check Orders for new reorder flags.`);
  };

  // Project what the week's plan will draw down (without mutating stock yet).
  const weekNeeds = useMemo(() => {
    const need = {}; // key `${kind}:${ref}` -> qty
    plan.forEach((rid) => {
      if (!rid) return;
      const r = recipes.find((x) => x.id === rid);
      r?.ingredients.forEach((ing) => {
        if (ing.ref == null) return;
        const k = `${ing.kind}:${ing.ref}`;
        need[k] = (need[k] || 0) + ing.qty;
      });
    });
    return need;
  }, [plan, recipes]);

  // Cook every planned day at once: deplete all needs in one pass.
  const cookWeek = () => {
    setPantry((xs) => xs.map((p) => {
      const q = weekNeeds[`pantry:${p.id}`];
      return q ? { ...p, level: Math.max(0, p.level - q) } : p;
    }));
    setBank((xs) => xs.map((b) => {
      const q = weekNeeds[`bank:${b.id}`];
      return q ? { ...b, have: Math.max(0, b.have - q) } : b;
    }));
    const days = plan.filter(Boolean).length;
    flash(`Cooked the week (${days} planned meals). Stock drawn down — Orders now shows what to buy, by supplier.`);
  };

  const totalOrders = orderByChannel("costco").length + orderByChannel("heb").length + orderByChannel("amazon").length + meatOrder.length;

  return (
    <div style={S.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
        .kl-btn:focus-visible{outline:2px solid #C2552E;outline-offset:2px}
        @media (prefers-reduced-motion: no-preference){.kl-row,.kl-fill{transition:background .15s, width .2s}.kl-toast{animation:slideup .25s ease}}
        @keyframes slideup{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
        .kl-row:hover{background:#FBF7F0}
      `}</style>

      <header style={S.header}>
        <Drumstick size={22} color="#C2552E" />
        <div>
          <h1 style={S.h1}>Kitchen Loop</h1>
          <p style={S.sub}>Cook a recipe and the stock goes down by itself. The gaps become orders, grouped by where you shop.</p>
        </div>
      </header>

      <nav style={S.tabs}>
        {[["week", "This week", CalendarDays], ["capture", "Capture", PenLine], ["recipes", "Recipes", BookOpen], ["pantry", "Pantry", Boxes], ["order", "Orders", ShoppingCart], ["bank", "Freezers", Snowflake], ["costs", "Costs", DollarSign], ["health", "Health", Heart]].map(([k, label, Icon]) => (
          <button key={k} className="kl-btn" onClick={() => setTab(k)} style={{ ...S.tab, ...(tab === k ? S.tabOn : {}) }}>
            <Icon size={15} /> {label}
            {k === "order" && totalOrders > 0 && <span style={S.badge}>{totalOrders}</span>}
            {k === "capture" && capture.filter((c) => c.status === "pending").length > 0 && <span style={S.badge}>{capture.filter((c) => c.status === "pending").length}</span>}
          </button>
        ))}
      </nav>

      <main style={S.main}>
        {tab === "recipes" && (
          <section>
            <div style={S.recHead}>
              <p style={{ ...S.lead, margin: 0 }}>Your recipes. "Cook it" depletes the linked stock for real.</p>
              <button className="kl-btn" onClick={() => setImportOpen(true)} style={S.addBtn}><Plus size={14} /> Import</button>
            </div>
            {recipes.map((r) => {
              const st = STYLE[r.style] || STYLE.L;
              return (
                <div key={r.id} style={S.recCard}>
                  <div style={S.recTop}>
                    <div>
                      <div style={S.recTitle}>{r.title}</div>
                      <div style={S.recSource}><SourceIcon t={r.source.type} /> {r.source.label} · serves {r.servings}</div>
                    </div>
                    <span style={{ ...S.pill, background: st.color }}>{st.label}</span>
                  </div>
                  <div style={S.ingWrap}>
                    {r.ingredients.map((ing, i) => {
                      const it = ing.kind === "pantry" ? pantry.find((p) => p.id === ing.ref) : bank.find((b) => b.id === ing.ref);
                      const have = it ? (ing.kind === "pantry" ? it.level : it.have) : 0;
                      const short = have < ing.qty;
                      return (
                        <span key={i} style={{ ...S.ingChip, ...(short ? S.ingShort : {}) }}>
                          {ing.name} · {ing.qty}{ing.unit}{short ? " ⚠" : ""}
                        </span>
                      );
                    })}
                  </div>
                  {r.notes && <TechNotes notes={r.notes} />}
                  <button className="kl-btn" onClick={() => cookRecipe(r)} style={S.cookBtn}><Flame size={14} /> Cook it</button>
                </div>
              );
            })}
            <p style={S.tip}>Every ingredient points at a real stock item — that link is what lets cooking deplete the pantry and freezer. Edit any recipe to make it your own; the source above stays attached.</p>

            <h3 style={{ ...S.groupHead, marginTop: 20 }}>Ingredient form — “1 tsp ground cumin”</h3>
            <div style={S.fdCard}>
              <div style={S.fdLine}>Recipe calls for <b>1 tsp ground cumin</b>. What's on your shelf, and how are you cooking?</div>
              <div style={S.fdToggles}>
                <FdToggle label="Shelf has" value={fd.have} opts={[["seed", "seed"], ["ground", "ground"], ["none", "neither"]]} onSet={(v) => setFd({ ...fd, have: v })} />
                <FdToggle label="Grinder?" value={fd.grinder ? "yes" : "no"} opts={[["yes", "yes"], ["no", "no"]]} onSet={(v) => setFd({ ...fd, grinder: v === "yes" })} />
                <FdToggle label="Cooking" value={fd.cook} opts={[["long", "long braise"], ["quick", "quick dish"]]} onSet={(v) => setFd({ ...fd, cook: v })} />
              </div>
              <FormResult fd={fd} />
              <p style={S.fdFoot}>Seed and ground are the same spice but different jars — depletion always hits the right one. The substitution is DERIVED knowledge (an ingredient ontology), offered only when the cook style fits: seed for long cooks, powder for instant flavor.</p>
            </div>
          </section>
        )}

        {tab === "week" && (
          <section>
            {/* Week-start (shopping day) setting */}
            <div style={S.wkStartRow}>
              <span style={S.wkStartLabel}>Week starts (shopping day):</span>
              <select value={weekStart} onChange={(e) => changeWeekStart(Number(e.target.value))} style={S.select}>
                {WD_LONG.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>

            {/* Month calendar */}
            <div style={S.calHead}>
              <button className="kl-btn" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))} style={S.calNav}>‹</button>
              <span style={S.calTitle}>{MONTHS[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}</span>
              <button className="kl-btn" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))} style={S.calNav}>›</button>
            </div>
            <div style={S.calDow}>
              {Array.from({ length: 7 }, (_, i) => <div key={i} style={S.calDowCell}>{WD[(weekStart + i) % 7]}</div>)}
            </div>
            {monthGrid(monthAnchor, weekStart).map((wk, wi) => {
              const wkStartYmd = ymd(wk[0]);
              const isSel = wkStartYmd === selectedWeek;
              const wkIsPast = wk[0] < curWeekStart && !sameDay(wk[0], curWeekStart);
              const wkPlan = plans[wkStartYmd];
              const plannedCount = wkPlan ? wkPlan.filter(Boolean).length : 0;
              return (
                <div key={wi} className="kl-btn" onClick={() => gotoWeek(wk[0])} style={{ ...S.calWeek, ...(isSel ? S.calWeekSel : {}), opacity: wkIsPast ? 0.6 : 1 }}>
                  {wk.map((d, di) => {
                    const inMonth = d.getMonth() === monthAnchor.getMonth();
                    const isToday = sameDay(d, today);
                    const has = wkPlan && wkPlan[di];
                    return (
                      <div key={di} style={{ ...S.calDay, ...(inMonth ? {} : S.calDayDim), ...(isToday ? S.calToday : {}) }}>
                        <span>{d.getDate()}</span>
                        {has && <span style={S.calDot} />}
                      </div>
                    );
                  })}
                  {plannedCount > 0 && <div style={S.calBadge}>{plannedCount}</div>}
                </div>
              );
            })}

            {/* Selected week planner */}
            <div style={S.selWeekHead}>
              <button className="kl-btn" onClick={() => gotoWeek(addDays(selStart, -7))} style={S.calNav}>‹</button>
              <div style={S.selWeekTitle}>
                {isCurrentWeek ? "This week" : isPastWeek ? "Past week (history)" : "Upcoming week"}
                <div style={S.selWeekDates}>{MONTHS[selStart.getMonth()]} {selStart.getDate()} – {MONTHS[selDays[6].getMonth()]} {selDays[6].getDate()}</div>
              </div>
              <button className="kl-btn" onClick={() => gotoWeek(addDays(selStart, 7))} style={S.calNav}>›</button>
            </div>

            {isPastWeek && <div style={S.histNote}>This week has already passed — shown as a record of what you cooked. Editing past weeks is off; this is history to learn from.</div>}

            {selDays.map((d, i) => {
              const r = recipes.find((x) => x.id === plan[i]);
              const st = r ? (STYLE[r.style] || STYLE.L) : null;
              const isToday = sameDay(d, today);
              return (
                <div key={i}>
                  <div className="kl-row" style={{ ...S.dayRow, ...(isToday ? S.dayToday : {}) }}>
                    <div style={S.dayName}>{WD[d.getDay()]}<span style={S.dayNum}>{d.getDate()}</span></div>
                    {isPastWeek
                      ? <div style={S.pastMeal}>{r ? r.title : "—"}</div>
                      : <select value={plan[i] || ""} onChange={(e) => { const np = [...plan]; np[i] = e.target.value || null; setPlan(np); }} style={S.select}>
                          <option value="">— nothing planned —</option>
                          {recipes.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                        </select>}
                    {st && <span style={{ ...S.pill, background: st.color }}>{st.label}</span>}
                  </div>
                  {!isPastWeek && r?.notes?.length > 0 && (
                    <div style={S.dayNoteHint}>{r.notes.length} note{r.notes.length > 1 ? "s" : ""} from Regina on {r.title.toLowerCase()}.</div>
                  )}
                </div>
              );
            })}

            {!isPastWeek && <button className="kl-btn" onClick={cookWeek} style={S.cookWeekBtn}><Flame size={15} /> Cook the week — draw down stock</button>}

            <h3 style={{ ...S.groupHead, marginTop: 18 }}>{isPastWeek ? "What that week used" : "What this week will use"}</h3>
            {Object.keys(weekNeeds).length === 0
              ? <p style={S.empty}>Nothing planned, or planned recipes have unlinked ingredients.</p>
              : Object.entries(weekNeeds).map(([k, q]) => {
                const [kind, ref] = k.split(":");
                const it = kind === "pantry" ? pantry.find((p) => p.id === ref) : bank.find((b) => b.id === ref);
                if (!it) return null;
                const have = kind === "pantry" ? it.level : it.have;
                const short = have < q;
                return (
                  <div key={k} style={S.orderRow}>
                    <span>{it.name}</span>
                    <span style={{ ...S.qty, color: short ? "#C2552E" : "#6B5E4C" }}>
                      need {fmt(q)} · have {fmt(have)} {it.unit}{short ? " ⚠ short" : ""}
                    </span>
                  </div>
                );
              })}
            <p style={S.tip}>Home-raised birds and garden produce draw down here too, but never turn into a purchase — only the things you actually buy reach Orders.</p>
          </section>
        )}

        {tab === "capture" && (
          <section>
            <p style={S.lead}>Point the camera at the fridge whiteboard. It reads the lines; you uncheck any misreads before they're added. Stores get guessed from your receipt history. (Your whiteboard stays as-is — erase it yourself when you're ready.)</p>

            {!scan && (
              <button className="kl-btn" onClick={scanWhiteboard} style={S.scanBtn}><Camera size={16} /> Scan the whiteboard</button>
            )}
            {scan?.busy && <div style={S.scanBusy}><Camera size={15} /> Reading the whiteboard…</div>}
            {scan?.lines && (
              <div style={S.reviewPanel}>
                <div style={S.reviewHead}>Found these on the board. Uncheck or fix misreads. A “?” you wrote (like on the bags) opens a quick shelf-check for the whole family after you add.</div>
                {scan.lines.map((l, i) => (
                  <div key={i} style={S.scanLine}>
                    <button className="kl-btn" onClick={() => toggleScanLine(i)} style={{ ...S.checkBox, ...(l.checked ? S.checkOn : {}) }} aria-label="toggle">
                      {l.checked && <Check size={13} />}
                    </button>
                    <div style={{ flex: 1 }}>
                      <input value={l.text} onChange={(e) => editScanLine(i, e.target.value)} style={{ ...S.input, marginBottom: 0, width: "100%", opacity: l.checked ? 1 : 0.55 }} />
                      {l.note && <div style={{ ...S.scanNote, color: l.sweep ? "#4F6D8C" : "#A89B88" }}>{l.note}</div>}
                    </div>
                    {l.sweep && <span style={S.sweepTag}>+ CHECK SHELF</span>}
                    {l.note && !l.sweep && <span style={S.lowConf} title="the camera was unsure — check this one">⚠</span>}
                  </div>
                ))}
                <div style={S.reviewActions}>
                  <button className="kl-btn" onClick={() => setScan(null)} style={S.reviewCancel}>Cancel</button>
                  <button className="kl-btn" onClick={commitScan} style={S.addBtn}><Plus size={14} /> Add checked ({scan.lines.filter((l) => l.checked).length})</button>
                </div>
              </div>
            )}

            {sweep && (
              <div style={S.reviewPanel}>
                <div style={{ ...S.reviewHead, color: "#3A516B", background: "#EAF0F5", border: "1px solid #C9D8E5" }}>
                  {GROUPS[sweep.group].label} — you flagged this family with a “?”. Tick whatever's running low while you're thinking about it.
                </div>
                {GROUPS[sweep.group].members.map((m) => (
                  <div key={m} style={S.scanLine}>
                    <button className="kl-btn" onClick={() => toggleSweep(m)} style={{ ...S.checkBox, ...(sweep.checks[m] ? S.checkOn : {}) }} aria-label="toggle">
                      {sweep.checks[m] && <Check size={13} />}
                    </button>
                    <span style={{ flex: 1, fontSize: 13.5, opacity: sweep.checks[m] ? 1 : 0.6 }}>{m}</span>
                  </div>
                ))}
                <div style={S.reviewActions}>
                  <button className="kl-btn" onClick={() => { setSweep(null); }} style={S.reviewCancel}>Skip</button>
                  <button className="kl-btn" onClick={commitSweep} style={S.addBtn}><Plus size={14} /> Add checked ({Object.values(sweep.checks).filter(Boolean).length})</button>
                </div>
              </div>
            )}

            <div style={S.capTypeRow}>
              <span style={S.capTypeLabel}>or type one</span>
              <input value={captureText} onChange={(e) => setCaptureText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCapture()}
                placeholder="Out of… (e.g. onion powder)" style={{ ...S.input, marginBottom: 0, flex: 1 }} />
              <button className="kl-btn" onClick={addCapture} style={S.addBtn}><Plus size={14} /> Add</button>
            </div>

            {capture.length === 0 && !scan && <p style={S.empty}>Nothing captured yet. Scan the whiteboard to start.</p>}

            {["pending", "listed", "bought"].map((status) => {
              const items = capture.filter((c) => c.status === status);
              if (!items.length) return null;
              const heads = { pending: "On the whiteboard", listed: "On the shopping list", bought: "Bought & reconciled" };
              return (
                <div key={status} style={{ marginBottom: 14 }}>
                  <h3 style={S.groupHead}>{heads[status]}</h3>
                  {items.map((c) => {
                    const C = CHANNELS[c.store];
                    return (
                      <div key={c.id} className="kl-row" style={S.capRow}>
                        <div style={{ flex: 1 }}>
                          <div style={{ ...S.capText, ...(status === "bought" ? { textDecoration: "line-through", color: "#A89B88" } : {}) }}>{c.text}</div>
                          <div style={S.capBasis}>
                            {status === "bought" ? "✓ on the receipt" : <>→ {C?.label || c.store} <span style={S.capWhy}>· {c.basis}</span></>}
                          </div>
                        </div>
                        {status === "pending" && (
                          <>
                            <select value={c.store} onChange={(e) => setCapStore(c.id, e.target.value)} style={S.capSelect}>
                              {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <button className="kl-btn" onClick={() => toggleTrack(c.id)} style={{ ...S.trackBtn, ...(c.track ? S.trackOn : {}) }} title="Track as inventory after buying?">
                              {c.track ? "track" : "one-off"}
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {capture.some((c) => c.status === "pending") && (
              <button className="kl-btn" onClick={sendToList} style={S.cookWeekBtn}><ShoppingCart size={15} /> Send pending items to the shopping list</button>
            )}
            {capture.some((c) => c.status === "listed") && (
              <div style={{ marginTop: 12 }}>
                <h3 style={S.groupHead}><Receipt size={12} /> Mock: a receipt comes back</h3>
                <div style={S.capReconcile}>
                  {["heb", "costco", "amazon"].map((s) => (
                    <button key={s} className="kl-btn" onClick={() => reconcileReceipt(s)} style={S.capReconcileBtn}>{CHANNELS[s].label} receipt</button>
                  ))}
                </div>
              </div>
            )}
            <p style={S.tip}>"Track" items become real inventory once a receipt confirms them — whiteboard scribble to tracked item with CONFIRMED store, in one trip. "One-off" items (birthday candles) just get bought and disappear. Nothing silently vanishes: an item is still-needed, bought, or you dropped it.</p>
          </section>
        )}

        {tab === "pantry" && (
          <section>
            <p style={S.lead}>Tap a bar to set how full it is now. The dark mark is the reorder line — drop to it and the item joins its supplier's order.</p>

            {!shelfScan && (
              <button className="kl-btn" onClick={() => { setShelfScan({ busy: true }); setTimeout(() => setShelfScan(SHELF_SCAN), 1100); }} style={S.scanBtn}>
                <Camera size={16} /> Scan a shelf
              </button>
            )}
            {shelfScan?.busy && <div style={S.scanBusy}><Camera size={15} /> Reading the shelf…</div>}
            {shelfScan?.read && (
              <div style={S.reviewPanel}>
                <div style={{ ...S.reviewHead, background: "#E4EEE8", color: "#2F6147", border: "1px solid #BBD8C8" }}>
                  Read {shelfScan.read.length} jars clearly. {shelfScan.unread} more are visible behind them but couldn't be read — reshoot the back row or add those by hand. Nothing unread is assumed empty.
                </div>

                <div style={S.shelfDupeHead}>Likely duplicates across shelves — check before buying more</div>
                {shelfScan.dupes.map((d, i) => (
                  <div key={i} style={S.shelfDupe}>
                    <span style={S.shelfDupeName}>{d.name} ×{d.count}</span>
                    <span style={S.shelfDupeWhere}>{d.where}</span>
                  </div>
                ))}
                <div style={S.shelfHint}>Suggestion: you likely never need <b>cumin</b>, <b>coriander</b>, or <b>turmeric</b> on a shopping list — consolidate the jars instead. The 26 read here can seed your spice inventory; the {shelfScan.unread} unread stay UNKNOWN until you confirm them.</div>

                <div style={S.reviewActions}>
                  <button className="kl-btn" onClick={() => setShelfScan(null)} style={S.reviewCancel}>Close</button>
                  <button className="kl-btn" onClick={() => { flash(`Seeded ${shelfScan.read.length} spices as inventory (CONFIRMED). ${shelfScan.unread} unread jars left as UNKNOWN.`); setShelfScan(null); }} style={S.addBtn}><Check size={14} /> Seed {shelfScan.read.length} read jars</button>
                </div>
              </div>
            )}

            {CAT_ORDER.map((cat) => {
              const items = pantry.filter((p) => p.cat === cat);
              if (!items.length) return null;
              return (
                <div key={cat} style={{ marginBottom: 14 }}>
                  <h3 style={S.groupHead}>{CATS[cat]}</h3>
                  {items.map((p) => <FillRow key={p.id} item={p} onSet={(lvl) => setPantry((xs) => xs.map((x) => x.id === p.id ? { ...x, level: Math.max(0, Math.min(x.full, lvl)) } : x))} low={low(p)} />)}
                </div>
              );
            })}
          </section>
        )}

        {tab === "order" && (
          <section>
            <h3 style={S.groupHead}>Low — pick before you buy</h3>
            <p style={S.lead}>When something runs low and you've bought it more than one way, the list doesn't guess — it shows what you've actually gotten before. "Same as last time" is pre-picked; change it if you want.</p>
            {Object.entries(VARIANT_MEMORY).map(([key, mem]) => (
              <RepurchaseChoice key={key} mem={mem} today={today} chosen={rpChoice[key]} onChoose={(i) => setRpChoice((c) => ({ ...c, [key]: i }))} />
            ))}

            <h3 style={{ ...S.groupHead, marginTop: 20 }}>By supplier</h3>
            {["heb", "costco", "amazon"].map((ch) => {
              const items = orderByChannel(ch); const C = CHANNELS[ch]; const Icon = C.icon;
              return (
                <div key={ch} style={{ marginBottom: 20 }}>
                  <div style={S.orderHead}><Icon size={16} color={C.color} /><h2 style={S.h2}>{C.label} ({items.length})</h2></div>
                  {items.length === 0 ? <p style={S.empty}>Above the line — nothing to get.</p>
                    : items.map((p) => <div key={p.id} style={S.orderRow}><span>{p.name}</span><span style={S.qty}>down to {fmt(p.level)} {p.unit}</span></div>)}
                </div>
              );
            })}
            <div style={S.orderHead}><MapPin size={16} color="#C2552E" /><h2 style={S.h2}>Local ranch / meat ({meatOrder.length})</h2></div>
            <select value={ranch} onChange={(e) => setRanch(e.target.value)} style={{ ...S.select, marginBottom: 8, width: "100%" }}>
              {RANCHES.map((r) => <option key={r.name}>{r.name}</option>)}
            </select>
            <p style={S.ranchNote}>{RANCHES.find((r) => r.name === ranch)?.note}</p>
            {meatOrder.length === 0 ? <p style={S.empty}>Freezer's covered. No bulk run needed.</p>
              : meatOrder.map((b) => <div key={b.id} style={S.orderRow}><span>{b.name}</span><span style={S.qty}>low — {b.have} {b.unit} left</span></div>)}

            <h3 style={{ ...S.groupHead, marginTop: 22 }}>Fresh & local — find a market near you</h3>
            <p style={S.lead}>Type a ZIP and the app looks around you — markets are a source like the ranch, found by location, not a fixed list. Handy in a new place, or when produce is in season.</p>
            <div style={S.mktRow}>
              <MapPin size={16} color="#3E7C5A" />
              <input value={marketZip} onChange={(e) => setMarketZip(e.target.value)} placeholder="ZIP" style={S.mktZip} />
              {marketSearch !== "busy"
                ? <button className="kl-btn" onClick={() => { setMarketSearch("busy"); setTimeout(() => setMarketSearch("done"), 900); }} style={S.mktBtn}>Look around me</button>
                : <span style={S.mktBusy}>Looking…</span>}
            </div>
            {marketSearch === "done" && (
              <div style={{ marginTop: 10 }}>
                {MARKET_RESULTS.map((m, i) => (
                  <div key={i} style={S.mktCard}>
                    <div style={S.mktName}>{m.name}</div>
                    <div style={S.mktMeta}>{m.where} · {m.day} · {m.season}</div>
                    <div style={S.mktNote}>{m.note}</div>
                  </div>
                ))}
                <p style={S.mktFoot}>Markets often don't give receipts — the app takes a quick "spent ~$40 at the market" so it still counts toward your number, and ties to your seasonal produce.</p>
              </div>
            )}
          </section>
        )}

        {tab === "bank" && (
          <section>
            <p style={S.lead}>Three freezers. Birds are home-raised (never ordered). Red meat hits its line → ranch order.</p>
            {[1, 2].map((fz) => (
              <div key={fz} style={{ marginBottom: 16 }}>
                <h3 style={S.groupHead}><Snowflake size={12} /> {FREEZERS[fz]}</h3>
                {bank.filter((b) => b.freezer === fz).map((b) => (
                  <div key={b.id} className="kl-row" style={S.stockRow}>
                    <span style={S.stockName}>{b.name}{b.channel === "self" && <span style={S.selfTag}>home-raised</span>}</span>
                    <span style={S.parTag}>reorder ≤{b.reorder}</span>
                    <Stepper value={b.have} unit={b.unit} low={b.have <= b.reorder}
                      onMinus={() => setBank((xs) => xs.map((x) => x.id === b.id ? { ...x, have: Math.max(0, x.have - 1) } : x))}
                      onPlus={() => setBank((xs) => xs.map((x) => x.id === b.id ? { ...x, have: x.have + 1 } : x))} />
                  </div>
                ))}
              </div>
            ))}
            <div>
              <h3 style={S.groupHead}><ChefHat size={12} /> {FREEZERS[3]}</h3>
              {cooked.map((c) => (
                <div key={c.id} className="kl-row" style={S.stockRow}>
                  <span style={S.stockName}>{c.name}</span>
                  <Stepper value={c.have} unit={c.unit} low={c.have === 0}
                    onMinus={() => setCooked((xs) => xs.map((x) => x.id === c.id ? { ...x, have: Math.max(0, x.have - 1) } : x))}
                    onPlus={() => setCooked((xs) => xs.map((x) => x.id === c.id ? { ...x, have: x.have + 1 } : x))} />
                </div>
              ))}
              <p style={S.tip}>Log Regina's ~4 bags per batch — each becomes a no-cook dinner.</p>
            </div>
          </section>
        )}

        {tab === "costs" && (
          <section>
            <p style={S.lead}>Prices you've actually paid, remembered from receipts — not a live feed. Log a haul and the per-unit price updates so you can see where each thing is cheapest.</p>
            <button className="kl-btn" onClick={() => {
              // MOCK: a Costco receipt lands, adding/updating a few price points.
              setPrices((pp) => ({
                ...pp,
                p25: [{ store: "Costco", total: 6.99, sizeOz: 32, date: "2026-06-17", confidence: "CONFIRMED" }, ...(pp.p25 || [])],
                p4: [{ store: "Costco", total: 5.49, sizeOz: 32, date: "2026-06-17", confidence: "CONFIRMED" }],
              }));
              flash("Logged Costco receipt (mock). Mayo now $6.99/32oz — per-oz price updated below.");
            }} style={S.fetchBtn}><Receipt size={14} /> Log a receipt (mock)</button>

            {pantry.filter((p) => prices[p.id]?.length).map((p) => {
              const ranked = bestByStore(prices[p.id]);
              const cheapest = ranked[0];
              const unitLabel = p.id === "p6" ? "bag" : p.id === "p9" ? "egg" : "oz";
              return (
                <div key={p.id} style={S.costCard}>
                  <div style={S.costTop}>
                    <span style={S.costName}>{p.name}</span>
                    <span style={S.confTag(cheapest.confidence)}>{cheapest.confidence}</span>
                  </div>
                  {ranked.map((r, i) => (
                    <div key={i} style={S.costRow}>
                      <span style={{ fontWeight: i === 0 ? 600 : 400, color: i === 0 ? "#3E7C5A" : "#6B5E4C" }}>
                        {r.store}{i === 0 ? " · best" : ""}
                      </span>
                      <span style={S.costPer}>{`$${r.per.toFixed(3)}`}/{unitLabel} <span style={S.costRaw}>{`($${r.total.toFixed(2)} / ${r.sizeOz})`}</span></span>
                    </div>
                  ))}
                  {ranked.length > 1 && (
                    <div style={S.costDelta}>
                      {(((ranked[ranked.length - 1].per - cheapest.per) / ranked[ranked.length - 1].per) * 100).toFixed(0)}% cheaper at {cheapest.store} per {unitLabel}
                    </div>
                  )}
                </div>
              );
            })}
            <p style={S.tip}>Next layer (not built yet): make-vs-buy. Regina's mayo recipe cost ÷ yield gives a "make cost" to set against the $/oz above — the household version of your Cost-to-Produce engine. Items you make are a "self" channel: they cost ingredients, not a purchase.</p>

            <h3 style={{ ...S.groupHead, marginTop: 22 }}><Flame size={12} /> Make vs. buy</h3>
            {seedMakeRecipes.map((mk) => {
              const r = makeVsBuy(mk, prices);
              const win = r.savePerOz != null && r.savePerOz > 0;
              return (
                <div key={mk.id} style={S.mvbCard}>
                  <div style={S.costTop}>
                    <span style={S.costName}>{mk.producesName}</span>
                    <span style={S.confTag(r.makeConfidence)}>{r.makeConfidence}</span>
                  </div>
                  <div style={S.mvbCols}>
                    <div style={{ ...S.mvbCol, borderColor: win ? "#3E7C5A" : "#E3D9C8" }}>
                      <div style={S.mvbLabel}>MAKE</div>
                      <div style={S.mvbBig}>{`$${r.makePerOz.toFixed(3)}`}<span style={S.mvbUnit}>/oz</span></div>
                      <div style={S.mvbSub}>{`$${r.ingCost.toFixed(2)}`} ingredients ÷ {mk.yieldOz} oz · ~{mk.timeMin} min</div>
                    </div>
                    <div style={{ ...S.mvbCol, borderColor: !win ? "#3E7C5A" : "#E3D9C8" }}>
                      <div style={S.mvbLabel}>BUY</div>
                      <div style={S.mvbBig}>{r.buyPerOz != null ? `$${r.buyPerOz.toFixed(3)}` : "—"}<span style={S.mvbUnit}>/oz</span></div>
                      <div style={S.mvbSub}>{r.buy ? `${r.buy.store} · $${r.buy.total.toFixed(2)} / ${r.buy.sizeOz} oz` : "no price logged"}</div>
                    </div>
                  </div>
                  {r.savePerOz != null && (
                    <div style={{ ...S.mvbVerdict, background: win ? "#E4EEE8" : "#FBF4E4", color: win ? "#2F6147" : "#8A6D27" }}>
                      {win
                        ? `Making it saves $${r.savePerOz.toFixed(3)}/oz (${r.savePct.toFixed(0)}%) — about $${(r.savePerOz * mk.yieldOz).toFixed(2)} per batch, before your ${mk.timeMin} min of labor.`
                        : `Buying is cheaper by $${(-r.savePerOz).toFixed(3)}/oz. Making it costs more here — your time isn't even counted yet.`}
                    </div>
                  )}
                  <div style={S.mvbIng}>
                    {mk.ingredients.map((i, n) => (
                      <span key={n} style={{ ...S.ingChip, ...(i.confidence === "ESTIMATED" ? { background: "#FBF4E4", color: "#8A6D27" } : {}) }}>
                        {i.name} ${i.cost.toFixed(2)}
                      </span>
                    ))}
                  </div>

                  {mk.homeLabel && mk.storeLabel && (
                    <div style={S.whatsin}>
                      <div style={S.whatsinHead}>What's actually in it</div>
                      <div style={S.whatsinCols}>
                        <div style={S.whatsinCol}>
                          <div style={S.whatsinLabel}>HOMEMADE · {mk.homeLabel.length} ingredients</div>
                          {mk.homeLabel.map((i, n) => (
                            <div key={n} style={S.whatsinItem}><span style={S.dotClean} />{i.name}</div>
                          ))}
                        </div>
                        <div style={S.whatsinCol}>
                          <div style={S.whatsinLabel}>STORE JAR · {mk.storeLabel.length} ingredients</div>
                          {mk.storeLabel.map((i, n) => (
                            <div key={n} style={S.whatsinItem} title={i.why || ""}>
                              <span style={i.flag === "additive" ? S.dotAdd : S.dotClean} />
                              <span style={i.flag === "additive" ? { color: "#C2552E" } : {}}>{i.name}</span>
                              {i.why && <span style={S.whatsinWhy}>— {i.why}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                      <p style={S.whatsinNote}>
                        {mk.storeLabel.filter((i) => i.flag === "additive").length} additive(s) in the jar that aren't in the homemade version. This is the comparison Yuka can't run — it only reads barcodes, and the homemade side has no label to scan.
                      </p>
                    </div>
                  )}

                  <p style={S.mvbNote}>{mk.note} Any ESTIMATED ingredient makes the whole make-cost ESTIMATED — the number is only as honest as its weakest input.</p>
                </div>
              );
            })}
          </section>
        )}

        {tab === "health" && (
          <section>
            <p style={S.lead}>A health card per item. Make it yourself and the card is CONFIRMED — you know every ingredient. Buy it and a barcode lookup fills the card, stamped DERIVED, because a national database can be stale or wrong. The physical label always wins.</p>
            <button className="kl-btn" onClick={() => flash("Scanned barcode (mock) → national DB returned ingredients + additives, stamped DERIVED.")} style={S.fetchBtn}><ScanLine size={14} /> Scan a barcode (mock)</button>

            {pantry.filter((p) => seedBarcodeDB[p.id] || seedMakeRecipes.some((m) => m.produces === p.id)).map((p) => {
              const card = healthCard(p, seedBarcodeDB, seedMakeRecipes);
              return (
                <div key={p.id} style={S.hcWrap}>
                  <div style={S.hcTitle}>{p.name}</div>
                  <div style={S.hcCols}>
                    <HealthSide side={card.home} fallback="No homemade recipe yet" />
                    <HealthSide side={card.bought} fallback="No barcode data yet" />
                  </div>
                  {card.home && card.bought && (
                    <div style={S.hcVerdict}>
                      Homemade scores {card.home.score} ({card.home.grade}) vs the jar's {card.bought.score} ({card.bought.grade}) — {card.bought.additives.length} additive(s) the homemade version simply doesn't have.
                    </div>
                  )}
                </div>
              );
            })}
            <p style={S.tip}>This is our own score from open additive data — not the Yuka rating (Yuka has no public API; its database is its business). And it only reaches barcoded items: the bird, garden produce, and Regina's batches have no barcode — for those, making it yourself IS the health story, and it's CONFIRMED.</p>
          </section>
        )}
      </main>

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onSave={(r) => { setRecipes((xs) => [...xs, r]); setImportOpen(false); flash(`Added "${r.title}". Link its ingredients to stock to enable auto-deplete.`); }} />}
      {cookPrompt && (
        <div style={S.overlay} onClick={() => setCookPrompt(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <h2 style={S.h2}>Before you cook — {cookPrompt.title}</h2>
              <button className="kl-btn" onClick={() => setCookPrompt(null)} style={S.xBtn}><X size={16} /></button>
            </div>
            <p style={{ ...S.lead, marginBottom: 12 }}>Regina's notes on this one — worth a glance before the pot's on.</p>
            <TechNotes notes={cookPrompt.notes} />
            <button className="kl-btn" onClick={() => doCook(cookPrompt)} style={{ ...S.cookBtn, marginTop: 12 }}><Flame size={14} /> Got it — cook & deplete stock</button>
          </div>
        </div>
      )}
      {toast && <div className="kl-toast" style={S.toast}>{toast}</div>}
    </div>
  );
}

// ── Import modal: three paths, URL first. Fetch/OCR are MOCKED (labeled as such).
function ImportModal({ onClose, onSave }) {
  const [path, setPath] = useState("url");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [ingText, setIngText] = useState("");
  const [steps, setSteps] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  const mockFetchUrl = () => {
    setBusy(true);
    setTimeout(() => {
      setTitle("Sheet-Pan Chicken Fajitas");
      setIngText("1.5 lb chicken\n2 bell peppers\n1 onion\n1 tbsp cumin\n0.5 pk tortillas");
      setSteps("Slice everything.\nToss with oil and cumin.\nRoast 425°F, 25 min.");
      setBusy(false); setReviewed(true);
    }, 900);
  };
  const mockOcr = () => {
    setBusy(true);
    setTimeout(() => {
      setTitle("Grandma's Chili  (OCR draft — check me)");
      setIngText("1 lb hamburger\n1 can beans\n1 tbsp cumin\n2 tomatoes");
      setSteps("Brown meat.\nAdd everything.\nSimmer 1 hr.");
      setBusy(false); setReviewed(true);
    }, 900);
  };

  const canSave = title.trim() && ingText.trim();
  const save = () => {
    onSave({
      id: "r" + Date.now(), title: title.trim(), style: "P", servings: 4,
      source: path === "url" ? { type: "url", label: url || "imported link" }
        : path === "photo" ? { type: "photo", label: "Photo kept · OCR draft" }
        : { type: "manual", label: "Typed by hand" },
      ingredients: ingText.split("\n").filter(Boolean).map((line) => ({ ref: null, kind: "pantry", name: line.trim(), qty: 0, unit: "", unlinked: true })),
      steps: steps.split("\n").filter(Boolean),
    });
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <h2 style={S.h2}>Import a recipe</h2>
          <button className="kl-btn" onClick={onClose} style={S.xBtn}><X size={16} /></button>
        </div>
        <div style={S.pathTabs}>
          {[["url", "From link", Link2], ["photo", "Photo / OCR", Camera], ["manual", "Type it", PenLine]].map(([k, label, Icon]) => (
            <button key={k} className="kl-btn" onClick={() => { setPath(k); setReviewed(k === "manual"); }} style={{ ...S.pathTab, ...(path === k ? S.pathTabOn : {}) }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {path === "url" && (
          <div style={S.pathBody}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a recipe URL…" style={S.input} />
            <button className="kl-btn" onClick={mockFetchUrl} disabled={busy} style={S.fetchBtn}>{busy ? "Reading page…" : "Fetch & fill"}</button>
            <p style={S.mockNote}>Prototype: parsing is mocked. Live, this reads the page's embedded recipe data (JSON-LD) and fills the fields below — then you edit.</p>
          </div>
        )}
        {path === "photo" && (
          <div style={S.pathBody}>
            <button className="kl-btn" onClick={mockOcr} disabled={busy} style={S.fetchBtn}><Camera size={14} /> {busy ? "Reading photo…" : "Take / pick photo"}</button>
            <p style={S.mockNote}>Prototype: OCR is mocked. Live, the photo is kept attached and OCR proposes a draft — you always review before saving (handwriting especially).</p>
          </div>
        )}

        {(reviewed || path === "manual") && (
          <div style={S.reviewBox}>
            {path !== "manual" && <div style={S.reviewTag}>Review the draft before saving</div>}
            <label style={S.fieldLabel}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Recipe name" style={S.input} />
            <label style={S.fieldLabel}>Ingredients (one per line)</label>
            <textarea value={ingText} onChange={(e) => setIngText(e.target.value)} placeholder={"1.5 lb hamburger\n0.5 pk tortillas\n1 tbsp cumin"} rows={5} style={S.textarea} />
            <label style={S.fieldLabel}>Steps (one per line)</label>
            <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} style={S.textarea} />
            <p style={S.mockNote}>After saving you'll link each ingredient to a stock item (e.g. "hamburger" → Freezer 2) so cooking can deplete it.</p>
            <button className="kl-btn" onClick={save} disabled={!canSave} style={{ ...S.saveBtn, opacity: canSave ? 1 : 0.5 }}><Check size={15} /> Save recipe</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SourceIcon({ t }) {
  const map = { url: Link2, photo: Camera, manual: PenLine };
  const Icon = map[t] || PenLine;
  return <Icon size={11} style={{ verticalAlign: "-1px" }} />;
}

function TechNotes({ notes, compact }) {
  if (!notes?.length) return null;
  return (
    <div style={compact ? S.tnWrapCompact : S.tnWrap}>
      {notes.map((n, i) => {
        const t = NOTE_TYPE[n.type] || NOTE_TYPE.teach;
        return (
          <div key={i} style={{ ...S.tnNote, background: t.bg }}>
            <div style={S.tnHead}>
              <span style={{ ...S.tnType, color: t.color }}>{t.label}</span>
              {n.source === "regina" && <span style={S.tnRegina}>Regina</span>}
            </div>
            <div style={S.tnText}>{n.text}</div>
          </div>
        );
      })}
    </div>
  );
}

function RepurchaseChoice({ mem, today, chosen, onChoose }) {
  const opts = mem.options;
  // default = most recently bought (same as last time)
  const lastIdx = opts.reduce((best, o, i) => daysAgo(o.lastBought, today) < daysAgo(opts[best].lastBought, today) ? i : best, 0);
  const sel = chosen != null ? chosen : lastIdx;
  const cheapestPerOz = Math.min(...opts.map((o) => o.price / o.size));
  return (
    <div style={S.rpCard}>
      <div style={S.rpHead}>
        <span style={S.rpNeed}>{mem.need} — running low</span>
        <span style={S.rpAxis}>{mem.axis === "size" ? "which size?" : "which one?"}</span>
      </div>
      {opts.map((o, i) => {
        const perOz = o.price / o.size;
        const isCheapest = perOz === cheapestPerOz;
        const isLast = i === lastIdx;
        const isSel = i === sel;
        return (
          <div key={o.sku} className="kl-btn" onClick={() => onChoose(i)} style={{ ...S.rpOpt, ...(isSel ? S.rpOptSel : {}) }}>
            <div style={S.rpRadio}>{isSel ? <span style={S.rpRadioDot} /> : null}</div>
            <div style={S.rpOptBody}>
              <div style={S.rpOptName}>{o.name}{isLast && <span style={S.rpLast}>last time</span>}</div>
              <div style={S.rpOptMeta}>
                {o.store} · {`$${o.price.toFixed(2)}`} · {o.size} {o.unit} · bought {daysAgo(o.lastBought, today)}d ago
              </div>
            </div>
            <div style={S.rpPerOz}>
              <div style={{ ...S.rpPerOzVal, color: isCheapest ? "#3E7C5A" : "#6B5E4C" }}>{`$${perOz.toFixed(3)}`}</div>
              <div style={S.rpPerOzUnit}>/{o.unit}{isCheapest ? " · best" : ""}</div>
            </div>
          </div>
        );
      })}
      {mem.axis === "size" && (
        <div style={S.rpHint}>Bigger isn't always cheaper per {opts[0].unit} — check the green tag. But only size up if you'll use it before it turns.</div>
      )}
    </div>
  );
}

function FormResult({ fd }) {
  const haveForms = fd.have === "none" ? [] : [fd.have];
  const r = resolveForm({ ingredient: "cumin", wantForm: "ground", haveForms, hasGrinder: fd.grinder, cookStyle: fd.cook });
  const toneMap = { use: "#3E7C5A", grind: "#3E7C5A", "grind-warn": "#B08227", warn: "#B08227", buy: "#C2552E" };
  const verbMap = { use: "Use what you have", grind: "Grind the seed", "grind-warn": "Better to buy ground", warn: "Use ground, with a caveat", buy: "Buy ground" };
  const tone = toneMap[r.action] || "#6B5E4C";
  const verb = verbMap[r.action] || "Decide";
  return (
    <div style={{ ...S.fdResult, borderColor: tone }}>
      <div style={{ ...S.fdVerb, color: tone }}>{verb}{r.confidence ? <span style={S.fdConf}> · {r.confidence}</span> : null}</div>
      <div style={S.fdNote}>{r.note}</div>
    </div>
  );
}

function FdToggle({ label, value, opts, onSet }) {
  return (
    <div style={S.fdToggle}>
      <div style={S.fdToggleLabel}>{label}</div>
      <div style={S.fdSeg}>
        {opts.map(([v, l]) => (
          <button key={v} className="kl-btn" onClick={() => onSet(v)} style={{ ...S.fdSegBtn, ...(value === v ? S.fdSegOn : {}) }}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function HealthSide({ side, fallback }) {
  if (!side) return <div style={S.hcSideEmpty}>{fallback}</div>;
  const confColor = side.confidence === "CONFIRMED" ? "#3E7C5A" : side.confidence === "DERIVED" ? "#B08227" : "#A89B88";
  return (
    <div style={S.hcSide}>
      <div style={S.hcSideHead}>
        <span style={S.hcDoor}>{side.door === "HOMEMADE" ? "🏠 Homemade" : "🏷️ Store"}</span>
        <span style={{ ...S.hcConf, color: confColor, borderColor: confColor }}>{side.confidence}</span>
      </div>
      <div style={S.hcScoreRow}>
        <span style={{ ...S.hcGrade, background: side.color }}>{side.grade}</span>
        <span style={S.hcScore}>{side.score}<span style={S.hcScoreMax}>/100</span></span>
      </div>
      <div style={S.hcIngList}>
        {side.ingredients.map((ing, i) => {
          const bad = side.additives.find((a) => a.name === ing);
          return (
            <div key={i} style={S.hcIng} title={bad?.why || ""}>
              <span style={bad ? S.dotAdd : S.dotClean} />
              <span style={bad ? { color: "#C2552E" } : {}}>{ing}</span>
            </div>
          );
        })}
      </div>
      {side.nutriFlags?.length > 0 && (
        <div style={S.hcFlags}>{side.nutriFlags.map((f, i) => <span key={i} style={S.hcFlag}>{f}</span>)}</div>
      )}
    </div>
  );
}

function FillRow({ item, onSet, low }) {
  const pct = (item.level / item.full) * 100;
  const linePct = (item.reorderAt / item.full) * 100;
  const color = low ? "#C2552E" : pct < 50 ? "#B08227" : "#3E7C5A";
  const handle = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    onSet(Math.round(frac * item.full * 20) / 20);
  };
  return (
    <div className="kl-row" style={S.fillRow}>
      <div style={S.fillTop}>
        <span style={S.fillName}>{item.name}{item.channel === "self" && <span style={S.selfTag}>garden</span>}{item.scope === "personal" && <span style={S.personalTag}>personal</span>}</span>
        <span style={{ ...S.fillVal, color }}>{fmt(item.level)} {item.unit}{low && item.channel !== "self" ? " · reorder" : ""}</span>
      </div>
      <div style={S.track} onClick={handle} role="slider" aria-label={`${item.name} level`} aria-valuenow={item.level} aria-valuemax={item.full} tabIndex={0}>
        <div className="kl-fill" style={{ ...S.fill, width: `${pct}%`, background: color }} />
        <div style={{ ...S.line, left: `${linePct}%` }} />
      </div>
    </div>
  );
}

function Stepper({ value, unit, low, onMinus, onPlus }) {
  return (
    <div style={S.stepper}>
      <button className="kl-btn" onClick={onMinus} style={S.step} aria-label="decrease"><Minus size={14} /></button>
      <span style={{ ...S.stepVal, color: low ? "#C2552E" : "#1F1B16" }}>{value} <span style={S.unit}>{unit}</span></span>
      <button className="kl-btn" onClick={onPlus} style={S.step} aria-label="increase"><Plus size={14} /></button>
    </div>
  );
}

function fmt(n) {
  if (n === 0) return "0";
  if (Number.isInteger(n)) return String(n);
  const frac = { 0.25: "¼", 0.5: "½", 0.75: "¾", 0.1: "~⅒", 0.15: "<¼", 0.2: "⅕", 0.6: "⅗", 0.7: "~¾", 0.8: "⅘", 0.9: "~full", 1.5: "1½", 0.4: "⅖", 0.3: "~⅓", 0.05: "dash" };
  return frac[n] || n.toFixed(2).replace(/0$/, "");
}

const S = {
  wrap: { fontFamily: "Inter, system-ui, sans-serif", maxWidth: 560, margin: "0 auto", background: "#FFFDF9", color: "#1F1B16", borderRadius: 16, border: "1px solid #ECE4D6", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.05)", position: "relative" },
  header: { display: "flex", alignItems: "center", gap: 10, padding: "20px 20px 16px", borderBottom: "1px solid #F0E9DC" },
  h1: { fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" },
  sub: { fontSize: 12.5, color: "#8A7E6D", margin: "2px 0 0" },
  tabs: { display: "flex", gap: 4, padding: "10px 12px", borderBottom: "1px solid #F0E9DC", flexWrap: "wrap" },
  tab: { display: "flex", alignItems: "center", gap: 5, border: "none", background: "transparent", color: "#8A7E6D", fontSize: 12.5, fontWeight: 500, padding: "7px 10px", borderRadius: 8, cursor: "pointer" },
  tabOn: { background: "#FBEEE4", color: "#C2552E" },
  badge: { background: "#C2552E", color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 6px", marginLeft: 2 },
  main: { padding: 18, minHeight: 280 },
  lead: { fontSize: 13, color: "#8A7E6D", margin: "0 0 14px", lineHeight: 1.5 },
  groupHead: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#A89B88", margin: "0 0 8px" },
  recHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  addBtn: { display: "flex", alignItems: "center", gap: 5, border: "none", background: "#C2552E", color: "#fff", fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer" },
  recCard: { border: "1px solid #ECE4D6", borderRadius: 12, padding: 14, marginBottom: 12, background: "#fff" },
  recTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  recTitle: { fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600 },
  recSource: { fontSize: 11, color: "#A89B88", marginTop: 2, display: "flex", alignItems: "center", gap: 4 },
  ingWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  ingChip: { fontSize: 11.5, background: "#F4EEE2", color: "#6B5E4C", padding: "3px 8px", borderRadius: 6 },
  ingShort: { background: "#FBE3DA", color: "#C2552E", fontWeight: 600 },
  cookBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", border: "1px solid #E3D9C8", background: "#FBF4EC", color: "#C2552E", fontSize: 13, fontWeight: 600, padding: "9px", borderRadius: 8, cursor: "pointer" },
  pill: { color: "#fff", fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" },
  dayRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 8 },
  dayName: { width: 38, fontWeight: 600, fontSize: 13, color: "#6B5E4C" },
  cookWeekBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", border: "none", background: "#C2552E", color: "#fff", fontSize: 13.5, fontWeight: 600, padding: "11px", borderRadius: 9, cursor: "pointer", marginTop: 12 },
  costCard: { border: "1px solid #ECE4D6", borderRadius: 12, padding: 14, marginBottom: 10, background: "#fff" },
  costTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  costName: { fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 600 },
  confTag: (c) => ({ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", padding: "2px 7px", borderRadius: 4, background: c === "CONFIRMED" ? "#E4EEE8" : "#FBF4E4", color: c === "CONFIRMED" ? "#3E7C5A" : "#B08227" }),
  costRow: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" },
  costPer: { fontVariantNumeric: "tabular-nums" },
  costRaw: { fontSize: 11, color: "#A89B88" },
  costDelta: { fontSize: 11.5, color: "#3E7C5A", fontWeight: 600, marginTop: 8, paddingTop: 8, borderTop: "1px solid #F4EEE2" },
  mvbCard: { border: "1px solid #ECE4D6", borderRadius: 12, padding: 14, marginBottom: 10, background: "#fff" },
  mvbCols: { display: "flex", gap: 10, marginBottom: 10 },
  mvbCol: { flex: 1, border: "1.5px solid #E3D9C8", borderRadius: 10, padding: "10px 12px", textAlign: "center" },
  mvbLabel: { fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#A89B88", marginBottom: 4 },
  mvbBig: { fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, color: "#1F1B16" },
  mvbUnit: { fontSize: 12, fontWeight: 400, color: "#A89B88" },
  mvbSub: { fontSize: 10.5, color: "#8A7E6D", marginTop: 4, lineHeight: 1.35 },
  mvbVerdict: { fontSize: 12.5, fontWeight: 600, padding: "9px 11px", borderRadius: 8, lineHeight: 1.4, marginBottom: 10 },
  mvbIng: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  mvbNote: { fontSize: 11, color: "#A89B88", fontStyle: "italic", margin: 0, lineHeight: 1.4 },
  whatsin: { background: "#FBF9F4", border: "1px solid #F0E9DC", borderRadius: 10, padding: 12, marginBottom: 10 },
  whatsinHead: { fontSize: 12, fontWeight: 700, color: "#6B5E4C", marginBottom: 10 },
  whatsinCols: { display: "flex", gap: 14 },
  whatsinCol: { flex: 1 },
  whatsinLabel: { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", color: "#A89B88", marginBottom: 7 },
  whatsinItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#3A352D", padding: "2px 0", lineHeight: 1.3 },
  whatsinWhy: { fontSize: 10, color: "#A89B88", fontStyle: "italic" },
  whatsinNote: { fontSize: 10.5, color: "#8A7E6D", fontStyle: "italic", margin: "10px 0 0", lineHeight: 1.4 },
  dotClean: { width: 6, height: 6, borderRadius: 3, background: "#3E7C5A", flexShrink: 0 },
  dotAdd: { width: 6, height: 6, borderRadius: 3, background: "#C2552E", flexShrink: 0 },
  hcWrap: { border: "1px solid #ECE4D6", borderRadius: 12, padding: 14, marginBottom: 12, background: "#fff" },
  hcTitle: { fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, marginBottom: 10 },
  hcCols: { display: "flex", gap: 10 },
  hcSide: { flex: 1, border: "1px solid #F0E9DC", borderRadius: 10, padding: 11, background: "#FBF9F4" },
  hcSideEmpty: { flex: 1, border: "1px dashed #E3D9C8", borderRadius: 10, padding: 11, fontSize: 11.5, color: "#A89B88", fontStyle: "italic", display: "grid", placeItems: "center", textAlign: "center", minHeight: 90 },
  hcSideHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  hcDoor: { fontSize: 11.5, fontWeight: 600, color: "#6B5E4C" },
  hcConf: { fontSize: 8.5, fontWeight: 700, letterSpacing: "0.04em", padding: "1px 5px", borderRadius: 4, border: "1px solid", background: "#fff" },
  hcScoreRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  hcGrade: { color: "#fff", fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 16, width: 26, height: 26, borderRadius: 6, display: "grid", placeItems: "center" },
  hcScore: { fontSize: 17, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  hcScoreMax: { fontSize: 11, color: "#A89B88", fontWeight: 400 },
  hcIngList: { display: "flex", flexDirection: "column", gap: 2 },
  hcIng: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#3A352D", lineHeight: 1.3 },
  hcFlags: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 },
  hcFlag: { fontSize: 9.5, background: "#FBE3DA", color: "#C2552E", padding: "1px 6px", borderRadius: 4, fontWeight: 600 },
  hcVerdict: { fontSize: 12, fontWeight: 600, color: "#2F6147", background: "#E4EEE8", padding: "9px 11px", borderRadius: 8, marginTop: 10, lineHeight: 1.4 },
  capAdd: { display: "flex", gap: 8, marginBottom: 16 },
  scanBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", border: "none", background: "#C2552E", color: "#fff", fontSize: 14, fontWeight: 600, padding: "13px", borderRadius: 10, cursor: "pointer", marginBottom: 12 },
  scanBusy: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", background: "#FBF4EC", borderRadius: 10, color: "#C2552E", fontSize: 13, fontWeight: 600, marginBottom: 12 },
  reviewPanel: { border: "1px solid #E8C5AE", background: "#FFFDF9", borderRadius: 12, padding: 14, marginBottom: 12 },
  reviewHead: { fontSize: 12, color: "#8A6D27", background: "#FBF4E4", padding: "7px 10px", borderRadius: 7, marginBottom: 12, lineHeight: 1.4 },
  scanLine: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  checkBox: { width: 24, height: 24, borderRadius: 6, border: "1.5px solid #E3D9C8", background: "#fff", display: "grid", placeItems: "center", cursor: "pointer", color: "#fff", flexShrink: 0 },
  checkOn: { background: "#3E7C5A", borderColor: "#3E7C5A" },
  lowConf: { color: "#B08227", fontSize: 15, flexShrink: 0 },
  scanNote: { fontSize: 10.5, fontStyle: "italic", marginTop: 3, lineHeight: 1.3 },
  sweepTag: { fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", color: "#3A516B", background: "#EAF0F5", border: "1px solid #C9D8E5", padding: "2px 6px", borderRadius: 4, flexShrink: 0, alignSelf: "flex-start", marginTop: 7, whiteSpace: "nowrap" },
  reviewActions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 },
  reviewCancel: { border: "1px solid #E3D9C8", background: "#fff", color: "#8A7E6D", fontSize: 12.5, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer" },
  capTypeRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingTop: 12, borderTop: "1px solid #F0E9DC" },
  capTypeLabel: { fontSize: 11.5, color: "#A89B88", fontStyle: "italic", whiteSpace: "nowrap" },
  shelfDupeHead: { fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#C2552E", margin: "4px 0 8px" },
  shelfDupe: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "5px 0", borderBottom: "1px solid #F4EEE2" },
  shelfDupeName: { fontSize: 13, fontWeight: 600, color: "#1F1B16", whiteSpace: "nowrap" },
  shelfDupeWhere: { fontSize: 11, color: "#8A7E6D", textAlign: "right" },
  shelfHint: { fontSize: 11.5, color: "#6B5E4C", background: "#FBF9F4", borderRadius: 8, padding: "9px 11px", margin: "10px 0", lineHeight: 1.45 },
  fdCard: { border: "1px solid #ECE4D6", borderRadius: 12, padding: 14, background: "#fff" },
  fdLine: { fontSize: 13, color: "#3A352D", marginBottom: 12, lineHeight: 1.45 },
  fdToggles: { display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 },
  fdToggle: { flex: "1 1 auto" },
  fdToggleLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#A89B88", marginBottom: 5 },
  fdSeg: { display: "flex", gap: 3, background: "#F4EEE2", borderRadius: 8, padding: 3 },
  fdSegBtn: { border: "none", background: "transparent", color: "#8A7E6D", fontSize: 11.5, fontWeight: 600, padding: "5px 9px", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" },
  fdSegOn: { background: "#fff", color: "#C2552E", boxShadow: "0 1px 2px rgba(0,0,0,.08)" },
  fdResult: { border: "1.5px solid", borderRadius: 10, padding: "10px 12px", marginBottom: 10 },
  fdVerb: { fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 600 },
  fdConf: { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", color: "#B08227" },
  fdNote: { fontSize: 12, color: "#4A4138", marginTop: 4, lineHeight: 1.45 },
  fdFoot: { fontSize: 11, color: "#A89B88", fontStyle: "italic", margin: 0, lineHeight: 1.4 },
  tnWrap: { display: "flex", flexDirection: "column", gap: 7, margin: "10px 0" },
  tnWrapCompact: { display: "flex", flexDirection: "column", gap: 6, marginTop: 8 },
  tnNote: { borderRadius: 9, padding: "9px 11px" },
  tnHead: { display: "flex", alignItems: "center", gap: 7, marginBottom: 4 },
  tnType: { fontSize: 9, fontWeight: 700, letterSpacing: "0.05em" },
  tnRegina: { fontSize: 9.5, fontWeight: 600, color: "#6B5A7C", background: "#EEE7F2", padding: "1px 6px", borderRadius: 4 },
  tnText: { fontSize: 12, color: "#3A352D", lineHeight: 1.45 },
  dayNoteHint: { fontSize: 11, color: "#6B5A7C", fontStyle: "italic", padding: "2px 8px 6px 46px", lineHeight: 1.35 },
  wkStartRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  wkStartLabel: { fontSize: 12.5, color: "#6B5E4C", fontWeight: 500 },
  calHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  calTitle: { fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600 },
  calNav: { width: 32, height: 32, borderRadius: 8, border: "1px solid #E3D9C8", background: "#fff", fontSize: 18, lineHeight: 1, cursor: "pointer", color: "#6B5E4C" },
  calDow: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 },
  calDowCell: { fontSize: 10, fontWeight: 600, color: "#A89B88", textAlign: "center", padding: "2px 0" },
  calWeek: { position: "relative", display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, padding: "3px", borderRadius: 8, border: "1.5px solid transparent", cursor: "pointer", marginBottom: 2, background: "transparent" },
  calWeekSel: { borderColor: "#C2552E", background: "#FBF4EC" },
  calDay: { position: "relative", aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#3A352D", borderRadius: 6 },
  calDayDim: { color: "#CFC6B6" },
  calToday: { background: "#C2552E", color: "#fff", fontWeight: 700 },
  calDot: { width: 4, height: 4, borderRadius: 2, background: "#3E7C5A", marginTop: 1 },
  calBadge: { position: "absolute", top: 1, right: 3, fontSize: 9, fontWeight: 700, color: "#C2552E" },
  selWeekHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 10, paddingTop: 12, borderTop: "1px solid #F0E9DC" },
  selWeekTitle: { textAlign: "center", fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 600 },
  selWeekDates: { fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 400, color: "#8A7E6D", marginTop: 1 },
  histNote: { fontSize: 11.5, color: "#6B5E4C", background: "#F4EEE2", borderRadius: 8, padding: "9px 11px", marginBottom: 10, lineHeight: 1.4 },
  dayToday: { background: "#FBF4EC", borderRadius: 8 },
  dayNum: { fontSize: 10, color: "#A89B88", marginLeft: 4, fontWeight: 400 },
  pastMeal: { flex: 1, fontSize: 13.5, color: "#6B5E4C", padding: "7px 0" },
  rpCard: { border: "1px solid #ECE4D6", borderRadius: 12, padding: 12, marginBottom: 12, background: "#fff" },
  rpHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 },
  rpNeed: { fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 600, color: "#C2552E" },
  rpAxis: { fontSize: 11, color: "#A89B88", fontStyle: "italic" },
  rpOpt: { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, border: "1.5px solid #F0E9DC", marginBottom: 6, cursor: "pointer", background: "#fff", textAlign: "left", width: "100%" },
  rpOptSel: { borderColor: "#C2552E", background: "#FBF4EC" },
  rpRadio: { width: 16, height: 16, borderRadius: 8, border: "2px solid #C2552E", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  rpRadioDot: { width: 8, height: 8, borderRadius: 4, background: "#C2552E" },
  rpOptBody: { flex: 1, minWidth: 0 },
  rpOptName: { fontSize: 13, fontWeight: 600, color: "#3A352D" },
  rpLast: { fontSize: 9.5, fontWeight: 600, color: "#3E7C5A", background: "#E4EEE8", padding: "1px 6px", borderRadius: 4, marginLeft: 7 },
  rpOptMeta: { fontSize: 11, color: "#8A7E6D", marginTop: 2 },
  rpPerOz: { textAlign: "right", flexShrink: 0 },
  rpPerOzVal: { fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  rpPerOzUnit: { fontSize: 9.5, color: "#A89B88" },
  rpHint: { fontSize: 11, color: "#6B5E4C", fontStyle: "italic", marginTop: 4, lineHeight: 1.4 },
  mktRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 },
  mktZip: { width: 80, border: "1px solid #E3D9C8", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "Inter, sans-serif" },
  mktBtn: { background: "#3E7C5A", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  mktBusy: { fontSize: 12.5, color: "#8A7E6D", fontStyle: "italic" },
  mktCard: { border: "1px solid #ECE4D6", borderRadius: 10, padding: "10px 12px", marginBottom: 7, background: "#fff" },
  mktName: { fontSize: 13, fontWeight: 600, color: "#3A352D" },
  mktMeta: { fontSize: 11, color: "#3E7C5A", marginTop: 2 },
  mktNote: { fontSize: 12, color: "#6B5E4C", marginTop: 3 },
  mktFoot: { fontSize: 11, color: "#A89B88", fontStyle: "italic", marginTop: 6, lineHeight: 1.4 },
  capRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px", borderRadius: 8 },
  capText: { fontSize: 13.5, fontWeight: 500 },
  capBasis: { fontSize: 11, color: "#8A7E6D", marginTop: 1 },
  capWhy: { color: "#A89B88", fontStyle: "italic" },
  capSelect: { padding: "5px 7px", borderRadius: 7, border: "1px solid #E3D9C8", background: "#fff", fontSize: 11.5, fontFamily: "inherit", color: "#1F1B16" },
  trackBtn: { border: "1px solid #E3D9C8", background: "#fff", color: "#A89B88", fontSize: 10.5, fontWeight: 600, padding: "5px 8px", borderRadius: 7, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.03em" },
  trackOn: { background: "#E4EEE8", color: "#3E7C5A", borderColor: "#BBD8C8" },
  capReconcile: { display: "flex", gap: 8, flexWrap: "wrap" },
  capReconcileBtn: { border: "1px solid #E3D9C8", background: "#FBF4EC", color: "#6B5E4C", fontSize: 12, fontWeight: 600, padding: "8px 12px", borderRadius: 8, cursor: "pointer" },
  fillRow: { padding: "8px 8px 10px", borderRadius: 8, marginBottom: 2 },
  fillTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 },
  fillName: { fontSize: 13.5, fontWeight: 500 },
  fillVal: { fontSize: 11.5, fontWeight: 600 },
  selfTag: { fontSize: 9.5, background: "#E4EEE8", color: "#3E7C5A", padding: "1px 5px", borderRadius: 4, marginLeft: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" },
  personalTag: { fontSize: 9.5, background: "#EEE7F2", color: "#6B5A7C", padding: "1px 5px", borderRadius: 4, marginLeft: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" },
  track: { position: "relative", height: 14, background: "#F0E9DC", borderRadius: 7, cursor: "pointer", overflow: "hidden" },
  fill: { position: "absolute", top: 0, left: 0, height: "100%", borderRadius: 7 },
  line: { position: "absolute", top: -2, height: 18, width: 2, background: "#1F1B16", opacity: 0.45, borderRadius: 1 },
  orderHead: { display: "flex", alignItems: "center", gap: 7, marginBottom: 8 },
  h2: { fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, margin: 0 },
  orderRow: { display: "flex", justifyContent: "space-between", padding: "8px 10px", fontSize: 13.5, borderBottom: "1px solid #F4EEE2" },
  qty: { color: "#C2552E", fontWeight: 600, fontSize: 12.5 },
  empty: { fontSize: 13, fontStyle: "italic", color: "#A89B88", padding: "4px 0" },
  ranchNote: { fontSize: 12, color: "#8A7E6D", margin: "0 0 10px", fontStyle: "italic" },
  select: { padding: "7px 9px", borderRadius: 8, border: "1px solid #E3D9C8", background: "#fff", fontSize: 13, fontFamily: "inherit", color: "#1F1B16" },
  stockRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 8 },
  stockName: { flex: 1, fontSize: 13.5, fontWeight: 500, display: "flex", alignItems: "center" },
  parTag: { fontSize: 11, color: "#A89B88", background: "#F4EEE2", padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap" },
  stepper: { display: "flex", alignItems: "center", gap: 8 },
  step: { width: 26, height: 26, borderRadius: 7, border: "1px solid #E3D9C8", background: "#fff", display: "grid", placeItems: "center", cursor: "pointer", color: "#6B5E4C" },
  stepVal: { minWidth: 56, textAlign: "center", fontSize: 13, fontWeight: 600 },
  unit: { fontSize: 11, fontWeight: 400, color: "#A89B88" },
  tip: { fontSize: 11.5, color: "#A89B88", fontStyle: "italic", margin: "10px 2px 0", lineHeight: 1.4 },
  overlay: { position: "fixed", inset: 0, background: "rgba(31,27,22,.45)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 },
  modal: { background: "#FFFDF9", borderRadius: 14, width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto", padding: 18, border: "1px solid #ECE4D6" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  xBtn: { border: "none", background: "#F4EEE2", borderRadius: 7, width: 28, height: 28, display: "grid", placeItems: "center", cursor: "pointer", color: "#6B5E4C" },
  pathTabs: { display: "flex", gap: 6, marginBottom: 14 },
  pathTab: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, border: "1px solid #E3D9C8", background: "#fff", color: "#8A7E6D", fontSize: 12, fontWeight: 500, padding: "8px", borderRadius: 8, cursor: "pointer" },
  pathTabOn: { background: "#FBEEE4", color: "#C2552E", borderColor: "#E8C5AE" },
  pathBody: { marginBottom: 6 },
  input: { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #E3D9C8", fontSize: 13, fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box" },
  textarea: { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #E3D9C8", fontSize: 13, fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box", resize: "vertical" },
  fetchBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", border: "none", background: "#3E7C5A", color: "#fff", fontSize: 13, fontWeight: 600, padding: "9px", borderRadius: 8, cursor: "pointer", marginBottom: 8 },
  mockNote: { fontSize: 11, color: "#A89B88", fontStyle: "italic", lineHeight: 1.4, margin: "0 0 4px" },
  reviewBox: { borderTop: "1px solid #F0E9DC", paddingTop: 14, marginTop: 6 },
  reviewTag: { fontSize: 11, fontWeight: 600, color: "#B08227", background: "#FBF4E4", padding: "5px 9px", borderRadius: 6, marginBottom: 10, display: "inline-block" },
  fieldLabel: { fontSize: 11.5, fontWeight: 600, color: "#6B5E4C", display: "block", marginBottom: 4 },
  saveBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", border: "none", background: "#C2552E", color: "#fff", fontSize: 13.5, fontWeight: 600, padding: "10px", borderRadius: 8, cursor: "pointer", marginTop: 4 },
  toast: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#1F1B16", color: "#FFFDF9", fontSize: 13, padding: "11px 16px", borderRadius: 10, maxWidth: 440, boxShadow: "0 4px 16px rgba(0,0,0,.2)", zIndex: 60, lineHeight: 1.4 },
};
