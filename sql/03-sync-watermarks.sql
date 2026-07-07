-- 03-sync-watermarks.sql
-- Live-sync state tables on rebinmas_ifess_migrated.
-- Per (division, table): which column is the watermark, last value seen, last sync time, status.
-- Plus sync_jobs / sync_job_tables audit trail (mirror migrations/migration_tables naming).

IF OBJECT_ID(N'dbo.sync_watermarks') IS NULL
BEGIN
  CREATE TABLE dbo.sync_watermarks (
    division_code   VARCHAR(8)  NOT NULL,
    table_name      VARCHAR(64) NOT NULL,
    watermark_col   VARCHAR(64) NULL,          -- detected col: date col or monotonic ID/PK
    last_value      NVARCHAR(64) NULL,         -- max(<watermark_col>) of last loaded batch (string; comparable per-type)
    last_sync_at    DATETIME2    NULL,
    status          VARCHAR(16)  NOT NULL DEFAULT 'active', -- active | unsyncable | bootstrapping
    CONSTRAINT PK_sync_watermarks PRIMARY KEY (division_code, table_name)
  );
END
GO

IF OBJECT_ID(N'dbo.sync_jobs') IS NULL
BEGIN
  CREATE TABLE dbo.sync_jobs (
    sync_job_id     BIGINT IDENTITY(1,1) NOT NULL,
    job_ref         VARCHAR(64) NOT NULL,      -- server-side job id (from Bun gateway)
    division_code   VARCHAR(8)  NOT NULL,
    client_id       VARCHAR(64) NOT NULL,
    mode            VARCHAR(16) NOT NULL,      -- bootstrap | incremental
    status          VARCHAR(16) NOT NULL,      -- pending | running | success | failed
    started_at      DATETIME2    NULL,
    finished_at     DATETIME2    NULL,
    rows_loaded     BIGINT       NOT NULL DEFAULT 0,
    error_message   NVARCHAR(MAX) NULL,
    CONSTRAINT PK_sync_jobs PRIMARY KEY (sync_job_id)
  );
  CREATE INDEX IX_sync_jobs_ref ON dbo.sync_jobs(job_ref);
END
GO

IF OBJECT_ID(N'dbo.sync_job_tables') IS NULL
BEGIN
  CREATE TABLE dbo.sync_job_tables (
    sync_job_id     BIGINT       NOT NULL,
    division_code   VARCHAR(8)   NOT NULL,
    table_name      VARCHAR(64)  NOT NULL,
    migration_batch_id BIGINT    NULL,         -- the batch_id tag written onto rows (for rollback)
    rows_loaded     BIGINT       NOT NULL DEFAULT 0,
    status          VARCHAR(16)  NOT NULL,     -- pending | running | success | failed
    error_message   NVARCHAR(MAX) NULL,
    CONSTRAINT PK_sync_job_tables PRIMARY KEY (sync_job_id, table_name),
    CONSTRAINT FK_sjt_job FOREIGN KEY (sync_job_id) REFERENCES dbo.sync_jobs(sync_job_id)
  );
END
GO
