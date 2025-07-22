'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useForm, Controller, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Import Custom Columns components and types
import dynamic from 'next/dynamic';
import { GroupCustomSchema } from '@/app/types/custom-columns';

// Dynamically import CustomColumnsManager to avoid SSR issues
const CustomColumnsManager = dynamic(
  () => import('@/app/components/CustomColumnsManager').then(mod => ({ default: mod.CustomColumnsManager })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading Custom Columns...</span>
      </div>
    )
  }
);

interface EditGroupPageProps {
  params: Promise<{ id: string }>;
}

// Define the structure for member data including historical fields
interface MemberEditData {
  id: string; // Member's actual ID
  name: string;
  currentLoanAmount: number | null;
  familyMembersCount: number | null;
}

// Define the structure for the group data fetched
interface GroupEditData {
  id: string; // Group's actual ID
  name: string;
  address: string | null;
  registrationNumber: string | null;
  organization: string | null;
  leaderId: string | null;
  memberCount: number | null;
  dateOfStarting: string | null; // Comes as ISO string
  description: string | null;
  members: MemberEditData[]; // Array of members with historical data
  
  // Collection settings
  collectionFrequency: string | null;
  collectionDayOfMonth: number | null;
  collectionDayOfWeek: string | null;
  collectionWeekOfMonth: number | null;
  collectionMonth: number | null;
  collectionDate: number | null;
  
  // Banking details
  bankAccountNumber: string | null;
  bankName: string | null;
  
  // Financial settings
  cashInHand: number | null;
  balanceInBank: number | null;
  interestRate: number | null;
  monthlyContribution: number | null;
  // Removed globalShareAmount as requested
  
  // Insurance settings
  loanInsuranceEnabled: boolean | null;
  loanInsurancePercent: number | null;
  loanInsuranceBalance: number | null;
  
  // Social fund settings
  groupSocialEnabled: boolean | null;
  groupSocialAmountPerFamilyMember: number | null;
  groupSocialBalance: number | null;
  
  // Period tracking
  includeDataTillCurrentPeriod: boolean | null;
  currentPeriodMonth: number | null;
  currentPeriodYear: number | null;
  
  // Late fine settings - Updated to use the complete late fine rule structure
  lateFineRules?: Array<{
    isEnabled?: boolean;
    ruleType?: string;
    dailyAmount?: number;
    dailyPercentage?: number;
    tierRules?: Array<{
      startDay: number;
      endDay: number;
      amount: number;
      isPercentage: boolean;
    }>;
  }>;
}

// Late fine tier schema
const lateFineRuleTierSchema = z.object({
  startDay: z.number().int().min(1),
  endDay: z.number().int().min(1),
  amount: z.number().nonnegative(),
  isPercentage: z.boolean(),
});

// Late fine rule schema
const lateFineRuleSchema = z.object({
  isEnabled: z.boolean(),
  ruleType: z.enum(['DAILY_FIXED', 'DAILY_PERCENTAGE', 'TIER_BASED']).optional(),
  dailyAmount: z.number().nonnegative().optional(),
  dailyPercentage: z.number().nonnegative().max(100).optional(),
  tierRules: z.array(lateFineRuleTierSchema).optional(),
  // Individual tier fields for the form
  tier1StartDay: z.number().int().min(1).optional(),
  tier1EndDay: z.number().int().min(1).optional(),
  tier1Amount: z.number().nonnegative().optional(),
  tier2StartDay: z.number().int().min(1).optional(),
  tier2EndDay: z.number().int().min(1).optional(),
  tier2Amount: z.number().nonnegative().optional(),
  tier3StartDay: z.number().int().min(1).optional(),
  tier3Amount: z.number().nonnegative().optional(),
}).superRefine((data, ctx) => {
  // Validate late fine rules when enabled
  if (data.isEnabled) {
    if (!data.ruleType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Late fine rule type is required when late fine is enabled',
        path: ['ruleType'],
      });
    }
    
    if (data.ruleType === 'DAILY_FIXED' && (!data.dailyAmount || data.dailyAmount <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Daily amount is required for fixed amount rule type',
        path: ['dailyAmount'],
      });
    }
    
    if (data.ruleType === 'DAILY_PERCENTAGE' && (!data.dailyPercentage || data.dailyPercentage <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Daily percentage is required for percentage rule type',
        path: ['dailyPercentage'],
      });
    }
  }
});

// Schema for the entire form including member historical data
const editFormSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
  address: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  organization: z.string().optional().nullable(),
  leaderId: z.string().min(1, 'Leader selection is required').nullable(),
  memberCount: z.number().int().min(1, 'Must be at least 1').optional().nullable(),
  dateOfStarting: z.date().max(new Date(), 'Date cannot be in the future').nullable(),
  description: z.string().optional().nullable(),
  
  // Collection settings
  collectionFrequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY", "YEARLY"]).optional().nullable(),
  collectionDayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  collectionDayOfWeek: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]).optional().nullable(),
  collectionWeekOfMonth: z.number().int().min(1).max(4).optional().nullable(),
  collectionMonth: z.number().int().min(1).max(12).optional().nullable(),
  collectionDate: z.number().int().min(1).max(31).optional().nullable(),
  
  // Banking details
  bankAccountNumber: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  
  // Financial settings
  cashInHand: z.number().nonnegative().optional().nullable(),
  balanceInBank: z.number().nonnegative().optional().nullable(),
  interestRate: z.number().nonnegative().max(100, 'Interest rate cannot exceed 100%').optional().nullable(),
  monthlyContribution: z.number().nonnegative().optional().nullable(),
  
  // Insurance settings
  loanInsuranceEnabled: z.boolean().optional(),
  loanInsurancePercent: z.number().nonnegative().max(100, 'Loan insurance rate cannot exceed 100%').optional().nullable(),
  loanInsuranceBalance: z.number().nonnegative().optional().nullable(),
  
  // Social fund settings
  groupSocialEnabled: z.boolean().optional(),
  groupSocialAmountPerFamilyMember: z.number().nonnegative().optional().nullable(),
  groupSocialBalance: z.number().nonnegative().optional().nullable(),
  
  // Period tracking
  includeDataTillCurrentPeriod: z.boolean().optional(),
  currentPeriodMonth: z.number().int().min(1).max(12).optional().nullable(),
  currentPeriodYear: z.number().int().min(2000).max(2100).optional().nullable(),
  
  // Late fine settings - Use the complete late fine rule schema
  lateFineRule: lateFineRuleSchema.optional(),
  
  members: z.array(z.object({
    id: z.string(), // Member ID
    name: z.string(), // For display
    currentLoanAmount: z.number().nonnegative('Cannot be negative').nullable(),
    familyMembersCount: z.number().int().positive('Must be at least 1').nullable(),
  }))
}).superRefine((data, ctx) => {
  // Conditional validation based on collection frequency
  if (data.collectionFrequency === 'MONTHLY' || data.collectionFrequency === 'YEARLY') {
    if (!data.collectionDayOfMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Collection day of month is required for monthly/yearly frequency',
        path: ['collectionDayOfMonth'],
      });
    }
  }
  
  if (data.collectionFrequency === 'WEEKLY' || data.collectionFrequency === 'FORTNIGHTLY') {
    if (!data.collectionDayOfWeek) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Collection day of week is required for weekly/fortnightly frequency',
        path: ['collectionDayOfWeek'],
      });
    }
  }
  
  if (data.collectionFrequency === 'FORTNIGHTLY') {
    if (!data.collectionWeekOfMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Collection week pattern is required for fortnightly frequency',
        path: ['collectionWeekOfMonth'],
      });
    }
  }
  
  if (data.collectionFrequency === 'YEARLY') {
    if (!data.collectionMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Collection month is required for yearly frequency',
        path: ['collectionMonth'],
      });
    }
    if (!data.collectionDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Collection date is required for yearly frequency',
        path: ['collectionDate'],
      });
    }
  }
});

type EditFormValues = z.infer<typeof editFormSchema>;

export default function EditGroupPage({ params }: EditGroupPageProps) {
  const { id: groupId } = use(params); // Group ID from URL

  const [allMembers, setAllMembers] = useState<{ id: string; name: string }[]>([]); // For leader dropdown
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Custom Columns state
  const [isCustomColumnsOpen, setIsCustomColumnsOpen] = useState(false);
  const [currentCustomSchema, setCurrentCustomSchema] = useState<GroupCustomSchema | undefined>(undefined);
  const [groupName, setGroupName] = useState<string>('');

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty }, // Use isDirty to track changes
  } = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      name: '',
      address: null,
      registrationNumber: null,
      organization: null,
      leaderId: null,
      memberCount: null,
      dateOfStarting: null,
      description: null,
      
      // Collection settings
      collectionFrequency: null,
      collectionDayOfMonth: null,
      collectionDayOfWeek: null,
      collectionWeekOfMonth: null,
      collectionMonth: null,
      collectionDate: null,
      
      // Banking details
      bankAccountNumber: null,
      bankName: null,
      
      // Financial settings
      cashInHand: null,
      balanceInBank: null,
      interestRate: null,
      monthlyContribution: null,
      // Removed globalShareAmount as requested
      
      // Insurance settings
      loanInsuranceEnabled: false,
      loanInsurancePercent: null,
      loanInsuranceBalance: null,
      
      // Social fund settings
      groupSocialEnabled: false,
      groupSocialAmountPerFamilyMember: null,
      groupSocialBalance: null,
      
      // Period tracking
      includeDataTillCurrentPeriod: false,
      currentPeriodMonth: new Date().getMonth() + 1, // Current month
      currentPeriodYear: new Date().getFullYear(), // Current year
      
      // Late fine settings - Updated to use the complete late fine rule structure
      lateFineRule: {
        isEnabled: false,
        ruleType: undefined,
        dailyAmount: undefined,
        dailyPercentage: undefined,
        tierRules: undefined,
        tier1StartDay: 1,
        tier1EndDay: 5,
        tier1Amount: undefined,
        tier2StartDay: 6,
        tier2EndDay: 15,
        tier2Amount: undefined,
        tier3StartDay: 16,
        tier3Amount: undefined,
      },
      
      members: [],
    },
  });

  // useFieldArray for managing the members array in the form state
  const { fields: memberFields } = useFieldArray({
    control,
    name: "members",
    keyName: "fieldId" // Use a different key name than default 'id'
  });

  // Watch collection frequency and period tracking for conditional rendering
  const collectionFrequency = useWatch({ control, name: 'collectionFrequency' });
  const includeDataTillCurrentPeriod = useWatch({ control, name: 'includeDataTillCurrentPeriod' });
  const currentPeriodMonth = useWatch({ control, name: 'currentPeriodMonth' });
  const currentPeriodYear = useWatch({ control, name: 'currentPeriodYear' });

  // Effect to automatically update period tracking based on checkbox
  useEffect(() => {
    if (includeDataTillCurrentPeriod && currentPeriodMonth && currentPeriodYear) {
      const nextMonth = currentPeriodMonth === 12 ? 1 : currentPeriodMonth + 1;
      const nextYear = currentPeriodMonth === 12 ? currentPeriodYear + 1 : currentPeriodYear;
      
      // You can add logic here to update the tracking period
      console.log(`Current period includes data till: ${currentPeriodMonth}/${currentPeriodYear}`);
      console.log(`Next tracking period will be: ${nextMonth}/${nextYear}`);
    }
  }, [includeDataTillCurrentPeriod, currentPeriodMonth, currentPeriodYear]);

  // Fetch initial group data and all members list
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [groupResponse, membersResponse] = await Promise.all([
          fetch(`/api/groups/${groupId}`),
          fetch('/api/members'), // Fetch all members for the leader dropdown
        ]);

        if (!groupResponse.ok) {
          if (groupResponse.status === 404) {
            setError('Group not found.');
            return; // Stop if group not found
          }
          throw new Error('Failed to fetch group details');
        }
        if (!membersResponse.ok) {
          throw new Error('Failed to fetch members list');
        }

        const groupData: GroupEditData = await groupResponse.json();
        const allMembersData = await membersResponse.json();

        setAllMembers(allMembersData.map((m: any) => ({ id: m.id, name: m.name })));
        
        // Set group name for Custom Columns Manager
        setGroupName(groupData.name);

        // Try to fetch existing custom schema for this group
        try {
          const schemaResponse = await fetch(`/api/groups/${groupId}/custom-schema`);
          if (schemaResponse.ok) {
            const schema = await schemaResponse.json();
            setCurrentCustomSchema(schema);
          }
        } catch (schemaErr) {
          console.warn('Failed to fetch custom schema, will use default');
        }

        // Reset the form with fetched data
        reset({
          name: groupData.name,
          address: groupData.address,
          registrationNumber: groupData.registrationNumber,
          organization: groupData.organization as EditFormValues['organization'], // Cast to the correct type
          leaderId: groupData.leaderId,
          memberCount: groupData.memberCount,
          dateOfStarting: groupData.dateOfStarting ? new Date(groupData.dateOfStarting) : null,
          description: groupData.description,
          
          // Collection settings
          collectionFrequency: groupData.collectionFrequency as EditFormValues['collectionFrequency'],
          collectionDayOfMonth: groupData.collectionDayOfMonth,
          collectionDayOfWeek: groupData.collectionDayOfWeek as EditFormValues['collectionDayOfWeek'],
          collectionWeekOfMonth: groupData.collectionWeekOfMonth,
          collectionMonth: groupData.collectionMonth,
          collectionDate: groupData.collectionDate,
          
          // Banking details
          bankAccountNumber: groupData.bankAccountNumber,
          bankName: groupData.bankName,
          
          // Financial settings
          cashInHand: groupData.cashInHand,
          balanceInBank: groupData.balanceInBank,
          interestRate: groupData.interestRate,
          monthlyContribution: groupData.monthlyContribution,
          // Removed globalShareAmount as requested
          
          // Insurance settings
          loanInsuranceEnabled: groupData.loanInsuranceEnabled || false,
          loanInsurancePercent: groupData.loanInsurancePercent,
          loanInsuranceBalance: groupData.loanInsuranceBalance || null,
          
          // Social fund settings
          groupSocialEnabled: groupData.groupSocialEnabled || false,
          groupSocialAmountPerFamilyMember: groupData.groupSocialAmountPerFamilyMember,
          groupSocialBalance: groupData.groupSocialBalance || null,
          
          // Period tracking
          includeDataTillCurrentPeriod: groupData.includeDataTillCurrentPeriod || false,
          currentPeriodMonth: groupData.currentPeriodMonth || new Date().getMonth() + 1,
          currentPeriodYear: groupData.currentPeriodYear || new Date().getFullYear(),
          
          // Late fine settings - Map from lateFineRules array to lateFineRule object
          lateFineRule: groupData.lateFineRules && groupData.lateFineRules.length > 0 ? (() => {
            const lateFineRule = groupData.lateFineRules[0];
            if (!lateFineRule) {
              return {
                isEnabled: false,
                ruleType: undefined,
                dailyAmount: undefined,
                dailyPercentage: undefined,
                tierRules: undefined,
                tier1StartDay: 1,
                tier1EndDay: 5,
                tier1Amount: undefined,
                tier2StartDay: 6,
                tier2EndDay: 15,
                tier2Amount: undefined,
                tier3StartDay: 16,
                tier3Amount: undefined,
              };
            }
            
            return {
              isEnabled: true, // If there are late fine rules, it's enabled
              ruleType: lateFineRule.ruleType as 'DAILY_FIXED' | 'DAILY_PERCENTAGE' | 'TIER_BASED' | undefined,
              dailyAmount: lateFineRule.dailyAmount,
              dailyPercentage: lateFineRule.dailyPercentage,
              tierRules: lateFineRule.tierRules,
              // Populate tier fields for form editing
              tier1StartDay: lateFineRule.tierRules?.[0]?.startDay || 1,
              tier1EndDay: lateFineRule.tierRules?.[0]?.endDay || 5,
              tier1Amount: lateFineRule.tierRules?.[0]?.amount,
              tier2StartDay: lateFineRule.tierRules?.[1]?.startDay || 6,
              tier2EndDay: lateFineRule.tierRules?.[1]?.endDay || 15,
              tier2Amount: lateFineRule.tierRules?.[1]?.amount,
              tier3StartDay: lateFineRule.tierRules?.[2]?.startDay || 16,
              tier3Amount: lateFineRule.tierRules?.[2]?.amount,
            };
          })() : {
            isEnabled: false,
            ruleType: undefined,
            dailyAmount: undefined,
            dailyPercentage: undefined,
            tierRules: undefined,
            tier1StartDay: 1,
            tier1EndDay: 5,
            tier1Amount: undefined,
            tier2StartDay: 6,
            tier2EndDay: 15,
            tier2Amount: undefined,
            tier3StartDay: 16,
            tier3Amount: undefined,
          },
          
          // Map members data to the form structure
          members: groupData.members.map(member => ({
            id: member.id,
            name: member.name,
            currentLoanAmount: member.currentLoanAmount,
            familyMembersCount: member.familyMembersCount,
          })),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [groupId, reset]); // Add reset to dependency array

  // Custom Columns Manager handlers
  const handleOpenCustomColumns = () => {
    setIsCustomColumnsOpen(true);
  };

  const handleCustomSchemaChange = (schema: GroupCustomSchema) => {
    setCurrentCustomSchema(schema);
  };

  const handleSaveCustomSchema = async (schema: GroupCustomSchema) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/custom-schema`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(schema),
      });

      if (!response.ok) {
        throw new Error('Failed to save custom schema');
      }

      setCurrentCustomSchema(schema);
      setIsCustomColumnsOpen(false);
      setSaveStatus('Custom columns configuration saved successfully!');
    } catch (error) {
      console.error('Error saving custom schema:', error);
      setError('Failed to save custom columns configuration');
    }
  };

  const handleCancelCustomColumns = () => {
    setIsCustomColumnsOpen(false);
  };

  // Handle form submission
  const handleSaveChanges = async (data: EditFormValues) => {
    setIsSaving(true);
    setError(null);
    setSaveStatus(null);

    try {
      // Prepare the data for submission
      const submissionData = {
        ...data,
        dateOfStarting: data.dateOfStarting ? data.dateOfStarting.toISOString() : null,
        // Map members data back to the expected API structure
        members: data.members.map(member => ({
          id: member.id,
          currentLoanAmount: member.currentLoanAmount,
          familyMembersCount: member.familyMembersCount,
        })),
      };

      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to update group info: ${errorData.error || 'Unknown error'}`);
      }

      setSaveStatus('Group and member data updated successfully!');
      // Optionally reset dirty state after successful save
      // reset({}, { keepValues: true }); // Resets dirty state but keeps current values

    } catch (err: any) {
      console.error('Error saving changes:', err);
      setError(err.message || 'An error occurred while saving.');
      setSaveStatus(null);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render Logic ---

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading group data...</p>
      </div>
    );
  }

  if (error && !isLoading) { // Show error only if not loading
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 p-4 rounded-md border border-red-200">
          <p className="text-red-600 font-medium">Error</p>
          <p className="text-red-500 mt-1">{error}</p>
          <Link href="/groups" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Back to Groups List
          </Link>
        </div>
      </div>
    );
  }

  // Check if memberFields are populated (data has been loaded into the form state)
  if (memberFields.length === 0 && !isLoading) {
     // This might indicate the group was found but had no members, or data loading failed silently
     // Let's assume it means no members for now.
  }


  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Group</h1>
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={handleOpenCustomColumns}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
            Advanced Options
          </button>
          <Link href={`/groups/${groupId}`} className="text-sm text-blue-600 hover:underline">
            Cancel and View Group
          </Link>
        </div>
      </div>

      {saveStatus && (
        <div className={`p-4 mb-6 rounded-md border ${error ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          {saveStatus}
          {error && <p className="mt-1 text-sm">{error}</p>}
        </div>
      )}
      {!saveStatus && error && ( // Show general errors if saveStatus isn't set
         <div className="p-4 mb-6 rounded-md border bg-red-50 border-red-200 text-red-800">
           {error}
         </div>
      )}


      <form onSubmit={handleSubmit(handleSaveChanges)} className="space-y-8">
        {/* Section 1: Basic Group Information */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Group Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Group Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                {...register("name")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Address
              </label>
              <input
                type="text"
                id="address"
                {...register("address")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
              />
              {errors.address && (
                <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="registrationNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Registration Number
              </label>
              <input
                type="text"
                id="registrationNumber"
                {...register("registrationNumber")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
              />
              {errors.registrationNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.registrationNumber.message}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="organization" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Organization
              </label>
              <input
                type="text"
                id="organization"
                {...register("organization")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
                placeholder="Enter organization name"
              />
              {errors.organization && (
                <p className="mt-1 text-sm text-red-600">{errors.organization.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="leaderId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Group Leader
              </label>
              <select
                id="leaderId"
                {...register("leaderId")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving || isLoading || allMembers.length === 0}
              >
                <option value="">Select Leader</option>
                {allMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              {errors.leaderId && (
                <p className="mt-1 text-sm text-red-600">{errors.leaderId.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="memberCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Member Count
              </label>
              <input
                type="number"
                id="memberCount"
                {...register("memberCount", { valueAsNumber: true })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
              />
              {errors.memberCount && (
                <p className="mt-1 text-sm text-red-600">{errors.memberCount.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="dateOfStarting" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date of Starting
              </label>
              <Controller
                control={control}
                name="dateOfStarting"
                render={({ field }) => (
                  <DatePicker
                    selected={field.value}
                    onChange={(date) => field.onChange(date)}
                    dateFormat="MMMM d, yyyy"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                    placeholderText="Select date"
                    disabled={isSaving}
                    maxDate={new Date()}
                  />
                )}
              />
              {errors.dateOfStarting && (
                <p className="mt-1 text-sm text-red-600">{errors.dateOfStarting.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="description"
                {...register("description")}
                rows={3}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Collection Settings */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Collection Settings</h2>
          <div className="space-y-6">
            <div>
              <label htmlFor="collectionFrequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Collection Frequency
              </label>
              <select
                id="collectionFrequency"
                {...register("collectionFrequency")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
              >
                <option value="">Select Frequency</option>
                <option value="WEEKLY">Weekly</option>
                <option value="FORTNIGHTLY">Fortnightly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
              {errors.collectionFrequency && (
                <p className="mt-1 text-sm text-red-600">{errors.collectionFrequency.message}</p>
              )}
            </div>

            {/* Conditional Fields based on Collection Frequency */}
            {collectionFrequency === 'WEEKLY' && (
              <div>
                <label htmlFor="collectionDayOfWeek" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Day of Week <span className="text-red-500">*</span>
                </label>
                <select
                  id="collectionDayOfWeek"
                  {...register("collectionDayOfWeek")}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                  disabled={isSaving}
                >
                  <option value="">Select Day</option>
                  <option value="MONDAY">Monday</option>
                  <option value="TUESDAY">Tuesday</option>
                  <option value="WEDNESDAY">Wednesday</option>
                  <option value="THURSDAY">Thursday</option>
                  <option value="FRIDAY">Friday</option>
                  <option value="SATURDAY">Saturday</option>
                  <option value="SUNDAY">Sunday</option>
                </select>
                {errors.collectionDayOfWeek && (
                  <p className="mt-1 text-sm text-red-600">{errors.collectionDayOfWeek.message}</p>
                )}
              </div>
            )}

            {collectionFrequency === 'MONTHLY' && (
              <div>
                <label htmlFor="collectionDayOfMonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Day of Month <span className="text-red-500">*</span>
                </label>
                <select
                  id="collectionDayOfMonth"
                  {...register("collectionDayOfMonth", { valueAsNumber: true })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                  disabled={isSaving}
                >
                  <option value="">Select day of month</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
                {errors.collectionDayOfMonth && (
                  <p className="mt-1 text-sm text-red-600">{errors.collectionDayOfMonth.message}</p>
                )}
              </div>
            )}

            {collectionFrequency === 'FORTNIGHTLY' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="collectionDayOfWeek" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Day of Week <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="collectionDayOfWeek"
                    {...register("collectionDayOfWeek")}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                    disabled={isSaving}
                  >
                    <option value="">Select Day</option>
                    <option value="MONDAY">Monday</option>
                    <option value="TUESDAY">Tuesday</option>
                    <option value="WEDNESDAY">Wednesday</option>
                    <option value="THURSDAY">Thursday</option>
                    <option value="FRIDAY">Friday</option>
                    <option value="SATURDAY">Saturday</option>
                    <option value="SUNDAY">Sunday</option>
                  </select>
                  {errors.collectionDayOfWeek && (
                    <p className="mt-1 text-sm text-red-600">{errors.collectionDayOfWeek.message}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="collectionWeekOfMonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Week Pattern <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="collectionWeekOfMonth"
                    {...register("collectionWeekOfMonth", { valueAsNumber: true })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                    disabled={isSaving}
                  >
                    <option value="">Select Week</option>
                    <option value="1">1st & 3rd weeks</option>
                    <option value="2">2nd & 4th weeks</option>
                  </select>
                  {errors.collectionWeekOfMonth && (
                    <p className="mt-1 text-sm text-red-600">{errors.collectionWeekOfMonth.message}</p>
                  )}
                </div>
              </div>
            )}

            {collectionFrequency === 'YEARLY' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="collectionMonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Collection Month <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="collectionMonth"
                    {...register("collectionMonth", { valueAsNumber: true })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                    disabled={isSaving}
                  >
                    <option value="">Select Month</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <option key={month} value={month}>
                        {new Date(2024, month - 1, 1).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  {errors.collectionMonth && (
                    <p className="mt-1 text-sm text-red-600">{errors.collectionMonth.message}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="collectionDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Collection Date <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="collectionDate"
                    {...register("collectionDate", { valueAsNumber: true })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                    disabled={isSaving}
                  >
                    <option value="">Select Date</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(date => (
                      <option key={date} value={date}>{date}</option>
                    ))}
                  </select>
                  {errors.collectionDate && (
                    <p className="mt-1 text-sm text-red-600">{errors.collectionDate.message}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Banking Details */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Banking Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="bankAccountNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bank Account Number
              </label>
              <input
                type="text"
                id="bankAccountNumber"
                {...register("bankAccountNumber")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
                placeholder="Enter account number"
              />
            </div>

            <div>
              <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                id="bankName"
                {...register("bankName")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
                placeholder="Enter bank name"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Financial Settings */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Financial Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="cashInHand" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cash in Hand (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                id="cashInHand"
                {...register("cashInHand", { valueAsNumber: true })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
                placeholder="0.00"
              />
            </div>

            <div>
              <label htmlFor="balanceInBank" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Balance in Bank (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                id="balanceInBank"
                {...register("balanceInBank", { valueAsNumber: true })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
                placeholder="0.00"
              />
            </div>

            <div>
              <label htmlFor="interestRate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Interest Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                id="interestRate"
                {...register("interestRate", { valueAsNumber: true })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
                placeholder="0.00"
              />
            </div>

            <div>
              <label htmlFor="monthlyContribution" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Monthly Contribution (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                id="monthlyContribution"
                {...register("monthlyContribution", { valueAsNumber: true })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
                placeholder="0.00"
              />
            </div>
            {/* Removed Share Amount Per Member field as requested */}
          </div>
        </div>

        {/* Section 5: Insurance & Social Settings */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Insurance & Social Fund Settings</h2>
          <div className="space-y-6">
            {/* Loan Insurance */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="loanInsuranceEnabled"
                  {...register("loanInsuranceEnabled")}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={isSaving}
                />
                <label htmlFor="loanInsuranceEnabled" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable Loan Insurance
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="loanInsurancePercent" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Insurance Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    id="loanInsurancePercent"
                    {...register("loanInsurancePercent", { valueAsNumber: true })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                    disabled={isSaving}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label htmlFor="loanInsuranceBalance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Insurance Fund Balance (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    id="loanInsuranceBalance"
                    {...register("loanInsuranceBalance", { valueAsNumber: true })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                    disabled={isSaving}
                    placeholder="0.00"
                  />
                  <p className="mt-1 text-xs text-gray-500">Previous balance already collected in this fund</p>
                </div>
              </div>
            </div>

            {/* Group Social Fund */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="groupSocialEnabled"
                  {...register("groupSocialEnabled")}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={isSaving}
                />
                <label htmlFor="groupSocialEnabled" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable Group Social Fund
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="groupSocialAmountPerFamilyMember" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount per Family Member (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    id="groupSocialAmountPerFamilyMember"
                    {...register("groupSocialAmountPerFamilyMember", { valueAsNumber: true })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                    disabled={isSaving}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label htmlFor="groupSocialBalance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Social Fund Balance (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    id="groupSocialBalance"
                    {...register("groupSocialBalance", { valueAsNumber: true })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                    disabled={isSaving}
                    placeholder="0.00"
                  />
                  <p className="mt-1 text-xs text-gray-500">Previous balance already collected in this fund</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5.5: Period Tracking Settings */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Period Tracking Settings</h2>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Important: Data Period Setup
                  </h3>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    <p>Please specify if you are including historical data up to the current period:</p>
                    <ul className="mt-1 list-disc list-inside">
                      <li><strong>If YES:</strong> The system will set the next period as the current tracking period</li>
                      <li><strong>If NO:</strong> The system will use the current month as the tracking period</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="includeDataTillCurrentPeriod"
                  {...register("includeDataTillCurrentPeriod")}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={isSaving}
                />
                <label htmlFor="includeDataTillCurrentPeriod" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Include data till current period (e.g., {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})
                </label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="currentPeriodMonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Period Month
                  </label>
                  <select
                    id="currentPeriodMonth"
                    {...register("currentPeriodMonth", { valueAsNumber: true })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                    disabled={isSaving}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <option key={month} value={month}>
                        {new Date(2024, month - 1, 1).toLocaleDateString('en-US', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="currentPeriodYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Period Year
                  </label>
                  <select
                    id="currentPeriodYear"
                    {...register("currentPeriodYear", { valueAsNumber: true })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                    disabled={isSaving}
                  >
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p className="font-medium mb-2">Period Tracking Logic:</p>
                  <div className="space-y-1">
                    <p>• <strong>Checked:</strong> Historical data included till {currentPeriodMonth ? new Date(2024, currentPeriodMonth - 1, 1).toLocaleDateString('en-US', { month: 'long' }) : 'selected month'} {currentPeriodYear || 'selected year'}</p>
                    <p>• <strong>Tracking starts:</strong> {currentPeriodMonth && currentPeriodYear ? (
                      currentPeriodMonth === 12 ? 
                        `${new Date(2024, 0, 1).toLocaleDateString('en-US', { month: 'long' })} ${currentPeriodYear + 1}` :
                        `${new Date(2024, currentPeriodMonth, 1).toLocaleDateString('en-US', { month: 'long' })} ${currentPeriodYear}`
                    ) : 'Next month'}</p>
                    <p>• <strong>Unchecked:</strong> Tracking starts from current month</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 6: Late Fine Settings */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Late Fine Settings</h2>
          <div className="space-y-4">
            <Controller
              name="lateFineRule.isEnabled"
              control={control}
              render={({ field }) => (
                <>
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id="lateFineEnabled"
                      checked={field.value || false}
                      onChange={(e) => {
                        field.onChange(e.target.checked);
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      disabled={isSaving}
                    />
                    <label htmlFor="lateFineEnabled" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable Late Fine System
                    </label>
                  </div>
                  
                  {/* Show late fine configuration when enabled */}
                  {field.value === true && (
                    <div className="space-y-4 pl-6 border-l-4 border-gray-400 dark:border-gray-500 bg-gray-50 dark:bg-gray-800/50 p-4 rounded shadow-sm">
                      <div className="text-gray-800 dark:text-gray-200 font-medium mb-2">
                        ✅ Late Fine Configuration
                      </div>
                      <Controller
                        name="lateFineRule.ruleType"
                        control={control}
                        render={({ field: ruleTypeField }) => (
                          <>
                            <div>
                              <label htmlFor="lateFineRuleType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Late Fine Rule Type <span className="text-red-500">*</span>
                              </label>
                              <select
                                id="lateFineRuleType"
                                value={ruleTypeField.value || ''}
                                onChange={(e) => ruleTypeField.onChange(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                disabled={isSaving}
                              >
                                <option value="">Select rule type</option>
                                <option value="DAILY_FIXED">Fixed amount per day</option>
                                <option value="DAILY_PERCENTAGE">Percentage of contribution per day</option>
                                <option value="TIER_BASED">Tier-based rules</option>
                              </select>
                              {errors.lateFineRule?.ruleType && <p className="mt-1 text-sm text-red-500">{errors.lateFineRule.ruleType.message}</p>}
                            </div>
                            
                            {ruleTypeField.value === 'DAILY_FIXED' && (
                              <div>
                                <label htmlFor="dailyAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Daily Fine Amount (₹) <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  id="dailyAmount"
                                  {...register("lateFineRule.dailyAmount", { valueAsNumber: true })}
                                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="e.g., 10"
                                  min="0"
                                  step="0.01"
                                  disabled={isSaving}
                                />
                                <p className="mt-1 text-xs text-gray-500">Amount charged per day for late submission</p>
                                {errors.lateFineRule?.dailyAmount && <p className="mt-1 text-sm text-red-500">{errors.lateFineRule.dailyAmount.message}</p>}
                              </div>
                            )}
                            
                            {ruleTypeField.value === 'DAILY_PERCENTAGE' && (
                              <div>
                                <label htmlFor="dailyPercentage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Daily Fine Percentage (%) <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  id="dailyPercentage"
                                  {...register("lateFineRule.dailyPercentage", { valueAsNumber: true })}
                                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="e.g., 1.5"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  disabled={isSaving}
                                />
                                <p className="mt-1 text-xs text-gray-500">Percentage of contribution amount charged per day for late submission</p>
                                {errors.lateFineRule?.dailyPercentage && <p className="mt-1 text-sm text-red-500">{errors.lateFineRule.dailyPercentage.message}</p>}
                              </div>
                            )}
                            
                            {ruleTypeField.value === 'TIER_BASED' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Tier-based Rules <span className="text-red-500">*</span>
                                </label>
                                <div className="space-y-3">
                                  <p className="text-sm text-gray-600 dark:text-gray-400">Define fine amounts for different day ranges:</p>
                                  
                                  {/* Tier 1: Days 1-5 */}
                                  <div className="grid grid-cols-4 gap-2 items-end">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Days</label>
                                      <input
                                        type="number"
                                        {...register("lateFineRule.tier1StartDay", { valueAsNumber: true })}
                                        defaultValue={1}
                                        min="1"
                                        className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        disabled={isSaving}
                                      />
                                    </div>
                                    <div className="text-center text-sm text-gray-500 dark:text-gray-400">to</div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Days</label>
                                      <input
                                        type="number"
                                        {...register("lateFineRule.tier1EndDay", { valueAsNumber: true })}
                                        defaultValue={5}
                                        min="1"
                                        className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        disabled={isSaving}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Amount (₹)</label>
                                      <input
                                        type="number"
                                        {...register("lateFineRule.tier1Amount", { valueAsNumber: true })}
                                        placeholder="10"
                                        min="0"
                                        step="0.01"
                                        className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        disabled={isSaving}
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Tier 2: Days 6-15 */}
                                  <div className="grid grid-cols-4 gap-2 items-end">
                                    <div>
                                      <input
                                        type="number"
                                        {...register("lateFineRule.tier2StartDay", { valueAsNumber: true })}
                                        defaultValue={6}
                                        min="1"
                                        className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        disabled={isSaving}
                                      />
                                    </div>
                                    <div className="text-center text-sm text-gray-500 dark:text-gray-400">to</div>
                                    <div>
                                      <input
                                        type="number"
                                        {...register("lateFineRule.tier2EndDay", { valueAsNumber: true })}
                                        defaultValue={15}
                                        min="1"
                                        className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        disabled={isSaving}
                                      />
                                    </div>
                                    <div>
                                      <input
                                        type="number"
                                        {...register("lateFineRule.tier2Amount", { valueAsNumber: true })}
                                        placeholder="20"
                                        min="0"
                                        step="0.01"
                                        className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        disabled={isSaving}
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Tier 3: Days 16+ */}
                                  <div className="grid grid-cols-4 gap-2 items-end">
                                    <div>
                                      <input
                                        type="number"
                                        {...register("lateFineRule.tier3StartDay", { valueAsNumber: true })}
                                        defaultValue={16}
                                        min="1"
                                        className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        disabled={isSaving}
                                      />
                                    </div>
                                    <div className="text-center text-sm text-gray-500 dark:text-gray-400">+</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">onwards</div>
                                    <div>
                                      <input
                                        type="number"
                                        {...register("lateFineRule.tier3Amount", { valueAsNumber: true })}
                                        placeholder="50"
                                        min="0"
                                        step="0.01"
                                        className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        disabled={isSaving}
                                      />
                                    </div>
                                  </div>
                                  
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    Example: Days 1-5: ₹10/day, Days 6-15: ₹20/day, Days 16+: ₹50/day
                                  </p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      />
                    </div>
                  )}
                </>
              )}
            />
          </div>
        </div>

        {/* Section 7: Member Information */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Member Information</h2>
          {memberFields.length === 0 ? (
             <p className="text-sm text-gray-500">No members found in this group.</p>
          ) : (
            <div className="space-y-4">
              {memberFields.map((member, index) => (
                <div key={member.fieldId} className="border rounded-md p-4 bg-background dark:border-gray-700">
                  <h3 className="font-medium text-foreground mb-3">{member.name}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Current Loan Amount */}
                    <div>
                      <label htmlFor={`members.${index}.currentLoanAmount`} className="block text-xs font-medium text-muted mb-1">Current Loan Amount (₹)</label>
                      <Controller
                        name={`members.${index}.currentLoanAmount`}
                        control={control}
                        render={({ field }) => (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                            className="input-field text-sm"
                            placeholder="0.00"
                            disabled={isSaving}
                          />
                        )}
                      />
                      {errors.members?.[index]?.currentLoanAmount && (
                        <p className="mt-1 text-xs text-red-600">{errors.members[index]?.currentLoanAmount?.message}</p>
                      )}
                    </div>
                    {/* Family Members Count */}
                    <div>
                      <label htmlFor={`members.${index}.familyMembersCount`} className="block text-xs font-medium text-muted mb-1">Family Size</label>
                      <Controller
                        name={`members.${index}.familyMembersCount`}
                        control={control}
                        render={({ field }) => (
                          <input
                            type="number"
                            min="1"
                            {...field}
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value))}
                            className="input-field text-sm"
                            placeholder="1"
                            disabled={isSaving}
                          />
                        )}
                      />
                      {errors.members?.[index]?.familyMembersCount && (
                        <p className="mt-1 text-xs text-red-600">{errors.members[index]?.familyMembersCount?.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <button
            type="submit"
            className="px-6 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSaving || isLoading || !isDirty} // Disable if saving, loading, or no changes made
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Custom Columns Manager Modal */}
      {isCustomColumnsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Advanced Custom Columns & Properties
              </h3>
              <button
                onClick={handleCancelCustomColumns}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
              <CustomColumnsManager
                groupId={groupId}
                groupName={groupName}
                {...(currentCustomSchema && { currentSchema: currentCustomSchema })}
                onSchemaChange={handleCustomSchemaChange}
                onSave={handleSaveCustomSchema}
                onCancel={handleCancelCustomColumns}
                isReadOnly={false}
                className=""
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}