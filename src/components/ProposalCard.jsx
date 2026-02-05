import { useState } from 'react'
import StarRating from './StarRating'

export default function ProposalCard({ proposal, userRating, onRate, onRemove, readonly }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  return (
    <div className="card-modern overflow-hidden group">
      {/* Image section with skeleton loader */}
      {proposal.imageUrl && !imageError && (
        <div className="relative h-44 bg-gray-100 overflow-hidden">
          {!imageLoaded && (
            <div className="absolute inset-0 skeleton rounded-none" />
          )}
          <img
            src={proposal.imageUrl}
            alt={proposal.title}
            className={`w-full h-full object-cover transition-all duration-500 ${
              imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
          {/* Gradient overlay for better text readability */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      )}

      <div className="p-4">
        {/* Title and price */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold text-gray-900 text-lg leading-tight">{proposal.title}</h3>
          {proposal.price && (
            <span className="shrink-0 text-sm font-semibold bg-gradient-to-r from-rose-500 to-rose-600 text-white px-3 py-1 rounded-full shadow-sm">
              {proposal.price}
            </span>
          )}
        </div>

        {/* Description */}
        {proposal.description && (
          <p className="mt-2 text-sm text-gray-500 line-clamp-2 leading-relaxed">
            {proposal.description}
          </p>
        )}

        {/* URL link with icon */}
        {proposal.url && (
          <a
            href={proposal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View details
          </a>
        )}

        {/* Rating section with divider */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StarRating
              value={userRating}
              onChange={onRate}
              readonly={readonly}
            />
            {userRating > 0 && (
              <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                Your vote
              </span>
            )}
          </div>
          {onRemove && !readonly && (
            <button
              onClick={onRemove}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 hover:bg-red-50 rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
