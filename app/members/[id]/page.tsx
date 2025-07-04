"use client"; // Add this line to make it a Client Component

import Link from 'next/link';
import { prisma } from '@/app/lib/prisma';
import { notFound } from 'next/navigation';
import { Member, Group, MemberGroupMembership, NextGenMember } from '@prisma/client'; // Import types
import { useRouter } from 'next/navigation'; // Import for page refresh
import { useState, useEffect } from 'react'; // Import for managing local state if needed
import EditButton from '@/app/components/EditButton'; // Added import for EditButton
import { use } from 'react';

export const dynamic = 'force-dynamic';

interface MemberPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Define the expected type for the fetched member
type MemberWithRelations = Member & {
  memberships: (MemberGroupMembership & {
    group: Pick<Group, 'id' | 'name' | 'groupId'>;
  })[];
  ledGroups: Pick<Group, 'id' | 'name' | 'groupId'>[];
  nextGenMembers: NextGenMember[]; // Added NextGenMembers relation
};

// Helper function to fetch member data - can be kept outside or adapted
async function getMember(id: string): Promise<MemberWithRelations | null> {
  const memberId = parseInt(id, 10);
  if (isNaN(memberId)) {
    notFound();
  }

  const member = await prisma.member.findUnique({
    where: { id: String(memberId) },
    include: {
      memberships: {
        include: {
          group: {
            select: { id: true, name: true, groupId: true },
          },
        },
      },
      ledGroups: {
        select: { id: true, name: true, groupId: true },
      },
      nextGenMembers: true, // Include NextGen members
    },
  });

  if (!member) {
    return null;
  }
  return member;
}

// Client-side component to handle primary member deletion
function MemberActions({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteMember = async () => {
    setError(null);
    if (!confirm('Are you sure you want to delete this member? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete member');
      }
      // On successful deletion, redirect to the members list page
      router.push('/members');
      // Optionally, show a success message before redirecting
    } catch (err) {
      console.error('Deletion failed:', err);
      setError((err as Error).message || 'An unexpected error occurred.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {error && (
        <div className="my-4 p-4 bg-red-100 text-red-700 border border-red-400 rounded">
          <p>Error: {error}</p>
        </div>
      )}
      <button
        onClick={handleDeleteMember}
        disabled={isDeleting}
        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        {isDeleting ? 'Deleting...' : 'Delete Member'}
      </button>
    </>
  );
}

export default function MemberPage({ params }: MemberPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [member, setMember] = useState<MemberWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { id } = use(params);

  useEffect(() => {
    if (id) {
      getMember(id as string)
        .then(data => {
          if (!data) {
            notFound();
          } else {
            setMember(data);
          }
        })
        .catch(err => {
          console.error("Failed to fetch member:", err);
          setError("Failed to load member data.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [id]);

  if (isLoading) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  if (error && !member) { // If initial loading failed and no member data
    return <div className="container mx-auto p-4 text-red-500">Error: {error}</div>;
  }

  if (!member) {
    return notFound(); 
  }

  return (
    <div className="container mx-auto p-4">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          {member.name}
        </h1>
        <p className="text-xl text-gray-600 mb-4">Member ID: {member.id}</p>
        <div className="flex space-x-4">
          <EditButton href={`/members/${member.id}/edit`} />
          <MemberActions memberId={id as string} />
        </div>
      </header>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Personal Information</h2>
          <dl className="space-y-2">
            <div>
              <dt className="font-medium text-gray-500">Phone Number:</dt>
              <dd className="text-gray-900">{member.phone || 'N/A'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Registration Date:</dt>
              <dd className="text-gray-900">{new Date(member.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Active Status:</dt>
              <dd className="text-gray-900">{member.memberships.length > 0 ? 'Active' : 'Inactive'}</dd>
            </div>
            {member.address && (
              <div>
                <dt className="font-medium text-gray-500">Address:</dt>
                <dd className="text-gray-900 whitespace-pre-wrap">{member.address}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Group Affiliations</h2>
          {member.memberships && member.memberships.length > 0 ? (
            <ul className="space-y-3">
              {member.memberships.map((membership) => (
                <li key={membership.groupId} className="border-b pb-2 last:border-b-0">
                  <Link href={`/groups/${membership.group.id}`} className="text-blue-600 hover:underline">
                    {membership.group.name} (ID: {membership.group.groupId})
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">Not a member of any groups.</p>
          )}

          {member.ledGroups && member.ledGroups.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Led Groups</h3>
              <ul className="space-y-3">
                {member.ledGroups.map((group) => (
                  <li key={group.id} className="border-b pb-2 last:border-b-0">
                    <Link href={`/groups/${group.id}`} className="text-blue-600 hover:underline">
                      {group.name} (ID: {group.groupId})
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* NextGen Members Section */}
      <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-700">NextGen Members</h2>
          <div className="space-x-3">
            <Link href={`/members/${member.id}/nextgen/create`}>
              <button className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-colors duration-150 ease-in-out">
                Add NextGen
              </button>
            </Link>
            {member.nextGenMembers && member.nextGenMembers.length > 0 && (
              <Link href={`/members/${member.id}/nextgen`}>
                <button className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition-colors duration-150 ease-in-out">
                  View All NextGen Members
                </button>
              </Link>
            )}
          </div>
        </div>

        {member.nextGenMembers && member.nextGenMembers.length > 0 ? (
          <ul className="space-y-4">
            {member.nextGenMembers.slice(0, 3).map((nextGen) => ( // Show a summary, e.g., first 3
              <li key={nextGen.id} className="p-4 border rounded-md hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-medium text-gray-800">
                      {nextGen.nextGenName}
                    </h3>
                    <p className="text-sm text-gray-500">ID: {nextGen.id}</p>
                  </div>
                  <Link href={`/members/${member.id}/nextgen/${nextGen.id}/edit`} className="text-blue-500 hover:text-blue-700 font-medium py-2 px-4 rounded-lg border border-blue-500 hover:border-blue-700 transition-colors">
                    Edit NextGen
                  </Link>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <p><span className="font-medium text-gray-600">Contribution:</span> {nextGen.contribution ?? 'N/A'}</p>
                  <p><span className="font-medium text-gray-600">Contribution Type:</span> {nextGen.contributionType ?? 'N/A'}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">No NextGen members associated with this member.</p>
        )}
      </div>

      <div className="mt-8 flex space-x-4">
        <MemberActions memberId={member.id.toString()} /> {/* Use MemberActions component */}
      </div>

      <div className="mt-8">
        <Link href="/members" className="text-blue-600 hover:underline">
          &larr; Back to Members List
        </Link>
      </div>
    </div>
  );
}