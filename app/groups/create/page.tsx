'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic'; // Import dynamic

// Dynamically import MultiStepGroupForm with SSR disabled
const MultiStepGroupForm = dynamic(
  () => import('@/app/components/MultiStepGroupForm'),
  { 
    ssr: false, 
    loading: () => (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }
);

export default function CreateGroupPage() {
  const router = useRouter();
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true); // Renamed for clarity
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = async () => {
    setIsLoadingMembers(true); // Start loading
    setError(null);
    try {
      const response = await fetch('/api/members');
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }
      const data = await response.json();
      setMembers(data.map((member: { id: string; name: string }) => ({ id: member.id, name: member.name })));
    } catch (error) {
      console.error('Error fetching members:', error);
      setError('Failed to load members. Please try again later.');
    } finally {
      setIsLoadingMembers(false); // Finish loading
    }
  };

  // A lighter version of fetchMembers specifically for when members are created during import
  // This version doesn't cause navigation disruption
  const refreshMembersForImport = async () => {
    console.log('refreshMembersForImport called');
    try {
      const response = await fetch('/api/members');
      if (!response.ok) {
        console.error('Failed to refresh members list');
        return;
      }
      const data = await response.json();
      console.log('Refreshed members data:', data.length);
      setMembers(data.map((member: { id: string; name: string }) => ({ id: member.id, name: member.name })));
      console.log('Members state updated');
    } catch (error) {
      console.error('Error refreshing members:', error);
      // Don't set error state here to avoid disrupting the import flow
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCreateGroup = async (data: any, _groupId?: string) => {
    try {
      // Prepare data for submission (dateOfStarting is already a string from the form)
      const submissionData = {
        ...data,
        dateOfStarting: data.dateOfStarting
      };

      // Process member data to ensure all fields have proper types
      if (Array.isArray(submissionData.members)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        submissionData.members = submissionData.members.map((member: any) => ({
          memberId: String(member.memberId || ''),
          currentShareAmount: Number(member.currentShareAmount || member.initialShareAmount || member.currentShare) || 0,
          currentLoanAmount: Number(member.currentLoanAmount || member.initialLoanAmount) || 0, 
          initialInterest: Number(member.initialInterest) || 0
        }));
      }

      // API request
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData)
      });

      // Get response data
      const contentType = response.headers.get('content-type');
      let responseData = {};
      
      // Handle different response types
      if (contentType?.includes('application/json')) {
        try {
          responseData = await response.json();
        } catch (e) {
          console.error('Failed to parse JSON response:', e);
        }
      } else {
        try {
          const text = await response.text();
          responseData = { message: text };
        } catch (e) {
          console.error('Failed to read response text:', e);
        }
      }

      // Handle error responses
      if (!response.ok) {
        let errorMessageToThrow: string;
        const errorDetailFromResponse = (typeof responseData === 'object' && responseData !== null)
          ? (responseData as { error?: string; message?: string }).error || (responseData as { error?: string; message?: string }).message
          : null;

        if (errorDetailFromResponse) {
          errorMessageToThrow = String(errorDetailFromResponse);
        } else {
          errorMessageToThrow = `Request to create group failed with status ${response.status}`;
          if (response.statusText) {
            errorMessageToThrow += `: ${response.statusText.trim()}`;
          }
        }
        throw new Error(errorMessageToThrow);
      }

      // Format the successful response for MultiStepGroupForm
      // We need to ensure it has a groupId property
      const successData = {
        ...responseData,
        // If API returns id but not groupId, add groupId property
        groupId: (responseData as { groupId?: string; id?: string }).groupId || (responseData as { groupId?: string; id?: string }).id || 'unknown'
      };
      
      return successData;
    } catch (error) {
      // Format error for MultiStepGroupForm
      console.error('Error creating group:', error);
      const typedError = error as Error;
      throw new Error(typedError instanceof Error ? typedError.message : 'Failed to create group');
    }
  };

  // Show loading indicator while fetching members
  if (isLoadingMembers) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Group</h1>
      {error ? (
        <div className="bg-red-50 p-4 rounded-md">
          <p className="text-red-500">{error}</p>
          <button
            onClick={() => router.push('/groups')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Groups
          </button>
        </div>
      ) : (
        // Render the dynamically imported component
        <MultiStepGroupForm members={members} onSubmit={handleCreateGroup} onMemberCreated={refreshMembersForImport} />
      )}
    </div>
  );
}