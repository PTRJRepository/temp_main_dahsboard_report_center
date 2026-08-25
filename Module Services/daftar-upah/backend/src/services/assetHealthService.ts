export type ComponentStatus =
  | "Healthy" | "Monitor" | "Worn" | "Faulty" | "Critical" | "Under Repair" | "Replaced" | "Not Inspected";

export const COMPONENT_STATUS_COLOR: Record<ComponentStatus, string> = {
  "Healthy": "#16a34a",
  "Monitor": "#f59e0b",
  "Worn": "#f59e0b",
  "Faulty": "#dc2626",
  "Critical": "#dc2626",
  "Under Repair": "#2563eb",
  "Replaced": "#0d9488",
  "Not Inspected": "#94a3b8",
};

export const OVERALL_STATUS = [
  "Operational","Running with Observation","Preventive Due","Under Inspection",
  "Planned for Maintenance","Waiting Mechanic","Waiting Parts","Waiting Supplier",
  "Under Repair","Testing / QC","Ready for Release","Breakdown","External Repair","Standby","Retired"
] as const;

export interface ComponentHealth {
  id: string;
  name: string;
  system: string;
  status: ComponentStatus;
  severity?: "low"|"medium"|"high"|"critical";
  last_inspection?: string | null;
  last_failure?: string | null;
  current_issue?: string | null;
  recommended_action?: string | null;
  linked_wo?: string | null;
  linked_part?: string | null;
  // hotspot position in schematic (percent 0-100)
  pos?: { x: number; y: number; w?: number; h?: number };
}

export interface AssetHealth {
  id: string;
  name: string;
  category: "tractor"|"excavator"|"dump_truck"|"loader"|"harvester";
  brand?: string;
  model?: string;
  meter?: number;
  location?: string;
  overall_status: typeof OVERALL_STATUS[number];
  health_score: number; // 0-100
  downtime_status?: string | null;
  current_wo?: string | null;
  technician?: string | null;
  estimated_completion?: string | null;
  last_failure?: string | null;
  next_pm?: string | null;
  components: ComponentHealth[];
  history?: { date: string; component: string; status: ComponentStatus; note?: string }[];
}

// ponytail: mock catalog until asset_master table exists. Upgrade: persist to extend_db_ptrj asset_health tables.
const CATALOG: Record<string, { name: string; system: string; pos: {x:number;y:number;w?:number;h?:number} }[]> = {
  dump_truck: [
    { name: "Engine", system: "Power", pos: { x: 18, y: 32, w: 22, h: 18 } },
    { name: "Transmission", system: "Drivetrain", pos: { x: 38, y: 58, w: 18, h: 12 } },
    { name: "Hydraulic Hoist", system: "Hydraulic", pos: { x: 58, y: 38, w: 20, h: 14 } },
    { name: "Brake System", system: "Brake", pos: { x: 26, y: 68, w: 16, h: 10 } },
    { name: "Steering", system: "Steering", pos: { x: 12, y: 44, w: 12, h: 10 } },
    { name: "Cooling System", system: "Cooling", pos: { x: 32, y: 28, w: 14, h: 10 } },
    { name: "Fuel System", system: "Fuel", pos: { x: 46, y: 66, w: 14, h: 10 } },
    { name: "Electrical", system: "Electrical", pos: { x: 52, y: 52, w: 14, h: 10 } },
    { name: "Battery", system: "Electrical", pos: { x: 66, y: 58, w: 10, h: 8 } },
    { name: "Front Tyres", system: "Tyres", pos: { x: 14, y: 72, w: 18, h: 12 } },
    { name: "Rear Tyres", system: "Tyres", pos: { x: 70, y: 72, w: 22, h: 14 } },
    { name: "Chassis", system: "Structure", pos: { x: 40, y: 48, w: 24, h: 8 } },
    { name: "Cabin", system: "Cabin", pos: { x: 48, y: 18, w: 20, h: 16 } },
  ],
  tractor: [
    { name: "Engine", system: "Power", pos: { x: 22, y: 36, w: 20, h: 16 } },
    { name: "Clutch", system: "Drivetrain", pos: { x: 36, y: 52, w: 12, h: 10 } },
    { name: "Transmission", system: "Drivetrain", pos: { x: 42, y: 58, w: 16, h: 10 } },
    { name: "Hydraulic Pump", system: "Hydraulic", pos: { x: 54, y: 40, w: 16, h: 12 } },
    { name: "PTO", system: "Hydraulic", pos: { x: 72, y: 56, w: 12, h: 8 } },
    { name: "Steering", system: "Steering", pos: { x: 14, y: 44, w: 12, h: 10 } },
    { name: "Front Axle", system: "Chassis", pos: { x: 18, y: 68, w: 16, h: 10 } },
    { name: "Rear Axle", system: "Chassis", pos: { x: 68, y: 68, w: 16, h: 10 } },
    { name: "Brake", system: "Brake", pos: { x: 28, y: 64, w: 14, h: 10 } },
    { name: "Electrical", system: "Electrical", pos: { x: 50, y: 52, w: 12, h: 10 } },
    { name: "Battery", system: "Electrical", pos: { x: 60, y: 60, w: 10, h: 8 } },
    { name: "Cooling", system: "Cooling", pos: { x: 34, y: 28, w: 14, h: 10 } },
    { name: "Tyres", system: "Tyres", pos: { x: 44, y: 72, w: 20, h: 12 } },
  ],
  excavator: [
    { name: "Engine", system: "Power", pos: { x: 24, y: 32, w: 20, h: 14 } },
    { name: "Hydraulic Pump", system: "Hydraulic", pos: { x: 40, y: 46, w: 18, h: 12 } },
    { name: "Main Control Valve", system: "Hydraulic", pos: { x: 52, y: 38, w: 16, h: 10 } },
    { name: "Boom Cylinder", system: "Hydraulic", pos: { x: 62, y: 22, w: 18, h: 10 } },
    { name: "Arm Cylinder", system: "Hydraulic", pos: { x: 72, y: 32, w: 14, h: 8 } },
    { name: "Bucket Cylinder", system: "Hydraulic", pos: { x: 78, y: 48, w: 14, h: 8 } },
    { name: "Swing System", system: "Drivetrain", pos: { x: 42, y: 62, w: 16, h: 10 } },
    { name: "Travel Motor", system: "Drivetrain", pos: { x: 28, y: 68, w: 14, h: 10 } },
    { name: "Undercarriage", system: "Chassis", pos: { x: 36, y: 74, w: 28, h: 10 } },
    { name: "Track Shoe", system: "Tyres", pos: { x: 22, y: 76, w: 16, h: 8 } },
    { name: "Cab", system: "Cabin", pos: { x: 48, y: 18, w: 18, h: 14 } },
    { name: "Cooling", system: "Cooling", pos: { x: 34, y: 26, w: 12, h: 8 } },
    { name: "Electrical", system: "Electrical", pos: { x: 54, y: 58, w: 12, h: 8 } },
  ],
  loader: [
    { name: "Engine", system: "Power", pos: { x: 22, y: 34, w: 20, h: 16 } },
    { name: "Transmission", system: "Drivetrain", pos: { x: 38, y: 56, w: 16, h: 10 } },
    { name: "Hydraulic Pump", system: "Hydraulic", pos: { x: 52, y: 38, w: 16, h: 12 } },
    { name: "Bucket", system: "Structure", pos: { x: 78, y: 42, w: 16, h: 14 } },
    { name: "Lift Cylinder", system: "Hydraulic", pos: { x: 64, y: 28, w: 14, h: 10 } },
    { name: "Steering", system: "Steering", pos: { x: 14, y: 48, w: 12, h: 10 } },
    { name: "Brake", system: "Brake", pos: { x: 26, y: 64, w: 14, h: 10 } },
    { name: "Electrical", system: "Electrical", pos: { x: 48, y: 52, w: 12, h: 10 } },
    { name: "Tyres Front", system: "Tyres", pos: { x: 16, y: 70, w: 16, h: 12 } },
    { name: "Tyres Rear", system: "Tyres", pos: { x: 58, y: 70, w: 16, h: 12 } },
    { name: "Cabin", system: "Cabin", pos: { x: 46, y: 18, w: 18, h: 14 } },
  ],
  harvester: [
    { name: "Engine", system: "Power", pos: { x: 24, y: 36, w: 20, h: 16 } },
    { name: "Cutter Bar", system: "Structure", pos: { x: 78, y: 48, w: 16, h: 10 } },
    { name: "Conveyor", system: "Hydraulic", pos: { x: 62, y: 38, w: 16, h: 10 } },
    { name: "Hydraulic Pump", system: "Hydraulic", pos: { x: 44, y: 46, w: 16, h: 12 } },
    { name: "Transmission", system: "Drivetrain", pos: { x: 38, y: 60, w: 16, h: 10 } },
    { name: "Steering", system: "Steering", pos: { x: 14, y: 48, w: 12, h: 10 } },
    { name: "Brake", system: "Brake", pos: { x: 28, y: 64, w: 12, h: 10 } },
    { name: "Electrical", system: "Electrical", pos: { x: 52, y: 56, w: 12, h: 10 } },
    { name: "Track / Tyres", system: "Tyres", pos: { x: 40, y: 74, w: 24, h: 10 } },
    { name: "Cabin", system: "Cabin", pos: { x: 48, y: 20, w: 18, h: 14 } },
  ],
};

function mockComponents(category: string): ComponentHealth[] {
  const catalog = CATALOG[category] || CATALOG.dump_truck;
  const statuses: ComponentStatus[] = ["Healthy","Healthy","Healthy","Monitor","Worn","Faulty","Critical","Under Repair","Replaced","Not Inspected"];
  return catalog.map((c, i) => {
    // deterministic mix: mostly healthy, 1-2 warnings, 1 critical if id ends with 07 etc.
    let status: ComponentStatus = "Healthy";
    const r = (i * 7) % 10;
    if (r === 6) status = "Monitor";
    if (r === 7) status = "Worn";
    if (r === 8) status = "Faulty";
    if (r === 9) status = "Not Inspected";
    return {
      id: `${category}-${i}-${c.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,
      name: c.name,
      system: c.system,
      status,
      severity: (status === "Faulty" || (status as ComponentStatus) === "Critical") ? "high" : status === "Monitor" || status === "Worn" ? "medium" : "low",
      last_inspection: new Date(Date.now() - (i+1)*86400000*3).toISOString(),
      last_failure: (status as ComponentStatus) === "Critical" ? new Date(Date.now() - 5*86400000).toISOString() : null,
      current_issue: status === "Faulty" ? "Abnormal pressure" : status === "Monitor" ? "Wear approaching limit" : null,
      recommended_action: status === "Faulty" ? "Inspect and replace" : status === "Monitor" ? "Schedule inspection" : null,
      linked_wo: status === "Faulty" ? "WO-2026-0142" : null,
      linked_part: null,
      pos: c.pos,
    } as ComponentHealth;
  });
}

function healthScore(components: ComponentHealth[]): number {
  const weight: Record<ComponentStatus, number> = {
    "Healthy": 100, "Monitor": 70, "Worn": 60, "Faulty": 25, "Critical": 10, "Under Repair": 40, "Replaced": 95, "Not Inspected": 80,
  };
  if (!components.length) return 85;
  const avg = components.reduce((s,c)=> s+(weight[c.status]??80),0)/components.length;
  return Math.round(avg);
}

const MOCK_ASSETS: AssetHealth[] = ([
  { id:"DT-07", name:"Dump Truck 07", category:"dump_truck", brand:"Hino", model:"FM 260", meter: 48230, location:"Workshop A", overall_status:"Waiting Parts", health_score: 0, downtime_status:"Down 30h", current_wo:"WO-2026-0142", technician:"Team A", estimated_completion: new Date(Date.now()+18*3600000).toISOString(), last_failure: new Date(Date.now()-36*3600000).toISOString(), next_pm: new Date(Date.now()+14*86400000).toISOString(), components: mockComponents("dump_truck"), history: [] },
  { id:"EX-03", name:"Excavator 03", category:"excavator", brand:"Komatsu", model:"PC200", meter: 7210, location:"Workshop B", overall_status:"Under Repair", health_score: 0, downtime_status:"Down 15h", current_wo:"WO-2026-0145", technician:"Team B", estimated_completion: new Date(Date.now()+8*3600000).toISOString(), last_failure: new Date(Date.now()-16*3600000).toISOString(), next_pm: new Date(Date.now()+30*86400000).toISOString(), components: mockComponents("excavator"), history: [] },
  { id:"TR-12", name:"Tractor 12", category:"tractor", brand:"Kubota", model:"M9540", meter: 12340, location:"Workshop A", overall_status:"Waiting Supplier", health_score: 0, downtime_status:"Down 49h", current_wo:"WO-2026-0139", technician:"Team A", estimated_completion: new Date(Date.now()+48*3600000).toISOString(), last_failure: new Date(Date.now()-70*3600000).toISOString(), next_pm: new Date(Date.now()+7*86400000).toISOString(), components: mockComponents("tractor"), history: [] },
  { id:"LD-04", name:"Loader 04", category:"loader", brand:"CAT", model:"950", meter: 8930, location:"Field B", overall_status:"Operational", health_score: 0, downtime_status:null, current_wo:null, technician:null, estimated_completion:null, last_failure: new Date(Date.now()-30*86400000).toISOString(), next_pm: new Date(Date.now()+5*86400000).toISOString(), components: mockComponents("loader"), history: [] },
  { id:"HV-02", name:"Harvester 02", category:"harvester", brand:"John Deere", model:"W540", meter: 5420, location:"Block P09", overall_status:"Running with Observation", health_score: 0, downtime_status:null, current_wo:null, technician:null, estimated_completion:null, last_failure: new Date(Date.now()-12*86400000).toISOString(), next_pm: new Date(Date.now()+20*86400000).toISOString(), components: mockComponents("harvester"), history: [] },
  { id:"DT-11", name:"Dump Truck 11", category:"dump_truck", brand:"Hino", model:"FM 260", meter: 52100, location:"Field A", overall_status:"Operational", health_score: 0, downtime_status:null, current_wo:null, technician:null, estimated_completion:null, last_failure: new Date(Date.now()-45*86400000).toISOString(), next_pm: new Date(Date.now()+10*86400000).toISOString(), components: mockComponents("dump_truck"), history: [] },
  { id:"TR-05", name:"Tractor 05", category:"tractor", brand:"Kubota", model:"M8540", meter: 9870, location:"Workshop A", overall_status:"Preventive Due", health_score: 0, downtime_status:null, current_wo:null, technician:null, estimated_completion:null, last_failure: new Date(Date.now()-60*86400000).toISOString(), next_pm: new Date(Date.now()+1*86400000).toISOString(), components: mockComponents("tractor"), history: [] },
  { id:"EX-07", name:"Excavator 07", category:"excavator", brand:"Hitachi", model:"ZX200", meter: 6420, location:"Field C", overall_status:"Operational", health_score: 0, downtime_status:null, current_wo:null, technician:null, estimated_completion:null, last_failure: new Date(Date.now()-22*86400000).toISOString(), next_pm: new Date(Date.now()+18*86400000).toISOString(), components: mockComponents("excavator"), history: [] },
] as AssetHealth[]).map(a => ({ ...a, health_score: healthScore(a.components) }));

export class AssetHealthService {
  private static instance: AssetHealthService;
  private assets: AssetHealth[] = [...MOCK_ASSETS];
  private useDb = false;
  private extendDb: any = null;
  static getInstance(): AssetHealthService {
    if (!AssetHealthService.instance) AssetHealthService.instance = new AssetHealthService();
    return AssetHealthService.instance;
  }
  private getDb() {
    if (this.extendDb) return this.extendDb;
    try {
      // lazy — keep sync shape; ponytail: migrate to top-level import when asset_master seeded
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const DbMod = require("../db/client");
      const CfgMod = require("../config");
      const Db = DbMod.Database;
      const Cfg = CfgMod.Config;
      this.extendDb = Db.getInstance(Cfg.DB_EXTEND_DATABASE, Cfg.DB_EXTEND_PROFILE);
      this.extendDb.query("SELECT TOP 1 id FROM dbo.asset_master").then(() => { this.useDb = true; }).catch(() => { this.useDb = false; });
    } catch {}
    return this.extendDb;
  }
  listAssets(filter?: { category?: string; status?: string }): AssetHealth[] {
    let rows = this.assets;
    if (filter?.category) rows = rows.filter(a=> a.category===filter.category);
    if (filter?.status) rows = rows.filter(a=> a.overall_status===filter.status);
    return rows;
  }
  async listAssetsAsync(filter?: { category?: string; status?: string }): Promise<AssetHealth[]> {
    const db = this.getDb();
    if (!this.useDb || !db) return this.listAssets(filter);
    try {
      const where: string[] = [];
      const params: any[] = [];
      if (filter?.category) { where.push("category = ?"); params.push(filter.category); }
      if (filter?.status) { where.push("overall_status = ?"); params.push(filter.status); }
      const rows: any[] = await db.query(`SELECT * FROM dbo.asset_master ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id`, params);
      if (!rows.length) return this.listAssets(filter);
      const assets: AssetHealth[] = [];
      for (const r of rows) {
        const compRows: any[] = await db.query(`SELECT * FROM dbo.asset_component_condition WHERE asset_id = ? ORDER BY name`, [r.id]);
        const comps: ComponentHealth[] = compRows.map((c: any) => ({
          id: c.id, name: c.name, system: c.system_name || "General", status: c.status as any,
          severity: c.severity as any || "low", last_inspection: c.last_inspection ? new Date(c.last_inspection).toISOString() : null,
          last_failure: c.last_failure ? new Date(c.last_failure).toISOString() : null,
          current_issue: c.current_issue || null, recommended_action: c.recommended_action || null,
          linked_wo: c.linked_wo || null, linked_part: c.linked_part || null,
          pos: c.pos_json ? JSON.parse(c.pos_json) : undefined,
        }));
        assets.push({
          id: r.id, name: r.name, category: r.category as any, brand: r.brand || undefined, model: r.model || undefined,
          meter: r.meter != null ? Number(r.meter) : undefined, location: r.location || undefined,
          overall_status: r.overall_status as any, health_score: healthScore(comps.length ? comps : mockComponents(r.category)),
          downtime_status: r.downtime_status || null, current_wo: r.current_wo || null, technician: r.technician || null,
          estimated_completion: r.estimated_completion ? new Date(r.estimated_completion).toISOString() : null,
          last_failure: r.last_failure ? new Date(r.last_failure).toISOString() : null,
          next_pm: r.next_pm ? new Date(r.next_pm).toISOString() : null,
          components: comps.length ? comps : mockComponents(r.category), history: [],
        });
      }
      return assets;
    } catch { return this.listAssets(filter); }
  }
  getAsset(id: string): AssetHealth | null {
    return this.assets.find(a=> a.id===id) || null;
  }
  updateComponent(assetId: string, componentId: string, patch: Partial<ComponentHealth>): ComponentHealth | null {
    const asset = this.getAsset(assetId);
    if (!asset) return null;
    const comp = asset.components.find(c=> c.id===componentId);
    if (!comp) return null;
    Object.assign(comp, patch);
    asset.health_score = healthScore(asset.components);
    // best-effort persist
    const db = this.getDb();
    if (this.useDb && db) {
      const fields: string[] = [];
      const params: any[] = [];
      if (patch.status !== undefined) { fields.push("status = ?"); params.push(patch.status); }
      if (patch.current_issue !== undefined) { fields.push("current_issue = ?"); params.push(patch.current_issue); }
      if (patch.recommended_action !== undefined) { fields.push("recommended_action = ?"); params.push(patch.recommended_action); }
      if (patch.severity !== undefined) { fields.push("severity = ?"); params.push(patch.severity); }
      if (patch.linked_wo !== undefined) { fields.push("linked_wo = ?"); params.push(patch.linked_wo); }
      if (fields.length) {
        params.push(componentId);
        db.query(`UPDATE dbo.asset_component_condition SET ${fields.join(", ")}, updated_at = SYSUTCDATETIME() WHERE id = ?`, params).catch(() => {});
      }
    }
    return comp;
  }
  getCatalog(category: string) {
    return CATALOG[category] || CATALOG.dump_truck;
  }
}

export const assetHealthService = AssetHealthService.getInstance();
