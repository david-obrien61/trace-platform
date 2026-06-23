# CONCEPT — Social / Campaign Scheduling + Measurement (the social-intelligence surface)

**Captured:** 2026-06-23 · **Status:** NORTH-STAR design record (not a build) · **Author:** Lightning (via David)
**Family:** same family as the Regina Principle (MASTER_BRIEF PART 4) and the Delivery captures — surfacing owner-known principles against owned data, then letting the human act.

> This doc captures only the **genuinely-new layer**: the scheduling surface and the measurement layer.
> It **rides on already-locked doctrine** (cited below, NOT restated). Read the cited decisions for the
> reasoning behind aggregation, the two generators, cadence advice, and the v1 handoff boundary — this
> capture does not re-derive any of them.

---

## 0. What is already LOCKED — cited, not re-decided

This design sits ON these prior decisions. Point to them; do not re-explain them.

- **Weekly-aggregate, not per-sale spam** *(locked, June 5)* — 6 sales become ONE "the trees are flying 🌳"
  post, not 6. Aggregation IS the moat: the value is generation-from-business-context, not post volume.
- **Two generators, one voice** *(locked, June 15 — see `docs/ai-gateway/GENERATORS-COMPARE.md`)* — **social** =
  ongoing sales-driven rhythm (retrospective, rolling sales window); **campaign** = event-bounded multi-post
  arc (prospective, dated). Same artifact, different trigger/count. Voice pools per-business via
  `source`-as-provenance — the system learns **voice**, not structure.
- **Per-platform cadence ADVICE** *(locked, June 5)* — IG ~3–5/wk weekday mornings; FB ~3–5 (low organic
  reach); TikTok ~1–3 short video; X high-freq-maybe-skip. Framed as "general guidelines, your audience
  differs, consistency over volume."
- **Copy-and-go handoff, v1 scope** *(locked, June 5)* — copy caption / download image / open-app;
  "we write it, you post it in seconds." **OUT of v1:** auto-publish, OAuth/Blotato connection,
  acting-on-voice-edits.

Everything in §1–§3 below is NEW and rides on these four.

---

## 1. The scheduling layer (NEW — when / where)

### 1.1 Platform as a first-class scheduling SLOT (not just advice)

The locked cadence guidance (§0) told the owner what is *wise*. This promotes platform from advice to a
**committed, calendar-rendered slot.** The owner picks a **target platform + target day**, and platforms
can sit on **different days** because they have **different audiences** — e.g. FB·Mon, TikTok·Wed, X·Fri,
LinkedIn·Tue (owner's choice; same day or staggered).

> **The scheduling unit is `(platform · day)` — NOT "a post."** This is the vocabulary the whole surface
> speaks.

### 1.2 The dual-layer calendar (the visual)

ONE calendar, two overlaid layers, both speaking the `(platform · day)` vocabulary:

- **Social cadence layer** — weekly-aggregate posts rendered as platform-tagged day markers:
  `FB · Mon`, `TT · Wed`, `X · Fri`. The steady tempo, spread across platforms/days so it isn't noise.
- **Campaign layer** — the same platform-tagged markers, but scheduled **backwards from the event's target
  date** with lead time: `CP: MothersDay · Thu-1`, `CP: MothersDay · Thu-2`, … working back from the event.
  Long-term campaign bands overlaid on the short-term cadence markers.

They **complement, not collide:** the campaign band shows "we're in the Mother's Day push"; the cadence
markers inside that band are the actual posts going out on tempo. The short-term rhythm and the long-term
arc are visible on one surface.

### 1.3 Per-platform-tailored rendering (one story, told per audience)

The weekly **aggregation happens once** (the week's sales → the narrative — §0 weekly-aggregate). That single
aggregate story is then **rendered per platform in the one shared voice** (§0 two-generators-one-voice),
tuned to each audience — FB framing vs TikTok framing — **NOT N separate stories.**

- One aggregation, N renderings. Cheap-ish, still on-moat (generation-from-context, now audience-aware),
  and consistent with the single-voice rule: the voice is constant, the audience-tuning varies.

### 1.4 Scope — copy-and-go preserved (the v1 boundary holds)

This is a **PLANNING calendar.** It **schedules + reminds** ("post FB Monday"); the **owner still posts.**

- **NO auto-publish. NO OAuth/Blotato reopen.** The calendar plans the `(platform · day)` slots; the human
  executes the post. The locked v1 handoff boundary (§0 copy-and-go) is unchanged — this layer plans the
  slots, it does not act on them.

---

## 2. The measurement layer — Erin's concept (HERS — reference, do not redesign)

Metrics are **Erin O'Brien's measurement design.** She **owns** it and is prototyping it. Captured here AS
HERS — this doc references it and leaves the design thinking to her. Do NOT invent, pre-integrate, or
redesign it.

- **The core mechanic — owner-intuition vs reality:** **5 ad/post variations** across platforms → the
  **owner picks their top 3** → run all 5 → **compare owner-picks vs actual performance.** The gap between
  what the owner *thought* would win and what *did* IS the product (the silent-partner pattern — let the
  data show them, then have the conversation).
- **Funnel metrics (three conversion stages):** most-viewed (attention) → most-clicked (interest) →
  most-clicked-and-scheduled (action).
- **Review cadence (tiered):** weekly (first month, establish patterns) → monthly (seasons change the
  reaction) → quarterly (steady state). Tiered pricing by ad count.
- **Status / ownership:** owned by Erin; standalone prototype at
  `~/Desktop/erin-prototypes/social-media-measurement/` (her sandbox, **not** in trace-platform).
  Integration path = "when ready, working pieces move into the platform." Do NOT pre-integrate.
- **Strategic note (light, do not over-specify):** Erin's measurement is also the seed of a cross-vertical
  **SERVICE layer** she could run — set up the 5, run them, 15-min review — a second revenue line on top of
  the platform subscription. Noted, not specified; that's a bigger decision than this capture.

### 2.1 The BI hook — the signal that GUIDES Erin's design

The platform already holds the moat data: **sales BI.** The measurement layer's guiding hook is
**correlating posts to sales after posting** — did the FB-Monday post about Live Oaks precede a lift in Live
Oak sales?

- **Framing:** **BI from sales (post → subsequent sales) is the signal used to GUIDE Erin's measurement
  design.** She does the design thinking; the platform's sales-correlation BI is the input that informs it.
- **Honest dependency:** platform-native engagement metrics (views / clicks) may later need **platform-API
  ingestion** — a **future dependency, NOT v1** (flagged, not built). **Sales-correlation BI needs nothing
  new** — it's the owned moat data, and is therefore the honest, available **first** signal. Don't build
  either here; this captures the hook only.

---

## 3. The shape (one-line synthesis)

> **Scheduling layer** (when/where: `platform · day`, dual-layer calendar)
> **+ measurement layer** (Erin's: which worked, owner-picks-vs-reality, guided by sales-correlation BI)
> = **two halves of one social-intelligence surface.**

Both halves ride on the locked spine: **weekly-aggregate** / **two-generators-one-voice** / **copy-and-go**.

---

## 4. Boundary recap (so a future reader doesn't over-read this)

| Layer | NEW this capture | Rides on (locked) | v1? |
|---|---|---|---|
| Platform·day slot + dual-layer calendar | ✅ | per-platform cadence advice | planning only |
| One-aggregation → N audience-tuned renderings | ✅ | weekly-aggregate + two-gen-one-voice | yes |
| Copy-and-go execution | — (unchanged) | copy-and-go v1 | yes |
| Measurement (5-variations, owner-picks-vs-reality, funnel, tiered review) | Erin's — referenced | — | Erin owns / integrate when ready |
| Sales-correlation BI (post → subsequent sales) | hook captured | platform sales data (owned) | the honest first signal |
| Engagement-API ingestion (views/clicks) | flagged | — | **future, NOT v1** |
| Auto-publish / OAuth / Blotato connect | — (explicitly OUT) | copy-and-go v1 boundary | **OUT** |

---

*Doctrine cited, not restated. Erin's measurement design is hers — referenced, not redesigned.*
*Durable record; not a build. Pointer lives in MASTER_BRIEF PART 4 (Regina Principle family).*
