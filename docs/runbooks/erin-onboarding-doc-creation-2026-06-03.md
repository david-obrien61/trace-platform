# Runbook: Erin Onboarding Doc Creation
**Date:** 2026-06-03  
**Type:** Documentation creation  
**Status:** Complete ✅

---

## What this document is

Meta-documentation about the creation of `docs/erin-onboarding-2026-06-03.md`. The onboarding doc is the customer-facing artifact. This runbook captures why it exists and how to maintain or reuse it if family onboarding becomes a repeated pattern.

---

## Why the onboarding doc was created

Erin O'Brien is joining TRACE as a family contractor. She has never written code before. She needs to go from zero developer tooling to working VS Code + Claude Code + GitHub access on her Mac in one or two sessions.

The alternatives considered:
- **Andrew onboards her verbally.** Doesn't scale; Andrew has to be available in real time; no record.
- **Connor onboards her.** Same problem.
- **Erin figures it out from online resources.** Fine for experienced developers; actively hostile to non-developers because most resources assume baseline knowledge she doesn't have.
- **A written doc she can follow at her own pace.** Best option. Brothers are still available for blockers, but she doesn't need them to be present for every step.

---

## What the doc covers

1. VS Code installation
2. Apple Command Line Tools (xcode-select)
3. Homebrew
4. Node.js 20 via brew
5. Claude Code VS Code extension
6. GitHub account creation
7. SSH key generation and registration
8. Repo clone (after David grants access)
9. First-time `npm install`
10. Common error messages and what they mean
11. How Claude Code fits into her daily workflow

---

## Language decisions

The doc was written to be understood by a smart person who has never coded. Specific decisions:

- **Every tool is introduced with "what it is" in plain language** before the steps. The metaphors are intentional: VS Code is "like Word but for code," Homebrew is "like the App Store for command-line tools."
- **Terminal is not assumed.** The doc explains how to open it (Cmd+Space → type Terminal).
- **SSH keys are explained from first principles.** The concept of "your computer proving its identity to GitHub" is explained before the steps. No assumed knowledge.
- **"Code ." is not assumed.** The doc includes the one-time setup step (Shell Command: Install 'code' command in PATH) before the step where it's used.
- **Node PATH issue is acknowledged.** After `brew install node@20`, the brew link step is called out explicitly because it's easy to miss.
- **Error messages are translated.** The table at the end translates "permission denied," "command not found," etc. into plain English with a suggested action.

---

## What the doc does NOT cover (and why)

- **Git config (name/email).** Not needed until Erin is making commits. Deferred to when she's actually ready to contribute code.
- **`.zshrc` or shell config.** If Node PATH issues arise, Andrew will handle. Too much detail for a first-time setup.
- **GitHub Desktop.** Erin will use Terminal for git operations once she's contributing. GitHub Desktop is a crutch that creates a different skill set than what the team uses.
- **Claude Code CLI.** The VS Code extension is the right entry point for a non-developer. The CLI can be introduced later if needed.
- **How to use git beyond clone.** Out of scope for setup. She'll learn branching, commits, etc. when she's ready to contribute.

---

## How to update this doc for future family onboarding

If Andrew, Connor, or another person needs a similar setup guide, copy `docs/erin-onboarding-2026-06-03.md` and:

1. Update the name and date in the header
2. Check which steps are still current:
   - Node version (currently node@20 — update if LTS changes)
   - Claude Code extension — verify it's still available in VS Code marketplace
   - SSH key steps — currently ed25519, the current standard, unlikely to change soon
   - GitHub UI steps — GitHub redesigns occasionally; steps may need updating
3. Remove or update the Erin-specific framing in the final section ("For your first project")
4. Adjust the help contacts section (Andrew/Connor/David) as relevant

Most of the content will remain valid for 2–3 years.

---

## Trigger for updating the base doc

- If a step fails for Erin and a fix is found, update the doc immediately
- If the VS Code Claude Code extension changes its install flow, update Section 5
- If Node.js LTS moves from 20 to 22, update Section 4
- Otherwise, the doc is stable

---

## Connection to TRACE family structure

This doc is the first concrete artifact of TRACE's "family as contractors" operating model in practice. The pattern it establishes:

> Non-developer family member + written setup guide + brothers available for blockers → working contributor in 1–2 sessions

If this pattern works for Erin, it becomes the onboarding template for any future family contributor who isn't already a developer. The cost of producing this doc was approximately 45 minutes. Reuse cost per additional family member is approximately 15 minutes (copy, update names and specifics).

*Per CLAUDE.md Part 9, Step 12 (runbook capture for setup operations).*
