// /home/pixel/SHG/app/members/[id]/nextgen/[nextGenId]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ContributionType } from '@prisma/client'; // Import enum

// Define the Zod schema for form validation only (no transformation)
const nextGenMemberEditSchema = z.object({
  nextGenName: z.string().min(1, 'Name is required'),
  contribution: z.string().optional(),
  contributionType: z.string().optional()
});

// Type for form fields (raw form input values)
type EditFormFields = z.infer<typeof nextGenMemberEditSchema>;

export default function EditNextGenMemberPage() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.id as string;
  const nextGenId = params.nextGenId as string;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }, // Added isSubmitting
  } = useForm<EditFormFields>({
    resolver: zodResolver(nextGenMemberEditSchema),
    defaultValues: { // Initialize with empty strings, matching form field types
        nextGenName: '',
        contribution: '',
        contributionType: '',
    }
  });

  const [isLoadingData, setIsLoadingData] = useState(true); // Renamed to avoid conflict with isSubmitting
  const [apiError, setApiError] = useState<string | null>(null); // Renamed error to apiError

  useEffect(() => {
    if (memberId && nextGenId) {
      const fetchNextGenMember = async () => {
        setIsLoadingData(true);
        setApiError(null);
        try {
          const response = await fetch(`/api/members/${memberId}/nextgen/${nextGenId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch NextGen member data');
          }
          const data = await response.json();
          // Populate form with fetched data, converting to string for form fields
          reset({
            nextGenName: data.nextGenName || '',
            contribution: data.contribution !== null && data.contribution !== undefined ? String(data.contribution) : '',
            contributionType: data.contributionType || '',
          });
        } catch (err) {
          setApiError((err as Error).message);
        }
        setIsLoadingData(false);
      };
      fetchNextGenMember();
    }
  }, [memberId, nextGenId, reset]);

  const onSubmit = async (rawData: EditFormFields) => {
    setApiError(null);
    try {
      // Transform the data manually
      const data = {
        nextGenName: rawData.nextGenName,
        contribution: rawData.contribution && rawData.contribution.trim() !== '' 
          ? Number(rawData.contribution) 
          : null,
        contributionType: rawData.contributionType && rawData.contributionType.trim() !== ''
          ? rawData.contributionType 
          : null
      };
      
      const response = await fetch(`/api/members/${memberId}/nextgen/${nextGenId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update NextGen member');
      }
      alert('NextGen member updated successfully!'); // Added success alert
      router.push(`/members/${memberId}/nextgen`);
      router.refresh(); // to ensure the list page shows updated data
    } catch (err) {
      setApiError((err as Error).message);
      alert(`Error: ${(err as Error).message}`); // Added error alert
    }
  };

  const handleDelete = async () => {
    setApiError(null);
    if (window.confirm('Are you sure you want to delete this NextGen member?')) {
      try {
        const response = await fetch(`/api/members/${memberId}/nextgen/${nextGenId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete NextGen member');
        }
        alert('NextGen member deleted successfully!');
        router.push(`/members/${memberId}/nextgen`);
        router.refresh(); // to ensure the list page shows updated data
      } catch (err) {
        setApiError((err as Error).message);
        alert(`Error: ${(err as Error).message}`); // Added error alert
      }
    }
  };

  if (isLoadingData) return <p>Loading...</p>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Edit NextGen Member</h1>
      {apiError && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">Error: {apiError}</p>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="nextGenName" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            id="nextGenName"
            type="text"
            {...register('nextGenName')}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          {errors.nextGenName && <p className="text-red-500 text-xs mt-1">{errors.nextGenName.message}</p>}
        </div>

        <div>
          <label htmlFor="contribution" className="block text-sm font-medium text-gray-700">
            Contribution Amount
          </label>
          <input
            id="contribution"
            type="number" // Keep type for browser UI
            step="any"
            {...register('contribution')}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          {errors.contribution && <p className="text-red-500 text-xs mt-1">{errors.contribution.message}</p>}
        </div>

        <div>
          <label htmlFor="contributionType" className="block text-sm font-medium text-gray-700">
            Contribution Type
          </label>
          <select
            id="contributionType"
            {...register('contributionType')}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="">Select Type (Optional)</option>
            {Object.values(ContributionType).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.contributionType && <p className="text-red-500 text-xs mt-1">{errors.contributionType.message}</p>}
        </div>

        <div className="flex justify-between items-center">
            <button
                type="submit"
                disabled={isSubmitting} // Use isSubmitting
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
            >
                {isSubmitting ? 'Saving...' : 'Save Changes'} 
            </button>
            <button
                type="button" // Important: type="button" to prevent form submission
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
                Delete Member
            </button>
        </div>
         <button
            type="button"
            onClick={() => router.back()} // Or router.push(`/members/${memberId}/nextgen`)
            className="mt-4 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
        >
            Cancel
        </button>
      </form>
    </div>
  );
}
