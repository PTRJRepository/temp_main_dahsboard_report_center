import React, { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from "recharts";
import { C, ReportHero, ReportBody, CARD, StatCard } from "../components/report/reportTheme";
import { useAuth } from "../context/AuthContext";
import { fetchDowntimeKpi, fetchDowntimeEvents } from "../services/downtimeService";

export default function DowntimeAnalyticsPage() {
  const { token } = useAuth();
  const [kpi, setKpi] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr("");
      try {
        const [rk, re] = await Promise.all([fetchDowntimeKpi(token, {}), fetchDowntimeEvents(token, {})]);
        if (!alive) return;
        setKpi(rk?.data || rk);
        setEvents(re?.data || re || []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || e.message || "Failed to load KPI");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const trendData = kpi?.downtime_trend || [];
  const byComponent = kpi?.by_component ? Object.entries(kpi.by_component).map(([name, hours]) => ({ name, hours })) : [];
  const byCategory = kpi?.by_category ? Object.entries(kpi.by_category).map(([name, hours]) => ({ name: name.replaceAll("_", " "), hours })) : [];

  return (
    <>
      <ReportHero title="Downtime Analytics" subtitle="KPI, trend, pareto failure, heatmap placeholder, MTTR/MTBF, repeat failure, bottleneck stage." period={null} />
      <ReportBody>
        {err && <div style={{ ...CARD, borderColor: "#fecaca", background: "#fef2f2", color: C.potongan, marginBottom: 14 }}>{err}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 12, marginBottom: 14 }}>
          <StatCard label="Total Downtime" value={kpi ? `${kpi.total_downtime_hours}h` : loading ? "…" : "—"} color={C.costTon} />
          <StatCard label="Availability %" value={kpi ? `${kpi.availability_pct}%` : "—"} color={C.upah} />
          <StatCard label="MTTR" value={kpi ? `${kpi.mttr}h` : "—"} color={C.lembur} />
          <StatCard label="MTBF" value={kpi ? `${kpi.mtbf}h` : "—"} color={C.premi} />
          <StatCard label="Waiting Parts Ratio" value={kpi ? `${kpi.waiting_parts_ratio}%` : "—"} color="#a855f7" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr", gap: 14, marginBottom: 14 }}>
          <div style={{ ...CARD }}>
            <div style={{ fontWeight: 800, marginBottom: 8, fontFamily: "var(--font-display)" }}>Downtime Trend (7 days)</div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: C.muted }} axisLine={{ stroke: C.border }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip />
                  <Line type="monotone" dataKey="hours" stroke={C.costTon} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ ...CARD }}>
            <div style={{ fontWeight: 800, marginBottom: 8, fontFamily: "var(--font-display)" }}>By Category</div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} interval={0} angle={-12} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip />
                  <Bar dataKey="hours" fill={C.leafMid} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div style={{ ...CARD, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8, fontFamily: "var(--font-display)" }}>Top Components by Downtime</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byComponent} layout="vertical" margin={{ left: 24, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} />
                <XAxis type="number" tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: C.text2 }} axisLine={false} tickLine={false} width={120} />
                <Tooltip />
                <Bar dataKey="hours" fill={C.potongan} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: C.muted, background: C.warnBg, border: `1px solid #E5CFA3`, borderRadius: 8, padding: "8px 10px" }}>
            Repeat-flagged: {events.filter(e => e.repeat_flag).length} unit(s). Heatmap next phase.
          </div>
          {events.some(e => e.repeat_flag) && (
            <div style={{ marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "8px 10px", fontWeight: 800, fontSize: 12, background: C.surface2, borderBottom: `1px solid ${C.border}` }}>Repeat Failure (same asset/component)</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr style={{ background: C.surface2, textAlign: "left" }}><th style={{ padding: "6px 8px" }}>Asset</th><th style={{ padding: "6px 8px" }}>Component</th><th style={{ padding: "6px 8px" }}>Cause</th><th style={{ padding: "6px 8px" }}>Hours</th></tr></thead>
                  <tbody>
                    {events.filter(e => e.repeat_flag).map(e => (
                      <tr key={e.id} style={{ borderTop: `1px solid ${C.gridLine}` }}>
                        <td style={{ padding: "6px 8px" }}>{e.asset_name || e.asset_id}</td>
                        <td style={{ padding: "6px 8px" }}>{e.component || "-"}</td>
                        <td style={{ padding: "6px 8px" }}>{e.cause_category || "-"}</td>
                        <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)" }}>{e.total_downtime_hours?.toFixed?.(1) ?? e.total_downtime_hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </ReportBody>
    </>
  );
}
