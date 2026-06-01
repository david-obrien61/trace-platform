# Help.tsx Refactor — Scoping Document
**Date:** 2026-06-01
**Author:** Claude Code audit
**Status:** Scoping only. No code changed. No files created or deleted.
**Principle:** Shared Structure, Vertical Content (80/20 Pattern) — PLATFORM_STRATEGY.md

---

## Section 1: Current Help.tsx Analysis

**File:** `packages/cultivar-os/src/pages/Help.tsx`
**Lines:** 828
**Sections:** 6
**Q&A pairs:** 27

### Q&A inventory by section

| # | Question | Classification |
|---|---|---|
| **Getting Started** |||
| 1 | I just signed up — where do I start? | Partially shared (structure); Cultivar content (plants, QR) |
| 2 | How do I add my plants to the inventory? | Cultivar-specific |
| 3 | How do I print QR code tags for my plants? | Cultivar-specific |
| 4 | What does a plant profile page show my customers? | Cultivar-specific |
| **Daily Operations** |||
| 5 | How does QR checkout work for my customers? | Cultivar-specific workflow |
| 6 | What is the 'leakage' metric on my dashboard? | Cultivar-specific |
| 7 | How do I track deliveries? | Partially shared (delivery routing structure); Cultivar content |
| 8 | How do I create a marketing campaign? | Partially shared; Cultivar content (plant references) |
| 9 | What is the social media drafts feature? | Partially shared (post-order generation pattern); Cultivar content |
| 10 | How do I view my recent orders? | Partially shared; Cultivar-specific labels and leakage concept |
| **Settings & Configuration** |||
| 11 | How do I connect my QuickBooks account? | **Universal** |
| 12 | How do I change my business name, address, or tax rate? | **Universal** |
| 13 | How do I add services I offer — delivery, installation, add-ons? | Partially shared; Cultivar content |
| 14 | How do I update my contact info or business hours? | **Universal** |
| **Billing & Subscription** |||
| 15 | How long is the free trial? | **Universal** |
| 16 | What happens when my trial ends? | **Universal** |
| 17 | How much does [app name] cost? | Partially shared (structure); vertical-specific pricing |
| 18 | How do I cancel my subscription? | **Universal** |
| 19 | Can I export my data? | **Universal** |
| **Troubleshooting** |||
| 20 | My QuickBooks connection stopped working — what do I do? | **Universal** |
| 21 | I'm not receiving emails from [app name] — what should I check? | **Universal** (app name swapped) |
| 22 | The QR code scan isn't working for a customer — what's wrong? | Cultivar-specific (QR tags) |
| 23 | Something on my dashboard looks wrong — who do I contact? | **Universal** (contact info only differs) |
| **Getting Help** |||
| 24 | How do I contact support? | **Universal** (contact info only) |
| 25 | Is there a phone number? | **Universal** |
| 26 | Where do I report a bug or request a feature? | **Universal** |
| 27 | Is [app name] still being actively developed? | **Universal** |

### Classification summary

| Category | Count | Pct |
|---|---|---|
| **Universal** — identical or near-identical across verticals | 14 | 52% |
| **Partially shared** — structure universal, content vertical-specific | 7 | 26% |
| **Cultivar-specific** — unique to nursery domain | 6 | 22% |

**Estimated shared vs. vertical-specific: 78% / 22%.** This matches the 80/20 claim closely. The six purely Cultivar-specific Q&As cover plant records, QR tags, leakage — concepts with no equivalent in other verticals.

### FLAG analysis

Help.tsx uses `// FLAG:` comments to mark placeholder content where the described feature is not yet built. 14 FLAG markers appear in the file.

| FLAG location | Type | Triggered by |
|---|---|---|
| "How do I add my plants?" — two flags | Cultivar-specific | /plants UI not built (P-1) |
| "How do I print QR tags?" — two flags | Cultivar-specific | /plants UI not built (P-1) |
| "How do I update contact info or business hours?" | Universal | Confirm hours field not in Settings |
| Billing section header | Universal | Trial mechanics not built (T-1–T-4) |
| "What happens when my trial ends?" | Universal | Trial enforcement not built |
| "How much does [app] cost?" | Vertical-specific | Stripe pricing not configured |
| "How do I cancel?" | Universal | Self-serve cancel not built (S-5) |
| "Can I export my data?" | Universal | No self-serve export button |
| "Something on my dashboard looks wrong?" | Universal | Update Andrew's contact info |
| "How do I contact support?" | Universal | Confirm Andrew's email and trip dates |

Universal FLAGs (8): trial mechanics, cancel, export, dashboard contact, support contact, business hours confirmation, Andrew trip details.
Cultivar-specific FLAGs (4–5): plant management UI, QR printing UI, pricing.

**Implication:** When Ignition or KINNA-OS gets a help page, the universal FLAGs need the same resolution — they represent features that don't exist yet in the platform, not gaps specific to Cultivar. Resolving them once in a shared content structure saves doing it N times.

### Component structure

The current file defines two reusable components (lines 40–109):

- `FAQ({ q, a })` — accordion item, open/close state with + / − toggle
- `Section({ title, children })` — labeled section container

These are good building blocks. The file also defines four color constants (`GREEN`, `SAGE`, `GRAY7`, `GRAY4`) that are Cultivar-branded. In a shared component, these would be injected per vertical.

---

## Section 2: Proposed Structure

### Four files instead of one

**`packages/shared/src/help/types.ts`** — content shape definition

```typescript
import { ReactNode } from 'react';

export interface HelpQA {
  q: string;
  a: string | ReactNode;
  flag?: string;        // dev-only note; stripped in production
}

export interface HelpSection {
  title: string;
  items: HelpQA[];
}

export interface HelpColors {
  primary: string;      // header background, links, open-state accent
  background: string;   // page background
  textBody: string;     // body text
  textMuted: string;    // secondary / footnote text
}

export interface VerticalHelpContent {
  appName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  dashboardPath: string;
  privacyPath: string;
  termsPath: string;
  colors: HelpColors;
  sections: HelpSection[];
}
```

**`packages/shared/src/pages/Help.tsx`** — structural shell

Owns:
- The `FAQ` accordion component (open/close state, + / − toggle)
- The `Section` container
- Page header (app name, tagline, color from content.colors)
- Page footer (privacy, terms links, back to dashboard, support contact)
- The `sections.map()` loop that renders all Q&As
- Color injection: no hardcoded `#27500A` or `#EAF3DE`

Does NOT own:
- Any Q&A text
- Any vertical-specific domain language
- Contact info, pricing, app name

Props: `content: VerticalHelpContent`

**`packages/cultivar-os/src/help/content.ts`** — Cultivar's 100% of content

Exports a `cultivarHelpContent: VerticalHelpContent` object containing all 27 Q&As, Cultivar colors, contact info, paths. Rich JSX content (lists, links, paragraphs) lives here as typed ReactNode values. FLAG comments migrate here with their Q&As.

**`packages/cultivar-os/src/pages/Help.tsx`** — thin wrapper (replaces current file)

```tsx
import { Help } from '@trace/shared/pages/Help';
import { cultivarHelpContent } from '../help/content';

export function Help() {
  return <Help content={cultivarHelpContent} />;
}
```

That is the entirety of the vertical-specific Help.tsx after the refactor.

### How a new vertical adds its Help page

```tsx
// packages/kinna-os/src/help/content.ts
export const kinnaHelpContent: VerticalHelpContent = {
  appName: 'KINNA-OS',
  supportEmail: 'david@trace-enterprises.com',
  colors: { primary: '#5B4FCF', background: '#F5F4FF', ... },
  sections: [
    // 14 universal Q&As: copy-paste from Cultivar content with no edits
    // 7 partially-shared Q&As: copy structure, swap domain language
    // 6 KINNA-specific Q&As: write fresh (eligibility, distributions, etc.)
  ],
};
```

The structural code — `FAQ`, `Section`, header, footer — is not written again.

---

## Section 3: Migration Plan

### Files to create

| File | Action | Notes |
|---|---|---|
| `packages/shared/src/help/types.ts` | Create | TypeScript interfaces for content shape |
| `packages/shared/src/pages/Help.tsx` | Create | Structural shell, color-injected |
| `packages/cultivar-os/src/help/content.ts` | Create | All 27 Q&As extracted from current Help.tsx |

### Files to modify

| File | Change |
|---|---|
| `packages/cultivar-os/src/pages/Help.tsx` | Replace 828 lines with ~5-line wrapper |
| `packages/shared/src/index.ts` | Export `Help` and `VerticalHelpContent` from shared |
| `packages/cultivar-os/src/router.tsx` | No change needed — /help route import stays the same |

### Files to delete

None. The current `packages/cultivar-os/src/pages/Help.tsx` is replaced in-place, not deleted.

### Step-by-step

1. **Design and write `types.ts`** (45 min)
   Define `HelpQA`, `HelpSection`, `HelpColors`, `VerticalHelpContent`. The tricky question is whether `a` in `HelpQA` can be `ReactNode` — it must be, because some Q&As have rich content (lists, links, styled paragraphs). Since `content.ts` files will contain JSX, those files need a `.tsx` extension, not `.ts`.

2. **Extract content to `cultivar/src/help/content.tsx`** (2–2.5h)
   Migrate all 27 Q&As verbatim. Migrate FLAG comments alongside their Q&As. The `GREEN` color constant (used inline in Q&A link styles) becomes a reference to `cultivarHelpContent.colors.primary`. Verify every Q&A migrated by diff.

3. **Build `shared/src/pages/Help.tsx`** (1–1.5h)
   Extract `FAQ` and `Section` components. Make colors come from `content.colors`. Make header/footer use `content.appName`, `content.supportEmail`, `content.supportPhone`, etc. Render `content.sections.map(...)`.

4. **Replace `cultivar/src/pages/Help.tsx` with wrapper** (15 min)
   Import shared `Help`, import `cultivarHelpContent`, render.

5. **Verify** (45 min)
   - `npm run dev` in cultivar-os, navigate to /help
   - Confirm all 6 sections render
   - Confirm accordion open/close works
   - Confirm all 27 Q&As present and formatted identically to before
   - Confirm FLAG comments are still visible in source (dev-only, not rendered)
   - Confirm rich content (lists, links) renders correctly
   - Run `npm run build:cultivar` — zero TypeScript errors

**Total estimated effort: 5–6 hours.**

### Risk assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Rich JSX content in Q&As breaks when extracted to `.tsx` content file | Medium | Keep content files as `.tsx`, not `.ts`; TypeScript will catch errors |
| Inline `GREEN` color references in Q&A link styles break | High | Define `colors.primary` in content, use it in content JSX; or pass color as context to avoid prop drilling into nested JSX |
| FLAG comments are stripped or reformatted | Low | FLAG comments are TypeScript block comments — they survive migration exactly as written |
| Router import breaks | Low | Wrapper exports same `Help` function name; router doesn't change |
| Build produces different HTML (layout regression) | Low | Structural component is extracted from current code, not rewritten; visual diff unlikely |

**Highest-risk step:** color injection into Q&A body content. Several Q&As have inline `color: GREEN` on anchor tags inside the answer JSX. After extraction to `content.tsx`, `GREEN` is not in scope unless explicitly imported or passed. The cleanest solution is to import `colors` from the content object within `content.tsx` itself:

```tsx
import { cultivarColors } from './colors'; // one line extracted constant
```

This is a 5-minute decision that needs to be made before writing the content file.

---

## Section 4: Future Verticals

### Adding Ignition OS Help — post-refactor

Total effort estimate: **25–40 minutes.**

- Copy `cultivarHelpContent` as starting template
- Keep 14 universal Q&As unchanged (trial, billing, QB, export, contact, bug reporting — copy verbatim)
- Rewrite 7 partially-shared Q&As with Ignition domain language (repair orders vs. plants, job lifecycle vs. checkout, margin engine vs. leakage dashboard)
- Write 6 Ignition-specific Q&As (how does VIN decode work, what is the PIN kiosk, how do I track parts, etc.)
- Update colors to Ignition blue-slate (`#1E3A5F`, `#F0F4F8`)
- Create `packages/ignition-os/src/pages/Help.tsx` thin wrapper

The structural work (FAQ accordion, Section, header, footer) is not touched.

### Adding KINNA-OS Help — post-refactor

Same 25–40 minute estimate. Universal content is identical; vertical content covers eligibility, distribution days, voice receiving, dignity dollars, pastoral care questions that are unique to the KINNA domain.

An additional consideration: KINNA-OS requires bilingual content (`bilingualRequired: true` in verticalConfig). The shared `VerticalHelpContent` type would need a `locale` or `translations` field if bilingual Q&As are needed. This is a type-level extension, not a structural rebuild — the shell stays the same.

### Structural flexibility for different content shapes

The `sections: HelpSection[]` array accommodates any section count, any Q&A count, in any order. A vertical that needs 10 sections or 40 Q&As works without code changes. A vertical that needs no billing section simply omits it from the array.

The only structural variation that would require shell changes: a vertical that needs a completely different page layout (e.g., a search bar, category navigation, or embedded video). For KINNA-OS, a bilingual toggle might fit within the existing structure if both language variants are represented in the content object.

### FLAG comment handling across verticals

After the refactor, FLAG comments live in each vertical's content file, not in the shared shell. This is the correct behavior:

- **Cultivar-specific FLAGs** (plant management UI, QR printing): remain in `cultivar/src/help/content.tsx`, removed when /plants ships
- **Universal FLAGs** (trial enforcement, cancel flow, export, support contact dates): each vertical's content file carries its own copy, because each vertical independently tracks whether the feature has shipped for that vertical
- **No universal FLAGs in shared shell**: the shell has no content, so it has no FLAGs. All FLAGs live where the content lives.

This is preferable to a shared content file for universal Q&As, because:
- Trial might ship in Cultivar before KINNA — each file updates independently
- Support contact info (Andrew's dates) differs per vertical's support arrangement
- FLAGs are removed when features ship in a specific vertical, not platform-wide

---

## Section 5: Recommendation

### Honest assessment

**Defer this refactor to post-August 2026.** Here is the reasoning.

**Arguments for deferring:**
- The Cultivar Help page works correctly today. The refactor is architectural cleanup, not customer-facing functionality.
- The pre-August work budget is already packed: KINNA-OS Phase 1 (Back to School, August 1 hard deadline), self-serve readiness items (P-1 plant management, T-1–T-4 trial engine, S-5 cancel flow), and any Cultivar polish before or after the LAWNS meeting.
- 5–6 hours is the cost. For comparison, the self-serve readiness plan estimated P-1 (plant management UI) at ~14 hours, T-1–T-4 at ~8 hours, S-5 at ~4 hours. The Help refactor is lower priority than any of those because it has no user-facing impact today.
- The refactor adds no new functionality for Cultivar customers. It does not resolve any FLAG, does not ship any feature, does not reduce any support burden.
- KINNA-OS Phase 1 scope (QR check-in, client intake, TEFAP eligibility, distribution menu, voice receiving) is challenging to ship by August 1 without adding 5–6 hours of architecture work that KINNA doesn't strictly need yet.

**Arguments for doing it before August:**
- KINNA-OS Phase 1 will need a help page eventually. Building the shared structure now means KINNA's help page takes 30 minutes when the time comes.
- The universal FLAGs (trial, billing, cancel) represent content that will need to be written for every vertical — filling them in a shared content structure once is cheaper than duplicating the work.
- The August 1 deadline is for Back to School functionality, not necessarily the public Help page. KINNA might not need /help on day one.

**The decisive factor:** KINNA-OS Phase 1 does not require a help page to ship. The Back to School event is a staff-operated distribution, not a self-serve customer product. A help page is a Phase 2 concern for KINNA. There is no concrete need this refactor fills before August.

**Recommended trigger instead:** Do the refactor when KINNA-OS Phase 2 (self-serve signup, customer-facing pages) is being built — at that point, the shared Help structure is needed, the investment is justified, and having the pattern proven will accelerate every other shared surface (settings, onboarding, error pages). Building the abstraction when you have two concrete implementations to guide it is better than building it speculatively before the second implementation is needed.

**What to do now instead:** Resolve the universal FLAGs in `cultivar/src/pages/Help.tsx` directly (the contact info FLAGs especially, since those are simple factual updates). Track the 80/20 refactor as a post-August task in CLAUDE.md so it isn't forgotten.

---

*Scoping document — read-only. All analysis is based on current codebase state as of 2026-06-01.*
*To execute this refactor, begin at Section 3 Step 1 and follow in order.*
