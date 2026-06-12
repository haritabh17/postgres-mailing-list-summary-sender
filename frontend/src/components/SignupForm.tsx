import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, Send, Loader2 } from 'lucide-react'
import { emailSchema, type EmailFormData } from '../lib/validation'
import { useSubscription } from '../hooks/useSubscription'

interface SignupFormProps {
  onSuccess: (message: string) => void
  onError: (message: string) => void
  inline?: boolean
}

export function SignupForm({ onSuccess, onError, inline = false }: SignupFormProps) {
  const { subscribe, isLoading } = useSubscription()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  })

  const onSubmit = async (data: EmailFormData) => {
    const result = await subscribe(data.email)
    if (result.success) {
      onSuccess(result.message)
      reset()
    } else {
      onError(result.message)
    }
  }

  if (inline) {
    return (
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-4 w-4 text-gray-400" />
            </div>
            <input
              {...register('email')}
              type="email"
              className={`input-field pl-10 ${errors.email ? 'border-red-300 focus:ring-red-500' : ''}`}
              placeholder="you@example.com"
              disabled={isLoading}
            />
          </div>
          <button type="submit" disabled={isLoading} className="btn-primary whitespace-nowrap flex items-center gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Subscribe
          </button>
        </div>
        {errors.email && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>}
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Email Address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail className="h-5 w-5 text-gray-400" />
          </div>
          <input
            {...register('email')}
            type="email"
            id="email"
            className={`input-field pl-10 ${errors.email ? 'border-red-300 focus:ring-red-500' : ''}`}
            placeholder="Enter your email address"
            disabled={isLoading}
          />
        </div>
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </div>

      <button type="submit" disabled={isLoading} className="w-full btn-primary flex items-center justify-center gap-2">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Subscribing...</span>
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            <span>Subscribe to Weekly Summary</span>
          </>
        )}
      </button>

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        By subscribing, you agree to receive weekly summaries. You'll get a confirmation email to verify.
        Unsubscribe anytime.
      </p>
    </form>
  )
}
