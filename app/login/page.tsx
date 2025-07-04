'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link';

interface DiagnosticsData {
  session: unknown;
  sessionStatus: string;
  cookies: { authCookies?: unknown[] } | { error: string };
  config: { config?: { NEXTAUTH_URL?: string } } | { error: string };
  timestamp: string;
  testUser: {
    email: string;
    password: string;
  };
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [debug, setDebug] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const router = useRouter();
  const { data: session, status } = useSession();

  const checkCookies = async () => {
    try {
      const res = await fetch('/api/auth/check-cookies');
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Error checking cookies:', error);
      return { error: 'Failed to check cookies' };
    }
  };

  const checkConfig = async () => {
    try {
      const res = await fetch('/api/auth/config');
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Error checking config:', error);
      return { error: 'Failed to check config' };
    }
  };

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const cookies = await checkCookies();
      const config = await checkConfig();
      
      setDiagnostics({
        session,
        sessionStatus: status,
        cookies,
        config,
        timestamp: new Date().toISOString(),
        testUser: {
          email: 'test@example.com',
          password: 'testpass123'
        }
      });
    } catch (error) {
      console.error('Diagnostics error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check session status on mount
  useEffect(() => {
    // Try to get auth status from local storage
    const storedAuthStatus = localStorage.getItem('auth-status');
    console.log('Login page loaded, stored auth status:', storedAuthStatus);
    console.log('Current session status:', status, 'Session object:', session);
    
    // Check if we're already authenticated with actual user data
    if (status === 'authenticated' && session?.user) {
      console.log('Login Page: User is authenticated with actual user data, redirecting...', session.user);
      localStorage.setItem('auth-status', 'authenticated');
      localStorage.setItem('auth-timestamp', new Date().toISOString());
      router.push('/');
    } else if (status === 'authenticated' && !session?.user) {
      console.log('Login Page: Status is authenticated, but no session.user data. Staying on login page.');
      // This state might occur if a session token exists but user details couldn't be fetched
      // Or if localStorage is out of sync. Consider clearing it if it causes issues.
      // if (storedAuthStatus === 'authenticated') {
      //   localStorage.removeItem('auth-status');
      //   localStorage.removeItem('auth-timestamp');
      // }
    } 
    // If localStorage thinks we're authenticated but NextAuth session is not (or loading)
    else if (storedAuthStatus === 'authenticated' && (status === 'unauthenticated' || status === 'loading')) {
      console.log('Login Page: Local storage says authenticated but session status is different. Potential session issue or logout.');
      const timestamp = localStorage.getItem('auth-timestamp');
      const fiveMinutesAgo = new Date();
      fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
      
      if (timestamp && new Date(timestamp) > fiveMinutesAgo && status === 'loading') {
        console.log('Login Page: Recent authentication detected and session is loading, awaiting resolution...');
        // Wait for useSession to resolve
      } else {
        console.log('Login Page: Clearing stale or mismatched auth data from localStorage.');
        localStorage.removeItem('auth-status');
        localStorage.removeItem('auth-timestamp');
        // if (status !== 'loading') window.location.reload(); // Optional: force refresh if session is definitively unauthenticated
      }
    }
  }, [status, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Login attempt for identifier:', identifier);
      
      // First, let's get the CSRF token to ensure it's available
      try {
        const csrfResponse = await fetch('/api/auth/csrf');
        const csrfData = await csrfResponse.json();
        console.log('CSRF token check:', csrfData);
      } catch (csrfError) {
        console.warn('CSRF token check failed:', csrfError);
      }
      
      const result = await signIn('credentials', {
        identifier,
        password,
        redirect: false,
        callbackUrl: '/', // Explicitly set callbackUrl
      });

      console.log('Sign-in result:', result);

      if (result?.error) {
        console.error('Login error:', result.error);
        if (result.error === 'MissingCSRF') {
          setError('Authentication error. Please refresh the page and try again.');
        } else if (result.error === 'CredentialsSignin') {
          setError('Invalid email/phone or password. Please check your credentials.');
        } else if (result.error === 'CallbackRouteError') {
          setError('Authentication callback error. Please try again.');
        } else {
          setError(`Login failed: ${result.error}`);
        }
        setLoading(false);
        return;
      }

      // If login is successful, result.ok will be true.
      setSuccessMessage('Login successful! Redirecting...');
      
      // Store auth status in localStorage to help detect session issues
      localStorage.setItem('auth-status', 'authenticated');
      localStorage.setItem('auth-timestamp', new Date().toISOString());
      
      // Use a short delay to ensure cookies are properly set before redirect
      setTimeout(() => {
        console.log('Login successful, redirecting to:', result?.url || '/');
        window.location.href = (result?.url || '/') + '?auth=success';
      }, 1500);
    } catch (err) {
      console.error('Login general error:', err);
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-xl shadow-2xl border border-border">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-primary">SHG Platform</h1>
          <p className="mt-2 text-muted-foreground">Login to your account</p>
        </div>
      
        {error && (
          <div className="bg-destructive/20 text-destructive p-4 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="bg-green-100 text-green-700 p-4 rounded-lg text-sm">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-foreground mb-1">
              Email or Phone Number
            </label>
            <input
              type="text"
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
              required
              placeholder="you@example.com or +1234567890"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
              required
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-70 transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Logging in...
              </span>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="mt-6 text-sm text-center">
          <span className="text-muted-foreground">Don&apos;t have an account? </span>
          <Link href="/register" className="font-medium text-primary hover:underline">
            Register here
          </Link>
        </div>
        
        <div className="mt-2 text-sm text-center">
          <Link href="/login/alternative-login" className="text-muted-foreground hover:text-primary">
            Try alternative login method
          </Link>
        </div>

        {/* Debugging section */}
        <div className="mt-8 pt-4 border-t border-border">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setDebug(!debug)}
          >
            {debug ? 'Hide Debug Info' : 'Show Debug Info'}
          </button>
          
          {debug && (
            <div className="mt-4">
              <button
                type="button"
                className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-md"
                onClick={runDiagnostics}
                disabled={loading}
              >
                {loading ? 'Running Diagnostics...' : 'Run Diagnostics'}
              </button>
              
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Test User: test@example.com / testpass123</p>
              </div>
              
              {diagnostics && (
                <div className="mt-4 p-3 bg-muted rounded-md text-xs overflow-auto max-h-64">
                  <p className="font-semibold">Session Status: {String(diagnostics.sessionStatus)}</p>
                  <p className="font-semibold mt-2">Auth Cookies: {'authCookies' in diagnostics.cookies ? (diagnostics.cookies.authCookies?.length || 0) : 'Error'}</p>
                  <p className="font-semibold mt-2">NEXTAUTH_URL: {'config' in diagnostics.config && diagnostics.config.config?.NEXTAUTH_URL ? diagnostics.config.config.NEXTAUTH_URL : 'Not available'}</p>
                  <pre className="mt-2 text-[10px] text-muted-foreground overflow-x-auto">
                    {JSON.stringify(diagnostics, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
