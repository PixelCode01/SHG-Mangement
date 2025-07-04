// filepath: /home/pixel/SHG/app/components/MemberActions.tsx
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface MemberActionsProps {
  memberId: string;
}

export default function MemberActions({ memberId }: MemberActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete member: ${response.statusText}`);
      }
      // Deletion was successful
      router.push('/members'); // Redirect to members list
      router.refresh(); // Refresh the page to reflect changes
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
      >
        {isDeleting ? 'Deleting...' : 'Delete Member'}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </>
  );
}
