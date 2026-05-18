"""
orders.py — POST /api/order for Cultivar OS.

Creates customer, order, order_items, order_addons in Supabase.
Updates plant status to 'reserved'.
Returns order_id, invoice_number, totals.

QB invoice creation is wired in Session 5.
"""

import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
from dotenv import load_dotenv

load_dotenv(override=True)

orders_router = APIRouter(prefix="/api", tags=["Orders"])

LARGE_CONTAINERS = {"15 gal", "30 gal", "45 gal", "60 gal", "100 gal"}
TAX_RATE = 0.0825
DEMO_NURSERY_ID = "a1b2c3d4-0000-0000-0000-000000000001"


# ── Pydantic models ───────────────────────────────────────────────────────────

class CustomerIn(BaseModel):
    first_name:       str
    last_name:        str
    email:            EmailStr
    phone:            Optional[str] = None
    address:          Optional[str] = None
    city:             Optional[str] = None
    state:            Optional[str] = "TX"
    zip:              Optional[str] = None
    marketing_opt_in: bool = True


class OrderRequest(BaseModel):
    nursery_id:        str = DEMO_NURSERY_ID
    plant_id:          str
    quantity:          int
    transport_method:  str  # "self" | "delivery" | "install"
    netting_declined:  bool = False
    selected_addon_ids: list[str] = []
    customer:          CustomerIn


class OrderResponse(BaseModel):
    order_id:       str
    invoice_number: str
    subtotal:       float
    tax_amount:     float
    total:          float
    customer_email: str
    transport_note: str
    qb_invoice_url: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _supabase():
    from supabase import create_client
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("Supabase env vars not set")
    return create_client(url, key)


def _transport_note(method: str, netting_declined: bool, netting_active: bool) -> str:
    if method != "self":
        return "LAWNS staff transport"
    if netting_active:
        return "Customer self-transport — netting purchased"
    return "Customer self-transport — netting declined, Texas TCC Ch.725 waiver acknowledged"


def _invoice_number() -> str:
    now = datetime.now(tz=timezone.utc)
    date_part = now.strftime("%Y%m%d")
    seq = str(now.minute * 60 + now.second).zfill(3)
    return f"CLV-{date_part}-{seq}"


# ── POST /api/order ───────────────────────────────────────────────────────────

@orders_router.post("/order", response_model=OrderResponse)
async def create_order(req: OrderRequest):
    db = _supabase()

    # ── 1. Find or create customer ─────────────────────────────────────────
    res = (
        db.table("customers")
        .select("id")
        .eq("nursery_id", req.nursery_id)
        .eq("email", req.customer.email)
        .limit(1)
        .execute()
    )
    if res.data:
        customer_id = res.data[0]["id"]
        db.table("customers").update({
            "first_name":     req.customer.first_name,
            "last_name":      req.customer.last_name,
            "phone":          req.customer.phone,
            "address_line1":  req.customer.address,
            "city":           req.customer.city,
            "state":          req.customer.state or "TX",
            "zip":            req.customer.zip,
            "marketing_opt_in": req.customer.marketing_opt_in,
        }).eq("id", customer_id).execute()
    else:
        new_cust = db.table("customers").insert({
            "nursery_id":     req.nursery_id,
            "first_name":     req.customer.first_name,
            "last_name":      req.customer.last_name,
            "email":          req.customer.email,
            "phone":          req.customer.phone,
            "address_line1":  req.customer.address,
            "city":           req.customer.city,
            "state":          req.customer.state or "TX",
            "zip":            req.customer.zip,
            "marketing_opt_in": req.customer.marketing_opt_in,
            "source":         "qr-scan",
        }).execute()
        if not new_cust.data:
            raise HTTPException(status_code=500, detail="Customer creation failed")
        customer_id = new_cust.data[0]["id"]

    # ── 2. Fetch plant + addons ────────────────────────────────────────────
    plant_res = db.table("plants").select("*").eq("id", req.plant_id).single().execute()
    if not plant_res.data:
        raise HTTPException(status_code=404, detail="Plant not found")
    plant = plant_res.data

    addon_rows = []
    if req.selected_addon_ids:
        addon_res = (
            db.table("addons")
            .select("*")
            .in_("id", req.selected_addon_ids)
            .execute()
        )
        addon_rows = addon_res.data or []

    # ── 3. Totals ──────────────────────────────────────────────────────────
    netting_active = req.transport_method == "self" and not req.netting_declined
    netting_addon  = next((a for a in addon_rows if a.get("trigger_rule") == "transport=self"), None)
    netting_price  = netting_addon["price_per_plant"] if netting_addon else 10.0
    netting_total  = netting_price * req.quantity if netting_active and netting_addon else 0.0

    always_addons  = [a for a in addon_rows if a.get("trigger_rule") == "always"]
    always_total   = sum(a["price_per_plant"] * req.quantity for a in always_addons)

    plant_subtotal = float(plant["base_price"]) * req.quantity
    addons_amount  = netting_total + always_total
    subtotal       = plant_subtotal + addons_amount
    tax_amount     = round(subtotal * TAX_RATE, 2)
    total          = subtotal + tax_amount

    # ── 4. Leakage flag ────────────────────────────────────────────────────
    leakage_flag = (
        plant.get("current_container") in LARGE_CONTAINERS
        and addons_amount == 0
    )

    # ── 5. Transport note & invoice number ─────────────────────────────────
    transport_note = _transport_note(req.transport_method, req.netting_declined, netting_active)
    invoice_number = _invoice_number()

    # ── 6. Create order ────────────────────────────────────────────────────
    order_res = db.table("orders").insert({
        "nursery_id":       req.nursery_id,
        "customer_id":      customer_id,
        "transport_method": req.transport_method,
        "transport_note":   transport_note,
        "netting_declined": req.netting_declined,
        "subtotal":         subtotal,
        "tax_amount":       tax_amount,
        "total_amount":     total,
        "addons_amount":    addons_amount,
        "leakage_flag":     leakage_flag,
        "notes":            invoice_number,
        "status":           "pending",
    }).execute()

    if not order_res.data:
        raise HTTPException(status_code=500, detail="Order creation failed")
    order_id = order_res.data[0]["id"]

    # ── 7. Order items ─────────────────────────────────────────────────────
    db.table("order_items").insert({
        "order_id":  order_id,
        "plant_id":  req.plant_id,
        "quantity":  req.quantity,
        "unit_price": float(plant["base_price"]),
        "subtotal":  plant_subtotal,
    }).execute()

    # ── 8. Order addons ────────────────────────────────────────────────────
    if netting_active and netting_addon:
        db.table("order_addons").insert({
            "order_id":  order_id,
            "addon_id":  netting_addon["id"],
            "quantity":  req.quantity,
            "unit_price": netting_price,
            "subtotal":  netting_total,
        }).execute()

    for addon in always_addons:
        db.table("order_addons").insert({
            "order_id":  order_id,
            "addon_id":  addon["id"],
            "quantity":  req.quantity,
            "unit_price": addon["price_per_plant"],
            "subtotal":  addon["price_per_plant"] * req.quantity,
        }).execute()

    # ── 9. Reserve plant ───────────────────────────────────────────────────
    db.table("plants").update({
        "status":     "reserved",
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }).eq("id", req.plant_id).execute()

    return OrderResponse(
        order_id=order_id,
        invoice_number=invoice_number,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
        customer_email=req.customer.email,
        transport_note=transport_note,
        qb_invoice_url="https://pay.cultivar-os.app",  # wired in Session 5
    )
