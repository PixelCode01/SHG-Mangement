'use client'; // Convert to client component for fetching data

import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import EditButton from '../components/EditButton'; // Assuming EditButton is client-compatible

interface GroupListData {
  id: string;
  groupId: string; // Custom group ID
  name: string;
  createdAt: string; // Dates will be strings from JSON
  leaderName: string;
  memberCount: number;
}

// Component that uses useSearchParams - needs to be wrapped in Suspense
function GroupsRefreshHandler({ onRefresh }: { onRefresh: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Check if we need to refresh (from redirect after group creation)
    const shouldRefresh = searchParams.get('refresh');
    if (shouldRefresh === 'true') {
      onRefresh();
      // Clear the refresh parameter from the URL to prevent infinite loops
      router.replace('/groups', { scroll: false });
    }
  }, [searchParams, onRefresh, router]);

  return null; // This component doesn't render anything
}

function GroupsContent() {
  const [groups, setGroups] = useState<GroupListData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/groups', {
        // Add cache busting to ensure fresh data
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('You need to be logged in to view groups. Please log in and try again.');
        }
        throw new Error(`Failed to fetch groups (${response.status})`);
      }
      const data: GroupListData[] = await response.json();
      setGroups(data);
    } catch (err) {
      console.error('Error fetching groups:', err);
      setError((err as Error).message || 'Could not load groups.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []); // Empty dependency array means this runs once on mount

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={null}>
        <GroupsRefreshHandler onRefresh={fetchGroups} />
      </Suspense>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Groups</h1>
          <p className="text-sm text-muted mt-1">
            Manage all self-help groups in your organization.
          </p>
        </div>
        <Link
          href="/groups/create"
          className="btn-primary inline-flex items-center shadow-md hover:shadow-lg transition-shadow"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create New Group
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="flex justify-center items-center mb-4">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-muted text-lg">Loading groups...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg border border-red-200 dark:border-red-700/50 text-center shadow-md">
          <div className="flex justify-center items-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-700 dark:text-red-300 font-semibold text-xl">Failed to Load Groups</p>
          <p className="text-red-600 dark:text-red-400 mt-1 text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn-secondary mt-4 text-sm"
          >
            Try Again
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto mb-6 ring-4 ring-primary/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-3">No Groups Yet</h2>
          <p className="text-muted mb-8 max-w-md mx-auto">It looks like there are no self-help groups created. Get started by creating your first one.</p>
          <Link href="/groups/create" className="btn-primary text-base px-6 py-3 shadow-lg hover:shadow-xl transition-shadow">
            Create Your First Group
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div key={group.id} className="card flex flex-col justify-between transform hover:scale-[1.02] transition-transform duration-300">
              <div className="px-5 py-6 sm:px-6 flex-grow">
                <div className="flex justify-between items-start mb-3">
                  <Link href={`/groups/${group.id}`} className="block group">
                    <h3 className="text-xl leading-7 font-semibold text-foreground group-hover:text-primary transition-colors" title={group.groupId}>{group.name}</h3>
                    <p className="mt-1 text-xs text-muted uppercase tracking-wider">ID: {group.groupId}</p>
                  </Link>
                  <EditButton groupId={group.id} />
                </div>
                <div className="mt-4 text-sm text-muted space-y-2">
                   <p><span className="font-medium text-foreground/80">Leader:</span> {group.leaderName || 'N/A'}</p>
                   <p><span className="font-medium text-foreground/80">Members:</span> {group.memberCount}</p>
                   <p><span className="font-medium text-foreground/80">Created:</span> {new Date(group.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="border-t border-border px-5 py-4 sm:px-6 bg-hover/50 dark:bg-card-bg/50 rounded-b-lg">
                <Link
                  href={`/groups/${group.id}`}
                  className="text-sm font-medium text-primary hover:text-primary-dark flex items-center justify-end transition-colors"
                >
                  View Details
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GroupsPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="flex justify-center items-center mb-4">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-muted text-lg">Loading groups...</p>
        </div>
      </div>
    }>
      <GroupsContent />
    </Suspense>
  );
}