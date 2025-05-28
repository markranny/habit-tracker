// lib/email-validation.ts
export interface EmailValidationResult {
  isValid: boolean
  isGmail: boolean
  exists?: boolean
  error?: string
  suggestion?: string
}

// Basic email format validation
export function validateEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Check if email is a Gmail address
export function isGmailAddress(email: string): boolean {
  const gmailDomains = [
    'gmail.com',
    'googlemail.com'
  ]
  
  const domain = email.toLowerCase().split('@')[1]
  return gmailDomains.includes(domain)
}

// Enhanced email validation with Gmail-specific checks
export function validateGmailAddress(email: string): EmailValidationResult {
  const result: EmailValidationResult = {
    isValid: false,
    isGmail: false
  }

  // Basic format check
  if (!validateEmailFormat(email)) {
    result.error = "Invalid email format"
    return result
  }

  result.isValid = true
  result.isGmail = isGmailAddress(email)

  if (result.isGmail) {
    // Gmail-specific validations
    const [localPart, domain] = email.toLowerCase().split('@')
    
    // Check for common Gmail rules
    if (localPart.length < 1) {
      result.isValid = false
      result.error = "Gmail username cannot be empty"
      return result
    }

    if (localPart.length > 30) {
      result.isValid = false
      result.error = "Gmail username is too long (max 30 characters)"
      return result
    }

    // Check for valid characters in Gmail
    const validGmailRegex = /^[a-z0-9.]+$/
    if (!validGmailRegex.test(localPart)) {
      result.isValid = false
      result.error = "Gmail addresses can only contain letters, numbers, and periods"
      return result
    }

    // Check for consecutive periods
    if (localPart.includes('..')) {
      result.isValid = false
      result.error = "Gmail addresses cannot have consecutive periods"
      return result
    }

    // Check if starts or ends with period
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      result.isValid = false
      result.error = "Gmail addresses cannot start or end with a period"
      return result
    }
  }

  return result
}

// Server-side email validation (more comprehensive)
export async function serverValidateEmail(email: string): Promise<EmailValidationResult> {
  const result = validateGmailAddress(email)
  
  if (!result.isValid) {
    return result
  }

  try {
    // For Gmail addresses, we can do additional checks
    if (result.isGmail) {
      const [localPart] = email.toLowerCase().split('@')
      
      // Remove dots from Gmail address (Gmail ignores dots)
      const normalizedLocal = localPart.replace(/\./g, '')
      
      // Check if the normalized version looks suspicious
      if (normalizedLocal.length < 3) {
        result.error = "Gmail address appears to be too short"
        result.isValid = false
        return result
      }

      // You could add more sophisticated checks here
      // For example, checking against known spam patterns
    }

    result.exists = true
    return result
  } catch (error) {
    result.error = "Unable to verify email existence"
    return result
  }
}

// Suggest corrections for common email typos
export function suggestEmailCorrection(email: string): string | null {
  const commonTypos = {
    'gamil.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'g-mail.com': 'gmail.com',
    'googlemai.com': 'googlemail.com',
    'googemail.com': 'googlemail.com'
  }

  const [localPart, domain] = email.toLowerCase().split('@')
  
  if (commonTypos[domain]) {
    return `${localPart}@${commonTypos[domain]}`
  }

  return null
}