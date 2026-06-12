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
        if (!cancelled) { setResult(r); setMode('result') }
        return
      }
      if (email) {
        const r = await requestUnsubscribe(email)
        if (!cancelled) { setResult(r); setMode('result') }
        return
      }
      if (!cancelled) setMode('form')
    }

    run()
    return () => { cancelled = true }
  }, [email, token])

  if (mode === 'pending') {
    return (
      <div className="max-w-md mx-auto px-4 py-24">
        <div className="card text-center">
          <Mail className="h-8 w-8 animate-pulse text-pg-700 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Processing your request…</h2>
          <p className="text-gray-600 dark:text-gray-400">Please wait.</p>
        </div>
      </div>
    )
  }

  if (mode === 'form') {
    return (
      <div className="max-w-md mx-auto px-4 py-24 w-full">
        <div className="card">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Unsubscribe</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Enter your email and we'll send you a confirmation link to complete the unsubscribe.
            </p>
          </div>
          <UnsubscribeForm
            onSuccess={(message) => { setResult({ success: true, message }); setMode('result') }}
            onError={(message) => { setResult({ success: false, message }); setMode('result') }}
          />
          <div className="mt-6 text-center">
            <button onClick={() => navigate('/')} className="text-sm text-pg-700 dark:text-accent-400 hover:underline">
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-24">
      <div className="card text-center">
        {result?.success ? (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">Done</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{result.message}</p>
          </>
        ) : (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">We couldn't complete that</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{result?.message}</p>
          </>
        )}
        <button onClick={() => navigate('/')} className="w-full btn-primary">
          Back to Home
        </button>
      </div>
    </div>
  )
}
