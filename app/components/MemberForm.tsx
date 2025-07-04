'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

const memberSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  loanAmount: z.number().min(0, 'Loan amount must be 0 or greater'),
  groupId: z.string().optional(),
});

type MemberFormValues = z.infer<typeof memberSchema>;

interface MemberFormProps {
  initialData?: Partial<MemberFormValues>;
  onSubmit: (data: MemberFormValues) => Promise<void>;
  isEditMode?: boolean;
}

interface Group {
  id: string;
  name: string;
  groupId: string;
}

export default function MemberForm({ initialData, onSubmit, isEditMode = false }: MemberFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: initialData || {
      name: '',
      email: '',
      phone: '',
      address: '',
      loanAmount: 0,
      groupId: '',
    },
  });

  // Fetch available groups
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await fetch('/api/groups');
        if (response.ok) {
          const data = await response.json();
          setGroups(data);
          
          // Auto-select if there's only one group
          if (data.length === 1 && !isEditMode) {
            setValue('groupId', data[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching groups:', error);
      } finally {
        setLoadingGroups(false);
      }
    };

    fetchGroups();
  }, [setValue, isEditMode]);

  const handleFormSubmit = async (data: MemberFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await onSubmit(data);
    } catch (error) {
      const typedError = error as Error;
      console.error('Error submitting form:', typedError);
      setError(typedError.message || `An error occurred while ${isEditMode ? 'updating' : 'saving'} the member. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 bg-card-bg p-6 rounded-lg shadow-md">
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-md border border-red-300">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          {...register('name')}
          className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-background text-foreground"
          disabled={isLoading}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
          Email Address (Optional)
        </label>
        <input
          type="email"
          id="email"
          {...register('email')}
          className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-background text-foreground"
          disabled={isLoading}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-1">
          Phone Number (Optional)
        </label>
        <input
          type="text"
          id="phone"
          {...register('phone')}
          className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-background text-foreground"
          disabled={isLoading}
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium text-foreground mb-1">
          Address (Optional)
        </label>
        <textarea
          id="address"
          {...register('address')}
          rows={3}
          className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-background text-foreground"
          disabled={isLoading}
        />
        {errors.address && (
          <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="loanAmount" className="block text-sm font-medium text-foreground mb-1">
          Initial Loan Amount
        </label>
        <input
          type="number"
          id="loanAmount"
          step="0.01"
          min="0"
          {...register('loanAmount', { valueAsNumber: true })}
          className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-background text-foreground"
          disabled={isLoading}
          placeholder="0.00"
        />
        {errors.loanAmount && (
          <p className="mt-1 text-sm text-red-600">{errors.loanAmount.message}</p>
        )}
      </div>

      {!isEditMode && (
        <div>
          <label htmlFor="groupId" className="block text-sm font-medium text-foreground mb-1">
            Add to Group (Optional)
          </label>
          {loadingGroups ? (
            <div className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm bg-background text-muted">
              Loading groups...
            </div>
          ) : (
            <select
              id="groupId"
              {...register('groupId')}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-background text-foreground"
              disabled={isLoading}
            >
              <option value="">Select a group (optional)</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.groupId})
                </option>
              ))}
            </select>
          )}
          {errors.groupId && (
            <p className="mt-1 text-sm text-red-600">{errors.groupId.message}</p>
          )}
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4 border-t border-border mt-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {isEditMode ? 'Updating...' : 'Saving...'}
            </>
          ) : (isEditMode ? 'Update Member' : 'Save Member')}
        </button>
      </div>
    </form>
  );
}