import { Link } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <FileQuestion className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-500 mb-6" />
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Page not found</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="btn-primary inline-flex">
        Back to home
      </Link>
    </div>
  )
}
