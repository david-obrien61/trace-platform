import React, { useState } from "react";

// Delivery vs. drive — total cost of acquisition, not just price.
// Two columns so you can SEE how much the verdict leans on the time assumption.
// LEFT = hard money only (CONFIRMED). RIGHT = money + your time (one labeled assumption).
// The verdict can FLIP between them — that's the honesty, and the teaching moment.

const C = {
  ink: "#1B1A18", paper: "#F7F4EE", line: "#E5DED1", mute: "#857C6C",
  drive: "#3E5C76", deliver: "#B6441F", green: "#3E7C5A", warn: "#9A7B22",
};

export default function DeliveryVsDrive() {
  const [hourly, setHourly] = useState(20);     // your time value, $/hr (a labeled assumption)
  const [minutes, setMinutes] = useState(90);   // round-trip + shopping time
  const [miles, setMiles] = useState(24);       // round trip
  const [atStore, setAtStore] = useState(false); // context override

  // Hard, CONFIRMED money:
  const basket = 142.11;            // from a real receipt
  const inStoreDiscount = 0.10;     // in-store is 10% cheaper on this basket
  const deliveryFee = 9.95;         // delivery service fee + markup
  const perMile = 0.21;             // IRS-ish running cost / mile (DERIVED)

  // DRIVE path (in-store): cheaper goods, but you pay mileage (and time, on the right).
  const driveGoods = basket * (1 - inStoreDiscount);
  const driveMiles = atStore ? 0 : miles * perMile;
  const driveMoney = driveGoods + driveMiles;

  // DELIVER path: full price + fee, no mileage, no time.
  const deliverMoney = basket + deliveryFee;

  // Money-only verdict:
  const moneyWinner = driveMoney <= deliverMoney ? "drive" : "deliver";
  const moneyGap = Math.abs(driveMoney - deliverMoney);

  // Add time (only the drive path costs your time; delivery frees it):
  const timeCost = atStore ? 0 : (minutes / 60) * hourly;
  const driveTotal = driveMoney + timeCost;
  const timeWinner = driveTotal <= deliverMoney ? "drive" : "deliver";
  const timeGap = Math.abs(driveTotal - deliverMoney);

  const flips = moneyWinner !== timeWinner;
  const money = (n) => `$${n.toFixed(2)}`;

  return (
    <div style={S.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,500;0,600;1,500;1,600&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .dd-range { width: 100%; accent-color: ${C.deliver}; }
      `}</style>

      <header style={S.head}>
        <div style={S.eyebrow}>Acquisition intelligence · the call no app makes for you</div>
        <h1 style={S.h1}>Drive, or have it delivered?</h1>
        <p style={S.sub}>In-store is cheaper on the goods. Delivery costs a fee. But the real answer counts your gas and your time — and it can flip. Here’s the work, shown.</p>
      </header>

      {/* The verdict banner */}
      <div style={{ ...S.verdict, borderColor: flips ? C.warn : (timeWinner === "deliver" ? C.deliver : C.drive) }}>
        {flips ? (
          <>
            <div style={S.vTop}>It flips.</div>
            <div style={S.vBody}>
              On <strong>money alone</strong>, {moneyWinner === "drive" ? "driving" : "delivery"} wins by {money(moneyGap)}.
              Count your time and <strong>{timeWinner === "drive" ? "driving" : "delivery"}</strong> wins by {money(timeGap)}.
              The honest answer depends on what your {minutes} minutes are worth to you.
            </div>
          </>
        ) : (
          <>
            <div style={S.vTop}>{timeWinner === "deliver" ? "Have it delivered." : "Drive this time."}</div>
            <div style={S.vBody}>
              {timeWinner === "deliver" ? "Delivery" : "Driving"} wins whether or not you count your time
              — by {money(moneyGap)} on money alone, {money(timeGap)} with time.
            </div>
          </>
        )}
      </div>

      {/* Two columns */}
      <div style={S.cols}>
        <Col
          title="Money only"
          subtitle="Hard numbers. From your receipt."
          confirmed
          rows={[
            ["Goods — in-store (−10%)", money(driveGoods), C.drive],
            [atStore ? "Mileage (you're already there)" : `Mileage · ${miles} mi`, money(driveMiles), C.drive],
            ["Goods — delivered (full)", money(basket), C.deliver],
            ["Delivery fee", money(deliveryFee), C.deliver],
          ]}
          driveTotal={driveMoney}
          deliverTotal={deliverMoney}
          winner={moneyWinner}
          money={money}
        />
        <Col
          title="Money + your time"
          subtitle={atStore ? "You're at the store — no time added." : `Adds ${minutes} min at $${hourly}/hr`}
          assumption
          rows={[
            ["Goods + mileage (drive)", money(driveMoney), C.drive],
            [atStore ? "Your time (none — you're there)" : "Your time", money(timeCost), C.drive],
            ["Goods + fee (deliver)", money(deliverMoney), C.deliver],
            ["Your time (delivery frees it)", money(0), C.deliver],
          ]}
          driveTotal={driveTotal}
          deliverTotal={deliverMoney}
          winner={timeWinner}
          money={money}
        />
      </div>

      {/* The assumptions you control */}
      <div style={S.controls}>
        <div style={S.ctrlHead}>The assumptions — change any, watch the verdict move</div>

        <label style={S.ctrlRow}>
          <span style={S.ctrlLbl}>Your time is worth</span>
          <span style={S.ctrlVal}>${hourly}/hr</span>
        </label>
        <input className="dd-range" type="range" min="0" max="60" step="5" value={hourly} onChange={(e) => setHourly(Number(e.target.value))} />

        <label style={S.ctrlRow}>
          <span style={S.ctrlLbl}>Trip takes</span>
          <span style={S.ctrlVal}>{minutes} min</span>
        </label>
        <input className="dd-range" type="range" min="20" max="150" step="10" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />

        <label style={S.ctrlRow}>
          <span style={S.ctrlLbl}>Round trip</span>
          <span style={S.ctrlVal}>{miles} mi</span>
        </label>
        <input className="dd-range" type="range" min="0" max="60" step="2" value={miles} onChange={(e) => setMiles(Number(e.target.value))} />

        <button
          onClick={() => setAtStore(!atStore)}
          style={{ ...S.toggle, ...(atStore ? S.toggleOn : {}) }}>
          {atStore ? "✓ You're already at the store (drive cost = 0)" : "I'm already near the store"}
        </button>
        <div style={S.ctrlNote}>
          Prices and the delivery fee are <strong>CONFIRMED</strong> (your receipt, the app screen). Mileage cost is
          <strong> DERIVED</strong> (distance × per-mile). Your time is an <strong>assumption you set</strong> — that’s
          why it lives on the right, labeled, never baked silently into one number.
        </div>
      </div>
    </div>
  );
}

function Col({ title, subtitle, confirmed, assumption, rows, driveTotal, deliverTotal, winner, money }) {
  return (
    <div style={S.col}>
      <div style={S.colHead}>
        <span style={S.colTitle}>{title}</span>
        <span style={{ ...S.colBadge, background: confirmed ? "#E4EEE8" : "#F6EFD9", color: confirmed ? C.green : C.warn }}>
          {confirmed ? "CONFIRMED" : "+ ASSUMPTION"}
        </span>
      </div>
      <div style={S.colSub}>{subtitle}</div>
      <div style={S.colRows}>
        {rows.map((r, i) => (
          <div key={i} style={S.row}>
            <span style={{ ...S.rowDot, background: r[2] }} />
            <span style={S.rowLbl}>{r[0]}</span>
            <span style={S.rowVal}>{r[1]}</span>
          </div>
        ))}
      </div>
      <div style={S.totals}>
        <div style={{ ...S.totRow, ...(winner === "drive" ? S.totWin : {}) }}>
          <span>Drive total</span><span>{money(driveTotal)}{winner === "drive" ? "  ✓" : ""}</span>
        </div>
        <div style={{ ...S.totRow, ...(winner === "deliver" ? S.totWin : {}) }}>
          <span>Deliver total</span><span>{money(deliverTotal)}{winner === "deliver" ? "  ✓" : ""}</span>
        </div>
      </div>
    </div>
  );
}

const S = {
  wrap: { background: C.paper, color: C.ink, fontFamily: "Inter, sans-serif", minHeight: "100vh", padding: "26px 16px 40px", maxWidth: 760, margin: "0 auto" },
  head: { textAlign: "center", marginBottom: 18 },
  eyebrow: { fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: C.mute, marginBottom: 9 },
  h1: { fontFamily: "Spectral, serif", fontSize: 32, fontWeight: 600, fontStyle: "italic", margin: "0 0 9px", lineHeight: 1.12 },
  sub: { fontSize: 13.5, color: C.mute, maxWidth: 520, margin: "0 auto", lineHeight: 1.55 },

  verdict: { border: "2px solid", borderRadius: 14, padding: "14px 16px", margin: "0 0 16px", background: "#fff" },
  vTop: { fontFamily: "Spectral, serif", fontSize: 20, fontWeight: 600, fontStyle: "italic", marginBottom: 5 },
  vBody: { fontSize: 13.5, lineHeight: 1.5, color: "#3A352D" },

  cols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 },
  col: { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 },
  colHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 },
  colTitle: { fontSize: 14, fontWeight: 600 },
  colBadge: { fontSize: 8.5, fontWeight: 700, padding: "2px 6px", borderRadius: 5, letterSpacing: "0.04em" },
  colSub: { fontSize: 11, color: C.mute, marginTop: 3, marginBottom: 11, minHeight: 28, lineHeight: 1.4 },
  colRows: { display: "flex", flexDirection: "column", gap: 7 },
  row: { display: "flex", alignItems: "center", gap: 7 },
  rowDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  rowLbl: { fontSize: 11.5, color: "#4A4238", flex: 1, lineHeight: 1.3 },
  rowVal: { fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  totals: { marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 4 },
  totRow: { display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.mute, padding: "3px 6px", borderRadius: 6 },
  totWin: { background: "#F1F6F2", color: C.ink, fontWeight: 700 },

  controls: { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 16 },
  ctrlHead: { fontSize: 12.5, fontWeight: 600, marginBottom: 12 },
  ctrlRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, marginTop: 8 },
  ctrlLbl: { fontSize: 12.5, color: "#4A4238" },
  ctrlVal: { fontSize: 13, fontWeight: 700, color: C.deliver, fontVariantNumeric: "tabular-nums" },
  toggle: { width: "100%", marginTop: 14, border: `1.5px solid ${C.line}`, background: "#fff", borderRadius: 9, padding: "10px", fontSize: 12.5, fontWeight: 500, color: C.ink, cursor: "pointer" },
  toggleOn: { borderColor: C.green, background: "#F1F6F2", color: C.green, fontWeight: 600 },
  ctrlNote: { fontSize: 11, color: C.mute, marginTop: 12, lineHeight: 1.5 },
};
