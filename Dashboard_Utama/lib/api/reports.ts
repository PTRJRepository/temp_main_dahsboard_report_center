/**
 * reports.ts
 * Report-oriented query helpers built on top of `SqlGateway`.
 * Each function represents a common HR / Payroll report and wraps one or more
 * gateway queries with sensible defaults.
 *
 * Usage:
 * ```ts
 * import { createReportHelpers } from './lib/api/reports.js';
 *
 * const reports = createReportHelpers(
 *   new SqlGateway({ apiKey: process.env.SQL_GATEWAY_API_KEY! })
 * );
 *
 * const headcount = await reports.hrHeadcountByDepartment();
 * const payroll   = await reports.payrollSummary('2025-03');
 * ```
 */

import type { SqlGateway } from './sql-gateway.js';
import type { QueryResponse } from './types.js';

// ─── Shared result shapes ───────────────────────────────────────────────────────

export interface HRAggregateRow {
  DEPT_NAME: string;
  HEADCOUNT: number;
  [key: string]: unknown;
}

export interface PayrollSummaryRow {
  DEPT: string;
  EMPLOYEE_COUNT: number;
  TOTAL_BASIC: number;
  TOTAL_ALLOWANCES: number;
  TOTAL_DEDUCTIONS: number;
  TOTAL_NET: number;
}

export interface AttendanceDailyRow {
  DEPT: string;
  STATUS: string;
  COUNT: number;
}

export interface EmployeeRow {
  EMP_ID: string;
  EMP_NAME: string;
  DEPT: string;
  [key: string]: unknown;
}

// ─── Report Helpers Factory ─────────────────────────────────────────────────────

export function createReportHelpers(db: SqlGateway) {
  return {
    // ─── HR Headcount Reports ───────────────────────────────────────────────

    /**
     * Headcount (total employees) grouped by department.
     */
    async hrHeadcountByDepartment(
      signal?: AbortSignal
    ): Promise<QueryResponse<HRAggregateRow>> {
      return db.query<HRAggregateRow>(
        `SELECT DEPT AS DEPT_NAME, COUNT(*) AS HEADCOUNT
         FROM HR_EMPLOYEE
         GROUP BY DEPT
         ORDER BY DEPT`,
        { signal }
      );
    },

    /**
     * Headcount split by employment status (e.g. Active / Probation / Terminated).
     */
    async hrHeadcountByStatus(
      signal?: AbortSignal
    ): Promise<QueryResponse<HRAggregateRow>> {
      return db.query<HRAggregateRow>(
        `SELECT
            ISNULL(STATUS, 'Unknown') AS STATUS,
            COUNT(*) AS HEADCOUNT
         FROM HR_EMPLOYEE
         GROUP BY STATUS
         ORDER BY STATUS`,
        { signal }
      );
    },

    /**
     * Department headcount including average salary per department.
     */
    async hrHeadcountWithAvgSalary(
      signal?: AbortSignal
    ): Promise<QueryResponse<Record<string, unknown>>> {
      return db.query(
        `SELECT
            e.DEPT,
            COUNT(e.EMP_ID)                                     AS headcount,
            AVG(p.NET_SALARY)                                   AS avg_net_salary,
            MIN(p.NET_SALARY)                                   AS min_net_salary,
            MAX(p.NET_SALARY)                                   AS max_net_salary,
            SUM(p.NET_SALARY)                                   AS total_net_salary
         FROM HR_EMPLOYEE e
         LEFT JOIN PAYROLL p
           ON p.EMP_ID = e.EMP_ID
          AND p.PAY_PERIOD = (
               SELECT MAX(PP.PAY_PERIOD) FROM PAYROLL PP WHERE PP.EMP_ID = e.EMP_ID
             )
         GROUP BY e.DEPT
         ORDER BY e.DEPT`,
        { signal }
      );
    },

    // ─── Attendance Reports ──────────────────────────────────────────────────

    /**
     * Per-department daily attendance breakdown (Present / Absent / Late / etc.)
     * for a specific calendar date.
     *
     * @param date - ISO-8601 date string, e.g. '2025-03-01'
     */
    async attendanceDailyBreakdown(
      date: string,
      signal?: AbortSignal
    ): Promise<QueryResponse<AttendanceDailyRow>> {
      return db.query<AttendanceDailyRow>(
        `SELECT e.DEPT,
                a.STATUS,
                COUNT(*) AS COUNT
         FROM ATTENDANCE_LOG a
         JOIN HR_EMPLOYEE e ON e.EMP_ID = a.EMP_ID
         WHERE a.LOG_DATE = @date
         GROUP BY e.DEPT, a.STATUS
         ORDER BY e.DEPT, a.STATUS`,
        { params: { date }, signal }
      );
    },

    /**
     * Attendance rate (%) per department for a given month.
     *
     * Calculated as: (Present count / Total expected) × 100
     * where expected = number of working days in the month × headcount.
     *
     * @param yearMonth - Format 'YYYY-MM', e.g. '2025-03'
     */
    async attendanceMonthlyRate(
      yearMonth: string,
      signal?: AbortSignal
    ): Promise<QueryResponse<Record<string, unknown>>> {
      return db.query(
        `WITH WorkingDays AS (
           SELECT COUNT(DISTINCT LOG_DATE) AS total_days
           FROM ATTENDANCE_LOG
           WHERE LOG_DATE >= @from AND LOG_DATE < DATEADD(MONTH, 1, @from)
         ),
         DailyCounts AS (
           SELECT e.DEPT,
                  a.STATUS,
                  COUNT(*) AS cnt
             FROM ATTENDANCE_LOG a
             JOIN HR_EMPLOYEE e ON e.EMP_ID = a.EMP_ID
            WHERE a.LOG_DATE >= @from
              AND a.LOG_DATE < DATEADD(MONTH, 1, @from)
            GROUP BY e.DEPT, a.STATUS
         )
         SELECT
           dc.DEPT,
           SUM(CASE WHEN dc.STATUS = 'Present' THEN dc.cnt ELSE 0 END) AS present_count,
           wd.total_days,
           COUNT(DISTINCT e.EMP_ID) AS headcount,
           CASE
             WHEN wd.total_days > 0 AND COUNT(DISTINCT e.EMP_ID) > 0
             THEN ROUND(
                    100.0 * SUM(CASE WHEN dc.STATUS = 'Present' THEN dc.cnt ELSE 0 END)
                    / (wd.total_days * COUNT(DISTINCT e.EMP_ID)),
                    2)
             ELSE 0
           END AS attendance_rate_pct
         FROM DailyCounts dc
         CROSS JOIN WorkingDays wd
         LEFT JOIN HR_EMPLOYEE e ON e.DEPT = dc.DEPT
         GROUP BY dc.DEPT, wd.total_days
         ORDER BY dc.DEPT`,
        {
          params: {
            from: `${yearMonth}-01`,
          },
          signal,
        }
      );
    },

    /**
     * Employees with zero attendance records in a given month (flag for review).
     *
     * @param yearMonth - Format 'YYYY-MM'
     */
    async attendanceMissingMonthly(
      yearMonth: string,
      signal?: AbortSignal
    ): Promise<QueryResponse<EmployeeRow>> {
      return db.query<EmployeeRow>(
        `SELECT e.*
         FROM HR_EMPLOYEE e
         LEFT JOIN ATTENDANCE_LOG a
           ON a.EMP_ID = e.EMP_ID
          AND a.LOG_DATE >= @from
          AND a.LOG_DATE < DATEADD(MONTH, 1, @from)
         WHERE a.EMP_ID IS NULL
         ORDER BY e.DEPT, e.EMP_NAME`,
        { params: { from: `${yearMonth}-01` }, signal }
      );
    },

    // ─── Payroll Reports ─────────────────────────────────────────────────────

    /**
     * Full payroll summary (totals per department) for a given month.
     *
     * @param yearMonth - Format 'YYYY-MM', e.g. '2025-03'
     */
    async payrollSummary(
      yearMonth: string,
      signal?: AbortSignal
    ): Promise<QueryResponse<PayrollSummaryRow>> {
      return db.query<PayrollSummaryRow>(
        `SELECT
            e.DEPT,
            COUNT(p.EMP_ID)         AS EMPLOYEE_COUNT,
            SUM(p.BASIC_SALARY)     AS TOTAL_BASIC,
            SUM(p.ALLOWANCES)       AS TOTAL_ALLOWANCES,
            SUM(p.DEDUCTIONS)       AS TOTAL_DEDUCTIONS,
            SUM(p.NET_SALARY)       AS TOTAL_NET
         FROM PAYROLL p
         JOIN HR_EMPLOYEE e ON e.EMP_ID = p.EMP_ID
         WHERE p.PAY_PERIOD = @period
         GROUP BY e.DEPT
         ORDER BY e.DEPT`,
        { params: { period: yearMonth }, signal }
      );
    },

    /**
     * Month-over-month payroll growth per department.
     * Compares the requested month against the immediately preceding month.
     *
     * @param yearMonth - Format 'YYYY-MM'
     */
    async payrollMonthOverMonth(
      yearMonth: string,
      signal?: AbortSignal
    ): Promise<QueryResponse<Record<string, unknown>>> {
      return db.query(
        `WITH Summary AS (
           SELECT
             e.DEPT,
             p.PAY_PERIOD,
             SUM(p.NET_SALARY) AS total_net
           FROM PAYROLL p
           JOIN HR_EMPLOYEE e ON e.EMP_ID = p.EMP_ID
           WHERE p.PAY_PERIOD IN (@period, @prevPeriod)
           GROUP BY e.DEPT, p.PAY_PERIOD
         )
         SELECT
           cur.DEPT,
           cur.PAY_PERIOD                             AS current_period,
           cur.total_net                              AS current_net,
           ISNULL(prv.total_net, 0)                   AS previous_net,
           cur.total_net - ISNULL(prv.total_net, 0)   AS net_change,
           CASE
             WHEN ISNULL(prv.total_net, 0) > 0
             THEN ROUND(100.0 * (cur.total_net - prv.total_net) / prv.total_net, 2)
             ELSE NULL
           END                                         AS pct_change
         FROM Summary cur
         LEFT JOIN Summary prv
           ON prv.DEPT = cur.DEPT
          AND prv.PAY_PERIOD = (
               SELECT MAX(PP.PAY_PERIOD) FROM PAYROLL PP WHERE PP.PAY_PERIOD < @period
             )
         WHERE cur.PAY_PERIOD = @period
         ORDER BY cur.DEPT`,
        { params: { period: yearMonth }, signal }
      );
    },

    /**
     * Employees with anomalous net salaries — defined as salaries that are
     * 3 or more standard deviations from the departmental mean.
     * Useful as a first-pass audit check.
     */
    async payrollAnomalies(
      yearMonth: string,
      signal?: AbortSignal
    ): Promise<QueryResponse<EmployeeRow>> {
      return db.query<EmployeeRow>(
        `SELECT e.*
         FROM HR_EMPLOYEE e
         JOIN PAYROLL p ON p.EMP_ID = e.EMP_ID
         WHERE p.PAY_PERIOD = @period
           AND p.NET_SALARY <
               (SELECT AVG(NET_SALARY) - 3 * STDEV(NET_SALARY)
                  FROM PAYROLL
                 WHERE PAY_PERIOD = @period AND EMP_ID IN (
                        SELECT EMP_ID FROM HR_EMPLOYEE WHERE DEPT = e.DEPT
                      ))
        UNION
        SELECT e.*
         FROM HR_EMPLOYEE e
         JOIN PAYROLL p ON p.EMP_ID = e.EMP_ID
         WHERE p.PAY_PERIOD = @period
           AND p.NET_SALARY >
               (SELECT AVG(NET_SALARY) + 3 * STDEV(NET_SALARY)
                  FROM PAYROLL
                 WHERE PAY_PERIOD = @period AND EMP_ID IN (
                        SELECT EMP_ID FROM HR_EMPLOYEE WHERE DEPT = e.DEPT
                      ))
         ORDER BY EMP_ID`,
        { params: { period: yearMonth }, signal }
      );
    },

    // ─── Dashboard KPI composite ─────────────────────────────────────────────

    /**
     * Combined snapshot of the four most common dashboard KPIs for a given month.
     * A single round-trip that returns headcount, total payroll, attendance rate,
     * and a count of flagged attendance anomalies.
     */
    async dashboardKPIs(
      yearMonth: string,
      signal?: AbortSignal
    ): Promise<QueryResponse<Record<string, unknown>>> {
      // We fire all four KPI sub-queries in parallel using Promise.all.
      // Since the gateway is HTTP-based, parallel execution cuts total latency.
      const [headcount, payroll, attendance, anomalies] = await Promise.all([
        db.query<HRAggregateRow>(
          `SELECT DEPT AS DEPT_NAME, COUNT(*) AS HEADCOUNT
             FROM HR_EMPLOYEE GROUP BY DEPT`,
          { signal }
        ),
        db.query(
          `SELECT
              e.DEPT,
              SUM(p.NET_SALARY) AS TOTAL_NET,
              COUNT(p.EMP_ID)   AS EMPLOYEES_PAID
            FROM PAYROLL p
            JOIN HR_EMPLOYEE e ON e.EMP_ID = p.EMP_ID
            WHERE p.PAY_PERIOD = @period
            GROUP BY e.DEPT`,
          { params: { period: yearMonth }, signal }
        ),
        db.query<Record<string, unknown>>(
          `SELECT
              COUNT(CASE WHEN a.STATUS = 'Present' THEN 1 END)   AS present_days,
              COUNT(CASE WHEN a.STATUS = 'Absent'  THEN 1 END)   AS absent_days,
              COUNT(*)                                           AS total_logs
            FROM ATTENDANCE_LOG a
            WHERE a.LOG_DATE >= @from
              AND a.LOG_DATE < DATEADD(MONTH, 1, @from)`,
          { params: { from: `${yearMonth}-01` }, signal }
        ),
        db.query(
          `SELECT COUNT(*) AS anomaly_count FROM (
             SELECT e.EMP_ID
               FROM HR_EMPLOYEE e
               JOIN PAYROLL p ON p.EMP_ID = e.EMP_ID
              WHERE p.PAY_PERIOD = @period
                AND p.NET_SALARY <
                    (SELECT AVG(NET_SALARY) - 3 * STDEV(NET_SALARY)
                       FROM PAYROLL
                      WHERE PAY_PERIOD = @period)
             UNION
             SELECT e.EMP_ID
               FROM HR_EMPLOYEE e
               JOIN PAYROLL p ON p.EMP_ID = e.EMP_ID
              WHERE p.PAY_PERIOD = @period
                AND p.NET_SALARY >
                    (SELECT AVG(NET_SALARY) + 3 * STDEV(NET_SALARY)
                       FROM PAYROLL
                      WHERE PAY_PERIOD = @period)
           ) AS anomalies`,
          { params: { period: yearMonth }, signal }
        ),
      ]);

      // Aggregate totals across all departments
      const totalHeadcount = Array.isArray(headcount.data?.recordset)
        ? (headcount.data.recordset as HRAggregateRow[]).reduce(
            (sum, r) => sum + Number(r.HEADCOUNT),
            0
          )
        : 0;

      const totalPayroll = Array.isArray(payroll.data?.recordset)
        ? (payroll.data.recordset as Array<{ TOTAL_NET: number }>).reduce(
            (sum, r) => sum + Number(r.TOTAL_NET ?? 0),
            0
          )
        : 0;

      const attendanceData = attendance.data?.recordset?.[0] as {
        present_days: number;
        absent_days: number;
        total_logs: number;
      } | undefined;

      const attendanceRate = (attendanceData?.total_logs ?? 0) > 0
        ? Math.round(
            (Number(attendanceData?.present_days ?? 0) /
              Number(attendanceData?.total_logs ?? 1)) *
              10000
          ) / 100
        : 0;

      const anomalyCount = Array.isArray(anomalies.data?.recordset)
        ? Number((anomalies.data.recordset[0] as { anomaly_count: number } | undefined)?.anomaly_count ?? 0)
        : 0;

      return {
        success: true,
        db: db['config']?.defaultDatabase ?? 'db_ptrj_mill',
        execution_ms:
          (headcount.execution_ms ?? 0) +
          (payroll.execution_ms ?? 0) +
          (attendance.execution_ms ?? 0) +
          (anomalies.execution_ms ?? 0),
        data: {
          recordset: [
            {
              period: yearMonth,
              total_headcount: totalHeadcount,
              total_payroll_net: totalPayroll,
              attendance_rate_pct: attendanceRate,
              payroll_anomaly_count: anomalyCount,
            },
          ],
          rowsAffected: [1],
        },
        error: null,
      } as QueryResponse<Record<string, unknown>>;
    },
  };
}