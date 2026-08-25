import { Database } from "../db/client";
import { Config } from "../config";

async function run() {
  const db = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
  console.log(`Ensuring downtime + asset tables on ${Config.DB_EXTEND_DATABASE} (${Config.DB_EXTEND_PROFILE})`);
  await db.query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='downtime_event' AND TABLE_SCHEMA='dbo')
    BEGIN
      CREATE TABLE dbo.downtime_event (
        id VARCHAR(32) PRIMARY KEY,
        asset_id VARCHAR(64) NOT NULL,
        asset_name VARCHAR(150) NULL,
        category VARCHAR(32) NULL,
        estate VARCHAR(32) NULL,
        workshop VARCHAR(64) NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        current_stage VARCHAR(32) NOT NULL DEFAULT 'diagnosis',
        planned BIT NOT NULL DEFAULT 0,
        failure_start DATETIME2 NULL,
        downtime_start DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        downtime_end DATETIME2 NULL,
        stage_durations_json NVARCHAR(MAX) NULL,
        total_downtime_hours DECIMAL(10,2) NULL,
        blocking_reason VARCHAR(255) NULL,
        linked_wo VARCHAR(64) NULL,
        component VARCHAR(100) NULL,
        cause_category VARCHAR(64) NULL,
        severity VARCHAR(16) NULL,
        repeat_flag BIT NOT NULL DEFAULT 0,
        rca_json NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_downtime_event_status ON dbo.downtime_event(status);
      CREATE INDEX IX_downtime_event_asset ON dbo.downtime_event(asset_id);
    END
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='downtime_stage_history' AND TABLE_SCHEMA='dbo')
    BEGIN
      CREATE TABLE dbo.downtime_stage_history (
        id INT IDENTITY(1,1) PRIMARY KEY,
        downtime_id VARCHAR(32) NOT NULL FOREIGN KEY REFERENCES dbo.downtime_event(id),
        from_stage VARCHAR(32) NULL,
        to_stage VARCHAR(32) NOT NULL,
        changed_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        blocking_reason VARCHAR(255) NULL,
        changed_by VARCHAR(64) NULL
      );
      CREATE INDEX IX_downtime_stage_history_downtime ON dbo.downtime_stage_history(downtime_id, changed_at);
    END
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='asset_master' AND TABLE_SCHEMA='dbo')
    BEGIN
      CREATE TABLE dbo.asset_master (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(32) NOT NULL,
        brand VARCHAR(64) NULL,
        model VARCHAR(64) NULL,
        meter DECIMAL(12,2) NULL,
        location VARCHAR(100) NULL,
        overall_status VARCHAR(32) NOT NULL DEFAULT 'Operational',
        downtime_status VARCHAR(100) NULL,
        current_wo VARCHAR(64) NULL,
        technician VARCHAR(64) NULL,
        estimated_completion DATETIME2 NULL,
        last_failure DATETIME2 NULL,
        next_pm DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='asset_component_condition' AND TABLE_SCHEMA='dbo')
    BEGIN
      CREATE TABLE dbo.asset_component_condition (
        id VARCHAR(80) PRIMARY KEY,
        asset_id VARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.asset_master(id),
        name VARCHAR(100) NOT NULL,
        system_name VARCHAR(64) NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'Healthy',
        severity VARCHAR(16) NULL,
        last_inspection DATETIME2 NULL,
        last_failure DATETIME2 NULL,
        current_issue VARCHAR(255) NULL,
        recommended_action VARCHAR(255) NULL,
        linked_wo VARCHAR(64) NULL,
        linked_part VARCHAR(64) NULL,
        pos_json NVARCHAR(MAX) NULL,
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_asset_component_asset ON dbo.asset_component_condition(asset_id);
    END
  `);
  console.log("Schema ensured.");
}
run().catch((e) => { console.error(e); process.exit(1); });
