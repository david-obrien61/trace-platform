# CONCEPT — Customer-Site Integration + One-Click Autopopulate
**Captured:** 2026-06-16
**Status:** CONCEPT / vision — captured so it is not lost. NOT a build instruction. Not started.
**Author of record:** David O'Brien (articulated in conversation); written up for the repo.

> This doc captures thinking from a working session that lived only in chat. It is the
> *customer-facing acquisition/integration layer* — distinct from Andrew's operator inventory
> capture (internal, tenant-scoped, no customer, no public URL). See the companion doc
> `ANDREW-decision-state.md` for the build that is actually next.

---

## The core principle (founding philosophy, applied to their website)

A business with an existing, well-designed website **does not give it up to use the platform,
and should not have to.** ("I wouldn't." — David.) Their site is one of the systems we *don't
replace.* This is the literal expression of the TRACE philosophy:

> "We don't replace your systems. We connect them, surface what matters, and fill the gaps you
> couldn't fill yourself."

Their website is theirs. We connect to it and supply the live / transactional / intelligent
capabilities it can't do on its own (live per-item availability, scan-to-cart, the missed-upsell
capture — the Regina/netting moment). **Their URL is the surface; we are the engine behind chosen
parts of it.** This is a *selling point*, not a compromise.

---

## How their URL works into the mix (integration modes)

Three ways their site and our system coexist, keeping their site intact:

1. **Their site links INTO our tenant-scoped live pages.** They keep their site as the front door;
   a "shop / our live inventory" button links into our live, tenant-scoped pages. Their site is the
   brochure; our system is the live transactional layer behind specific buttons.

2. **Subdomain delegation (likely the primary mode).** `shop.theirsite.com` (or
   `inventory.theirsite.com`) points via DNS at our platform, skinned as them. The customer sees
   *their* domain in the address bar — still "theirsite.com" to them — but the page is served by our
   tenant-scoped system. They keep their main site, brand, and URL; we live at a subdomain *of their
   domain*. This is how white-label SaaS coexists with a client's existing site without the client
   feeling they left their own web presence. Their QR codes can point at `shop.theirsite.com/plant/[id]`
   — *their* domain, our engine. (This also fixes the known QR mismatch: tags pointing at the
   customer's dead-end static site instead of tenant-scoped live pages.)

3. **Embed our components INTO their existing pages.** If their site platform allows it, our
   live-inventory / availability component renders *inside* their existing pages. Deepest form of
   "don't make them give up their site" — our capability appears within theirs.

### What QR codes actually are (plain-language, for reference)
A QR code is just a picture encoding a short piece of text — almost always a URL. Scanning reads
that text and opens it. Nothing is stored "in" the code beyond the text. So multi-business
resolution (LAWNS has one, Nursery B another, Tree Farm X another) is **already solved** by two
things the platform already has:
- **Unique ids** — each item/lot gets a unique tag id; ids don't collide across businesses.
- **Tenant scoping (RLS, AC-3, "tenant isolation absolute")** — a scan resolves to *that business's*
  data and only that business's data. LAWNS's QR can only ever surface LAWNS's rows.
QR resolving correctly across many businesses is **not a QR problem** — it's a uniqueness +
tenant-scoping problem, and tenant-scoping is already a foundational platform property. The QR is a
printed URL pointing at a tenant-scoped id.

---

## The "slick part" — one-click integration, AI does the wiring

The adoption UX, in David's words: *give it a run, you like what you see, would you like us to
integrate your site into this process? Click the button — and it does the thing.* Their inventory
shows up, their branding appears, their login works, their QR scans correctly — and they **watched
it happen without doing the technical wiring.** Then a brief guided test (scan your QR, add an item,
see it work) seals it: *"OK, yeah, that sounds pretty cool."*

This is the inverse of standard SaaS onboarding (sign up → read docs → configure DNS → SSO → map
fields → test → go live). Here the owner **clicks one button and their world assembles itself.**
The "wow" is seeing their own stuff suddenly working in our system without lifting a finger.

**The AI role (this is the Built-with-CAI thesis):** the AI does the configuration the owner would
otherwise have to understand — subdomain path wiring, QR target, content/catalog import, field
mapping — from "here's your URL, click yes." The owner never learns what a CNAME record is. **They
confirm; the AI configures.** This is the labor-flip applied to *adoption itself* (companion to D-9:
AI proposes, owner accepts).

**Why it's a wedge:** the hardest part of selling a small-business owner (Lauren/Terry) is the dread
of "this means a project — set it up, learn it, migrate." One-click-and-watch-it-populate kills that
dread before it forms. They don't imagine the integrated future — they *see* it, live, with their
own data, having done nothing.

### Honest engineering (so the magic holds, not half-holds)
The one-click experience is the *front* of a real orchestration. Its entire value is seamlessness; a
janky version destroys the wow it exists to create. Knowing what's behind it:
- **DNS / subdomain touches THEIR registrar** — the one piece that can't be fully zero-touch unless
  they delegate domain access. Make it one clear instruction ("add this record, or give us access
  and we'll do it"); do NOT imply fully-automatic and then surprise them with a step.
- **Catalog / content import is AI-assisted** (read their site, extract, map) with D-9 honesty —
  flag uncertain mappings, never silently mis-map their inventory.
- **Auth / login integration** varies by what they run.
Build this to get RIGHT. A click-and-it-mostly-populates demo (catalog half-mapped, QR pointing
wrong) in front of Lauren is worse than not demoing it.

---

## The connection: this IS the discovery arc (already spec'd — not net-new)

This vision is **v2 of the already-locked discovery arc** in `DISCOVERY_MODULE_BRIEF`. It is not a
new invention; it connects onto work that is partly built.

**The arc, end to end:**
1. **Discovery reads their site** (v0 engine — partly built: gateway, ingest, synthesis).
2. **Recognition moment** — discovery catches the gap between what they told us and their public
   footprint, and hands it back as proof we actually looked. (e.g. they enter "Steve Jobs" but the
   site lists "David O'Brien" → *"Good day — we noticed the owner is listed as David O'Brien; has
   this changed recently? You may have outdated info on your site. We also noticed your phone number
   is XXX…"* That's the *quick* look. Then a button: "Would you like us to look deeper?")
3. **Pain-point flow** — once builtwithCAI is going, the customer asks questions about their
   business, runs through a pain-point/answer-some-questions flow.
4. **Hand off to the vertical with data prepopulated** — we now have their name, business, email;
   they reach the vertical and **bam, the demo, with data pre-populated** so they see how the
   platform helps them.
5. **One-click full integration** (v2: gated surface, one-auth-two-products — the builtwithCAI
   account *is* the vertical login).

**The autopopulate / "first login already full" wow is `seed.ts`:**
`BusinessDiscoveryProfile → service_offerings` rows on account creation. The brief names the moment:
*"that first login. They didn't fill out a setup wizard. The system already knew."*

**NEAR SLICE (smaller than full v2):** per prior recon, `seed.ts` is **v0-adjacent — it does NOT
require the full v2 surface.** You can build `seed.ts` and wire it into the **existing Cultivar
signup** to get the prepopulate-on-first-login wow *without* the gated builtwithCAI front-end, the
SMS gate, or voice. This is the extractable high-wow piece when you want it.

**"One auth, two products"** (from the brief): the discovery account at builtwithCAI = the same
Supabase auth as the vertical login. Account → `business_discovery_profiles` → `businesses` row →
`service_offerings` seeded.

---

## Sequencing (so this doesn't get built out of order)

- This is the **customer-acquisition / integration layer.** It is **downstream of a working vertical
  to integrate INTO** — there has to be a platform worth one-click-integrating into (inventory
  capture + the activated cost_objects table come first).
- It is **distinct from Andrew's operator inventory capture** (internal, tenant-scoped, no
  customer, no discovery, URL-agnostic). Andrew's build is unaffected by any of this.
- The discovery arc is **phased v0 → v1 → v2** per `DISCOVERY_MODULE_BRIEF`; prior recon noted we
  were behind v0's own definition (v0 = website adapter + synthesis email; LAWNS + Backbone Valley
  as first runs).

## NOT a build instruction
This doc is captured context and direction. It is not a Thunder prompt and starts nothing. When this
becomes a build, the near slice (`seed.ts` → existing Cultivar signup) is the cheapest entry to the
wow; the full one-click integration is the v2 arc.
