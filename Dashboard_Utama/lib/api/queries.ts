/**
 * queries.ts
 * Pre-built, parameterised query helpers for the SQL Gateway.
 * All queries target `db_ptrj_mill` and are READ-ONLY.
 *
 * Import the factory once and call individual helpers as needed:
 *
 * ```ts
 * import { createQueryHelpers } from './lib/api/queries.js';
 *
 * const q = createQueryHelpers({ apiKey: process.env.SQL_GATEWAY_API_KEY! });
 *
 * const employees = await q.employees.selectAll({ limit: 20 });
 * const byDept = await q.employees.selectByDepartment('Sales', { limit: 10 });
 * ```
 */

import type { SqlGateway } from './sql-gateway.js';
import type { QueryResponse } from './types.js';

// ─── Shared types ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface DateFilterParams {
  from?: string; // ISO-8601 date string
  to?: string;
}

export interface SearchParams {
  search?: string;
}

// ─── Query Helpers ──────────────────────────────────────────────────────────────

/**
 * Creates a flat object of query-helper functions bound to a `SqlGateway` instance.
 * All helpers return typed `QueryResponse<T>` and never perform write operations.
 */
export function createQueryHelpers(db: SqlGateway) {
  return {
    /**
     * Employee directory queries.
     * Table: HR_EMPLOYEE (or equivalent)
     */
    employees: {
      /**
       * Fetch a paginated list of all employees, optionally filtered by search term.
       */
      selectAll(
        pagination: PaginationParams = {},
        signal?: AbortSignal
      ): Promise<QueryResponse<Record<string, unknown>>> {
        const limit = pagination.limit ?? 100;
        const offset = pagination.offset ?? 0;
        const sql = `SELECT TOP ${limit} * FROM (
          SELECT ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS __row,
                 t.*
          FROM HR_EMPLOYEE t
        ) AS p WHERE p.__row > ${offset}`;
        return db.query(sql, { signal });
      },

      /**
       * Search employees by name (first or last) with optional department filter.
       */
      search(
        params: { name?: string; dept?: string; limit?: number },
        signal?: AbortSignal
      ): Promise<QueryResponse<Record<string, unknown>>> {
        const limit = params.limit ?? 50;
        let sql = `SELECT TOP ${limit} * FROM HR_EMPLOYEE WHERE 1=1`;
        const queryParams: Record<string, unknown> = {};

        if (params.name) {
          sql += ` AND (EMP_NAME LIKE @name OR FIRST_NAME LIKE @name OR LAST_NAME LIKE @name)`;
          queryParams['name'] = `%${params.name}%`;
        }
        if (params.dept) {
          sql += ` AND DEPT = @dept`;
          queryParams['dept'] = params.dept;
        }

        return db.query(sql, { params: queryParams, signal });
      },

      /**
       * Fetch a single employee by their primary key / employee ID.
       */
      selectById(employeeId: string | number, signal?: AbortSignal): Promise<QueryResponse<Record<string, unknown>>> {
        return db.query('SELECT * FROM HR_EMPLOYEE WHERE EMP_ID = @id', {
          params: { id: employeeId },
          signal,
        });
      },

      /**
       * Count employees, optionally filtered by department.
       */
      count(dept?: string, signal?: AbortSignal): Promise<QueryResponse<Record<string, unknown>>> {
        const sql = dept
          ? 'SELECT COUNT(*) AS total FROM HR_EMPLOYEE WHERE DEPT = @dept'
          : 'SELECT COUNT(*) AS total FROM HR_EMPLOYEE';
        return db.query(sql, { params: dept ? { dept } : undefined, signal });
      },
    },

    /**
     * Department / section queries.
     * Table: HR_DEPARTMENT (or equivalent)
     */
    departments: {
      /** List all departments with head-count and budget summary. */
      selectAll(signal?: AbortSignal): Promise<QueryResponse<Record<string, unknown>>> {
        return db.query(
          `SELECT d.DEPT_ID, d.DEPT_NAME, d.DEPT_CODE,
                  COUNT(e.EMP_ID) AS employee_count,
                  d.BUDGET
           FROM HR_DEPARTMENT d
           LEFT JOIN HR_EMPLOYEE e ON e.DEPT = d.DEPT_NAME
           GROUP BY d.DEPT_ID, d.DEPT_NAME, d.DEPT_CODE, d.BUDGET
           ORDER BY d.DEPT_NAME`,
          { signal }
        );
      },

      /** Fetch a single department by ID. */
      selectById(deptId: string | number, signal?: AbortSignal): Promise<QueryResponse<Record<string, unknown>>> {
        return db.query('SELECT * FROM HR_DEPARTMENT WHERE DEPT_ID = @id', {
          params: { id: deptId },
          signal,
        });
      },

      /** List all employees in a specific department. */
      listEmployees(deptName: string, pagination: PaginationParams = {}, signal?: AbortSignal): Promise<QueryResponse<Record<string, unknown>>> {
        const limit = pagination.limit ?? 50;
        const offset = pagination.offset ?? 0;
        const sql = `SELECT * FROM HR_EMPLOYEE WHERE DEPT = @dept ORDER BY EMP_NAME OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
        return db.query(sql, { params: { dept: deptName }, signal });
      },
    },

    /**
     * Attendance / clock-in records.
     * Table: ATTENDANCE_LOG (or equivalent)
     */
    attendance: {
      /**
       * Fetch attendance records for an employee within a date range.
       */
      selectByEmployee(
        employeeId: string | number,
        dateFilter: DateFilterParams = {},
        signal?: AbortSignal
      ): Promise<QueryResponse<Record<string, unknown>>> {
        let sql = 'SELECT * FROM ATTENDANCE_LOG WHERE EMP_ID = @empId';
        const params: Record<string, unknown> = { empId: employeeId };

        if (dateFilter.from) {
          sql += ' AND LOG_DATE >= @from';
          params['from'] = dateFilter.from;
        }
        if (dateFilter.to) {
          sql += ' AND LOG_DATE <= @to';
          params['to'] = dateFilter.to;
        }

        sql += ' ORDER BY LOG_DATE DESC';
        return db.query(sql, { params, signal });
      },

      /**
       * Fetch daily summary (present, absent, late counts) per department for a given date.
       */
      dailySummary(date: string, deptName?: string, signal?: AbortSignal): Promise<QueryResponse<Record<string, unknown>>> {
        const whereClause = deptName
          ? 'WHERE a.LOG_DATE = @date AND e.DEPT = @dept'
          : 'WHERE a.LOG_DATE = @date';
        const params: Record<string, unknown> = { date };

        if (deptName) params['dept'] = deptName;

        return db.query(
          `SELECT e.DEPT,
                  a.STATUS,
                  COUNT(*) AS count
           FROM ATTENDANCE_LOG a
           JOIN HR_EMPLOYEE e ON e.EMP_ID = a.EMP_ID
           ${whereClause}
           GROUP BY e.DEPT, a.STATUS
           ORDER BY e.DEPT, a.STATUS`,
          { params, signal }
        );
      },
    },

    /**
     * Salary / payroll queries.
     * Table: PAYROLL (or equivalent)
     */
    payroll: {
      /**
       * Fetch payroll summary for an employee in a given period.
       * @param employeeId - Employee ID
       * @param period     - Format: 'YYYY-MM' e.g. '2025-03'
       */
      selectByEmployeeAndPeriod(
        employeeId: string | number,
        period: string,
        signal?: AbortSignal
      ): Promise<QueryResponse<Record<string, unknown>>> {
        return db.query(
          `SELECT p.PAY_PERIOD, p.EMP_ID, p.BASIC_SALARY, p.ALLOWANCES,
                  p.DEDUCTIONS, p.NET_SALARY, p.PAYMENT_DATE, p.STATUS
           FROM PAYROLL p
           WHERE p.EMP_ID = @empId AND p.PAY_PERIOD = @period`,
          { params: { empId: employeeId, period }, signal }
        );
      },

      /**
       * Fetch payroll summary for a department in a given period.
       */
      summaryByDepartment(
        period: string,
        deptName?: string,
        signal?: AbortSignal
      ): Promise<QueryResponse<Record<string, unknown>>> {
        const whereClause = deptName
          ? 'WHERE p.PAY_PERIOD = @period AND e.DEPT = @dept'
          : 'WHERE p.PAY_PERIOD = @period';
        const params: Record<string, unknown> = { period };
        if (deptName) params['dept'] = deptName;

        return db.query(
          `SELECT e.DEPT,
                  COUNT(p.EMP_ID) AS employee_count,
                  SUM(p.BASIC_SALARY) AS total_basic,
                  SUM(p.ALLOWANCES)   AS total_allowances,
                  SUM(p.DEDUCTIONS)    AS total_deductions,
                  SUM(p.NET_SALARY)    AS total_net
           FROM PAYROLL p
           JOIN HR_EMPLOYEE e ON e.EMP_ID = p.EMP_ID
           ${whereClause}
           GROUP BY e.DEPT
           ORDER BY e.DEPT`,
          { params, signal }
        );
      },
    },

    /**
     * Generic raw query runner — for tables not covered by the helpers above.
     * Prefer the typed helpers above for stability; use this as a fallback.
     *
     * @param sql    - Raw SQL query string. Parameterised placeholders (`@name`) are supported.
     * @param params - Named parameters object.
     *
     * @example
     * ```ts
     * const rows = await q.raw('SELECT * FROM CUSTOM_TABLE WHERE FLAG = @flag', { flag: 1 });
     * ```
     */
    raw<T = unknown>(
      sql: string,
      params?: Record<string, unknown>,
      signal?: AbortSignal
    ): Promise<QueryResponse<T>> {
      return db.query<T>(sql, { params, signal });
    },
  };
}