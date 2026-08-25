/**
 * @module taxReportDecemberExcel
 * @purpose Generate December PPH21 Excel workbook with 2 sheets: Pajak Desember + Lampiran Uraian Bulanan.
 * @input DecemberTaxRow[] + year/division/gang context
 * @output Buffer (xlsx)
 * @depends exceljs, ../../taxReportService (DecemberTaxRow type)
 * @extractedFrom taxReportExcelService.ts
 */

import ExcelJS from 'exceljs';
import { DecemberTaxRow } from '../../taxReportService';

/**
 * Generate an Excel file containing December Tax Calculations
 * with a secondary sheet for Monthly Breakdown details.
 */
export const generateDecemberTaxExcel = async (
    data: { employees: DecemberTaxRow[] },
    year: number,
    division: string,
    gang: string
): Promise<Buffer> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PT. Rebinmas Jaya - Auto Report System';
    workbook.created = new Date();

    const applyHeaderStyle = (cell: ExcelJS.Cell, bgColor: string, color: string = 'FFFFFF') => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.font = { color: { argb: color }, bold: true, size: 10, name: 'Arial' };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    };

    const numFormat = '#.##0';

    // ==========================================
    // SHEET 1: PAJAK DESEMBER
    // ==========================================
    const mainSheetName = `Pajak Des - ${division} - ${gang || 'ALL'}`;
    const mainSheet = workbook.addWorksheet(mainSheetName.substring(0, 31));

    mainSheet.mergeCells('A1:AG1');
    const titleCell = mainSheet.getCell('A1');
    titleCell.value = `TABULASI PAJAK DESEMBER - DIVISI: ${division} | GANG: ${gang || 'ALL'} | TAHUN: ${year}`;
    titleCell.font = { size: 14, bold: true, name: 'Arial' };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 3: Main Group Headers
    mainSheet.getCell('A3').value = 'IDENTITAS'; mainSheet.mergeCells('A3:F3');
    applyHeaderStyle(mainSheet.getCell('A3'), '1E293B');
    mainSheet.getCell('G3').value = 'STATUS KARYAWAN'; mainSheet.mergeCells('G3:I3');
    applyHeaderStyle(mainSheet.getCell('G3'), '1E293B');
    mainSheet.getCell('J3').value = 'DESEMBER'; mainSheet.mergeCells('J3:N3');
    applyHeaderStyle(mainSheet.getCell('J3'), '1E3A8A');
    mainSheet.getCell('O3').value = 'PENGHASILAN TIDAK TERATUR'; mainSheet.mergeCells('O3:Q3');
    applyHeaderStyle(mainSheet.getCell('O3'), 'B45309');
    mainSheet.getCell('R3').value = 'DISETAHUNKAN'; mainSheet.mergeCells('R3:X3');
    applyHeaderStyle(mainSheet.getCell('R3'), '0284C7');
    mainSheet.getCell('Y3').value = 'PENGURANG'; mainSheet.mergeCells('Y3:AA3');
    applyHeaderStyle(mainSheet.getCell('Y3'), 'B91C1C');
    mainSheet.getCell('AB3').value = 'KALKULASI PAJAK'; mainSheet.mergeCells('AB3:AG3');
    applyHeaderStyle(mainSheet.getCell('AB3'), '15803D');

    // Row 4: Sub Headers
    const mainCols = [
        /* A */ { header: 'NO', width: 5 },
        /* B */ { header: 'NAMA KARYAWAN', width: 25 },
        /* C */ { header: 'NIK / PASPOR', width: 18 },
        /* D */ { header: 'NPWP', width: 20 },
        /* E */ { header: 'ALAMAT', width: 25 },
        /* F */ { header: 'JABATAN', width: 15 },
        /* G */ { header: 'L/P', width: 5 },
        /* H */ { header: 'PTKP', width: 8 },
        /* I */ { header: 'TER', width: 8 },
        /* J */ { header: 'Gaji Pokok', width: 15, group: 'blue' },
        /* K */ { header: 'Total Tunjangan', width: 15, group: 'blue' },
        /* L */ { header: 'Premi Asuransi\n(BPJS+Astek)', width: 15, group: 'blue' },
        /* M */ { header: 'Tunjangan PPh', width: 15, group: 'blue' },
        /* N */ { header: 'Ph. Bruto Des\n(J+K+L+M)', width: 15, group: 'blue' },
        /* O */ { header: 'THR', width: 15, group: 'orange' },
        /* P */ { header: 'BONUS', width: 15, group: 'orange' },
        /* Q */ { header: 'TANTIEM', width: 15, group: 'orange' },
        /* R */ { header: 'Total Gaji Pokok\n(Setahun)', width: 15, group: 'lightblue' },
        /* S */ { header: 'Total Tunj.\nLainnya', width: 15, group: 'lightblue' },
        /* T */ { header: 'Total Premi\nAsuransi', width: 18, group: 'lightblue' },
        /* U */ { header: 'Total Tunj.\nPPh', width: 15, group: 'lightblue' },
        /* V */ { header: 'Total Natura', width: 15, group: 'lightblue' },
        /* W */ { header: 'Total THR/\nBonus', width: 15, group: 'lightblue' },
        /* X */ { header: 'Ph. Bruto\nSetahun\n(R+S+T+U+V+W)', width: 18, group: 'lightblue' },
        /* Y */ { header: 'Biaya Jabatan\n(5%×X, max 6jt)', width: 15, group: 'red' },
        /* Z */ { header: 'Total Iuran\nJHT/JP', width: 18, group: 'red' },
        /* AA */ { header: 'Ph. Netto\nSetahun\n(X-Y-Z)', width: 18, group: 'red' },
        /* AB */ { header: 'PTKP', width: 15, group: 'green' },
        /* AC */ { header: 'PKP\n(AA-AB)', width: 15, group: 'green' },
        /* AD */ { header: 'PPh 21\nSetahun', width: 18, group: 'green' },
        /* AE */ { header: 'PPh 21\nNon NPWP', width: 18, group: 'green' },
        /* AF */ { header: 'PPh 21\nJan S.D Nop', width: 18, group: 'green' },
        /* AG */ { header: 'PPh 21\nDesember\n(AD-AF)', width: 18, group: 'green' },
    ];

    mainSheet.columns = mainCols.map((col, idx) => ({ key: `col${idx}`, width: col.width }));

    mainCols.forEach((col, index) => {
        const cell = mainSheet.getCell(4, index + 1);
        cell.value = col.header;
        let bgColor = 'F8FAFC';
        let fgColor = '0F172A';
        if (col.group === 'blue') { bgColor = '1E3A8A'; fgColor = 'FFFFFF'; }
        else if (col.group === 'orange') { bgColor = 'B45309'; fgColor = 'FFFFFF'; }
        else if (col.group === 'lightblue') { bgColor = '0284C7'; fgColor = 'FFFFFF'; }
        else if (col.group === 'red') { bgColor = 'B91C1C'; fgColor = 'FFFFFF'; }
        else if (col.group === 'green') { bgColor = '15803D'; fgColor = 'FFFFFF'; }
        applyHeaderStyle(cell, bgColor, fgColor);
    });
    mainSheet.getRow(4).height = 45;

    let mainRowIdx = 5;
    data.employees.forEach((emp) => {
        const row = mainSheet.getRow(mainRowIdx);
        const r = mainRowIdx;

        // Static data (cols A-I: 1-9)
        row.getCell(1).value = emp.no;
        row.getCell(2).value = emp.emp_name;
        row.getCell(3).value = emp.new_nik || emp.nik;
        row.getCell(4).value = emp.npwp;
        row.getCell(5).value = emp.alamat;
        row.getCell(6).value = emp.jabatan;
        row.getCell(7).value = emp.gender;
        row.getCell(8).value = emp.status_ptkp;
        row.getCell(9).value = emp.kategori_ter;

        // Desember (J-N: cols 10-14)
        row.getCell(10).value = emp.gaji_pokok_des;   // J: Gaji Pokok Des
        row.getCell(11).value = emp.tunjangan_des;     // K: Total Tunjangan Des
        row.getCell(12).value = emp.premi_asuransi_des; // L: Premi Asuransi Des
        row.getCell(13).value = emp.tunjangan_pph_des;  // M: Tunjangan PPh Des
        // N: Ph Bruto Des = J + K + L + M
        row.getCell(14).value = { formula: `J${r}+K${r}+L${r}+M${r}`, result: emp.bruto_des };

        // Pendapatan Tidak Teratur (O-Q: cols 15-17)
        row.getCell(15).value = emp.thr;      // O
        row.getCell(16).value = emp.bonus;    // P
        row.getCell(17).value = emp.tantiem;  // Q

        // Disetahunkan (R-X: cols 18-24)
        row.getCell(18).value = emp.gaji_pokok_setahun;        // R
        row.getCell(19).value = emp.tunjangan_lainnya_setahun; // S
        row.getCell(20).value = emp.premi_asuransi_setahun;    // T
        row.getCell(21).value = emp.tunjangan_pph_setahun;     // U
        row.getCell(22).value = emp.natura_setahun;            // V
        row.getCell(23).value = emp.thr_bonus_tantiem_setahun; // W
        // X: Ph Bruto Setahun = R+S+T+U+V+W
        row.getCell(24).value = { formula: `R${r}+S${r}+T${r}+U${r}+V${r}+W${r}`, result: emp.bruto_setahun };

        // Pengurang (Y-AA: cols 25-27)
        // Y: Biaya Jabatan = MIN(X*5%, 6000000)
        row.getCell(25).value = { formula: `MIN(X${r}*0.05,6000000)`, result: emp.biaya_jabatan };
        row.getCell(26).value = emp.iuran_jht_jp_setahun;  // Z
        // AA: Netto = X - Y - Z
        row.getCell(27).value = { formula: `X${r}-Y${r}-Z${r}`, result: emp.netto_setahun };

        // Kalkulasi Pajak (AB-AG: cols 28-33)
        row.getCell(28).value = emp.ptkp;           // AB
        // AC: PKP = AA - AB (min 0)
        row.getCell(29).value = { formula: `MAX(AA${r}-AB${r},0)`, result: emp.pkp };
        row.getCell(30).value = emp.pph21_setahun;  // AD
        // AE: PPh21 Non NPWP = AD × 120%
        row.getCell(31).value = { formula: `AD${r}*1.2`, result: emp.pph21_setahun };
        row.getCell(32).value = emp.pph21_jan_nov;  // AF
        // AG: PPh21 Desember = AD - AF
        row.getCell(33).value = { formula: `AD${r}-AF${r}`, result: emp.pph21_desember };

        // Number formats
        for (let c = 10; c <= 33; c++) {
            row.getCell(c).numFmt = numFormat;
        }

        // Borders
        for (let c = 1; c <= 33; c++) {
            row.getCell(c).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }

        // Highlight December PPh21
        row.getCell(33).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1E7DD' } };
        row.getCell(33).font = { color: { argb: '0F5132' }, bold: true };

        mainRowIdx++;
    });

    // Main Sheet Grand Total
    const mainFooter = mainSheet.getRow(mainRowIdx);
    mainSheet.mergeCells(`A${mainRowIdx}:I${mainRowIdx}`);
    mainFooter.getCell('A').value = 'GRAND TOTAL';
    mainFooter.getCell('A').alignment = { horizontal: 'right', vertical: 'middle' };
    mainFooter.getCell('A').font = { bold: true };
    mainFooter.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };

    for (let c = 10; c <= 33; c++) {
        const cell = mainFooter.getCell(c);
        cell.value = { formula: `SUM(${mainSheet.getColumn(c).letter}5:${mainSheet.getColumn(c).letter}${mainRowIdx - 1})` };
        cell.numFmt = numFormat;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
        cell.border = { top: { style: 'medium' }, left: { style: 'thin' }, bottom: { style: 'medium' }, right: { style: 'thin' } };
    }
    mainFooter.getCell(33).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1E7DD' } };
    mainFooter.getCell(33).font = { color: { argb: '0F5132' }, bold: true };

    // ==========================================
    // SHEET 2: LAMPIRAN URAIAN BULANAN
    // ==========================================
    const detailSheetName = `Uraian Bulanan_Des_${year}`;
    const detailSheet = workbook.addWorksheet(detailSheetName.substring(0, 31));

    const detailCols = [
        { header: 'NO', width: 5 }, { header: 'NAMA KARYAWAN', width: 25 }, { header: 'NIK', width: 15 },
        { header: 'KOMPONEN', width: 22 },
        { header: 'JAN', width: 12 }, { header: 'FEB', width: 12 }, { header: 'MAR', width: 12 },
        { header: 'APR', width: 12 }, { header: 'MEI', width: 12 }, { header: 'JUN', width: 12 },
        { header: 'JUL', width: 12 }, { header: 'AGU', width: 12 }, { header: 'SEP', width: 12 },
        { header: 'OKT', width: 12 }, { header: 'NOV', width: 12 }, { header: 'DES', width: 12 },
        { header: 'TOTAL SETAHUN\n(SUM Jan-Des)', width: 16 }
    ];
    detailSheet.columns = detailCols.map((col, idx) => ({ key: `col${idx}`, width: col.width }));

    detailSheet.getRow(1).height = 35;
    detailCols.forEach((col, index) => {
        const cell = detailSheet.getCell(1, index + 1);
        cell.value = col.header;
        applyHeaderStyle(cell, '1E293B', 'FFFFFF');
    });

    let detailRowIdx = 2;
    const components = [
        { key: 'gaji_pokok', label: '1. Gaji Pokok' },
        { key: 'tunjangan', label: '2. Tunjangan' },
        { key: 'premi_asuransi', label: '3. Premi Asuransi\n(BPJS Kes 4%+Astek 0.84%)' },
        { key: 'iuran_pensiun', label: '4. Iuran Pensiun' },
        { key: 'pph21', label: '5. PPh 21' }
    ];

    data.employees.forEach((emp, i) => {
        components.forEach((comp, cIdx) => {
            const row = detailSheet.getRow(detailRowIdx);

            if (cIdx === 0) {
                row.getCell(1).value = i + 1;
                row.getCell(2).value = emp.emp_name;
                row.getCell(3).value = emp.new_nik || emp.nik;
            }

            row.getCell(4).value = comp.label;

            let firstCellAddr = '';
            let lastCellAddr = '';

            for (let m = 1; m <= 12; m++) {
                const key = comp.key as keyof typeof emp.monthly_breakdown;
                const val = emp.monthly_breakdown?.[key]?.[String(m)] || 0;
                const cell = row.getCell(4 + m);
                cell.value = val;
                cell.numFmt = numFormat;
                if (m === 1) firstCellAddr = cell.address;
                if (m === 12) lastCellAddr = cell.address;
            }

            // Total Column with SUM formula
            const totalCell = row.getCell(17);
            if (firstCellAddr && lastCellAddr) {
                totalCell.value = { formula: `SUM(${firstCellAddr}:${lastCellAddr})` };
            }
            totalCell.numFmt = numFormat;
            totalCell.font = { bold: true };

            // Borders
            for (let colId = 1; colId <= 17; colId++) {
                row.getCell(colId).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }

            if (i % 2 !== 0) {
                for (let colId = 1; colId <= 17; colId++) {
                    const c = row.getCell(colId);
                    if (!c.fill || (c.fill as any).fgColor === undefined) {
                        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
                    }
                }
            }

            detailRowIdx++;
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    
    // Explicit Memory Cleanup
    try {
        workbook.removeWorksheet(mainSheet.id);
        if (detailSheet) workbook.removeWorksheet(detailSheet.id);
    } catch(e) {}
    
    return Buffer.from(buffer);
};
