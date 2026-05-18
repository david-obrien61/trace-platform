"""
ai_router.py — FastAPI router handling all AI provider calls for Ignition OS.

Mount in shop_estimate.py with:
    from ai_router import ai_router
    app.include_router(ai_router)

Providers:
  Gemini  — vision tasks (VIN, invoice, label OCR)
  Claude  — reasoning tasks (DTC decode, estimates, PMI suggestions)
  OpenAI  — audio/NLP tasks (voice transcription, parts extraction)
"""

import os, base64, json, time, tempfile
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Optional
from dotenv import load_dotenv

load_dotenv(override=True)

ai_router = APIRouter(prefix="/ai", tags=["AI Engine"])

# ── API clients ───────────────────────────────────────────────────────────────

def _gemini_client():
    from google import genai
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise HTTPException(500, "GEMINI_API_KEY not set")
    return genai.Client(api_key=key)

def _anthropic_client():
    try:
        import anthropic
    except ImportError:
        raise HTTPException(500, "anthropic package not installed — run: pip install anthropic")
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise HTTPException(500, "ANTHROPIC_API_KEY not set")
    return anthropic.Anthropic(api_key=key)

def _openai_client():
    try:
        import openai
    except ImportError:
        raise HTTPException(500, "openai package not installed — run: pip install openai")
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(500, "OPENAI_API_KEY not set")
    return openai.OpenAI(api_key=key)

# ── Supabase client (shared) ──────────────────────────────────────────────────

def _supabase():
    from supabase import create_client
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("Supabase env vars not set")
    return create_client(url, key)

# ── Usage logger ──────────────────────────────────────────────────────────────

def _log_usage(shop_id, task, provider, model, tokens_in=0, tokens_out=0, cost=0.0):
    try:
        _supabase().table("ai_usage").insert({
            "shop_id": shop_id, "task": task, "provider": provider,
            "model": model, "tokens_in": tokens_in,
            "tokens_out": tokens_out, "cost_usd": round(cost, 6)
        }).execute()
    except Exception as e:
        print(f"[AIRouter] usage log failed (non-fatal): {e}")

# ── Error logger ──────────────────────────────────────────────────────────────

def _log_error(shop_id, error_type, message, endpoint=None, detail=None):
    try:
        _supabase().table("error_events").insert({
            "shop_id":    shop_id or None,
            "error_type": error_type,
            "message":    str(message)[:500],
            "stack":      None,
            "user_agent": "backend/railway",
            "metadata":   {"endpoint": endpoint, "detail": str(detail)[:300]} if detail else {"endpoint": endpoint},
        }).execute()
    except Exception as e:
        print(f"[AIRouter] error log failed (non-fatal): {e}")

# ── Shared request model ──────────────────────────────────────────────────────

class AIRequest(BaseModel):
    shop_id:       Optional[str] = None
    prompt:        Optional[str] = None
    image_base64:  Optional[str] = None
    audio_base64:  Optional[str] = None
    codes:         Optional[list] = None
    vehicle:       Optional[dict] = None
    transcript:    Optional[str] = None
    tool:          Optional[dict] = None
    job:           Optional[dict] = None
    inventory:     Optional[list] = None
    media_type:    Optional[str]  = None
    _route:        Optional[dict] = None

# ─────────────────────────────────────────────────────────────────────────────
# GEMINI VISION TASKS
# ─────────────────────────────────────────────────────────────────────────────

def _gemini_vision(image_b64: str, prompt: str, shop_id: str, task: str) -> dict:
    from google.genai import types
    client = _gemini_client()
    model  = "gemini-2.0-flash"
    image_bytes = base64.b64decode(image_b64)
    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
            prompt
        ]
    )
    text = response.text or ""
    _log_usage(shop_id, task, "gemini", model, cost=0.0003)
    return {"text": text}

@ai_router.post("/vin_decode")
async def vin_decode(req: AIRequest):
    if not req.image_base64:
        raise HTTPException(400, "image_base64 required")
    prompt = (
        "Extract the VIN from this image. Also extract year, make, model if visible. "
        "Return ONLY valid JSON: {\"vin\": \"\", \"year\": \"\", \"make\": \"\", \"model\": \"\"}"
    )
    result = _gemini_vision(req.image_base64, prompt, req.shop_id, "vin_decode")
    try:
        parsed = json.loads(result["text"])
    except Exception:
        parsed = {"raw": result["text"]}
    return parsed

@ai_router.post("/invoice_scan")
async def invoice_scan(req: AIRequest):
    if not req.image_base64:
        raise HTTPException(400, "image_base64 required")
    prompt = (
        "This is a vendor invoice. Extract all line items with part number, description, "
        "quantity, unit cost, and total. Return ONLY valid JSON: "
        "{\"vendor\": \"\", \"invoice_number\": \"\", \"line_items\": []}"
    )
    result = _gemini_vision(req.image_base64, prompt, req.shop_id, "invoice_scan")
    try:
        return json.loads(result["text"])
    except Exception:
        return {"raw": result["text"]}

@ai_router.post("/label_read")
async def label_read(req: AIRequest):
    if not req.image_base64:
        raise HTTPException(400, "image_base64 required")
    prompt = (
        "Read all text visible on this equipment label or nameplate. Extract brand, model number, "
        "serial number, voltage/pressure/capacity specs if present. "
        "Return ONLY valid JSON: {\"brand\": \"\", \"model\": \"\", \"serial\": \"\", "
        "\"specs\": {}, \"raw_text\": \"\", \"detected_type\": \"\"}"
    )
    result = _gemini_vision(req.image_base64, prompt, req.shop_id, "label_read")
    try:
        return json.loads(result["text"])
    except Exception:
        return {"raw": result["text"]}

@ai_router.post("/part_photo_id")
async def part_photo_id(req: AIRequest):
    if not req.image_base64:
        raise HTTPException(400, "image_base64 required")
    prompt = (
        "Identify this automotive part from the photo. Return part name, likely OEM part number "
        "if visible, condition (new/used/worn), and any visible text. "
        "Return ONLY valid JSON: {\"part_name\": \"\", \"part_number\": \"\", "
        "\"condition\": \"\", \"notes\": \"\"}"
    )
    result = _gemini_vision(req.image_base64, prompt, req.shop_id, "part_photo_id")
    try:
        return json.loads(result["text"])
    except Exception:
        return {"raw": result["text"]}

# ─────────────────────────────────────────────────────────────────────────────
# CLAUDE REASONING TASKS
# ─────────────────────────────────────────────────────────────────────────────

def _claude_text(system: str, user: str, shop_id: str, task: str,
                 model: str = "claude-haiku-4-5-20251001",
                 max_tokens: int = 1024) -> str:
    client = _anthropic_client()
    msg = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}]
    )
    text = msg.content[0].text
    _log_usage(shop_id, task, "claude", model,
               tokens_in=msg.usage.input_tokens,
               tokens_out=msg.usage.output_tokens,
               cost=(msg.usage.input_tokens * 0.00000025 + msg.usage.output_tokens * 0.00000125))
    return text

@ai_router.post("/dtc_decode")
async def dtc_decode(req: AIRequest):
    codes   = req.codes or []
    vehicle = req.vehicle or {}
    system  = (
        "You are an expert diesel and automotive technician. "
        "Translate fault codes into plain English with likely cause, urgency, and next steps. "
        "Always return valid JSON only."
    )
    user = (
        f"Vehicle: {json.dumps(vehicle)}\n"
        f"Fault codes: {', '.join(codes)}\n\n"
        "Return JSON: {\"codes\": [{\"code\": \"\", \"description\": \"\", "
        "\"likely_cause\": \"\", \"urgency\": \"LOW|MEDIUM|HIGH|CRITICAL\", "
        "\"estimated_labor_hrs\": 0, \"parts_likely_needed\": []}]}"
    )
    text = _claude_text(system, user, req.shop_id, "dtc_decode")
    try:
        return json.loads(text)
    except Exception:
        return {"raw": text}

@ai_router.post("/estimate_draft")
async def estimate_draft(req: AIRequest):
    job    = req.job or {}
    system = (
        "You are a service advisor AI. Draft professional customer-facing estimate text "
        "based on the job data. Be clear, concise, and avoid jargon. Return valid JSON only."
    )
    user = (
        f"Job data: {json.dumps(job)}\n\n"
        "Return JSON: {\"summary\": \"\", \"line_items\": [], \"customer_message\": \"\", "
        "\"recommended_followup\": \"\"}"
    )
    text = _claude_text(system, user, req.shop_id, "estimate_draft")
    try:
        return json.loads(text)
    except Exception:
        return {"raw": text}

@ai_router.post("/pmi_suggest")
async def pmi_suggest(req: AIRequest):
    tool   = req.tool or {}
    system = (
        "You are a shop equipment maintenance expert. "
        "Based on the equipment type and specs, suggest a practical PMI schedule. "
        "Return valid JSON only."
    )
    user = (
        f"Equipment: {json.dumps(tool)}\n\n"
        "Return JSON: {\"detected_type\": \"\", \"tasks\": ["
        "{\"name\": \"\", \"interval\": \"daily|weekly|monthly|quarterly|annually\", "
        "\"description\": \"\"}]}"
    )
    text = _claude_text(system, user, req.shop_id, "pmi_suggest")
    try:
        return json.loads(text)
    except Exception:
        return {"raw": text}

@ai_router.post("/invoice_audit")
async def invoice_audit(req: AIRequest):
    """
    Single-stage audit using Claude vision — reads invoice image AND audits in one call.
    No Gemini dependency. Claude sees the raw image directly for maximum accuracy.
    """
    if not req.image_base64:
        raise HTTPException(400, "image_base64 required")

    inventory_snapshot = json.dumps((req.inventory or [])[:60]) if req.inventory else "[]"
    media_type = req.media_type or "image/jpeg"

    client = _anthropic_client()
    system = (
        "You are an aggressive automotive shop profitability auditor. "
        "You will be shown a repair invoice image. Read every word on it — "
        "including advisory notes, tech notes, italic text, and footer text. "
        "Then audit it for missing charges using these MANDATORY rules:\n\n"
        "OIL CHANGE (any lube/oil/filter service): ALWAYS flag if missing:\n"
        "  - Drain plug crush washer or drain plug gasket (~$3-5) — HIGH severity\n"
        "  - Shop supplies / shop fee ($3-8) — MEDIUM severity\n"
        "  - Hazmat / oil disposal fee ($3-5) — MEDIUM severity. "
        "    DO NOT flag if any of these already appear on the invoice (all are the same charge): "
        "    'Environmental Disposal Fee', 'Environmental Fee', 'Eco Fee', 'Recycling Fee', "
        "    'Waste Disposal', 'Oil Disposal', 'Fluid Disposal', 'Shop Environmental Fee', "
        "    'Hazmat Fee'. If ANY of these exist as a line item, this rule is satisfied.\n\n"
        "FLUID TOP-OFFS: Any fluid mentioned anywhere on the invoice as 'low', "
        "'topped off', 'added', 'filled', 'a little low', 'checked' — "
        "if NO charge line exists for that fluid, flag HIGH severity FLUID. "
        "This includes: power steering fluid, coolant, washer fluid, ATF, "
        "brake fluid, differential fluid. Each costs $8-20/qt from shop inventory.\n\n"
        "TIRE ROTATION: If rotation is documented anywhere in notes or work description "
        "but no rotation labor line item appears on the invoice, flag MEDIUM.\n\n"
        "SHOP SUPPLIES / HAZMAT: If these line items show $0.00 on a service invoice, "
        "flag MEDIUM. Real consumables were used.\n\n"
        "ADVISORY UPSELLS: Any advisory notes (leaks, worn parts, upcoming services) "
        "with no corresponding estimate created = flag LOW as lost opportunity.\n\n"
        "inventory_consumed_uncharged RULES — STRICT:\n"
        "  ONLY put items here if ALL of these are true:\n"
        "  1. The item physically appears in the service checklist, tech notes, or description\n"
        "  2. The item came from shop inventory (fluid, chemical, consumable)\n"
        "  3. There is NO dollar amount charged for that specific item anywhere on the invoice\n"
        "  If a line item exists on the invoice with a price > $0 for that product, "
        "it is ALREADY BILLED — do NOT put it in inventory_consumed_uncharged. "
        "Example: Mobil Synthetic 0w20 listed at $45.32 is billed — never flag it as uncharged.\n\n"
        "Never return empty missing_charges if any rule above is violated. "
        "Return valid JSON only — no markdown, no explanation text."
    )
    user_text = (
        "Read this repair invoice image carefully, then audit it.\n\n"
        f"Shop inventory on hand:\n{inventory_snapshot}\n\n"
        "Return this exact JSON structure:\n"
        '{"invoice_summary": {"customer": "", "vehicle": "", "date": "", '
        '"services": [], "total_billed": 0}, '
        '"missing_charges": [{"item": "", "reason": "", "estimated_value": 0, '
        '"severity": "HIGH", "category": "PART"}], '
        '"inventory_consumed_uncharged": [{"item": "", "qty_estimate": 1, '
        '"unit_cost": 0, "inventory_match": ""}], '
        '"leakage_patterns": [{"pattern": "", "example": "", "monthly_loss_est": 0}], '
        '"recovery_potential": 0, '
        '"flags": [{"type": "MISSING_PART", "message": "", "action": ""}]}'
    )

    try:
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            system=system,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": req.image_base64,
                        },
                    },
                    {"type": "text", "text": user_text},
                ],
            }],
        )
    except Exception as e:
        _log_error(req.shop_id, "AI_CALL", str(e), endpoint="/invoice_audit")
        raise HTTPException(400, f"Could not read image: {str(e)}")

    _log_usage(req.shop_id or "", "invoice_audit", "claude", "claude-haiku-4-5-20251001",
               tokens_in=msg.usage.input_tokens, tokens_out=msg.usage.output_tokens,
               cost=(msg.usage.input_tokens * 0.00000025 + msg.usage.output_tokens * 0.00000125))
    audit_text = msg.content[0].text
    try:
        clean = audit_text.strip()
        if clean.startswith("```"):
            clean = "\n".join(clean.split("\n")[1:])
        if clean.endswith("```"):
            clean = clean.rsplit("```", 1)[0]
        audit = json.loads(clean.strip())
        return {**audit, "invoice": audit.get("invoice_summary", {})}
    except Exception:
        return {"raw": audit_text, "invoice": {}}

@ai_router.post("/savings_report")
async def savings_report(req: AIRequest):
    system = (
        "You are a shop profitability analyst for Ignition OS. "
        "Analyze the shop's job and margin data and produce a plain-language savings summary. "
        "Return valid JSON only."
    )
    user = (
        f"Shop ID: {req.shop_id}\n"
        "Summarize margin deviations, flagged jobs, and estimated recoverable revenue. "
        "Return JSON: {\"total_jobs_analyzed\": 0, \"flagged_jobs\": 0, "
        "\"recoverable_margin_usd\": 0, \"top_leaks\": [], \"summary\": \"\"}"
    )
    text = _claude_text(system, user, req.shop_id, "savings_report",
                        model="claude-sonnet-4-6")
    try:
        return json.loads(text)
    except Exception:
        return {"raw": text}

# ─────────────────────────────────────────────────────────────────────────────
# OPENAI AUDIO / NLP TASKS
# ─────────────────────────────────────────────────────────────────────────────

@ai_router.post("/voice_transcribe")
async def voice_transcribe(req: AIRequest):
    if not req.audio_base64:
        raise HTTPException(400, "audio_base64 required")
    client = _openai_client()
    audio_bytes = base64.b64decode(req.audio_base64)
    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    try:
        with open(tmp_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1", file=audio_file
            )
        _log_usage(req.shop_id, "voice_transcribe", "openai", "whisper-1", cost=0.006)
        return {"transcript": transcript.text}
    finally:
        os.unlink(tmp_path)

@ai_router.post("/parts_nlp")
async def parts_nlp(req: AIRequest):
    if not req.transcript:
        raise HTTPException(400, "transcript required")
    client   = _openai_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content":
                "Extract automotive parts and quantities from technician voice notes. "
                "Return ONLY valid JSON: {\"parts\": [{\"name\": \"\", \"qty\": 1, "
                "\"notes\": \"\"}], \"labor_notes\": \"\"}"},
            {"role": "user", "content": req.transcript}
        ]
    )
    text = response.choices[0].message.content
    usage = response.usage
    _log_usage(req.shop_id, "parts_nlp", "openai", "gpt-4o-mini",
               tokens_in=usage.prompt_tokens, tokens_out=usage.completion_tokens,
               cost=(usage.prompt_tokens * 0.00000015 + usage.completion_tokens * 0.0000006))
    try:
        return json.loads(text)
    except Exception:
        return {"raw": text}

@ai_router.post("/intent_classify")
async def intent_classify(req: AIRequest):
    if not req.transcript:
        raise HTTPException(400, "transcript required")
    client   = _openai_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content":
                "Classify the intent of this voice command from an auto shop technician. "
                "Intents: PARTS_REQUEST, CLOCK_IN, CLOCK_OUT, SUSPEND_JOB, COMPLETE_JOB, "
                "TECH_NOTE, PHOTO_REQUEST, UNKNOWN. "
                "Return ONLY valid JSON: {\"intent\": \"\", \"confidence\": 0.0, \"entities\": {}}"},
            {"role": "user", "content": req.transcript}
        ]
    )
    text = response.choices[0].message.content
    try:
        return json.loads(text)
    except Exception:
        return {"raw": text}
