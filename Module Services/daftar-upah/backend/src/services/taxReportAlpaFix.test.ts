import { describe, expect, test } from "bun:test";
import ExcelJS from "exceljs";
import { generateMonthlyTaxExcel } from "./taxReportExcelService";
import type { MonthlyTaxRow } from "./taxReportService";

describe("potongan alpa = hari_bulan × upah_dasar − gaji_aktual", () => {
    test("A0924 Herm July: upah_dasar 134500, aktual 3712200, month=7 (31 hari) → alpa = 457300", async () => {
        const emp = {
            no: 1,
            emp_code: "A0924",
            emp_name: "HERUWANSYAH",
            parent_name: "",
            nik: "1906041504960002",
            new_nik: "",
            gender: "L",
            status_ptkp: "TK/0",
            kategori_ter: "TER B",
            upah_dasar: 134500,
            gaji_pokok_aktual: 3712200,
            gaji_pokok_ideal: 3766000, // 134500 × 28
            koreksi_hk: -53800,
            penghasilan_bruto: 3712200,
            pph21_ter: 0,
        } as unknown as MonthlyTaxRow;
        const buf = await generateMonthlyTaxExcel(
            { employees: [emp], period: { month: 7, year: 2026 }, total_pph21: 0 },
            2026, 7, "P1A", "ALL", [], {}
        );
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf as any);
        const sheet = wb.getWorksheet(1)!; // Format Standar Pajak, STD_COL_POT_ALPA = 12, data mulai row 5
        const cell = sheet.getCell(5, 12); // exceljs getCell(row, col)
        const value = cell.value as ExcelJS.CellValue;
        console.log("STD POT. ALPA =", value);
        expect(value).toBe(-457300);
    });
});
