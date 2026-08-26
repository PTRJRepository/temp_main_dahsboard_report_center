/**
 * IFESS Control Server - JavaScript/Node.js Implementation
 *
 * This module provides the same functionality as the .NET IFESS.ControlServer.Api
 * but implemented in JavaScript for integration with the Express gateway.
 *
 * Data Flow:
 * 1. Clients (SuperApp) register and send heartbeats
 * 2. Server tracks client/module status
 * 3. Commands can be queued and polled by clients
 * 4. Dashboard aggregates all status data
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================
// DATA STORAGE
// ============================================

// Module-local copy of the canonical iFESS ControlServer core (was
// Services/ifess-control-server/service.js — see docs/independence-research.md
// G2). DATA_DIR defaults to the SHARED repo-root data/ifess store so this
// module and the gateway stay in lockstep during the cut-over; override with
// IFESS_DATA_DIR for tests / isolated deployments.
const DATA_DIR = process.env.IFESS_DATA_DIR ||
    path.join(__dirname, '../../../data/ifess');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// File paths for JSON storage
const FILES = {
    clients: path.join(DATA_DIR, 'clients.json'),
    configs: path.join(DATA_DIR, 'configs.json'),
    commands: path.join(DATA_DIR, 'commands.json'),
    moduleStatuses: path.join(DATA_DIR, 'module-statuses.json'),
    heartbeatLogs: path.join(DATA_DIR, 'heartbeat-logs.json'),
    clientGroups: path.join(DATA_DIR, 'client-groups.json'),
    auditLogs: path.join(DATA_DIR, 'audit-logs.json'),
    queryBatches: path.join(DATA_DIR, 'query-batches.json'),
    queryJobs: path.join(DATA_DIR, 'query-jobs.json'),
    queryResults: path.join(DATA_DIR, 'query-results.json'),
    queryResultChunks: path.join(DATA_DIR, 'query-result-chunks.json'),
    queryTemplates: path.join(DATA_DIR, 'query-templates.json'),
    syncJobs: path.join(DATA_DIR, 'sync-jobs.json'),
    syncDivisions: path.join(DATA_DIR, 'sync-divisions.json')
};

// In-memory cache for performance
let cache = {
    clients: null,
    configs: null,
    commands: null,
    moduleStatuses: null,
    heartbeatLogs: null,
    clientGroups: null,
    auditLogs: null,
    queryBatches: null,
    queryJobs: null,
    queryResults: null,
    queryResultChunks: null,
    queryTemplates: null,
    syncJobs: null,
    syncDivisions: null
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// mtime-based file cache — avoids re-reading large JSON files on every poll
const _fileCache = new Map(); // path -> { mtime: number, data: any }
function readJsonFile(filePath, defaultValue = []) {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        const stat = fs.statSync(filePath);
        const mtimeMs = stat.mtimeMs;
        const cached = _fileCache.get(filePath);
        if (cached && cached.mtime === mtimeMs) {
            return cached.data;
        }
        // Strip BOM + refuse empty files (Bun: "Unrecognized token ''")
        const raw = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '').trim();
        if (!raw) return defaultValue;
        const data = JSON.parse(raw);
        _fileCache.set(filePath, { mtime: mtimeMs, data });
        return data;
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
    }
    return defaultValue;
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error.message);
        return false;
    }
}

// ── IFESS Query Template Seeds (declared before loadAll to avoid TDZ) ─
// Derived from D:\Gawean Rebinmas\IFESS_Server_Web\static\sql_queries\*.sql
// and Firebird system catalog. Read-only SELECT only.
const DEFAULT_QUERY_TEMPLATES = [
    {
        templateCode: 'LIST_TABLES',
        templateName: 'Daftar Tabel (Firebird)',
        description: 'List semua user table di database client via RDB$RELATIONS.',
        queryText: 'SELECT RDB$RELATION_NAME AS TABLE_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL ORDER BY RDB$RELATION_NAME',
        defaultMaxRows: 500,
        defaultTimeoutSeconds: 15,
        tags: ['system', 'catalog'],
    },
    {
        templateCode: 'TABLE_COLUMNS',
        templateName: 'Kolom Tabel (Firebird)',
        description: 'List kolom + tipe data sebuah tabel. Ganti #TABLE_NAME#.',
        queryText: 'SELECT RDB$FIELD_NAME AS COLUMN_NAME, RDB$FIELD_TYPE AS FIELD_TYPE FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = #TABLE_NAME# ORDER BY RDB$FIELD_POSITION',
        defaultMaxRows: 500,
        defaultTimeoutSeconds: 15,
        tags: ['system', 'catalog'],
    },
    {
        templateCode: 'CONNECTION_TEST',
        templateName: 'Tes Koneksi DB',
        description: 'Verifikasi koneksi Firebird client via RDB$DATABASE.',
        queryText: "SELECT 'Connection Test' AS RESULT FROM RDB$DATABASE",
        defaultMaxRows: 1,
        defaultTimeoutSeconds: 10,
        tags: ['system', 'health'],
    },
    {
        templateCode: 'ITEM_LIST',
        templateName: 'Daftar Barang (IN_ITEM)',
        description: 'Preview 100 baris pertama tabel barang IN_ITEM.',
        queryText: 'SELECT FIRST 100 ITEMNO, DESCRIPTION, STATUSID FROM IN_ITEM ORDER BY ITEMNO',
        defaultMaxRows: 100,
        defaultTimeoutSeconds: 30,
        tags: ['inventory', 'master'],
    },
    {
        templateCode: 'EMPLOYEE_OVERTIME',
        templateName: 'Overtime Karyawan (by ID + Periode)',
        description: 'Data overtime karyawan berdasarkan EMPNO + range tanggal. Porting dari Employee_Overtime.sql.',
        queryText: `SELECT
  e.EMPCODE AS NIP,
  e.NAME AS Nama_Karyawan,
  o.INPDATE AS Tanggal_Overtime,
  o.HOURS AS Jam_Kerja,
  j.DESCRIPTION AS Deskripsi_Pekerjaan,
  o.BASICRATE AS Tarif_Dasar,
  o.ADDRATE AS Tarif_Tambahan,
  o.HOURS * o.BASICRATE AS Nilai_Dasar,
  o.HOURS * o.ADDRATE AS Nilai_Tambahan,
  (o.HOURS * o.BASICRATE) + (o.HOURS * o.ADDRATE) AS Total_Nilai
FROM OVERTIME o
JOIN EMP e ON o.EMPID = e.ID
JOIN JOBCODE j ON o.JOBID = j.ID
WHERE e.EMPCODE = #EMPLOYEE_ID#
  AND o.INPDATE BETWEEN #START_DATE# AND #END_DATE#
ORDER BY o.INPDATE`,
        defaultMaxRows: 1000,
        defaultTimeoutSeconds: 60,
        tags: ['payroll', 'overtime'],
    },
    {
        templateCode: 'OVERTIME_NO_VEH',
        templateName: 'Overtime Helper/Driver Tanpa Nomor Kendaraan',
        description: 'Transaksi overtime Helper/Driver (EXPTYPE PT) tanpa VEHCODE. Porting dari Find_Helper_Hasnt_Veh_No.sql.',
        queryText: `SELECT
  o.EMPID AS KaryawanID,
  o.ID AS OvertimeID,
  o.INPDATE AS TanggalOvertime,
  o.HOURS AS JamKerja,
  SUBSTRING(f.FIELDNO FROM 1 FOR 6) AS KodeField,
  (j.EXPTYPE || j.ITEMNO || j.SUBNO) AS AccCode,
  j.DESCRIPTION AS DeskripsiPekerjaan,
  o.BASICRATE AS TarifDasar,
  o.ADDRATE AS TarifTambahan,
  o.HOURS * o.BASICRATE AS NilaiDasar,
  o.HOURS * o.ADDRATE AS NilaiTambahan,
  o.REMARKS AS Catatan,
  a.VEHNO AS NomorKendaraan,
  a.MODEL AS ModelKendaraan,
  o.VEHID AS VehicleID
FROM OVERTIME o
JOIN JOBCODE j ON o.JOBID = j.ID
JOIN OCFIELD f ON o.FIELDID = f.ID
LEFT JOIN VEHCODE a ON o.VEHID = a.ID
WHERE o.INPDATE BETWEEN #START_DATE# AND #END_DATE#
  AND SUBSTRING(j.EXPTYPE FROM 1 FOR 2) = 'PT'
  AND a.ID IS NULL
ORDER BY o.EMPID, o.INPDATE`,
        defaultMaxRows: 1000,
        defaultTimeoutSeconds: 60,
        tags: ['payroll', 'overtime', 'validation'],
    },
    {
        templateCode: 'OVERTIME_DIFF_JOB',
        templateName: 'Overtime GA Tanpa Kode Field YY',
        description: 'Overtime General Activity (EXPTYPE GA) kecuali kombinasi kode YY. Porting dari General_Work_Has_YY.sql.',
        queryText: `SELECT
  o.EMPID AS KaryawanID,
  o.ID AS OvertimeID,
  o.INPDATE AS TanggalOvertime,
  o.HOURS AS JamKerja,
  SUBSTRING(f.FIELDNO FROM 1 FOR 6) AS KodeField,
  (j.EXPTYPE || j.ITEMNO || j.SUBNO) AS AccCode,
  j.DESCRIPTION AS DeskripsiPekerjaan,
  o.BASICRATE AS TarifDasar,
  o.ADDRATE AS TarifTambahan,
  o.HOURS * o.BASICRATE AS NilaiDasar,
  o.HOURS * o.ADDRATE AS NilaiTambahan,
  a.VEHNO AS NomorKendaraan,
  a.MODEL AS ModelKendaraan
FROM OVERTIME o
JOIN JOBCODE j ON o.JOBID = j.ID
JOIN OCFIELD f ON o.FIELDID = f.ID
LEFT JOIN VEHCODE a ON o.VEHID = a.ID
WHERE o.INPDATE BETWEEN #START_DATE# AND #END_DATE#
  AND SUBSTRING(j.EXPTYPE FROM 1 FOR 2) = 'GA'
  AND NOT (
    j.EXPTYPE = 'GA' AND j.ITEMNO = '91' AND j.SUBNO = '10'
    AND SUBSTRING(f.FIELDNO FROM 1 FOR 2) = 'YY'
  )
ORDER BY o.EMPID, o.INPDATE`,
        defaultMaxRows: 1000,
        defaultTimeoutSeconds: 60,
        tags: ['payroll', 'overtime', 'validation'],
    },
    {
        templateCode: 'SCANNER_PREVIEW',
        templateName: 'Preview Scanner (GWSCANNERDATA07)',
        description: 'Preview 5 baris data scanner GWSCANNERDATA07.',
        queryText: 'SELECT FIRST 5 * FROM GWSCANNERDATA07',
        defaultMaxRows: 5,
        defaultTimeoutSeconds: 15,
        tags: ['scanner', 'preview'],
    },
    // ── Module templates: FFB (Fresh Fruit Bunch) panen ──
    {
        templateCode: 'FFB_DAILY',
        templateName: 'FFB Harian Panen (per bulan)',
        description: 'Total panen FFB per field per hari bulan #MONTH#. Join FFBSCANNERDATA + OCFIELD.',
        queryText: `SELECT s.TRANSDATE AS Tanggal,
  f.FIELDNO AS Field,
  SUM(s.RIPEBCH) AS RipeBunch,
  SUM(s.UNRIPEBCH) AS UnripeBunch,
  SUM(s.BLACKBCH) AS BlackBunch,
  SUM(s.LOOSEFRUIT) AS LooseFruit,
  COUNT(*) AS ScanCount
FROM FFBSCANNERDATA#MONTH# s
JOIN OCFIELD f ON s.FIELDID = f.ID
GROUP BY s.TRANSDATE, f.FIELDNO
ORDER BY s.TRANSDATE DESC`,
        defaultMaxRows: 500,
        defaultTimeoutSeconds: 60,
        tags: ['ffb', 'scanner', 'production', 'harvest'],
    },
    {
        templateCode: 'FFB_FIELD_SUMMARY',
        templateName: 'FFB Ringkasan per Field',
        description: 'Total panen FFB per field bulan #MONTH#.',
        queryText: `SELECT f.FIELDNO AS Field,
  SUM(s.RIPEBCH) AS TotalRipe,
  SUM(s.UNRIPEBCH) AS TotalUnripe,
  SUM(s.BLACKBCH) AS TotalBlack,
  COUNT(*) AS Transactions
FROM FFBSCANNERDATA#MONTH# s
JOIN OCFIELD f ON s.FIELDID = f.ID
GROUP BY f.FIELDNO
ORDER BY TotalRipe DESC`,
        defaultMaxRows: 200,
        defaultTimeoutSeconds: 60,
        tags: ['ffb', 'scanner', 'summary'],
    },
    // ── Gate Weighbridge (transport) ──
    {
        templateCode: 'GW_DAILY',
        templateName: 'Gate Weighbridge Harian',
        description: 'Transaksi gate weighbridge per hari bulan #MONTH#. Join VEHCODE + JOBCODE.',
        queryText: `SELECT s.TRANSDATE AS Tanggal,
  s.TRANSTIME AS Waktu,
  v.VEHNO AS NomorKendaraan,
  v.MODEL AS Model,
  j.DESCRIPTION AS Pekerjaan,
  s.TRANSNO AS TransNo,
  s.TRANSSTATUS AS Status
FROM GWSCANNERDATA#MONTH# s
LEFT JOIN VEHCODE v ON s.VEHICLECODEID = v.ID
LEFT JOIN JOBCODE j ON s.JOBCODEID = j.ID
ORDER BY s.TRANSDATE DESC, s.TRANSTIME DESC`,
        defaultMaxRows: 500,
        defaultTimeoutSeconds: 60,
        tags: ['gw', 'scanner', 'transport', 'weighbridge'],
    },
    {
        templateCode: 'GW_VEHICLE_SUMMARY',
        templateName: 'GW Ringkasan per Kendaraan',
        description: 'Jumlah transaksi per kendaraan bulan #MONTH#.',
        queryText: `SELECT v.VEHNO AS NomorKendaraan,
  v.MODEL AS Model,
  COUNT(*) AS TripCount,
  MAX(s.TRANSDATE) AS TripTerakhir
FROM GWSCANNERDATA#MONTH# s
LEFT JOIN VEHCODE v ON s.VEHICLECODEID = v.ID
GROUP BY v.VEHNO, v.MODEL
ORDER BY TripCount DESC`,
        defaultMaxRows: 200,
        defaultTimeoutSeconds: 60,
        tags: ['gw', 'scanner', 'transport', 'summary'],
    },
    // ── Rubber Tapping (RT) ──
    {
        templateCode: 'RT_DAILY',
        templateName: 'Rubber Tapping Harian',
        description: 'Hasil tapping karet per hari bulan #MONTH#. Join OCFIELD.',
        queryText: `SELECT s.TRANSDATE AS Tanggal,
  f.FIELDNO AS Field,
  SUM(s.TOTALLATEXWEIGHT) AS TotalLatex,
  SUM(s.SCRAPWT) AS ScrapWeight,
  SUM(s.DRYWEIGHT) AS DryWeight,
  COUNT(*) AS TapCount
FROM RTSCANNERDATA#MONTH# s
LEFT JOIN OCFIELD f ON s.FIELDID = f.ID
GROUP BY s.TRANSDATE, f.FIELDNO
ORDER BY s.TRANSDATE DESC`,
        defaultMaxRows: 500,
        defaultTimeoutSeconds: 60,
        tags: ['rt', 'scanner', 'rubber', 'tapping'],
    },
    // ── Overtime/Payroll ──
    {
        templateCode: 'OT_BY_EMPLOYEE',
        templateName: 'Overtime per Karyawan (periode)',
        description: 'Total overtime per karyawan periode #START_DATE# - #END_DATE#.',
        queryText: `SELECT e.EMPCODE AS NIP,
  e.NAME AS Nama,
  COUNT(*) AS HariOT,
  SUM(o.HOURS) AS TotalJam,
  SUM(o.HOURS * o.BASICRATE) AS NilaiBasic,
  SUM(o.HOURS * o.ADDRATE) AS NilaiAdd,
  SUM(o.HOURS * o.BASICRATE + o.HOURS * o.ADDRATE) AS TotalNilai
FROM OVERTIME o
JOIN EMP e ON o.EMPID = e.ID
WHERE o.INPDATE BETWEEN #START_DATE# AND #END_DATE#
GROUP BY e.EMPCODE, e.NAME
ORDER BY TotalNilai DESC`,
        defaultMaxRows: 500,
        defaultTimeoutSeconds: 60,
        tags: ['payroll', 'overtime', 'summary'],
    },
    // ── Employee/Worker master ──
    {
        templateCode: 'EMP_LIST',
        templateName: 'Daftar Karyawan',
        description: 'Daftar karyawan aktif per OC (estate). Join OC.',
        queryText: `SELECT e.EMPCODE AS NIP,
  e.NAME AS Nama,
  e.NRICNEW AS NRIC,
  o.CODE AS OCode,
  o.NAME AS Estate
FROM EMP e
LEFT JOIN OC o ON e.OCID = o.ID
ORDER BY e.NAME`,
        defaultMaxRows: 1000,
        defaultTimeoutSeconds: 30,
        tags: ['hr', 'employee', 'master'],
    },
    {
        templateCode: 'TABLE_PREVIEW',
        templateName: 'Preview Tabel (input nama)',
        description: 'Preview 50 baris tabel apa pun. Ganti #TABLE_NAME#.',
        queryText: 'SELECT FIRST 50 * FROM #TABLE_NAME#',
        defaultMaxRows: 50,
        defaultTimeoutSeconds: 30,
        tags: ['utility', 'preview'],
    },
    // ── Module: Absensi (kehadiran via scanner) ──
    {
        templateCode: 'ATTEND_DAILY',
        templateName: 'Absensi Harian (Gate Scanner)',
        description: 'Kehadiran karyawan per hari via GW scanner bulan #MONTH#. Join EMP.',
        queryText: `SELECT s.TRANSDATE AS Tanggal,
  e.EMPCODE AS NIP,
  e.NAME AS Nama,
  COUNT(*) AS ScanCount,
  MIN(s.TRANSTIME) AS JamMasuk,
  MAX(s.TRANSTIME) AS JamKeluar
FROM GWSCANNERDATA#MONTH# s
JOIN EMP e ON s.WORKEREMPID = e.ID
WHERE s.TRANSDATE >= '#YEAR#-#MONTH#-01' AND s.TRANSDATE <= '#YEAR#-#MONTH#-#LASTDAY#'
GROUP BY s.TRANSDATE, e.EMPCODE, e.NAME
ORDER BY s.TRANSDATE DESC, Nama`,
        defaultMaxRows: 1000,
        defaultTimeoutSeconds: 60,
        tags: ['attendance', 'absensi', 'daily'],
    },
    {
        templateCode: 'ATTEND_EMPLOYEE',
        templateName: 'Rekap Absensi per Karyawan',
        description: 'Total hari hadir per karyawan bulan #MONTH#.',
        queryText: `SELECT e.EMPCODE AS NIP,
  e.NAME AS Nama,
  COUNT(DISTINCT s.TRANSDATE) AS HariHadir,
  COUNT(*) AS TotalScan,
  MIN(s.TRANSDATE) AS HadirPertama,
  MAX(s.TRANSDATE) AS HadirTerakhir
FROM GWSCANNERDATA#MONTH# s
JOIN EMP e ON s.WORKEREMPID = e.ID
WHERE s.TRANSDATE >= '#YEAR#-#MONTH#-01' AND s.TRANSDATE <= '#YEAR#-#MONTH#-#LASTDAY#'
GROUP BY e.EMPCODE, e.NAME
ORDER BY HariHadir DESC`,
        defaultMaxRows: 500,
        defaultTimeoutSeconds: 60,
        tags: ['attendance', 'absensi', 'summary'],
    },
    {
        templateCode: 'ATTEND_FFB_WORKER',
        templateName: 'Kehadiran Pekerja Panen (FFB)',
        description: 'Pekerja yang scan FFB per hari bulan #MONTH#.',
        queryText: `SELECT s.TRANSDATE AS Tanggal,
  e.EMPCODE AS NIP,
  e.NAME AS Nama,
  COUNT(*) AS ScanPanen,
  SUM(s.RIPEBCH) AS RipeBunch
FROM FFBSCANNERDATA#MONTH# s
JOIN EMP e ON s.WORKERID = e.ID
WHERE s.TRANSDATE >= '#YEAR#-#MONTH#-01' AND s.TRANSDATE <= '#YEAR#-#MONTH#-#LASTDAY#'
GROUP BY s.TRANSDATE, e.EMPCODE, e.NAME
ORDER BY s.TRANSDATE DESC`,
        defaultMaxRows: 1000,
        defaultTimeoutSeconds: 60,
        tags: ['attendance', 'ffb', 'worker'],
    },
    {
        templateCode: 'ATTEND_MISSING',
        templateName: 'Karyawan Tidak Hadir (bulan)',
        description: 'Karyawan tanpa scan bulan #MONTH# (potensi absen).',
        queryText: `SELECT e.EMPCODE AS NIP,
  e.NAME AS Nama,
  o.NAME AS Estate
FROM EMP e
LEFT JOIN OC o ON e.OCID = o.ID
WHERE NOT EXISTS (
  SELECT 1 FROM GWSCANNERDATA#MONTH# s
  WHERE s.WORKEREMPID = e.ID
    AND s.TRANSDATE >= '#YEAR#-#MONTH#-01' AND s.TRANSDATE <= '#YEAR#-#MONTH#-#LASTDAY#'
)
ORDER BY Nama`,
        defaultMaxRows: 500,
        defaultTimeoutSeconds: 60,
        tags: ['attendance', 'absensi', 'missing'],
    },
    // ── A. DASHBOARD EKSEKUTIF ──
    {
        templateCode: 'EXEC_KPI',
        templateName: 'KPI Eksekutif Bulan #MONTH#',
        description: 'Ringkasan: total FFB, loosefruit (brondolan), karyawan, trip kendaraan. Estate kelapa sawit: RT/latex tidak berlaku (RTSCANNERDATA kosong).',
        queryText: `SELECT
  (SELECT SUM(COALESCE(RIPEBCH,0)+COALESCE(UNRIPEBCH,0)+COALESCE(BLACKBCH,0)) FROM FFBSCANNERDATA#MONTH#) AS TOTAL_FFB,
  (SELECT SUM(COALESCE(LOOSEFRUIT2,0)) FROM FFBSCANNERDATA#MONTH#) AS TOTAL_LOOSEFRUIT,
  (SELECT COUNT(*) FROM EMP) AS TOTAL_EMP,
  (SELECT COUNT(*) FROM GWSCANNERDATA#MONTH#) AS TOTAL_TRIPS,
  0 AS TOTAL_LATEX
FROM RDB$DATABASE`,
        defaultMaxRows: 1,
        defaultTimeoutSeconds: 60,
        tags: ['executive', 'dashboard', 'kpi'],
    },
    {
        templateCode: 'EXEC_ESTATE_CONTRIB',
        templateName: 'Kontribusi Produksi per Estate',
        description: 'FFB bunches + loosefruit per estate bulan #MONTH#.',
        queryText: `SELECT FIRST 50
  oc.CODE AS Estate, oc.NAME AS NamaEstate,
  COUNT(DISTINCT s.SCANUSERID) AS Pemanen,
  SUM(COALESCE(s.RIPEBCH,0)+COALESCE(s.UNRIPEBCH,0)+COALESCE(s.BLACKBCH,0)) AS FFB_Bunches,
  SUM(COALESCE(s.LOOSEFRUIT,0)) AS Loosefruit
FROM FFBSCANNERDATA#MONTH# s
JOIN OCFIELD f ON s.FIELDID = f.ID
JOIN OC ON f.OCID = OC.ID
GROUP BY oc.CODE, oc.NAME
ORDER BY FFB_Bunches DESC`,
        defaultMaxRows: 50,
        defaultTimeoutSeconds: 60,
        tags: ['executive', 'estate', 'ffb'],
    },
    // ── B. PRODUKSI FFB ──
    {
        templateCode: 'FFB_PER_FIELD',
        templateName: 'Produksi FFB per Field',
        description: 'Panen FFB per field + estate bulan #MONTH#.',
        queryText: `SELECT FIRST 200
  oc.CODE AS Estate, f.FIELDNO AS Field,
  COUNT(*) AS ScanRecords, COUNT(DISTINCT s.SCANUSERID) AS Pemanen,
  SUM(COALESCE(s.RIPEBCH,0)) AS Ripe, SUM(COALESCE(s.UNRIPEBCH,0)) AS Unripe,
  SUM(COALESCE(s.BLACKBCH,0)) AS Black, SUM(COALESCE(s.LOOSEFRUIT,0)) AS Loosefruit,
  SUM(COALESCE(s.RIPEBCH,0)+COALESCE(s.UNRIPEBCH,0)+COALESCE(s.BLACKBCH,0)) AS TotalBunches
FROM FFBSCANNERDATA#MONTH# s
JOIN OCFIELD f ON s.FIELDID = f.ID
JOIN OC ON f.OCID = OC.ID
GROUP BY oc.CODE, f.FIELDNO
ORDER BY TotalBunches DESC`,
        defaultMaxRows: 200,
        defaultTimeoutSeconds: 60,
        tags: ['ffb', 'production', 'field'],
    },
    {
        templateCode: 'FFB_TOP_HARVESTER',
        templateName: 'Top Pemanen FFB',
        description: 'Produktivitas pemanen FFB bulan #MONTH#.',
        queryText: `SELECT FIRST 50
  e.EMPCODE AS NIP, e.NAME AS Nama, oc.CODE AS Estate,
  COUNT(*) AS Scans, COUNT(DISTINCT s.TRANSDATE) AS HariKerja,
  SUM(COALESCE(s.RIPEBCH,0)+COALESCE(s.UNRIPEBCH,0)+COALESCE(s.BLACKBCH,0)) AS Bunches,
  SUM(COALESCE(s.LOOSEFRUIT,0)) AS Loosefruit
FROM FFBSCANNERDATA#MONTH# s
JOIN EMP e ON s.SCANUSERID = e.ID
JOIN OCFIELD f ON s.FIELDID = f.ID
JOIN OC ON f.OCID = OC.ID
GROUP BY e.EMPCODE, e.NAME, oc.CODE
ORDER BY Bunches DESC`,
        defaultMaxRows: 50,
        defaultTimeoutSeconds: 60,
        tags: ['ffb', 'production', 'worker'],
    },
    // ── C. GATE WEIGHBRIDGE ──
    {
        templateCode: 'GW_VEHICLE_UTIL',
        templateName: 'Utilisasi Kendaraan Gate',
        description: 'Trip + active days per kendaraan bulan #MONTH#.',
        queryText: `SELECT FIRST 100
  v.VEHNO AS NoKendaraan, v.MODEL AS Model,
  COUNT(*) AS TotalTrip, COUNT(DISTINCT g.TRANSDATE) AS HariAktif,
  COUNT(DISTINCT g.OCFIELDID) AS FieldDilayani,
  COUNT(DISTINCT g.WORKEREMPID) AS PekerjaDiantar
FROM GWSCANNERDATA#MONTH# g
LEFT JOIN VEHCODE v ON g.VEHICLECODEID = v.ID
GROUP BY v.VEHNO, v.MODEL
ORDER BY TotalTrip DESC`,
        defaultMaxRows: 100,
        defaultTimeoutSeconds: 60,
        tags: ['gw', 'transport', 'vehicle'],
    },
    {
        templateCode: 'GW_DAILY_THROUGHPUT',
        templateName: 'Throughput Gate Harian',
        description: 'Trip + kendaraan + pekerja per hari bulan #MONTH#.',
        queryText: `SELECT
  g.TRANSDATE AS Tanggal, COUNT(*) AS Trip,
  COUNT(DISTINCT g.VEHICLECODEID) AS Kendaraan,
  COUNT(DISTINCT g.WORKEREMPID) AS Pekerja,
  MIN(g.TRANSTIME) AS ScanPertama, MAX(g.SCANOUTTIME) AS ScanTerakhir
FROM GWSCANNERDATA#MONTH# g
GROUP BY g.TRANSDATE
ORDER BY g.TRANSDATE DESC`,
        defaultMaxRows: 31,
        defaultTimeoutSeconds: 60,
        tags: ['gw', 'transport', 'daily'],
    },
    // ── D. RUBBER TAPPING ──
    {
        templateCode: 'RT_FIELD_YIELD',
        templateName: 'Yield Lateks per Field',
        description: 'Total latex + DRC + scrap per field bulan #MONTH#.',
        queryText: `SELECT FIRST 200
  oc.CODE AS Estate, f.FIELDNO AS Field,
  COUNT(DISTINCT r.WORKERID) AS Tapper,
  SUM(COALESCE(r.TOTALLATEXWEIGHT,0)) AS LatexKg,
  SUM(COALESCE(r.SCRAPWT,0)) AS ScrapKg,
  SUM(COALESCE(r.DRYWEIGHT,0)) AS DryKg,
  AVG((COALESCE(r.DRC1,0)+COALESCE(r.DRC2,0)+COALESCE(r.DRC3,0)+COALESCE(r.DRC4,0)+COALESCE(r.DRC5,0))/5.0) AS AvgDRC
FROM RTSCANNERDATA#MONTH# r
JOIN OCFIELD f ON r.FIELDID = f.ID
JOIN OC ON f.OCID = OC.ID
GROUP BY oc.CODE, f.FIELDNO
ORDER BY LatexKg DESC`,
        defaultMaxRows: 200,
        defaultTimeoutSeconds: 60,
        tags: ['rt', 'rubber', 'yield'],
    },
    {
        templateCode: 'RT_TOP_TAPPER',
        templateName: 'Top Tapper Karet',
        description: 'Produktivitas tapper bulan #MONTH#.',
        queryText: `SELECT FIRST 50
  e.EMPCODE AS NIP, e.NAME AS Nama, oc.CODE AS Estate,
  COUNT(DISTINCT r.TRANSDATE) AS HariKerja,
  SUM(COALESCE(r.TOTALLATEXWEIGHT,0)) AS LatexKg,
  SUM(COALESCE(r.SCRAPWT,0)) AS ScrapKg,
  AVG((COALESCE(r.DRC1,0)+COALESCE(r.DRC2,0)+COALESCE(r.DRC3,0)+COALESCE(r.DRC4,0)+COALESCE(r.DRC5,0))/5.0) AS AvgDRC
FROM RTSCANNERDATA#MONTH# r
JOIN EMP e ON r.WORKERID = e.ID
JOIN OCFIELD f ON r.FIELDID = f.ID
JOIN OC ON f.OCID = OC.ID
GROUP BY e.EMPCODE, e.NAME, oc.CODE
ORDER BY LatexKg DESC`,
        defaultMaxRows: 50,
        defaultTimeoutSeconds: 60,
        tags: ['rt', 'rubber', 'worker'],
    },
    // ── E. ABSENSI (union scanner) ──
    {
        templateCode: 'ATTEND_DAILY_UNION',
        templateName: 'Absensi Harian (Union Scanner)',
        description: 'Kehadiran harian gabungan FFB+GW+RT bulan #MONTH#.',
        queryText: `SELECT d.THEDATE AS Tanggal,
  (SELECT COUNT(*) FROM EMP
   WHERE ID NOT IN (SELECT EMPID FROM RESIGNED)
     AND ID NOT IN (SELECT EMPID FROM RETIRE)) AS ActiveEmp,
  (SELECT COUNT(DISTINCT empid FROM (
     SELECT SCANUSERID AS empid FROM FFBSCANNERDATA#MONTH# WHERE SCANUSERID IS NOT NULL
     UNION
     SELECT WORKEREMPID AS empid FROM GWSCANNERDATA#MONTH# WHERE WORKEREMPID IS NOT NULL
     UNION
     SELECT WORKERID AS empid FROM RTSCANNERDATA#MONTH# WHERE WORKERID IS NOT NULL
   )) AS PresentToday
FROM (SELECT DISTINCT TRANSDATE AS THEDATE FROM FFBSCANNERDATA#MONTH#) d
ORDER BY d.THEDATE DESC`,
        defaultMaxRows: 31,
        defaultTimeoutSeconds: 90,
        tags: ['attendance', 'absensi', 'daily', 'union'],
    },
    {
        templateCode: 'ATTEND_RATE_ESTATE',
        templateName: 'Rate Kehadiran per Estate',
        description: 'Karyawan aktif vs hadir per estate bulan #MONTH#.',
        queryText: `SELECT
  oc.CODE AS Estate, oc.NAME AS NamaEstate,
  COUNT(DISTINCT e.ID) AS ActiveEmp,
  COUNT(DISTINCT s.SCANUSERID) AS HadirFFB,
  COUNT(DISTINCT g.WORKEREMPID) AS HadirGate,
  COUNT(DISTINCT r.WORKERID) AS HadirRT
FROM EMP e
JOIN OC ON e.OCID = OC.ID
LEFT JOIN FFBSCANNERDATA#MONTH# s ON s.SCANUSERID = e.ID
LEFT JOIN GWSCANNERDATA#MONTH# g ON g.WORKEREMPID = e.ID
LEFT JOIN RTSCANNERDATA#MONTH# r ON r.WORKERID = e.ID
WHERE e.ID NOT IN (SELECT EMPID FROM RESIGNED) AND e.ID NOT IN (SELECT EMPID FROM RETIRE)
GROUP BY oc.CODE, oc.NAME
ORDER BY Estate`,
        defaultMaxRows: 50,
        defaultTimeoutSeconds: 90,
        tags: ['attendance', 'absensi', 'estate'],
    },
    // ── F. PAYROLL/OVERTIME ──
    {
        templateCode: 'OT_COST_EMPLOYEE',
        templateName: 'Biaya Overtime per Karyawan',
        description: 'OT hours + cost per karyawan periode #START_DATE# - #END_DATE#.',
        queryText: `SELECT FIRST 50
  e.EMPCODE AS NIP, e.NAME AS Nama, oc.CODE AS Estate, j.DESCRIPTION AS Pekerjaan,
  SUM(o.HOURS) AS JamOT,
  SUM(o.HOURS * o.BASICRATE) AS BasicRM,
  SUM(o.HOURS * o.ADDRATE) AS AddRM,
  SUM(o.HOURS * (o.BASICRATE + o.ADDRATE)) AS TotalOTRM
FROM OVERTIME o
JOIN EMP e ON o.EMPID = e.ID
JOIN JOBCODE j ON o.JOBID = j.ID
JOIN OC ON e.OCID = OC.ID
WHERE o.INPDATE BETWEEN #START_DATE# AND #END_DATE#
GROUP BY e.EMPCODE, e.NAME, oc.CODE, j.DESCRIPTION
ORDER BY 8 DESC`,
        defaultMaxRows: 50,
        defaultTimeoutSeconds: 60,
        tags: ['payroll', 'overtime', 'cost'],
    },
    {
        templateCode: 'OT_VALIDATION',
        templateName: 'Validasi Data Overtime',
        description: 'OT dengan field/vehicle/job kosong/invalid periode #START_DATE# - #END_DATE#.',
        queryText: `SELECT o.INPDATE AS Tanggal, e.EMPCODE AS NIP, e.NAME AS Nama,
  CASE
    WHEN o.VEHID IS NULL THEN 'MISSING VEHICLE'
    WHEN o.VEHID NOT IN (SELECT ID FROM VEHCODE) THEN 'INVALID VEHICLE'
    WHEN o.FIELDID IS NULL THEN 'MISSING FIELD'
    WHEN o.FIELDID NOT IN (SELECT ID FROM OCFIELD) THEN 'INVALID FIELD'
    WHEN o.JOBID IS NULL THEN 'MISSING JOB'
    WHEN o.JOBID NOT IN (SELECT ID FROM JOBCODE) THEN 'INVALID JOB'
  END AS Masalah,
  o.HOURS, o.BASICRATE, o.ADDRATE
FROM OVERTIME o
JOIN EMP e ON o.EMPID = e.ID
WHERE o.INPDATE BETWEEN #START_DATE# AND #END_DATE#
  AND (o.VEHID IS NULL OR o.VEHID NOT IN (SELECT ID FROM VEHCODE)
       OR o.FIELDID IS NULL OR o.FIELDID NOT IN (SELECT ID FROM OCFIELD)
       OR o.JOBID IS NULL OR o.JOBID NOT IN (SELECT ID FROM JOBCODE))
ORDER BY o.INPDATE DESC`,
        defaultMaxRows: 200,
        defaultTimeoutSeconds: 60,
        tags: ['payroll', 'overtime', 'validation'],
    },
];

function seedDefaultTemplates() {
    if (!Array.isArray(cache.queryTemplates) || cache.queryTemplates.length > 0) return;
    const now = getServerTime();
    cache.queryTemplates = DEFAULT_QUERY_TEMPLATES.map(t => ({
        ...t,
        enabled: true,
        createdBy: 'system-seed',
        createdAt: now,
        updatedAt: now,
    }));
    saveAll();
}

function loadAll() {
    cache.clients = readJsonFile(FILES.clients, []);
    cache.configs = readJsonFile(FILES.configs, {});
    cache.commands = readJsonFile(FILES.commands, []);
    cache.moduleStatuses = readJsonFile(FILES.moduleStatuses, []);
    cache.heartbeatLogs = readJsonFile(FILES.heartbeatLogs, []);
    cache.clientGroups = readJsonFile(FILES.clientGroups, []);
    cache.auditLogs = readJsonFile(FILES.auditLogs, []);
    cache.queryBatches = readJsonFile(FILES.queryBatches, []);
    cache.queryJobs = readJsonFile(FILES.queryJobs, []);
    cache.queryResults = readJsonFile(FILES.queryResults, []);
    cache.queryResultChunks = readJsonFile(FILES.queryResultChunks, []);
    cache.queryTemplates = readJsonFile(FILES.queryTemplates, []);
    cache.syncJobs = readJsonFile(FILES.syncJobs, []);
    cache.syncDivisions = readJsonFile(FILES.syncDivisions, []);
    seedDefaultTemplates();
}

function saveAll() {
    writeJsonFile(FILES.clients, cache.clients);
    writeJsonFile(FILES.configs, cache.configs);
    writeJsonFile(FILES.commands, cache.commands);
    writeJsonFile(FILES.moduleStatuses, cache.moduleStatuses);
    writeJsonFile(FILES.heartbeatLogs, cache.heartbeatLogs);
    writeJsonFile(FILES.clientGroups, cache.clientGroups);
    writeJsonFile(FILES.auditLogs, cache.auditLogs);
    writeJsonFile(FILES.queryBatches, cache.queryBatches);
    writeJsonFile(FILES.queryJobs, cache.queryJobs);
    writeJsonFile(FILES.queryResults, cache.queryResults);
    writeJsonFile(FILES.queryResultChunks, cache.queryResultChunks);
    writeJsonFile(FILES.queryTemplates, cache.queryTemplates);
    writeJsonFile(FILES.syncJobs, cache.syncJobs);
}

// Save only specific files — avoids writing all 12 large JSON files on every mutation
const FILE_KEY_MAP = {
    clients: 'clients', configs: 'configs', commands: 'commands',
    moduleStatuses: 'moduleStatuses', heartbeatLogs: 'heartbeatLogs',
    clientGroups: 'clientGroups', auditLogs: 'auditLogs',
    queryBatches: 'queryBatches', queryJobs: 'queryJobs',
    queryResults: 'queryResults', queryResultChunks: 'queryResultChunks',
    queryTemplates: 'queryTemplates', syncJobs: 'syncJobs'
};
function saveDirty(keys) {
    for (const k of keys) {
        if (FILE_KEY_MAP[k]) writeJsonFile(FILES[FILE_KEY_MAP[k]], cache[k]);
    }
}

// Initialize on module load
loadAll();

// ============================================
// ENUMS (mirroring .NET enums)
// ============================================

const ClientStatus = {
    Online: 'Online',
    Offline: 'Offline',
    Error: 'Error'
};

const ModuleRuntimeStatus = {
    Stopped: 'Stopped',
    Running: 'Running',
    Error: 'Error',
    Unknown: 'Unknown'
};

const CommandType = {
    StartModule: 'StartModule',
    StopModule: 'StopModule',
    RestartModule: 'RestartModule',
    UpdateConfig: 'UpdateConfig',
    ShutdownApp: 'ShutdownApp',
    RestartApp: 'RestartApp'
};

const CommandStatus = {
    Pending: 'Pending',
    Received: 'Received',
    Executing: 'Executing',
    Completed: 'Completed',
    Failed: 'Failed',
    Expired: 'Expired',
    Cancelled: 'Cancelled'
};

const ScheduleMode = {
    AlwaysOn: 'AlwaysOn',
    Scheduled: 'Scheduled',
    Manual: 'Manual'
};

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Generate a unique ID
 */
function generateId() {
    return crypto.randomUUID();
}

/**
 * Get current server time as ISO string
 */
function getServerTime() {
    return new Date().toISOString();
}

/**
 * Register a new client or update existing client
 */
function registerClient(request) {
    loadAll();

    const now = getServerTime();
    const existingIndex = cache.clients.findIndex(c => c.clientId === request.clientId);

    let configVersion = 1;

    if (existingIndex >= 0) {
        // Update existing client
        const existing = cache.clients[existingIndex];
        configVersion = existing.configVersion || 1;

        // Check if config needs update
        const clientConfig = cache.configs[request.clientId];
        if (clientConfig) {
            configVersion = clientConfig.configVersion;
        }

        cache.clients[existingIndex] = {
            ...existing,
            clientName: request.clientName || existing.clientName,
            machineName: request.machineName,
            environment: request.environment,
            appVersion: request.appVersion,
            os: request.os,
            status: ClientStatus.Online,
            lastHeartbeatAt: now,
            updatedAt: now
        };
    } else {
        // Create new client
        const newClient = {
            clientId: request.clientId,
            clientName: request.clientName || request.clientId,
            machineName: request.machineName,
            environment: request.environment,
            appVersion: request.appVersion,
            os: request.os,
            status: ClientStatus.Online,
            lastHeartbeatAt: now,
            uptimeSeconds: 0,
            createdAt: now,
            updatedAt: now
        };
        cache.clients.push(newClient);

        // Create default config for new client
        cache.configs[request.clientId] = {
            clientId: request.clientId,
            configVersion: 1,
            updatedAt: now,
            appPolicy: {
                allowRun: true,
                allowModuleAutoStart: true,
                shutdownWhenServerDisabled: false,
                safeModeWhenServerOffline: false
            },
            modules: [],
            isActive: true
        };
    }

    saveDirty(['clients']);

    return {
        success: true,
        serverTime: now,
        configVersion: configVersion
    };
}

/**
 * Get all registered clients
 */
function listClients() {
    loadAll();
    return cache.clients.map(client => ({
        clientId: client.clientId,
        clientName: client.clientName,
        machineName: client.machineName,
        environment: client.environment,
        appVersion: client.appVersion,
        os: client.os,
        status: client.status,
        lastHeartbeatAt: client.lastHeartbeatAt,
        uptimeSeconds: client.uptimeSeconds,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt
    }));
}

/**
 * Get a specific client by ID
 */
function getClient(clientId) {
    loadAll();
    return cache.clients.find(c => c.clientId === clientId) || null;
}

/**
 * Get client configuration
 */
function getClientConfig(clientId) {
    loadAll();
    return cache.configs[clientId] || null;
}

/**
 * Update client configuration
 */
function updateClientConfig(clientId, config) {
    loadAll();

    if (!cache.configs[clientId]) {
        return { success: false, error: 'Client not found' };
    }

    const now = getServerTime();
    const existingVersion = cache.configs[clientId].configVersion || 1;

    cache.configs[clientId] = {
        clientId: clientId,
        configVersion: existingVersion + 1,
        updatedAt: now,
        appPolicy: config.appPolicy || cache.configs[clientId].appPolicy,
        modules: config.modules || cache.configs[clientId].modules,
        isActive: config.isActive !== undefined ? config.isActive : cache.configs[clientId].isActive
    };

    saveAll();

    return {
        success: true,
        configVersion: cache.configs[clientId].configVersion,
        updatedAt: now
    };
}

/**
 * Receive heartbeat from client
 */
function receiveHeartbeat(clientId, request) {
    loadAll();

    const now = getServerTime();
    const clientIndex = cache.clients.findIndex(c => c.clientId === clientId);

    if (clientIndex < 0) {
        return { success: false, error: 'Client not registered' };
    }

    // Update client status
    cache.clients[clientIndex].status = request.status || ClientStatus.Online;
    cache.clients[clientIndex].lastHeartbeatAt = now;
    cache.clients[clientIndex].uptimeSeconds = request.uptimeSeconds || 0;
    cache.clients[clientIndex].updatedAt = now;

    // Log heartbeat
    cache.heartbeatLogs.push({
        clientId: clientId,
        status: request.status || ClientStatus.Online,
        uptimeSeconds: request.uptimeSeconds || 0,
        modules: request.modules || [],
        createdAt: now
    });

    // Keep only last 1000 heartbeat logs
    if (cache.heartbeatLogs.length > 1000) {
        cache.heartbeatLogs = cache.heartbeatLogs.slice(-1000);
    }

    // Check for pending commands
    const pendingCommands = cache.commands.filter(
        cmd => cmd.clientId === clientId && cmd.status === CommandStatus.Pending
    );

    // Get latest config version
    const config = cache.configs[clientId];
    const latestConfigVersion = config ? config.configVersion : 1;

    saveDirty(['clients', 'heartbeatLogs']);

    return {
        success: true,
        serverTime: now,
        hasPendingCommand: pendingCommands.length > 0,
        latestConfigVersion: latestConfigVersion
    };
}

/**
 * Report module status from client
 */
function reportModuleStatus(clientId, request) {
    loadAll();

    const now = getServerTime();
    const statuses = request.modules || [];

    // Remove existing statuses for this client
    cache.moduleStatuses = cache.moduleStatuses.filter(ms => ms.clientId !== clientId);

    // Add new statuses
    for (const status of statuses) {
        cache.moduleStatuses.push({
            clientId: clientId,
            moduleCode: status.moduleCode,
            status: status.status,
            pid: status.pid,
            restartCount: status.restartCount || 0,
            lastStartedAt: status.lastStartedAt,
            lastStoppedAt: status.lastStoppedAt,
            lastError: status.lastError,
            updatedAt: now
        });
    }

    saveDirty(['moduleStatuses']);

    return { success: true };
}

/**
 * List module statuses for a client or all clients
 */
function listModuleStatuses(clientId = null) {
    loadAll();

    if (clientId) {
        return cache.moduleStatuses.filter(ms => ms.clientId === clientId);
    }

    return cache.moduleStatuses;
}

/**
 * Create a command for a client
 */
function createCommand(clientId, request) {
    loadAll();

    const now = getServerTime();
    const commandId = generateId();

    const command = {
        commandId: commandId,
        clientId: clientId,
        commandType: request.commandType,
        moduleCode: request.moduleCode,
        payload: request.payload || {},
        status: CommandStatus.Pending,
        message: null,
        createdAt: now,
        receivedAt: null,
        executedAt: null,
        expiresAt: request.expiresAt || null
    };

    cache.commands.push(command);
    saveDirty(['commands']);

    return {
        commandId: commandId,
        clientId: clientId,
        commandType: request.commandType,
        moduleCode: request.moduleCode,
        payload: request.payload,
        status: CommandStatus.Pending,
        createdAt: now,
        expiresAt: request.expiresAt
    };
}

/**
 * Poll pending commands for a client
 */
function pollPendingCommands(clientId) {
    loadAll();

    const now = new Date().toISOString();

    // Get pending commands and mark them as received
    const pendingCommands = cache.commands.filter(
        cmd => cmd.clientId === clientId && cmd.status === CommandStatus.Pending
    );

    for (const cmd of pendingCommands) {
        // Check if expired
        if (cmd.expiresAt && new Date(cmd.expiresAt) < new Date(now)) {
            cmd.status = CommandStatus.Expired;
        } else {
            cmd.status = CommandStatus.Received;
            cmd.receivedAt = now;
            cmd.claimedBy = clientId; // who claimed it — for the stale-command reaper
        }
    }

    saveDirty(['commands']);

    return pendingCommands.filter(
        cmd => cmd.status === CommandStatus.Received
    );
}

/**
 * Report command result from client
 */
function reportCommandResult(clientId, commandId, request) {
    loadAll();

    const now = getServerTime();
    const cmdIndex = cache.commands.findIndex(
        cmd => cmd.commandId === commandId && cmd.clientId === clientId
    );

    if (cmdIndex < 0) {
        return { success: false, error: 'Command not found' };
    }

    cache.commands[cmdIndex].status = request.status;
    cache.commands[cmdIndex].message = request.message;
    cache.commands[cmdIndex].executedAt = request.executedAt || now;

    saveDirty(['commands']);

    return { success: true };
}

/**
 * List commands with optional filters
 */
function listCommands(clientId = null, status = null) {
    loadAll();

    let filtered = cache.commands;

    if (clientId) {
        filtered = filtered.filter(cmd => cmd.clientId === clientId);
    }

    if (status) {
        filtered = filtered.filter(cmd => cmd.status === status);
    }

    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get dashboard summary
 */
function getDashboardSummary() {
    loadAll();

    const onlineClients = cache.clients.filter(c => c.status === ClientStatus.Online);
    const offlineClients = cache.clients.filter(c => c.status === ClientStatus.Offline);
    const errorClients = cache.clients.filter(c => c.status === ClientStatus.Error);

    const runningModules = cache.moduleStatuses.filter(ms => ms.status === ModuleRuntimeStatus.Running);
    const failedModules = cache.moduleStatuses.filter(ms => ms.status === ModuleRuntimeStatus.Error);

    const pendingCommands = cache.commands.filter(cmd => cmd.status === CommandStatus.Pending);

    // Find last heartbeat time
    const sortedLogs = [...cache.heartbeatLogs].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const lastHeartbeatAt = sortedLogs.length > 0 ? sortedLogs[0].createdAt : null;

    return {
        totalClients: cache.clients.length,
        onlineClients: onlineClients.length,
        offlineClients: offlineClients.length + errorClients.length,
        totalModulesRunning: runningModules.length,
        totalModulesFailed: failedModules.length,
        totalPendingCommands: pendingCommands.length,
        lastHeartbeatAt: lastHeartbeatAt
    };
}

/**
 * Get server info for client discovery
 * Returns the server URL and configuration that clients should use
 */
function getServerInfo() {
    const serverHost = process.env.IFESS_SERVER_HOST || 'localhost';
    const serverPort = process.env.IFESS_SERVER_PORT || '3001';
    const serverProtocol = process.env.IFESS_SERVER_PROTOCOL || 'http';

    // Determine the base URL based on environment
    let baseUrl;
    if (process.env.IFESS_BASE_URL) {
        baseUrl = process.env.IFESS_BASE_URL;
    } else {
        baseUrl = `${serverProtocol}://${serverHost}:${serverPort}`;
    }

    return {
        serverUrl: baseUrl,
        serverHost: serverHost,
        serverPort: parseInt(serverPort),
        serverProtocol: serverProtocol,
        apiBase: `${baseUrl}/api/ifess`,
        healthEndpoint: `${baseUrl}/api/ifess/health`,
        registerEndpoint: `${baseUrl}/api/ifess/clients/register`,
        heartbeatEndpoint: `${baseUrl}/api/ifess/clients`,
        commandsEndpoint: `${baseUrl}/api/ifess/commands`,
        serverTime: getServerTime(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    };
}

// ============================================
// AUDIT LOG
// ============================================

function createAuditLog({ actorId, actorName, action, objectType, objectId, beforeValue, afterValue, ipAddress, userAgent, status = 'Success' }) {
    loadAll();

    const entry = {
        auditId: generateId(),
        actorId: actorId || 'system',
        actorName: actorName || 'system',
        action,
        objectType: objectType || 'Unknown',
        objectId: objectId || null,
        beforeValue: beforeValue || null,
        afterValue: afterValue || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        status,
        timestamp: getServerTime()
    };

    cache.auditLogs.push(entry);

    // Keep only last 5000 audit log entries
    if (cache.auditLogs.length > 5000) {
        cache.auditLogs = cache.auditLogs.slice(-5000);
    }

    saveAll();
    return entry;
}

function listAuditLogs(filters = {}) {
    loadAll();

    let filtered = [...cache.auditLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (filters.objectType) {
        filtered = filtered.filter(entry => entry.objectType === filters.objectType);
    }

    if (filters.objectId) {
        filtered = filtered.filter(entry => entry.objectId === filters.objectId);
    }

    if (filters.action) {
        filtered = filtered.filter(entry => entry.action === filters.action);
    }

    if (filters.actorId) {
        filtered = filtered.filter(entry => entry.actorId === filters.actorId);
    }

    return filtered;
}

// ============================================
// CLIENT GROUPS
// ============================================

function createClientGroup({ groupCode, groupName, description }) {
    loadAll();

    if (!groupCode) {
        return { success: false, error: 'groupCode is required' };
    }

    const existingIndex = cache.clientGroups.findIndex(g => g.groupCode === groupCode);
    if (existingIndex >= 0) {
        return { success: false, error: `Group '${groupCode}' already exists` };
    }

    const group = {
        groupCode,
        groupName: groupName || groupCode,
        description: description || null,
        createdAt: getServerTime()
    };

    cache.clientGroups.push(group);
    saveAll();

    return { success: true, group };
}

function listClientGroups() {
    loadAll();
    return cache.clientGroups;
}

function getClientGroup(groupCode) {
    loadAll();
    return cache.clientGroups.find(g => g.groupCode === groupCode) || null;
}

function updateClientGroup(groupCode, { groupName, description }) {
    loadAll();

    const groupIndex = cache.clientGroups.findIndex(g => g.groupCode === groupCode);
    if (groupIndex < 0) {
        return { success: false, error: 'Group not found' };
    }

    cache.clientGroups[groupIndex] = {
        ...cache.clientGroups[groupIndex],
        groupName: groupName || cache.clientGroups[groupIndex].groupName,
        description: description !== undefined ? description : cache.clientGroups[groupIndex].description
    };

    saveAll();
    return { success: true, group: cache.clientGroups[groupIndex] };
}

function deleteClientGroup(groupCode) {
    loadAll();

    const groupIndex = cache.clientGroups.findIndex(g => g.groupCode === groupCode);
    if (groupIndex < 0) {
        return { success: false, error: 'Group not found' };
    }

    cache.clientGroups.splice(groupIndex, 1);
    saveAll();
    return { success: true };
}

function addClientToGroup(groupCode, clientId) {
    loadAll();

    const group = cache.clientGroups.find(g => g.groupCode === groupCode);
    if (!group) {
        return { success: false, error: 'Group not found' };
    }

    if (!group.clients) {
        group.clients = [];
    }

    if (!group.clients.includes(clientId)) {
        group.clients.push(clientId);
        saveAll();
    }

    return { success: true, group };
}

function removeClientFromGroup(groupCode, clientId) {
    loadAll();

    const group = cache.clientGroups.find(g => g.groupCode === groupCode);
    if (!group || !group.clients) {
        return { success: false, error: 'Group not found' };
    }

    group.clients = group.clients.filter(id => id !== clientId);
    saveAll();

    return { success: true, group };
}

// ============================================
// QUERY GATEWAY
// ============================================

const QueryStatus = {
    Pending: 'Pending',
    Dispatched: 'Dispatched',
    Running: 'Running',
    Success: 'Success',
    Failed: 'Failed',
    Cancelled: 'Cancelled',
    Expired: 'Expired'
};

const TargetMode = {
    SingleClient: 'SingleClient',
    MultipleClients: 'MultipleClients',
    AllClients: 'AllClients',
    ClientGroup: 'ClientGroup'
};

const QueryBatchStatus = {
    Pending: 'Pending',
    Running: 'Running',
    Completed: 'Completed',
    Failed: 'Failed',
    PartialSuccess: 'PartialSuccess',
    Cancelled: 'Cancelled'
};

function isReadOnlySql(queryText) {
    if (!queryText || typeof queryText !== 'string') {
        return { valid: false, errors: ['Query text is required'] };
    }

    // Normalize: remove leading/trailing whitespace and collapse spaces
    const normalized = queryText.trim().replace(/\s+/g, ' ').toUpperCase();

    // Must start with SELECT or WITH ... SELECT
    const trimmed = normalized.trim();
    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
        return { valid: false, errors: ['Query must start with SELECT or WITH ... SELECT'] };
    }


    // Strip string literals so keywords inside strings (e.g. LIKE '%DROP%') are not flagged
    const stripped = normalized
        .replace(/'[^']*'/g, "''")
        .replace(/"[^"]*"/g, '""');

    // Remove SQL-keyword column names from SELECT lists to avoid false positives
    // e.g. "SELECT UPDATE FROM EMP" — UPDATE is a column name between SELECT and FROM
    const selectMatch = stripped.match(/\bSELECT\s+(.*?)\s+FROM\b/i);
    let scanTarget = stripped;
    if (selectMatch) {
        const selectList = selectMatch[1];
        const cleanedList = selectList.replace(/\b(UPDATE|INSERT|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|EXEC|COMMIT|ROLLBACK|SAVEPOINT)\b/g, ' COLNAME ');
        scanTarget = stripped.replace(selectList, cleanedList);
    }
    // Deny dangerous keywords/patterns
    const forbiddenPatterns = [
        /\bINSERT\b/, /\bUPDATE\b/, /\bDELETE\b/, /\bDROP\b/, /\bALTER\b/, /\bCREATE\b/,
        /\bTRUNCATE\b/, /\bGRANT\b/, /\bREVOKE\b/, /\bEXECUTE\b/, /\bEXEC\b/, /\bCOMMIT\b/, /\bROLLBACK\b/,
        /\bSAVEPOINT\b/, /;\s*\S/, /;\s*$/
    ];

    const errors = [];
    for (const pattern of forbiddenPatterns) {
        if (pattern.test(scanTarget)) {
            errors.push(`Query contains forbidden pattern: ${pattern.toString()}`);
        }
    }

    // Reject multiple statements by semicolon
    if (normalized.includes(';')) {
        errors.push('Multiple SQL statements are not allowed');
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return { valid: true, errors: [] };
}

function resolveQueryTargets({ targetMode, targetClientIds, targetGroup, clients }) {
    switch (targetMode) {
        case TargetMode.SingleClient:
            return targetClientIds && targetClientIds.length > 0 ? [targetClientIds[0]] : [];
        case TargetMode.MultipleClients:
            return targetClientIds || [];
        case TargetMode.AllClients:
            return clients.map(c => c.clientId);
        case TargetMode.ClientGroup:
            if (!targetGroup) return [];
            const group = cache.clientGroups.find(g => g.groupCode === targetGroup);
            return group && group.clients ? group.clients : [];
        default:
            return [];
    }
}

function createQueryBatch({ queryName, queryText, targetMode, targetClientIds, targetGroup, maxRows, timeoutSeconds, requestedBy }) {
    loadAll();

    const validation = isReadOnlySql(queryText);
    if (!validation.valid) {
        return { success: false, error: validation.errors.join('; ') };
    }

    const targetClientIdsResolved = resolveQueryTargets({ targetMode, targetClientIds, targetGroup, clients: cache.clients });

    if (targetClientIdsResolved.length === 0) {
        return { success: false, error: 'No target clients resolved' };
    }

    const now = getServerTime();
    const batchId = `QB-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const batch = {
        queryBatchId: batchId,
        queryName: queryName || 'Ad-hoc Query',
        queryText,
        targetMode,
        targetGroup: targetGroup || null,
        requestedBy: requestedBy || 'system',
        maxRows: maxRows || 1000,
        timeoutSeconds: timeoutSeconds || 30,
        status: QueryBatchStatus.Pending,
        totalTarget: targetClientIdsResolved.length,
        successCount: 0,
        failedCount: 0,
        rejectedCount: 0,
        timeoutCount: 0,
        createdAt: now,
        completedAt: null
    };

    cache.queryBatches.push(batch);

    // Create a query job for each target client
    for (const clientId of targetClientIdsResolved) {
        const jobId = `QJ-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        cache.queryJobs.push({
            queryJobId: jobId,
            queryBatchId: batchId,
            targetClientId: clientId,
            moduleCode: 'IFESS_QUERY_GATEWAY',
            commandId: null,
            status: QueryStatus.Pending,
            rowCount: 0,
            isTruncated: false,
            executionTimeMs: null,
            errorMessage: null,
            sentAt: null,
            receivedAt: null,
            startedAt: null,
            finishedAt: null,
            createdAt: now
        });
    }

    // Persist batch + jobs BEFORE creating commands — createCommand() reloads
    // cache from disk via loadAll(), which would wipe the unsaved batch otherwise.
    saveDirty(['queryBatches', 'queryJobs']);

    // Create commands inline (avoid createCommand's per-iteration loadAll+save overhead)
    const jobCommandMap = {};
    for (const job of cache.queryJobs.filter(j => j.queryBatchId === batchId)) {
        const cmdId = generateId();
        cache.commands.push({
            commandId: cmdId,
            clientId: job.targetClientId,
            commandType: 'EXECUTE_FIREBIRD_QUERY',
            moduleCode: 'IFESS_QUERY_GATEWAY',
            payload: {
                protocolVersion: '1.0',
                queryBatchId: batchId,
                queryJobId: job.queryJobId,
                queryText,
                parameters: [],
                maxRows: batch.maxRows,
                timeoutSeconds: batch.timeoutSeconds,
                readOnly: true,
                resultMode: 'Inline',
                chunkSize: 500
            },
            status: CommandStatus.Pending,
            message: null,
            createdAt: now,
            receivedAt: null,
            executedAt: null,
            expiresAt: null
        });
        job.commandId = cmdId;
        jobCommandMap[job.queryJobId] = cmdId;
    }

    // Persist batch (running) + jobs (with commandId) + commands in one write
    const batchRef = cache.queryBatches.find(b => b.queryBatchId === batchId);
    if (batchRef) batchRef.status = QueryBatchStatus.Running;
    saveDirty(['queryBatches', 'queryJobs', 'commands']);

    // (no reload needed — cache is already authoritative)

    return {
        success: true,
        queryBatchId: batchId,
        status: batch.status,
        targetCount: targetClientIdsResolved.length
    };
}

function getQueryBatch(batchId) {
    loadAll();

    const batch = cache.queryBatches.find(b => b.queryBatchId === batchId);
    if (!batch) {
        return null;
    }

    const jobs = cache.queryJobs.filter(j => j.queryBatchId === batchId);
    const results = cache.queryResults.filter(r => r.queryBatchId === batchId);

    return {
        ...batch,
        jobs,
        results
    };
}

function storeQueryJobResult({ queryJobId, clientId, headers, rows, rowCount, isTruncated, executionTimeMs, status, errorMessage }) {
    loadAll();

    const job = cache.queryJobs.find(j => j.queryJobId === queryJobId && j.targetClientId === clientId);
    if (!job) {
        return { success: false, error: 'Query job not found' };
    }

    job.status = status === 'Success' ? QueryStatus.Success : QueryStatus.Failed;
    job.rowCount = rowCount || 0;
    job.isTruncated = isTruncated || false;
    job.executionTimeMs = executionTimeMs || null;
    job.errorMessage = errorMessage || null;
    job.finishedAt = getServerTime();

    // Store inline result
    const existingResultIndex = cache.queryResults.findIndex(r => r.queryJobId === queryJobId);
    const result = {
        queryJobId,
        queryBatchId: job.queryBatchId,
        clientId,
        headers: headers || [],
        rows: rows || [],
        rowCount: rowCount || 0,
        isTruncated: isTruncated || false,
        createdAt: getServerTime()
    };

    if (existingResultIndex >= 0) {
        cache.queryResults[existingResultIndex] = result;
    } else {
        cache.queryResults.push(result);
    }

    updateBatchSummary(job.queryBatchId);

    saveAll();
    return { success: true, job };
}

function storeQueryResultChunk({ queryJobId, clientId, chunkIndex, headers, rows, isLastChunk }) {
    loadAll();

    const chunk = {
        queryJobId,
        clientId,
        chunkIndex,
        headers: headers || [],
        rows: rows || [],
        isLastChunk: isLastChunk || false,
        createdAt: getServerTime()
    };

    cache.queryResultChunks.push(chunk);

    if (isLastChunk) {
        // Assemble all chunks for this job
        const allChunks = cache.queryResultChunks
            .filter(c => c.queryJobId === queryJobId)
            .sort((a, b) => a.chunkIndex - b.chunkIndex);

        const assembledRows = allChunks.flatMap(c => c.rows || []);
        const headers = allChunks.length > 0 ? allChunks[0].headers : [];

        const job = cache.queryJobs.find(j => j.queryJobId === queryJobId);
        if (job) {
            job.status = QueryStatus.Success;
            job.finishedAt = getServerTime();
            updateBatchSummary(job.queryBatchId);
        }

        const existingResultIndex = cache.queryResults.findIndex(r => r.queryJobId === queryJobId);
        const result = {
            queryJobId,
            queryBatchId: job ? job.queryBatchId : null,
            clientId,
            headers,
            rows: assembledRows,
            rowCount: assembledRows.length,
            isTruncated: false,
            createdAt: getServerTime()
        };

        if (existingResultIndex >= 0) {
            cache.queryResults[existingResultIndex] = result;
        } else {
            cache.queryResults.push(result);
        }
    }

    saveDirty(['queryResults', 'queryJobs', 'queryBatches', 'commands']);
    return { success: true };
}

function updateBatchSummary(batchId) {
    const batch = cache.queryBatches.find(b => b.queryBatchId === batchId);
    if (!batch) return;

    const jobs = cache.queryJobs.filter(j => j.queryBatchId === batchId);
    batch.successCount = jobs.filter(j => j.status === QueryStatus.Success).length;
    batch.failedCount = jobs.filter(j => j.status === QueryStatus.Failed).length;
    batch.rejectedCount = jobs.filter(j => j.status === QueryStatus.Cancelled).length;
    batch.timeoutCount = jobs.filter(j => j.status === QueryStatus.Expired).length;

    const total = jobs.length;
    const completed = batch.successCount + batch.failedCount + batch.rejectedCount + batch.timeoutCount;

    if (completed >= total) {
        batch.completedAt = getServerTime();
        if (batch.failedCount === total) {
            batch.status = QueryBatchStatus.Failed;
        } else if (batch.successCount === total) {
            batch.status = QueryBatchStatus.Completed;
        } else {
            batch.status = QueryBatchStatus.PartialSuccess;
        }
    }
}

function listQueryBatches() {
    loadAll();
    return cache.queryBatches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}


function listQueryTemplates() {
    loadAll();
    return cache.queryTemplates;
}

function createQueryTemplate({ templateCode, templateName, description, queryText, defaultMaxRows, defaultTimeoutSeconds, tags, createdBy }) {
    loadAll();

    if (!templateCode) {
        return { success: false, error: 'templateCode is required' };
    }

    const existingIndex = cache.queryTemplates.findIndex(t => t.templateCode === templateCode);
    if (existingIndex >= 0) {
        return { success: false, error: `Template '${templateCode}' already exists` };
    }

    const now = getServerTime();
    const template = {
        templateCode,
        templateName: templateName || templateCode,
        description: description || null,
        queryText,
        defaultMaxRows: defaultMaxRows || 1000,
        defaultTimeoutSeconds: defaultTimeoutSeconds || 30,
        tags: tags || [],
        enabled: true,
        createdBy: createdBy || 'system',
        createdAt: now,
        updatedAt: now
    };

    cache.queryTemplates.push(template);
    saveAll();

    return { success: true, template };
}

function updateQueryTemplate(templateCode, updates) {
    loadAll();

    const index = cache.queryTemplates.findIndex(t => t.templateCode === templateCode);
    if (index < 0) {
        return { success: false, error: 'Template not found' };
    }

    cache.queryTemplates[index] = {
        ...cache.queryTemplates[index],
        ...updates,
        updatedAt: getServerTime()
    };

    saveAll();
    return { success: true, template: cache.queryTemplates[index] };
}

function deleteQueryTemplate(templateCode) {
    loadAll();

    const index = cache.queryTemplates.findIndex(t => t.templateCode === templateCode);
    if (index < 0) {
        return { success: false, error: 'Template not found' };
    }

    cache.queryTemplates.splice(index, 1);
    saveAll();
    return { success: true };
}

// ============================================
// FIREBIRD → SQL SYNC SERVICE
// Live incremental sync: client extracts rows since watermark → POSTs chunks →
// server loads to rebinmas_ifess_migrated (via Next.js /api/ifess/sync). The gateway
// owns job state (JSON); the Next.js route owns the SQL write + watermark advance.
// ============================================

function listSyncDivisions() {
    loadAll();
    return cache.syncDivisions || [];
}

// Resolve a division code to its registry entry (code, name, fdbPath).
function resolveDivision(divisionCode) {
    loadAll();
    return (cache.syncDivisions || []).find(d => d.code === divisionCode) || null;
}

// Create a sync job (state machine). The actual EXECUTE_FB_SYNC command is created by
// the gateway route (createCommand), this just tracks the job envelope.
function createSyncJob({ clientId, divisionCode, mode, tables, requestedBy }) {
    loadAll();
    const now = getServerTime();
    const jobId = `SJ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const job = {
        syncJobId: jobId,
        clientId,
        divisionCode,
        mode: mode || 'incremental', // bootstrap | incremental
        tables: tables || [],
        status: 'pending',
        rowsLoaded: 0,
        chunksReceived: 0,
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
        requestedBy: requestedBy || 'system',
        createdAt: now
    };
    cache.syncJobs.push(job);
    saveDirty(['syncJobs']);
    return { success: true, syncJobId: jobId, status: job.status };
}

function getSyncJob(jobId) {
    loadAll();
    return cache.syncJobs.find(j => j.syncJobId === jobId) || null;
}

function listSyncJobs(limit = 50) {
    loadAll();
    return cache.syncJobs.slice(-limit).reverse();
}

// Mark a sync job's lifecycle (running/success/failed). Called by the Next.js route
// on first chunk (running) and last chunk (success), or on error.
function updateSyncJob(jobId, patch) {
    loadAll();
    const job = cache.syncJobs.find(j => j.syncJobId === jobId);
    if (!job) return null;
    if (patch.status) job.status = patch.status;
    if (patch.rowsLoaded != null) job.rowsLoaded = patch.rowsLoaded;
    if (patch.chunksReceived != null) job.chunksReceived = patch.chunksReceived;
    if (patch.startedAt) job.startedAt = patch.startedAt;
    if (patch.finishedAt) job.finishedAt = patch.finishedAt;
    if (patch.errorMessage != null) job.errorMessage = patch.errorMessage;
    saveDirty(['syncJobs']);
    return job;
}

// ============================================
// STALE-COMMAND REAPER
// A client that polls a command (→ Received) but crashes before reporting a result leaves
// the command stuck forever. This marks Received commands older than the timeout as Failed
// so the dispatcher/UI isn't blocked, and fails any linked query job.
// ============================================
function reapStaleCommands(timeoutSeconds = 120) {
    loadAll();
    const now = Date.now();
    const cutoff = timeoutSeconds * 1000;
    let reaped = 0;
    for (const cmd of cache.commands) {
        if (cmd.status !== CommandStatus.Received || !cmd.receivedAt) continue;
        if (now - new Date(cmd.receivedAt).getTime() > cutoff) {
            cmd.status = CommandStatus.Failed;
            cmd.executedAt = new Date().toISOString();
            cmd.message = 'client timeout (reaped)';
            reaped++;
            // fail linked query job (EXECUTE_FIREBIRD_QUERY carries queryJobId in payload)
            const job = cache.queryJobs.find(j => j.commandId === cmd.commandId);
            if (job) {
                job.status = QueryStatus.Failed;
                job.errorMessage = 'client timeout (reaped)';
                job.finishedAt = new Date().toISOString();
            }
        }
    }
    if (reaped > 0) saveDirty(['commands', 'queryJobs']);
    return { reaped };
}

// ============================================

// EXPORTS
// ============================================

module.exports = {
    // Enums
    ClientStatus,
    ModuleRuntimeStatus,
    CommandType,
    CommandStatus,
    ScheduleMode,

    // Service functions
    registerClient,
    listClients,
    getClient,
    getClientConfig,
    updateClientConfig,
    receiveHeartbeat,
    reportModuleStatus,
    listModuleStatuses,
    createCommand,
    pollPendingCommands,
    reportCommandResult,
    listCommands,
    getDashboardSummary,
    getServerInfo,

    // Firebird → SQL sync
    listSyncDivisions,
    resolveDivision,
    createSyncJob,
    getSyncJob,
    listSyncJobs,
    updateSyncJob,

    // Stuck-command reaper
    reapStaleCommands,

    // Audit log
    createAuditLog,
    listAuditLogs,

    // Client groups
    createClientGroup,
    listClientGroups,
    getClientGroup,
    updateClientGroup,
    deleteClientGroup,
    addClientToGroup,
    removeClientFromGroup,

    // Query Gateway
    isReadOnlySql,
    createQueryBatch,
    getQueryBatch,
    storeQueryJobResult,
    storeQueryResultChunk,
    listQueryBatches,
    listQueryTemplates,
    createQueryTemplate,
    updateQueryTemplate,
    deleteQueryTemplate,

    // Utilities
    generateId,
    getServerTime,
    loadAll,
    saveAll
};
