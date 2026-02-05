import { useEffect, useRef } from 'react'

export default function BottomSheet({ isOpen, onClose, title, children }) {
  const sheetRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <div
        className="bottom-sheet-overlay"
        onClick={onClose}
      />
      <div ref={sheetRef} className="bottom-sheet">
        <div className="bottom-sheet-handle" />
        {title && (
          <div className="px-6 pb-3 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
        )}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-80px)] safe-bottom">
          {children}
        </div>
      </div>
    </>
  )
}
