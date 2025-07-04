'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Define Member type based on API response
interface Member {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function LinkMemberPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }

    if (status === 'authenticated') {
      // If user is already linked to a member, redirect to profile page
      if (session?.user?.memberId) {
        router.replace('/profile');
      } else {
        fetchMembers();
      }
    }
  }, [session, status, router]);

  useEffect(() => {
    // Filter members based on search term
    if (searchTerm.trim() === '') {
      setFilteredMembers(members);
    } else {
      const filtered = members.filter(
        member => 
          member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (member.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (member.phone?.includes(searchTerm))
      );
      setFilteredMembers(filtered);
    }
  }, [searchTerm, members]);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/members');
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }
      const data = await response.json();
      setMembers(data);
      setFilteredMembers(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching members:', error);
      setError('Failed to load members');
      setIsLoading(false);
    }
  };

  const handleLinkMember = async (memberId: string) => {
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch('/api/auth/link-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to link member');
      }

      setSuccess('Member linked successfully! Redirecting...');
      
      // Wait a moment, then refresh the session and redirect
      setTimeout(() => {
        router.refresh(); // Refresh the session
        router.push('/profile'); // Redirect to profile page
      }, 1500);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Link Your Account to a Member</h1>
      
      <p className="mb-4">
        Linking your account to a member will allow you to access and manage groups associated with that member.
      </p>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search members by name, email, or phone"
          className="w-full border rounded-md px-3 py-2"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{member.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {member.email && <div>{member.email}</div>}
                      {member.phone && <div>{member.phone}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleLinkMember(member.id)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Link
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                  No members found matching your search
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
