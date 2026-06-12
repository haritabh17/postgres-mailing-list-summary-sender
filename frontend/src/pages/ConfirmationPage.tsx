import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'

export function ConfirmationPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { confirmSubscription } = useSubscription()
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const token = searchParams.get('token')

  useEffect(() => {
    if (token) {
      confirmSubscription(token).then((response) => {
        setResult({ success: response.success, message: response.message })
      })
    } else {
      setResult({ success: false, message: 'Invalid confirmation link. No token provided.' })
    }
  }, [token])

  if (!result) {
    return (
      <div className="max-w-md mx-auto px-4 py-24">
        <div className="card text-center">
          <Loader2 className="h-8 w-8 animate-spin text-pg-700 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Confirming your subscription...</h2>
          <p className="text-gray-600 dark:text-gray-400">Please wait while we verify your email address.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-24">
      <div className="card text-center">
        {result.success ? (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">Subscription Confirmed!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{result.message}</p>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center mb-2">
                <Mail className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                <span className="font-semibold text-green-800 dark:text-green-300">
                  {result.message.includes('already subscribed') ? "You're all set!" : "What's next?"}
                </span>
              </div>
              <p className="text-sm text-green-700 dark:text-green-400">
                {result.message.includes('already subscribed')
                  ? "You're already receiving our weekly PostgreSQL summaries. Keep an eye on your inbox every Friday!"
                  : "You'll receive your first weekly summary next Friday. Each issue summarizes the discussions the PostgreSQL community was most active in that week."}
              </p>
            </div>
          </>
        ) : (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">Confirmation Failed</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{result.message}</p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-700 dark:text-red-400">
                {result.message.includes('expired')
                  ? 'Confirmation links expire after 5 minutes for security. Subscribe again to get a new confirmation email.'
                  : 'This could happen if the link has expired or is invalid.'}
              </p>
            </div>
          </>
        )}

        <div className="space-y-3">
          <button onClick={() => navigate('/')} className="w-full btn-primary">
            Back to Home
          </button>
          {!result.success && (
            <button onClick={() => navigate('/')} className="w-full btn-secondary">
              Subscribe Again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
