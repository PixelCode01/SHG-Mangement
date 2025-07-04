/**
 * Security Utilities
 * Contains various security-related helper functions
 */

import crypto from 'crypto';

// Input validation and sanitization
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>\"'&]/g, (match) => {
      const entities: { [key: string]: string } = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[match] || match;
    });
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Validate phone number
export function isValidPhone(phone: string): boolean {
  // Remove all non-digit characters for validation
  const cleanPhone = phone.replace(/\D/g, '');
  // Should be 10-15 digits (international format)
  return cleanPhone.length >= 10 && cleanPhone.length <= 15;
}

// Password strength validation
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const minLength = parseInt(process.env.MIN_PASSWORD_LENGTH || '8');
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  
  if (process.env.REQUIRE_UPPERCASE === 'true' && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (process.env.REQUIRE_LOWERCASE === 'true' && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (process.env.REQUIRE_NUMBERS === 'true' && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (process.env.REQUIRE_SPECIAL_CHARS === 'true' && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Generate secure random string
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// Hash sensitive data for logging (one-way)
export function hashForLogging(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8);
}

// Rate limiting key generation
export function generateRateLimitKey(identifier: string, action: string): string {
  return `ratelimit:${action}:${hashForLogging(identifier)}`;
}

// Validate file upload
export function validateFileUpload(file: File): {
  isValid: boolean;
  error?: string;
} {
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'application/pdf').split(',');
  
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`
    };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
    };
  }
  
  return { isValid: true };
}

// SQL injection prevention helpers
export function escapeSQLLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

// Content Security Policy nonce generation
export function generateCSPNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

// Secure headers for API responses
export function getSecureHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
  };
}
