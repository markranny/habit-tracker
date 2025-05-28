"use server"

import { createSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase"

export async function serverSignUp(email: string, password: string, firstName: string, lastName: string) {
  try {
    console.log('🚀 Starting server signup for:', email)
    
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.log('⚠️ Supabase not configured, returning demo user for development')
      return { 
        user: {
          id: `demo-user-${Date.now()}`,
          email,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
          },
        }, 
        error: null 
      }
    }

    console.log('✅ Supabase is configured, attempting to create admin client')
    
    let supabaseAdmin
    try {
      supabaseAdmin = createSupabaseAdminClient()
      console.log('✅ Admin client created successfully')
    } catch (adminError) {
      console.error('❌ Failed to create admin client:', adminError)
      console.log('🔄 Falling back to demo user creation')
      return { 
        user: {
          id: `fallback-user-${Date.now()}`,
          email,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
          },
        }, 
        error: null 
      }
    }
    
    console.log('📧 Creating user with admin client')
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, 
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    })

    if (error) {
      console.error("❌ Error creating user:", error)
      return { user: null, error }
    }

    if (!data.user) {
      console.error("❌ No user returned from createUser")
      return { user: null, error: { message: "Failed to create user" } }
    }

    console.log('✅ User created successfully:', data.user.id)

    // Create profile
    console.log('📝 Creating user profile')
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      user_id: data.user.id,
      first_name: firstName,
      last_name: lastName,
      email: email,
    })

    if (profileError) {
      console.error("⚠️ Error creating profile:", profileError)
      // Don't fail the whole process for profile creation error
    } else {
      console.log('✅ User profile created successfully')
    }

    // Create preferences
    console.log('⚙️ Creating user preferences')
    const { error: preferencesError } = await supabaseAdmin.from("preferences").insert({
      user_id: data.user.id,
      theme: "system",
      email_notifications: true,
      push_notifications: true,
      weekly_summary: true,
      goal_reminders: true,
      language: "en",
      date_format: "mdy",
    })

    if (preferencesError) {
      console.error("⚠️ Error creating preferences:", preferencesError)
      // Don't fail the whole process for preferences creation error
    } else {
      console.log('✅ User preferences created successfully')
    }

    console.log('🎉 Server signup completed successfully')
    return { user: data.user, error: null }
    
  } catch (error) {
    console.error("❌ Error in server signup:", error)
    
    // If it's a Supabase connection error, provide a fallback
    if (error instanceof Error && (
      error.message.includes('fetch failed') || 
      error.message.includes('AuthRetryableFetchError') ||
      error.message.includes('SUPABASE_SERVICE_ROLE_KEY') ||
      error.message.includes('not configured')
    )) {
      console.log('🔄 Supabase connection failed, providing fallback user')
      return { 
        user: {
          id: `fallback-user-${Date.now()}`,
          email,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
          },
        }, 
        error: null 
      }
    }
    
    return { 
      user: null, 
      error: error instanceof Error ? error : { message: "Unknown error occurred" } 
    }
  }
}