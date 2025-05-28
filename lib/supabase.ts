import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export function isSupabaseConfigured(): boolean {
  const configured = !!(
    supabaseUrl && 
    supabaseAnonKey && 
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey.length > 20
  )
  
  console.log('🔍 Supabase configuration check:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlValid: supabaseUrl.startsWith('https://'),
    keyValid: supabaseAnonKey.length > 20,
    configured
  })
  
  return configured
}

// Create default client (will work even if not configured, but will fail on actual requests)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
)

export const createSupabaseClient = () => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, creating placeholder client')
  }
  return createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseAnonKey || 'placeholder-key'
  )
}

export const createSupabaseAdminClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  console.log('🔑 Admin client creation:', {
    hasUrl: !!supabaseUrl,
    hasServiceKey: !!serviceRoleKey,
    configured: isSupabaseConfigured()
  })
  
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.')
  }
  
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

export async function signInWithGoogle() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured for Google authentication')
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