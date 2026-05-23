/**
 * lib/mock-data.ts
 * Comprehensive mock data for all 9 modules of the PT Rebinmas Report Center.
 * Defines the shared Report type and helper functions used across the app.
 */

// ─── Shared Report type ────────────────────────────────────────────────────────

export interface Report {
  id: string
  moduleId: string
  name: string
  category: string
  description: string
  lastRun: string
  status: 'completed' | 'running' | 'scheduled' | 'failed'
  rowCount: number
}

// ─── Raw records — moduleId injected below ────────────────────────────────────

const RAW_REPORTS: Omit<Report, 'moduleId'>[] = [
  // ── Inventory ──────────────────────────────────────────────────────────
  {
    id: 'inv-stok-gudang',
    name: 'Laporan Stok per Gudang',
    category: 'Stock Position',
    description: 'Posisi stok terkini per gudang, jumlah item, dan nilai persediaan.',
    lastRun: new Date(Date.now() - 1 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 1240,
  },
  {
    id: 'inv-movement-harian',
    name: 'Movement Harian',
    category: 'Inventory Movement',
    description: 'Penerimaan dan pengeluaran barang per hari dengan running balance.',
    lastRun: new Date(Date.now() - 2 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 8560,
  },
  {
    id: 'inv-valuasi',
    name: 'Valuasi Persediaan',
    category: 'Valuation & Cost',
    description: 'Nilai persediaan berdasarkan metode rata-rata tertimbang dan FIFO.',
    lastRun: new Date(Date.now() - 3 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 640,
  },
  {
    id: 'inv-aging',
    name: 'Aging Analysis',
    category: 'Aging & Expiry',
    description: 'Analisis umur persediaan untuk mendeteksi slow-moving dan dead stock.',
    lastRun: new Date(Date.now() - 26 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 3200,
  },
  {
    id: 'inv-stock-opname',
    name: 'Stock Opname',
    category: 'Stock Take',
    description: 'Daftar selisih hasil stock opname fisik vs sistem per gudang.',
    lastRun: new Date(Date.now() - 7 * 86400_000).toISOString(),
    status: 'scheduled',
    rowCount: 312,
  },
  {
    id: 'inv-reorder-point',
    name: 'Reorder Point Alert',
    category: 'Alerts',
    description: 'Daftar barang yang mencapai titik reorder minimum.',
    lastRun: new Date(Date.now() - 12 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 87,
  },
  {
    id: 'inv-expired',
    name: 'Barang Kadaluarsa',
    category: 'Expiry',
    description: 'Daftar batch barang yang sudah atau akan kadaluarsa dalam 30 hari.',
    lastRun: new Date(Date.now() - 36 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 145,
  },

  // ── Absensi ──────────────────────────────────────────────────────────────
  {
    id: 'abs-daftar-hadir',
    name: 'Daftar Hadir Harian',
    category: 'Daily Attendance',
    description: 'Rekap kehadiran harian seluruh karyawan, termasuk jam masuk dan pulang.',
    lastRun: new Date(Date.now() - 2 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 2840,
  },
  {
    id: 'abs-rekap-bulanan',
    name: 'Rekap Bulanan Absensi',
    category: 'Monthly Summary',
    description: 'Ringkasan kehadiran per bulan per departemen dan total HK realization.',
    lastRun: new Date(Date.now() - 86400_000).toISOString(),
    status: 'completed',
    rowCount: 4120,
  },
  {
    id: 'abs-cuti-kadaluarsa',
    name: 'Kadaluarsa Cuti',
    category: 'Leave Management',
    description: 'Daftar cuti karyawan yang akan expired dalam 30 hari ke depan.',
    lastRun: new Date(Date.now() - 1 * 3600_000).toISOString(),
    status: 'running',
    rowCount: 0,
  },
  {
    id: 'abs-lembur',
    name: 'Lembur Karyawan',
    category: 'Overtime',
    description: 'Rekap jam lembur per karyawan dan total biaya lembur per periode.',
    lastRun: new Date(Date.now() - 86400_000).toISOString(),
    status: 'completed',
    rowCount: 870,
  },
  {
    id: 'abs-dispensasi',
    name: 'Dispensasi & Izin',
    category: 'Permits',
    description: 'Daftar dispensasi dan izin khusus karyawan yang disetujui.',
    lastRun: new Date(Date.now() - 172800_000).toISOString(),
    status: 'completed',
    rowCount: 234,
  },
  {
    id: 'abs-karyawan-nonaktif',
    name: 'Karyawan Non-Aktif',
    category: 'Status Tracking',
    description: 'Karyawan yang tidak mengisi daftar hadir lebih dari 3 hari berturut-turut.',
    lastRun: new Date(Date.now() - 6 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 58,
  },

  // ── Payroll ──────────────────────────────────────────────────────────────
  {
    id: 'pay-gaji-bulanan',
    name: 'Gaji Bulanan',
    category: 'Salary',
    description: 'Daftar gaji bersih per karyawan termasuk tunjangan dan potongan.',
    lastRun: new Date(Date.now() - 2 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 1540,
  },
  {
    id: 'pay-potongan',
    name: 'Daftar Potongan',
    category: 'Deductions',
    description: 'Rincian semua potongan: pajak, bpjs, kasbon, dan lainnya.',
    lastRun: new Date(Date.now() - 2 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 4620,
  },
  {
    id: 'pay-transfer',
    name: 'Daftar Transfer Bank',
    category: 'Bank Transfer',
    description: 'Data transfer gaji ke bank untuk proses bulk payment.',
    lastRun: new Date(Date.now() - 2 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 1510,
  },
  {
    id: 'pay-bpjs',
    name: 'Kartu BPJS',
    category: 'Benefits',
    description: 'Kartu BPJS Kesehatan dan Ketenagakerjaan per karyawan.',
    lastRun: new Date(Date.now() - 17 * 86400_000).toISOString(),
    status: 'scheduled',
    rowCount: 1540,
  },
  {
    id: 'pay-rekap-pph',
    name: 'Rekap PPH 21',
    category: 'Tax',
    description: 'Daftar penghasilan bruto dan PPH 21 per karyawan per tahun.',
    lastRun: new Date(Date.now() - 46 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 1540,
  },
  {
    id: 'pay-thr',
    name: 'THR Karyawan',
    category: 'Benefits',
    description: 'Perhitungan Tunjangan Hari Raya berdasarkan masa kerja.',
    lastRun: new Date(Date.now() - 10 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 1430,
  },

  // ── Daftar Upah ─────────────────────────────────────────────────────────
  {
    id: 'du-reguler',
    name: 'Daftar Upah Reguler',
    category: 'Wage Register',
    description: 'Daftar upah harian reguler per blok dan nama mandor.',
    lastRun: new Date(Date.now() - 2 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 6230,
  },
  {
    id: 'du-hk-summary',
    name: 'HK Summary',
    category: 'Attendance',
    description: 'Ringkasan total Hari Kerja (HK) realization vs target per estate.',
    lastRun: new Date(Date.now() - 2 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 210,
  },
  {
    id: 'du-borongan',
    name: 'Upah Borongan',
    category: 'Piece Rate',
    description: 'Perhitungan upah borongan panen dan konservasi per blok.',
    lastRun: new Date(Date.now() - 2 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 3880,
  },
  {
    id: 'du-rekap-bulanan',
    name: 'Rekap Bulanan Estate',
    category: 'Monthly Summary',
    description: 'Gabungan seluruh daftar upah dalam satu periode bulanan.',
    lastRun: new Date(Date.now() - 16 * 86400_000).toISOString(),
    status: 'scheduled',
    rowCount: 10450,
  },
  {
    id: 'du-bonus',
    name: 'Bonus Produktifitas Estate',
    category: 'Incentive',
    description: 'Bonus produktifitas berdasarkan pencapaian target yield per divisi.',
    lastRun: new Date(Date.now() - 8 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 720,
  },

  // ── Premi & Lembur ──────────────────────────────────────────────────────
  {
    id: 'premi-lembur',
    name: 'Lembur Harian & Mingguan',
    category: 'Overtime',
    description: 'Daftar jam lembur dan biaya lembur per karyawan per periode.',
    lastRun: new Date(Date.now() - 2 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 960,
  },
  {
    id: 'premi-produksi',
    name: 'Premi Produktifitas',
    category: 'Incentive',
    description: 'Bonus produksi berdasarkan pencapaian target yield per divisi.',
    lastRun: new Date(Date.now() - 2 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 480,
  },
  {
    id: 'premi-libur',
    name: 'Premi Hari Libur',
    category: 'Holiday Premium',
    description: 'Perhitungan premi lembur pada hari libur nasional.',
    lastRun: new Date(Date.now() - 12 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 320,
  },
  {
    id: 'premi-cuti',
    name: 'Premi Cuti Tahunan',
    category: 'Leave Bonus',
    description: 'Tunjangan cuti tahunan yang dibayarkan saat karyawan take leave.',
    lastRun: new Date(Date.now() - 17 * 86400_000).toISOString(),
    status: 'scheduled',
    rowCount: 580,
  },
  {
    id: 'premi-kategori',
    name: 'Rincian Premi per Kategori',
    category: 'Breakdown',
    description: 'Rincian premi per kategori: panen, konservasi, pemeliharaan.',
    lastRun: new Date(Date.now() - 5 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 2100,
  },

  // ── Produktivitas ────────────────────────────────────────────────────────
  {
    id: 'pro-harvest',
    name: 'Produktivitas Panen Harian',
    category: 'Harvest Output',
    description: 'Output panen harian per blok, HK realization, dan kg per HK.',
    lastRun: new Date(Date.now() - 1 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 2160,
  },
  {
    id: 'pro-manhour',
    name: 'Efisiensi Man Hour',
    category: 'Man Hour',
    description: 'Rasio produktivitas: kg hasil per jam kerja per divisi.',
    lastRun: new Date(Date.now() - 14 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 840,
  },
  {
    id: 'pro-kpi',
    name: 'KPI Dashboard',
    category: 'KPI',
    description: 'Dashboard KPI utama meliputi yield, efficiency, dan cost per kg.',
    lastRun: new Date(Date.now() - 30 * 3600_000).toISOString(),
    status: 'running',
    rowCount: 0,
  },
  {
    id: 'pro-abc',
    name: 'ABC Analysis Produksi',
    category: 'Analytics',
    description: 'Analisis ABC output based on volume contribution per category.',
    lastRun: new Date(Date.now() - 3 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 1280,
  },
  {
    id: 'pro-cost',
    name: 'Cost per KG Analysis',
    category: 'Cost Analysis',
    description: 'Analisis biaya produksi per kilogram per divisi dan per bulan.',
    lastRun: new Date(Date.now() - 4 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 620,
  },
  {
    id: 'pro-yield',
    name: 'Yield per Blok Report',
    category: 'Yield',
    description: 'Ringkasan yield per blok dan per estate untuk evaluasi produktivitas.',
    lastRun: new Date(Date.now() - 2 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 420,
  },
  {
    id: 'pro-trend',
    name: 'Trend Produksi Bulanan',
    category: 'Trend Analysis',
    description: 'Tren produksi 12 bulan terakhir per estate dan divisi.',
    lastRun: new Date(Date.now() - 86400_000).toISOString(),
    status: 'completed',
    rowCount: 144,
  },

  // ── Karyawan ────────────────────────────────────────────────────────────
  {
    id: 'kar-master',
    name: 'Master Data Karyawan',
    category: 'Employee Master',
    description: 'Data master seluruh karyawan termasuk status, jabatan, dan lokasi.',
    lastRun: new Date(Date.now() - 1 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 1540,
  },
  {
    id: 'kar-kontrak',
    name: 'Status Kontrak',
    category: 'Contract Status',
    description: 'Daftar karyawan dengan status kontrak dan tanggal berakhirnya.',
    lastRun: new Date(Date.now() - 1 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 890,
  },
  {
    id: 'kar-training',
    name: 'Riwayat Pelatihan',
    category: 'Training',
    description: 'Riwayat pelatihan dan sertifikasi karyawan per periode.',
    lastRun: new Date(Date.now() - 7 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 3200,
  },
  {
    id: 'kar-resign',
    name: 'Karyawan Keluar',
    category: 'Turnover',
    description: 'Daftar karyawan yang resign atau kontraknya tidak diperpanjang.',
    lastRun: new Date(Date.now() - 17 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 45,
  },
  {
    id: 'kar-sdm',
    name: 'Laporan SDM Bulanan',
    category: 'HR Report',
    description: 'Rekap seluruh aktivitas SDM bulan berjalan: masuk, keluar, mutasi.',
    lastRun: new Date(Date.now() - 16 * 86400_000).toISOString(),
    status: 'scheduled',
    rowCount: 2100,
  },
  {
    id: 'kar-mutasi',
    name: 'Mutasi Karyawan',
    category: 'Mutation',
    description: 'Daftar mutasi karyawan antar divisi, estate, dan departemen.',
    lastRun: new Date(Date.now() - 9 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 178,
  },

  // ── Estate / Divisi ──────────────────────────────────────────────────────
  {
    id: 'est-produksi',
    name: 'Produksi Estate Harian',
    category: 'Daily Production',
    description: 'Data produksi harian per blok meliputi berat, quality, dan HK realization.',
    lastRun: new Date(Date.now() - 1 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 1850,
  },
  {
    id: 'est-block',
    name: 'Block Yield Report',
    category: 'Block Analysis',
    description: 'Ringkasan yield per blok dan per estate untuk evaluasi produktivitas.',
    lastRun: new Date(Date.now() - 14 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 420,
  },
  {
    id: 'est-harvest-sched',
    name: 'Jadwal Panen',
    category: 'Harvest Schedule',
    description: 'Jadwal panen blok untuk 14 hari ke depan berdasarkan ripeness survey.',
    lastRun: new Date(Date.now() - 2 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 310,
  },
  {
    id: 'est-cost',
    name: 'Cost per KG',
    category: 'Cost Analysis',
    description: 'Analisis biaya produksi per kilogram per divisi dan per bulan.',
    lastRun: new Date(Date.now() - 17 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 180,
  },
  {
    id: 'est-divisi',
    name: 'Daftar Divisi Estate',
    category: 'Division Master',
    description: 'Data master seluruh divisi estate dengan luas tanam dan populasi.',
    lastRun: new Date(Date.now() - 5 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 38,
  },
  {
    id: 'est-sdm-manajemen',
    name: 'SDM Manajemen Estate',
    category: 'HR',
    description: 'Jumlah karyawan tetap dan harian per divisi estate.',
    lastRun: new Date(Date.now() - 10 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 210,
  },
  {
    id: 'est-realisasi-tbs',
    name: 'Realisasi TBS Bulanan',
    category: 'TBS',
    description: 'Perbandingan target vs realiasi TBS per estate per bulan.',
    lastRun: new Date(Date.now() - 3 * 86400_000).toISOString(),
    status: 'completed',
    rowCount: 96,
  },

  // ── Integrasi & Audit ───────────────────────────────────────────────────
  {
    id: 'int-audit',
    name: 'Audit Trail',
    category: 'Audit',
    description: 'Log seluruh perubahan data lintas modul dengan timestamp dan user.',
    lastRun: new Date(Date.now() - 1 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 12400,
  },
  {
    id: 'int-sync',
    name: 'Sync Status',
    category: 'Integration',
    description: 'Status sinkronisasi data antar sistem: SP, Gudang, dan Payroll.',
    lastRun: new Date(Date.now() - 1 * 3600_000).toISOString(),
    status: 'running',
    rowCount: 0,
  },
  {
    id: 'int-error',
    name: 'Integration Errors',
    category: 'Error Log',
    description: 'Daftar transaksi gagal sinkron dan action plan penanganannya.',
    lastRun: new Date(Date.now() - 2 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 87,
  },
  {
    id: 'int-health',
    name: 'System Health Log',
    category: 'Health Check',
    description: 'Status kesehatan seluruh service dan endpoint API integrasi.',
    lastRun: new Date(Date.now() - 1 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 240,
  },
  {
    id: 'int-data-quality',
    name: 'Data Quality Score',
    category: 'Data Quality',
    description: 'Skor kualitas data per modul berdasarkan completeness dan accuracy.',
    lastRun: new Date(Date.now() - 26 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 18,
  },
  {
    id: 'int-sync-log',
    name: 'Sync Log Detail',
    category: 'Integration',
    description: 'Log detail proses sinkronisasi per transaksi dan per modul.',
    lastRun: new Date(Date.now() - 4 * 3600_000).toISOString(),
    status: 'completed',
    rowCount: 8430,
  },
]

// ─── Module → IDs map ──────────────────────────────────────────────────────────

const MODULE_IDS: Record<string, string[]> = {
  inventory:    ['inv-stok-gudang','inv-movement-harian','inv-valuasi','inv-aging',
                 'inv-stock-opname','inv-reorder-point','inv-expired'],
  absensi:      ['abs-daftar-hadir','abs-rekap-bulanan','abs-cuti-kadaluarsa','abs-lembur',
                 'abs-dispensasi','abs-karyawan-nonaktif'],
  payroll:      ['pay-gaji-bulanan','pay-potongan','pay-transfer','pay-bpjs',
                 'pay-rekap-pph','pay-thr'],
  'daftar-upah':['du-reguler','du-hk-summary','du-borongan','du-rekap-bulanan','du-bonus'],
  premi:        ['premi-lembur','premi-produksi','premi-libur','premi-cuti','premi-kategori'],
  produktivitas:['pro-harvest','pro-manhour','pro-kpi','pro-abc','pro-cost','pro-yield','pro-trend'],
  karyawan:     ['kar-master','kar-kontrak','kar-training','kar-resign','kar-sdm','kar-mutasi'],
  estate:       ['est-produksi','est-block','est-harvest-sched','est-cost',
                 'est-divisi','est-sdm-manajemen','est-realisasi-tbs'],
  integrasi:    ['int-audit','int-sync','int-error','int-health','int-data-quality','int-sync-log'],
}

// ─── Build lookup ──────────────────────────────────────────────────────────────

const reportMap = new Map<string, Report>()

for (const [moduleId, ids] of Object.entries(MODULE_IDS)) {
  for (const id of ids) {
    const base = RAW_REPORTS.find((r) => r.id === id)
    if (base) reportMap.set(id, { ...base, moduleId })
  }
}

// ─── Public helpers ─────────────────────────────────────────────────────────────

/** Returns reports for a given moduleId. Pass undefined to get all reports. */
export function getMockReportsByModule(moduleId?: string): Report[] {
  if (!moduleId) return Array.from(reportMap.values())
  return (MODULE_IDS[moduleId] ?? []).map((id) => reportMap.get(id)!).filter(Boolean)
}

/** Returns a single report by id, or undefined. */
export function getMockReportById(id: string): Report | undefined {
  return reportMap.get(id)
}

/** All 9 module IDs present in the dataset. */
export const ALL_MODULES = Object.keys(MODULE_IDS)
