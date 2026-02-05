export default function StarRating({ value = 0, onChange, readonly = false }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={`text-2xl transition-transform ${
            readonly ? 'cursor-default' : 'cursor-pointer active:scale-125'
          } ${star <= value ? 'text-yellow-400' : 'text-gray-300'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
