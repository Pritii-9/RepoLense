import type { CsvHotspot, ParsedAnalysisReport } from '@/types/api'

function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      const next = line[index + 1]
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

export function parseAnalysisCsvReport(csvText: string): ParsedAnalysisReport {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)

  const metrics: Record<string, string> = {}
  const hotspots: CsvHotspot[] = []
  let hotspotSection = false

  for (const rawLine of lines) {
    const row = parseCsvLine(rawLine)

    if (row[0] === 'top_hotspots') {
      hotspotSection = true
      continue
    }

    if (row[0] === 'metric' || row[0] === 'repository_name' || row[0] === 'repository_url') {
      continue
    }

    if (hotspotSection) {
      if (row[0] === 'file_path') {
        continue
      }

      const [filePath, entityName, complexityValue, lineNumberValue] = row
      if (!filePath || !entityName) {
        continue
      }

      hotspots.push({
        filePath,
        entityName,
        complexity: Number(complexityValue ?? 0),
        lineNumber: Number(lineNumberValue ?? 0),
      })
      continue
    }

    const [metricKey, metricValue] = row
    if (metricKey && metricValue) {
      metrics[metricKey] = metricValue
    }
  }

  return { metrics, hotspots }
}
