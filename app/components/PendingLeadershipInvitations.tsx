'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Group {
  id: string;
  groupId: string;
  name: string;
  dateOfStarting: string;
}

interface User {
  id: string;
  name: string | null;
  email: string | null;
}

interface PendingLeadership {
  id: string;
  groupId: string;
  memberId: string;
  initiatedByUserId: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  group: Group;
  initiatedByUser: User | null;
}

export default function PendingLeadershipInvitations() {
  const { data: session, status, update } = useSession();
  const [pendingInvitations, setPendingInvitations] = useState<PendingLeadership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Fetch pending invitations when session is available
  useEffect(() => {
    const fetchPendingInvitations = async () => {
      if (status === 'loading' || !session) return;
      
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/pending-leaderships');
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch pending leadership invitations');
        }
        
        const data = await response.json();
        setPendingInvitations(data);
      } catch (err) {
        console.error('Error fetching pending leadership invitations:', err);
        setError(err instanceof Error ? err.message : 'Something went wrong while fetching pending invitations');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPendingInvitations();
  }, [session, status]);

  const handleInvitationResponse = async (invitationId: string, status: 'ACCEPTED' | 'REJECTED') => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/pending-leaderships/${invitationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${status.toLowerCase()} invitation`);
      }

      // Remove the responded invitation from the list
      setPendingInvitations(current => 
        current.filter(invitation => invitation.id !== invitationId)
      );

      // If accepted, refresh to show new group access
      if (status === 'ACCEPTED') {
        // Force session update using NextAuth's update method
        try {
          await update();
          console.log('Session updated successfully after accepting leadership');
        } catch (sessionError) {
          console.warn('Failed to refresh session:', sessionError);
        }
        
        // Refresh the page to show updated groups and navigation
        router.refresh();
        
        // Small delay then redirect to groups page to show the new accessible groups
        setTimeout(() => {
          router.push('/groups');
        }, 1000);
      }
    } catch (err) {
      console.error(`Error ${status.toLowerCase()}ing invitation:`, err);
      setError(err instanceof Error ? err.message : `Something went wrong while ${status.toLowerCase()}ing the invitation`);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render anything if not logged in or no pending invitations
  if (status === 'unauthenticated' || (pendingInvitations.length === 0 && !isLoading && !error)) {
    return null;
  }

  return (
    <div className="my-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 shadow-sm">
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Pending Group Leadership Invitations</h2>
      
      {isLoading && <p className="text-gray-500 dark:text-gray-400">Loading invitations...</p>}
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-md mb-3">
          <p>{error}</p>
        </div>
      )}
      
      {pendingInvitations.length > 0 ? (
        <ul className="space-y-4">
          {pendingInvitations.map(invitation => (
            <li key={invitation.id} className="border-b border-gray-100 dark:border-gray-700 pb-3">
              <div className="mb-2 text-gray-800 dark:text-gray-200">
                <span className="font-medium">Group:</span> {invitation.group.name}
              </div>
              <div className="mb-2 text-gray-800 dark:text-gray-200">
                <span className="font-medium">Group ID:</span> {invitation.group.groupId}
              </div>
              <div className="mb-2 text-gray-800 dark:text-gray-200">
                <span className="font-medium">Invited by:</span> {invitation.initiatedByUser?.name || 'Unknown'} 
                {invitation.initiatedByUser?.email && ` (${invitation.initiatedByUser.email})`}
              </div>
              <div className="mb-2 text-gray-800 dark:text-gray-200">
                <span className="font-medium">Invited on:</span> {new Date(invitation.createdAt).toLocaleDateString()}
              </div>
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => handleInvitationResponse(invitation.id, 'ACCEPTED')}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm transition-colors"
                >
                  Accept & Become Leader
                </button>
                <button
                  onClick={() => handleInvitationResponse(invitation.id, 'REJECTED')}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm transition-colors"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : !isLoading && !error ? (
        <p className="text-gray-500 dark:text-gray-400">No pending leadership invitations.</p>
      ) : null}
    </div>
  );
}
