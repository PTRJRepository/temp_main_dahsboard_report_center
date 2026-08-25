/**
 * @module backend/src/services/payroll/extract/extractQueries.ts
 * @purpose DB-query free functions for payroll extraction (employees, attendance, premi/potongan, lembur, tunjangan, brondol, task codes).
 * @input Database, gangCondition strings, empCodes string[], date strings, month/year numbers, serverProfile strings, DocDesc strings.
 * @output Promise maps: EmployeeRow[], attendance/cuti/premi/potongan/lembur/tunjangan/brondol/taskCode records; normalized premi/potongan keys.
 * @depends ../../../db/client#Database, ../../../config#Config, ../adtransDocDescMapping, ../extractors/leaveRules, ../gangService, ../lemburCalculator, ../harvesterService, ../employeeHrDataService, ../divisionDefinition, ../currentPeriodService
 * @sideeffect Reads DB via SQL Gateway (POST {DB_API_URL}/v1/query); no writes.
 * @tests backend/src/services/dataExtractorService.manualAdjustmentMetadata.test.ts (indirect via facade), _dev_utils/baseline golden
 */

import { Database } from "../../../db/client";
import { ADTRANS_DYNAMIC_PREMI_PATTERNS, mapAdtransPremiField, normalizeAdtransPotonganField } from "../adtransDocDescMapping";
import { Config } from "../../../config";
import { buildLeaveSqlExpressions } from "../extractors/leaveRules";
import { lemburCalculator } from "../../lemburCalculator";
import { harvesterService } from "../../harvesterService";
import { employeeHrDataService } from "../../employeeHrDataService";
import { divisionDefinition } from "../../divisionDefinition";
import { currentPeriodService } from "../../currentPeriodService";
import { warn } from "../../../utils/logger";


export interface EmployeeRow {
    emp_code: string;
    emp_name: string;
    gender: string;
    loc_code: string;
    gang_code: string;
    gang_desc?: string;
    pay_rate: number;
    beras_rate: number;
    join_date: string | null;
    actual_nik?: string;
    pajak_npwp?: string;
    jabatan?: string;
    pot_premi_pph?: number;
    res_address?: string;
    hr_emp_type?: string;
    [key: string]: any;
}

export interface CutiData {
    cuti_tahunan: number;
    cuti_sakit_haid: number;
    cuti_minggu: number;
    cuti_nasional: number;
}

export interface LemburData {
    jam: number;
    jumlah: number;
}

export interface LemburRecord {
    trx_date: string;
    task_code: string;
    task_desc: string;
    day_type: string;
    hours: number;
    rate: number;
    amount: number;
    record_count?: number;
    meta?: any;
}

export interface LemburDataWithDetails extends LemburData {
    records: LemburRecord[];
}


export async function getEmployeesFallbackLive(db: Database, gangCondition: string, serverProfile?: string): Promise<EmployeeRow[]> {
        console.log('[DataExtractor] Using fallback live table query for employees...');
        const resolvedDb = serverProfile ? Database.getInstance(undefined, serverProfile) : db;
        
        try {
            const rows = await resolvedDb.query<any>(`
                SELECT 
                    emp_code, actual_nik, emp_name, gender, loc_code, 
                    gang_code, gang_desc, pay_rate, beras_rate, 
                    join_date, res_address, alamat, hr_emp_type
                FROM (
                    SELECT 
                        RTRIM(e.EmpCode) as emp_code,
                        ISNULL(NULLIF(RTRIM(e.NewICNo), ''), RTRIM(e.EmpCode)) as actual_nik,
                        e.EmpName as emp_name,
                        e.Gender as gender,
                        RTRIM(e.LocCode) as loc_code,
                        RTRIM(gl.GangCode) as gang_code,
                        RTRIM(g.Description) as gang_desc,
                        COALESCE(p.PayRate, 0) as pay_rate,
                        CASE
                            WHEN UPPER(CAST(p.RiceRationCode AS VARCHAR)) = 'BERASBHL' THEN 0
                            ELSE COALESCE(p.RiceRation, 0)
                        END as beras_rate,
                        em.AppJoinGrpDate as join_date,
                        e.ResAddress as res_address,
                        e.ResAddress as alamat,
                        e.HREmpType as hr_emp_type,
                        ROW_NUMBER() OVER(PARTITION BY e.EmpCode ORDER BY e.EmpCode DESC) as rn -- Basic dedup
                    FROM HR_EMPLOYEE e
                    INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
                    LEFT JOIN HR_GANG g ON gl.GangCode = g.GangCode
                    LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
                    LEFT JOIN HR_EMPLOYMENT em ON RTRIM(em.EmpCode) = RTRIM(e.EmpCode)
                    WHERE ${gangCondition}
                      AND e.Status = 1
                ) t
                WHERE rn = 1
                ORDER BY emp_code
            `);
            
            console.log(`[DataExtractor] Fallback query returned ${rows.length} employees`);
            return rows;
        } catch (error: any) {
            console.error(`[DataExtractor] Fallback employee query failed: ${error.message}`);
            throw new Error(`Failed to fetch employee data (both historical and live): ${error.message}`);
        }
    }

export async function getEmployees(db: Database, gangCondition: string, month: number, year: number, serverProfile?: string, isHistorical: boolean = false, gangCodeInput: string | null = null): Promise<EmployeeRow[]> {
        const resolvedDb = serverProfile ? Database.getInstance(undefined, serverProfile) : db;
        console.log(`[DataExtractor.getEmployees] isHistorical=${isHistorical}, gangCondition=${gangCondition}`);


        let rows: any[];

        if (isHistorical) {
            // For historical data, use PR_GANGLN_ARC with AccMonth/AccYear filtering
            let accMonth: number;
            let accYear: number;

            const { accMonth: calculatedAccMonth, accYear: calculatedAccYear } = currentPeriodService.calendarToAccMonth(month, year);
            accMonth = calculatedAccMonth;
            accYear = calculatedAccYear;



            // For historical path: g = PR_GANG (has GangID, Description, no GangCode)
            // Override gangCondition if gangCodeInput is provided
            let historicalCondition = gangCondition;
            if (gangCodeInput && gangCodeInput !== 'ALL') {
                historicalCondition = `(UPPER(RTRIM(g.GangID)) = '${gangCodeInput}' OR UPPER(RTRIM(g.Description)) = '${gangCodeInput}')`;
            } else {
                // Historical tables (PR_GANG) use GangID, and PR_GANGLN doesn't have GangCode column
                historicalCondition = gangCondition.replace(/(gl|g)\.GangCode/ig, 'g.GangID');
            }

            // PR_GANGLN_ARC uses EmpCode column and MasterID to join with PR_GANG
            try {
                // Strict historical query with LEFT JOIN and COALESCE fallback
                rows = await resolvedDb.query<any>(`
                    SELECT 
                        emp_code, actual_nik, emp_name, gender, loc_code, 
                        gang_code, gang_desc, pay_rate, beras_rate, 
                        join_date, res_address, alamat, hr_emp_type
                    FROM (
                        SELECT 
                            RTRIM(e.EmpCode) as emp_code,
                            e.NewICNo as actual_nik,
                            e.EmpName as emp_name,
                            e.Gender as gender,
                            RTRIM(e.LocCode) as loc_code,
                            COALESCE(RTRIM(g.GangID), RTRIM(g.Description), CAST(gl.MasterID AS VARCHAR)) as gang_code,
                            COALESCE(RTRIM(g.Description), CAST(gl.MasterID AS VARCHAR)) as gang_desc,
                            COALESCE(p.PayRate, 0) as pay_rate,
                            CASE
                                WHEN UPPER(CAST(p.RiceRationCode AS VARCHAR)) = 'BERASBHL' THEN 0
                                ELSE COALESCE(p.RiceRation, 0)
                            END as beras_rate,
                            em.AppJoinGrpDate as join_date,
                            e.ResAddress as res_address,
                            e.ResAddress as alamat,
                            e.HREmpType as hr_emp_type,
                            ROW_NUMBER() OVER(PARTITION BY e.EmpCode ORDER BY e.EmpCode DESC) as rn
                        FROM HR_EMPLOYEE e
                        INNER JOIN PR_GANGLN_ARC gl ON RTRIM(gl.EmpCode) = RTRIM(e.EmpCode)
                            AND gl.AccMonth = ?
                            AND gl.AccYear = ?
                        LEFT JOIN PR_GANG g ON g.ID = gl.MasterID
                        LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
                        LEFT JOIN HR_EMPLOYMENT em ON RTRIM(em.EmpCode) = RTRIM(e.EmpCode)
                        WHERE ${historicalCondition}
                    ) t
                    WHERE rn = 1
                    ORDER BY emp_code
                `, [accMonth, accYear]);

                console.log(`[DataExtractor] Historical query for ${accMonth}/${accYear} returned ${rows.length} rows`);
                
                // [FALLBACK] Try relaxed historical search if strict month/year search yields 0 rows
                if (rows.length === 0) {
                    console.log(`[DataExtractor] Strict historical query returned no data. Attempting relaxed historical query...`);
                    rows = await resolvedDb.query<any>(`
                        SELECT 
                            emp_code, actual_nik, emp_name, gender, loc_code, 
                            gang_code, gang_desc, pay_rate, beras_rate, 
                            join_date, res_address, hr_emp_type
                        FROM (
                            SELECT 
                                RTRIM(e.EmpCode) as emp_code,
                                e.NewICNo as actual_nik,
                                e.EmpName as emp_name,
                                e.Gender as gender,
                                RTRIM(e.LocCode) as loc_code,
                                COALESCE(RTRIM(g.GangID), RTRIM(g.Description), CAST(gl.MasterID AS VARCHAR)) as gang_code,
                                COALESCE(RTRIM(g.Description), CAST(gl.MasterID AS VARCHAR)) as gang_desc,
                                COALESCE(p.PayRate, 0) as pay_rate,
                                CASE
                                    WHEN UPPER(CAST(p.RiceRationCode AS VARCHAR)) = 'BERASBHL' THEN 0
                                    ELSE COALESCE(p.RiceRation, 0)
                                END as beras_rate,
                                em.AppJoinGrpDate as join_date,
                                e.ResAddress as res_address,
                                e.HREmpType as hr_emp_type,
                                ROW_NUMBER() OVER(PARTITION BY e.EmpCode ORDER BY gl.AccYear DESC, gl.AccMonth DESC) as rn
                            FROM HR_EMPLOYEE e
                            INNER JOIN PR_GANGLN_ARC gl ON RTRIM(gl.EmpCode) = RTRIM(e.EmpCode)
                            LEFT JOIN PR_GANG g ON g.ID = gl.MasterID
                            LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
                            LEFT JOIN HR_EMPLOYMENT em ON RTRIM(em.EmpCode) = RTRIM(e.EmpCode)
                            WHERE ${historicalCondition}
                        ) t
                        WHERE rn = 1
                        ORDER BY emp_code
                    `);
                    console.log(`[DataExtractor] Relaxed historical query returned ${rows.length} rows`);
                }

                // [FALLBACK] If historical query still returns no data, fallback to live tables
                if (rows.length === 0) {
                    console.log(`[DataExtractor] Historical query returned no data. Falling back to live tables for ${month}/${year}...`);
                    return await getEmployeesFallbackLive(resolvedDb, gangCondition, serverProfile);
                }
            } catch (error: any) {
                console.warn(`[DataExtractor] Historical employee query failed: ${error.message}. Falling back to live tables...`);
                // [FALLBACK] On error, fallback to live tables
                return await getEmployeesFallbackLive(resolvedDb, gangCondition, serverProfile);
            }
        } else {
            // For current/future data, use HR_GANGLN (current active data)
             try {
                rows = await resolvedDb.query<any>(`
                    SELECT 
                        RTRIM(e.EmpCode) as emp_code,
                        ISNULL(NULLIF(RTRIM(e.NewICNo), ''), RTRIM(e.EmpCode)) as actual_nik,
                        e.EmpName as emp_name,
                        e.Gender as gender,
                        RTRIM(e.LocCode) as loc_code,
                        RTRIM(gl.GangCode) as gang_code,
                        RTRIM(g.Description) as gang_desc,
                        COALESCE(p.PayRate, 0) as pay_rate,
                        CASE
                            WHEN UPPER(CAST(p.RiceRationCode AS VARCHAR)) = 'BERASBHL' THEN 0
                            ELSE COALESCE(p.RiceRation, 0)
                        END as beras_rate,
                        em.AppJoinGrpDate as join_date,
                        e.ResAddress as res_address,
                        e.HREmpType as hr_emp_type
                    FROM HR_EMPLOYEE e
                    INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
                    LEFT JOIN HR_GANG g ON gl.GangCode = g.GangCode
                    LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
                    LEFT JOIN HR_EMPLOYMENT em ON RTRIM(em.EmpCode) = RTRIM(e.EmpCode)
                    WHERE ${gangCondition}
                      AND e.Status = 1
                    ORDER BY emp_code
                `);

                console.log(`[DataExtractor] Live active query returned ${rows.length} rows`);
            } catch (error: any) {
                console.error(`[DataExtractor] Current employee query failed: ${error.message}`);
                throw new Error(`Failed to fetch employee data: ${error.message}`);
            }

            // [FALLBACK] If no data in base table (HR_GANGLN) for current period,
            // try ARC table (PR_GANGLN_ARC) as fallback - data may have been archived
            // This happens when a gang like PERCOBAAN is deleted from live but we are requesting a month
            // that is still technically 'current' according to the server flags.
            if (rows && rows.length === 0) {
                console.log(`[DataExtractor] Live query returned 0 rows. Attempting ARC fallback for ${month}/${year}...`);
                const { accMonth: fallbackAccMonth, accYear: fallbackAccYear } = currentPeriodService.calendarToAccMonth(month, year);

                // Build ARC-compatible gang condition (PR_GANG uses GangID/Description, not GangCode)
                let arcCondition = gangCondition;
                if (gangCodeInput && gangCodeInput !== 'ALL') {
                    arcCondition = `(UPPER(RTRIM(g.GangID)) = '${gangCodeInput}' OR UPPER(RTRIM(g.Description)) = '${gangCodeInput}')`;
                }

                try {
                    rows = await resolvedDb.query<any>(`
                        SELECT DISTINCT
                            RTRIM(e.EmpCode) as emp_code,
                            e.NewICNo as actual_nik,
                            e.EmpName as emp_name,
                            e.Gender as gender,
                            RTRIM(e.LocCode) as loc_code,
                            COALESCE(RTRIM(g.GangID), RTRIM(g.Description)) as gang_code,
                            RTRIM(g.Description) as gang_desc,
                            COALESCE(p.PayRate, 0) as pay_rate,
                            CASE 
                                WHEN UPPER(CAST(p.RiceRationCode AS VARCHAR)) = 'BERASBHL' THEN 0
                                ELSE COALESCE(p.RiceRation, 0)
                            END as beras_rate,
                            em.AppJoinGrpDate as join_date,
                            e.ResAddress as res_address,
                            e.HREmpType as hr_emp_type
                        FROM HR_EMPLOYEE e
                        INNER JOIN PR_GANGLN_ARC gl ON RTRIM(gl.EmpCode) = RTRIM(e.EmpCode)
                            AND gl.AccMonth = ?
                            AND gl.AccYear = ?
                        INNER JOIN PR_GANG g ON g.ID = gl.MasterID
                        LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
                        LEFT JOIN HR_EMPLOYMENT em ON RTRIM(em.EmpCode) = RTRIM(e.EmpCode)
                        WHERE ${arcCondition}
                        ORDER BY emp_code
                    `, [fallbackAccMonth, fallbackAccYear]);

                    if (rows.length === 0) {
                        console.log(`[DataExtractor] Strict ARC Fallback: no data found for ${month}/${year}. Attempting relaxed fallback...`);
                        rows = await resolvedDb.query<any>(`
                            SELECT 
                                emp_code, actual_nik, emp_name, gender, loc_code, 
                                gang_code, gang_desc, pay_rate, beras_rate, 
                                join_date, res_address, hr_emp_type
                            FROM (
                                SELECT 
                                    RTRIM(e.EmpCode) as emp_code,
                                    e.NewICNo as actual_nik,
                                    e.EmpName as emp_name,
                                    e.Gender as gender,
                                    RTRIM(e.LocCode) as loc_code,
                                    COALESCE(RTRIM(g.GangID), RTRIM(g.Description)) as gang_code,
                                    RTRIM(g.Description) as gang_desc,
                                    COALESCE(p.PayRate, 0) as pay_rate,
                                    CASE 
                                        WHEN UPPER(CAST(p.RiceRationCode AS VARCHAR)) = 'BERASBHL' THEN 0
                                        ELSE COALESCE(p.RiceRation, 0)
                                    END as beras_rate,
                                    em.AppJoinGrpDate as join_date,
                                    e.ResAddress as res_address,
                                    e.HREmpType as hr_emp_type,
                                    ROW_NUMBER() OVER(PARTITION BY e.EmpCode ORDER BY gl.AccYear DESC, gl.AccMonth DESC) as rn
                                FROM HR_EMPLOYEE e
                                INNER JOIN PR_GANGLN_ARC gl ON RTRIM(gl.EmpCode) = RTRIM(e.EmpCode)
                                INNER JOIN PR_GANG g ON g.ID = gl.MasterID
                                LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
                                LEFT JOIN HR_EMPLOYMENT em ON RTRIM(em.EmpCode) = RTRIM(e.EmpCode)
                                WHERE ${arcCondition}
                            ) t
                            WHERE rn = 1
                            ORDER BY emp_code
                        `);
                        console.log(`[DataExtractor] Relaxed ARC Fallback retrieved ${rows.length} rows`);
                    } else {
                        console.log(`[DataExtractor] Strict ARC Fallback retrieved ${rows.length} rows`);
                    }
                } catch (error: any) {
                    console.error(`[DataExtractor] ARC Fallback employee query failed: ${error.message}`);
                }
            }
            
            // [DE-DUPLICATION] Latest Wins logic for append-insert handling
            const employeeMap = new Map<string, any>();
            if (rows && rows.length > 0) {
                for (const r of rows) {
                    const key = r.emp_code;
                    if (key) {
                        // The last one in the database result set wins
                        employeeMap.set(key, r);
                    }
                }
            }
            // Overwrite rows with de-duplicated rows
            rows = Array.from(employeeMap.values());
            console.log(`[DataExtractor] De-duplicated results to ${rows.length} unique employees`);
        }

        // Fetch HR data overrides (e.g. NIK KTP)
        const empCodes = rows.map((r: any) => r.emp_code?.trim()).filter(Boolean);
        const hrDataMap = await employeeHrDataService.getHrDataBulk(empCodes);

        return rows.map((r: any) => {
            const rawGangCode = r.gang_code?.trim() || "";
            const rawLocCode = r.loc_code?.trim() || "";
            const rawDesc = r.gang_desc?.trim() || "";
            
            // Resolve display LocCode (checks for virtual divisions like NRS, INF, etc.)
            const resolvedLocCode = divisionDefinition.getVirtualDivisionForGang(rawGangCode, rawLocCode, rawDesc) || rawLocCode;

            const empCodeClean = r.emp_code?.trim().toUpperCase() || "";
            const hrOverride = hrDataMap.get(empCodeClean);

            // If there's an override for NIK, use it. Otherwise use NewICNo, otherwise use EmpCode
            const finalNik = hrOverride?.nik_ktp?.trim() || r.actual_nik?.trim() || r.emp_code?.trim() || "";
            const finalNpwp = hrOverride?.npwp?.trim() || "";

            return {
                emp_code: r.emp_code?.trim() || "",
                actual_nik: finalNik,
                pajak_npwp: finalNpwp,
                emp_name: r.emp_name?.trim() || "",
                gender: String(r.gender || "1"),
                loc_code: resolvedLocCode,
                gang_code: rawGangCode, // Return exact fetched code
                gang_desc: rawDesc, // Gang Description (e.g. "HARVESTING A.KUNYAL (PERCOBAAN)") — for percobaan-gang PTKP gating
                pay_rate: r.pay_rate || 0,
                beras_rate: r.beras_rate || 0,
                join_date: r.join_date || null,
                res_address: r.res_address?.trim() || "",
                hr_emp_type: r.hr_emp_type?.trim() || "",
                jabatan: "" // Jabatan will be resolved from employee_estate/positionHistory later
            };
        });
    }

export async function getAttendance(db: Database, empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, {
        hk: number;
        total_hours: number;
        shortage_count: number;
        total_amount_rp: number;
        shortage_details: Array<{ date: string; day_name: string; actual_hours: number; target_hours: number; shortage_hours: number }>;
        shortage_total_hours: number;
        excess_details: Array<{ date: string; day_name: string; actual_hours: number; target_hours: number; excess_hours: number }>;
        excess_total_hours: number;
    }>> {
        if (!empCodes.length) return {};
        const resolvedDb = serverProfile ? Database.getInstance(undefined, serverProfile) : db;
        const empList = empCodes.map(e => `'${e}'`).join(",");
        const leaveSql = buildLeaveSqlExpressions("trl", "h");

        // [OPTIMIZATION] Single query: summary + shortage details + excess details
        // Uses a derived table with row_type to distinguish aggregation vs detail rows
        // Row_type: 'A' = summary aggregation, 'S' = shortage detail, 'E' = excess detail
        const rows = await resolvedDb.query<{
            emp_code: string;
            row_type: string;
            hk: number;
            total_hours: number;
            shortage_count: number;
            total_amount_rp: number;
            detail_date: string | null;
            detail_day_name: string | null;
            detail_hours: number;
            detail_target: number;
        }>(`
            SELECT
                emp_code,
                row_type,
                MAX(hk) as hk,
                MAX(total_hours) as total_hours,
                MAX(shortage_count) as shortage_count,
                MAX(total_amount_rp) as total_amount_rp,
                MAX(detail_date) as detail_date,
                MAX(detail_day_name) as detail_day_name,
                MAX(detail_hours) as detail_hours,
                MAX(detail_target) as detail_target
            FROM (
                -- LIVE: Summary aggregation
                SELECT
                    RTRIM(trl.EmpCode) as emp_code,
                    'A' as row_type,
                    COUNT(DISTINCT trl.TrxDate) as hk,
                    SUM(trl.Hours) as total_hours,
                    SUM(CASE
                        WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat')
                            THEN CASE WHEN trl.Hours < 5 AND trl.Hours > 0 THEN 1 ELSE 0 END
                        ELSE CASE WHEN trl.Hours < 7 AND trl.Hours > 0 THEN 1 ELSE 0 END
                    END) as shortage_count,
                    SUM(trl.Amount) as total_amount_rp,
                    NULL as detail_date, NULL as detail_day_name, NULL as detail_hours, NULL as detail_target
                FROM PR_TASKREGLN trl
                JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                GROUP BY RTRIM(trl.EmpCode)

                UNION ALL

                -- ARC: Summary aggregation
                SELECT
                    RTRIM(trl.EmpCode) as emp_code,
                    'A' as row_type,
                    COUNT(DISTINCT trl.TrxDate) as hk,
                    SUM(trl.Hours) as total_hours,
                    SUM(CASE
                        WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat')
                            THEN CASE WHEN trl.Hours < 5 AND trl.Hours > 0 THEN 1 ELSE 0 END
                        ELSE CASE WHEN trl.Hours < 7 AND trl.Hours > 0 THEN 1 ELSE 0 END
                    END) as shortage_count,
                    SUM(trl.Amount) as total_amount_rp,
                    NULL as detail_date, NULL as detail_day_name, NULL as detail_hours, NULL as detail_target
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                GROUP BY RTRIM(trl.EmpCode)

                UNION ALL

                -- LIVE: Shortage detail rows
                SELECT
                    RTRIM(trl.EmpCode) as emp_code,
                    'S' as row_type,
                    0 as hk, 0 as total_hours, 0 as shortage_count, 0 as total_amount_rp,
                    CONVERT(varchar, trl.TrxDate, 23) as detail_date,
                    DATENAME(weekday, trl.TrxDate) as detail_day_name,
                    SUM(trl.Hours) as detail_hours,
                    CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END as detail_target
                FROM PR_TASKREGLN trl
                JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                GROUP BY RTRIM(trl.EmpCode), trl.TrxDate
                HAVING SUM(trl.Hours) < CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END
                   AND SUM(trl.Hours) > 0

                UNION ALL

                -- ARC: Shortage detail rows
                SELECT
                    RTRIM(trl.EmpCode) as emp_code,
                    'S' as row_type,
                    0 as hk, 0 as total_hours, 0 as shortage_count, 0 as total_amount_rp,
                    CONVERT(varchar, trl.TrxDate, 23) as detail_date,
                    DATENAME(weekday, trl.TrxDate) as detail_day_name,
                    SUM(trl.Hours) as detail_hours,
                    CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END as detail_target
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                GROUP BY RTRIM(trl.EmpCode), trl.TrxDate
                HAVING SUM(trl.Hours) < CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END
                   AND SUM(trl.Hours) > 0

                UNION ALL

                -- LIVE: Excess detail rows
                SELECT
                    RTRIM(trl.EmpCode) as emp_code,
                    'E' as row_type,
                    0 as hk, 0 as total_hours, 0 as shortage_count, 0 as total_amount_rp,
                    CONVERT(varchar, trl.TrxDate, 23) as detail_date,
                    DATENAME(weekday, trl.TrxDate) as detail_day_name,
                    SUM(trl.Hours) as detail_hours,
                    CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END as detail_target
                FROM PR_TASKREGLN trl
                JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                GROUP BY RTRIM(trl.EmpCode), trl.TrxDate
                HAVING SUM(trl.Hours) > CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END

                UNION ALL

                -- ARC: Excess detail rows
                SELECT
                    RTRIM(trl.EmpCode) as emp_code,
                    'E' as row_type,
                    0 as hk, 0 as total_hours, 0 as shortage_count, 0 as total_amount_rp,
                    CONVERT(varchar, trl.TrxDate, 23) as detail_date,
                    DATENAME(weekday, trl.TrxDate) as detail_day_name,
                    SUM(trl.Hours) as detail_hours,
                    CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END as detail_target
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                GROUP BY RTRIM(trl.EmpCode), trl.TrxDate
                HAVING SUM(trl.Hours) > CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END
            ) combined
            GROUP BY emp_code, row_type
        `, [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate]);

        // Build result map
        const result: Record<string, {
            hk: number;
            total_hours: number;
            shortage_count: number;
            total_amount_rp: number;
            shortage_details: Array<{ date: string; day_name: string; actual_hours: number; target_hours: number; shortage_hours: number }>;
            shortage_total_hours: number;
            excess_details: Array<{ date: string; day_name: string; actual_hours: number; target_hours: number; excess_hours: number }>;
            excess_total_hours: number;
        }> = {};

        for (const r of rows) {
            const empCode = r.emp_code?.trim() || "";
            if (!result[empCode]) {
                result[empCode] = {
                    hk: 0, total_hours: 0, shortage_count: 0, total_amount_rp: 0,
                    shortage_details: [], shortage_total_hours: 0,
                    excess_details: [], excess_total_hours: 0
                };
            }

            if (r.row_type === 'A') {
                result[empCode].hk += r.hk || 0;
                result[empCode].total_hours += r.total_hours || 0;
                result[empCode].shortage_count += r.shortage_count || 0;
                result[empCode].total_amount_rp += r.total_amount_rp || 0;
            } else if (r.row_type === 'S') {
                if (r.detail_date && result[empCode]) {
                    const shortage_hours = (r.detail_target || 0) - (r.detail_hours || 0);
                    result[empCode].shortage_details.push({
                        date: r.detail_date,
                        day_name: r.detail_day_name || "",
                        actual_hours: r.detail_hours || 0,
                        target_hours: r.detail_target || 0,
                        shortage_hours
                    });
                    result[empCode].shortage_total_hours += shortage_hours;
                }
            } else if (r.row_type === 'E') {
                if (r.detail_date && result[empCode]) {
                    const excess_hours = (r.detail_hours || 0) - (r.detail_target || 0);
                    result[empCode].excess_details.push({
                        date: r.detail_date,
                        day_name: r.detail_day_name || "",
                        actual_hours: r.detail_hours || 0,
                        target_hours: r.detail_target || 0,
                        excess_hours
                    });
                    result[empCode].excess_total_hours += excess_hours;
                }
            }
        }

        return result;
    }

export async function getCuti(db: Database, empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, CutiData>> {
        if (!empCodes.length) return {};
        const resolvedDb = serverProfile ? Database.getInstance(undefined, serverProfile) : db;
        const empList = empCodes.map(e => `'${e}'`).join(",");
        const leaveSql = buildLeaveSqlExpressions("trl", "h");

        // ============================================================
        // [OPTIMIZATION] Consolidated: 3 queries → 1 query
        // All cuti types (task-based, minggu, nasional) in single round-trip
        // ============================================================
        const rows = await resolvedDb.query<{ emp_code: string; cuti_tahunan: number; cuti_sakit_haid: number; cuti_minggu: number; cuti_nasional: number }>(`
            SELECT
                RTRIM(EmpCode) as emp_code,
                SUM(cuti_tahunan) as cuti_tahunan,
                SUM(cuti_sakit_haid) as cuti_sakit_haid,
                SUM(cuti_minggu) as cuti_minggu,
                SUM(cuti_nasional) as cuti_nasional
            FROM (
                -- LIVE table: all cuti types via conditional aggregation
                SELECT
                    trl.EmpCode,
                    ${leaveSql.cutiTahunan} as cuti_tahunan,
                    ${leaveSql.cutiSakitHaid} as cuti_sakit_haid,
                    ${leaveSql.cutiMinggu} as cuti_minggu,
                    ${leaveSql.cutiNasional} as cuti_nasional
                FROM PR_TASKREGLN trl
                JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND ${leaveSql.whereClause}

                UNION ALL

                -- ARCHIVE table: same conditional aggregation
                SELECT
                    trl.EmpCode,
                    ${leaveSql.cutiTahunan} as cuti_tahunan,
                    ${leaveSql.cutiSakitHaid} as cuti_sakit_haid,
                    ${leaveSql.cutiMinggu} as cuti_minggu,
                    ${leaveSql.cutiNasional} as cuti_nasional
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND ${leaveSql.whereClause}
            ) combined
            GROUP BY RTRIM(EmpCode)
        `, [startDate, endDate, startDate, endDate]);

        // Initialize result with all employees (0 values for those with no cuti)
        const result: Record<string, CutiData> = {};
        for (const emp of empCodes) {
            result[emp] = { cuti_tahunan: 0, cuti_sakit_haid: 0, cuti_minggu: 0, cuti_nasional: 0 };
        }
        // Fill in actual values from query
        for (const r of rows) {
            const emp = r.emp_code?.trim() || "";
            if (result[emp]) {
                result[emp].cuti_tahunan = r.cuti_tahunan || 0;
                result[emp].cuti_sakit_haid = r.cuti_sakit_haid || 0;
                result[emp].cuti_minggu = r.cuti_minggu || 0;
                result[emp].cuti_nasional = r.cuti_nasional || 0;
            }
        }

        return result;
    }

export async function getPremi(db: Database, empCodes: string[], startDate: string, endDate: string, isHistorical: boolean = false, serverProfile?: string): Promise<{ amounts: Record<string, Record<string, number>>; titleMap: Record<string, string>; details: Record<string, any[]> }> {
        if (!empCodes.length) return { amounts: {}, titleMap: {}, details: {} };
        const resolvedDb = serverProfile ? Database.getInstance(undefined, serverProfile) : db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        const premiCondition = ADTRANS_DYNAMIC_PREMI_PATTERNS
            .map((pattern) => `UPPER(t.DocDesc) LIKE '${pattern}'`)
            .join(" OR ");

        // [CRITICAL] INNER JOIN HR_GANGLN ensures only valid gang members from HR_GANGLN are processed
        // This prevents orphaned adtrans records for employees not in the current gang
        let rows = await resolvedDb.query<{ emp_code: string; doc_desc: string; amount: number; task_code: string; task_desc: string }>(`
            SELECT RTRIM(t.EmpCode) as emp_code, t.DocDesc as doc_desc, SUM(ln.Amount) as amount, ln.TaskCode as task_code, mt.TaskDesc as task_desc
            FROM (
                SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
                FROM PR_ADTRANS t
                INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(t.EmpCode)
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND t.Status IN (1, 3)

                UNION ALL

                SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
                FROM PR_ADTRANS_ARC t
                INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(t.EmpCode)
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND t.Status = 3
            ) t
            JOIN (
                SELECT MasterID, TaskCode, Amount FROM PR_ADTRANSLN
                UNION ALL
                SELECT MasterID, TaskCode, Amount FROM PR_ADTRANSLN_ARC
            ) ln ON t.ID = ln.MasterID
            LEFT JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
            WHERE ${isHistorical ? `(
                  (${premiCondition})
                  AND UPPER(t.DocDesc) NOT LIKE '%PPH%'
                  AND UPPER(t.DocDesc) NOT LIKE '%JABATAN%'
                  AND UPPER(t.DocDesc) NOT LIKE '%BERAS%'
                  AND UPPER(t.DocDesc) NOT LIKE '%LEMBUR%'
                  AND UPPER(t.DocDesc) NOT LIKE '%MASA%'
                  AND UPPER(t.DocDesc) NOT LIKE '%POTONGAN%'
                  AND UPPER(t.DocDesc) NOT LIKE '%KOREKSI%'
                  AND UPPER(t.DocDesc) NOT LIKE '%SPSI%'
                  AND (mt.TaskDesc IS NULL OR mt.TaskDesc <> 'ACCRUALS-CHECKROLL')
              )` : `(
                  (
                      (UPPER(mt.TaskDesc) LIKE '%(AL)%' AND UPPER(mt.TaskDesc) LIKE '%TUNJANGAN%') OR
                      (${premiCondition})
                  )
                  AND (mt.TaskDesc IS NULL OR UPPER(mt.TaskDesc) NOT LIKE '%MASA%')
                  AND (mt.TaskDesc IS NULL OR UPPER(mt.TaskDesc) NOT LIKE '%LEMBUR%')
                  AND (mt.TaskDesc IS NULL OR UPPER(mt.TaskDesc) NOT LIKE '%JABATAN%')
                  AND (mt.TaskDesc IS NULL OR UPPER(mt.TaskDesc) NOT LIKE '%BERAS%')
                  AND UPPER(t.DocDesc) NOT LIKE '%PPH%'
                  AND UPPER(t.DocDesc) NOT LIKE '%JABATAN%'
                  AND UPPER(t.DocDesc) NOT LIKE '%BERAS%'
                  AND UPPER(t.DocDesc) NOT LIKE '%LEMBUR%'
                  AND UPPER(t.DocDesc) NOT LIKE '%MASA%'
                  AND UPPER(t.DocDesc) NOT LIKE '%POTONGAN%'
                  AND UPPER(t.DocDesc) NOT LIKE '%KOREKSI%'
                  AND UPPER(t.DocDesc) NOT LIKE '%SPSI%'
                  AND (mt.TaskDesc IS NULL OR mt.TaskDesc <> 'ACCRUALS-CHECKROLL')
              )`}
              AND ln.Amount > 0
            GROUP BY RTRIM(t.EmpCode), t.DocDesc, ln.TaskCode, mt.TaskDesc
        `, [startDate, endDate, startDate, endDate]);

        const amounts: Record<string, Record<string, number>> = {};
        const titleMap: Record<string, string> = {}; // key (normalized) -> DocDesc (original)
        const details: Record<string, any[]> = {}; // emp_code -> list of detail objects

        for (const r of rows) {
            const emp = r.emp_code?.trim() || "";
            if (!amounts[emp]) amounts[emp] = {};
            if (!details[emp]) details[emp] = [];
            const key = normalizePremiName(r.doc_desc || "");
            amounts[emp][key] = (amounts[emp][key] || 0) + (r.amount || 0);

            details[emp].push({
                doc_desc: r.doc_desc?.trim(),
                task_code: r.task_code?.trim(),
                task_desc: r.task_desc?.trim(),
                amount: r.amount,
                normalized_key: key
            });

            // [MODIFIED] Use DocDesc (TaskCode) as title for PREMI as requested
            // so it displays on two lines
            if (!titleMap[key]) {
                const taskCode = r.task_code?.trim();
                const docDesc = r.doc_desc?.trim() || key;
                titleMap[key] = taskCode ? `${docDesc}\n(${taskCode})` : docDesc;
            }
        }

        return { amounts, titleMap, details };
    }

export async function getPotongan(db: Database, empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<{ amounts: Record<string, Record<string, number>>; titleMap: Record<string, string> }> {
        if (!empCodes.length) return { amounts: {}, titleMap: {} };
        const resolvedDb = serverProfile ? Database.getInstance(undefined, serverProfile) : db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // [OPTIMIZATION] Single query: main potongan + PREMI_PPH (ACCRUALS-CHECKROLL) combined
        // row_type: 'P' = regular potongan, 'X' = PREMI_PPH
        // [CRITICAL] INNER JOIN HR_GANGLN ensures only valid gang members from HR_GANGLN are processed
        let rows = await resolvedDb.query<{ emp_code: string; doc_desc: string; task_code: string | null; task_desc: string | null; amount: number; row_type: string }>(`
            SELECT
                RTRIM(t.EmpCode) as emp_code,
                t.DocDesc as doc_desc,
                ln.TaskCode as task_code,
                mt.TaskDesc as task_desc,
                SUM(COALESCE(ln.Amount, 0)) as amount,
                CASE WHEN mt.TaskDesc = 'ACCRUALS-CHECKROLL' THEN 'X' ELSE 'P' END as row_type
            FROM (
                SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
                FROM PR_ADTRANS t
                INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(t.EmpCode)
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND t.Status IN (1, 3)

                UNION ALL

                SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
                FROM PR_ADTRANS_ARC t
                INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(t.EmpCode)
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND t.Status = 3
            ) t
            JOIN (
                SELECT MasterID, TaskCode, Amount FROM PR_ADTRANSLN
                UNION ALL
                SELECT MasterID, TaskCode, Amount FROM PR_ADTRANSLN_ARC
            ) ln ON t.ID = ln.MasterID
            LEFT JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
            WHERE (
                -- Main potongan conditions
                (
                    (UPPER(t.DocDesc) LIKE '%PPH%' AND UPPER(t.DocDesc) NOT LIKE '%PREMI%')
                    OR UPPER(t.DocDesc) LIKE '%POT%'
                    OR UPPER(t.DocDesc) LIKE '%BPJS%'
                    OR UPPER(t.DocDesc) LIKE '%PINJAM%'
                    OR UPPER(t.DocDesc) LIKE '%KL%'
                    OR UPPER(t.DocDesc) LIKE '%SPSI%'
                    OR UPPER(t.DocDesc) LIKE '%KOREKSI%'
                    OR UPPER(t.DocDesc) LIKE '%TOTAL%'
                    OR UPPER(t.DocDesc) LIKE '%KONTAN%'
                    OR UPPER(t.DocDesc) LIKE '%ALAT%'
                    OR UPPER(t.DocDesc) LIKE '%THR%'
                    OR UPPER(ln.TaskCode) LIKE '%DEPH21%'
                    OR UPPER(mt.TaskDesc) LIKE '%POTONGAN PPH21%'
                )
                -- PREMI_PPH (ACCRUALS-CHECKROLL) - also included
                OR mt.TaskDesc = 'ACCRUALS-CHECKROLL'
            )
            GROUP BY RTRIM(t.EmpCode), t.DocDesc, ln.TaskCode, mt.TaskDesc,
                CASE WHEN mt.TaskDesc = 'ACCRUALS-CHECKROLL' THEN 'X' ELSE 'P' END
        `, [startDate, endDate, startDate, endDate]);

        const amounts: Record<string, Record<string, number>> = {};
        const titleMap: Record<string, string> = {};

        for (const r of rows) {
            const emp = r.emp_code?.trim() || "";
            if (!amounts[emp]) amounts[emp] = {};

            let key: string;
            // Handle PREMI_PPH separately
            if (r.row_type === 'X') {
                key = "PREMI_PPH";
                if (!titleMap[key]) titleMap[key] = "PREMI PPH";
            } else {
                const { key: k, title } = normalizePotonganName(r.doc_desc || "", r.task_desc, r.task_code);
                key = k;
                if (!titleMap[key]) {
                    if (String(key).toUpperCase().startsWith('KOREKSI')) {
                        titleMap[key] = title;
                    } else {
                        const taskCode = r.task_code?.trim();
                        const taskDesc = r.task_desc?.trim();
                        // Show task_desc + task_code in header (similar to premi format)
                        if (taskDesc && taskCode) {
                            titleMap[key] = `${taskDesc}\n(${taskCode})`;
                        } else if (taskCode) {
                            titleMap[key] = taskCode;
                        } else {
                            titleMap[key] = title;
                        }
                    }
                }
            }

            amounts[emp][key] = (amounts[emp][key] || 0) + Math.abs(r.amount || 0);
        }

        return { amounts, titleMap };
    }

export async function getLemburDetailsFromCalculator(empCodes: string[], month: number, year: number, serverProfile?: string): Promise<Record<string, LemburData>> {
        const data = await lemburCalculator.calculateBatchData(empCodes, month, year, serverProfile);
        const result: Record<string, LemburData> = {};
        for (const k in data) {
            result[k] = {
                jam: data[k].total_hours || 0,
                jumlah: data[k].total_payment || 0
            };
        }
        return result;
    }

export async function getLemburDetailsWithTaskBreakdown(empCodes: string[], month: number, year: number, serverProfile?: string): Promise<Record<string, LemburDataWithDetails>> {
        const data = await lemburCalculator.calculateBatchDataWithTaskBreakdown(empCodes, month, year, serverProfile);
        const result: Record<string, LemburDataWithDetails> = {};
        for (const k in data) {
            // Use individual transaction records from lemburCalculator
            // This ensures total lembur = sum of all detail records (no double counting)
            const records = (data[k].records || []).map((rec) => ({
                trx_date: rec.date,
                task_code: rec.task_code,
                task_desc: rec.task_desc,
                day_type: rec.day_type,
                hours: rec.hours,
                rate: rec.rate,
                amount: rec.amount
            }));

            result[k] = {
                jam: data[k].total_hours || 0,
                jumlah: data[k].total_payment || 0,
                records: records
            };
        }
        return result;
    }

export async function getLemburDetails(db: Database, empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, LemburData>> {
        if (!empCodes.length) return {};
        const resolvedDb = serverProfile ? Database.getInstance(undefined, serverProfile) : db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        let rows = await resolvedDb.query<{ emp_code: string; total_hours: number; total_amount: number }>(`
            SELECT RTRIM(EmpCode) as emp_code, SUM(Hours) as total_hours, SUM(Amount) as total_amount
            FROM (
                SELECT trl.EmpCode, trl.Hours, trl.Amount
                FROM PR_TASKREGLN trl
                JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate <= ?
                  AND trl.OT = 1

                UNION ALL

                SELECT trl.EmpCode, trl.Hours, trl.Amount
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate <= ?
                  AND trl.OT = 1
            ) combined
            GROUP BY RTRIM(EmpCode)
        `, [startDate, endDate, startDate, endDate]);

        const result: Record<string, LemburData> = {};
        for (const r of rows) {
            result[r.emp_code?.trim() || ""] = {
                jam: r.total_hours || 0,
                jumlah: r.total_amount || 0
            };
        }
        return result;
    }

export async function getTunjanganAmount(db: Database, empCodes: string[], startDate: string, endDate: string, tunjanganType: string, serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const resolvedDb = serverProfile ? Database.getInstance(undefined, serverProfile) : db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        let rows = await resolvedDb.query<{ emp_code: string; total: number }>(`
            SELECT RTRIM(EmpCode) as emp_code, SUM(Amount) as total
            FROM (
                SELECT t.EmpCode, ln.Amount
                FROM PR_ADTRANS t
                JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%${tunjanganType}%'
                  AND ln.Amount > 0
                  AND t.Status IN (1, 3)

                UNION ALL

                SELECT t.EmpCode, ln.Amount
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%${tunjanganType}%'
                  AND ln.Amount > 0
                  AND t.Status = 3
            ) combined
            GROUP BY RTRIM(EmpCode)
        `, [startDate, endDate, startDate, endDate]);

        const result: Record<string, number> = {};
        for (const r of rows) {
            result[r.emp_code?.trim() || ""] = r.total || 0;
        }
        return result;
    }

export async function getLemburFromDocDesc(db: Database, empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const resolvedDb = serverProfile ? Database.getInstance(undefined, serverProfile) : db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // [OPTIMIZATION] Parallelize ARC + base table queries
        // Run both in parallel, then merge results (SUM aggregation handles duplicates)
        const [arcRows, baseRows] = await Promise.all([
            db.query<{ emp_code: string; total: number; doc_desc: string }>(`
                SELECT t.EmpCode as emp_code, SUM(ln.Amount) as total, t.DocDesc as doc_desc
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%LEMBUR%'
                  AND ln.Amount > 0
                  AND t.Status = 3
                GROUP BY t.EmpCode, t.DocDesc
            `, [startDate, endDate]),
            db.query<{ emp_code: string; total: number; doc_desc: string }>(`
                SELECT t.EmpCode as emp_code, SUM(ln.Amount) as total, t.DocDesc as doc_desc
                FROM PR_ADTRANS t
                JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%LEMBUR%'
                  AND ln.Amount > 0
                  AND t.Status IN (1, 3)
                GROUP BY t.EmpCode, t.DocDesc
            `, [startDate, endDate])
        ]);

        // Merge results: SUM by emp_code (duplicates from ARC+base are aggregated)
        const allRows = [...arcRows, ...baseRows];
        const result: Record<string, number> = {};
        for (const r of allRows) {
            const empCode = r.emp_code?.trim() || "";
            result[empCode] = (result[empCode] || 0) + (r.total || 0);
        }
        return result;
    }

export async function getBerasFromDocDesc(db: Database, empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const resolvedDb = serverProfile ? Database.getInstance(undefined, serverProfile) : db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // [OPTIMIZATION] Parallelize ARC + base table queries
        // Run both in parallel, then merge results (SUM aggregation handles duplicates)
        const [arcRows, baseRows] = await Promise.all([
            db.query<{ emp_code: string; total: number; doc_desc: string }>(`
                SELECT t.EmpCode as emp_code, SUM(ln.Amount) as total, t.DocDesc as doc_desc
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%BERAS%'
                  AND ln.Amount > 0
                  AND t.Status = 3
                GROUP BY t.EmpCode, t.DocDesc
            `, [startDate, endDate]),
            db.query<{ emp_code: string; total: number; doc_desc: string }>(`
                SELECT t.EmpCode as emp_code, SUM(ln.Amount) as total, t.DocDesc as doc_desc
                FROM PR_ADTRANS t
                JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%BERAS%'
                  AND ln.Amount > 0
                  AND t.Status IN (1, 3)
                GROUP BY t.EmpCode, t.DocDesc
            `, [startDate, endDate])
        ]);

        // Merge results: SUM by emp_code (duplicates from ARC+base are aggregated)
        const allRows = [...arcRows, ...baseRows];
        const result: Record<string, number> = {};
        for (const r of allRows) {
            const empCode = r.emp_code?.trim() || "";
            result[empCode] = (result[empCode] || 0) + (r.total || 0);
        }
        return result;
    }

export async function getUpahPokok(db: Database, empCodes: string[], year: number, currentYear: number, serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const resolvedDb = serverProfile ? Database.getInstance(undefined, serverProfile) : db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // For historical years (before current year), we still query HR_CPTRX
        // to get the employee-specific rate, but if the queried rate is <= 134500 (current standard),
        // we'll override it with the historical standard rate for that year.
        const rows = await resolvedDb.query<{ emp_code: string; upah_dasar: number }>(`
            WITH LatestCPTRX AS(
                SELECT EmpCode, NewRate, ROW_NUMBER() OVER(PARTITION BY EmpCode ORDER BY UpdateDate DESC) as rn
                FROM HR_CPTRX
            )
            SELECT RTRIM(e.EmpCode) as emp_code, COALESCE(lc.NewRate, 0) as upah_dasar
            FROM HR_EMPLOYEE e
            LEFT JOIN LatestCPTRX lc ON RTRIM(lc.EmpCode) = RTRIM(e.EmpCode) AND lc.rn = 1
            WHERE RTRIM(e.EmpCode) IN(${empList})
        `);

        const result: Record<string, number> = {};
        for (const r of rows) {
            let rate = r.upah_dasar || 0;

            // For historical years (before current year), override rate if it's the standard minimum
            // or less (e.g., 2026 standard is 134500) and replace it with historical year's standard rate.
            if (year < currentYear && rate <= 134500) {
                rate = Config.getUpahDasar(year);
            }

            result[r.emp_code?.trim() || ""] = rate;
        }
        return result;
    }

export function normalizePremiName(docDesc: string): string {
        return mapAdtransPremiField(docDesc);
    }

export function normalizePotonganName(docDesc: string, taskDesc?: string | null, taskCode?: string | null): { key: string; title: string } {
        const upper = docDesc.toUpperCase().trim();
        const upperTask = taskDesc ? taskDesc.toUpperCase().trim() : "";
        const upperCode = taskCode ? taskCode.toUpperCase().trim() : "";
        const cleanTitle = docDesc.trim();

        // [RULE 1] Handle KOREKSI variations separately
        // Pattern: KOREKSI, KOREKSI A, KOREKSI PANEN, KOREKSI X, etc.
        // Each variation becomes a separate key for display in POTONGAN UPAH KOTOR
        if (upper.includes("KOREKSI")) {
            return normalizeAdtransPotonganField(cleanTitle);
        }

        // [RULE 1.5] Specific for Potongan PPh21 matching TaskDesc or DocDesc
        // Pebrikiki untuk PPh21 (yang dipotong atau yang menjadi pengurang upah bersih) dengan taskDesc (DEPH21AB1) (DE) POTONGAN PPH21
        if (upperCode.includes("DEPH21") || upperTask.includes("POTONGAN PPH21") || upper.includes("POTONGAN PPH21") || (upper.includes("PPH21") && upper.includes("POTONGAN"))) {
            return { key: "PPH21", title: "Potongan PPh21" };
        }

        // [RULE 2] Static: PPH21 (PPH yang dipotong) - MUST CHECK BEFORE POTONGAN rule
        // Pattern: DocDesc mengandung "PPH" atau "PAJAK" TAPI tidak mengandung "PREMI"
        // Examples:
        //   - "PPH21" → PPH21 ✓
        //   - "POTONGAN PPH 21" → PPH21 ✓ (contains PPH, not PREMI)
        //   - "PREMI PPH 21" → PREMI_PPH_21 ✗ (contains PREMI)
        //   - "PREMI PPH" → PREMI_PPH ✗ (contains PREMI)
        if (upper.includes("PPH") || upper.includes("PAJAK")) {
            // EXCLUDE: If contains PREMI in DocDesc or TaskDesc, don't treat as PPH21
            // User Request: "kecualikan kata premi,,jadi misal docDesc (premi pph tidak masuk ke pph21)"
            if (upper.includes("PREMI") || upperTask.includes("PREMI")) {
                const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
                return { key, title: cleanTitle };
            }
            return { key: "PPH21", title: "PPH21" };
        }

        // [RULE 3] Static: SPSI
        if (upper.includes("SPSI")) {
            return { key: "SPSI", title: "SPSI" };
        }

        // [RULE 4] Dynamic POTONGAN X patterns
        // Pattern: POTONGAN, POTONGAN A, POTONGAN BERAS, POT X, etc.
        // Each variation becomes a separate column in POTONGAN UPAH BERSIH
        // NOTE: "POTONGAN PPH 21" is handled by RULE 2 (PPH check above)
        if (upper.startsWith("POTONGAN") || upper.startsWith("POT ") || upper.startsWith("POT_")) {
            const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
            return { key, title: cleanTitle };
        }

        // [RULE 5] Default: Use DocDesc as title, normalized key for field name
        const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
        return { key, title: cleanTitle };
    }

export async function getBunchesBatch(empCodes: string[], month: number, year: number): Promise<Map<string, import("../../../types/harvest").HarvestData>> {
        if (empCodes.length === 0) {
            return new Map();
        }

        try {
            return await harvesterService.getBatchEmployeeBunches(empCodes, month, year);
        } catch (error: any) {
            console.error("[DataExtractor] Error fetching bunches batch:", error.message);
            return new Map();
        }
    }

export async function getBrondol(db: Database, empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};

        const resolvedDb = serverProfile ? Database.getInstance(undefined, serverProfile) : db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        try {
            // Query PR_LOOSEFRUIT (active + archived) for brondol premium amounts
            // OPTIMIZED:
            // - No RTRIM() on EmpCode in WHERE — allows SQL Server to use EmpCode index
            // - Removed inner GROUP BY — single GROUP BY at outer level is sufficient
            // - Removed subquery wrapper — direct UNION ALL is faster
            // - Sequential smaller batches (size 20) — prevents gateway 30s timeout
            const result: Record<string, number> = {};
            const batchSize = 20; // Small batches to avoid gateway timeout
            const batches = [];

            for (let i = 0; i < empCodes.length; i += batchSize) {
                batches.push(empCodes.slice(i, i + batchSize));
            }

            for (const batch of batches) {
                const batchEmpList = batch.map(e => `'${e}'`).join(",");

                try {
                    const rows = await resolvedDb.query<any>(`
                        SELECT
                            l.EmpCode as EmpCode,
                            SUM(ISNULL(l.Amount, 0)) as TotalAmount
                        FROM PR_LOOSEFRUITLN l
                        INNER JOIN PR_LOOSEFRUIT m ON l.MasterID = m.ID
                        WHERE l.EmpCode IN (${batchEmpList})
                          AND m.DocDate >= ? AND m.DocDate < ?
                        GROUP BY l.EmpCode

                        UNION ALL

                        SELECT
                            l.EmpCode as EmpCode,
                            SUM(ISNULL(l.Amount, 0)) as TotalAmount
                        FROM PR_LOOSEFRUITLN_ARC l
                        INNER JOIN PR_LOOSEFRUIT_ARC m ON l.MasterID = m.ID
                        WHERE l.EmpCode IN (${batchEmpList})
                          AND m.DocDate >= ? AND m.DocDate < ?
                        GROUP BY l.EmpCode
                    `, [startDate, endDate, startDate, endDate], 60);

                    for (const row of rows) {
                        if (row.EmpCode && row.TotalAmount) {
                            const empCode = (row.EmpCode || "").trim();
                            const amount = parseFloat(row.TotalAmount) || 0;
                            if (!result[empCode] || amount > result[empCode]) {
                                result[empCode] = amount;
                            }
                        }
                    }
                } catch (batchError: any) {
                    warn("DataExtractor", `Brondol batch query failed for ${batch.length} employees: ${batchError?.message || 'unknown error'}`);
                    // Continue with next batch - brondol will be 0 for this batch
                }
            }

            return result;
        } catch (e: any) {
            // Gracefully handle timeout - brondol will be 0 for affected employees
            const errorMsg = e?.message || '';
            if (errorMsg.includes('Timeout') || errorMsg.includes('timeout')) {
                warn("DataExtractor", `PR_LOOSEFRUIT query timed out - returning partial brondol data (this is OK for large datasets)`);
            } else {
                console.error("[DataExtractor] Failed to get brondol from PR_LOOSEFRUIT:", e);
            }
            return {};
        }
    }

export async function getPositionHistory(empCodes: string[], month: number, year: number): Promise<Record<string, string>> {
        if (!empCodes.length) return {};
        try {
            const extDb = Database.getExtendedInstance();
            const empList = empCodes.map(e => `'${e}'`).join(",");

            const rows = await extDb.query<{ emp_code: string; position: string }>(`
            SELECT RTRIM(emp_code) as emp_code, position
            FROM history_hr_employee
            WHERE RTRIM(emp_code) IN (${empList})
              AND period_month = ?
              AND period_year = ?
        `, [month, year]);

            const result: Record<string, string> = {};
            for (const r of rows) {
                if (r.emp_code && r.position) {
                    result[r.emp_code.trim()] = r.position.trim();
                }
            }
            return result;
        } catch (e) {
            console.error("[DataExtractor] Failed to get position history:", e);
            return {};
        }
    }

export async function getTaskCodes(db: Database, empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, {
        task_code: string;
        task_desc: string;
        task_type: string;
        task_uom: string;
    }>> {
        if (!empCodes.length) return {};
        const resolvedDb = serverProfile ? Database.getInstance(undefined, serverProfile) : db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // Get task codes with descriptions from both tables, then rank by frequency
        // Using simpler column aliases to avoid SQL Gateway issues
        let rows = await resolvedDb.query<any>(`
            SELECT EmpCode, TaskCode, TaskDesc, TaskType, UOM
            FROM (
                SELECT
                    RTRIM(trl.EmpCode) as EmpCode,
                    trl.TaskCode,
                    tc.TaskDesc,
                    tc.TaskType,
                    tc.UOM,
                    ROW_NUMBER() OVER (
                        PARTITION BY RTRIM(trl.EmpCode)
                        ORDER BY COUNT(*) DESC, trl.TaskCode
                    ) as rn
                FROM PR_TASKREGLN trl
                INNER JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                LEFT JOIN PR_TASKCODE tc ON trl.TaskCode = tc.TaskCode
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND trl.TaskCode IS NOT NULL
                  AND trl.TaskCode <> ''
                GROUP BY RTRIM(trl.EmpCode), trl.TaskCode, tc.TaskDesc, tc.TaskType, tc.UOM

                UNION ALL

                SELECT
                    RTRIM(trl.EmpCode) as EmpCode,
                    trl.TaskCode,
                    tc.TaskDesc,
                    tc.TaskType,
                    tc.UOM,
                    ROW_NUMBER() OVER (
                        PARTITION BY RTRIM(trl.EmpCode)
                        ORDER BY COUNT(*) DESC, trl.TaskCode
                    ) as rn
                FROM PR_TASKREGLN_ARC trl
                INNER JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                LEFT JOIN PR_TASKCODE tc ON trl.TaskCode = tc.TaskCode
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND trl.TaskCode IS NOT NULL
                  AND trl.TaskCode <> ''
                GROUP BY RTRIM(trl.EmpCode), trl.TaskCode, tc.TaskDesc, tc.TaskType, tc.UOM
            ) RankedTasks
            WHERE rn = 1
        `, [startDate, endDate, startDate, endDate]);

        const result: Record<string, { task_code: string; task_desc: string; task_type: string; task_uom: string }> = {};
        for (const r of rows) {
            const empCode = (r.EmpCode || "").trim();
            result[empCode] = {
                task_code: r.TaskCode || "",
                task_desc: r.TaskDesc || "",
                task_type: r.TaskType || "",
                task_uom: r.UOM || ""
            };
        }
        return result;
    }
