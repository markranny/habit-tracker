"use client"

import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Processing authentication...')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback page loaded')
        
        // Get the URL hash or search params
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const searchParams = new URLSearchParams(window.location.search)
        
        console.log('Hash params:', Object.fromEntries(hashParams))
        console.log('Search params:', Object.fromEntries(searchParams))
        
        // Check if we have an access token in the URL
        const accessToken = hashParams.get('access_token') || searchParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token')
        const error = hashParams.get('error') || searchParams.get('error')
        
        if (error) {
          setStatus(`Authentication error: ${error}`)
          return
        }
        
        if (accessToken && refreshToken) {
          console.log('Tokens found, setting session...')
          setStatus('Setting up session...')
          
          // Set the session
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })
          
          if (sessionError) {
            console.error('Session error:', sessionError)
            setStatus(`Session error: ${sessionError.message}`)
            return
          }
          
          console.log('Session set successfully:', data)
          setStatus('Authentication successful! Redirecting...')
          
          // Redirect to dashboard
          setTimeout(() => {
            router.push('/dashboard')
          }, 1000)
          
        } else {
          // Try to get session from Supabase
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          
          if (sessionError) {
            console.error('Get session error:', sessionError)
            setStatus(`Session error: ${sessionError.message}`)
            return
          }
          
          if (session) {
            console.log('Existing session found:', session)
            setStatus('Session found! Redirecting...')
            setTimeout(() => {
              router.push('/dashboard')
            }, 1000)
          } else {
            setStatus('No authentication data found. Redirecting to login...')
            setTimeout(() => {
              router.push('/login?error=no_auth_data')
            }, 2000)
          }
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        setStatus(`Error: ${error}`)
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h1 className="text-xl font-semibold mb-2">{status}</h1>
        <p className="text-gray-600">Please wait while we complete your authentication...</p>
      </div>
    </div>
  )
}