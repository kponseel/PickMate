const medals = ['🥇', '🥈', '🥉']

export default function ResultsView({ results }) {
  if (!results.length) {
    return <p className="text-gray-500 text-center py-4">No proposals to rank yet.</p>
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900">Results</h3>
      {results.map((r, i) => (
        <div
          key={r.id}
          className={`flex items-center gap-3 p-3 rounded-xl border ${
            i === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-100'
          }`}
        >
          <span className="text-2xl">{medals[i] || `#${i + 1}`}</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{r.title}</p>
            <p className="text-sm text-gray-500">
              {r.totalStars} star{r.totalStars !== 1 ? 's' : ''} from {r.voterCount} vote{r.voterCount !== 1 ? 's' : ''}
              {r.avgStars > 0 && ` (avg ${r.avgStars.toFixed(1)})`}
            </p>
          </div>
          <div className="flex text-yellow-400">
            {Array.from({ length: 3 }, (_, j) => (
              <span key={j} className={j < Math.round(r.avgStars) ? '' : 'text-gray-200'}>★</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
