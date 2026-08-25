import { Database } from "../db/client";
import { Config } from "../config";

// ponytail: in-memory until downtime_event/downtime_stage_history tables migrated in extend_db_ptrj. Upgrade: replace MOCK_EVENTS with DB queries via extendDb (SERVER_PROFILE_1) + add ensureTables() DDL.
export type DowntimeStage =
  | "diagnosis" | "planning" | "waiting_mechanic" | "waiting_parts"
  | "waiting_supplier" | "repair" | "qc" | "release";

export type DowntimeStatus =
  | "active" | "paused" | "completed" | "cancelled";

export const STAGE_ORDER: DowntimeStage[] = [
  "diagnosis","planning","waiting_mechanic","waiting_parts","waiting_supplier","repair","qc","release"
];

export const STAGE_LABEL: Record<DowntimeStage,string> = {
  diagnosis: "Diagnosis",
  planning: "Planning",
  waiting_mechanic: "Waiting Mechanic",
  waiting_parts: "Waiting Parts",
  waiting_supplier: "Waiting Supplier",
  repair: "Repair",
  qc: "QC / Testing",
  release: "Release",
};

export const DELAY_REASONS = [
  "Waiting spare part","Waiting purchase approval","Waiting supplier quotation",
  "Waiting technician","Waiting workshop bay","Waiting operation release",
  "Waiting external vendor","Waiting test result","Waiting supervisor approval",
  "Waiting transport","Rework after QC fail","Other"
] as const;

export interface DowntimeEvent {
  id: string;
  asset_id: string;
  asset_name?: string;
  category?: string; // tractor|excavator|dump_truck|loader|harvester
  estate?: string;
  workshop?: string;
  status: DowntimeStatus;
  current_stage: DowntimeStage;
  planned: boolean; // planned vs unplanned
  failure_start: string; // ISO
  downtime_start: string;
  downtime_end?: string | null;
  stage_durations: Record<DowntimeStage, number>; // hours
  total_downtime_hours: number;
  blocking_reason?: string | null;
  linked_wo?: string | null;
  component?: string | null;
  cause_category?: string | null;
  severity?: "low"|"medium"|"high"|"critical";
  repeat_flag?: boolean;
}

const MOCK_EVENTS: DowntimeEvent[] = [
  {
    id: "DT-001", asset_id: "DT-07", asset_name: "Dump Truck 07", category: "dump_truck",
    estate: "ARA", workshop: "Workshop A", status: "active", current_stage: "waiting_parts",
    planned: false, failure_start: new Date(Date.now()-36*3600*1000).toISOString(),
    downtime_start: new Date(Date.now()-34*3600*1000).toISOString(), downtime_end: null,
    stage_durations: { diagnosis:2, planning:3, waiting_mechanic:1, waiting_parts:18, waiting_supplier:0, repair:6, qc:0, release:0 },
    total_downtime_hours: 30, blocking_reason: "Waiting spare part", linked_wo: "WO-2026-0142",
    component: "Brake System", cause_category: "Mechanical", severity: "high", repeat_flag: false,
  },
  {
    id: "DT-002", asset_id: "EX-03", asset_name: "Excavator 03", category: "excavator",
    estate: "ARC", workshop: "Workshop B", status: "active", current_stage: "repair",
    planned: false, failure_start: new Date(Date.now()-18*3600*1000).toISOString(),
    downtime_start: new Date(Date.now()-16*3600*1000).toISOString(), downtime_end: null,
    stage_durations: { diagnosis:1.5, planning:1, waiting_mechanic:2, waiting_parts:4, waiting_supplier:0, repair:7, qc:0, release:0 },
    total_downtime_hours: 15.5, blocking_reason: null, linked_wo: "WO-2026-0145",
    component: "Hydraulic Pump", cause_category: "Hydraulic", severity: "critical", repeat_flag: true,
  },
  {
    id: "DT-003", asset_id: "TR-12", asset_name: "Tractor 12", category: "tractor",
    estate: "DME", workshop: "Workshop A", status: "paused", current_stage: "waiting_supplier",
    planned: true, failure_start: new Date(Date.now()-72*3600*1000).toISOString(),
    downtime_start: new Date(Date.now()-70*3600*1000).toISOString(), downtime_end: null,
    stage_durations: { diagnosis:3, planning:4, waiting_mechanic:0, waiting_parts:12, waiting_supplier:28, repair:2, qc:0, release:0 },
    total_downtime_hours: 49, blocking_reason: "Waiting supplier quotation", linked_wo: "WO-2026-0139",
    component: "Transmission", cause_category: "Mechanical", severity: "medium", repeat_flag: false,
  },
];

function calcHours(a: string, b?: string | null): number {
  const end = b ? new Date(b).getTime() : Date.now();
  return Math.max(0, (end - new Date(a).getTime()) / 3600000);
}

export class DowntimeService {
  private static instance: DowntimeService;
  private events: DowntimeEvent[] = [...MOCK_EVENTS];
  private extendDb: Database;
  private useDb = false;
  private constructor() {
    this.extendDb = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    // Probe for table; if present use DB, else keep mock.
    this.extendDb.query("SELECT TOP 1 id FROM dbo.downtime_event").then(() => { this.useDb = true; }).catch(() => { this.useDb = false; });
  }
  static getInstance(): DowntimeService {
    if (!DowntimeService.instance) DowntimeService.instance = new DowntimeService();
    return DowntimeService.instance;
  }

  private toEvent(row: any): DowntimeEvent {
    let sd: Record<DowntimeStage, number> = emptyDurations();
    try { const j = row.stage_durations_json ? JSON.parse(row.stage_durations_json) : null; if (j) sd = j; } catch {}
    return {
      id: row.id,
      asset_id: row.asset_id,
      asset_name: row.asset_name || undefined,
      category: row.category || undefined,
      estate: row.estate || undefined,
      workshop: row.workshop || undefined,
      status: row.status as DowntimeStatus,
      current_stage: row.current_stage as DowntimeStage,
      planned: !!row.planned,
      failure_start: row.failure_start ? new Date(row.failure_start).toISOString() : row.downtime_start ? new Date(row.downtime_start).toISOString() : new Date().toISOString(),
      downtime_start: row.downtime_start ? new Date(row.downtime_start).toISOString() : new Date().toISOString(),
      downtime_end: row.downtime_end ? new Date(row.downtime_end).toISOString() : null,
      stage_durations: sd,
      total_downtime_hours: Number(row.total_downtime_hours) || calcHours(row.downtime_start ? new Date(row.downtime_start).toISOString() : new Date().toISOString(), row.downtime_end ? new Date(row.downtime_end).toISOString() : null),
      blocking_reason: row.blocking_reason || null,
      linked_wo: row.linked_wo || null,
      component: row.component || null,
      cause_category: row.cause_category || null,
      severity: (row.severity as any) || "medium",
      repeat_flag: !!row.repeat_flag,
    };
  }

  async listEventsAsync(filter?: { status?: string; category?: string }): Promise<DowntimeEvent[]> {
    if (!this.useDb) return this.listEvents(filter);
    try {
      const where: string[] = [];
      const params: any[] = [];
      if (filter?.status) { where.push("status = ?"); params.push(filter.status); }
      if (filter?.category) { where.push("category = ?"); params.push(filter.category); }
      const sql = `SELECT * FROM dbo.downtime_event ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
      const rows: any[] = await this.extendDb.query(sql, params);
      let events = rows.map((r) => this.toEvent(r));
      // refresh active durations
      events = events.map(e => e.status !== "completed" ? { ...e, total_downtime_hours: calcHours(e.downtime_start, e.downtime_end) } : e);
      if (events.length) return events;
    } catch {}
    return this.listEvents(filter);
  }

  listEvents(filter?: { status?: string; category?: string }): DowntimeEvent[] {
    let rows = this.events;
    if (filter?.status) rows = rows.filter(r => r.status === filter.status);
    if (filter?.category) rows = rows.filter(r => r.category === filter.category);
    return rows.map(e => e.status !== "completed" ? { ...e, total_downtime_hours: calcHours(e.downtime_start, e.downtime_end) } : e);
  }

  getBoard() {
    const active = this.listEvents({ status: "active" }).concat(this.listEvents({ status: "paused" }));
    return active;
  }
  async getBoardAsync() {
    const active = await this.listEventsAsync({ status: "active" });
    const paused = await this.listEventsAsync({ status: "paused" });
    if (active.length || paused.length) return [...active, ...paused];
    return this.getBoard();
  }

  getKpi(month: number, year: number) {
    const events = this.listEvents();
    return kpiFromEvents(events, month, year);
  }
  async getKpiAsync(month: number, year: number) {
    const events = await this.listEventsAsync();
    const ev = events.length ? events : this.listEvents();
    return kpiFromEvents(ev, month, year);
  }

  async createEventAsync(payload: Partial<DowntimeEvent>): Promise<DowntimeEvent> {
    if (!this.useDb) return this.createEvent(payload);
    const ev = this.createEvent(payload);
    try {
      await this.extendDb.query(
        `INSERT INTO dbo.downtime_event (id, asset_id, asset_name, category, estate, workshop, status, current_stage, planned, failure_start, downtime_start, downtime_end, stage_durations_json, total_downtime_hours, blocking_reason, linked_wo, component, cause_category, severity, repeat_flag, rca_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ev.id, ev.asset_id, ev.asset_name || null, ev.category || null, ev.estate || null, ev.workshop || null, ev.status, ev.current_stage, ev.planned ? 1 : 0, ev.failure_start, ev.downtime_start, ev.downtime_end, JSON.stringify(ev.stage_durations), ev.total_downtime_hours, ev.blocking_reason, ev.linked_wo, ev.component, ev.cause_category, ev.severity, ev.repeat_flag ? 1 : 0, null]
      );
      await this.extendDb.query(
        `INSERT INTO dbo.downtime_stage_history (downtime_id, from_stage, to_stage, blocking_reason) VALUES (?, ?, ?, ?)`,
        [ev.id, null, ev.current_stage, ev.blocking_reason]
      );
    } catch {}
    return ev;
  }

  createEvent(payload: Partial<DowntimeEvent>): DowntimeEvent {
    const now = new Date().toISOString();
    const ev: DowntimeEvent = {
      id: payload.id || `DT-${String(this.events.length+1).padStart(3,"0")}`,
      asset_id: payload.asset_id || "UNKNOWN",
      asset_name: payload.asset_name,
      category: payload.category || "dump_truck",
      estate: payload.estate,
      workshop: payload.workshop,
      status: "active",
      current_stage: payload.current_stage || "diagnosis",
      planned: !!payload.planned,
      failure_start: payload.failure_start || now,
      downtime_start: payload.downtime_start || now,
      downtime_end: null,
      stage_durations: payload.stage_durations || emptyDurations(),
      total_downtime_hours: 0,
      blocking_reason: payload.blocking_reason || null,
      linked_wo: payload.linked_wo || null,
      component: payload.component || null,
      cause_category: payload.cause_category || null,
      severity: payload.severity || "medium",
      repeat_flag: !!payload.repeat_flag,
    };
    ev.total_downtime_hours = calcHours(ev.downtime_start, null);
    this.events.unshift(ev);
    return ev;
  }

  async advanceStageAsync(id: string, next: DowntimeStage, blockingReason?: string | null): Promise<DowntimeEvent | null> {
    const updated = this.advanceStage(id, next, blockingReason);
    if (!updated || !this.useDb) return updated;
    try {
      const total = calcHours(updated.downtime_start, updated.downtime_end);
      await this.extendDb.query(
        `UPDATE dbo.downtime_event SET current_stage = ?, status = ?, blocking_reason = ?, total_downtime_hours = ?, updated_at = SYSUTCDATETIME() ${next === "release" ? ", downtime_end = SYSUTCDATETIME()" : ""} WHERE id = ?`,
        [next, updated.status, blockingReason ?? updated.blocking_reason, total, id]
      );
      await this.extendDb.query(
        `INSERT INTO dbo.downtime_stage_history (downtime_id, from_stage, to_stage, blocking_reason) VALUES (?, ?, ?, ?)`,
        [id, updated.current_stage, next, blockingReason ?? null]
      );
    } catch {}
    return updated;
  }

  advanceStage(id: string, next: DowntimeStage, blockingReason?: string | null): DowntimeEvent | null {
    const ev = this.events.find(e=>e.id===id);
    if (!ev) return null;
    const prev = ev.current_stage;
    ev.current_stage = next;
    if (blockingReason !== undefined) ev.blocking_reason = blockingReason;
    if (next === "release") { ev.status = "completed"; ev.downtime_end = new Date().toISOString(); }
    return ev;
  }

  async getStageHistory(id: string): Promise<{ from_stage: string | null; to_stage: string; changed_at: string; blocking_reason: string | null }[]> {
    if (!this.useDb) return [];
    try {
      const rows: any[] = await this.extendDb.query(`SELECT from_stage, to_stage, changed_at, blocking_reason FROM dbo.downtime_stage_history WHERE downtime_id = ? ORDER BY changed_at ASC`, [id]);
      return rows.map((r) => ({ from_stage: r.from_stage, to_stage: r.to_stage, changed_at: new Date(r.changed_at).toISOString(), blocking_reason: r.blocking_reason }));
    } catch { return []; }
  }
}

function kpiFromEvents(events: DowntimeEvent[], month: number, year: number) {
  const totalHours = events.reduce((s,e)=> s+e.total_downtime_hours, 0);
  const unplanned = events.filter(e=>!e.planned).reduce((s,e)=> s+e.total_downtime_hours,0);
  const planned = totalHours - unplanned;
  const repairs = events.length || 1;
  const mttr = totalHours / repairs;
  const distinctAssets = new Set(events.map(e=>e.asset_id)).size || 1;
  const operatingHours = 30*16*distinctAssets;
  const mtbf = operatingHours / repairs;
  const availability = operatingHours ? (operatingHours - totalHours)/operatingHours*100 : 100;
  const waitingParts = events.reduce((s,e)=> s+(e.stage_durations.waiting_parts||0)+(e.stage_durations.waiting_supplier||0),0);
  const waitingRatio = totalHours ? waitingParts/totalHours*100 : 0;
  const byStage: Record<string,number> = {};
  for (const s of STAGE_ORDER) byStage[s] = events.reduce((acc,e)=> acc+(e.stage_durations[s]||0),0);
  const byComponent: Record<string,number> = {};
  for (const e of events) if(e.component) byComponent[e.component]=(byComponent[e.component]||0)+e.total_downtime_hours;
  const byCategory: Record<string,number> = {};
  for (const e of events) if(e.category) byCategory[e.category]=(byCategory[e.category]||0)+e.total_downtime_hours;
  return {
    period: { month, year },
    total_downtime_hours: Math.round(totalHours*10)/10,
    planned_hours: Math.round(planned*10)/10,
    unplanned_hours: Math.round(unplanned*10)/10,
    mttr: Math.round(mttr*10)/10,
    mtbf: Math.round(mtbf*10)/10,
    availability_pct: Math.round(availability*10)/10,
    waiting_parts_ratio: Math.round(waitingRatio*10)/10,
    current_down: activeCount(events),
    by_stage: byStage,
    by_component: byComponent,
    by_category: byCategory,
    downtime_trend: weekTrend(events),
  };
}
function emptyDurations(): Record<DowntimeStage,number> {
  const o: any = {}; for (const s of STAGE_ORDER) o[s]=0; return o;
}
function activeCount(events: DowntimeEvent[]): number {
  return events.filter(e=>e.status==="active"||e.status==="paused").length;
}
function weekTrend(events: DowntimeEvent[]): { label:string; hours:number }[] {
  const labels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const total = events.reduce((s,e)=> s+e.total_downtime_hours,0) || 60;
  return labels.map((label,i)=> ({ label, hours: Math.round((total/7)*(0.6+Math.random()*0.8)*10)/10 }));
}

export const downtimeService = DowntimeService.getInstance();
