-- CreateTable
CREATE TABLE "MonthlyReportAggregate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handlerKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "filterHash" TEXT NOT NULL,
    "summaryJson" TEXT NOT NULL,
    "chartJson" TEXT,
    "topListsJson" TEXT,
    "trendJson" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "builtAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "MonthlyReportAggregate_handlerKey_period_idx" ON "MonthlyReportAggregate"("handlerKey", "period");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReportAggregate_handlerKey_source_period_filterHash_key" ON "MonthlyReportAggregate"("handlerKey", "source", "period", "filterHash");
