// Stub — Prisma client untuk monthly-aggregate-store.
// Prisma schema sebenarnya: Dashboard_Utama/prisma/schema.prisma
// Regenerate: cd Dashboard_Utama && npx prisma generate
// Stub ini hanya untuk typecheck. Tidak dipakai app consumer (Agustus 2026).

type StoredRow = {
  id: string
  handlerKey: string
  source: string
  period: string
  filterHash: string
  summaryJson: string | null
  chartJson: string | null
  topListsJson: string | null
  trendJson: string | null
  rowCount: number
  builtAt: Date
}

export class PrismaClient {
  monthlyReportAggregate = {
    findUnique: async (_args: { where: any }): Promise<StoredRow | null> => null,
    upsert: async (args: { where: any; create: any; update: any }): Promise<StoredRow> => ({
      ...args.create,
      ...args.update,
      id: '',
      builtAt: new Date(),
    }),
    findMany: async (_args: any): Promise<Array<Partial<StoredRow>>> => [],
    delete: async (_args: { where: any }): Promise<StoredRow> => ({} as StoredRow),
    deleteMany: async (_args: { where?: any }): Promise<{ count: number }> => ({ count: 0 }),
  }
}