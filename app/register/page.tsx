'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserRole } from '@prisma/client';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('MEMBER');
  const [memberId, setMemberId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [memberIdStatus, setMemberIdStatus] = useState<{valid: boolean, message: string} | null>(null);
  const [memberIdChecking, setMemberIdChecking] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | ''>('');
  const [passwordFeedback, setPasswordFeedback] = useState('');
  
  // Function to validate member ID
  const validateMemberId = async (id: string) => {
    if (!id.trim()) {
      setMemberIdStatus(null);
      return;
    }
    
    setMemberIdChecking(true);
    try {
      const response = await fetch('/api/auth/check-member-id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId: id }),
      });
      
      const data = await response.json();
      
      setMemberIdStatus({
        valid: data.valid,
        message: data.message
      });
    } catch {
      setMemberIdStatus({
        valid: false,
        message: 'Error checking Member ID'
      });
    } finally {
      setMemberIdChecking(false);
    }
  };
  
  // Password strength checker
  const checkPasswordStrength = (pwd: string) => {
    if (!pwd) {
      setPasswordStrength('');
      setPasswordFeedback('');
      return;
    }
    
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    
    const criteriaCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    
    if (pwd.length < 8) {
      setPasswordStrength('weak');
      setPasswordFeedback('Password should be at least 8 characters long');
    } else if (criteriaCount === 1) {
      setPasswordStrength('weak');
      setPasswordFeedback('Try adding uppercase letters, numbers, or special characters');
    } else if (criteriaCount === 2) {
      setPasswordStrength('medium');
      setPasswordFeedback('Good! Add more character types for a stronger password');
    } else if (criteriaCount === 3) {
      setPasswordStrength('strong');
      setPasswordFeedback('Strong password!');
    } else {
      setPasswordStrength('strong');
      setPasswordFeedback('Excellent password strength!');
    }
  };
  
  // Debounced member ID validation
  useEffect(() => {
    if (role === 'MEMBER' && memberId.trim()) {
      const timer = setTimeout(() => {
        validateMemberId(memberId);
      }, 500); // 500ms debounce
      
      return () => clearTimeout(timer);
    } else {
      setMemberIdStatus(null);
      return undefined;
    }
  }, [memberId, role]);
  
  // Update password strength indicator when password changes
  useEffect(() => {
    checkPasswordStrength(password);
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Name validation
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters long');
      setLoading(false);
      return;
    }

    // Validation - user must provide either email or phone
    if (!email.trim() && !phone.trim()) {
      setError('Please provide either an email address or phone number');
      setLoading(false);
      return;
    }

    // Email validation if provided
    if (email.trim()) {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address');
        setLoading(false);
        return;
      }
    }

    // Phone validation if provided
    if (phone.trim()) {
      const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
      if (!phoneRegex.test(phone)) {
        setError('Please enter a valid phone number (minimum 10 digits)');
        setLoading(false);
        return;
      }
    }

    // Password validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }
    
    // Password strength validation
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!(hasLetter && (hasNumber || hasSpecial))) {
      setError('Password must contain letters and at least one number or special character');
      setLoading(false);
      return;
    }

    // Member ID validation for MEMBER role
    if (role === 'MEMBER' && !memberId.trim()) {
      setError('Member ID is required when registering as a Member');
      setLoading(false);
      return;
    }
    
    // Check if member ID is valid according to our validation
    if (role === 'MEMBER' && memberIdStatus && !memberIdStatus.valid) {
      setError(`Invalid Member ID: ${memberIdStatus.message}`);
      setLoading(false);
      return;
    }

    try {
      // Call our API to register the user
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name, 
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password,
          role,
          memberId: role === 'MEMBER' ? memberId : undefined 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to register');
      }

      // Redirect to success page with user information
      const params = new URLSearchParams({
        name: name,
        role: role
      });
      
      // Add email or phone to params
      if (email.trim()) params.set('email', email);
      if (phone.trim()) params.set('phone', phone);
      
      // Show brief success message
      setSuccess('Account created successfully! Redirecting to confirmation page...');
      
      // Redirect to success page after brief delay
      setTimeout(() => {
        // Use window.location with auth=register parameter to help middleware
        window.location.href = `/register/success?${params.toString()}&auth=register`;
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-card rounded-md shadow-md border border-border">
      <h1 className="text-2xl font-bold mb-6 text-center">Register</h1>
      
      {success && (
        <div className="bg-green-500/20 text-green-600 p-3 rounded-md mb-4">
          <p className="font-semibold">Success</p>
          <p>{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border border-border rounded-md bg-background"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email (Optional)
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border border-border rounded-md bg-background"
            placeholder="you@example.com"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="phone" className="block text-sm font-medium mb-1">
            Phone Number (Optional)
          </label>
          <input
            type="tel"
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-2 border border-border rounded-md bg-background"
            placeholder="+1234567890 or 1234567890"
          />
          <div className="mt-1 text-xs text-muted-foreground">
            Provide either email or phone number (or both)
          </div>
        </div>
        
        <div className="mb-4">
          <label htmlFor="role" className="block text-sm font-medium mb-1">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full p-2 border border-border rounded-md bg-background"
            required
          >
            <option value="MEMBER">Member</option>
            <option value="GROUP_LEADER">Group Leader</option>
          </select>
          <div className="mt-2 text-xs text-muted-foreground">
            <p className="mb-1"><strong>Member:</strong> A regular member of a Self-Help Group. Requires a valid Member ID from your group leader.</p>
            <p><strong>Group Leader:</strong> Can create and manage groups, add members, and view member details.</p>
          </div>
        </div>
        
        {role === 'MEMBER' && (
          <div className="mb-4">
            <label htmlFor="memberId" className="block text-sm font-medium mb-1">
              Member ID
            </label>
            <input
              type="text"
              id="memberId"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full p-2 border border-border rounded-md bg-background"
              required
              placeholder="Enter the ID provided by your group leader"
            />
            <div className="mt-1 text-xs text-muted-foreground flex items-center">
              <span className="mr-1">*</span>
              <span>Your group leader can provide you with your Member ID. This links your account with your existing member record in the system.</span>
            </div>
            {memberIdChecking && (
              <div className="mt-2 text-xs text-amber-600">
                Checking Member ID...
              </div>
            )}
            {!memberIdChecking && memberIdStatus && (
              <div className={`mt-2 text-xs ${memberIdStatus.valid ? 'text-green-600' : 'text-red-600'}`}>
                {memberIdStatus.message}
              </div>
            )}
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border border-border rounded-md bg-background"
            required
            minLength={8}
          />
          {password && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs">Strength:</span>
                <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden flex">
                  <div 
                    className={`h-full ${
                      passwordStrength === 'weak' ? 'bg-red-500 w-1/3' : 
                      passwordStrength === 'medium' ? 'bg-amber-500 w-2/3' : 
                      passwordStrength === 'strong' ? 'bg-green-500 w-full' : ''
                    }`}
                  />
                </div>
                <span className="text-xs capitalize">
                  {passwordStrength || 'None'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{passwordFeedback}</p>
            </div>
          )}
        </div>

        <div className="mb-6">
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-2 border border-border rounded-md bg-background"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Registering...' : 'Register'}
        </button>
        
        {/* Error display below register button */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}
      </form>

      <div className="mt-4 text-sm text-center text-muted-foreground">
        Already have an account? <Link href="/login" className="text-primary hover:underline">Login</Link>
      </div>
      
      <div className="mt-6 p-4 bg-card/50 border border-border rounded-md">
        <h3 className="text-sm font-medium mb-2">Registration Help</h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• If you&apos;re a <strong>Member</strong>, you need a valid Member ID from your group leader.</li>
          <li>• As a <strong>Group Leader</strong>, you can register without a Member ID.</li>
          <li>• Having trouble? Contact your SHG administrator for assistance.</li>
          <li>• Make sure your password is at least 8 characters and includes letters and numbers.</li>
        </ul>
      </div>
    </div>
  );
}
