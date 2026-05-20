"""
quickbooks.py — QuickBooks OAuth 2.0 endpoints for Cultivar OS.
Ported from CAI/shop_estimate.py (QB section).

OAuth flow is identical to Ignition OS.
Token storage changed: shop_db.json → Supabase `nurseries` table.
Only change from original: shop_id → nursery_id in token storage.
"""

import os
import base64
import secrets
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
import httpx
from dotenv import load_dotenv

load_dotenv(override=True)

qbo_router = APIRouter(prefix="/api/qbo", tags=["QuickBooks"])

# ── QB OAuth config ───────────────────────────────────────────────────────────

QBO_CLIENT_ID     = os.getenv("QBO_CLIENT_ID", "")
QBO_CLIENT_SECRET = os.getenv("QBO_CLIENT_SECRET", "")
QBO_REDIRECT_URI  = os.getenv("QBO_REDIRECT_URI", "http://localhost:8000/api/qbo/callback")
QBO_ENVIRONMENT   = os.getenv("QBO_ENVIRONMENT", "sandbox")  # "sandbox" or "production"
QBO_SCOPE         = "com.intuit.quickbooks.accounting"

QBO_AUTH_BASE = "https://appcenter.intuit.com/connect/oauth2"
QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
QBO_API_BASE  = (
    "https://sandbox-quickbooks.api.intuit.com/v3/company"
    if QBO_ENVIRONMENT == "sandbox"
    else "https://quickbooks.api.intuit.com/v3/company"
)

# In-memory token cache (backed by Supabase nurseries table)
qbo_tokens: dict = {}

# OAuth state nonce (prevents CSRF)
_oauth_states: dict = {}

# ── Supabase token storage (nurseries table) ──────────────────────────────────

def _supabase():
    from supabase import create_client
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("Supabase env vars not set")
    return create_client(url, key)


def load_qbo_tokens(nursery_id: str = None):
    """Load QB tokens from Supabase nurseries table (individual columns) into the in-memory cache."""
    global qbo_tokens
    if not nursery_id:
        return
    try:
        db = _supabase()
        res = db.table("nurseries").select(
            "qb_access_token, qb_refresh_token, qb_realm_id"
        ).eq("id", nursery_id).maybe_single().execute()
        if res.data and res.data.get("qb_realm_id"):
            qbo_tokens = {
                "access_token":  res.data.get("qb_access_token", ""),
                "refresh_token": res.data.get("qb_refresh_token", ""),
                "realm_id":      res.data.get("qb_realm_id", ""),
                "connected":     True,
            }
        else:
            qbo_tokens = {}
    except Exception as e:
        print(f"[QBO] load_qbo_tokens failed (non-fatal): {e}")
        qbo_tokens = {}


def save_qbo_tokens(nursery_id: str = None):
    """Persist in-memory QB tokens to Supabase nurseries table (individual columns)."""
    if not nursery_id:
        return
    try:
        db = _supabase()
        db.table("nurseries").update({
            "qb_access_token":  qbo_tokens.get("access_token", ""),
            "qb_refresh_token": qbo_tokens.get("refresh_token", ""),
            "qb_realm_id":      qbo_tokens.get("realm_id", ""),
        }).eq("id", nursery_id).execute()
    except Exception as e:
        print(f"[QBO] save_qbo_tokens failed (non-fatal): {e}")

# ── OAuth endpoints ───────────────────────────────────────────────────────────

@qbo_router.get("/auth-url")
async def qbo_auth_url():
    """Returns the Intuit OAuth2 authorization URL for the frontend to open as a popup."""
    if not QBO_CLIENT_ID:
        raise HTTPException(status_code=500, detail="QBO_CLIENT_ID not set in .env file. See setup instructions.")

    state = secrets.token_urlsafe(16)
    _oauth_states[state] = True

    params = (
        f"?client_id={QBO_CLIENT_ID}"
        f"&redirect_uri={QBO_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={QBO_SCOPE}"
        f"&state={state}"
    )
    return {"url": QBO_AUTH_BASE + params}


@qbo_router.get("/callback")
async def qbo_callback(
    code: str = Query(...),
    state: str = Query(...),
    realmId: str = Query(...),
    nursery_id: str = Query(None),
):
    """
    Intuit redirects here after the user approves. Exchanges the auth code for tokens,
    then closes the popup with a self-closing HTML page.
    """
    global qbo_tokens

    if state not in _oauth_states:
        return HTMLResponse("<h2>Invalid state. Please try connecting again.</h2>", status_code=400)
    del _oauth_states[state]

    credentials = base64.b64encode(f"{QBO_CLIENT_ID}:{QBO_CLIENT_SECRET}".encode()).decode()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            QBO_TOKEN_URL,
            headers={
                "Authorization": f"Basic {credentials}",
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": QBO_REDIRECT_URI,
            },
        )

    if resp.status_code != 200:
        return HTMLResponse(f"<h2>Token exchange failed: {resp.text}</h2>", status_code=500)

    token_data = resp.json()

    # Fetch company name from QBO
    company_name = ""
    try:
        async with httpx.AsyncClient() as client:
            info_resp = await client.get(
                f"{QBO_API_BASE}/{realmId}/companyinfo/{realmId}?minorversion=65",
                headers={
                    "Authorization": f"Bearer {token_data['access_token']}",
                    "Accept": "application/json",
                },
            )
        if info_resp.status_code == 200:
            company_name = info_resp.json().get("CompanyInfo", {}).get("CompanyName", "")
    except Exception:
        pass

    qbo_tokens = {
        "access_token":  token_data["access_token"],
        "refresh_token": token_data.get("refresh_token", ""),
        "realm_id":      realmId,
        "company_name":  company_name,
        "connected":     True,
    }
    save_qbo_tokens(nursery_id)

    # Self-closing popup — the frontend polls /api/qbo/status to detect success
    return HTMLResponse("""
        <html><body style="font-family:sans-serif;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h2 style="color:#10b981">QuickBooks Connected!</h2>
            <p style="color:#64748b">This window will close automatically...</p>
          </div>
          <script>setTimeout(() => window.close(), 1500);</script>
        </body></html>
    """)


@qbo_router.get("/status")
async def qbo_status(nursery_id: str = Query(None)):
    """Frontend polls this to confirm OAuth completed and tokens are stored."""
    load_qbo_tokens(nursery_id)
    if not qbo_tokens.get("connected"):
        return {"connected": False}
    return {
        "connected":   True,
        "realmId":     qbo_tokens.get("realm_id"),
        "companyName": qbo_tokens.get("company_name"),
    }


@qbo_router.post("/disconnect")
async def qbo_disconnect(nursery_id: str = Query(None)):
    global qbo_tokens
    qbo_tokens = {}
    save_qbo_tokens(nursery_id)
    return {"status": "disconnected"}


async def _refresh_qbo_token(nursery_id: str = None):
    """Silently refreshes the access token using the stored refresh token."""
    global qbo_tokens
    credentials = base64.b64encode(f"{QBO_CLIENT_ID}:{QBO_CLIENT_SECRET}".encode()).decode()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            QBO_TOKEN_URL,
            headers={
                "Authorization": f"Basic {credentials}",
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "refresh_token",
                "refresh_token": qbo_tokens["refresh_token"],
            },
        )
    if resp.status_code == 200:
        data = resp.json()
        qbo_tokens["access_token"]  = data["access_token"]
        qbo_tokens["refresh_token"] = data.get("refresh_token", qbo_tokens["refresh_token"])
        save_qbo_tokens(nursery_id)
        return True
    return False


async def _qbo_get(path: str, nursery_id: str = None):
    """Authenticated GET to QBO API with one automatic token refresh on 401."""
    load_qbo_tokens(nursery_id)
    if not qbo_tokens.get("connected"):
        raise HTTPException(status_code=401, detail="QuickBooks not connected.")

    realm   = qbo_tokens["realm_id"]
    url     = f"{QBO_API_BASE}/{realm}/{path}&minorversion=65"
    headers = {"Authorization": f"Bearer {qbo_tokens['access_token']}", "Accept": "application/json"}

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers)

    if resp.status_code == 401:
        refreshed = await _refresh_qbo_token(nursery_id)
        if refreshed:
            headers["Authorization"] = f"Bearer {qbo_tokens['access_token']}"
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, headers=headers)

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=f"QBO API error: {resp.text}")

    return resp.json()


@qbo_router.get("/customers")
async def qbo_get_customers(nursery_id: str = Query(None)):
    """Pulls all active customers from QuickBooks Online."""
    data = await _qbo_get("query?query=select * from Customer where Active = true MAXRESULTS 500", nursery_id)
    customers = data.get("QueryResponse", {}).get("Customer", [])
    return {"customers": customers, "count": len(customers)}


@qbo_router.get("/invoices")
async def qbo_get_invoices(days: int = Query(90, ge=1, le=365), nursery_id: str = Query(None)):
    """Pulls invoices created within the last N days from QuickBooks Online."""
    from datetime import datetime, timedelta
    since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    data = await _qbo_get(f"query?query=select * from Invoice where TxnDate >= '{since}' MAXRESULTS 500", nursery_id)
    invoices = data.get("QueryResponse", {}).get("Invoice", [])
    return {"invoices": invoices, "count": len(invoices)}


def _build_transport_lines(
    transport_method: str,
    netting_declined: bool,
    netting_selected: bool,
    quantity: int,
    netting_price_per_tree: float,
) -> tuple[list[dict], str]:
    """
    Returns (qbo_line_items, memo_addition) for the transport/netting decision.

    Called by qbo_push_invoice before submitting to QB.
    The returned lines are appended to the invoice's Line array.
    The memo is appended to the invoice's CustomerMemo.
    """
    if transport_method in ("delivery", "install"):
        line = {
            "Description": "Transport: LAWNS Tree Farm staff delivery/install",
            "Amount": 0.00,
            "DetailType": "SalesItemLineDetail",
            "SalesItemLineDetail": {
                "UnitPrice": 0.00,
                "Qty": 1,
            },
        }
        memo = "LAWNS Tree Farm delivering/installing. Transport by nursery staff."
        return [line], memo

    # transport_method == "self"
    if netting_selected and not netting_declined:
        total = netting_price_per_tree * quantity
        line = {
            "Description": f"Protective travel netting ({quantity} tree{'s' if quantity != 1 else ''})",
            "Amount": round(total, 2),
            "DetailType": "SalesItemLineDetail",
            "SalesItemLineDetail": {
                "UnitPrice": round(netting_price_per_tree, 2),
                "Qty": quantity,
            },
        }
        memo = (
            f"Customer self-transporting. Protective netting applied before loading "
            f"per Texas Transportation Code Ch. 725."
        )
        return [line], memo
    else:
        line = {
            "Description": "Protective travel netting — DECLINED",
            "Amount": 0.00,
            "DetailType": "SalesItemLineDetail",
            "SalesItemLineDetail": {
                "UnitPrice": 0.00,
                "Qty": quantity,
            },
        }
        memo = (
            "Customer advised of Texas Transportation Code Ch. 725 load securing requirements. "
            "Customer declined netting and accepted responsibility for transport."
        )
        return [line], memo


@qbo_router.post("/invoice")
async def qbo_push_invoice(
    payload: dict,
    nursery_id: str = Query(None),
    transport_method: str = Query("self"),
    netting_declined: bool = Query(False),
    netting_selected: bool = Query(True),
    quantity: int = Query(1),
    netting_price_per_tree: float = Query(10.0),
):
    """Pushes a completed Cultivar OS work order as a new Invoice to QuickBooks Online.

    Automatically injects a transport/netting line item and memo into every invoice
    based on the customer's transport and netting decisions.
    """
    load_qbo_tokens(nursery_id)
    if not qbo_tokens.get("connected"):
        raise HTTPException(status_code=401, detail="QuickBooks not connected.")

    # Inject transport lines
    transport_lines, transport_memo = _build_transport_lines(
        transport_method=transport_method,
        netting_declined=netting_declined,
        netting_selected=netting_selected,
        quantity=quantity,
        netting_price_per_tree=netting_price_per_tree,
    )

    existing_lines = payload.get("Line", [])
    payload["Line"] = existing_lines + transport_lines

    existing_memo = payload.get("CustomerMemo", {}).get("value", "")
    separator = " | " if existing_memo else ""
    payload["CustomerMemo"] = {"value": f"{existing_memo}{separator}{transport_memo}"}

    realm   = qbo_tokens["realm_id"]
    url     = f"{QBO_API_BASE}/{realm}/invoice?minorversion=65"
    headers = {
        "Authorization": f"Bearer {qbo_tokens['access_token']}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload)

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code, detail=f"QBO push failed: {resp.text}")

    return resp.json()
