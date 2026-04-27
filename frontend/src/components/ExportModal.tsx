import { useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Spinner } from './Spinner'
import { useToast } from '@/hooks/useToast'
import { api } from '@/services/api'
import type { AnalysisResponse } from '@/types/api'
import { cn } from '@/utils/cn'

interface ExportModalProps {
  analysis: AnalysisResponse
  isOpen: boolean
  onClose: () => void
}

export function ExportModal({ analysis, isOpen, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [isExporting, setIsExporting] = useState(false)
  const { pushToast } = useToast()
  const metric = analysis.code_metric

  if (!metric) return null

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await api.post(`/reports/${analysis.id}/export`, { format }, { responseType: 'json' })
      const { download_url, filename } = response.data
      const a = document.createElement('a')
      a.href = download_url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      pushToast({
        title: 'Export downloaded!',
        description: `Code metrics exported as ${format.toUpperCase()}.`,
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: 'Export failed.',
        description: 'Try again or check if metrics are available.',
        tone: 'error',
      })
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl hover:shadow-3xl transition-all duration-200">
          <div className="flex items-start justify-between">
            <h2 className="text-2xl font-bold text-ink">Export Metrics</h2>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
              ×
            </Button>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <label className="text-sm font-medium text-ink">Format</label>
              <div className="inline-flex rounded-panel bg-slate-100 p-1 shadow-inner">
                {(['csv', 'json'] as const).map((f) => (
                  <button
                    key={f}
                    className={cn(
                      'flex-1 rounded-none rounded-l-panel px-3 py-2 text-sm font-medium transition-all duration-200 hover:bg-white',
                      format === f && 'bg-white shadow-soft ring-2 ring-primary-500 ring-offset-1'
                    )}
                    onClick={() => setFormat(f)}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-medium text-ink">Preview ({format.toUpperCase()})</label>
              <pre className="h-24 rounded-panel bg-slate-50 p-3 text-xs overflow-auto font-mono text-slate-600 hover:shadow-inner transition-shadow">
                {format === 'csv' 
                  ? 'file_count,line_count,commit_count,...\n' + Object.values(metric).slice(0,2).join(',')
                  : JSON.stringify({ ...metric, preview: true }, null, 2).slice(0, 200) + '...'
                }
              </pre>
            </div>
          </div>

          <div className="mt-8 flex justify-end space-x-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button 
              onClick={handleExport} 
              isLoading={isExporting}
              className="group hover:scale-105 transition-all duration-200"
            >
              {isExporting ? <Spinner className="h-4 w-4" /> : 'Download Export'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

