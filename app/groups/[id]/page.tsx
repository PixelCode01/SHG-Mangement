'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation'; // Import useRouter
import { useSession } from 'next-auth/react';

// Define the expected shape of a single group from the API
interface MemberDetail {
  id: string;
  memberId: string;
  name: string;
  joinedAt: string;
  currentShareAmount: number | null;
  currentLoanAmount: number | null;
  currentLoanBalance: number | null; // Keep for backward compatibility
  initialInterest: number | null;
}

interface GroupDetailData {
  id: string;
  groupId: string;
  name: string;
  address: string | null;
  registrationNumber: string | null;
  organization: string | null;
  leader: {
    id: string;
    name: string;
    email: string;
  };
  memberCount: number | null;
  dateOfStarting: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  members: MemberDetail[];
  userPermissions: {
    canEdit: boolean;
    canViewMemberIds: boolean;
  }
}

export default function GroupPage() {
  const params = useParams();
  const router = useRouter(); // Initialize router
  const { data: session } = useSession();
  const id = params?.id as string; // Get ID from URL

  const [group, setGroup] = useState<GroupDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false); // State for delete operation
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null); // State for deleting a specific member
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null); // State to track copied member ID
  const [isChangingLeader, setIsChangingLeader] = useState(false); // State for the leader change action

  useEffect(() => {
    if (!id) return; // Don't fetch if ID is not available yet

    const fetchGroup = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/groups/${id}`);
        if (response.status === 404) {
          notFound(); // Trigger Next.js not found page
          return;
        }
        if (!response.ok) {
          throw new Error('Failed to fetch group details');
        }
        
        // Get the raw data first
        const rawData = await response.json();
        
        // Add validation and default values for potentially missing fields
        const data: GroupDetailData = {
          // Basic fields with defaults
          id: rawData.id || id,
          groupId: rawData.groupId || `GROUP-${id.slice(0, 8)}`,
          name: rawData.name || 'Unnamed Group',
          address: rawData.address || null,
          registrationNumber: rawData.registrationNumber || null,
          organization: rawData.organization || null,
          memberCount: rawData.memberCount || (rawData.members?.length || 0),
          dateOfStarting: rawData.dateOfStarting || null,
          description: rawData.description || null,
          createdAt: rawData.createdAt || new Date().toISOString(),
          updatedAt: rawData.updatedAt || new Date().toISOString(),
          
          // Make sure leader is properly formatted
          leader: rawData.leader || { id: '', name: 'N/A', email: '' },
          
          // Ensure members array exists with all required properties
          members: Array.isArray(rawData.members)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? rawData.members.map((m: any) => ({
                id: m.id || '',
                memberId: m.memberId || m.id || '',
                name: m.name || 'Unknown Member',
                joinedAt: m.joinedAt || rawData.createdAt || new Date().toISOString(),
                currentShareAmount: typeof m.currentShareAmount === 'number' ? m.currentShareAmount : 0,
                currentLoanAmount: typeof m.currentLoanAmount === 'number' ? m.currentLoanAmount : 0,
                currentLoanBalance: typeof m.currentLoanBalance === 'number' ? m.currentLoanBalance : 0,
                initialInterest: typeof m.initialInterest === 'number' ? m.initialInterest : 0
              }))
            : [],
          
          // Set default permissions if missing
          userPermissions: rawData.userPermissions || { 
            canEdit: false, 
            canViewMemberIds: false 
          }
        };
        
        setGroup(data);
      } catch (err: unknown) {
        console.error(`Error fetching group ${id}:`, err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Could not load group details due to an unknown error.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroup();
  }, [id]); // Re-run effect if ID changes

  // Function to handle group deletion
  const handleDeleteGroup = async () => {
    if (!group) return;

    const confirmed = window.confirm(`Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`);

    if (confirmed) {
      setIsDeleting(true);
      setError(null);
      try {
        const response = await fetch(`/api/groups/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ 
            error: `Failed to delete group (${response.status})`,
            details: response.statusText 
          }));
          throw new Error(errorData.error || errorData.details || 'Failed to delete group.');
        }

        // Deletion successful, redirect to groups list
        alert('Group deleted successfully.');
        router.push('/groups'); // Redirect to the main groups page

      } catch (err: unknown) {
        console.error(`Error deleting group ${id}:`, err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Could not delete the group due to an unknown error.');
        }
        setIsDeleting(false); // Re-enable button on error
      }
      // No need to set isDeleting to false on success because we redirect
    }
  };

  // Function to handle removing a member from the group
  const handleRemoveMember = async (memberIdToRemove: string, memberName: string) => {
    if (!group) return;

    const confirmed = window.confirm(`Are you sure you want to remove ${memberName} from the group "${group.name}"?`);

    if (confirmed) {
      setDeletingMemberId(memberIdToRemove); // Indicate which member is being deleted
      setError(null); // Clear previous errors
      try {
        const response = await fetch(`/api/groups/${id}/members/${memberIdToRemove}`, {
          method: 'DELETE',
        });

        if (response.status === 204) {
          // Successfully removed
          alert(`${memberName} removed successfully.`);
          // Update local state to reflect removal
          setGroup((prevGroup) => {
            if (!prevGroup) return null;
            return {
              ...prevGroup,
              members: prevGroup.members.filter(m => m.id !== memberIdToRemove),
            };
          });
        } else {
          const errorData = await response.json().catch(() => ({ message: 'Failed to remove member.' }));
          throw new Error(errorData.message || `Failed to remove member (status: ${response.status})`);
        }
      } catch (err: unknown) {
        console.error(`Error removing member ${memberIdToRemove} from group ${id}:`, err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Could not remove the member due to an unknown error.');
        }
      } finally {
        setDeletingMemberId(null); // Reset deleting state regardless of outcome
      }
    }
  };

  // Function to copy member ID to clipboard
  const copyMemberIdToClipboard = (memberId: string) => {
    navigator.clipboard.writeText(memberId).then(
      () => {
        // Set the ID as copied (to show feedback)
        setCopiedMemberId(memberId);
        // Reset after 2 seconds
        setTimeout(() => setCopiedMemberId(null), 2000);
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex justify-center items-center mb-4">
          <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p className="text-muted text-xl">Loading group details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 dark:bg-red-900/20 p-8 rounded-lg border border-red-200 dark:border-red-700/50 text-center shadow-xl">
          <div className="flex justify-center items-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-red-700 dark:text-red-300 font-semibold text-2xl">Oops! Something went wrong.</p>
          <p className="text-red-600 dark:text-red-400 mt-2 text-base">{error}</p>
          <button
            onClick={() => window.location.reload()} 
            className="btn-secondary mt-6 text-sm bg-red-100 dark:bg-red-700/50 dark:hover:bg-red-600/50 dark:text-red-300 dark:border-red-500/50"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  if (!group) {
    return null; 
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-6 border-b border-border">
        <div>
          <h1 className="text-4xl font-bold text-foreground">{group.name}</h1>
          <p className="mt-1 text-sm text-muted">Group ID: {group.groupId}</p>
          <p className="mt-1 text-xs text-muted">
            Created on {new Date(group.createdAt).toLocaleDateString()} | Last updated on {new Date(group.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href={`/groups/${id}/periodic-records/create`}
            className="btn-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Record
          </Link>
          <Link
            href={`/groups/${id}/summary`}
            className="btn-primary bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700 dark:bg-green-500 dark:hover:bg-green-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Summary
          </Link>
          <Link
            href={`/groups/${id}/contributions`}
            className="btn-primary bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Track Contributions
          </Link>
          <Link
            href={`/groups/${id}/periodic-records`}
            className="btn-secondary" 
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Records
          </Link>
          <Link
            href={`/groups/${id}/edit`}
            className="btn-secondary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Group
          </Link>
          {/* Show delete button to administrators and group leaders */}
          {(session?.user?.role === 'ADMIN' || 
            (session?.user?.role === 'GROUP_LEADER' && session?.user?.memberId === group.leader?.id)) && (
            <button
              onClick={handleDeleteGroup}
              disabled={isDeleting}
              className={`btn-secondary bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700 dark:bg-red-500 dark:hover:bg-red-600 dark:border-red-500 dark:hover:border-red-600 ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isDeleting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Deleting...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Group
                </>
              )}
            </button>
          )}
          <Link
            href="/groups"
            className="btn-secondary bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 dark:border-gray-600"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Groups
          </Link>
        </div>
      </div>

      {/* Group Details Card */}
      <div className="card mb-8">
        <div className="px-6 py-5 border-b border-border">
          <h3 className="text-xl leading-6 font-semibold text-foreground">Group Details</h3>
        </div>
        <div className="px-6 py-5">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {[{
              label: 'Name',
              value: group.name
            }, {
              label: 'Description',
              value: group.description || <span className="text-muted italic">Not provided</span>
            }, {
              label: 'Leader',
              value: (
                <div className="flex items-center">
                  {group.leader ? (
                    <>
                      <Link href={`/members/${group.leader.id}`} className="text-primary hover:underline">
                        {group.leader.name} <span className="text-muted">({group.leader.email})</span>
                      </Link>
                      {group.userPermissions.canEdit && (
                        <button 
                          onClick={() => {
                            setIsChangingLeader(true);
                            router.push(`/groups/${id}/edit?section=leader`);
                          }}
                          disabled={isChangingLeader}
                          className={`ml-2 text-xs bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-700/60 px-2 py-1 rounded flex items-center ${isChangingLeader ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isChangingLeader ? (
                            <>
                              <svg className="animate-spin -ml-0.5 mr-1 h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Changing...
                            </>
                          ) : (
                            <>Change</>
                          )}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-muted italic">N/A</span>
                      {group.userPermissions.canEdit && (
                        <button 
                          onClick={() => {
                            setIsChangingLeader(true);
                            router.push(`/groups/${id}/edit?section=leader`);
                          }}
                          disabled={isChangingLeader}
                          className={`ml-2 text-xs bg-green-100 dark:bg-green-800/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-700/60 px-2 py-1 rounded flex items-center ${isChangingLeader ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isChangingLeader ? (
                            <>
                              <svg className="animate-spin -ml-0.5 mr-1 h-3 w-3 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Assigning...
                            </>
                          ) : (
                            <>Assign Leader</>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            }, {
              label: 'Address',
              value: group.address || <span className="text-muted italic">Not provided</span>
            }, {
              label: 'Registration No.',
              value: group.registrationNumber || <span className="text-muted italic">Not provided</span>
            }, {
              label: 'Organization',
              value: group.organization || <span className="text-muted italic">Not provided</span>
            }, {
              label: 'Date Started',
              value: group.dateOfStarting ? new Date(group.dateOfStarting).toLocaleDateString() : <span className="text-muted italic">Not set</span>
            }, {
              label: 'Total Members',
              value: group.members.length
            }].map(item => (
              <div key={item.label} className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted uppercase tracking-wider">{item.label}</dt>
                <dd className="mt-1 text-base text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Group Operations/Financials Card - Currently Hidden 
      <div className="card mb-8">
        <div className="px-6 py-5 border-b border-border">
          <h3 className="text-xl leading-6 font-semibold text-foreground">Group Operations</h3>
        </div>
        <div className="divide-y divide-border">
          <Link href={`/groups/${id}/bank-transactions`} className="block hover:bg-hover transition-colors">
            <div className="px-6 py-5">
              <div className="flex items-center justify-between">
                <p className="text-base font-medium text-primary hover:text-primary-dark">Bank Transactions</p>
                <svg className="h-5 w-5 text-muted group-hover:text-foreground transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="mt-1 text-sm text-muted">Track bank deposits, withdrawals, and balances.</p>
            </div>
          </Link>
        </div>
      </div>
      */}

      {/* Members List Card */}
      <div className="card">
        <div className="px-6 py-5 border-b border-border flex justify-between items-center">
          <h2 className="text-xl font-semibold text-foreground">Members ({group.members.length})</h2>
          <Link href={`/groups/${id}/add-member`} className="btn-secondary text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Member
          </Link>
        </div>
        
        {/* Leader note about member IDs - only shown to users who can view member IDs */}
        {group.userPermissions?.canViewMemberIds && (
          <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-border">
            <div className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <span className="font-medium">Group Leader Note:</span> Share the Member IDs with new members so they can link their accounts during registration. Members should select the &quot;Member&quot; role and enter this ID when registering.
              </p>
            </div>
          </div>
        )}

        {group.members.length === 0 ? (
          <div className="p-10 text-center">
            <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto mb-5 ring-4 ring-primary/20">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-muted text-lg">No members currently in this group.</p>
            <p className="text-muted text-sm mt-1">You can add members once the group is created.</p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-border">
            {group.members.map((member) => (
              <li key={member.id} className="px-6 py-5 hover:bg-hover transition-colors">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="truncate">
                    <Link
                      href={`/members/${member.id}`}
                      className="text-base font-semibold text-primary hover:underline truncate"
                    >
                      {member.name}
                    </Link>
                    
                    {/* Only show Member ID with copy functionality if user has permission */}
                    {group.userPermissions?.canViewMemberIds ? (
                      <div className="flex items-center mt-1">
                        <p className="text-xs text-muted uppercase tracking-wider">Member ID: </p>
                        <code className="ml-1 px-2 py-1 bg-background rounded text-xs font-mono">{member.id}</code>
                        <button
                          onClick={() => copyMemberIdToClipboard(member.id)}
                          className="ml-2 text-primary hover:text-primary-dark p-1 rounded-full"
                          title="Copy Member ID"
                        >
                          {copiedMemberId === member.id ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          )}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted uppercase tracking-wider mt-1">Member</p>
                    )}
                    <p className="text-sm text-muted mt-0.5">Joined: {new Date(member.joinedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="ml-4 flex-shrink-0 text-right space-y-1">
                     <p className="text-xs text-muted">Current Share: <span className="font-medium text-foreground">₹{member.currentShareAmount?.toFixed(2) ?? 'N/A'}</span></p>
                     <p className="text-xs text-muted">Current Loan: <span className="font-medium text-foreground">₹{member.currentLoanAmount?.toFixed(2) ?? 'N/A'}</span></p>
                     <p className="text-xs text-muted">Interest: <span className="font-medium text-foreground">₹{member.initialInterest?.toFixed(2) ?? 'N/A'}</span></p>
                  </div>
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => copyMemberIdToClipboard(member.memberId)}
                      className="btn-secondary btn-sm text-xs flex items-center"
                    >
                      {copiedMemberId === member.memberId ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 10h10M7 14h10m-5 4h5" />
                          </svg>
                          Copy ID
                        </>
                      )}
                    </button>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(member.id, member.name)}
                    disabled={deletingMemberId === member.id}
                    className={`btn-secondary btn-sm text-xs bg-red-50 hover:bg-red-100 text-red-600 border-red-200 hover:border-red-300 dark:bg-red-700/20 dark:hover:bg-red-700/40 dark:text-red-400 dark:border-red-700/30 ${deletingMemberId === member.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {deletingMemberId === member.id ? (
                      <>
                        <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Removing...
                      </>
                    ) : 'Remove'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}