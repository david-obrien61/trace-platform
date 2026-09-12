/**
 * ── THE CHANNEL NAME REACHES THE MODEL, AND WHAT COMES BACK IS CHECKED ───────────────────────
 *
 * PURPOSE:      Guard the defect that made every campaign generation fail its write from
 *               2026-06-08 until 2026-09-12: the prompt never printed a channel NAME, so the model
 *               echoed the display labels it could see — `TikTok`, `Twitter/X`, `Instagram` — and
 *               those were written raw into `campaign_posts.platform`. The values were never wrong;
 *               they were never asked for.
 * DEPENDENCIES: buildChannelInstructions · resolvePostChannel (packages/shared/src/campaigns/generate)
 * OUTPUTS:      exit 0 / exit 1 with the failing assertion named.
 *
 * 🔴 THIS FILE CALLS THE REAL BUILDER. It does not grep the source, and that distinction is the
 * whole reason it exists: **every regex probe anyone would have written would have passed with the
 * defect present.** `channelInstructions` genuinely referenced `ch.name` — it used it to look up the
 * guidance — so a source scan for "does this file use the channel name" was TRUE and said nothing
 * about whether the name reached the prompt. The only way to know is to build the string and read it.
 * That is tech-debt #182's class (a harness that cannot reach its target) and [[R-33]] (a check that
 * cannot disagree), and it is how this survived three months of green suites.
 */
import {
  buildChannelInstructions, resolvePostChannel, type AdvertChannel,
} from './generate';

let passed = 0; let failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); return; }
  failed++; console.error(`  ✗ ${label}`);
}

const CHANNELS: AdvertChannel[] = [
  { name: 'instagram', type: 'social', enabled: true, guidance: '(Instagram) Visual and upbeat. Under 220 characters.' },
  { name: 'tiktok',    type: 'social', enabled: true, guidance: '(TikTok) Under 150 characters. Punchy.' },
  { name: 'twitter',   type: 'social', enabled: true, guidance: '(Twitter/X) Under 260 characters. Brief.' },
  { name: 'sms',       type: 'sms',    enabled: true, guidance: '(SMS) Under 160 characters.' },
  // The case the default guidance used to swallow entirely: no guidance at all, so before this fix
  // the model saw no identifier for this channel anywhere in the prompt.
  { name: 'email',     type: 'email',  enabled: true, guidance: null },
] as AdvertChannel[];

console.log('\n── A. THE NAME IS IN THE PROMPT ──');
{
  const built = buildChannelInstructions(CHANNELS, 2);

  for (const ch of CHANNELS) {
    ok(built.includes(`[${ch.name}]`), `A1 \`${ch.name}\` is printed to the model, verbatim`);
  }
  // 🔴 THE REGRESSION PROBE. The pre-fix line was `- ${count} × ${guidance}`; restore it and every
  // A1 fails, because the guidance text contains `(TikTok)` and never `tiktok`.
  const tiktokLine = built.split('\n').find(l => l.includes('tiktok')) ?? '';
  ok(tiktokLine.includes('[tiktok]') && tiktokLine.includes('(TikTok)'),
    'A2 🔴 the tiktok line carries the NAME *and* the label — the name is what was missing, not the guidance');
  ok(built.includes('[email]'),
    'A3 🔴 a channel with NO guidance still names itself — the case the default text swallowed');
}

console.log('\n── B. THE PROBE CAN GO RED (R-33) ──');
{
  // The old shape, reproduced here rather than described: if this passed A1 too, A1 proves nothing.
  const oldShape = CHANNELS.map(ch => `- 2 × ${ch.guidance ?? 'Short, warm, and authentic.'}`).join('\n');
  ok(!oldShape.includes('[tiktok]') && !oldShape.includes('[email]'),
    'B1 the PRE-FIX builder does not print any name — A1 would have failed against it');
  ok(oldShape.includes('(TikTok)'),
    'B2 …and it does carry the label the model was echoing, which is how `TikTok` reached the database');
}

console.log('\n── C. WHAT COMES BACK IS CHECKED AGAINST WHAT WAS OFFERED ──');
{
  const r1 = resolvePostChannel('tiktok', CHANNELS);
  ok(r1.ok && r1.name === 'tiktok' && r1.source === 'model', 'C1 an offered name is accepted as the model’s own answer');

  const r2 = resolvePostChannel('TikTok', CHANNELS);
  ok(r2.ok === false, 'C2 🔴 `TikTok` is REFUSED — the live defect’s actual value');
  ok(r2.ok === false && r2.value === 'TikTok', 'C3 …and the refusal carries the value that came back, by name');

  const r3 = resolvePostChannel('Twitter/X', CHANNELS);
  ok(r3.ok === false && r3.value === 'Twitter/X', 'C4 so is `Twitter/X`');

  const r4 = resolvePostChannel('linkedin', CHANNELS);
  ok(r4.ok === false && r4.value === 'linkedin', 'C5 a real channel that was not OFFERED is refused too — offered, not merely known');

  // 🔴 The fallback is a fallback: absent only.
  const r5 = resolvePostChannel(undefined, CHANNELS);
  ok(r5.ok === true && r5.name === 'instagram' && r5.source === 'fallback',
    'C6 an ABSENT channel falls back to the first offered, and says it was a fallback');
  const r6 = resolvePostChannel('   ', CHANNELS);
  ok(r6.ok === true && r6.source === 'fallback', 'C7 blank counts as absent, not as a wrong answer');

  ok(resolvePostChannel('instagram', CHANNELS).ok === true && resolvePostChannel('Instagram', CHANNELS).ok === false,
    'C8 🔴 the check DISCRIMINATES on case — it is not a constant wearing a validator’s clothes');

  // The substitution David forbade: a present-but-wrong value must never become `instagram`.
  const bad = resolvePostChannel('TikTok', CHANNELS);
  ok(!(bad.ok === true && bad.name === 'instagram'),
    'C9 🔴 a wrong value is NEVER silently rewritten to `instagram` — it would publish on a channel nobody chose');
}

console.log(`\nchannelPrompt: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
