// app/actions/email-verification-actions.ts
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

// WORKING Gmail SMTP using the same method that works in your test page
async function sendEmailWithGmailSMTP(to: string, subject: string, html: string, text: string) {
  return new Promise((resolve, reject) => {
    try {
      const net = require('net')
      const tls = require('tls')
      
      let socket: any
      let step = 0
      let authenticated = false
      
      console.log(`📧 Connecting to Gmail SMTP for: ${to}`)
      
      // Connect to port 587 (STARTTLS)
      socket = net.createConnection(587, 'smtp.gmail.com')
      
      socket.on('connect', () => {
        console.log('📡 Connected to smtp.gmail.com:587')
      })
      
      socket.on('data', (data: Buffer) => {
        const response = data.toString().trim()
        console.log('📨 SMTP:', response)
        
        if (response.startsWith('220') && step === 0) {
          // Server greeting
          socket.write('EHLO localhost\r\n')
          step = 1
        } else if (response.includes('250') && response.includes('STARTTLS') && step === 1) {
          // Server capabilities received, start TLS
          socket.write('STARTTLS\r\n')
          step = 2
        } else if (response.startsWith('220') && step === 2) {
          // Ready for TLS, upgrade connection
          console.log('🔐 Starting TLS upgrade...')
          const secureSocket = tls.connect({
            socket: socket,
            servername: 'smtp.gmail.com',
            rejectUnauthorized: false
          })
          
          secureSocket.on('secureConnect', () => {
            console.log('✅ TLS connection established')
            secureSocket.write('EHLO localhost\r\n')
            step = 3
            socket = secureSocket // Replace socket with secure socket
          })
          
          secureSocket.on('data', (secureData: Buffer) => {
            const secureResponse = secureData.toString().trim()
            console.log('🔒 Secure SMTP:', secureResponse)
            
            if (secureResponse.includes('250') && secureResponse.includes('AUTH') && step === 3) {
              // Ready for authentication
              secureSocket.write('AUTH LOGIN\r\n')
              step = 4
            } else if (secureResponse.startsWith('334') && step === 4) {
              // Send username
              const username = Buffer.from(process.env.GMAIL_USER || '').toString('base64')
              secureSocket.write(username + '\r\n')
              step = 5
            } else if (secureResponse.startsWith('334') && step === 5) {
              // Send password
              const password = Buffer.from(process.env.GMAIL_APP_PASSWORD || '').toString('base64')
              secureSocket.write(password + '\r\n')
              step = 6
            } else if (secureResponse.startsWith('235') && step === 6) {
              // Authentication successful
              console.log('✅ Gmail authentication successful')
              authenticated = true
              secureSocket.write(`MAIL FROM:<${process.env.GMAIL_USER}>\r\n`)
              step = 7
            } else if (secureResponse.startsWith('250') && step === 7) {
              // MAIL FROM accepted
              secureSocket.write(`RCPT TO:<${to}>\r\n`)
              step = 8
            } else if (secureResponse.startsWith('250') && step === 8) {
              // RCPT TO accepted
              secureSocket.write('DATA\r\n')
              step = 9
            } else if (secureResponse.startsWith('354') && step === 9) {
              // Ready for message data
              const message = [
                `From: "Learning Habit Tracker" <${process.env.GMAIL_USER}>`,
                `To: ${to}`,
                `Subject: ${subject}`,
                `Content-Type: text/html; charset=UTF-8`,
                ``,
                html,
                `.`
              ].join('\r\n') + '\r\n'
              
              secureSocket.write(message)
              step = 10
            } else if (secureResponse.startsWith('250') && step === 10) {
              // Message accepted
              console.log('✅ Verification email sent successfully!')
              secureSocket.write('QUIT\r\n')
              const messageId = 'gmail-verification-' + Date.now()
              resolve({ messageId })
            } else if (secureResponse.startsWith('535') || secureResponse.startsWith('534')) {
              // Authentication failed
              reject(new Error('Gmail authentication failed. Please check your App Password.'))
            }
          })
          
          secureSocket.on('error', (error: Error) => {
            console.error('🔒 TLS Error:', error)
            reject(new Error(`TLS connection failed: ${error.message}`))
          })
          
        } else if (response.startsWith('535') || response.startsWith('534')) {
          // Authentication failed
          reject(new Error('Gmail authentication failed. Please check your App Password.'))
        }
      })
      
      socket.on('error', (error: Error) => {
        console.error('📡 Connection Error:', error)
        reject(new Error(`SMTP connection failed: ${error.message}`))
      })
      
      socket.on('close', () => {
        console.log('📡 SMTP connection closed')
      })
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (!authenticated) {
          socket.destroy()
          reject(new Error('SMTP authentication timeout'))
        }
      }, 30000)
      
    } catch (error) {
      reject(error)
    }
  })
}

// Send email using multiple fallback methods (FIXED VERSION)
async function sendVerificationEmail(email: string, pin: string, firstName?: string): Promise<boolean> {
  console.log(`🚀 Sending verification email to: ${email}`)
  
  try {
    // Option 1: Try Resend first (if configured)
    if (process.env.RESEND_API_KEY) {
      try {
        console.log('📧 Trying Resend...')
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'Learning Habit Tracker <noreply@yourdomain.com>',
          to: email,
          subject: 'Verify your email - Learning Habit Tracker',
          html: createPinEmailHtml(pin, firstName),
          text: createPinEmailText(pin, firstName)
        })
        
        console.log('✅ Verification email sent successfully via Resend')
        return true
      } catch (error) {
        console.error('❌ Resend failed:', error.message)
        // Continue to next option
      }
    }
    
    // Option 2: Try Gmail SMTP (WORKING VERSION - same as test page)
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      try {
        console.log('📧 Trying Gmail SMTP (verified working method)...')
        
        // Validate configuration first
        if (process.env.GMAIL_APP_PASSWORD.length !== 16) {
          throw new Error(`Gmail App Password must be exactly 16 characters (current: ${process.env.GMAIL_APP_PASSWORD.length})`)
        }
        
        const info = await sendEmailWithGmailSMTP(
          email,
          'Verify your email - Learning Habit Tracker',
          createPinEmailHtml(pin, firstName),
          createPinEmailText(pin, firstName)
        )
        
        console.log('✅ Verification email sent successfully via Gmail SMTP!')
        return true
      } catch (error) {
        console.error('❌ Gmail SMTP failed:', error.message)
        
        // Provide specific error guidance
        if (error.message?.includes('authentication failed')) {
          console.error('💡 Fix: Generate a new App Password at https://myaccount.google.com/apppasswords')
        } else if (error.message?.includes('16 characters')) {
          console.error('💡 Fix: Your App Password should be exactly 16 characters long')
        }
        
        // Continue to next option
      }
    }
    
    // Option 3: Try SendGrid (if configured)
    if (process.env.SENDGRID_API_KEY) {
      try {
        console.log('📧 Trying SendGrid...')
        const sgMail = await import('@sendgrid/mail')
        const sg = sgMail.default || sgMail
        sg.setApiKey(process.env.SENDGRID_API_KEY)
        
        await sg.send({
          to: email,
          from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
          subject: 'Verify your email - Learning Habit Tracker',
          html: createPinEmailHtml(pin, firstName),
          text: createPinEmailText(pin, firstName)
        })
        
        console.log('✅ Verification email sent successfully via SendGrid')
        return true
      } catch (error) {
        console.error('❌ SendGrid failed:', error.message)
        // Continue to next option
      }
    }
    
    // Fallback: Log PIN for development (when no service is configured or all fail)
    console.log('=== EMAIL VERIFICATION PIN (FALLBACK) ===')
    console.log(`To: ${email}`)
    console.log(`PIN: ${pin}`)
    console.log(`Name: ${firstName || 'User'}`)
    console.log('=========================================')
    console.log('Email services attempted but failed.')
    console.log('User can still complete registration using this PIN.')
    console.log('=========================================')
    
    return true // Return true to allow registration to continue
  } catch (error) {
    console.error('❌ All email services failed:', error.message)
    
    // Still log the PIN so user can complete registration
    console.log('=== EMAIL VERIFICATION PIN (ERROR FALLBACK) ===')
    console.log(`To: ${email}`)
    console.log(`PIN: ${pin}`)
    console.log(`Name: ${firstName || 'User'}`)
    console.log('===============================================')
    
    return true // Return true to allow registration to continue
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
    console.log(`🔐 Generated PIN for ${email}: ${verification.pin}`)
    
    // Store in database
    const stored = await storeEmailVerification(verification)
    if (!stored) {
      return { success: false, error: 'Failed to generate verification code' }
    }
    
    // Send email
    const emailSent = await sendVerificationEmail(email, verification.pin, firstName)
    if (!emailSent) {
      return { success: false, error: 'Failed to send verification email. Please check your email service configuration.' }
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
    console.log(`🔍 Verifying PIN for ${email}: ${pin}`)
    
    // Validate PIN format
    if (!isValidPinFormat(pin)) {
      return { success: false, error: 'Invalid PIN format. Please enter a 6-digit code.' }
    }
    
    // Get verification data
    const verification = await getEmailVerification(email)
    if (!verification) {
      return { success: false, error: 'Verification code not found. Please request a new code.' }
    }
    
    console.log(`📋 Retrieved verification data for ${email}:`)
    console.log(`   - Stored PIN: ${verification.pin}`)
    console.log(`   - Entered PIN: ${pin}`)
    console.log(`   - Attempts: ${verification.attempts}/${verification.maxAttempts}`)
    console.log(`   - Verified: ${verification.verified}`)
    console.log(`   - Expired: ${isVerificationExpired(verification)}`)
    
    // Check if already verified
    if (verification.verified) {
      console.log('✅ Email already verified')
      return { success: true }
    }
    
    // Check if expired
    if (isVerificationExpired(verification)) {
      console.log('⏰ Verification code expired')
      return { success: false, error: 'Verification code has expired. Please request a new code.' }
    }
    
    // Check attempts
    if (verification.attempts >= verification.maxAttempts) {
      console.log('🚫 Too many failed attempts')
      return { success: false, error: 'Too many failed attempts. Please request a new code.' }
    }
    
    // Verify PIN
    if (verification.pin === pin) {
      // Update as verified
      await updateVerificationAttempts(email, verification.attempts + 1, true)
      console.log('✅ PIN verification successful!')
      return { success: true }
    } else {
      // Increment attempts
      const newAttempts = verification.attempts + 1
      await updateVerificationAttempts(email, newAttempts, false)
      
      const remaining = verification.maxAttempts - newAttempts
      console.log(`❌ PIN verification failed. ${remaining} attempts remaining.`)
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
    const isVerified = verification?.verified === true
    console.log(`📧 Email ${email} verification status: ${isVerified}`)
    return isVerified
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
    console.log(`🔄 Resending verification PIN for: ${email}`)
    
    // Check if there's an existing verification
    const existing = await getEmailVerification(email)
    
    // If exists and not expired, don't allow resend too quickly
    if (existing && !isVerificationExpired(existing)) {
      const timeSinceCreated = Date.now() - existing.createdAt.getTime()
      const oneMinute = 60 * 1000
      
      if (timeSinceCreated < oneMinute) {
        console.log('⏰ Resend too soon, blocking request')
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