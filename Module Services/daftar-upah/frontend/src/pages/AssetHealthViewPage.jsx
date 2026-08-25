import React, { useEffect, useState } from "react";
import { C, ReportHero, ReportBody, CARD } from "../components/report/reportTheme";
import { useAuth } from "../context/AuthContext";
import { fetchAssetHealth, fetchAssetHealthList } from "../services/downtimeService";
import VehicleSchematic from "../components/asset/VehicleSchematic";

const STATUS_COLOR = {
  Healthy: "#16a34a",
  Monitor: "#f59e0b",
  Worn: "#f59e0b",
  Faulty: "#dc2626",
  Critical: "#dc2626",
  "Under Repair": "#2563eb",
  Replaced: "#0d9488",
  "Not Inspected": "#94a3b8",
};

function scoreColor(score) {
  if (score >= 85) return "#16a34a";
  if (score >= 65) return "#f59e0b";
  return "#dc2626";
}

export default function AssetHealthViewPage() {
  const { token } = useAuth();
  const [assets, setAssets] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr("");
      try {
        const res = await fetchAssetHealthList(token, {});
        if (!alive) return;
        const list = res?.data || res || [];
        setAssets(list);
        if (list[0]?.id) setSelectedId(list[0].id);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || e.message || "Failed to load assets");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetchAssetHealth(token, selectedId);
        if (!alive) return;
        setDetail(res?.data || res);
        setComp(null);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || e.message || "Failed to load asset");
      }
    })();
    return () => { alive = false; };
  }, [token, selectedId]);

  return (
    <>
      <ReportHero title="Asset Health View" subtitle="Visual rangka kendaraan — hotspot komponen warna hijau/kuning/merah/biru/abu. Klik komponen untuk detail." period={null} />
      <ReportBody>
        {err && <div style={{ ...CARD, borderColor: "#fecaca", background: "#fef2f2", color: C.potongan, marginBottom: 14 }}>{err}</div>}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>Asset</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, minWidth: 220 }}>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.name} · {a.id} · {a.category}</option>
            ))}
          </select>
          {detail && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ background: scoreColor(detail.health_score), color: "#fff", borderRadius: 999, padding: "3px 10px", fontWeight: 800, fontSize: 12 }}>Health {detail.health_score}</span>
              <span style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 999, padding: "3px 10px", fontWeight: 700, fontSize: 12, color: C.text }}>{detail.overall_status}</span>
            </span>
          )}
        </div>

        {loading && <div style={{ ...CARD, color: C.muted }}>Loading…</div>}

        {detail && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1.45fr 0.85fr", gap: 14, alignItems: "start" }}>
              <div style={{ ...CARD, padding: 12 }}>
                <VehicleSchematic category={detail.category} components={detail.components} selectedId={comp?.id} onSelect={setComp} height={360} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 8, marginTop: 12 }}>
                  <Info label="Asset" value={`${detail.name} · ${detail.id}`} />
                  <Info label="Category" value={detail.category?.replaceAll("_", " ")} />
                  <Info label="Location" value={detail.location || "-"} />
                  <Info label="Meter" value={detail.meter != null ? `${Number(detail.meter).toLocaleString("id-ID")}` : "-"} />
                  <Info label="Current WO" value={detail.current_wo || "-"} mono />
                  <Info label="Technician" value={detail.technician || "-"} />
                  <Info label="Last Failure" value={detail.last_failure ? new Date(detail.last_failure).toLocaleDateString("id-ID") : "-"} />
                  <Info label="Next PM" value={detail.next_pm ? new Date(detail.next_pm).toLocaleDateString("id-ID") : "-"} />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ ...CARD }}>
                  <div style={{ fontWeight: 800, marginBottom: 8, fontFamily: "var(--font-display)" }}>Component Detail</div>
                  {!comp && <div style={{ color: C.muted, fontSize: 13 }}>Klik hotspot di schematic untuk lihat detail komponen.</div>}
                  {comp && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, color: C.text }}>{comp.name}</span>
                        <span style={{ background: STATUS_COLOR[comp.status] || C.muted, color: "#fff", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>{comp.status}</span>
                        <span style={{ fontSize: 11, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 999, padding: "2px 8px" }}>{comp.system}</span>
                      </div>
                      <KV k="Current issue" v={comp.current_issue || "—"} />
                      <KV k="Severity" v={comp.severity || "—"} />
                      <KV k="Recommended" v={comp.recommended_action || "—"} />
                      <KV k="Last inspection" v={comp.last_inspection ? new Date(comp.last_inspection).toLocaleDateString("id-ID") : "—"} />
                      <KV k="Last failure" v={comp.last_failure ? new Date(comp.last_failure).toLocaleDateString("id-ID") : "—"} />
                      <KV k="Linked WO" v={comp.linked_wo || "—"} />
                      <KV k="Linked part" v={comp.linked_part || "—"} />
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        <select id="health-status" defaultValue={comp.status} style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }}>
                          <option>Healthy</option><option>Monitor</option><option>Worn</option><option>Faulty</option><option>Critical</option><option>Under Repair</option><option>Replaced</option><option>Not Inspected</option>
                        </select>
                        <button onClick={async () => {
                          const sel = document.getElementById("health-status");
                          const nextStatus = sel ? sel.value : comp.status;
                          try {
                            const axios = (await import("axios")).default;
                            const headers = token ? { Authorization: `Bearer ${token}` } : {};
                            await axios.patch(`asset-health/assets/${encodeURIComponent(detail.id)}/components/${encodeURIComponent(comp.id)}`, { status: nextStatus }, { headers });
                            const res = await fetchAssetHealth(token, detail.id);
                            setDetail(res?.data || res);
                            setComp((res?.data || res)?.components?.find(c => c.id === comp.id) || null);
                          } catch (e) { setErr(e?.response?.data?.error || e.message); }
                        }} style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: C.upah, color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Save Status</button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ ...CARD }}>
                  <div style={{ fontWeight: 800, marginBottom: 8, fontFamily: "var(--font-display)" }}>Component Condition Matrix</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                    {detail.components.map((c) => (
                      <button key={c.id} onClick={() => setComp(c)} style={{ textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 10px", borderRadius: 8, border: comp?.id === c.id ? `1.5px solid ${STATUS_COLOR[c.status]}` : `1px solid ${C.border}`, background: comp?.id === c.id ? `${STATUS_COLOR[c.status]}10` : C.surface, cursor: "pointer" }}>
                        <span style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{c.name}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: STATUS_COLOR[c.status] }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[c.status] }} /> {c.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </ReportBody>
    </>
  );
}

function Info({ label, value, mono }) {
  return (
    <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: mono ? "var(--font-mono)" : "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}
function KV({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, borderBottom: `1px dashed ${C.gridLine}`, padding: "6px 0" }}>
      <span style={{ color: C.muted, fontWeight: 600 }}>{k}</span>
      <span style={{ color: C.text, fontWeight: 700, textAlign: "right" }}>{v}</span>
    </div>
  );
}
