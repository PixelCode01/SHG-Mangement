'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ContributionType } from '@prisma/client';
import { use } from 'react';

interface NextGenMember {
  id: string;
  nextGenName: string;
  contribution: number | null;
  contributionType: ContributionType | null;
  primaryMemberId: string;
  createdAt: string;
  updatedAt: string;
}

interface NextGenMemberListPageProps {
  params: Promise<{
    id: string; // This is the primaryMemberId
  }>;
}

export default function NextGenMemberListPage({ params }: NextGenMemberListPageProps) {
  const router = useRouter();
  const { id: primaryMemberId } = use(params);

  const [nextGenMembers, setNextGenMembers] = useState<NextGenMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [primaryMemberName, setPrimaryMemberName] = useState<string>('');

  const fetchNextGenMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/members/${primaryMemberId}/nextgen`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch NextGen members');
      }
      const data = await response.json();
      setNextGenMembers(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [primaryMemberId]);

  useEffect(() => {
    if (primaryMemberId) {
      const fetchPrimaryMemberName = async () => {
        try {
          const res = await fetch(`/api/members/${primaryMemberId}`);
          if (!res.ok) {
            throw new Error('Failed to fetch primary member details');
          }
          const member = await res.json();
          setPrimaryMemberName(member.name);
        } catch (err) {
          console.error(err);
          // Do not set main error state here, as fetching members is more critical
        }
      };

      fetchPrimaryMemberName();
      fetchNextGenMembers();
    }
  }, [primaryMemberId, fetchNextGenMembers]);

  const handleDelete = async (nextGenId: string) => {
    if (window.confirm('Are you sure you want to delete this NextGen member?')) {
      try {
        const response = await fetch(`/api/members/${primaryMemberId}/nextgen/${nextGenId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete NextGen member');
        }
        // Refresh the list after successful deletion
        alert('NextGen member deleted successfully.'); // Optional: show success message
        fetchNextGenMembers(); // Refetch the list
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
          alert(`Error: ${err.message}`); // Show error to user
        } else {
          setError('An error occurred while deleting.');
          alert('An unexpected error occurred while deleting.');
        }
      }
    }
  };

  if (isLoading) {
    return <div className="container mx-auto p-4 text-center">Loading NextGen members...</div>;
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
        <button
          onClick={() => router.push(`/members/${primaryMemberId}`)}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Back to Member Details
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          NextGen Members for {primaryMemberName || '...'}
        </h1>
        <Link href={`/members/${primaryMemberId}/nextgen/create`}>
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
            Add NextGen Member
          </button>
        </Link>
      </div>

      {nextGenMembers.length === 0 ? (
        <div className="text-center text-gray-600 py-8">
          <p className="text-xl mb-2">No NextGen members found.</p>
          <p>You can add one using the button above.</p>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contribution
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {nextGenMembers.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {member.nextGenName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {member.contribution !== null ? member.contribution.toFixed(2) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {member.contributionType || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link href={`/members/${primaryMemberId}/nextgen/${member.id}/edit`}>
                      <button className="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                    </Link>
                    <button 
                      onClick={() => handleDelete(member.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <button
          onClick={() => router.push(`/members/${primaryMemberId}`)}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Back to Member Details
        </button>
      </div>
    </div>
  );
}
