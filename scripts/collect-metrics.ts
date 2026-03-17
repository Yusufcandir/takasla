/**
 * collect-metrics.ts
 *
 * Queries trade_db, dispute_db, and reputation_db directly (pg client)
 * and outputs two files:
 *   - metrics-report.json  — structured JSON for programmatic use
 *   - metrics-report.csv   — per-risk-level summary for spreadsheet import
 *
 * Prerequisites: docker-compose.dev.yml must be running with trade data present.
 *
 * Usage:
 *   npx ts-node scripts/collect-metrics.ts
 *   # or via root package.json:
 *   pnpm metrics
 *
 * Env overrides (all optional, defaults shown):
 *   TRADE_DB_HOST=localhost  TRADE_DB_PORT=5437
 *   DISPUTE_DB_HOST=localhost  DISPUTE_DB_PORT=5439
 *   REPUTATION_DB_HOST=localhost  REPUTATION_DB_PORT=5438
 *   DB_USER=exchange  DB_PASSWORD=exchange_dev_password
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ─── Config ──────────────────────────────────────────────────────────────────

const DB_USER = process.env.DB_USER ?? 'exchange';
const DB_PASSWORD = process.env.DB_PASSWORD ?? 'exchange_dev_password';

const tradeDsn = {
  host: process.env.TRADE_DB_HOST ?? 'localhost',
  port: Number(process.env.TRADE_DB_PORT ?? 5437),
  user: DB_USER,
  password: DB_PASSWORD,
  database: 'trade_db',
};

const disputeDsn = {
  host: process.env.DISPUTE_DB_HOST ?? 'localhost',
  port: Number(process.env.DISPUTE_DB_PORT ?? 5439),
  user: DB_USER,
  password: DB_PASSWORD,
  database: 'dispute_db',
};

const reputationDsn = {
  host: process.env.REPUTATION_DB_HOST ?? 'localhost',
  port: Number(process.env.REPUTATION_DB_PORT ?? 5438),
  user: DB_USER,
  password: DB_PASSWORD,
  database: 'reputation_db',
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface PerRiskMetrics {
  riskLevel: string;
  totalCreated: number;
  totalCompleted: number;
  completionRate: string;
  totalDisputed: number;
  disputeRate: string;
  avgDurationMinutes: string;
  avgStepDurationSeconds: string;
}

interface OverallMetrics {
  totalTrades: number;
  totalCertificatesIssued: number;
  avgTrustScoreDelta: string;
  systemOverheadMs: string;
  collectedAt: string;
}

interface MetricsReport {
  overall: OverallMetrics;
  perRiskLevel: PerRiskMetrics[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function withClient<T>(dsn: object, fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client(dsn);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '0.00%';
  return ((numerator / denominator) * 100).toFixed(2) + '%';
}

// ─── Queries ─────────────────────────────────────────────────────────────────

async function collectTradeMetrics(): Promise<{
  perRisk: PerRiskMetrics[];
  overall: Pick<OverallMetrics, 'totalTrades' | 'systemOverheadMs'>;
}> {
  return withClient(tradeDsn, async (client) => {
    // Per risk level: total, completed, avg duration
    const riskRows = await client.query<{
      risk_level: string;
      total_created: string;
      total_completed: string;
      avg_duration_minutes: string;
    }>(`
      SELECT
        risk_level,
        COUNT(*)                                                         AS total_created,
        COUNT(*) FILTER (WHERE state = 'COMPLETED')                      AS total_completed,
        COALESCE(
          ROUND(
            AVG(
              EXTRACT(EPOCH FROM (completed_at - created_at)) / 60.0
            ) FILTER (WHERE completed_at IS NOT NULL),
            2
          ),
          0
        )                                                                AS avg_duration_minutes
      FROM trades
      GROUP BY risk_level
      ORDER BY risk_level
    `);

    // Per risk level: avg time between consecutive events (system overhead)
    const stepRows = await client.query<{
      risk_level: string;
      avg_step_seconds: string;
    }>(`
      SELECT
        t.risk_level,
        ROUND(
          AVG(
            EXTRACT(EPOCH FROM (e2.created_at - e1.created_at))
          ),
          3
        ) AS avg_step_seconds
      FROM trade_events e1
      JOIN trade_events e2
        ON e1.trade_id = e2.trade_id
        AND e2.created_at > e1.created_at
      JOIN trades t ON t.id = e1.trade_id
      GROUP BY t.risk_level
      ORDER BY t.risk_level
    `);

    // Total trades across all states
    const totalRow = await client.query<{ total: string }>('SELECT COUNT(*) AS total FROM trades');

    // Avg time between consecutive trade_events (global system overhead)
    const overheadRow = await client.query<{ avg_ms: string }>(`
      SELECT ROUND(AVG(
        EXTRACT(EPOCH FROM (e2.created_at - e1.created_at)) * 1000
      ), 2) AS avg_ms
      FROM trade_events e1
      JOIN trade_events e2
        ON e1.trade_id = e2.trade_id
        AND e2.created_at > e1.created_at
    `);

    const stepMap = new Map(stepRows.rows.map((r) => [r.risk_level, r.avg_step_seconds]));

    const perRisk: PerRiskMetrics[] = riskRows.rows.map((r) => {
      const total = parseInt(r.total_created, 10);
      const completed = parseInt(r.total_completed, 10);
      return {
        riskLevel: r.risk_level,
        totalCreated: total,
        totalCompleted: completed,
        completionRate: pct(completed, total),
        totalDisputed: 0,   // filled in later from dispute_db
        disputeRate: '0.00%',
        avgDurationMinutes: r.avg_duration_minutes ?? '0',
        avgStepDurationSeconds: stepMap.get(r.risk_level) ?? '0',
      };
    });

    return {
      perRisk,
      overall: {
        totalTrades: parseInt(totalRow.rows[0]?.total ?? '0', 10),
        systemOverheadMs: overheadRow.rows[0]?.avg_ms ?? '0',
      },
    };
  });
}

async function collectDisputeMetrics(): Promise<Map<string, number>> {
  // Returns tradeId → count of disputes per trade
  return withClient(disputeDsn, async (client) => {
    const rows = await client.query<{ trade_id: string; dispute_count: string }>(
      'SELECT trade_id, COUNT(*) AS dispute_count FROM disputes GROUP BY trade_id',
    );
    return new Map(rows.rows.map((r) => [r.trade_id, parseInt(r.dispute_count, 10)]));
  }).catch(() => {
    console.warn('[metrics] dispute_db unreachable — dispute metrics will be zero');
    return new Map<string, number>();
  });
}

async function collectCertificateCount(): Promise<number> {
  // Query trade_db for certificate count proxy via outbox events (actual cert DB not queried
  // to keep deps minimal; alternatively connect to cert_db if available)
  try {
    return await withClient(
      { ...tradeDsn, database: 'certificate_db', port: Number(process.env.CERT_DB_PORT ?? 5440) },
      async (client) => {
        const row = await client.query<{ total: string }>('SELECT COUNT(*) AS total FROM certificates');
        return parseInt(row.rows[0]?.total ?? '0', 10);
      },
    );
  } catch {
    console.warn('[metrics] certificate_db unreachable — cert count will be 0');
    return 0;
  }
}

async function collectTrustScoreDelta(): Promise<string> {
  return withClient(reputationDsn, async (client) => {
    const row = await client.query<{ avg_delta: string }>(`
      SELECT ROUND(AVG(ABS(s2.score - s1.score)), 2) AS avg_delta
      FROM trust_score_snapshots s1
      JOIN trust_score_snapshots s2
        ON s1.user_id = s2.user_id
        AND s2.snapshot_at > s1.snapshot_at
    `);
    return row.rows[0]?.avg_delta ?? '0';
  }).catch(() => {
    console.warn('[metrics] reputation_db unreachable — trust delta will be 0');
    return '0';
  });
}

async function collectDisputeCountsPerRisk(): Promise<Map<string, number>> {
  // We need to know the risk_level for each dispute's trade.
  // Since dispute_db only has trade_id, we cross-reference with trade_db.
  return withClient(tradeDsn, async (client) => {
    const rows = await client.query<{ risk_level: string; dispute_count: string }>(`
      SELECT
        t.risk_level,
        COUNT(DISTINCT o.aggregate_id) AS dispute_count
      FROM outbox o
      JOIN trades t ON t.id = o.aggregate_id
      WHERE o.event_type LIKE '%dispute%opened%'
      GROUP BY t.risk_level
    `);
    return new Map(rows.rows.map((r) => [r.risk_level, parseInt(r.dispute_count, 10)]));
  }).catch(() => new Map<string, number>());
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[metrics] Collecting metrics...\n');

  const [tradeMetrics, disputesByRisk, certCount, trustDelta] = await Promise.all([
    collectTradeMetrics(),
    collectDisputeCountsPerRisk(),
    collectCertificateCount(),
    collectTrustScoreDelta(),
  ]);

  // Merge dispute counts into perRisk
  const perRisk = tradeMetrics.perRisk.map((r) => {
    const disputed = disputesByRisk.get(r.riskLevel) ?? 0;
    return {
      ...r,
      totalDisputed: disputed,
      disputeRate: pct(disputed, r.totalCreated),
    };
  });

  const report: MetricsReport = {
    overall: {
      totalTrades: tradeMetrics.overall.totalTrades,
      totalCertificatesIssued: certCount,
      avgTrustScoreDelta: trustDelta,
      systemOverheadMs: tradeMetrics.overall.systemOverheadMs,
      collectedAt: new Date().toISOString(),
    },
    perRiskLevel: perRisk,
  };

  // ─── Console table ─────────────────────────────────────────────────────────

  console.log('=== Overall ===');
  console.table(report.overall);

  console.log('\n=== Per Risk Level ===');
  console.table(
    report.perRiskLevel.map(({ riskLevel, totalCreated, totalCompleted, completionRate,
      totalDisputed, disputeRate, avgDurationMinutes, avgStepDurationSeconds }) => ({
      'Risk': riskLevel,
      'Total': totalCreated,
      'Completed': totalCompleted,
      'Completion %': completionRate,
      'Disputed': totalDisputed,
      'Dispute %': disputeRate,
      'Avg Duration (min)': avgDurationMinutes,
      'Avg Step (sec)': avgStepDurationSeconds,
    })),
  );

  // ─── JSON output ───────────────────────────────────────────────────────────

  const jsonPath = path.join(process.cwd(), 'metrics-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n[metrics] Wrote ${jsonPath}`);

  // ─── CSV output ────────────────────────────────────────────────────────────

  const csvPath = path.join(process.cwd(), 'metrics-report.csv');
  const headers = [
    'risk_level', 'total_created', 'total_completed', 'completion_rate',
    'total_disputed', 'dispute_rate', 'avg_duration_minutes', 'avg_step_duration_seconds',
  ];
  const csvRows = [
    headers.join(','),
    ...report.perRiskLevel.map((r) =>
      [
        r.riskLevel, r.totalCreated, r.totalCompleted, r.completionRate,
        r.totalDisputed, r.disputeRate, r.avgDurationMinutes, r.avgStepDurationSeconds,
      ].join(','),
    ),
  ];
  fs.writeFileSync(csvPath, csvRows.join('\n'));
  console.log(`[metrics] Wrote ${csvPath}`);
}

main().catch((err) => {
  console.error('[metrics] Fatal error:', err);
  process.exit(1);
});
