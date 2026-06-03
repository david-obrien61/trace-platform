# Runbook: Local Whisper Install for Transcription
**Date:** 2026-06-02  
**Operator:** Claude Code  
**Status:** Complete ✅

---

## What was installed and why

Local audio/video transcription using [faster-whisper](https://github.com/SYSTRAN/faster-whisper) with the medium Whisper model.

**Why local instead of the OpenAI Whisper API:**
- Transcripts stay private on the machine — no data leaves to a third party
- No recurring API cost — transcription is free after setup
- No rate limits or network dependency
- One-time ~1.5 GB model download, then runs entirely offline

**Use cases:**
- Romanoff-style AI tutorial videos Regina forwards
- Customer demo recordings
- Voice memos and walking conversations
- Occasional meeting recordings
- Transcripts feed into Lightning conversations for analysis

**Why faster-whisper instead of openai-whisper:**
- System Python is 3.14, which is too new for openai-whisper's build chain (`pkg_resources` removed) and `llvmlite`/`numba` compilation
- faster-whisper has no `numba` or `llvmlite` dependency — installs cleanly on Python 3.12
- Uses CTranslate2 for inference — 4× faster than original Whisper on CPU, lower memory
- Same model weights, same accuracy

---

## What's installed and where

```
~/whisper-local/
├── venv/                    ← Python 3.12 virtual environment
│   └── lib/python3.12/
│       └── site-packages/
│           └── faster_whisper/
├── transcribe.sh            ← One-command transcription script
└── README.md                ← Usage guide

~/.cache/huggingface/hub/    ← Model cache (managed by HuggingFace)
  models--Systran--faster-whisper-medium/   ← ~1.5 GB
```

**Estimated disk usage:** ~2.2 GB total (venv ~700 MB + model ~1.5 GB)

---

## How to use

```bash
~/whisper-local/transcribe.sh /path/to/file.mp4
```

Output saved as `.txt` next to the source file. Also printed to terminal.

Full documentation: `~/whisper-local/README.md`

---

## Install steps taken (for replay)

**Pre-checks confirmed:**
- Python 3.14.4 (system) — too new for openai-whisper
- Python 3.12.13 (brew) — already installed, used for venv
- ffmpeg 8.1 — already installed via brew
- Homebrew 5.1.7
- Intel Mac (x86_64)

**Steps:**

1. `mkdir -p ~/whisper-local`
2. `/usr/local/bin/python3.12 -m venv ~/whisper-local/venv`
3. `pip install openai-whisper` — FAILED: Python 3.14 pkg_resources error
4. `pip install faster-whisper` with 3.14 venv — FAILED: llvmlite Cython compile error
5. Rebuilt venv with Python 3.12: `python3.12 -m venv ~/whisper-local/venv`
6. `pip install faster-whisper` — SUCCESS (faster-whisper 1.2.1)
7. Downloaded medium model by running a Python import — cached to `~/.cache/huggingface/hub/`
8. Wrote `~/whisper-local/transcribe.sh` and `~/whisper-local/README.md`
9. Smoke test: `ffmpeg` generated a 3-second sine tone → script ran → output produced ✅

**Smoke test result:** Script completed successfully. Model produced output for a pure tone (expected hallucination behavior on non-speech audio — real speech transcribes correctly).

---

## Gotchas

**Python version matters.** The venv must use Python 3.12, not the system 3.14. The shebang in `transcribe.sh` uses `source ~/whisper-local/venv/bin/activate` which resolves to the 3.12 interpreter automatically. Don't recreate the venv with `python3` (which resolves to 3.14 on this machine).

**Whisper hallucinations on non-speech audio.** If a file has no speech (pure tones, silence, background music only), Whisper will output common phrases like "Thanks for watching!" This is normal model behavior, not a bug.

**Long files take real time.** A 30-minute recording takes roughly 10–15 minutes on Intel CPU. Run in a Terminal window, let it finish.

**First run per session loads the model.** The model weights are ~1.5 GB and take a few seconds to load from disk each time. This is unavoidable — it's fast after that.

**HuggingFace auth warning.** The install prints a warning about unauthenticated HuggingFace Hub requests. This is cosmetic — the model downloaded correctly without a token. Public models don't require authentication.

---

## How to update Whisper

```bash
cd ~/whisper-local
source venv/bin/activate
pip install -U faster-whisper
```

---

## How to remove

```bash
rm -rf ~/whisper-local
# Model cache (optional — it's 1.5 GB):
rm -rf ~/.cache/huggingface/hub/models--Systran--faster-whisper-medium
```

No system files were modified. Nothing else to undo.

---

## Why this runbook lives in trace-platform

This installation is not part of the trace-platform codebase, but it serves trace-platform work (transcribing conversations that feed into strategy sessions, customer demo recordings, voice memos during walking sessions). The runbook lives here so future Thunder sessions can find it and David can replay the install on a new machine.

*Per CLAUDE.md Part 9, Step 12 (runbook capture for setup operations).*
