import { CheckCircle, X } from 'lucide-react'

interface SuccessMessageProps {
  message: string
  onClose: () => void
}

export function SuccessMessage({ message, onClose }: SuccessMessageProps) {
  return (
    <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-green-700 dark:text-green-300 flex-1">{message}</p>
      <button onClick={onClose} className="text-green-400 hover:text-green-600" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
