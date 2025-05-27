// lib/supabase.ts - Updated version
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

// Default fallback values for development
const FALLBACK_URL = "https://your-project.supabase.co"
const FALLBACK_KEY = "your-anon-key"

// Get environment variables with fallbacks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_KEY

// Function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return (
    supabaseUrl !== FALLBACK_URL && 
    supabaseAnonKey !== FALLBACK_KEY && 
    supabaseUrl !== "" && 
    supabaseAnonKey !== ""
  )
}

// Create the main Supabase client for client-side operations
export const supabase = createClientComponentClient({
  supabaseUrl,
  supabaseKey: supabaseAnonKey,
})

// For server-side operations, create a standard client
export const createSupabaseClient = () => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please check your environment variables.')
  }
  
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Google OAuth sign in function
export async function signInWithGoogle() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured')
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    }
  })

  if (error) {
    console.error('Error signing in with Google:', error)
    throw error
  }

  return data
}