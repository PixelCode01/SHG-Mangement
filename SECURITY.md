# Security Setup and Best Practices

## Overview
This document outlines the security measures implemented in the SHG Management System and best practices for deployment.

## Environment Configuration

### 1. Environment Variables
Copy `.env.example` to `.env.local` and configure the following:

#### Required Security Variables
```bash
# Strong secret for NextAuth.js (minimum 32 characters)
NEXTAUTH_SECRET="your_super_secure_secret_here_at_least_32_chars"

# Database connection with proper authentication
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# Production URL (change for production)
NEXTAUTH_URL="https://yourdomain.com"
```

#### Optional Security Enhancements
```bash
# Rate limiting configuration
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Password policy
MIN_PASSWORD_LENGTH=8
REQUIRE_UPPERCASE=true
REQUIRE_LOWERCASE=true
REQUIRE_NUMBERS=true
REQUIRE_SPECIAL_CHARS=true

# Session configuration
SESSION_MAX_AGE=86400  # 24 hours
SESSION_UPDATE_AGE=3600  # Update every hour

# File upload security
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES="application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
```

## Security Features Implemented

### 1. Authentication & Authorization
- ✅ NextAuth.js with secure session management
- ✅ Role-based access control (ADMIN, GROUP_LEADER, MEMBER)
- ✅ Password hashing with bcrypt
- ✅ Session timeout and refresh

### 2. Input Validation & Sanitization
- ✅ Zod schema validation for all API endpoints
- ✅ Input sanitization for XSS prevention
- ✅ File upload validation and size limits
- ✅ SQL injection prevention with Prisma ORM

### 3. Security Headers
- ✅ Content Security Policy (CSP)
- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff
- ✅ X-XSS-Protection: 1; mode=block
- ✅ Referrer-Policy: strict-origin-when-cross-origin

### 4. Rate Limiting
- ✅ API rate limiting implementation
- ✅ IP-based rate limiting for authentication endpoints
- ✅ Configurable limits per endpoint

### 5. Data Protection
- ✅ Sensitive data hashing for logs
- ✅ Secure token generation
- ✅ No sensitive data in client-side code

## Deployment Security Checklist

### Pre-deployment
- [ ] Change all default passwords and secrets
- [ ] Review and configure environment variables
- [ ] Enable HTTPS/SSL certificates
- [ ] Configure database with SSL
- [ ] Review user permissions and roles

### Infrastructure Security
- [ ] Use a reverse proxy (nginx/Apache) with security headers
- [ ] Configure firewall rules
- [ ] Enable automatic security updates
- [ ] Set up monitoring and logging
- [ ] Configure database backups

### Application Security
- [ ] Set NODE_ENV=production
- [ ] Disable debug modes
- [ ] Configure proper CORS policies
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Enable audit logging

## Security Monitoring

### Recommended Monitoring
1. **Failed login attempts** - Monitor for brute force attacks
2. **Unusual API usage** - Watch for suspicious patterns
3. **File upload attempts** - Monitor for malicious uploads
4. **Database access** - Log sensitive data access
5. **Error rates** - Monitor for potential attacks

### Logging Configuration
```javascript
// Enable audit logs
ENABLE_AUDIT_LOGS=true
LOG_LEVEL="info"  // Use "warn" or "error" in production
```

## Regular Security Maintenance

### Weekly
- [ ] Review access logs for suspicious activity
- [ ] Check for failed authentication attempts
- [ ] Monitor system resource usage

### Monthly
- [ ] Update dependencies (`npm audit fix`)
- [ ] Review user accounts and permissions
- [ ] Check database integrity
- [ ] Review and rotate API keys/secrets

### Quarterly
- [ ] Security audit of code changes
- [ ] Review and update password policies
- [ ] Backup and recovery testing
- [ ] Update security documentation

## Incident Response Plan

### In case of security incident:
1. **Immediate Response**
   - Isolate affected systems
   - Change all passwords and API keys
   - Review access logs
   - Document the incident

2. **Investigation**
   - Determine scope of breach
   - Identify attack vectors
   - Assess data impact

3. **Recovery**
   - Patch vulnerabilities
   - Restore from clean backups if needed
   - Implement additional security measures
   - Monitor for continued threats

4. **Post-Incident**
   - Update security procedures
   - Train users on new security measures
   - Review and improve monitoring

## Contact Information
For security-related issues, contact: [security@yourorganization.com]

## Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Guidelines](https://nextjs.org/docs/basic-features/security-headers)
- [Prisma Security Best Practices](https://www.prisma.io/docs/guides/database/prisma-client-security)
