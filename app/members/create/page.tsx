'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

interface Group {
  id: string;
  name: string;
  groupId: string;
  currentShareAmountPerMember?: number;
}

interface GroupFinancialData {
  totalGroupStanding: number;
  numberOfMembers: number;
  calculatedShareAmount: number;
}

// Zod schema for form validation
const createMemberSchema = z.object({
  // Member fields
  name: z.string().min(1, 'Member name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  
  // Group selection
  addToGroup: z.boolean(),
  groupId: z.string().optional(),
  
  // Financial fields (only when adding to group)
  useCalculatedShareAmount: z.boolean(),
  currentShareAmount: z.coerce.number().nonnegative("Current share must be a non-negative number").optional(),
  currentLoanAmount: z.coerce.number().nonnegative("Current loan must be a non-negative number").optional(),
  initialInterest: z.coerce.number().nonnegative("Interest must be a non-negative number").optional(),
}).refine((data) => {
  // If adding to group, group must be selected
  if (data.addToGroup) {
    return data.groupId && data.groupId.length > 0;
  }
  return true;
}, {
  message: "Please select a group when choosing to add member to group",
  path: ["groupId"]
}).refine((data) => {
  // If adding to group and using manual share amount, it must be provided
  if (data.addToGroup && !data.useCalculatedShareAmount) {
    return data.currentShareAmount !== undefined && data.currentShareAmount >= 0;
  }
  return true;
}, {
  message: "Please enter a share amount when not using calculated amount",
  path: ["currentShareAmount"]
});

type CreateMemberFormData = z.infer<typeof createMemberSchema>;

export default function CreateMemberPage() {
  const router = useRouter();
  
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupFinancialData, setSelectedGroupFinancialData] = useState<GroupFinancialData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateMemberFormData>({
    resolver: zodResolver(createMemberSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      addToGroup: false,
      groupId: '',
      useCalculatedShareAmount: true,
      currentShareAmount: 0,
      currentLoanAmount: 0,
      initialInterest: 0,
    },
  });

  const addToGroup = watch('addToGroup');
  const selectedGroupId = watch('groupId');
  const useCalculatedShareAmount = watch('useCalculatedShareAmount');

  // Fetch available groups
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await fetch('/api/groups');
        if (response.ok) {
          const data = await response.json();
          setGroups(data);
          
          // Auto-select if there's only one group
          if (data.length === 1) {
            setValue('addToGroup', true);
            setValue('groupId', data[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching groups:', error);
        setApiError('Failed to load groups');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, [setValue]);

  // Fetch financial data for selected group
  useEffect(() => {
    const fetchGroupFinancialData = async () => {
      if (!selectedGroupId || !addToGroup) {
        setSelectedGroupFinancialData(null);
        return;
      }

      try {
        const response = await fetch(`/api/groups/${selectedGroupId}/summary`);
        if (response.ok) {
          const data = await response.json();
          const financialData: GroupFinancialData = {
            totalGroupStanding: data.financialOverview?.totalGroupStanding || 0,
            numberOfMembers: data.groupInfo?.totalMembers || 0,
            calculatedShareAmount: data.financialOverview?.sharePerMember || 0,
          };
          setSelectedGroupFinancialData(financialData);
          
          // Set calculated share amount as default
          if (useCalculatedShareAmount) {
            setValue('currentShareAmount', financialData.calculatedShareAmount);
          }
        }
      } catch (error) {
        console.error('Error fetching group financial data:', error);
      }
    };

    fetchGroupFinancialData();
  }, [selectedGroupId, addToGroup, setValue, useCalculatedShareAmount]);

  // Update share amount when calculation preference changes
  useEffect(() => {
    if (selectedGroupFinancialData && useCalculatedShareAmount) {
      setValue('currentShareAmount', selectedGroupFinancialData.calculatedShareAmount);
    }
  }, [useCalculatedShareAmount, selectedGroupFinancialData, setValue]);

  const onSubmit: SubmitHandler<CreateMemberFormData> = async (data) => {
    console.log('=== FORM SUBMISSION STARTED ===');
    console.log('Raw form data:', data);
    console.log('addToGroup:', data.addToGroup);
    console.log('groupId:', data.groupId);
    console.log('useCalculatedShareAmount:', data.useCalculatedShareAmount);
    
    setApiError(null);
    
    console.log('Form submission data:', data);

    try {
      // Create the member first
      const memberPayload = {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
      };

      console.log('Creating member with payload:', memberPayload);
      console.log('Payload name length:', memberPayload.name?.length);
      console.log('Payload name value:', JSON.stringify(memberPayload.name));
      
      // Test API reachability
      console.log('Making API request to /api/members...');

      const memberResponse = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberPayload),
      });

      if (!memberResponse.ok) {
        let errorData;
        try {
          errorData = await memberResponse.json();
        } catch {
          errorData = { 
            error: `HTTP ${memberResponse.status}: ${memberResponse.statusText}`,
            details: 'Failed to parse error response'
          };
        }
        console.error('Member creation failed:', errorData);
        console.error('Response status:', memberResponse.status);
        console.error('Response statusText:', memberResponse.statusText);
        throw new Error(errorData.error || errorData.message || `Failed to create member (${memberResponse.status})`);
      }

      const newMember = await memberResponse.json();
      console.log('Member created successfully:', newMember);

      // If adding to group, add member to group
      if (data.addToGroup && data.groupId) {
        const addToGroupPayload = {
          memberId: newMember.id,
          currentShareAmount: data.currentShareAmount,
          currentLoanAmount: data.currentLoanAmount,
          initialInterest: data.initialInterest,
        };

        console.log('Adding member to group with payload:', addToGroupPayload);

        const groupResponse = await fetch(`/api/groups/${data.groupId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addToGroupPayload),
        });

        if (!groupResponse.ok) {
          let errorData;
          try {
            errorData = await groupResponse.json();
          } catch {
            errorData = { 
              error: `HTTP ${groupResponse.status}: ${groupResponse.statusText}`,
              details: 'Failed to parse error response'
            };
          }
          console.error('Add to group failed:', errorData);
          console.error('Group response status:', groupResponse.status);
          console.error('Group response statusText:', groupResponse.statusText);
          throw new Error(errorData.error || errorData.message || `Failed to add member to group (${groupResponse.status})`);
        }

        const groupResponseData = await groupResponse.json();
        console.log('Member added to group successfully:', groupResponseData);

        // If loan amount is greater than 0, create a loan record
        if (data.currentLoanAmount && data.currentLoanAmount > 0) {
          const loanResponse = await fetch(`/api/groups/${data.groupId}/loans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: newMember.id,
              loanType: 'PERSONAL',
              originalAmount: data.currentLoanAmount,
              interestRate: data.initialInterest || 0,
              dateIssued: new Date().toISOString(),
              status: 'ACTIVE',
            }),
          });

          if (!loanResponse.ok) {
            console.warn('Failed to create loan record:', await loanResponse.text());
          }
        }

        const responseData = await groupResponse.json();
        
        // Show success message with details
        const successMessage = `
Member created and added to group successfully!

${responseData.message || ''}

Details:
• Member: ${newMember.name}
${responseData.details ? `• Members in group: ${responseData.details.previousMemberCount} → ${responseData.details.newMemberCount}` : ''}
${responseData.details?.shareAmountAdded > 0 ? `• Share amount added: ₹${responseData.details.shareAmountAdded}` : ''}
${responseData.details?.updatedGroupStanding ? `• Updated group standing: ₹${responseData.details.updatedGroupStanding}` : ''}
        `.trim();
        
        alert(successMessage);
      } else {
        alert(`Member "${newMember.name}" created successfully!`);
      }

      router.push('/members');
      router.refresh();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      alert(`Error: ${err instanceof Error ? err.message : 'An unexpected error occurred.'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/members" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to Members
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add New Member</h1>
      </div>

      {apiError && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
          {apiError}
        </div>
      )}

      {/* Form validation errors */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md mb-6">
          <p className="font-medium">Form validation errors:</p>
          <ul className="list-disc ml-4 mt-1">
            {Object.entries(errors).map(([field, error]) => (
              <li key={field}>{field}: {error?.message}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Debug: Show form errors */}
        {Object.keys(errors).length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            <strong>Form Validation Errors:</strong>
            <ul className="mt-2 list-disc list-inside">
              {Object.entries(errors).map(([field, error]) => (
                <li key={field}>{field}: {error?.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Member Information Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Member Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                id="name"
                {...register('name')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter member name"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                {...register('email')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter email address"
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                {...register('phone')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter phone number"
              />
              {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                id="address"
                {...register('address')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter address"
              />
              {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>}
            </div>
          </div>
        </div>

        {/* Group Assignment Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Group Assignment</h2>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="addToGroup"
                {...register('addToGroup')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="addToGroup" className="ml-2 text-sm font-medium text-gray-700">
                Add to existing group
              </label>
            </div>

            {addToGroup && (
              <div className="space-y-4 bg-gray-50 p-4 rounded-md">
                <div>
                  <label htmlFor="groupId" className="block text-sm font-medium text-gray-700 mb-1">
                    Select Group *
                  </label>
                  <select
                    id="groupId"
                    {...register('groupId')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Choose a group...</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.groupId})
                      </option>
                    ))}
                  </select>
                  {errors.groupId && <p className="mt-1 text-sm text-red-600">{errors.groupId.message}</p>}
                </div>

                {/* Financial Information Display */}
                {selectedGroupFinancialData && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h3 className="text-sm font-medium text-blue-900 mb-2">Group Financial Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-blue-700 font-medium">Total Group Standing:</span>
                        <span className="ml-2 text-blue-900">₹{selectedGroupFinancialData.totalGroupStanding.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-blue-700 font-medium">Current Members:</span>
                        <span className="ml-2 text-blue-900">{selectedGroupFinancialData.numberOfMembers}</span>
                      </div>
                      <div>
                        <span className="text-blue-700 font-medium">Share Amount/Member:</span>
                        <span className="ml-2 text-blue-900">₹{selectedGroupFinancialData.calculatedShareAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Financial Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="useCalculatedShareAmount"
                        {...register('useCalculatedShareAmount')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="useCalculatedShareAmount" className="ml-2 text-sm text-gray-700">
                        Use calculated amount
                        {selectedGroupFinancialData && (
                          <span className="ml-1 text-blue-600 font-medium">
                            (₹{selectedGroupFinancialData.calculatedShareAmount.toLocaleString()})
                          </span>
                        )}
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Uncheck to enter a custom share amount
                    </p>
                  </div>

                  <div>
                    <label htmlFor="currentShareAmount" className="block text-sm font-medium text-gray-700 mb-1">
                      Current Share Amount (₹)
                    </label>
                    <input
                      type="number"
                      id="currentShareAmount"
                      {...register('currentShareAmount')}
                      disabled={useCalculatedShareAmount}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                    {errors.currentShareAmount && (
                      <p className="mt-1 text-sm text-red-600">{errors.currentShareAmount.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="currentLoanAmount" className="block text-sm font-medium text-gray-700 mb-1">
                      Current Loan Amount (₹)
                    </label>
                    <input
                      type="number"
                      id="currentLoanAmount"
                      {...register('currentLoanAmount')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                    {errors.currentLoanAmount && (
                      <p className="mt-1 text-sm text-red-600">{errors.currentLoanAmount.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="initialInterest" className="block text-sm font-medium text-gray-700 mb-1">
                      Interest Rate (%)
                    </label>
                    <input
                      type="number"
                      id="initialInterest"
                      {...register('initialInterest')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                    {errors.initialInterest && (
                      <p className="mt-1 text-sm text-red-600">{errors.initialInterest.message}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          {/* Debug info */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-500">
              Debug: addToGroup={String(addToGroup)}, groupId={selectedGroupId}, useCalc={String(useCalculatedShareAmount)}
            </div>
          )}
          <Link
            href="/members"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              console.log('Submit button clicked');
              console.log('Current form values:', watch());
              console.log('Form errors:', errors);
            }}
          >
            {isSubmitting ? 'Creating...' : 'Create Member'}
          </button>
        </div>
      </form>
    </div>
  );
}