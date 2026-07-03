import React, { useState } from "react";

// Two kinds of "smart," same household need, side by side.
// LEFT  = smart-as-capable: the great database. You do the work; it stores it.
// RIGHT = smart-as-effortless: the quiet assistant. It already knows, and it goes and looks.

// Real places returned by a live "find organic meat near my ZIP" search (Liberty Hill, TX).
const FOUND = [
  { name: "Veteran's Liberty Ranch", where: "Liberty Hill · 4 mi", note: "Grass-fed beef, pork, chicken. Friday pickup or local markets.", rating: 5.0, ship: false, tag: "closest" },
  { name: "Bar 3 Ranch Grass Fed Beef", where: "Georgetown · 22 mi", note: "Grass-fed & finished. Pickup or ships to you.", rating: 4.3, ship: true, tag: null },
  { name: "Bastrop Cattle Company", where: "Bastrop · 38 mi", note: "All-natural Central TX beef. Ships statewide.", rating: 4.7, ship: true, tag: "ships" },
];

const C = {
  ink: "#1C1A17", paper: "#FAF7F1", line: "#E7E0D3", mute: "#8C8270",
  dbBlue: "#3E5C76", dbBg: "#EEF1F4",
  go: "#B6441F", goBg: "#FBF0EA", green: "#3E7C5A",
};

export default function SmartComparison() {
  const [step, setStep] = useState(0); // drives the "assistant" reveal
  const [zip, setZip] = useState("78642");

  return (
    <div style={S.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .sc-tap { cursor: pointer; transition: transform .12s, box-shadow .12s; }
        .sc-tap:active { transform: scale(.98); }
        @media (prefers-reduced-motion: no-preference) {
          .sc-reveal { animation: rise .4s ease both; }
        }
        @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <header style={S.head}>
        <div style={S.eyebrow}>Same need · two kinds of smart</div>
        <h1 style={S.h1}>“We’re low on meat.”</h1>
        <p style={S.sub}>One app stores what you tell it. The other already knows — and goes and looks for you. Same household, same moment. Feel the difference.</p>
      </header>

      <div style={S.cols}>
        {/* LEFT — the great database */}
        <div style={{ ...S.col, ...S.colDb }}>
          <div style={S.colTag}>
            <span style={{ ...S.dot, background: C.dbBlue }} />
            The great database
          </div>
          <p style={S.colDesc}>Capable. Thorough. Waiting for you to do the work.</p>

          <div style={S.dbScreen}>
            <div style={S.dbField}><span style={S.dbLbl}>Item</span><span style={S.dbVal}>Ground beef</span></div>
            <div style={S.dbField}><span style={S.dbLbl}>Category</span><span style={S.dbVal}>Meat › Beef › Ground</span></div>
            <div style={S.dbField}><span style={S.dbLbl}>Quantity on hand</span><span style={S.dbValMute}>— enter —</span></div>
            <div style={S.dbField}><span style={S.dbLbl}>Reorder level</span><span style={S.dbValMute}>— enter —</span></div>
            <div style={S.dbField}><span style={S.dbLbl}>Preferred store</span><span style={S.dbValMute}>— choose —</span></div>
            <div style={S.dbField}><span style={S.dbLbl}>Brand / source</span><span style={S.dbValMute}>— type —</span></div>
            <div style={S.dbField}><span style={S.dbLbl}>Price last paid</span><span style={S.dbValMute}>— enter —</span></div>
            <button className="sc-tap" style={S.dbBtn}>Save to pantry</button>
          </div>

          <div style={S.dbFoot}>
            <div style={S.footLine}>You fill the form. It remembers.</div>
            <div style={S.footLine}>Smart <em>after</em> you feed it — which is why the fridge magnet outlives the app.</div>
          </div>
        </div>

        {/* RIGHT — the quiet assistant */}
        <div style={{ ...S.col, ...S.colGo }}>
          <div style={S.colTag}>
            <span style={{ ...S.dot, background: C.go }} />
            The quiet assistant
          </div>
          <p style={S.colDesc}>Already knows. Surfaces one thing. Goes and looks.</p>

          <div style={S.goScreen}>
            {/* It already knows you're low — from your receipts, not your typing */}
            <div style={S.bubble}>
              <div style={S.bubbleKnow}>From your last receipts</div>
              <div style={S.bubbleText}>You’re down to your last bag of ground beef. You go through about one a week.</div>
            </div>

            {step === 0 && (
              <button className="sc-tap" style={S.goAsk} onClick={() => setStep(1)}>
                You like organic / grass-fed. Want me to look around you?
                <span style={S.goAskHint}>tap</span>
              </button>
            )}

            {step >= 1 && (
              <div className="sc-reveal" style={S.zipRow}>
                <span style={S.zipLbl}>Looking near</span>
                <input value={zip} onChange={(e) => setZip(e.target.value)} style={S.zipInput} />
                {step === 1 && <button className="sc-tap" style={S.zipGo} onClick={() => setStep(2)}>Look</button>}
                {step >= 2 && <span style={S.zipDone}>3 found</span>}
              </div>
            )}

            {step >= 2 && (
              <div className="sc-reveal" style={S.found}>
                {FOUND.map((f, i) => (
                  <div key={i} style={S.foundCard}>
                    <div style={S.foundTop}>
                      <span style={S.foundName}>{f.name}</span>
                      {f.tag && <span style={{ ...S.foundTag, background: f.tag === "closest" ? C.green : C.dbBlue }}>{f.tag}</span>}
                    </div>
                    <div style={S.foundWhere}>{f.where} · ★ {f.rating.toFixed(1)}{f.ship ? " · ships to you" : " · pickup"}</div>
                    <div style={S.foundNote}>{f.note}</div>
                  </div>
                ))}
                <div style={S.goResolve}>Add the closest to this week’s run, or have one shipped?</div>
              </div>
            )}
          </div>

          <div style={S.goFoot}>
            <div style={{ ...S.footLine, color: C.ink }}>You tapped twice. It did the rest.</div>
            <div style={S.footLine}>Smart <em>before</em> you ask — which is why you keep opening it.</div>
          </div>
        </div>
      </div>

      <footer style={S.foot}>
        <div style={S.footHead}>The bet</div>
        <p style={S.footBody}>
          The database race is already won by apps with more money and more time. You don’t win by storing more —
          you win by <strong>knowing</strong> more without being told (the receipts), carrying knowledge no database has
          (the chef in the house), and <strong>acting</strong> on it (going and looking near a ZIP). A great database
          doesn’t make it smart, and it doesn’t make it easy. Knowing and doing does.
        </p>
      </footer>
    </div>
  );
}

const S = {
  wrap: { background: C.paper, color: C.ink, fontFamily: "Inter, sans-serif", minHeight: "100vh", padding: "28px 18px 40px", maxWidth: 980, margin: "0 auto" },
  head: { textAlign: "center", marginBottom: 26 },
  eyebrow: { fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: C.mute, marginBottom: 10 },
  h1: { fontFamily: "Spectral, serif", fontSize: 38, fontWeight: 600, fontStyle: "italic", margin: "0 0 10px", lineHeight: 1.1 },
  sub: { fontSize: 14.5, color: C.mute, maxWidth: 560, margin: "0 auto", lineHeight: 1.55 },
  cols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  col: { borderRadius: 16, padding: 18, border: `1px solid ${C.line}`, display: "flex", flexDirection: "column" },
  colDb: { background: C.dbBg },
  colGo: { background: C.goBg },
  colTag: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  colDesc: { fontSize: 12.5, color: C.mute, margin: "6px 0 14px", lineHeight: 1.45, minHeight: 36 },

  dbScreen: { background: "#fff", borderRadius: 12, padding: 14, border: `1px solid ${C.line}`, flex: 1 },
  dbField: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.line}` },
  dbLbl: { fontSize: 12, color: C.mute },
  dbVal: { fontSize: 12.5, fontWeight: 600 },
  dbValMute: { fontSize: 12.5, color: "#C2B9A8", fontStyle: "italic" },
  dbBtn: { width: "100%", marginTop: 14, background: C.dbBlue, color: "#fff", border: "none", borderRadius: 9, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  dbFoot: { marginTop: 14 },

  goScreen: { background: "#fff", borderRadius: 12, padding: 14, border: `1px solid ${C.line}`, flex: 1, display: "flex", flexDirection: "column", gap: 10 },
  bubble: { background: C.goBg, borderRadius: 10, padding: "10px 12px" },
  bubbleKnow: { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.go, marginBottom: 4 },
  bubbleText: { fontSize: 13, lineHeight: 1.45 },
  goAsk: { textAlign: "left", background: "#fff", border: `1.5px solid ${C.go}`, borderRadius: 10, padding: "12px 13px", fontSize: 13, fontWeight: 500, color: C.ink, cursor: "pointer", position: "relative", lineHeight: 1.4 },
  goAskHint: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 10, fontWeight: 700, color: C.go, letterSpacing: "0.08em", textTransform: "uppercase" },
  zipRow: { display: "flex", alignItems: "center", gap: 8 },
  zipLbl: { fontSize: 12, color: C.mute },
  zipInput: { width: 78, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 9px", fontSize: 13, fontFamily: "Inter" },
  zipGo: { background: C.go, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  zipDone: { fontSize: 12, fontWeight: 600, color: C.green },
  found: { display: "flex", flexDirection: "column", gap: 8 },
  foundCard: { border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" },
  foundTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  foundName: { fontSize: 13, fontWeight: 600 },
  foundTag: { fontSize: 9, fontWeight: 700, color: "#fff", padding: "2px 7px", borderRadius: 5, letterSpacing: "0.04em", textTransform: "uppercase" },
  foundWhere: { fontSize: 11, color: C.mute, marginTop: 3 },
  foundNote: { fontSize: 12, color: C.ink, marginTop: 4, lineHeight: 1.4 },
  goResolve: { fontSize: 12.5, fontWeight: 500, color: C.go, marginTop: 4, fontStyle: "italic" },
  goFoot: { marginTop: 14 },

  footLine: { fontSize: 11.5, color: C.mute, lineHeight: 1.5 },
  foot: { marginTop: 24, borderTop: `2px solid ${C.ink}`, paddingTop: 16 },
  footHead: { fontFamily: "Spectral, serif", fontSize: 16, fontWeight: 600, fontStyle: "italic", marginBottom: 6 },
  footBody: { fontSize: 13.5, lineHeight: 1.6, color: "#3A352D", margin: 0 },
};
