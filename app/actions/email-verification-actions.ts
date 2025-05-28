"use server"

import { createSupabaseAdminClient } from "@/lib/supabase"
import { 
  createEmailVerification, 
  createPinEmailHtml, 
  createPinEmailText,
  isValidPinFormat,
  isVerificationExpired,
  type EmailVerificationData,
  type PinVerificationResult 
} from "@/lib/email-verification"

// Store verification data in Supabase
async function storeEmailVerification(verification: EmailVerificationData) {
  try {
    const supabaseAdmin = createSupabaseAdminClient()
    
    // First, delete any existing verification for this email
    await supabaseAdmin
      .from('email_verifications')
      .delete()
      .eq('email', verification.email)
    
    // Insert new verification
    const { error } = await supabaseAdmin
      .from('email_verifications')
      .insert({
        email: verification.email,
        pin: verification.pin,
        expires_at: verification.expiresAt.toISOString(),
        attempts: verification.attempts,
        max_attempts: verification.maxAttempts,
        verified: verification.verified,
        created_at: verification.createdAt.toISOString()
      })
    
    if (error) {
      console.error('Error storing email verification:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Error in storeEmailVerification:', error)
    return false
  }
}

// Retrieve verification data from Supabase
async function getEmailVerification(email: string): Promise<EmailVerificationData | null> {
  try {
    const supabaseAdmin = createSupabaseAdminClient()
    
    const { data, error } = await supabaseAdmin
      .from('email_verifications')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()
    
    if (error || !data) {
      return null
    }
    
    return {
      email: data.email,
      pin: data.pin,
      expiresAt: new Date(data.expires_at),
      attempts: data.attempts,
      maxAttempts: data.max_attempts,
      verified: data.verified,
      createdAt: new Date(data.created_at)
    }
  } catch (error) {
    console.error('Error in getEmailVerification:', error)
    return null
  }
}

// Update verification attempts
async function updateVerificationAttempts(email: string, attempts: number, verified: boolean = false) {
  try {
    const supabaseAdmin = createSupabaseAdminClient()
    
    await supabaseAdmin
      .from('email_verifications')
      .update({ attempts, verified })
      .eq('email', email.toLowerCase())
    
    return true
  } catch (error) {
    console.error('Error updating verification attempts:', error)
    return false
  }
}

// Send email using a service
async function sendVerificationEmail(email: string, pin: string, firstName?: string): Promise<boolean> {
  try {
    // Option 1: Using Resend (recommended)
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Learning Habit Tracker <noreply@yourdomain.com>',
        to: email,
        subject: 'Verify your email - Learning Habit Tracker',
        html: createPinEmailHtml(pin, firstName),
        text: createPinEmailText(pin, firstName)
      })
      
      return true
    }
    
    // Option 2: Using Nodemailer with Gmail
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      const nodemailer = await import('nodemailer')
      
      const transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD // Use App Password, not regular password
        }
      })
      
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Verify your email - Learning Habit Tracker',
        html: createPinEmailHtml(pin, firstName),
        text: createPinEmailText(pin, firstName)
      })
      
      return true
    }
    
    // Option 3: Using SendGrid
    if (process.env.SENDGRID_API_KEY) {
      const sgMail = await import('@sendgrid/mail')
      sgMail.setApiKey(process.env.SENDGRID_API_KEY)
      
      await sgMail.send({
        to: email,
        from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
        subject: 'Verify your email - Learning Habit Tracker',
        html: createPinEmailHtml(pin, firstName),
        text: createPinEmailText(pin, firstName)
      })
      
      return true
    }
    
    // No email service configured - log for development
    console.log('=== EMAIL VERIFICATION PIN ===')
    console.log(`To: ${email}`)
    console.log(`PIN: ${pin}`)
    console.log('==============================')
    
    return true // Return true for development
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}

// Send PIN code to email
export async function sendEmailVerificationPin(email: string, firstName?: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Invalid email format' }
    }
    
    // Create verification data
    const verification = createEmailVerification(email)
    
    // Store in database
    const stored = await storeEmailVerification(verification)
    if (!stored) {
      return { success: false, error: 'Failed to generate verification code' }
    }
    
    // Send email
    const emailSent = await sendVerificationEmail(email, verification.pin, firstName)
    if (!emailSent) {
      return { success: false, error: 'Failed to send verification email' }
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error in sendEmailVerificationPin:', error)
    return { success: false, error: 'Failed to send verification code' }
  }
}

// Verify PIN code
export async function verifyEmailPin(email: string, pin: string): Promise<PinVerificationResult> {
  try {
    // Validate PIN format
    if (!isValidPinFormat(pin)) {
      return { success: false, error: 'Invalid PIN format. Please enter a 6-digit code.' }
    }
    
    // Get verification data
    const verification = await getEmailVerification(email)
    if (!verification) {
      return { success: false, error: 'Verification code not found. Please request a new code.' }
    }
    
    // Check if already verified
    if (verification.verified) {
      return { success: true }
    }
    
    // Check if expired
    if (isVerificationExpired(verification)) {
      return { success: false, error: 'Verification code has expired. Please request a new code.' }
    }
    
    // Check attempts
    if (verification.attempts >= verification.maxAttempts) {
      return { success: false, error: 'Too many failed attempts. Please request a new code.' }
    }
    
    // Verify PIN
    if (verification.pin === pin) {
      // Update as verified
      await updateVerificationAttempts(email, verification.attempts + 1, true)
      return { success: true }
    } else {
      // Increment attempts
      const newAttempts = verification.attempts + 1
      await updateVerificationAttempts(email, newAttempts, false)
      
      const remaining = verification.maxAttempts - newAttempts
      return { 
        success: false, 
        error: 'Invalid verification code.', 
        attemptsRemaining: remaining 
      }
    }
  } catch (error) {
    console.error('Error in verifyEmailPin:', error)
    return { success: false, error: 'Failed to verify PIN code' }
  }
}

// Check if email is verified
export async function isEmailVerified(email: string): Promise<boolean> {
  try {
    const verification = await getEmailVerification(email)
    return verification?.verified === true
  } catch (error) {
    console.error('Error checking email verification:', error)
    return false
  }
}

// Resend verification PIN
export async function resendEmailVerificationPin(email: string, firstName?: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Check if there's an existing verification
    const existing = await getEmailVerification(email)
    
    // If exists and not expired, don't allow resend too quickly
    if (existing && !isVerificationExpired(existing)) {
      const timeSinceCreated = Date.now() - existing.createdAt.getTime()
      const oneMinute = 60 * 1000
      
      if (timeSinceCreated < oneMinute) {
        return { 
          success: false, 
          error: 'Please wait at least 1 minute before requesting a new code.' 
        }
      }
    }
    
    // Send new PIN
    return await sendEmailVerificationPin(email, firstName)
  } catch (error) {
    console.error('Error in resendEmailVerificationPin:', error)
    return { success: false, error: 'Failed to resend verification code' }
  }
}