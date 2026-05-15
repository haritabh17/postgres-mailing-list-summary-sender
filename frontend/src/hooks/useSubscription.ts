import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { type SubscriptionResult, type UnsubscribeResult } from '../lib/types'

const NEUTRAL_SUBSCRIBE_MESSAGE =
  'Please check your inbox for a confirmation email. The link expires in 5 minutes for security.'

const NEUTRAL_UNSUBSCRIBE_REQUEST_MESSAGE =
  'If this address is on our list, an unsubscribe confirmation email is on its way. Please check your inbox.'

export function useSubscription() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subscribe = async (email: string): Promise<SubscriptionResult> => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('subscribe', {
        body: { email, siteUrl: window.location.origin },
      })

      if (invokeError) {
        const safeApiError =
          data && typeof data === 'object' && 'error' in data && typeof (data as any).error === 'string'
            ? (data as any).error
            : null
        const message = safeApiError || 'Subscription temporarily unavailable. Please try again.'
        setError(message)
        return { success: false, message, isNewSubscription: false }
      }

      const message = (data && (data as any).message) || NEUTRAL_SUBSCRIBE_MESSAGE
      return { success: true, message, isNewSubscription: true }
    } catch (err: any) {
      const message = err?.message || 'An unexpected error occurred. Please try again.'
      setError(message)
      return { success: false, message, isNewSubscription: false }
    } finally {
      setIsLoading(false)
    }
  }

  // Step 1 of the unsubscribe flow: request a confirmation email.
  const requestUnsubscribe = async (email: string): Promise<UnsubscribeResult> => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('request-unsubscribe', {
        body: { email, siteUrl: window.location.origin },
      })

      if (invokeError) {
        const safeApiError =
          data && typeof data === 'object' && 'error' in data && typeof (data as any).error === 'string'
            ? (data as any).error
            : null
        const message = safeApiError || 'Service temporarily unavailable. Please try again.'
        setError(message)
        return { success: false, message }
      }

      return {
        success: true,
        message: (data && (data as any).message) || NEUTRAL_UNSUBSCRIBE_REQUEST_MESSAGE,
      }
    } catch (err: any) {
      const message = err?.message || 'An unexpected error occurred. Please try again.'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  // Step 2: confirm the unsubscribe using the link emailed to the user.
  const confirmUnsubscribe = async (email: string, token: string): Promise<UnsubscribeResult> => {
    setIsLoading(true)
    setError(null)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

      const url = `${supabaseUrl}/functions/v1/confirm-unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = (data && (data as any).error) || 'Unsubscribe link is invalid or has expired.'
        setError(message)
        return { success: false, message }
      }

      return {
        success: true,
        message: (data && (data as any).message) || 'You have been unsubscribed.',
      }
    } catch (err: any) {
      const message = err?.message || 'An unexpected error occurred. Please try again.'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  const confirmSubscription = async (token: string): Promise<SubscriptionResult> => {
    setIsLoading(true)
    setError(null)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

      const response = await fetch(
        `${supabaseUrl}/functions/v1/confirm-subscription?token=${encodeURIComponent(token)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error((data && (data as any).error) || 'Confirmation failed')
      }

      if ((data as any).success) {
        return {
          success: true,
          message: (data as any).message,
          isNewSubscription: true,
        }
      }
      return {
        success: false,
        message: (data as any).error || 'Confirmation failed',
        isNewSubscription: false,
      }
    } catch (err: any) {
      const message = err?.message || 'An unexpected error occurred. Please try again.'
      setError(message)
      return { success: false, message, isNewSubscription: false }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    subscribe,
    requestUnsubscribe,
    confirmUnsubscribe,
    confirmSubscription,
    isLoading,
    error,
  }
}
