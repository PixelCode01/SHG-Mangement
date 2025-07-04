'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessPageContent() {
  const [countdown, setCountdown] = useState(5);
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams?.get('email') || '';
  const name = searchParams?.get('name') || 'User';
  const role = searchParams?.get('role') || '';
  
  // Auto-redirect after countdown
  useEffect(() => {
    if (countdown <= 0) {
      router.push('/login');
      return;
    }
    
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown, router]);

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-card rounded-md shadow-md border border-border">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-2">Registration Successful!</h1>
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      
      <div className="bg-green-500/10 text-green-600 p-4 rounded-md mb-6">
        <p className="font-medium mb-2">Thank you for registering, {name}!</p>
        <p className="text-sm">
          Your account has been created successfully with email: <strong>{email}</strong>
          {role && <span> as a <strong>{role.replace('_', ' ')}</strong></span>}
        </p>
      </div>
      
      <div className="mb-6 text-sm text-center text-muted-foreground">
        <p>You will be redirected to the login page in <span className="font-bold">{countdown}</span> seconds...</p>
      </div>
      
      <div className="flex justify-center">
        <Link href="/login" className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md transition-colors">
          Log in now
        </Link>
      </div>
      
      <div className="mt-6 text-xs text-center text-muted-foreground">
        <p>Having trouble? Contact our support team for assistance.</p>
      </div>
    </div>
  );
}

export default function RegistrationSuccessPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto mt-10 p-6 text-center">Loading...</div>}>
      <SuccessPageContent />
    </Suspense>
  );
}
