'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

const groupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  memberIds: z.array(z.string()).optional(),
});

type GroupFormValues = z.infer<typeof groupSchema>;

interface GroupFormProps {
  initialData?: GroupFormValues;
  members?: { id: string; name: string }[];
  onSubmit: (data: GroupFormValues) => Promise<void>;
}

export default function GroupForm({ initialData, members = [], onSubmit }: GroupFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: initialData || {
      name: '',
      description: '',
      memberIds: [],
    },
  });

  const selectedMemberIds = watch('memberIds') || [];

  const handleFormSubmit = async (data: GroupFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await onSubmit(data);
      router.push('/groups');
      router.refresh();
    } catch (error) {
      console.error('Error submitting form:', error);
      setError('An error occurred while saving the group. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMember = (memberId: string) => {
    const updatedMemberIds = selectedMemberIds.includes(memberId)
      ? selectedMemberIds.filter((id) => id !== memberId)
      : [...selectedMemberIds, memberId];
    setValue('memberIds', updatedMemberIds);
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
          Group Name
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
        <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">
          Description
        </label>
        <textarea
          id="description"
          {...register('description')}
          rows={4}
          className="mt-1 block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-background text-foreground"
          disabled={isLoading}
        />
      </div>

      {members.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Select Members
          </label>
          <div className="space-y-2 max-h-60 overflow-auto p-3 border border-border rounded-md bg-background">
            {members.map((member) => (
              <div key={member.id} className="flex items-center p-2 rounded-md hover:bg-hover transition-colors">
                <input
                  type="checkbox"
                  id={`member-${member.id}`}
                  checked={selectedMemberIds.includes(member.id)}
                  onChange={() => toggleMember(member.id)}
                  className="h-4 w-4 text-primary focus:ring-primary border-border rounded cursor-pointer"
                  disabled={isLoading}
                />
                <label
                  htmlFor={`member-${member.id}`}
                  className="ml-3 block text-sm text-foreground cursor-pointer"
                >
                  {member.name}
                </label>
              </div>
            ))}
          </div>
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
              Saving...
            </>
          ) : 'Save Group'}
        </button>
      </div>
    </form>
  );
}