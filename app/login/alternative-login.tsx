'use client';

import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link';

export default function AlternativeLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [debug, setDebug] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  const { data: session, status } = useSession();

  // Check if already logged in
  useEffect(() => {
    if (status === 'authenticated') {
      setSuccessMessage('You are already logged in! Redirecting...');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    }
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      console.log('Login attempt for email:', email);
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      console.log('Sign-in result:', result);

      if (result?.error) {
        console.error('Login error:', result.error);
        setError('Invalid email or password');
        setLoading(false);
        return;
      }

      // If login is successful with redirect: false, we handle the redirect manually
      setSuccessMessage('Login successful! Redirecting...');
      
      // Store auth status in localStorage to help detect session issues
      localStorage.setItem('auth-status', 'authenticated');
      localStorage.setItem('auth-timestamp', new Date().toISOString());
      
      // Use window.location for a hard redirect that will reload the page and pick up the session
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
      
    } catch (err) {
      console.error('Login general error:', err);
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

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

  // Create a test user function
  const createTestUser = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/create-test-user');
      const data = await res.json();
      setSuccessMessage(`Test user created: ${data.user.email} / testpass123`);
      setEmail('test@example.com');
      setPassword('testpass123');
    } catch (error) {
      console.error('Error creating test user:', error);
      setError('Failed to create test user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-xl shadow-2xl border border-border">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-primary">SHG Platform</h1>
          <p className="mt-2 text-muted-foreground">Alternative Login</p>
          <p className="text-xs text-muted-foreground mt-1">(Uses window.location.href instead of router.push)</p>
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
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
              required
              placeholder="you@example.com"
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

        <div className="flex justify-center space-x-4">
          <Link href="/login" className="text-sm text-primary hover:underline">
            Regular Login
          </Link>
          <button 
            onClick={createTestUser}
            className="text-sm text-primary hover:underline"
            disabled={loading}
          >
            Create Test User
          </button>
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
              <div className="flex space-x-2">
                <button
                  type="button"
                  className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-md"
                  onClick={runDiagnostics}
                  disabled={loading}
                >
                  {loading ? 'Running Diagnostics...' : 'Run Diagnostics'}
                </button>
                
                <button
                  type="button"
                  className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-md"
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </button>
              </div>
              
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Test User: test@example.com / testpass123</p>
                <p className="text-xs text-muted-foreground">Session Status: {status}</p>
              </div>
              
              {diagnostics && (
                <div className="mt-4 p-3 bg-muted rounded-md text-xs overflow-auto max-h-64">
                  <p className="font-semibold">Session Status: {String(diagnostics.sessionStatus)}</p>
                  <p className="font-semibold mt-2">Auth Cookies: {
                    'cookies' in diagnostics && 
                    typeof diagnostics.cookies === 'object' && 
                    diagnostics.cookies && 
                    'authCookies' in diagnostics.cookies && 
                    Array.isArray(diagnostics.cookies.authCookies) 
                      ? diagnostics.cookies.authCookies.length 
                      : 0
                  }</p>
                  <p className="font-semibold mt-2">NEXTAUTH_URL: {
                    'config' in diagnostics && 
                    typeof diagnostics.config === 'object' && 
                    diagnostics.config && 
                    'config' in diagnostics.config && 
                    typeof diagnostics.config.config === 'object' && 
                    diagnostics.config.config && 
                    'NEXTAUTH_URL' in diagnostics.config.config 
                      ? String(diagnostics.config.config.NEXTAUTH_URL) 
                      : 'N/A'
                  }</p>
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
