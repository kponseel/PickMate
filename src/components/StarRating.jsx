import { useState } from 'react'

export default function StarRating({ value = 0, onChange, readonly = false, size = 'md' }) {
  const [hovered, setHovered] = useState(0)

  const sizes = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  }

  const displayValue = hovered || value

  return (
    <div className="star-rating">
      {[1, 2, 3].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => {
            if (!readonly && onChange) {
              onChange(star)
            }
          }}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onTouchStart={() => !readonly && setHovered(star)}
          onTouchEnd={() => setHovered(0)}
          className={`star ${sizes[size]} ${
            readonly ? 'cursor-default' : ''
          } ${star <= displayValue ? 'filled' : 'empty'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
