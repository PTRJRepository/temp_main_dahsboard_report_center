-- grant-sync-read.sql
-- Run ON THE CLIENT'S Firebird DB (e.g. PTRJ_ARA.FDB for ARE-A) via isql, as SYSDBA.
-- The IFESS QueryGateway client module connects as PTRJ_IFESS_GATEWAY (read-only). That user
-- currently lacks SELECT on PII columns (ADDRESS1, etc.), so the server-pull sync query
-- `SELECT <all cols> FROM <table>` fails with SQLCODE -551 "no permission for read/select".
-- Grant full read so the sync can replicate every column. One-time per client DB.
--
-- Usage (on the client machine):
--   "C:\Program Files (x86)\Firebird\Firebird_1_5\bin\isql.exe" localhost:<client.fdb> -u SYSDBA -p masterkey -i grant-sync-read.sql
--
-- After this, the server-pull sync (POST /api/ifess/sync {division,table,clientId}) will be
-- able to read all columns of every IFESS table from that client.

-- Grant SELECT on all columns of every user table to the query-gateway user.
-- Firebird 1.5 has no "GRANT ON ALL TABLES" — generate per-table via the EXECUTE block below
-- (isql supports it as a script of GRANT statements). Run the generator, copy output, run it.

SET TERM ^ ;
CREATE PROCEDURE SP_GRANT_SYNC_READ AS
DECLARE VARIABLE TBL VARCHAR(64);
BEGIN
  FOR SELECT RDB$RELATION_NAME FROM RDB$RELATIONS
      WHERE RDB$SYSTEM_FLAG = 0 AND RDB$VIEW_SOURCE IS NULL
      INTO :TBL DO
  BEGIN
    EXECUTE STATEMENT 'GRANT SELECT ON "' || :TBL || '" TO PTRJ_IFESS_GATEWAY';
  END
END ^
SET TERM ; ^
EXECUTE PROCEDURE SP_GRANT_SYNC_READ ^
DROP PROCEDURE SP_GRANT_SYNC_READ ^
COMMIT ^
