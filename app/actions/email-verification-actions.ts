"use server"

import { serverValidateEmail, suggestEmailCorrection, type EmailValidationResult } from "@/lib/email-validation"
import { createSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase"

export async function validateEmailAction(email: string): Promise<EmailValidationResult> {
  return await serverValidateEmail(email)
}

export async function checkEmailExistsInDatabase(email: string): Promise<{ exists: boolean, error?: string }> {
  try {
    console.log('🔍 Checking if email exists in database:', email)
    
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.log('⚠️ Supabase not configured, skipping database check')
      return { exists: false } // Return false since we can't check the database
    }

    console.log('✅ Supabase is configured, creating admin client')
    const supabaseAdmin = createSupabaseAdminClient()
    
    // Check auth users
    console.log('👥 Checking auth users...')
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000 
    })

    if (authError) {
      console.error("❌ Error checking auth users:", authError)
      // Don't fail completely, just skip this check
      console.log('⚠️ Auth user check failed, continuing with profile check')
    }

    const emailExists = authUsers?.users?.some(user => 
      user.email?.toLowerCase() === email.toLowerCase()
    ) || false

    if (emailExists) {
      console.log('✅ Email found in auth users')
      return { exists: true }
    }

    // Check profiles table
    console.log('📋 Checking profiles table...')
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("email", email.toLowerCase())
      .limit(1)

    if (profileError) {
      console.error("❌ Error checking profiles:", profileError)
      // Don't fail completely, just log the error
      console.log('⚠️ Profile check failed, assuming email does not exist')
    }

    const profileExists = profiles && profiles.length > 0

    const finalResult = emailExists || profileExists
    console.log('🎯 Final result - email exists:', finalResult)
    
    return { exists: finalResult }
    
  } catch (error) {
    console.error("❌ Error in checkEmailExistsInDatabase:", error)
    
    // If it's a Supabase connection error, don't fail the validation
    if (error instanceof Error && (
      error.message.includes('fetch failed') || 
      error.message.includes('AuthRetryableFetchError') ||
      error.message.includes('SUPABASE_SERVICE_ROLE_KEY') ||
      error.message.includes('not configured')
    )) {
      console.log('🔄 Database check failed due to configuration, continuing without check')
      return { exists: false } // Assume email doesn't exist if we can't check
    }
    
    return { exists: false, error: "Unable to verify email availability" }
  }
}

export async function comprehensiveEmailValidation(email: string): Promise<{
  isValid: boolean
  isGmail: boolean
  existsInDatabase: boolean
  suggestion?: string
  error?: string
}> {
  try {
    console.log('🚀 Starting comprehensive email validation for:', email)
    
    // First, validate the email format
    const formatValidation = await validateEmailAction(email)
    console.log('📧 Format validation result:', formatValidation)
    
    if (!formatValidation.isValid) {
      console.log('❌ Email format is invalid')
      return {
        isValid: false,
        isGmail: formatValidation.isGmail,
        existsInDatabase: false,
        error: formatValidation.error
      }
    }

    console.log('✅ Email format is valid, checking database...')
    
    // Then check if it exists in the database
    const databaseCheck = await checkEmailExistsInDatabase(email)
    console.log('🗄️ Database check result:', databaseCheck)
    
    if (databaseCheck.error) {
      console.log('⚠️ Database check had an error, but continuing...')
      // Don't fail the whole validation if database check fails
      // Just log the error and continue
    }

    // Generate suggestion if applicable
    const suggestion = suggestEmailCorrection(email)
    console.log('💡 Email suggestion:', suggestion || 'none')

    const result = {
      isValid: true,
      isGmail: formatValidation.isGmail,
      existsInDatabase: databaseCheck.exists,
      suggestion: suggestion || undefined
    }
    
    console.log('🎯 Final validation result:', result)
    return result
    
  } catch (error) {
    console.error("❌ Error in comprehensiveEmailValidation:", error)
    
    // Return a safe fallback result
    return {
      isValid: false,
      isGmail: false,
      existsInDatabase: false,
      error: "Unable to validate email"
    }
  }
}