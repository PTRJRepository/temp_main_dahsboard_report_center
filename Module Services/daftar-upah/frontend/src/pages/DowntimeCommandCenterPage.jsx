import React, { useEffect, useState } from "react";
import { C, ReportHero, ReportBody, CARD, StatCard } from "../components/report/reportTheme";
import { useAuth } from "../context/AuthContext";
import { fetchDowntimeBoard, fetchDowntimeKpi, fetchDowntimeTimeline } from "../services/downtimeService";

const STAGE_META = {
  diagnosis: { label: "Diagnosis", color: "#64748b" },
  planning: { label: "Planning", color: "#0ea5e9" },
  waiting_mechanic: { label: "Waiting Mechanic", color: "#f59e0b" },
  waiting_parts: { label: "Waiting Parts", color: "#f59e0b" },
  waiting_supplier: { label: "Waiting Supplier", color: "#a855f7" },
  repair: { label: "Repair", color: "#2563eb" },
  qc: { label: "QC / Testing", color: "#0d9488" },
  release: { label: "Release", color: "#16a34a" },
};

function hoursLabel(h) {
  if (h == null) return "-";
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

export default function DowntimeCommandCenterPage() {
  const { token } = useAuth();
  const [board, setBoard] = useState([]);
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ asset_id: "", asset_name: "", category: "dump_truck", component: "", workshop: "", severity: "high" });
  const [timeline, setTimeline] = useState({ id: "", rows: [], loading: false });

  async function reload() {
    setLoading(true);
    setErr("");
    try {
      const [b, k] = await Promise.all([fetchDowntimeBoard(token), fetchDowntimeKpi(token, {})]);
      setBoard(b?.data || b || []);
      setKpi(k?.data || k);
    } catch (e) { setErr(e?.response?.data?.error || e.message || "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { let alive = true; (async () => { await reload(); })(); return () => { alive = false; }; }, [token]);

  return (
    <>
      <ReportHero title="Downtime Command Center" subtitle="Unit down sekarang — stage, blocker, ETA, technician, waiting parts/supplier." period={null} />
      <ReportBody>
        {err && <div style={{ ...CARD, borderColor: "#fecaca", background: "#fef2f2", color: C.potongan, marginBottom: 14 }}>{err}</div>}
        <div style={{ ...CARD, marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ flex: "1 1 160px" }}><div style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Asset ID*</div><input value={form.asset_id} onChange={e => setForm({ ...form, asset_id: e.target.value })} placeholder="DT-07" style={{ width: "100%", padding: "7px 8px", borderRadius: 8, border: `1px solid ${C.border}` }} /></div>
          <div style={{ flex: "1 1 160px" }}><div style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Asset Name</div><input value={form.asset_name} onChange={e => setForm({ ...form, asset_name: e.target.value })} placeholder="Dump Truck 07" style={{ width: "100%", padding: "7px 8px", borderRadius: 8, border: `1px solid ${C.border}` }} /></div>
          <div><div style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Category</div><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ padding: "7px 8px", borderRadius: 8, border: `1px solid ${C.border}` }}><option value="dump_truck">dump_truck</option><option value="excavator">excavator</option><option value="tractor">tractor</option><option value="loader">loader</option><option value="harvester">harvester</option></select></div>
          <div style={{ flex: "1 1 140px" }}><div style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Component</div><input value={form.component} onChange={e => setForm({ ...form, component: e.target.value })} placeholder="Brake System" style={{ width: "100%", padding: "7px 8px", borderRadius: 8, border: `1px solid ${C.border}` }} /></div>
          <div><div style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Workshop</div><input value={form.workshop} onChange={e => setForm({ ...form, workshop: e.target.value })} placeholder="Workshop A" style={{ width: 120, padding: "7px 8px", borderRadius: 8, border: `1px solid ${C.border}` }} /></div>
          <button disabled={creating || !form.asset_id.trim()} onClick={async () => {
            setCreating(true);
            try {
              const axios = (await import("axios")).default;
              const headers = token ? { Authorization: `Bearer ${token}` } : {};
              await axios.post("downtime/events", { asset_id: form.asset_id.trim(), asset_name: form.asset_name.trim() || undefined, category: form.category, component: form.component.trim() || undefined, workshop: form.workshop.trim() || undefined, severity: form.severity }, { headers });
              setForm({ asset_id: "", asset_name: "", category: "dump_truck", component: "", workshop: "", severity: "high" });
              await reload();
            } catch (e) { setErr(e?.response?.data?.error || e.message); } finally { setCreating(false); }
          }} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: C.upah, color: "#fff", fontWeight: 800, cursor: creating ? "wait" : "pointer", opacity: !form.asset_id.trim() ? 0.5 : 1 }}>+ Create Downtime</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
          <StatCard label="Current Down" value={kpi ? String(kpi.current_down ?? board.length) : loading ? "…" : "0"} color={C.potongan} />
          <StatCard label="Total Downtime (h)" value={kpi ? `${kpi.total_downtime_hours}h` : "—"} color={C.costTon} />
          <StatCard label="Unplanned (h)" value={kpi ? `${kpi.unplanned_hours}h` : "—"} color={C.potongan} />
          <StatCard label="MTTR" value={kpi ? `${kpi.mttr}h` : "—"} color={C.lembur} />
          <StatCard label="Availability %" value={kpi ? `${kpi.availability_pct}%` : "—"} color={C.upah} />
          <StatCard label="Waiting Parts Ratio" value={kpi ? `${kpi.waiting_parts_ratio}%` : "—"} color="#a855f7" />
        </div>

        <div style={{ ...CARD, padding: 0, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 800, color: C.text, fontFamily: "var(--font-display)" }}>Current Down Board</div>
            <div style={{ fontSize: 12, color: C.muted }}>{loading ? "Loading…" : `${board.length} units`}</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.surface2, textAlign: "left" }}>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Asset</th>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>Category</th>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>Stage</th>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>Component</th>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>Blocking</th>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>WO</th>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "right" }}>Downtime</th>
                  <th style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && board.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 18, textAlign: "center", color: C.muted }}>No active downtime — all units operational (mock will show once service wired).</td></tr>
                )}
                {board.map((r) => {
                  const st = STAGE_META[r.current_stage] || { label: r.current_stage, color: C.muted };
                  return (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${C.gridLine}` }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>{r.asset_name || r.asset_id} <span style={{ color: C.muted, fontWeight: 500 }}>· {r.asset_id}</span></td>
                      <td style={{ padding: "10px 12px", color: C.text2 }}>{r.category?.replaceAll("_", " ")}</td>
                      <td style={{ padding: "10px 12px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${st.color}14`, border: `1px solid ${st.color}35`, color: st.color, borderRadius: 999, padding: "3px 8px", fontWeight: 700, fontSize: 12 }}>{st.label}</span></td>
                      <td style={{ padding: "10px 12px" }}>{r.component || "-"}</td>
                      <td style={{ padding: "10px 12px", color: r.blocking_reason ? C.potongan : C.muted }}>{r.blocking_reason || "—"}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.linked_wo || "-"}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{hoursLabel(r.total_downtime_hours)}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <select defaultValue="" onChange={async (e) => {
                            const next = e.target.value; if (!next) return;
                            e.target.disabled = true;
                            try {
                              const axios = (await import("axios")).default;
                              const headers = token ? { Authorization: `Bearer ${token}` } : {};
                              await axios.post(`downtime/events/${encodeURIComponent(r.id)}/advance`, { next_stage: next }, { headers });
                              await reload();
                            } catch (err2) { setErr(err2?.response?.data?.error || err2.message); e.target.disabled = false; }
                          }} style={{ padding: "4px 6px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12 }}>
                            <option value="">Advance…</option>
                            <option value="diagnosis">diagnosis</option>
                            <option value="planning">planning</option>
                            <option value="waiting_mechanic">waiting_mechanic</option>
                            <option value="waiting_parts">waiting_parts</option>
                            <option value="waiting_supplier">waiting_supplier</option>
                            <option value="repair">repair</option>
                            <option value="qc">qc</option>
                            <option value="release">release</option>
                          </select>
                          <button onClick={async () => {
                            setTimeline({ id: r.id, rows: [], loading: true });
                            try {
                              const res = await fetchDowntimeTimeline(token, r.id);
                              setTimeline({ id: r.id, rows: res?.data || [], loading: false });
                            } catch (e2) { setTimeline({ id: r.id, rows: [], loading: false }); setErr(e2?.response?.data?.error || e2.message); }
                          }} style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface2, fontSize: 12, cursor: "pointer" }}>Timeline</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {timeline.id && (
          <div style={{ ...CARD, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontFamily: "var(--font-display)" }}>Stage Timeline — {timeline.id}</div>
              <button onClick={() => setTimeline({ id: "", rows: [], loading: false })} style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, cursor: "pointer" }}>Close</button>
            </div>
            {timeline.loading && <div style={{ color: C.muted, fontSize: 13 }}>Loading timeline…</div>}
            {!timeline.loading && timeline.rows.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No stage history yet (visible after DB migration + transitions).</div>}
            {!timeline.loading && timeline.rows.length > 0 && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
                {timeline.rows.map((h, i) => (
                  <div key={i} style={{ minWidth: 160, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", background: C.surface2 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>{new Date(h.changed_at).toLocaleString("id-ID")}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{h.from_stage || "—"} → {h.to_stage}</div>
                    {h.blocking_reason && <div style={{ fontSize: 11, color: C.potongan, marginTop: 4 }}>Block: {h.blocking_reason}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {kpi?.by_stage && (
          <div style={{ ...CARD }}>
            <div style={{ fontWeight: 800, marginBottom: 10, fontFamily: "var(--font-display)" }}>Downtime by Stage (hours) — bottleneck</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10 }}>
              {Object.entries(kpi.by_stage).map(([stage, hrs]) => {
                const m = STAGE_META[stage] || { label: stage, color: C.muted };
                const max = Math.max(1, ...Object.values(kpi.by_stage));
                const pct = Math.round((hrs / max) * 100);
                const isBottleneck = pct >= 80;
                return (
                  <div key={stage} style={{ border: `1px solid ${isBottleneck ? "#f5c518" : C.border}`, borderRadius: 10, padding: 10, background: isBottleneck ? "#fffbeb" : C.surface2 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.label}{isBottleneck ? " · bottleneck" : ""}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text, fontFamily: "var(--font-mono)" }}>{hrs.toFixed(1)}h</div>
                    <div style={{ height: 6, borderRadius: 999, background: "#e8e6db", overflow: "hidden", marginTop: 6 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: isBottleneck ? "#f59e0b" : m.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ReportBody>
    </>
  );
}
