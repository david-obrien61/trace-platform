# OWNER TEST — A SAVE ON ONE SETTINGS CARD MUST NOT DELETE ANOTHER CARD'S NUMBER

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> *(GATE 0 · OP-15.)*

**Capability:** 2.1 (pricing / tax) · 6.2 (settings)
**Story:** `user_stories.md` → *Tax rate + exemption (BUILT)* — *"Per-tenant tax rate (honest-unset, redlined when not set — no fabricated default)"*. This board defends that sentence against a neighbouring screen.
**Surface:** `/settings` → the **Cost to Produce** card, and what its Save does to the **tax rate** set on the same page.
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 6 covered** (5 `owed` · 1 `needs-test`).
**DEVICE:** every card is `DEVICE: desktop` — this is a settings screen, and `capture=mobile / reconcile=desktop` puts it at a desk.

---

## 🔴 WHY THIS BOARD EXISTS — AND THE PART OF THE REPORT THAT TURNED OUT TO BE WRONG

`business_pricing_config.config` is **one jsonb column with four owners**: the Cost-to-Produce panel
owns the cost recipe, `/discounts` owns `discountTypes` and `aiBiEnabled`, the Settings tax field
owns `taxRate`, and production planning owns `production`. Every one of them writes the **whole
column**. The cost panel used to name the three keys it would *preserve* — and `taxRate` was not
one of them.

⚠️ **BUT THE WIPE WAS NOT REACHABLE ON LAWNS, AND LAUREN COULD NEVER HAVE CAUSED IT.** Measured
2026-09-09 against the live database and against real RLS
(`scripts/rls/pricing-config-clobber.rls.mjs`, 26 assertions):

- **Lauren's Save is REFUSED** — she holds no `pricing_recipe:*`, and the write comes back
  `new row violates row-level security policy`. She cannot change this column at all.
- **The rate survived an owner's Save too — by accident.** The panel's `parseConfig` is a *cast*,
  not a strip, so the stored keys rode along in memory and were written back. Nobody designed that.
- **The wipe is real and was reproduced**, on the path where the panel falls back to its built-in
  defaults. LAWNS is not on that path today. **One edit to how the config is parsed would put it
  there**, with no warning and no error.

**So these cards are not re-proving a live disaster. They are proving that the accident has been
replaced by a mechanism** — the panel now names the keys it *owns* and carries everything else
through — **and that nothing on the page moved while that changed.**

🔴 **CARD 6 IS THE ONE THAT IS STILL A LIVE, UNFIXED PROBLEM.** It is `needs-test` on purpose.

---

## 🔧 THE ONE-LINE READOUT — paste this, don't hand-write a query

Several cards ask you to read the stored config **before and after** a Save. Do it from the app's
own session, on any Cultivar page, with DevTools → Console:

```js
/* PASTE WHOLE. Works on any /settings or /dashboard page, signed in as yourself. */
(async () => {
  const { supabase } = await import('/src/lib/supabase.ts');   // the app's own client
  const { data: b } = await supabase.from('businesses').select('id,name').limit(5);
  const biz = b[0];
  const { data, error } = await supabase
    .from('business_pricing_config').select('config').eq('business_id', biz.id).maybeSingle();
  if (error) return console.log('READ REFUSED:', error.message);
  if (!data)  return console.log('NO ROW VISIBLE (you may lack pricing_recipe:read)');
  console.log(biz.name, '· top-level keys:', Object.keys(data.config).sort().join(', '));
  console.log('taxRate =', data.config.taxRate);
})();
```

⚠️ **DO NOT type `window.supabase` — there is no such global, and reaching for it is what made the
last two attempts at a console card fail.** The import above is the app's real client and carries
your real session, so what it reads is what RLS lets *you* read.

🔴 **AND YOU DO NOT NEED THE CONSOLE FOR THE CARD THAT MATTERS.** CARD 1 is provable entirely from
the screen. If the console gives you any trouble, run CARD 1 and stop — it is the defect.

---

## CARD 1 — the tax rate survives a Cost-to-Produce Save
**STATUS: owed** · **DEVICE:** desktop · **LAST-PROVEN: —**

🔴 **THIS IS THE CARD. Everything else on this board is corroboration.** No console required.

1. Sign in as the **owner** on **Test Dave's Tree Nest** (not LAWNS — see CARD 5 for LAWNS).
2. Open `/settings`. On the **Tax rate** field, read the rate and **write it down**. It should be
   `7.6%` on Test Dave's.
3. Scroll to the **Cost to Produce** card. Change something small and unambiguous — the
   **unit label**, or the **overhead per unit**. You want a real edit, not a no-op Save.
4. Press **Save**. Wait for `Saved`.
5. **Reload the page** (a hard refresh — the point is to read what was *stored*, not what is in
   memory).
6. Read the **Tax rate** field again.

**PASS:** the tax rate reads exactly what you wrote down in step 2, and your Cost-to-Produce edit
is still there.
**FAIL:** the tax rate is blank, redlined, `not set`, or a different number. 🔴 **If this card
fails, nothing else on this board matters — and a checkout on that tenant will under-bill.**

---

## CARD 2 — the discount tiers survive it too
**STATUS: owed** · **DEVICE:** desktop · **LAST-PROVEN: —**

The three keys the old code *did* rescue must still be rescued. This is the **non-regression** card,
and it is the easy one to skip.

1. On Test Dave's, open `/discounts` and note the tier names that exist.
2. Go to `/settings` → **Cost to Produce**, make an edit, **Save**.
3. Return to `/discounts` and reload.

**PASS:** every tier is still there, with the same names and percentages.
**FAIL:** a tier is missing or changed. That would mean the inversion dropped what the old list kept.

---

## CARD 3 — a deletion the panel makes actually sticks
**STATUS: owed** · **DEVICE:** desktop · **LAST-PROVEN: —**

⚠️ **This is the card that proves the fix did not overcorrect.** Carrying keys through must not turn
into *merging* them, or the panel could never remove anything it owns — a deleted row would come
back on the next reload, which is a worse bug than the one being fixed.

1. On Test Dave's `/settings` → **Cost to Produce**, note the **N-list** (denominators, e.g.
   `1, 5, 20, 100`).
2. **Remove one number** from that list. Press **Save**, wait for `Saved`.
3. **Reload the page.**

**PASS:** the number you removed is still gone.
**FAIL:** it is back. The write is merging where it should be replacing.

---

## CARD 4 — the Save says what it carried
**STATUS: owed** · **DEVICE:** desktop · **LAST-PROVEN: —**

STD-003 instrumentation, on by default. This is how a future loss becomes visible instead of silent.

1. Open DevTools → Console **before** pressing Save.
2. On `/settings` → **Cost to Produce**, make an edit and **Save**.
3. Find the line `[TRACE:COST] config write — top-level keys`.

**PASS:** it reports `carried:` naming the keys the panel does **not** own (`taxRate`,
`discountTypes`, and whatever else that tenant has), and `dropped: []` — **empty**.
**FAIL:** `dropped` is non-empty. Whatever it names is being deleted; write down the names.

---

## CARD 5 — LAWNS: the same proof, on the tenant that matters
**STATUS: owed** · **DEVICE:** desktop · **LAST-PROVEN: —**

🔴 **RUN THIS ONLY AFTER CARD 1 PASSES ON TEST DAVE'S.** LAWNS carries a real 8.25% rate on real
invoices, and this card presses Save on it deliberately.

1. Before touching anything, run the console readout above on LAWNS and **screenshot the output**.
   It should show `taxRate = 0.0825` and 8 top-level keys.
2. `/settings` → **Cost to Produce** → make one small edit → **Save** → reload.
3. Run the readout again.

**PASS:** `taxRate = 0.0825` and the key list is the same length or longer. The tax rate on the
Settings page still reads **8.25%**.
**FAIL:** any key is gone. 🔴 Stop and report the before/after key lists.

---

## CARD 6 — 🔴 WHAT LAUREN ACTUALLY SEES ON THIS CARD, WHICH IS NOT HER DATA
**STATUS: needs-test** · **DEVICE:** desktop · **LAST-PROVEN: —**

🔴 **NOT A TEST OF THIS BUILD — A LIVE DEFECT THIS BUILD FOUND AND DELIBERATELY DID NOT FIX.**
Recorded here rather than left unwritten, because an unrecorded hole is a lie by omission (OP-14 §2).

`<CostToProduceSettings />` is rendered on `/settings` with **no permission gate** — its sibling
`OperationsSettings` gets `canReadMoney={can('pricing_recipe:read')}` and it gets nothing. A manager
has no `pricing_recipe:read`, so the config read returns **no row and no error**, and the panel falls
back to its built-in defaults and renders them as if they were the business's numbers: a 40% margin
baseline, an N-list of `1, 5, 20, 100`, a location called "Primary".

**Measured, not inferred:** on a tenant storing `unitLabel: 'tree'`, the manager's panel renders
`unit` (`pricing-config-clobber.rls.mjs` A3). Pressing Save then fails with a raw RLS error.

This is D-9 Surface Honesty — *a withheld value must announce its redaction, never render as a real
one* — and it is the same class as the `1000 of 1000` header (#282).

**WHY IT IS NOT FIXED HERE:** gating the panel changes what Lauren sees on a customer tenant this
week, and that is David's call, not a builder's. Tech-debt **#231**.

**WHAT WOULD SETTLE IT:** sign in as Lauren on LAWNS, open `/settings`, and read the Cost-to-Produce
card. If it shows numbers, they are fabricated. **PASS** would be a locked card that says the data is
withheld and why; **FAIL** is what is there today.

---

## WHAT A MACHINE ALREADY PROVED, SO YOU DO NOT HAVE TO

Neither of these marks a card `covered` — a machine cannot (OP-14). They narrow what your run is for.

- `node scripts/rls/pricing-config-clobber.rls.mjs` — **26 assertions, real RLS, real sessions, on a
  throwaway tenant it creates and deletes.** Reproduces the wipe (§C7), proves the fix on the same
  input (§D3), and dry-runs the merge against **Test Dave's and LAWNS's actual stored configs**
  read-only (§E): both lose **no** top-level key.
- `npm run verify:pricing-writers` — derives every whole-column writer from the source tree and
  fails the build if one names the keys it will *preserve* rather than the keys it *owns*.
  Red-first against the pre-fix file; carries a `--self-test` proving each check can refuse.

🔴 **NOT ONE OF THOSE ASSERTIONS OPENED A BROWSER.** They prove the write. Cards 1–5 prove the
screen, and only your run does that.
