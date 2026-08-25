import React from "react";
import { C } from "../report/reportTheme";

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

export default function VehicleSchematic({ category = "dump_truck", components = [], onSelect, selectedId, height = 320 }) {
  return (
    <div style={{ position: "relative", width: "100%", height, background: "#0f1a14", borderRadius: 12, border: "1px solid #1e3a2a", overflow: "hidden" }}>
      {/* subtle grid */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage: "linear-gradient(#5E9C7B 1px, transparent 1px), linear-gradient(90deg, #5E9C7B 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
      {/* chassis outline — minimal “industrial” shape per category */}
      <svg viewBox="0 0 100 80" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="none">
        <rect x="8" y="18" rx="3" ry="3" width="84" height="46" fill="none" stroke="rgba(94,156,123,0.35)" strokeWidth="0.7" strokeDasharray="2 2" />
        {/* ground line */}
        <line x1="4" y1="76" x2="96" y2="76" stroke="rgba(94,156,123,0.25)" strokeWidth="0.6" />
      </svg>

      {components.map((comp) => {
        const pos = comp.pos || { x: 50, y: 50, w: 12, h: 8 };
        const color = STATUS_COLOR[comp.status] || "#94a3b8";
        const active = selectedId === comp.id;
        const pulse = comp.status === "Faulty" || comp.status === "Critical";
        return (
          <button
            key={comp.id}
            onClick={() => onSelect && onSelect(comp)}
            title={`${comp.name} — ${comp.status}`}
            style={{
              position: "absolute",
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: `${pos.w || 12}%`,
              height: `${pos.h || 8}%`,
              transform: "translate(-50%, -50%)",
              background: active ? color : `${color}22`,
              border: `1.6px solid ${color}`,
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2px 4px",
              boxShadow: active ? `0 0 0 2px ${color}55, 0 0 14px ${color}88` : pulse ? `0 0 10px ${color}66` : "0 1px 4px rgba(0,0,0,0.35)",
              transition: "all 0.15s",
              animation: pulse ? "vhPulse 1.6s ease-in-out infinite" : "none",
            }}
          >
            <span style={{ fontSize: 8, fontWeight: 800, color: active ? "#fff" : color, lineHeight: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              {comp.name}
            </span>
            <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: "50%", background: color, border: "1.5px solid #0f1a14", boxShadow: pulse ? `0 0 6px ${color}` : "none" }} />
          </button>
        );
      })}
      <style>{`@keyframes vhPulse{0%,100%{opacity:1}50%{opacity:0.78}}`}</style>
      <div style={{ position: "absolute", left: 10, bottom: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          ["Healthy", "#16a34a"],
          ["Monitor/Worn", "#f59e0b"],
          ["Faulty/Critical", "#dc2626"],
          ["Under Repair", "#2563eb"],
          ["Not Inspected", "#94a3b8"],
        ].map(([label, col]) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: "#cbd5ce", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: "2px 7px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: col, display: "inline-block" }} /> {label}
          </span>
        ))}
      </div>
      <div style={{ position: "absolute", right: 10, top: 10, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(226,240,231,0.7)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 7px" }}>
        {category.replaceAll("_", " ")}
      </div>
    </div>
  );
}
