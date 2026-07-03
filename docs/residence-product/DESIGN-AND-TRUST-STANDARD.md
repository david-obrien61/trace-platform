# Design & Trust Standard — Residence Product (and platform-wide)

> We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself.

**For:** David + Connor (UI) + Thunder. Governs how every screen LOOKS and FEELS, the way
DESIGN-FOR-THE-MESS governs how it behaves. Principle: don't recreate the wheel — adopt
proven, native methods; add no complexity that isn't earning its place.

> **This RIDES ON locked doctrine, doesn't restate it.** The design north star is already the
> **Apple value anchor** (make difficult look easy, invisible maintenance, under-promise/
> over-deliver, opinionated defaults) and **Surface Honesty** (WORKS/LABELED/HIDDEN). This
> doc adds only the *concrete, residence-relevant specifics* under those: the lean CSS base,
> responsive-across-device, and calm-minimum configurability. Where it overlaps, it points.

---

## 0. The base (LOGGED — chosen for leanness)
- **React + TypeScript + plain CSS.** No Tailwind, no UI framework. Tailwind was removed on
  purpose — it added complexity for no gain on this base. We do NOT reintroduce a styling
  framework. "Don't recreate the wheel" here means **use the wheel CSS already gives us**,
  not bolt on a library to do what native CSS does.

## 1. Design tokens — defined once, reused everywhere
The design system is NOT a library; it's a small set of tokens owned in one place:
- **Color palette** — a defined set (warm paper/ink neutrals + a small accent set), named,
  reused. Never hand-pick a hex per component.
- **Radii (soft edges)** — a defined scale (e.g. small/medium/large corner radius). The
  Apple-adjacent calm comes from consistent soft corners, not decoration.
- **Spacing scale** — a defined step set (e.g. 4/8/12/16/24). No arbitrary margins.
- **Type scale** — a serif for headings (character), a clean sans for body (clarity); a
  defined size ladder. System fonts are fine and fast.
Define these ONCE (a tokens file / shared style object). Every screen consumes them. This is
what makes the look a *system* instead of one nice-looking prototype.

## 2. Responsive across device + orientation (THE headline requirement)
The product must adapt to the device it's on — this is required, not optional. Use the
native, proven CSS mechanisms; no framework needed:
- **Fluid layouts** — flexbox + CSS grid; the page flexes to the width it's given, never
  fixed-pixel.
- **Media queries** — the standard mechanism for phone vs. tablet vs. desktop breakpoints.
- **Orientation queries** — CSS `orientation: portrait | landscape` for the tablet/phone
  rotated case.
- **Mobile-first** — design the phone layout first (the real constraint; people use this in
  the kitchen on a phone), then expand up to tablet and desktop.
Targets every screen must pass: phone (portrait + landscape), tablet (portrait + landscape,
small + large), desktop. The layout understands the device's size and orientation and lays
out accordingly.

> HONEST STATUS: the current prototype (KitchenLoop.jsx) is narrow-screen-tested only — it
> looks right on a phone but does NOT yet have true responsive breakpoints/orientation
> handling built in. Responsive is a STANDARD TO BUILD TO, not something already done.
> (BUILDER-COMPLETE ≠ OWNER-PROVEN — don't claim responsive until it's tested on real
> devices in both orientations.)

## 3. The "secure feeling" (trust as a felt quality — under the Apple anchor)
The Apple-vs-Google difference David's son describes (Apple actually reviews/refuses; Google
lets anything through) is a FELT quality we engineer deliberately. This is the **Apple value
anchor (already locked)** made concrete for this product — restraint + transparency, which
the logged Surface-Honesty + neutrality decisions already encode:
- **Clear permission asks** — never grab data silently (CoolRunnings' no-internet-without-
  consent is the model). The user initiates; nothing happens behind their back.
- **Visible data honesty** — show what we know and where it came from. The CONFIRMED /
  DERIVED / ESTIMATED / UNKNOWN stamps ARE the security feeling, made visible.
- **No surprises** — nothing changes that the user didn't trigger.
- **Calm = trustworthy** — a cluttered app feels insecure; a spare, restrained one feels
  safe. Whitespace and restraint are a trust signal, not just an aesthetic.
This is not new work — it's naming that the neutrality + Surface-Honesty posture has a visual
and interaction expression, and standardizing it.

## 4. Highly configurable — calm-minimum default (platform-thesis consistency)
Like the verticals' composable tiles, household features are individually TOGGLEABLE. Cost
suggestion bothering you? Off. Comparison? Off. "I just want to do business" → strip to core.
Critical rules so configurability doesn't backfire:
- **Default to the MINIMUM, let people ADD — never default to everything and make them
  remove.** Ten things on at first launch IS the overwhelm we're avoiding. Calm default =
  the core (visibility); smart features are discoverable toggles turned on as comfort grows.
  (Reward-first: show the number, let them reach for more.)
- **Progressive disclosure** — advanced options live one layer down, not on the main surface.
  Powerful when sought, invisible when not.
- **Group by mode, not a flat switch list** — a 40-switch settings panel is its own
  overwhelm. Sensible defaults so most users never open settings at all.

## 5. The bright-line test (shared with the behavior-design standard)
Any design or behavior technique passes only if: **would the user thank us if they saw
exactly how it worked?** Yes → support. Works only because it's hidden → manipulation, cut it.
(See the behavior-design doc for the green toolkit + dark-pattern do-not-cross list.)

## 6. Not now / do not
- No styling framework (no Tailwind reintroduction).
- No fixed-pixel layouts that break on other devices.
- No feature-everything-on default.
- No settings sprawl on the main surface.
- No silent data access or surprise actions (breaks the secure feeling).
