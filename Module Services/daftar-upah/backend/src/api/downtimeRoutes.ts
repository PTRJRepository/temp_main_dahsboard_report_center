import { Elysia, t } from "elysia";
import { downtimeService, STAGE_ORDER, DELAY_REASONS } from "../services/downtimeService";
import { assetHealthService } from "../services/assetHealthService";

export const downtimeRoutes = new Elysia({ prefix: "/downtime" })
  .get("/kpi", async ({ query }) => {
    const month = query.month ? parseInt(query.month) : new Date().getMonth() + 1;
    const year = query.year ? parseInt(query.year) : new Date().getFullYear();
    const data = await downtimeService.getKpiAsync(month, year);
    return { success: true, data };
  }, { query: t.Object({ month: t.Optional(t.String()), year: t.Optional(t.String()) }) })

  .get("/board", async ({ query }) => {
    const data = await downtimeService.getBoardAsync();
    return { success: true, data, meta: { count: data.length } };
  })

  .get("/events", async ({ query }) => {
    const data = await downtimeService.listEventsAsync({ status: query.status, category: query.category });
    return { success: true, data, meta: { count: data.length } };
  }, { query: t.Object({ status: t.Optional(t.String()), category: t.Optional(t.String()) }) })

  .get("/events/:id/timeline", async ({ params }) => {
    const history = await downtimeService.getStageHistory(params.id);
    return { success: true, data: history };
  }, { params: t.Object({ id: t.String() }) })

  .post("/events", async ({ body }) => {
    const created = await downtimeService.createEventAsync(body as any);
    return { success: true, data: created };
  }, {
    body: t.Object({
      asset_id: t.String(),
      asset_name: t.Optional(t.String()),
      category: t.Optional(t.String()),
      estate: t.Optional(t.String()),
      workshop: t.Optional(t.String()),
      planned: t.Optional(t.Boolean()),
      current_stage: t.Optional(t.String()),
      component: t.Optional(t.String()),
      cause_category: t.Optional(t.String()),
      severity: t.Optional(t.String()),
      blocking_reason: t.Optional(t.String()),
      linked_wo: t.Optional(t.String()),
    })
  })

  .post("/events/:id/advance", async ({ params, body }) => {
    const next = (body as any)?.next_stage as any;
    if (!next || !STAGE_ORDER.includes(next)) {
      return { success: false, error: `next_stage must be one of: ${STAGE_ORDER.join(", ")}` };
    }
    const updated = await downtimeService.advanceStageAsync(params.id, next, (body as any)?.blocking_reason ?? undefined);
    if (!updated) return { success: false, error: "Event not found" };
    return { success: true, data: updated };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ next_stage: t.String(), blocking_reason: t.Optional(t.String()) })
  })

  .post("/events/:id/rca", async ({ params, body }) => {
    const rca = (body as any);
    const list = await downtimeService.listEventsAsync();
    const ev = list.find(e => e.id === params.id) || downtimeService.listEvents().find(e => e.id === params.id);
    if (!ev) return { success: false, error: "Event not found" };
    const note = `RCA: ${rca.root_cause || "-"} | ${rca.corrective_action || "-"}`;
    const updated = await downtimeService.advanceStageAsync(params.id, ev.current_stage, rca.blocking_reason ?? ev.blocking_reason ?? null);
    // persist RCA json best-effort
    try {
      const { Database } = await import("../db/client");
      const { Config } = await import("../config");
      const db = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
      await db.query(`UPDATE dbo.downtime_event SET rca_json = ?, updated_at = SYSUTCDATETIME() WHERE id = ?`, [JSON.stringify(rca), params.id]);
    } catch {}
    return { success: true, data: { ...updated, rca: { ...rca, note, recorded_at: new Date().toISOString() } } };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      failure_system: t.Optional(t.String()), component: t.Optional(t.String()), failure_mode: t.Optional(t.String()),
      suspected_cause: t.Optional(t.String()), root_cause: t.Optional(t.String()), corrective_action: t.Optional(t.String()),
      preventive_recommendation: t.Optional(t.String()), blocking_reason: t.Optional(t.String()),
    })
  })

  .get("/stages", () => ({ success: true, data: STAGE_ORDER }))
  .get("/delay-reasons", () => ({ success: true, data: DELAY_REASONS }));

export const assetHealthRoutes = new Elysia({ prefix: "/asset-health" })
  .get("/assets", async ({ query }) => {
    const data = await assetHealthService.listAssetsAsync({ category: query.category, status: query.status });
    return { success: true, data, meta: { count: data.length } };
  }, { query: t.Object({ category: t.Optional(t.String()), status: t.Optional(t.String()) }) })

  .get("/assets/:id", async ({ params, set }) => {
    const list = await assetHealthService.listAssetsAsync();
    const fromList = list.find(a => a.id === params.id);
    const data = fromList || assetHealthService.getAsset(params.id);
    if (!data) { set.status = 404; return { success: false, error: "Asset not found" }; }
    return { success: true, data };
  }, { params: t.Object({ id: t.String() }) })

  .patch("/assets/:id/components/:componentId", ({ params, body, set }) => {
    const updated = assetHealthService.updateComponent(params.id, params.componentId, body as any);
    if (!updated) { set.status = 404; return { success: false, error: "Asset or component not found" }; }
    return { success: true, data: updated };
  }, {
    params: t.Object({ id: t.String(), componentId: t.String() }),
    body: t.Object({
      status: t.Optional(t.String()),
      current_issue: t.Optional(t.String()),
      recommended_action: t.Optional(t.String()),
      severity: t.Optional(t.String()),
      linked_wo: t.Optional(t.String()),
    })
  })

  .get("/catalog/:category", ({ params }) => {
    const data = assetHealthService.getCatalog(params.category);
    return { success: true, data };
  }, { params: t.Object({ category: t.String() }) });
