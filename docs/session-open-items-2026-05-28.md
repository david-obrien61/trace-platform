# Session open items — 2026-05-28

Status legend: [ ] not done / not confirmed · [x] confirmed done

## Demo-safety (do before any link goes to the LAWNS prospect)
- [ ] Fix "Layna" → "Lauren" in DemoQBInvoice.tsx (+ repo-wide grep shows zero "Layna")
- [ ] Fix "sandbox" labels → env-aware in Confirmation.tsx + DemoQBInvoice.tsx
- [ ] Run 2 SQL queries in Supabase (bgobkjcopcxusjsetfob) for nurseries/plants/plant_events/addons
      RLS state; add SELECT policy if any are RLS-on-without-policy

## Tech debt logging
- [ ] Log Ignition findings to Tech Debt Log: missing supabase.js (RED build-blocker),
      auth.uid()-always-null RLS trap (RED), auth.ts extraction drift (YELLOW),
      pushCloudSync swallowed errors (YELLOW), 24-table RLS unverified (YELLOW)

## Confirmed done this session
- [x] Cultivar RLS + demo-readiness audit
- [x] Ignition RLS audit
- [x] Honest Debt principle added (PLATFORM_STRATEGY + CLAUDE.md)
- [x] Reuse ratio corrected (67/12/20 retired; counted 19/24/41/13 committed to audit)

## In progress
- [ ] Config-structure audit (running now → docs/cultivar-config-structure-audit-2026-05-28.md)
- [ ] Config schema design (blocked on the audit above)

Note: edits from this session are written to disk but NOT git-committed. Review and commit when ready.
