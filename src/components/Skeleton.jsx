export function SkeletonCard() {
  return (
    <div className="card-modern p-4 animate-fade-in">
      <div className="flex gap-4">
        <div className="skeleton w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-text w-1/2" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonList({ count = 3 }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonProposal() {
  return (
    <div className="card-modern overflow-hidden animate-fade-in">
      <div className="skeleton h-40 rounded-none" />
      <div className="p-4 space-y-3">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-text w-full" />
        <div className="skeleton skeleton-text w-2/3" />
        <div className="flex gap-2 pt-2">
          <div className="skeleton w-8 h-8 rounded-full" />
          <div className="skeleton w-8 h-8 rounded-full" />
          <div className="skeleton w-8 h-8 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonAvatar({ size = 'md' }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
  }
  return <div className={`skeleton rounded-full ${sizes[size]}`} />
}
