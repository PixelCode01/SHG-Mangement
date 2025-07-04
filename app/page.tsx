'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import PendingLeadershipInvitations from './components/PendingLeadershipInvitations';

interface AppStats {
  totalGroups: number;
  totalMembers: number;
}

export default function Home() {
  const [stats, setStats] = useState<AppStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Check authentication status - using a more efficient approach
  useEffect(() => {
    let isMounted = true;
    
    async function checkAuth() {
      try {
        // Use a debounce to avoid too many checks, only run once
        const response = await fetch('/api/auth/session-test', {
          // Add cache control headers to avoid caching authentication status
          headers: {
            'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        if (!isMounted) return;
        
        if (response.ok) {
          const data = await response.json();
          // Use the hasSession property from the session-test endpoint
          setIsAuthenticated(data.hasSession);
          console.log("[HomePage] Auth status:", data.hasSession ? "Authenticated" : "Not authenticated");
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        if (isMounted) {
          setIsAuthenticated(false);
        }
      }
    }
    
    checkAuth();
    
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // Only fetch stats if authenticated
    if (!isAuthenticated) {
      setLoadingStats(false);
      return;
    }
    
    let isMounted = true;
    
    // Use a timer to avoid immediate loading state
    const timer = setTimeout(() => {
      if (isMounted && isAuthenticated) {
        setLoadingStats(true);
      }
    }, 300);
    
    async function fetchStats() {
      try {
        console.log("[HomePage] Fetching stats for authenticated user");
        
        const response = await fetch('/api/stats', {
          headers: {
            'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        if (!isMounted) return;
        
        if (response.status === 401 || response.status === 403) {
          // If unauthorized or forbidden, user is not authenticated
          console.log("[HomePage] Stats API returned unauthorized (401/403). Updating auth state.");
          setIsAuthenticated(false);
          setLoadingStats(false);
          return;
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.status} ${response.statusText}`);
        }
        
        const data: AppStats = await response.json();
        console.log("[HomePage] Stats loaded successfully:", data);
        if (isMounted) {
          setStats(data);
        }
      } catch (error) {
        console.error("[HomePage] Error fetching stats:", error);
      } finally {
        if (isMounted) {
          setLoadingStats(false);
        }
      }
    }
    
    fetchStats();
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isAuthenticated]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 py-16 px-4 sm:px-6 lg:py-24 lg:px-0 items-center">
        <div className="flex flex-col justify-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl mb-6">
            <span className="block text-gradient">Self-Help Group</span>
            <span className="block mt-2 text-foreground">Management</span>
          </h1>
          <p className="text-lg text-muted mb-10 max-w-xl">
            Efficiently manage your self-help groups and members with our simple, intuitive platform designed to make administration effortless.
          </p>
          <div className="flex flex-wrap gap-4">
            {isAuthenticated ? (
              <>
                <Link
                  href="/groups/create"
                  className="btn-primary inline-flex items-center text-base px-6 py-3 shadow-lg hover:shadow-xl transition-shadow"
                >
                  Create a Group
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </Link>
                <Link
                  href="/members/create"
                  className="btn-secondary inline-flex items-center text-base px-6 py-3 shadow-lg hover:shadow-xl transition-shadow"
                >
                  Add a Member
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="btn-primary inline-flex items-center text-base px-6 py-3 shadow-lg hover:shadow-xl transition-shadow"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="btn-secondary inline-flex items-center text-base px-6 py-3 shadow-lg hover:shadow-xl transition-shadow"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center p-8">
          <div className="relative w-full max-w-lg aspect-square group">
            <div className="absolute -inset-2 bg-gradient-to-br from-primary via-secondary to-primary-light rounded-full opacity-60 blur-2xl group-hover:opacity-80 transition-opacity duration-500" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-secondary/80 to-primary-light/80 rounded-full shadow-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 text-white opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Leadership Invitations - Only show if authenticated */}
      {isAuthenticated && <PendingLeadershipInvitations />}

      {/* Stats Section - Only show if authenticated */}
      {isAuthenticated && (
        loadingStats ? (
          <div className="text-center py-10">
            <p className="text-muted">Loading application stats...</p>
          </div>
        ) : stats && (
          <div className="py-12 bg-card-bg rounded-lg shadow-md my-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl font-bold text-center text-foreground mb-8">
                Application Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
                <div className="p-6 border border-border rounded-lg bg-background">
                  <p className="text-5xl font-extrabold text-primary">{stats.totalGroups}</p>
                  <p className="text-lg font-medium text-muted mt-2">Total Groups</p>
                </div>
                <div className="p-6 border border-border rounded-lg bg-background">
                  <p className="text-5xl font-extrabold text-primary">{stats.totalMembers}</p>
                  <p className="text-lg font-medium text-muted mt-2">Total Members</p>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Features Section */}
      <div className="py-16 px-4 sm:px-6 lg:py-24 lg:px-0">
        <div className="text-center mb-16">
          <h2 className="text-base font-semibold text-primary uppercase tracking-wider">Features</h2>
          <p className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Streamlined SHG Management
          </p>
          <p className="mt-6 max-w-2xl mx-auto text-xl text-muted">
            Our platform provides all the essential tools to manage your self-help groups with unparalleled efficiency and ease.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card p-8 transform hover:scale-105 transition-transform duration-300">
            <div className="bg-primary/10 p-4 inline-flex rounded-full mb-6 ring-4 ring-primary/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">Intuitive Group Management</h3>
            <p className="text-muted text-base">
              Create, organize, and oversee multiple self-help groups effortlessly. Centralize member data and track group activities seamlessly.
            </p>
          </div>

          <div className="card p-8 transform hover:scale-105 transition-transform duration-300">
            <div className="bg-primary/10 p-4 inline-flex rounded-full mb-6 ring-4 ring-primary/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">Comprehensive Member Tracking</h3>
            <p className="text-muted text-base">
              Maintain detailed records of all members and their group affiliations. Add, update, and manage member information with ease.
            </p>
          </div>

          <div className="card p-8 transform hover:scale-105 transition-transform duration-300">
            <div className="bg-primary/10 p-4 inline-flex rounded-full mb-6 ring-4 ring-primary/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">User-Friendly Interface</h3>
            <p className="text-muted text-base">
              Experience a clean, intuitive interface designed for maximum usability. No steep learning curves or complex procedures.
            </p>
          </div>
        </div>
      </div>

      {/* Call-to-action Section */}
      <div className="relative bg-gradient-to-r from-primary/80 to-secondary/80 rounded-2xl p-12 my-16 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-black/20 mix-blend-multiply" /> 
        <div className="relative z-10 text-center">
          <h2 className="text-3xl font-bold text-white mb-5 sm:text-4xl">Ready to Elevate Your Group Management?</h2>
          <p className="text-primary-light mb-8 text-lg max-w-2xl mx-auto">
            {isAuthenticated 
              ? "Start managing your SHGs more effectively. Our platform is designed to simplify your administrative tasks."
              : "Join today and start managing your SHGs more effectively. Create an account to get started."}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {isAuthenticated ? (
              <>
                <Link href="/groups" className="btn-primary bg-white text-primary hover:bg-gray-100 px-8 py-3 text-base shadow-lg hover:shadow-xl transition-all">
                  Explore Groups
                </Link>
                <Link href="/members" className="btn-secondary border-white text-white hover:bg-white hover:text-primary px-8 py-3 text-base shadow-lg hover:shadow-xl transition-all">
                  Manage Members
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-primary bg-white text-primary hover:bg-gray-100 px-8 py-3 text-base shadow-lg hover:shadow-xl transition-all">
                  Login
                </Link>
                <Link href="/register" className="btn-secondary border-white text-white hover:bg-white hover:text-primary px-8 py-3 text-base shadow-lg hover:shadow-xl transition-all">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
