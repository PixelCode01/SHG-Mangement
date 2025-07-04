'use client';

import { useEffect, useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import 'react-datepicker/dist/react-datepicker.css'; // Import datepicker CSS globally

export default function ClientSetup({ children }: { children?: React.ReactNode }) {
  const [sessionError, setSessionError] = useState<boolean>(false);
  
  // This component handles client-side effects and authentication context
  useEffect(() => {
    // Client-side initialization
    console.log('[ClientSetup] Client initialized');
    document.body.classList.add('client-initialized');
    
    // Check if cookies are missing and reload if needed
    const checkCookies = async () => {
      try {
        const res = await fetch('/api/auth/check-cookies', {
          // Add cache control headers to avoid caching
          headers: {
            'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        if (!res.ok) {
          console.error('[ClientSetup] Failed to check cookies:', res.status, res.statusText);
          return;
        }
        
        const data = await res.json();
        console.log('[ClientSetup] Cookie check:', data);
        
        // If we should have auth but don't have cookies, try refreshing
        const authStatus = localStorage.getItem('auth-status');
        const authTimestamp = localStorage.getItem('auth-timestamp');
        
        // Check if auth is recent (less than 10 minutes old)
        const isRecentAuth = authTimestamp && 
          (new Date().getTime() - new Date(authTimestamp).getTime() < 10 * 60 * 1000);
        
        if (authStatus === 'authenticated') {
          if (data.authCookies && data.authCookies.length > 0) {
            console.log('[ClientSetup] Auth cookies found, session should be valid');
          } else if (isRecentAuth) {
            console.log('[ClientSetup] Recent authentication but missing cookies, refreshing session...');
            // Try session-test API first
            try {
              const testRes = await fetch('/api/auth/session-test', {
                headers: {
                  'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
                  'Pragma': 'no-cache'
                }
              });
              
              if (testRes.ok) {
                const sessionData = await testRes.json();
                console.log('[ClientSetup] Session test result:', sessionData);
                
                if (sessionData.hasSession) {
                  console.log('[ClientSetup] Session test successful, will reload');
                  setTimeout(() => window.location.reload(), 500);
                } else {
                  console.log('[ClientSetup] No valid session found');
                  // Clear stale auth data
                  localStorage.removeItem('auth-status');
                  localStorage.removeItem('auth-timestamp');
                }
              } else {
                throw new Error('Session test failed');
              }
            } catch (e) {
              console.error('[ClientSetup] Session test failed, redirecting to login', e);
              // Clear stale auth data
              localStorage.removeItem('auth-status');
              localStorage.removeItem('auth-timestamp');
              window.location.href = '/login';
            }
          } else {
            // Auth is stale, clear it
            console.log('[ClientSetup] Stale authentication data, clearing');
            localStorage.removeItem('auth-status');
            localStorage.removeItem('auth-timestamp');
          }
        }
      } catch (error) {
        console.error('[ClientSetup] Error checking cookies:', error);
      }
    };
    
    checkCookies();
    
    // Add error event listener for client-side fetch errors
    const handleError = (event: ErrorEvent) => {
      // Check if it's a session-related error
      if (event.message?.includes('json') && event.message?.includes('Unexpected end')) {
        console.error('[ClientSetup] JSON parsing error detected, likely session API issue');
        setSessionError(true);
        
        // Clear auth status since we can't reliably determine it
        localStorage.removeItem('auth-status');
        
        // Redirect to login if we get a session error
        if (window.location.pathname !== '/login') {
          console.log('[ClientSetup] Redirecting to login due to session error');
          window.location.href = '/login';
        }
      }
    };
    
    window.addEventListener('error', handleError);
    
    return () => {
      document.body.classList.remove('client-initialized');
      window.removeEventListener('error', handleError);
    };
  }, []);
  
  // Function to check session status using the fallback API
  const checkSessionStatus = async () => {
    try {
      const res = await fetch('/api/auth/session-test');
      if (res.ok) {
        const data = await res.json();
        console.log('[ClientSetup] Session test API response:', data);
        return data.hasSession;
      }
    } catch (e) {
      console.error('[ClientSetup] Error checking session status:', e);
    }
    return false;
  };

  // Use effect to monitor and recover from session errors
  useEffect(() => {
    if (sessionError) {
      // Try to recover using the session-test API
      checkSessionStatus().then(hasSession => {
        if (hasSession) {
          console.log('[ClientSetup] Session exists according to test API, will attempt reload');
          // Set a timeout to avoid immediate reload loops
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        } else {
          console.log('[ClientSetup] No session found in test API, redirecting to login');
          // If no session, redirect to login
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      });
    }
  }, [sessionError]);

  // Show an error fallback if we detect a session error
  if (sessionError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-full max-w-md p-8 space-y-4 bg-card rounded-xl shadow-xl border border-border">
          <h1 className="text-2xl font-bold text-primary">Session Error</h1>
          <p className="text-muted-foreground">There was a problem loading your session.</p>
          <button 
            onClick={() => window.location.href = '/login'} 
            className="w-full bg-primary text-primary-foreground py-2 rounded-lg"
          >
            Go to Login
          </button>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full bg-secondary text-secondary-foreground py-2 rounded-lg mt-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  // Error boundary to catch any JSON parsing errors from the session API
  try {
    return (
      <SessionProvider 
        basePath="/api/auth"
        refetchInterval={5} // Small interval to refresh session
        refetchOnWindowFocus={true}
        refetchWhenOffline={false}
      >
        {children}
      </SessionProvider>
    );
  } catch (error) {
    console.error('[ClientSetup] Error in SessionProvider:', error);
    setSessionError(true);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <p className="text-lg font-medium">Session error detected. Attempting to recover...</p>
        </div>
      </div>
    );
  }
}
