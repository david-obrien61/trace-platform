# "Local Storage" — Defined-Vocabulary Note (#69 merge blocker)

**Date:** 2026-07-01 · **Author:** Thunder · **Type:** vocabulary clarification, doc-only.
**Why this exists:** In the `assets`/camera (#69) discussion, "local storage" was used to mean **two entirely different things**, which stalled the merge conversation. [`2026-06-29-assets-branch-review.md`](2026-06-29-assets-branch-review.md) §3.6 + decision-point (A) FLAGS the collision (localhost disk vs Supabase Storage) but does not canonicalize the terms. This note pins the two senses so they are never conflated again. It resolves nothing about the build itself — it defines words.

---

## The two senses (do not conflate)

### 1. "Local storage" — the **file-host** sense (Andrew's usage)
- **Meaning:** WHERE a photo FILE physically sits. The captured image bytes live on **local disk** (the filesystem) served by the `localhost:8000` FastAPI backend (`StaticFiles` at `/api/assets/files`, `RawElementAssets/`), as opposed to **Supabase Storage** (cloud object store).
- **Axis:** *file hosting location* — local disk **vs** Supabase Storage bucket.
- **Where it shows up:** the `assets`-branch camera pipeline (`assets/server.py`, `AssetManager.jsx` calling `${'/api/assets'}/upload|analyze|fetch_price`). Today `photo_url` points at a `localhost` path.
- **Status:** a **dev convenience**. Local-disk hosting must become **Supabase-Storage-backed in production** (port `/api/assets/*` to Vercel functions; images move to Supabase Storage so `photo_url` is cloud-served). See assets-branch-review §3.6 + decision (A).

### 2. "Local storage" — the **offline-first** sense (David's usage)
- **Meaning:** store data on the device WHILE **DISCONNECTED**, then **push on RECONNECT**. This is **connectivity resilience**, not a file location.
- **Axis:** *connectivity state* — write-while-offline **then** reconcile-when-online.
- **Where it shows up:** the same principle as the session-persistence offline fix (keep last-known while offline, resume on reconnect — see [`2026-06-29-session-persistence-recon.md`](2026-06-29-session-persistence-recon.md)) and a **sync queue** (the sometimes-connected write pattern the walk-and-count loop already needs). This is a **PLATFORM pattern**, not Cultivar-specific.
- **Status:** offline-store-then-push **always reconciles to Supabase** as the source of truth.

---

## The unifying principle

> "Info on a phone is fine for a one-man op, but a BUSINESS needs a central repo."

**Both senses resolve to the same north star — Supabase is the single source of truth — by different mechanisms:**

| | Sense 1 (file-host) | Sense 2 (offline-first) |
|---|---|---|
| What it's about | WHERE the file lives | WHEN the write happens vs connectivity |
| Local form | image on local disk (`localhost:8000`) | data buffered on device while offline |
| Reconciles to Supabase by | moving file hosting to Supabase Storage in prod | pushing the queued writes on reconnect |
| Nature | **dev convenience** — must be replaced for prod | **platform pattern** — a durable capability |

- **Local-disk file-hosting** is a temporary dev shortcut → becomes Supabase-Storage-backed.
- **Offline-store-then-push** is a first-class resilience pattern → always reconciles to Supabase central truth.
- **Never conflate them.** A sentence about "local storage" must say which axis it means: *file location* or *connectivity resilience*.

---

## Cross-references
- [`2026-06-29-assets-branch-review.md`](2026-06-29-assets-branch-review.md) — §3.6 + decision (A): the camera pipeline's localhost-disk-vs-Supabase-Storage production wiring (sense 1). This note supplies the vocabulary that review flagged as unresolved.
- [`2026-06-29-session-persistence-recon.md`](2026-06-29-session-persistence-recon.md) — the offline-tolerant / keep-last-known session behavior (sense 2 in practice).
- Tech-debt **#41** (CLAUDE.md) — the localhost:8000 camera pipeline as local-dev-only; part of the same #69 pre-merge story.
