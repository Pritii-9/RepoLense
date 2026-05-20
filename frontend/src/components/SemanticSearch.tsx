import { useCallback, useState } from 'react'
import { searchCode } from '@/services/search'
import type { SearchResult } from '@/types/api'
import { cn } from '@/utils/cn'

interface SemanticSearchProps {
  analysisId: string
}

const EXAMPLE_QUERIES = [
  'Where is JWT token created?',
  'How is the database session managed?',
  'Find all API authentication checks',
  'Where are passwords hashed?',
  'Which functions handle file uploads?',
]

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const colour =
    pct >= 80 ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : pct >= 60 ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-rose-100 text-rose-700 border-rose-200'

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border', colour)}>
      {pct}% match
    </span>
  )
}

function CodeSnippet({ code }: { code: string }) {
  // Very lightweight syntax colouring: keywords, strings, comments
  const highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /\b(def|class|return|import|from|if|else|elif|for|while|try|except|finally|async|await|with|as|pass|raise|yield|lambda|not|and|or|in|is|None|True|False|const|let|var|function|export|default|type|interface|extends|implements|new|this|super)\b/g,
      '<span style="color:#7dd3fc">$1</span>',
    )
    .replace(/(#.*)/g, '<span style="color:#6b7280;font-style:italic">$1</span>')
    .replace(/(".*?"|'.*?'|`.*?`)/g, '<span style="color:#86efac">$1</span>')

  return (
    <pre
      className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-slate-200 bg-slate-900/60 rounded-xl p-3 border border-slate-700/40 scrollbar-thin"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  )
}

function ResultCard({ result, index }: { result: SearchResult; index: number }) {
  const [expanded, setExpanded] = useState(index < 2)

  return (
    <div className="rounded-2xl bg-white/60 backdrop-blur-sm border border-white/60 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-black/[0.02] transition-colors text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-primary-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <code className="text-xs font-mono font-semibold text-slate-700 truncate">
            {result.file_path}
          </code>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScoreBadge score={result.score} />
          <svg
            className={cn('w-4 h-4 text-slate-400 transition-transform duration-200', expanded ? 'rotate-180' : '')}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Code snippet */}
      {expanded && (
        <div className="px-4 pb-4">
          <CodeSnippet code={result.snippet} />
        </div>
      )}
    </div>
  )
}

export function SemanticSearch({ analysisId }: SemanticSearchProps) {
  const [query, setQuery] = useState('')
  const [threshold, setThreshold] = useState(50)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim()
      if (!trimmed) return
      try {
        setIsLoading(true)
        setError(null)
        const response = await searchCode(analysisId, trimmed, 10)
        setResults(response.results)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed. Please try again.')
        setResults(null)
      } finally {
        setIsLoading(false)
      }
    },
    [analysisId],
  )

  const filteredResults = results?.filter((r) => r.score >= threshold / 100) ?? []

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </span>
          <input
            id="semantic-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(query) }}
            placeholder='Ask in plain English… e.g. "Where is JWT decoded?"'
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-black/10 bg-white/70 backdrop-blur text-sm text-ink placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition"
          />
        </div>
        <button
          id="semantic-search-btn"
          onClick={() => void handleSearch(query)}
          disabled={isLoading || !query.trim()}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary-600 text-white text-sm font-semibold shadow-md hover:bg-primary-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
        >
          {isLoading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          )}
          Search
        </button>
      </div>

      {/* Example queries */}
      {results === null && !isLoading && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => { setQuery(q); void handleSearch(q) }}
              className="text-xs px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100 hover:bg-primary-100 transition-colors font-medium"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Threshold slider – only show when we have results */}
      {results !== null && (
        <div className="flex items-center gap-4 px-1">
          <label className="text-xs font-semibold text-slate-500 whitespace-nowrap" htmlFor="similarity-slider">
            Min similarity
          </label>
          <input
            id="similarity-slider"
            type="range"
            min={30}
            max={99}
            step={5}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="flex-1 accent-primary-500"
          />
          <span className="text-xs font-bold text-primary-700 w-10 text-right">{threshold}%</span>
          <span className="text-xs text-slate-400">
            {filteredResults.length} / {results.length} results
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-white/60 border border-white/60 p-4 animate-pulse space-y-2">
              <div className="h-3 bg-slate-200 rounded w-2/5" />
              <div className="h-20 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!isLoading && results !== null && filteredResults.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <p className="text-sm font-medium">No results above {threshold}% similarity.</p>
          <p className="text-xs mt-1">Try lowering the threshold or rephrasing your query.</p>
        </div>
      )}

      {!isLoading && filteredResults.length > 0 && (
        <div className="space-y-3">
          {filteredResults.map((result, idx) => (
            <ResultCard key={`${result.file_path}-${idx}`} result={result} index={idx} />
          ))}
        </div>
      )}
    </div>
  )
}
