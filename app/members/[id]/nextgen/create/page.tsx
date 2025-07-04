// /home/pixel/SHG/app/members/[id]/nextgen/create/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ContributionType } from '@prisma/client';

// Zod schema for validation only (no transformation)
const finalSchema = z.object({
  nextGenName: z.string().min(1, { message: "Name is required" }),
  contribution: z.string().optional(),
  contributionType: z.string().optional()
});

// Type for form values
type FormFields = z.infer<typeof finalSchema>;

interface NextGenMemberCreatePageProps {
  params: Promise<{
    id: string; // This is the primaryMemberId
  }>;
}

export default function CreateNextGenMemberPage({ params }: NextGenMemberCreatePageProps) {
  const router = useRouter();
  const [primaryMemberId, setPrimaryMemberId] = useState<string>('');

  useEffect(() => {
    params.then(({ id }) => {
      setPrimaryMemberId(id);
    });
  }, [params]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>({
    resolver: zodResolver(finalSchema),
    defaultValues: {
      nextGenName: '',
      contribution: '', // Raw form value is string
      contributionType: '', // Raw form value is string (empty option value)
    },
  });

  const [apiError, setApiError] = useState<string | null>(null);
  const [primaryMemberName, setPrimaryMemberName] = useState<string>('');

  useEffect(() => {
    if (primaryMemberId) {
      const fetchPrimaryMember = async () => {
        try {
          const res = await fetch(`/api/members/${primaryMemberId}`);
          if (!res.ok) {
            throw new Error('Failed to fetch primary member details');
          }
          const member = await res.json();
          setPrimaryMemberName(member.name);
        } catch (err: unknown) {
          if (err instanceof Error) {
            console.error(err.message);
          } else {
            console.error('An unknown error occurred', err);
          }
        }
      };
      fetchPrimaryMember();
    }
  }, [primaryMemberId]);

  // Handle form submission with data transformation
  const onSubmit = async (data: FormFields) => {
    setApiError(null);

    if (!primaryMemberId) {
      setApiError("Primary member ID is missing.");
      return;
    }

    // Transform the data manually
    const payload = {
      nextGenName: data.nextGenName,
      contribution: data.contribution && data.contribution.trim() !== '' 
        ? Number(data.contribution) 
        : null,
      contributionType: data.contributionType && data.contributionType.trim() !== ''
        ? data.contributionType 
        : null
    };

    try {
      const response = await fetch(`/api/members/${primaryMemberId}/nextgen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create NextGen member');
      }

      router.push(`/members/${primaryMemberId}`);
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setApiError(err.message || 'An unexpected error occurred.');
        console.error("Submission error:", err.message);
      } else {
        setApiError('An unexpected error occurred.');
        console.error("Submission error:", err);
      }
    }
  };

  if (!primaryMemberId) {
    return <p>Loading member details or invalid member ID...</p>;
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Add NextGen Member for {primaryMemberName || '...'}
      </h1>
      {apiError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{apiError}</span>
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-4">
          <label htmlFor="nextGenName" className="block text-gray-700 text-sm font-bold mb-2">
            NextGen Member Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="nextGenName"
            {...register("nextGenName")}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
          {errors.nextGenName && <p className="text-red-500 text-xs mt-1">{errors.nextGenName.message}</p>}
        </div>

        <div className="mb-4">
          <label htmlFor="contribution" className="block text-gray-700 text-sm font-bold mb-2">
            Monthly Contribution (Optional)
          </label>
          <input
            type="number" // Keep type="number" for browser UI, but RHF reads as string without valueAsNumber
            id="contribution"
            {...register("contribution")}
            step="0.01"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
          {errors.contribution && <p className="text-red-500 text-xs mt-1">{errors.contribution.message}</p>}
        </div>

        <div className="mb-6">
          <label htmlFor="contributionType" className="block text-gray-700 text-sm font-bold mb-2">
            Contribution Type (Optional)
          </label>
          <select
            id="contributionType"
            {...register("contributionType")}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
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

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
          >
            {isSubmitting ? 'Adding...' : 'Add NextGen Member'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
