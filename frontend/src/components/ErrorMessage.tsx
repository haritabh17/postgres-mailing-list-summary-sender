import { XCircle, X } from 'lucide-react'

interface ErrorMessageProps {
  message: string
  onClose: () => void
}

export function ErrorMessage({ message, onClose }: ErrorMessageProps) {
  return (
    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-red-700 dark:text-red-300 flex-1">{message}</p>
      <button onClick={onClose} className="text-red-400 hover:text-red-600" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
