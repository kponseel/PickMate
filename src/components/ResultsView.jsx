const medals = ['🥇', '🥈', '🥉']
const rankColors = [
  { bg: 'bg-gradient-to-r from-amber-50 to-yellow-50', border: 'border-amber-200', text: 'text-amber-700' },
  { bg: 'bg-gradient-to-r from-gray-50 to-slate-50', border: 'border-gray-200', text: 'text-gray-600' },
  { bg: 'bg-gradient-to-r from-orange-50 to-amber-50', border: 'border-orange-200', text: 'text-orange-700' },
]

export default function ResultsView({ results }) {
  if (!results.length) {
    return (
      <div className="empty-state py-12">
        <div className="empty-state-icon">📊</div>
        <h3 className="empty-state-title">No results yet</h3>
        <p className="empty-state-text">Add proposals and vote to see rankings</p>
      </div>
    )
  }

  const maxStars = Math.max(...results.map((r) => r.totalStars), 1)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Winner highlight */}
      {results.length > 0 && results[0].totalStars > 0 && (
        <div className="card-elevated p-5 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border border-amber-200 animate-scale-in">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg animate-bounce-in">
              🏆
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Winner</p>
              <h3 className="text-xl font-bold text-gray-900 truncate">{results[0].title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex text-amber-400 text-lg">
                  {Array.from({ length: 3 }, (_, j) => (
                    <span key={j} className={j < Math.round(results[0].avgStars) ? '' : 'text-amber-200'}>★</span>
                  ))}
                </div>
                <span className="text-sm text-amber-700 font-medium">
                  {results[0].avgStars.toFixed(1)} avg
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rankings list */}
      <div className="space-y-2">
        {results.map((r, i) => {
          const colors = rankColors[i] || { bg: 'bg-white', border: 'border-gray-100', text: 'text-gray-500' }
          const percentage = maxStars > 0 ? (r.totalStars / maxStars) * 100 : 0

          return (
            <div
              key={r.id}
              className={`card-modern p-4 ${colors.bg} ${colors.border} animate-slide-up stagger-${Math.min(i + 1, 5)}`}
              style={{ opacity: 0 }}
            >
              <div className="flex items-center gap-3">
                {/* Rank */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                  i < 3 ? '' : 'bg-gray-100'
                }`}>
                  {medals[i] || <span className="text-sm font-bold text-gray-400">#{i + 1}</span>}
                </div>

                {/* Title and stats */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{r.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs font-medium ${colors.text}`}>
                      {r.totalStars} star{r.totalStars !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {r.voterCount} vote{r.voterCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {/* Stars display */}
                <div className="flex text-lg">
                  {Array.from({ length: 3 }, (_, j) => (
                    <span
                      key={j}
                      className={`transition-colors ${j < Math.round(r.avgStars) ? 'text-amber-400' : 'text-gray-200'}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
