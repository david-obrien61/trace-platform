// ───────────────────────────────────────────────────────────────────────────
// PURPOSE: Decide what the always-visible version stamp says about WHERE this
//   bundle is deployed — production, a preview, or a local build. This is the
//   second half of owner-prove GATE 0 (OP-15) and it closes tech-debt #280 ②.
//
//   #280 ① is "is this SHA an ancestor of origin/main" — mechanical, free, and
//   answerable from the repo. ② is "is the deployment's target PRODUCTION", and
//   #280 records it as 🔴 NOT CHECKABLE: *"nothing we own reads Vercel."*
//   Nothing we own has to. Vercel sets VERCEL_ENV / VERCEL_GIT_COMMIT_REF at
//   BUILD time, so the answer can be baked into the bundle and read off the
//   screen — which is where David is standing when GATE 0 fires. A rule filed
//   where the actor is not standing is a note, and notes don't act (row 19B).
//
// 🔴 THE DEFECT THIS EXISTS FOR, FROM #280's OWN INCIDENT: ledger #303 was
//   recorded complete "with only Preview deploys". A Preview and a Production
//   deploy of the SAME COMMIT are today INDISTINGUISHABLE in the app — the SHA
//   matches, the stamp agrees, and every observation after that point is
//   fiction. That is #60's family one layer over: right code, wrong target.
//
// 🔴 INDUSTRY STANDARD NAMED, AND DELIBERATELY DEVIATED FROM (§6 r16). The
//   standard environment badge (Rails' env indicator, the classic STAGING
//   ribbon, Vercel's own preview banner) marks NON-production loudly and shows
//   NOTHING in production. We show production too, positively, because our
//   purpose is not only "don't mistake staging for prod" — GATE 0 needs a
//   POSITIVE ASSERTION. If production rendered nothing, it would be
//   indistinguishable from a bundle built before this feature existed, and
//   absence is not evidence (A9 "absent is not empty" / D-9). The deviation is
//   the whole point: silence cannot carry a claim.
//
// DEPENDENCIES: none. Pure functions over three strings — no DOM, no network,
//   no context. The stamp must render when everything else has failed.
// OUTPUTS: `deployStamp()` → { label, loud, reason }.
// INSTRUMENTATION: none by design, inherited from <VersionStamp>'s own rule —
//   it IS the signal; a TRACE line about a thing you can already read is noise.
// ───────────────────────────────────────────────────────────────────────────

/** Vercel's own vocabulary, plus the two states Vercel never sets. */
// Not exported: nothing outside this module names either type — the return type is
// inferred at the call site and the target is an implementation detail. Exporting
// them would be two dead public names, which knip correctly flags (§6 r9: the
// baseline shrinks, it does not grow to accommodate a convenience).
type DeployTarget = 'production' | 'preview' | 'development' | 'unknown';

interface DeployStampResult {
  /** Rendered after the SHA: `prod`, `PREVIEW fix/foo`, `local`, `env?`. */
  label: string;
  /** Must the stamp SHOUT? True whenever the screen could be mistaken for production. */
  loud: boolean;
  /** Why — plain enough to read in a tooltip while standing in a lot. */
  reason: string;
}

/** The branch a production deploy is expected to be built from. */
export const EXPECTED_PRODUCTION_REF = 'main';

/**
 * Normalise VERCEL_ENV. Anything we do not recognise is `unknown` — NEVER
 * coerced to `production`, because the whole value of this stamp is that it
 * cannot claim production without evidence.
 */
export function readDeployTarget(raw: string | undefined): DeployTarget {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'production': return 'production';
    case 'preview': return 'preview';
    case 'development': return 'development';
    default: return 'unknown';
  }
}

/**
 * 🔴 `sha === 'dev'` IS THE DISCRIMINATOR FOR "NOT A VERCEL BUILD AT ALL".
 * vite.config.ts resolves __COMMIT_SHA__ to the literal 'dev' when
 * VERCEL_GIT_COMMIT_SHA is absent. A plain `npm run dev` therefore sets no
 * VERCEL_ENV either — and without this clause every local session would shout
 * `env?` forever, which is how a warning becomes wallpaper and stops being read.
 */
export function deployStamp(
  rawEnv: string | undefined,
  rawRef: string | undefined,
  sha: string,
): DeployStampResult {
  const ref = (rawRef ?? '').trim();

  if (sha === 'dev') {
    return { label: 'local', loud: false, reason: 'Built on this machine — not a deployment.' };
  }

  switch (readDeployTarget(rawEnv)) {
    case 'production':
      // A production deployment built from something other than main is legal
      // (someone promoted a branch) and is exactly the thing worth SEEING.
      if (ref && ref !== EXPECTED_PRODUCTION_REF) {
        return {
          label: `prod⚠ ${ref}`,
          loud: true,
          reason: `Production, but built from "${ref}" rather than ${EXPECTED_PRODUCTION_REF}.`,
        };
      }
      return { label: 'prod', loud: false, reason: 'Production deployment — this screen is evidence.' };

    case 'preview':
      return {
        label: ref ? `PREVIEW ${ref}` : 'PREVIEW',
        loud: true,
        reason: 'A PREVIEW deployment, not production. Do not record an owner-proof from this screen.',
      };

    case 'development':
      return { label: 'local', loud: false, reason: 'Vercel development build — not a deployment.' };

    default:
      // 🔴 A Vercel build (it has a real SHA) whose target we cannot name. It
      // MUST NOT read as production — an unknown that renders quietly is the
      // silent-false-green this whole stamp exists to prevent.
      return {
        label: 'env?',
        loud: true,
        reason: 'Deployment target unknown — it may or may not be production. Do not treat this screen as evidence.',
      };
  }
}
