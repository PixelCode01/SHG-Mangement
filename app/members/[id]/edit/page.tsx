'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MemberForm from '@/app/components/MemberForm';
import { Member } from '@prisma/client'; // Import Member type

interface EditMemberPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Type for the data needed by the form
type MemberFormData = {
  name: string;
  email?: string | undefined;
  phone?: string | undefined;
  address?: string | undefined;
  loanAmount: number;
  groupId?: string | undefined;
};

export default function EditMemberPage({ params }: EditMemberPageProps) {
  const router = useRouter();
  const [id, setId] = useState<string>('');
  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ id }) => {
      setId(id);
    });
  }, [params]);

  useEffect(() => {
    if (!id) return;
    
    const fetchMember = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/members/${id}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Member not found.');
            return;
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch member data');
        }

        const memberData: Member = await response.json();
        setMember(memberData);
      } catch (err) {
        console.error('Error fetching member:', err);
        setError((err as Error).message || 'Failed to load member data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMember();
  }, [id]);

  const handleUpdateMember = async (data: MemberFormData) => {
    const response = await fetch(`/api/members/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update member');
    }

    router.push(`/members/${id}`);
    router.refresh();

    return response.json();
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center">
          <p className="text-gray-500">Loading member data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 p-4 rounded-md border border-red-200">
          <p className="text-red-600 font-medium">Error</p>
          <p className="text-red-500 mt-1">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <p className="text-center text-gray-500">Member data could not be loaded.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Member: {member.name}</h1>
      <MemberForm
        initialData={{
          name: member.name,
          email: member.email || '',
          phone: member.phone || '',
          address: member.address || '',
          loanAmount: 0, // Default loan amount for edit mode
        }}
        onSubmit={handleUpdateMember}
        isEditMode={true}
      />
    </div>
  );
}