import { fetchData } from '@/lib/clickhouse'
import { ChartCard } from '@/components/chart-card'
import { type ChartProps } from '@/components/charts/chart-props'
import { CardMultiMetrics } from '@/components/tremor'

export async function ChartSummaryUsedByRunningQueries({
  title,
  className,
}: ChartProps) {
  const sql = `
    SELECT
      COUNT() as query_count,
      SUM(memory_usage) as memory_usage,
      formatReadableSize(memory_usage) as readable_memory_usage
    FROM system.processes
  `
  const rows = await fetchData(sql)
  const first = rows?.[0]
  if (!rows || !first) return null

  // Workaround for getting total memory usage
  const totalMemSql = `
    SELECT metric, value as total, formatReadableSize(total) AS readable_total
    FROM system.asynchronous_metrics
    WHERE
        metric = 'CGroupMemoryUsed'
        OR metric = 'OSMemoryTotal'
    ORDER BY metric ASC
    LIMIT 1
  `
  let totalMem = {
    total: first.memory_usage,
    readable_total: first.readable_memory_usage,
  }
  try {
    const totalRows = await fetchData(totalMemSql)
    totalMem = totalRows?.[0]
    if (!totalRows || !totalMem) return null
  } catch (e) {
    console.error('Error fetching total memory usage', e)
  }

  let todayQueryCount = first.query_count
  let todayQueryCountSql = `
    SELECT
      COUNT() as query_count
    FROM system.query_log
    WHERE
      type = 'QueryStart'
      AND query_start_time >= today()
  `
  try {
    const todayQueryCountRows = await fetchData(todayQueryCountSql)
    todayQueryCount = todayQueryCountRows?.[0]?.query_count
    if (!todayQueryCountRows || !todayQueryCount) return null
  } catch (e) {
    console.error('Error fetching today query count', e)
  }

  const allSql = `
    Total current memory usage by running queries:
    ${sql}

    Total memory usage by system:
    ${totalMemSql}

    Total query count today:
    ${todayQueryCountSql}
  `

  return (
    <ChartCard title={title} className={className} sql={allSql}>
      <div className="flex flex-col justify-between p-0">
        <CardMultiMetrics
          primary={first.query_count + ' running queries'}
          currents={[first.memory_usage, first.query_count]}
          targets={[totalMem.total, todayQueryCount]}
          currentReadables={[
            first.readable_memory_usage + ' memory usage',
            first.query_count + ' running queries',
          ]}
          targetReadables={[
            totalMem.readable_total + ' total',
            todayQueryCount + ' today',
          ]}
          className="p-2"
        />
        <div className="text-muted-foreground text-right text-sm"></div>
      </div>
    </ChartCard>
  )
}

export default ChartSummaryUsedByRunningQueries
