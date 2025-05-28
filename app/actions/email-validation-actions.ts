"use server"

import { serverValidateEmail, suggestEmailCorrection, type EmailValidationResult } from "@/lib/email-validation"
import { createSupabaseAdminClient } from "@/lib/supabase"

// Server action to validate email
export async function validateEmailAction(email: string): Promise<EmailValidationResult> {
  return await serverValidateEmail(email)
}

// Server action to check if email already exists in your database
export async function checkEmailExistsInDatabase(email: string): Promise<{ exists: boolean, error?: string }> {
  try {
    const supabaseAdmin = createSupabaseAdminClient()
    
    // Check if email exists in auth.users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000 // Adjust as needed
    })

    if (authError) {
      console.error("Error checking auth users:", authError)
      return { exists: false, error: "Unable to verify email availability" }
    }

    const emailExists = authUsers.users.some(user => 
      user.email?.toLowerCase() === email.toLowerCase()
    )

    if (emailExists) {
      return { exists: true }
    }

    // Also check in profiles table as backup
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("email", email.toLowerCase())
      .limit(1)

    if (profileError) {
      console.error("Error checking profiles:", profileError)
      // Don't return error here, as auth check was successful
    }

    const profileExists = profiles && profiles.length > 0

    return { exists: emailExists || profileExists }
  } catch (error) {
    console.error("Error in checkEmailExistsInDatabase:", error)
    return { exists: false, error: "Unable to verify email availability" }
  }
}

// Comprehensive email validation combining all checks
export async function comprehensiveEmailValidation(email: string): Promise<{
  isValid: boolean
  isGmail: boolean
  existsInDatabase: boolean
  suggestion?: string
  error?: string
}> {
  try {
    // First, validate the email format and Gmail-specific rules
    const formatValidation = await validateEmailAction(email)
    
    if (!formatValidation.isValid) {
      return {
        isValid: false,
        isGmail: formatValidation.isGmail,
        existsInDatabase: false,
        error: formatValidation.error
      }
    }

    // Check if email already exists in database
    const databaseCheck = await checkEmailExistsInDatabase(email)
    
    if (databaseCheck.error) {
      return {
        isValid: true,
        isGmail: formatValidation.isGmail,
        existsInDatabase: false,
        error: databaseCheck.error
      }
    }

    // Check for typos and suggest corrections
    const suggestion = suggestEmailCorrection(email)

    return {
      isValid: true,
      isGmail: formatValidation.isGmail,
      existsInDatabase: databaseCheck.exists,
      suggestion: suggestion || undefined
    }
  } catch (error) {
    console.error("Error in comprehensiveEmailValidation:", error)
    return {
      isValid: false,
      isGmail: false,
      existsInDatabase: false,
      error: "Unable to validate email"
    }
  }
}