'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

interface Member {
  id: string;
  name: string;
  memberId?: string; // SHG-specific member ID
  email?: string;
  phone?: string;
  address?: string;
}

interface GroupMember {
    id: string; // This is the MemberGroupMembership ID
    memberId: string; // This is the actual Member.id
    // other fields if needed from your GroupDetailData.members type
}

interface Group {
    id: string;
    name: string;
    members: GroupMember[];
    currentShareAmountPerMember?: number;
}

interface GroupFinancialData {
  totalGroupStanding: number;
  numberOfMembers: number;
  calculatedShareAmount: number;
}

// Zod schema for form validation
const addMemberToGroupSchema = z.object({
  // Member selection or creation
  memberId: z.string().optional(),
  createNewMember: z.boolean(),
  
  // New member fields (only required when creating new member)
  newMemberName: z.string().optional(),
  newMemberEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  newMemberPhone: z.string().optional(),
  newMemberAddress: z.string().optional(),
  
  // Financial fields
  useCalculatedShareAmount: z.boolean(),
  currentShareAmount: z.coerce.number().nonnegative("Current share must be a non-negative number").optional(),
  currentLoanAmount: z.coerce.number().nonnegative("Current loan must be a non-negative number").optional(),
  initialInterest: z.coerce.number().nonnegative("Interest must be a non-negative number").optional(),
}).refine((data) => {
  // Either select existing member or create new one
  if (data.createNewMember) {
    return data.newMemberName && data.newMemberName.trim().length > 0;
  } else {
    return data.memberId && data.memberId.length > 0;
  }
}, {
  message: "Please either select an existing member or provide a name for new member",
  path: ["memberId"]
}).refine((data) => {
  // If using manual share amount, it must be provided
  if (!data.useCalculatedShareAmount) {
    return data.currentShareAmount !== undefined && data.currentShareAmount >= 0;
  }
  return true;
}, {
  message: "Please enter a share amount when not using calculated amount",
  path: ["currentShareAmount"]
});

type AddMemberToGroupFormData = z.infer<typeof addMemberToGroupSchema>;

export default function AddMemberToGroupPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [availableMembers, setAvailableMembers] = useState<Member[]>([]);
  const [groupFinancialData, setGroupFinancialData] = useState<GroupFinancialData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AddMemberToGroupFormData>({
    resolver: zodResolver(addMemberToGroupSchema),
    defaultValues: {
      createNewMember: false,
      useCalculatedShareAmount: true,
      currentShareAmount: 0,
      currentLoanAmount: 0,
      initialInterest: 0,
    }
  });

  // Watch form values for dynamic behavior
  const createNewMember = watch('createNewMember');
  const useCalculatedShareAmount = watch('useCalculatedShareAmount');

  useEffect(() => {
    if (!groupId) return;

    const fetchData = async () => {
      setIsLoading(true);
      setApiError(null);
      try {
        const [membersRes, groupRes] = await Promise.all([
          fetch('/api/members'), // Assuming this endpoint returns all members
          fetch(`/api/groups/${groupId}`),
        ]);

        if (!membersRes.ok) {
          if (membersRes.status === 401) throw new Error('Authentication required. Please log in.');
          throw new Error('Failed to fetch members');
        }
        if (!groupRes.ok) {
            if (groupRes.status === 401) throw new Error('Authentication required. Please log in.');
            if (groupRes.status === 404) throw new Error('Group not found');
            throw new Error('Failed to fetch group details');
        }

        const membersData: Member[] = await membersRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const groupData: any = await groupRes.json(); // Group API response has complex nested structure
        
        setGroup(groupData);

        // Calculate financial data
        const latestRecord = groupData.groupPeriodicRecords?.[0];
        const totalGroupStanding = latestRecord?.totalGroupStandingAtEndOfPeriod || 0;
        
        // Use multiple sources to get member count - prioritize the data that's available
        const numberOfMembers = groupData.membershipCount || groupData.members?.length || 0;
        const calculatedShareAmount = numberOfMembers > 0 ? totalGroupStanding / numberOfMembers : 0;
        
        setGroupFinancialData({
          totalGroupStanding,
          numberOfMembers,
          calculatedShareAmount
        });

        // Set calculated share amount as default
        setValue('currentShareAmount', calculatedShareAmount);

        // Filter available members based on the existing members in the group
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const groupMemberIds = new Set(groupData.members?.map((member: any) => member.id) || []);
        const filteredMembers = membersData.filter(m => !groupMemberIds.has(m.id));
        setAvailableMembers(filteredMembers);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
        setApiError(errorMessage);
        
        // If authentication error, redirect to login
        if (errorMessage.includes('Authentication required')) {
          router.push('/auth/signin');
          return;
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [groupId, setValue, router]);

  // Update share amount when calculation preference changes
  useEffect(() => {
    if (groupFinancialData && useCalculatedShareAmount) {
      setValue('currentShareAmount', groupFinancialData.calculatedShareAmount);
    }
  }, [useCalculatedShareAmount, groupFinancialData, setValue]);

  const onSubmit: SubmitHandler<AddMemberToGroupFormData> = async (data) => {
    setApiError(null);
    if (!groupId) {
      setApiError("Group ID is missing.");
      return;
    }

    try {
      let memberIdToUse = data.memberId;

      // Create new member if needed
      if (data.createNewMember) {
        const newMemberPayload = {
          name: data.newMemberName || '',
          email: data.newMemberEmail || null,
          phone: data.newMemberPhone || null,
          address: data.newMemberAddress || null,
        };

        const createMemberResponse = await fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMemberPayload),
        });

        if (!createMemberResponse.ok) {
          const errorData = await createMemberResponse.json();
          throw new Error(errorData.error || 'Failed to create new member');
        }

        const newMember = await createMemberResponse.json();
        memberIdToUse = newMember.id;
      }

      // Add member to group
      const addToGroupPayload = {
        memberId: memberIdToUse,
        currentShareAmount: data.currentShareAmount,
        currentLoanAmount: data.currentLoanAmount,
        initialInterest: data.initialInterest,
      };

      const response = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addToGroupPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add member to group');
      }

      const responseData = await response.json();
      
      // Show success message with details
      const successMessage = `
Member added successfully!

${responseData.message}

Details:
• Members joined: ${responseData.details.previousMemberCount} → ${responseData.details.newMemberCount}
${responseData.details.shareAmountAdded > 0 ? `• Share amount added: ₹${responseData.details.shareAmountAdded}` : ''}
${responseData.details.updatedGroupStanding ? `• Updated group standing: ₹${responseData.details.updatedGroupStanding}` : ''}
      `.trim();
      
      alert(successMessage);
      router.push(`/groups/${groupId}`);
      router.refresh(); // To see the updated member list on the group page
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      alert(`Error: ${err instanceof Error ? err.message : 'An unexpected error occurred.'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading group data...</p>
      </div>
    );
  }

  if (apiError?.includes('Authentication required')) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-red-500 text-xl">Authentication Required</p>
        <p className="text-gray-600 mt-2">You need to be logged in to access this page.</p>
        <Link href="/auth/signin" className="text-blue-500 hover:underline mt-4 inline-block">
          Go to Login
        </Link>
      </div>
    );
  }

  if (apiError && !group && apiError.includes('Group not found')) {
    return (
        <div className="container mx-auto p-4 text-center">
            <p className="text-red-500 text-xl">Error: Group not found.</p>
            <Link href="/groups" className="text-blue-500 hover:underline mt-4 inline-block">
                Go back to Groups
            </Link>
        </div>
    );
  }
  
  if (apiError) {
    return <div className="container mx-auto p-4 text-center text-red-500">Error: {apiError}</div>;
  }

  if (!group) {
    return <div className="container mx-auto p-4 text-center">Group details not available.</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Add Member to Group: {group.name}
      </h1>
      
      {/* Financial Information Display */}
      {groupFinancialData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">Group Financial Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-700">Total Group Standing:</span>
              <div className="text-xl font-bold text-blue-900">₹{groupFinancialData.totalGroupStanding.toLocaleString()}</div>
            </div>
            <div>
              <span className="font-medium text-blue-700">Current Members:</span>
              <div className="text-xl font-bold text-blue-900">{groupFinancialData.numberOfMembers}</div>
            </div>
            <div>
              <span className="font-medium text-blue-700">Share of Each Member:</span>
              <div className="text-xl font-bold text-green-600">₹{groupFinancialData.calculatedShareAmount.toLocaleString()}</div>
            </div>
          </div>
          
          {/* Important Notice */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-yellow-800">Important Notice</h4>
                <div className="mt-1 text-sm text-yellow-700">
                  <p><strong>New Member Share Contribution:</strong> When a new member joins, they need to contribute <strong>₹{groupFinancialData.calculatedShareAmount.toLocaleString()}</strong> as their share amount to maintain equal shares among all members.</p>
                  <p className="mt-1"><strong>Impact:</strong> Adding this member will increase the total members from <strong>{groupFinancialData.numberOfMembers}</strong> to <strong>{groupFinancialData.numberOfMembers + 1}</strong> and add their share amount to the group standing.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {apiError && !apiError.includes('Group not found') && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        
        {/* Member Selection Toggle */}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Member Option
          </label>
          <div className="flex items-center space-x-6">
            <label className="flex items-center">
              <input
                type="radio"
                value="existing"
                checked={!createNewMember}
                onChange={() => setValue('createNewMember', false)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Select Existing Member</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="new"
                checked={createNewMember}
                onChange={() => setValue('createNewMember', true)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Create New Member</span>
            </label>
          </div>
        </div>

        {/* Existing Member Selection */}
        {!createNewMember && (
          <div className="mb-4">
            <label htmlFor="memberId" className="block text-gray-700 text-sm font-bold mb-2">
              Select Member <span className="text-red-500">*</span>
            </label>
            {availableMembers.length === 0 ? (
              <p className="text-gray-600 italic">No new members available to add to this group. Try creating a new member instead.</p>
            ) : (
              <select
                id="memberId"
                {...register("memberId")}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              >
                <option value="">-- Select a Member --</option>
                {availableMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} {member.email && `(${member.email})`}
                  </option>
                ))}
              </select>
            )}
            {errors.memberId && <p className="text-red-500 text-xs mt-1">{errors.memberId.message}</p>}
          </div>
        )}

        {/* New Member Creation Fields */}
        {createNewMember && (
          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">New Member Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="newMemberName" className="block text-gray-700 text-sm font-bold mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="newMemberName"
                  {...register("newMemberName")}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="Enter member name"
                />
                {errors.newMemberName && <p className="text-red-500 text-xs mt-1">{errors.newMemberName.message}</p>}
              </div>

              <div>
                <label htmlFor="newMemberEmail" className="block text-gray-700 text-sm font-bold mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="newMemberEmail"
                  {...register("newMemberEmail")}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="Enter email address"
                />
                {errors.newMemberEmail && <p className="text-red-500 text-xs mt-1">{errors.newMemberEmail.message}</p>}
              </div>

              <div>
                <label htmlFor="newMemberPhone" className="block text-gray-700 text-sm font-bold mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  id="newMemberPhone"
                  {...register("newMemberPhone")}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="Enter phone number"
                />
                {errors.newMemberPhone && <p className="text-red-500 text-xs mt-1">{errors.newMemberPhone.message}</p>}
              </div>

              <div>
                <label htmlFor="newMemberAddress" className="block text-gray-700 text-sm font-bold mb-2">
                  Address
                </label>
                <input
                  type="text"
                  id="newMemberAddress"
                  {...register("newMemberAddress")}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="Enter address"
                />
                {errors.newMemberAddress && <p className="text-red-500 text-xs mt-1">{errors.newMemberAddress.message}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Financial Information Section */}
        <div className="mb-6 p-4 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Financial Information</h3>

          {/* Share Amount Section */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Share Amount
            </label>
            <div className="flex items-center space-x-4 mb-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={useCalculatedShareAmount}
                  onChange={() => setValue('useCalculatedShareAmount', true)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Use Calculated Amount</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!useCalculatedShareAmount}
                  onChange={() => setValue('useCalculatedShareAmount', false)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Enter Manual Amount</span>
              </label>
            </div>
            
            <div className="relative">
              <input
                type="number"
                id="currentShareAmount"
                step="0.01"
                {...register("currentShareAmount")}
                disabled={useCalculatedShareAmount}
                className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                  useCalculatedShareAmount ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                placeholder="Enter share amount"
              />
              {useCalculatedShareAmount && groupFinancialData && (
                <div className="absolute right-3 top-2 text-sm text-green-600 font-medium">
                  Auto-calculated: ₹{groupFinancialData.calculatedShareAmount.toLocaleString()}
                </div>
              )}
            </div>
            {errors.currentShareAmount && <p className="text-red-500 text-xs mt-1">{errors.currentShareAmount.message}</p>}
            
            {useCalculatedShareAmount && groupFinancialData && (
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-medium">Calculation:</span> Total Group Standing (₹{groupFinancialData.totalGroupStanding.toLocaleString()}) ÷ Current Members ({groupFinancialData.numberOfMembers}) = ₹{groupFinancialData.calculatedShareAmount.toLocaleString()}
              </p>
            )}
          </div>

          {/* Loan Amount */}
          <div className="mb-4">
            <label htmlFor="currentLoanAmount" className="block text-gray-700 text-sm font-bold mb-2">
              Current Loan Amount
            </label>
            <input
              type="number"
              id="currentLoanAmount"
              step="0.01"
              {...register("currentLoanAmount")}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="Enter current loan amount (if any)"
            />
            {errors.currentLoanAmount && <p className="text-red-500 text-xs mt-1">{errors.currentLoanAmount.message}</p>}
          </div>

          {/* Interest Rate */}
          <div className="mb-4">
            <label htmlFor="initialInterest" className="block text-gray-700 text-sm font-bold mb-2">
              Interest Rate (%)
            </label>
            <input
              type="number"
              id="initialInterest"
              step="0.01"
              {...register("initialInterest")}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="Enter interest rate"
            />
            {errors.initialInterest && <p className="text-red-500 text-xs mt-1">{errors.initialInterest.message}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isSubmitting || (!createNewMember && availableMembers.length === 0)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
          >
            {isSubmitting ? 'Adding Member...' : createNewMember ? 'Create & Add Member' : 'Add Member to Group'}
          </button>
          <Link href={`/groups/${groupId}`}>
            <button type="button" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
              Cancel
            </button>
          </Link>
        </div>
      </form>
    </div>
  );
}
