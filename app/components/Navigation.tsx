'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react'; // Added useCallback
import { useTheme } from 'next-themes';
import { SunIcon, MoonIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useSession, signOut } from 'next-auth/react';

// Define the extended Session User type
interface ExtendedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  memberId?: string | null;
}

// Define the expected shape of a single group from the API for navigation
interface NavGroup {
  id: string;
  // Add other properties if needed, but only id is used for navigation
}

// Define the shape of navigation items
interface NavItem {
  label: string;
  href: string;
  disabled?: boolean;
}

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null); // Added userMenuRef
  const [scrolled, setScrolled] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [firstGroupId, setFirstGroupId] = useState<string | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const { data: session, status } = useSession();

  // Ensure component is mounted before using theme to avoid hydration mismatch
  useEffect(() => setMounted(true), []);
  
  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside the userMenuRef
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []); // userMenuRef is stable, no need to add to dependencies

  // Helper function to reliably determine if a user is authenticated
  const isAuthenticated = useCallback(() => {
    // Simple check - only rely on status for stability
    return status === 'authenticated' && !!session?.user;
  }, [status, session?.user]); // Include session?.user dependency

  // Fetch groups to determine if "Manage Group" or "Create Group" should be shown
  useEffect(() => {
    // Only fetch if authenticated and we haven't fetched recently
    if (status !== 'authenticated' || !session?.user) {
      setFirstGroupId(null);
      setLoadingGroups(false);
      return;
    }

    const fetchGroups = async () => {
      setLoadingGroups(true);
      try {
        console.log('[Navigation] Fetching groups from API');
        const response = await fetch('/api/groups');
        
        if (response.ok) {
          const groups: NavGroup[] = await response.json();
          console.log(`[Navigation] Received ${groups.length} groups from API`);
          setFirstGroupId(groups.length > 0 && groups[0] ? groups[0].id : null);
        } else {
          const errorText = await response.text();
          console.error('Failed to fetch groups for navigation', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          setFirstGroupId(null);
        }
      } catch (error) {
        console.error('Error fetching groups for navigation:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        setFirstGroupId(null);
      } finally {
        setLoadingGroups(false);
      }
    };

    // Use sessionStorage to prevent unnecessary API calls
    const lastFetchTime = sessionStorage.getItem('nav-groups-last-fetch');
    const shouldRefetch = !lastFetchTime || 
      (pathname?.includes('/groups') && (pathname.includes('/create') || pathname.includes('/edit')));
      
    if (shouldRefetch) {
      console.log('[Navigation] Fetching groups data');
      fetchGroups();
      sessionStorage.setItem('nav-groups-last-fetch', Date.now().toString());
    } else {
      // Only log this occasionally to reduce console spam
      const lastLogTime = sessionStorage.getItem('nav-cache-log-time');
      const now = Date.now();
      if (!lastLogTime || now - parseInt(lastLogTime) > 5000) { // Log every 5 seconds max
        console.log('[Navigation] Using cached group data');
        sessionStorage.setItem('nav-cache-log-time', now.toString());
      }
    }
  }, [status, pathname, session?.user]); // Include session?.user dependency

  // Handle scroll event to add shadow and background opacity when scrolling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    // Add event listener
    window.addEventListener('scroll', handleScroll);

    // Call handler right away to check initial scroll position
    handleScroll();

    // Clean up event listener
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Add a useEffect to handle authentication state changes with minimal re-renders
  // Use useRef to track previous values to avoid unnecessary logs
  const prevStatus = useRef(status);
  const prevUserId = useRef(session?.user?.id);
  
  useEffect(() => {
    // Only log if the status or user has actually changed
    if (prevStatus.current !== status || prevUserId.current !== session?.user?.id) {
      console.log('[Navigation] Authentication status changed:', status);
      
      if (status === 'authenticated' && session?.user) {
        console.log('[Navigation] User authenticated:', session.user.name);
        localStorage.setItem('auth-status', 'authenticated');
        localStorage.setItem('auth-timestamp', new Date().toISOString());
        setUserMenuOpen(false);
      } else if (status === 'unauthenticated') {
        console.log('[Navigation] User is not authenticated');
        localStorage.removeItem('auth-status');
        localStorage.removeItem('auth-timestamp');
        setFirstGroupId(null);
        setUserMenuOpen(false);
      } else if (status === 'loading') {
        console.log('[Navigation] Session is loading...');
      }
      
      // Update previous values
      prevStatus.current = status;
      prevUserId.current = session?.user?.id;
    }
  }, [status, session?.user]); // Include session?.user dependency

  // Navigation items - only show Groups and Members to logged-in users
  const navItems: NavItem[] = [
    { label: 'Home', href: '/' },
    ...(isAuthenticated() ? [
      { label: 'Groups', href: '/groups' },
      { label: 'Members', href: '/members' },
    ] : [])
  ];

  // Cache the most recent non-loading state to avoid UI flickering
  const [cachedFirstGroupId, setCachedFirstGroupId] = useState<string | null>(null);
  
  // Update cached ID whenever firstGroupId changes and isn't loading
  useEffect(() => {
    if (!loadingGroups && firstGroupId !== undefined) {
      setCachedFirstGroupId(firstGroupId);
    }
  }, [firstGroupId, loadingGroups]);
  
  const getActionItems = (): NavItem[] => {
    const items: NavItem[] = [];
    
    // Only show action items if user is authenticated
    if (isAuthenticated()) {
      // Use cached ID if we're loading to avoid flickering the button
      if (loadingGroups && cachedFirstGroupId) {
        // Keep the previous button while loading in background
        items.push({ label: 'Manage Group', href: `/groups/${cachedFirstGroupId}` });
      } else if (loadingGroups) {
        // Show "Create Group" instead of "Loading..."
        items.push({ label: 'Create Group', href: '/groups/create' });
      } else if (firstGroupId) {
        items.push({ label: 'Manage Group', href: `/groups/${firstGroupId}` });
      } else {
        items.push({ label: 'Create Group', href: '/groups/create' });
      }
      items.push({ label: 'Add Member', href: '/members/create' });
    }
    
    return items;
  };

  const actionItems = getActionItems();

  const handleLogout = async () => {
    console.log('[Navigation] Logging out user');
    
    try {
      // Clear authentication status from localStorage before sign out
      localStorage.removeItem('auth-status');
      localStorage.removeItem('auth-timestamp');
      
      // First attempt to clear the session via API call
      // This helps ensure server-side session is cleared too
      const clearResponse = await fetch('/api/auth/session', { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('[Navigation] Session clear response:', clearResponse.status);
      
      // Then use signOut to clear client-side session
      await signOut({ redirect: false });
      
      // Reset local state
      setFirstGroupId(null);
      setUserMenuOpen(false);
      
      console.log('[Navigation] Session cleared, redirecting to login page');
      
      // For Next.js 13+, using router.push() followed by window.location
      // is the most reliable way to ensure a complete navigation with session refresh
      router.push('/login');
      
      // Use window.location after a small delay to ensure complete session refresh
      setTimeout(() => {
        console.log('[Navigation] Performing hard redirect to login page');
        window.location.href = '/login';
      }, 100);
    } catch (error) {
      console.error('[Navigation] Error during logout:', error);
      
      // Fallback to direct navigation
      window.location.href = '/login';
    }
  };

  return (
    <nav className={`bg-card-bg/80 border-b border-border sticky top-0 z-50 backdrop-blur-md transition-all duration-200 ${scrolled ? 'shadow-lg' : 'shadow-sm'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link 
              href="/" 
              className="font-bold text-xl text-primary transition-colors hover:text-primary-dark"
            >
              SHG Management
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="hidden md:flex md:space-x-1">
              {/* Only show nav items if logged in */}
              {status === 'authenticated' && session && navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${
                    pathname === item.href
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted hover:text-foreground hover:bg-hover'
                  } transition-all px-3 py-2 rounded-md text-sm`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="hidden md:flex md:space-x-3 items-center">
              {/* Only show action items if logged in */}
              {status === 'authenticated' && session && actionItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium ${
                    item.label === 'Create Group' || item.label === 'Manage Group'
                      ? 'btn-primary px-4 py-2'
                      : 'btn-secondary px-4 py-2'
                  } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-disabled={item.disabled || false}
                  onClick={(e) => item.disabled && e.preventDefault()}
                >
                  {item.label}
                </Link>
              ))}
              {/* Authentication UI */}
              {isAuthenticated() ? (
                <div className="relative" ref={userMenuRef}> {/* Added ref here */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUserMenuOpen(!userMenuOpen);
                      console.log('[Navigation] User menu toggled:', !userMenuOpen);
                    }}
                    className="flex items-center space-x-1 rounded-full bg-secondary px-3 py-1.5 hover:bg-secondary/80 transition-colors"
                  >
                    <UserCircleIcon className="h-5 w-5" />
                    <span className="text-sm font-medium">{session?.user?.name || 'User'}</span>
                  </button>
                  
                  {/* User dropdown menu */}
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-card shadow-lg border border-border rounded-md z-50 dark:bg-gray-800">
                      <div className="py-1">
                        <div className="px-4 py-2 text-sm border-b border-border dark:border-gray-700">
                          <div className="font-medium">{session?.user?.name}</div>
                          <div className="text-muted text-xs truncate">{session?.user?.email}</div>
                        </div>
                        <Link
                          href="/profile"
                          className="block w-full text-left px-4 py-2 text-sm hover:bg-hover"
                        >
                          My Profile
                        </Link>
                        {(session?.user as ExtendedUser)?.role === 'ADMIN' && (
                          <Link
                            href="/admin"
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-hover"
                          >
                            Admin Panel
                          </Link>
                        )}
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-sm text-destructive hover:bg-hover"
                        >
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : status === 'loading' ? (
                <div className="flex items-center space-x-1 rounded-full bg-secondary px-3 py-1.5">
                  <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm font-medium btn-secondary px-4 py-2"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="text-sm font-medium btn-primary px-4 py-2 ml-2"
                  >
                    Register
                  </Link>
                </>
              )}
              
              {/* Theme Toggle Button - Desktop */}
              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2 rounded-md text-muted hover:text-foreground hover:bg-hover transition-colors ml-2"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? (
                    <SunIcon className="h-5 w-5" />
                  ) : (
                    <MoonIcon className="h-5 w-5" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Mobile menu button and theme toggle */}
          <div className="md:hidden flex items-center">
            {/* Theme Toggle Button - Mobile (before hamburger) */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-md text-muted hover:text-foreground hover:bg-hover transition-colors mr-2"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <SunIcon className="h-6 w-6" />
                ) : (
                  <MoonIcon className="h-6 w-6" />
                )}
              </button>
            )}
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-muted hover:text-foreground hover:bg-hover focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className={`${isMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              <svg
                className={`${isMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden bg-card-bg/95 backdrop-blur-md border-b border-border shadow-lg`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {/* Authentication status for mobile */}
          {isAuthenticated() ? (
            <div className="px-3 py-2 border-b border-border mb-2">
              <div className="flex items-center">
                <UserCircleIcon className="h-6 w-6 mr-2" />
                <div>
                  <div className="font-medium text-sm">{session?.user?.name}</div>
                  <div className="text-muted text-xs truncate">{session?.user?.email}</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="mt-2 w-full text-center px-3 py-2 text-sm text-destructive hover:bg-hover rounded-md"
              >
                Logout
              </button>
            </div>
          ) : status === 'loading' ? (
            <div className="flex justify-center py-4">
              <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : (
            <div className="flex flex-col space-y-2 px-3 py-2 border-b border-border mb-2">
              <Link 
                href="/login"
                className="text-center px-3 py-2 text-sm font-medium rounded-md btn-secondary"
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </Link>
              <Link 
                href="/register"
                className="text-center px-3 py-2 text-sm font-medium rounded-md btn-primary"
                onClick={() => setIsMenuOpen(false)}
              >
                Register
              </Link>
            </div>
          )}
          
          {/* Only show nav links when authenticated */}
          {status === 'authenticated' && session && navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${
                pathname === item.href
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted hover:text-foreground hover:bg-hover'
              } block px-3 py-2 rounded-md text-base transition-all`}
              onClick={() => setIsMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
        {/* Only show action items if authenticated */}
        {isAuthenticated() && actionItems.length > 0 && (
          <div className="pt-2 pb-3 px-2 sm:px-3 border-t border-border">
            {actionItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block w-full text-center px-3 py-2.5 rounded-md text-base font-medium mb-2 ${
                  item.label === 'Create Group' || item.label === 'Manage Group'
                    ? 'btn-primary'
                    : 'btn-secondary'
                } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={(e) => {
                  if (item.disabled) e.preventDefault();
                  setIsMenuOpen(false);
                }}
                aria-disabled={item.disabled || false}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}