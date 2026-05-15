import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Mail } from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'
import { UnsubscribeForm } from '../components/UnsubscribeForm'

type Mode = 'pending' | 'form' | 'result'

export function UnsubscribePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { confirmUnsubscribe, requestUnsubscribe } = useSubscription()
  const [mode, setMode] = useState<Mode>('pending')
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const email = searchParams.get('email')
  const token = searchParams.get('token')

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (email && token) {
        const r = await confirmUnsubscribe(email, token)
        if (!cancelled) {
          setResult(r)
          setMode('result')
        }
        return
      }

      if (email) {
        // Legacy link or "I clicked Unsubscribe on the site without a token":
        // request a confirmation email instead of unsubscribing directly.
        const r = await requestUnsubscribe(email)
        if (!cancelled) {
          setResult(r)
          setMode('result')
        }
        return
      }

      if (!cancelled) setMode('form')
    }

    run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, token])

  const handleBackToHome = () => navigate('/')

  if (mode === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-postgres-50 to-blue-50 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="card text-center">
            <div className="flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 animate-pulse text-postgres-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Processing your request…
            </h2>
            <p className="text-gray-600">Please wait.</p>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'form') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-postgres-50 to-blue-50 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 w-full">
          <div className="card">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribe</h2>
              <p className="text-gray-600">
                Enter your email and we'll send you a confirmation link to complete the unsubscribe.
              </p>
            </div>
            <UnsubscribeForm
              onSuccess={(message) => {
                setResult({ success: true, message })
                setMode('result')
              }}
              onError={(message) => {
                setResult({ success: false, message })
                setMode('result')
              }}
            />
            <div className="mt-6 text-center">
              <button onClick={handleBackToHome} className="text-sm text-postgres-600 hover:underline">
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-postgres-50 to-blue-50 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4">
        <div className="card text-center">
          {result?.success ? (
            <>
              <div className="flex items-center justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Done</h2>
              <p className="text-gray-600 mb-6">{result.message}</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center mb-4">
                <XCircle className="h-16 w-16 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                We couldn't complete that
              </h2>
              <p className="text-gray-600 mb-6">{result?.message}</p>
            </>
          )}

          <div className="space-y-3">
            <button onClick={handleBackToHome} className="w-full btn-primary">
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
