// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return !!(
    supabaseUrl && 
    supabaseAnonKey && 
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey.length > 20
  )
}

// Create the main Supabase client for client-side operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// For server-side operations, create a standard client
export const createSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Create admin client only when needed (server-side)
export const createSupabaseAdminClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations')
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Google OAuth sign in function
export async function signInWithGoogle() {
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