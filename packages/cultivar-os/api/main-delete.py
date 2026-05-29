"""
Cultivar OS — FastAPI backend
Deployed on Railway. Vercel frontend calls this for order creation and QB invoice push.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.orders import orders_router
from routers.quickbooks import qbo_router

app = FastAPI(title="Cultivar OS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://cultivar-os.app", "https://cultivar-os.vercel.app", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orders_router)
app.include_router(qbo_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "cultivar-os-api"}
