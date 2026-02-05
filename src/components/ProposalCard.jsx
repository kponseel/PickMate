import StarRating from './StarRating'

export default function ProposalCard({ proposal, userRating, onRate, onRemove, readonly }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {proposal.imageUrl && (
        <img
          src={proposal.imageUrl}
          alt={proposal.title}
          className="w-full h-40 object-cover"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900">{proposal.title}</h3>
          {proposal.price && (
            <span className="shrink-0 text-sm font-medium bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
              {proposal.price}
            </span>
          )}
        </div>

        {proposal.description && (
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">{proposal.description}</p>
        )}

        {proposal.url && (
          <a
            href={proposal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-rose-600 underline"
          >
            View link ↗
          </a>
        )}

        <div className="mt-3 flex items-center justify-between">
          <StarRating
            value={userRating}
            onChange={onRate}
            readonly={readonly}
          />
          {onRemove && !readonly && (
            <button
              onClick={onRemove}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
