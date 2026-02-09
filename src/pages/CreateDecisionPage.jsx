import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'

const scrapeUrl = httpsCallable(functions, 'scrapeUrl')

export default function CreateDecisionPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('other')
  const [options, setOptions] = useState([])

  const [newOption, setNewOption] = useState({
    title: '',
    description: '',
    imageUrl: '',
    price: '',
    url: '',
  })

  const [fetchingMeta, setFetchingMeta] = useState(false)
  const lastScrapedUrl = useRef('')

  const handleUrlChange = useCallback(async (url) => {
    setNewOption((prev) => ({ ...prev, url }))

    // Only scrape if it looks like a valid URL
    if (!url || lastScrapedUrl.current === url) return
    try {
      new URL(url)
    } catch {
      return
    }

    lastScrapedUrl.current = url
    setFetchingMeta(true)
    try {
      const result = await scrapeUrl({ url })
      const meta = result.data
      setNewOption((prev) => ({
        ...prev,
        title: prev.title || meta.title || prev.title,
        description: prev.description || meta.description || prev.description,
        imageUrl: prev.imageUrl || meta.image || prev.imageUrl,
        price: prev.price || meta.price || prev.price,
      }))
      if (meta.title) toast.success('Auto-filled from link')
    } catch (err) {
      console.warn('Could not scrape URL:', err.message)
    } finally {
      setFetchingMeta(false)
    }
  }, [toast])

  const categories = [
    { id: 'food', icon: '🍕', label: 'Food' },
    { id: 'movie', icon: '🎬', label: 'Movie' },
    { id: 'activity', icon: '🎯', label: 'Activity' },
    { id: 'travel', icon: '✈️', label: 'Travel' },
    { id: 'shopping', icon: '🛍️', label: 'Shopping' },
    { id: 'other', icon: '💡', label: 'Other' },
  ]

  const addOption = () => {
    if (!newOption.title.trim()) {
      toast.error('Option title is required')
      return
    }
    setOptions([...options, { ...newOption, id: Date.now() }])
    setNewOption({ title: '', description: '', imageUrl: '', price: '', url: '' })
    lastScrapedUrl.current = ''
    toast.success('Option added')
  }

  const removeOption = (id) => {
    setOptions(options.filter((o) => o.id !== id))
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Decision title is required')
      return
    }
    if (options.length < 2) {
      toast.error('Add at least 2 options')
      return
    }

    setSaving(true)
    try {
      const decisionRef = await addDoc(collection(db, 'decisions'), {
        title: title.trim(),
        category,
        ownerId: user.uid,
        status: 'active',
        createdAt: serverTimestamp(),
      })

      // Add options as subcollection
      for (let i = 0; i < options.length; i++) {
        const opt = options[i]
        await addDoc(collection(db, 'decisions', decisionRef.id, 'options'), {
          title: opt.title,
          description: opt.description || '',
          imageUrl: opt.imageUrl || '',
          price: opt.price || '',
          url: opt.url || '',
          order: i,
        })
      }

      toast.success('Decision created!')
      navigate(`/decision/${decisionRef.id}`)
    } catch (error) {
      console.error('Error creating decision:', error)
      toast.error('Failed to create decision')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-rose-50 flex flex-col">
      {/* Header */}
      <header className="glass-rose sticky top-0 z-30 text-white px-5 py-4 safe-top">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => step === 1 ? navigate(-1) : setStep(1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/20 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold tracking-tight">
            {step === 1 ? 'New Decision' : 'Add Options'}
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full pb-28">
        {step === 1 ? (
          <div className="space-y-6 animate-fade-in">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What are you deciding?
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Where should we eat tonight?"
                className="input-modern"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <div className="grid grid-cols-3 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      category === cat.id
                        ? 'border-rose-500 bg-rose-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{cat.icon}</div>
                    <div className="text-xs font-medium text-gray-700">{cat.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => title.trim() ? setStep(2) : toast.error('Enter a title first')}
              className="btn-primary w-full"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Options list */}
            {options.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Options ({options.length})
                </label>
                {options.map((opt, i) => (
                  <div key={opt.id} className="card-modern p-3 flex items-center gap-3">
                    {opt.imageUrl ? (
                      <img src={opt.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                        {i + 1}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{opt.title}</p>
                      {opt.price && <p className="text-sm text-rose-600">{opt.price}</p>}
                    </div>
                    <button
                      onClick={() => removeOption(opt.id)}
                      className="text-gray-400 hover:text-red-500 p-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new option form */}
            <div className="card-modern p-4 space-y-4">
              <h3 className="font-medium text-gray-900">Add Option</h3>

              {/* URL field first — paste a link to auto-fill */}
              <div className="relative">
                <input
                  type="url"
                  value={newOption.url}
                  onChange={(e) => setNewOption({ ...newOption, url: e.target.value })}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text')
                    if (pasted) setTimeout(() => handleUrlChange(pasted), 0)
                  }}
                  onBlur={(e) => handleUrlChange(e.target.value)}
                  placeholder="Paste a link to auto-fill details"
                  className="input-modern pr-10"
                />
                {fetchingMeta ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-0.5">
                    <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : newOption.url && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                )}
              </div>

              {fetchingMeta && (
                <div className="flex items-center gap-2 text-sm text-rose-500 animate-pulse-soft">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Fetching details from link...
                </div>
              )}

              {/* Image preview when auto-filled */}
              {newOption.imageUrl && (
                <div className="relative rounded-xl overflow-hidden h-32 bg-gray-100 animate-fade-in">
                  <img
                    src={newOption.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                  <button
                    onClick={() => setNewOption({ ...newOption, imageUrl: '' })}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center text-xs"
                  >
                    x
                  </button>
                </div>
              )}

              <input
                type="text"
                value={newOption.title}
                onChange={(e) => setNewOption({ ...newOption, title: e.target.value })}
                placeholder="Option title *"
                className="input-modern"
              />

              <input
                type="text"
                value={newOption.description}
                onChange={(e) => setNewOption({ ...newOption, description: e.target.value })}
                placeholder="Description (optional)"
                className="input-modern"
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newOption.price}
                  onChange={(e) => setNewOption({ ...newOption, price: e.target.value })}
                  placeholder="Price (optional)"
                  className="input-modern"
                />
                <input
                  type="url"
                  value={newOption.imageUrl}
                  onChange={(e) => setNewOption({ ...newOption, imageUrl: e.target.value })}
                  placeholder="Image URL"
                  className="input-modern"
                />
              </div>

              <button onClick={addOption} className="btn-secondary w-full">
                + Add Option
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Fixed bottom action - only on step 2 */}
      {step === 2 && (
        <div className="fixed bottom-0 left-0 right-0 glass z-50 safe-bottom">
          <div className="max-w-lg mx-auto p-4">
            <button
              onClick={handleSubmit}
              disabled={saving || options.length < 2}
              className="btn-primary w-full disabled:opacity-50"
            >
              {saving ? 'Creating...' : `Create Decision (${options.length} options)`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
