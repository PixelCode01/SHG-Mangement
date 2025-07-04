'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface EditGroupPageProps {
  params: Promise<{ id: string }>;
}

// Define the structure for member data including current fields
interface MemberEditData {
  id: string; // Member's actual ID
  name: string;
  currentShareAmount: number | null;
  currentLoanAmount: number | null;
  initialInterest: number | null;
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
  bankAccountNumber: string | null;
  bankName: string | null;
  members: MemberEditData[]; // Array of members with historical data
  lateFineRules?: Array<{
    id: string;
    isEnabled: boolean;
    ruleType: string;
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
  startDay: z.number().int().min(1, 'Must be at least 1'),
  endDay: z.number().int().min(1, 'Must be at least 1'),
  amount: z.number().nonnegative('Cannot be negative'),
  isPercentage: z.boolean(),
});

// Schema for basic group info update
const groupInfoSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
  address: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  organization: z.string().optional().nullable(),
  leaderId: z.string().min(1, 'Leader selection is required').nullable(), // Leader can be null initially if not set
  memberCount: z.number().int().min(1, 'Must be at least 1').optional().nullable(),
  dateOfStarting: z.date().max(new Date(), 'Date cannot be in the future').nullable(),
  description: z.string().optional().nullable(),
  bankAccountNumber: z.string()
    .refine((val) => !val || /^\d+$/.test(val), 'Bank account number must contain only numeric digits')
    .optional().nullable(),
  bankName: z.string().optional().nullable(),
  isLateFineEnabled: z.boolean().optional(),
  lateFineRuleType: z.enum(["DAILY_FIXED", "DAILY_PERCENTAGE", "TIER_BASED"]).optional().nullable(),
  dailyAmount: z.number().nonnegative('Cannot be negative').optional().nullable(),
  dailyPercentage: z.number().nonnegative('Cannot be negative').max(100, 'Percentage cannot exceed 100%').optional().nullable(),
  tierRules: z.array(lateFineRuleTierSchema).optional().nullable(),
});

// Schema for the entire form including member historical data
const editFormSchema = groupInfoSchema.extend({
  members: z.array(z.object({
    id: z.string(), // Member ID
    name: z.string(), // For display
    currentShareAmount: z.number().nonnegative('Cannot be negative').nullable(),
    currentLoanAmount: z.number().nonnegative('Cannot be negative').nullable(),
    initialInterest: z.number().nonnegative('Cannot be negative').nullable(),
  })),
  lateFineTierRules: z.array(lateFineRuleTierSchema).optional().nullable(),
});

type EditFormValues = z.infer<typeof editFormSchema>;

export default function EditGroupPage({ params }: EditGroupPageProps) {
  const [groupId, setGroupId] = useState<string>('');
  
  // Extract the group ID from params when the component mounts
  useEffect(() => {
    const resolveParams = async () => {
      try {
        const resolvedParams = await params;
        setGroupId(resolvedParams.id);
      } catch (error) {
        console.error('Error resolving params:', error);
        setError('Failed to get group ID from URL');
      }
    };
    
    resolveParams();
  }, [params]);

  const [allMembers, setAllMembers] = useState<{ id: string; name: string }[]>([]); // For leader dropdown
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
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
      bankAccountNumber: null,
      bankName: null,
      members: [],
      isLateFineEnabled: false,
      lateFineRuleType: null,
      dailyAmount: null,
      dailyPercentage: null,
      tierRules: [],
      lateFineTierRules: null,
    },
  });

  // useFieldArray for managing the members array in the form state
  const { fields: memberFields } = useFieldArray({
    control,
    name: "members",
    keyName: "fieldId"
  });
  
  // useFieldArray for managing tier rules
  const { 
    fields: tierFields, 
    append: appendTier, 
    remove: removeTier 
  } = useFieldArray({
    control,
    name: "lateFineTierRules",
    keyName: "fieldId"
  });

  // DEBUG: Watch form values for late fine configuration - MOVED TO TOP
  useEffect(() => {
    const subscription = watch((value, { name, type }) => {
      if (name && name.includes('lateFine')) {
        console.log(`🔍 [DEBUG WATCH] Field "${name}" changed. Type:`, type);
        console.log('🔍 [DEBUG WATCH] Full form value:', value);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  // DEBUG: Monitor late fine related form values - MOVED TO TOP
  const debugIsLateFineEnabled = watch("isLateFineEnabled");
  const debugLateFineRuleType = watch("lateFineRuleType");
  const debugDailyAmount = watch("dailyAmount");
  const debugDailyPercentage = watch("dailyPercentage");
  const debugTierRules = watch("lateFineTierRules");
  
  useEffect(() => {
    console.log('🔍 [DEBUG STATE] Current form values:');
    console.log('  isLateFineEnabled:', debugIsLateFineEnabled);
    console.log('  lateFineRuleType:', debugLateFineRuleType);
    console.log('  dailyAmount:', debugDailyAmount);
    console.log('  dailyPercentage:', debugDailyPercentage);
    console.log('  tierRules count:', debugTierRules?.length || 0);
  }, [debugIsLateFineEnabled, debugLateFineRuleType, debugDailyAmount, debugDailyPercentage, debugTierRules]);
  
  // Fetch initial group data and all members list
  useEffect(() => {
    // Only fetch data when we have a valid groupId
    if (!groupId) return;
    
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
          throw new Error('Failed to fetch members');
        }

        const groupData: GroupEditData = await groupResponse.json();
        const allMembers: { id: string; name: string }[] = await membersResponse.json();

        // DEBUG: Log the raw API response for late fine data
        console.log('🔍 [DEBUG] Raw API response groupData.lateFineRules:', JSON.stringify(groupData.lateFineRules, null, 2));
        
        // Set members list for leader selection
        setAllMembers(allMembers);
        
        // Populate form with existing data
        setValue('name', groupData.name);
        setValue('address', groupData.address || '');
        setValue('registrationNumber', groupData.registrationNumber || '');
        setValue('organization', groupData.organization || '');
        setValue('leaderId', groupData.leaderId);
        setValue('memberCount', groupData.memberCount);
        setValue('dateOfStarting', groupData.dateOfStarting ? new Date(groupData.dateOfStarting) : null);
        setValue('description', groupData.description || '');
        setValue('bankAccountNumber', groupData.bankAccountNumber || '');
        setValue('bankName', groupData.bankName || '');
        
        // Handle late fine configuration with detailed debugging and proper type safety
        const hasLateFineRules = groupData.lateFineRules && groupData.lateFineRules.length > 0;
        console.log('🔍 [DEBUG] hasLateFineRules:', hasLateFineRules);
        
        if (hasLateFineRules && groupData.lateFineRules) {
          // FIX 1: Find the most recent enabled rule instead of just using the first one
          const enabledRules = groupData.lateFineRules.filter(rule => rule.isEnabled);
          const lateFineRule = enabledRules.length > 0 
            ? enabledRules[enabledRules.length - 1] // Use most recent enabled rule
            : groupData.lateFineRules[0]; // Fallback to first rule if none enabled
          
          if (lateFineRule) {
            console.log('🔍 [DEBUG] Selected late fine rule:', JSON.stringify(lateFineRule, null, 2));
            console.log('🔍 [DEBUG] Total rules:', groupData.lateFineRules.length, 'Enabled rules:', enabledRules.length);
            
            const isEnabled = !!lateFineRule.isEnabled;
            console.log('🔍 [DEBUG] isEnabled calculation:', `!!${lateFineRule.isEnabled} = ${isEnabled}`);
            
            const ruleType = lateFineRule.ruleType;
            console.log('🔍 [DEBUG] ruleType:', ruleType);
            
            const dailyAmount = lateFineRule.dailyAmount !== undefined ? lateFineRule.dailyAmount : null;
            console.log('🔍 [DEBUG] dailyAmount:', dailyAmount);
            
            const dailyPercentage = lateFineRule.dailyPercentage !== undefined ? lateFineRule.dailyPercentage : null;
            console.log('🔍 [DEBUG] dailyPercentage:', dailyPercentage);
            
            // Set late fine form values with logging
            setValue('isLateFineEnabled', isEnabled);
            console.log('🔍 [DEBUG] Set isLateFineEnabled to:', isEnabled);
            
            setValue('lateFineRuleType', ruleType as "DAILY_FIXED" | "DAILY_PERCENTAGE" | "TIER_BASED");
            console.log('🔍 [DEBUG] Set lateFineRuleType to:', ruleType);
            
            setValue('dailyAmount', dailyAmount);
            console.log('🔍 [DEBUG] Set dailyAmount to:', dailyAmount);
            
            setValue('dailyPercentage', dailyPercentage);
            console.log('🔍 [DEBUG] Set dailyPercentage to:', dailyPercentage);
            
            // FIX 2: Handle tier rules with explicit validation
            if (ruleType === 'TIER_BASED') {
              console.log('🔍 [DEBUG] Processing TIER_BASED rules. Raw tierRules:', JSON.stringify(lateFineRule.tierRules, null, 2));
              
              // Validate that tierRules exists and has content
              if (lateFineRule.tierRules && lateFineRule.tierRules.length > 0) {
                const tierRulesForForm = lateFineRule.tierRules.map((tier, index) => {
                  console.log(`🔍 [DEBUG] Processing tier ${index + 1}:`, tier);
                  return {
                    startDay: tier.startDay,
                    endDay: tier.endDay,
                    amount: tier.amount,
                    isPercentage: tier.isPercentage
                  };
                });
                
                console.log('🔍 [DEBUG] Mapped tierRulesForForm:', JSON.stringify(tierRulesForForm, null, 2));
                setValue('lateFineTierRules', tierRulesForForm);
                console.log('🔍 [DEBUG] Set lateFineTierRules to form with', tierRulesForForm.length, 'tiers');
              } else {
                console.log('🔍 [DEBUG] ❌ TIER_BASED rule but tierRules is empty or undefined!');
                console.log('🔍 [DEBUG] This is likely the source of the configuration discrepancy');
                setValue('lateFineTierRules', []);
                
                // FIX 3: Optionally disable late fine if tier rules are missing
                console.log('🔍 [DEBUG] ⚠️ Setting isLateFineEnabled to false due to missing tier rules');
                setValue('isLateFineEnabled', false);
              }
            } else {
              console.log('🔍 [DEBUG] Not TIER_BASED rule, setting empty tier rules array');
              setValue('lateFineTierRules', []);
            }
          } else {
            console.log('🔍 [DEBUG] ❌ No valid late fine rule found');
            setValue('isLateFineEnabled', false);
            setValue('lateFineRuleType', null);
            setValue('dailyAmount', null);
            setValue('dailyPercentage', null);
            setValue('lateFineTierRules', []);
          }
        } else {
          console.log('🔍 [DEBUG] No late fine rules found, setting defaults');
          setValue('isLateFineEnabled', false);
          setValue('lateFineRuleType', null);
          setValue('dailyAmount', null);
          setValue('dailyPercentage', null);
          setValue('lateFineTierRules', []);
        }

        // Handle member data mapping
        setValue('members', groupData.members.map(m => ({ // Map members data for the form
          id: m.id,
          name: m.name,
          currentShareAmount: m.currentShareAmount,
          currentLoanAmount: m.currentLoanAmount,
          initialInterest: m.initialInterest,
        })));

        // DEBUG: Log the final form values after population
        console.log('🔍 [DEBUG] Final form values after population:');
        console.log('  isLateFineEnabled:', watch('isLateFineEnabled'));
        console.log('  lateFineRuleType:', watch('lateFineRuleType'));
        console.log('  dailyAmount:', watch('dailyAmount'));
        console.log('  dailyPercentage:', watch('dailyPercentage'));
        console.log('  lateFineTierRules count:', watch('lateFineTierRules')?.length || 0);

      } catch (err: unknown) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [groupId, reset]); // Depend on groupId and reset

  // Check if date is in the past
  const isDateInPast = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  // Handle form submission
  const handleSaveChanges = async (data: EditFormValues) => {
    setIsSaving(true);
    setError(null);
    setSaveStatus(null);
    let memberUpdateCount = 0;
    const memberUpdateErrors: string[] = [];
    let historicalRecordsStatus = '';

    try {
      // 1. Update Group Info
      const groupPayload = {
        name: data.name,
        address: data.address,
        registrationNumber: data.registrationNumber,
        organization: data.organization,
        leaderId: data.leaderId,
        memberCount: data.memberCount,
        dateOfStarting: data.dateOfStarting?.toISOString(),
        description: data.description,
        isLateFineEnabled: data.isLateFineEnabled,
        // Include late fine rule configuration for API update
        lateFineRule: data.isLateFineEnabled ? {
          ruleType: data.lateFineRuleType,
          dailyAmount: data.lateFineRuleType === 'DAILY_FIXED' ? data.dailyAmount : undefined,
          dailyPercentage: data.lateFineRuleType === 'DAILY_PERCENTAGE' ? data.dailyPercentage : undefined,
          // For TIER_BASED rules we need to create proper tier rules
          tierRules: data.lateFineRuleType === 'TIER_BASED' ? 
            // Process and prepare tier rules for API
            data.lateFineTierRules?.map(tier => ({
              startDay: Number(tier.startDay),
              endDay: Number(tier.endDay),
              amount: Number(tier.amount),
              isPercentage: typeof tier.isPercentage === 'boolean' ? 
                tier.isPercentage : 
                tier.isPercentage === 'true' // Handle possible string values from form
            })) : undefined
        } : undefined,
      };

      console.log('🔍 [DEBUG] Sending group update payload:', JSON.stringify(groupPayload, null, 2));

      const groupResponse = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupPayload),
      });

      if (!groupResponse.ok) {
        const errorData = await groupResponse.json();
        console.error('Group update failed:', {
          status: groupResponse.status,
          statusText: groupResponse.statusText,
          errorData: errorData,
          groupPayload: groupPayload
        });
        const errorMessage = errorData.details || errorData.error || 'Unknown error';
        throw new Error(`Failed to update group info: ${errorMessage}`);
      }

      // 2. Update Member Current Data (Iterate through members in the form)
      for (const member of data.members) {
        const memberPayload = {
          currentShareAmount: member.currentShareAmount,
          currentLoanAmount: member.currentLoanAmount,
          initialInterest: member.initialInterest,
        };

        // Only send update if data is present
        if (memberPayload.currentShareAmount !== null || memberPayload.currentLoanAmount !== null || memberPayload.initialInterest !== null) {
            try {
                const memberResponse = await fetch(`/api/groups/${groupId}/members/${member.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(memberPayload),
                });

                if (!memberResponse.ok) {
                    const errorData = await memberResponse.json();
                    memberUpdateErrors.push(`Member ${member.name}: ${errorData.error || 'Update failed'}`);
                } else {
                    memberUpdateCount++;
                }
            } catch (memberErr: unknown) {
                 memberUpdateErrors.push(`Member ${member.name}: ${memberErr instanceof Error ? memberErr.message : 'Network error'}`);
            }
        }
      }

      // 3. Regenerate historical records if date is in the past and there are changes to financial data
      if (isDateInPast(data.dateOfStarting)) {
        try {
          // Get the group's collection frequency first
          const groupDetailsResponse = await fetch(`/api/groups/${groupId}`);
          if (groupDetailsResponse.ok) {
            const groupDetails = await groupDetailsResponse.json();
            const collectionFrequency = groupDetails.collectionFrequency;
            
            if (collectionFrequency) {
              // Fetch existing periodic records to check if we need to regenerate
              const recordsResponse = await fetch(`/api/groups/${groupId}/periodic-records`);
              
              if (recordsResponse.ok) {
                const existingRecords = await recordsResponse.json();
                
                // Only regenerate if we have member updates or there are no existing records
                if (memberUpdateCount > 0 || existingRecords.length === 0) {
                  // Call the API to regenerate historical records
                  const regenerateResponse = await fetch(`/api/groups/${groupId}/regenerate-historical-records`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      dateOfStarting: data.dateOfStarting?.toISOString(),
                      members: data.members.map(m => ({
                        memberId: m.id,
                        currentShareAmount: m.currentShareAmount,
                        currentLoanAmount: m.currentLoanAmount,
                        initialInterest: m.initialInterest,
                      }))
                    }),
                  });
                  
                  if (regenerateResponse.ok) {
                    const result = await regenerateResponse.json();
                    historicalRecordsStatus = ` ${result.recordsCreated || 0} historical records were regenerated.`;
                  }
                }
              }
            }
          }
        } catch (recordErr) {
          console.error('Error regenerating historical records:', recordErr);
          // Don't fail the whole operation if historical record regeneration fails
        }
      }

      // Set status based on results
      let finalStatus = 'Group info updated successfully.';
      if (memberUpdateCount > 0) {
        finalStatus += ` Historical data updated for ${memberUpdateCount} member(s).`;
      }
      if (historicalRecordsStatus) {
        finalStatus += historicalRecordsStatus;
      }
      if (memberUpdateErrors.length > 0) {
        finalStatus += ` Errors occurred for ${memberUpdateErrors.length} member(s).`;
        setError(`Partial success. Member update errors: ${memberUpdateErrors.join('; ')}`);
      }
      setSaveStatus(finalStatus);
      // Optionally reset dirty state after successful save
      // reset({}, { keepValues: true }); // Resets dirty state but keeps current values

    } catch (err: unknown) {
      console.error('Error saving changes:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while saving.');
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
        {groupId ? (
          <Link href={`/groups/${groupId}`} className="text-sm text-blue-600 hover:underline">
            Cancel and View Group
          </Link>
        ) : (
          <Link href="/groups" className="text-sm text-blue-600 hover:underline">
            Back to Groups
          </Link>
        )}
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
            
            <div className="flex flex-col mt-2 space-y-3">
              <div className="flex items-center">
                <label htmlFor="isLateFineEnabled" className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="isLateFineEnabled"
                    {...register("isLateFineEnabled")}
                    className="form-checkbox h-5 w-5 text-blue-600 transition duration-150 ease-in-out cursor-pointer border-gray-300 rounded"
                    disabled={isSaving}
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Enable Late Fine for Compulsory Contributions</span>
                </label>
                <div className="ml-2 group relative">
                  <span className="text-gray-500 cursor-help">ⓘ</span>
                  <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 transform -translate-x-1/2 px-3 py-2 bg-gray-800 text-white text-xs rounded-md w-60 pointer-events-none transition-opacity duration-200 z-10">
                    When enabled, members will be charged late fine for overdue compulsory contributions based on the group&apos;s late fine rules.
                  </div>
                </div>
              </div>
              
              {watch("isLateFineEnabled") && (
                <div className="ml-7 border-l-2 border-gray-200 pl-4 py-2 space-y-4">
                  <div>
                    <label htmlFor="lateFineRuleType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Late Fine Rule Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="lateFineRuleType"
                      {...register("lateFineRuleType")}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                      disabled={isSaving || !watch("isLateFineEnabled")}
                    >
                      <option value="">Select Rule Type</option>
                      <option value="DAILY_FIXED">Daily Fixed Amount</option>
                      <option value="DAILY_PERCENTAGE">Daily Percentage Rate</option>
                      <option value="TIER_BASED">Tier Based</option>
                    </select>
                    {errors.lateFineRuleType && (
                      <p className="mt-1 text-sm text-red-600">{errors.lateFineRuleType.message}</p>
                    )}
                  </div>
                  
                  {watch("lateFineRuleType") === "DAILY_FIXED" && (
                    <div>
                      <label htmlFor="dailyAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Daily Amount (₹) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        id="dailyAmount"
                        {...register("dailyAmount", { valueAsNumber: true })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                        disabled={isSaving}
                        min="0"
                        placeholder="e.g., 10"
                      />
                      {errors.dailyAmount && (
                        <p className="mt-1 text-sm text-red-600">{errors.dailyAmount.message}</p>
                      )}
                    </div>
                  )}
                  
                  {watch("lateFineRuleType") === "DAILY_PERCENTAGE" && (
                    <div>
                      <label htmlFor="dailyPercentage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Daily Percentage (%) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        id="dailyPercentage"
                        {...register("dailyPercentage", { valueAsNumber: true })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                        disabled={isSaving}
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="e.g., 1"
                      />
                      {errors.dailyPercentage && (
                        <p className="mt-1 text-sm text-red-600">{errors.dailyPercentage.message}</p>
                      )}
                    </div>
                  )}
                  
                  {watch("lateFineRuleType") === "TIER_BASED" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tier-Based Rules
                        <span className="ml-1 text-xs text-gray-500">(Define different rates for different time periods)</span>
                      </label>
                      
                      <div className="border rounded-md p-4 bg-gray-50 dark:bg-gray-800 mb-3">
                        <div className="grid grid-cols-5 gap-2 mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                          <div className="col-span-1">Start Day</div>
                          <div className="col-span-1">End Day</div>
                          <div className="col-span-1">Amount</div>
                          <div className="col-span-1">Type</div>
                          <div className="col-span-1"></div>
                        </div>
                        
                        {tierFields.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 py-2">No tier rules defined.</p>
                        ) : (
                          <div className="space-y-2">
                            {tierFields.map((field, index) => (
                              <div key={field.fieldId} className="grid grid-cols-5 gap-2 items-center">
                                <div className="col-span-1">
                                  <input 
                                    type="number"
                                    {...register(`lateFineTierRules.${index}.startDay` as const, { 
                                      valueAsNumber: true,
                                      min: 1
                                    })}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded"
                                    min="1"
                                    disabled={isSaving}
                                  />
                                  {errors.lateFineTierRules?.[index]?.startDay && (
                                    <p className="text-xs text-red-600">{errors.lateFineTierRules[index]?.startDay?.message}</p>
                                  )}
                                </div>
                                <div className="col-span-1">
                                  <input 
                                    type="number"
                                    {...register(`lateFineTierRules.${index}.endDay` as const, { 
                                      valueAsNumber: true,
                                      min: field.startDay || 1
                                    })}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded"
                                    min={field.startDay || 1}
                                    disabled={isSaving}
                                  />
                                  {errors.lateFineTierRules?.[index]?.endDay && (
                                    <p className="text-xs text-red-600">{errors.lateFineTierRules[index]?.endDay?.message}</p>
                                  )}
                                </div>
                                <div className="col-span-1">
                                  <input 
                                    type="number"
                                    step="0.01"
                                    {...register(`lateFineTierRules.${index}.amount` as const, { 
                                      valueAsNumber: true,
                                      min: 0
                                    })}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded"
                                    min="0"
                                    disabled={isSaving}
                                  />
                                  {errors.lateFineTierRules?.[index]?.amount && (
                                    <p className="text-xs text-red-600">{errors.lateFineTierRules[index]?.amount?.message}</p>
                                  )}
                                </div>
                                <div className="col-span-1">
                                  <Controller
                                    name={`lateFineTierRules.${index}.isPercentage`}
                                    control={control}
                                    render={({ field }) => (
                                      <select
                                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded"
                                        disabled={isSaving}
                                        onChange={e => field.onChange(e.target.value === 'true')}
                                        value={field.value ? 'true' : 'false'}
                                      >
                                        <option value="false">Fixed</option>
                                        <option value="true">Percentage</option>
                                      </select>
                                    )}
                                  />
                                </div>
                                <div className="col-span-1 text-right">
                                  <button
                                    type="button"
                                    onClick={() => removeTier(index)}
                                    className="text-red-500 hover:text-red-700 focus:outline-none"
                                    disabled={isSaving}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => {
                            const lastTier = tierFields.length > 0 ? tierFields[tierFields.length - 1] : null;
                            const startDay = lastTier ? Number(lastTier.endDay || 0) + 1 : 1;
                            const endDay = startDay + 6; // Default to a 7 day period
                            
                            appendTier({ 
                              startDay,
                              endDay,
                              amount: 10, 
                              isPercentage: false 
                            });
                          }}
                          className="mt-3 px-3 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isSaving}
                        >
                          Add Tier
                        </button>
                      </div>
                      
                      <div className="bg-yellow-50 border border-yellow-200 p-2 rounded text-xs text-yellow-800">
                        <p><strong>How tier rules work:</strong></p>
                        <ul className="list-disc pl-4 mt-1 space-y-1">
                          <li>Each tier defines a date range (start day to end day) and a charge rate</li>
                          <li>For fixed amounts: the daily charge in rupees</li>
                          <li>For percentages: the daily percentage of the contribution amount</li>
                          <li>Tiers should not overlap and should cover all days</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Address <span className="text-gray-500 text-xs">(Optional)</span>
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
                Registration Number <span className="text-gray-500 text-xs">(Optional)</span>
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
                Organization <span className="text-gray-500 text-xs">(Optional)</span>
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
                Member Count <span className="text-gray-500 text-xs">(Optional)</span>
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
                Date of Starting <span className="text-gray-500 text-xs">(Optional)</span>
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
                Description <span className="text-gray-500 text-xs">(Optional)</span>
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

            <div>
              <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bank Name <span className="text-gray-500 text-xs">(Optional)</span>
              </label>
              <input
                type="text"
                id="bankName"
                {...register("bankName")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
                placeholder="Enter bank name"
              />
              {errors.bankName && (
                <p className="mt-1 text-sm text-red-600">{errors.bankName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="bankAccountNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bank Account Number <span className="text-gray-500 text-xs">(Optional)</span>
              </label>
              <input
                type="number"
                id="bankAccountNumber"
                {...register("bankAccountNumber")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
                disabled={isSaving}
                placeholder="Enter numeric account number"
                pattern="[0-9]*"
                inputMode="numeric"
              />
              {errors.bankAccountNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.bankAccountNumber.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Member Historical Data - HIDDEN */}
        {false && (
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Member Historical Data</h2>
          {memberFields.length === 0 ? (
             <p className="text-sm text-gray-500">No members found in this group.</p>
          ) : (
            <div className="space-y-4">
              {memberFields.map((member, index) => (
                <div key={member.fieldId} className="border rounded-md p-4 bg-background dark:border-gray-700">
                  <h3 className="font-medium text-foreground mb-3">{member.name}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Current Share Amount */}
                    <div>
                      <label htmlFor={`members.${index}.currentShareAmount`} className="block text-xs font-medium text-muted mb-1">Current Share Amt</label>
                      <Controller
                        name={`members.${index}.currentShareAmount`}
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
                      {errors.members?.[index]?.currentShareAmount && (
                        <p className="mt-1 text-xs text-red-600">{errors.members[index]?.currentShareAmount?.message}</p>
                      )}
                    </div>
                    {/* Current Loan Amount */}
                    <div>
                      <label htmlFor={`members.${index}.currentLoanAmount`} className="block text-xs font-medium text-muted mb-1">Current Loan Amt</label>
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
                    {/* Interest */}
                    <div>
                      <label htmlFor={`members.${index}.initialInterest`} className="block text-xs font-medium text-muted mb-1">Interest Paid</label>
                      <Controller
                        name={`members.${index}.initialInterest`}
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
                      {errors.members?.[index]?.initialInterest && (
                        <p className="mt-1 text-xs text-red-600">{errors.members[index]?.initialInterest?.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Section 3: Late Fine Tier Rules - HIDDEN */}
        {false && (
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Late Fine Tier Rules</h2>
          <div className="space-y-4">
            {tierFields.map((tier, index) => (
              <div key={tier.fieldId} className="border rounded-md p-4 bg-background dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor={`lateFineTierRules.${index}.startDay`} className="block text-xs font-medium text-muted mb-1">Start Day</label>
                    <Controller
                      name={`lateFineTierRules.${index}.startDay`}
                      control={control}
                      render={({ field }) => (
                        <input
                          type="number"
                          {...field}
                          className="input-field text-sm"
                          placeholder="1"
                          disabled={isSaving}
                        />
                      )}
                    />
                    {errors.lateFineTierRules?.[index]?.startDay && (
                      <p className="mt-1 text-xs text-red-600">{errors.lateFineTierRules[index]?.startDay?.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor={`lateFineTierRules.${index}.endDay`} className="block text-xs font-medium text-muted mb-1">End Day</label>
                    <Controller
                      name={`lateFineTierRules.${index}.endDay`}
                      control={control}
                      render={({ field }) => (
                        <input
                          type="number"
                          {...field}
                          className="input-field text-sm"
                          placeholder="30"
                          disabled={isSaving}
                        />
                      )}
                    />
                    {errors.lateFineTierRules?.[index]?.endDay && (
                      <p className="mt-1 text-xs text-red-600">{errors.lateFineTierRules[index]?.endDay?.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor={`lateFineTierRules.${index}.amount`} className="block text-xs font-medium text-muted mb-1">Amount</label>
                    <Controller
                      name={`lateFineTierRules.${index}.amount`}
                      control={control}
                      render={({ field }) => (
                        <input
                          type="number"
                          {...field}
                          className="input-field text-sm"
                          placeholder="0.00"
                          disabled={isSaving}
                        />
                      )}
                    />
                    {errors.lateFineTierRules?.[index]?.amount && (
                      <p className="mt-1 text-xs text-red-600">{errors.lateFineTierRules[index]?.amount?.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor={`lateFineTierRules.${index}.isPercentage`} className="block text-xs font-medium text-muted mb-1">Is Percentage</label>
                    <Controller
                      name={`lateFineTierRules.${index}.isPercentage`}
                      control={control}
                      render={({ field: { onChange, value, ...field } }) => (
                        <input
                          type="checkbox"
                          {...field}
                          checked={value}
                          onChange={(e) => onChange(e.target.checked)}
                          className="form-checkbox h-5 w-5 text-blue-600 transition duration-150 ease-in-out cursor-pointer border-gray-300 rounded"
                          disabled={isSaving}
                        />
                      )}
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    type="button"
                    onClick={() => removeTier(index)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove Tier
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={() => appendTier({ startDay: 1, endDay: 30, amount: 0, isPercentage: false })}
              className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Tier
            </button>
          </div>
        </div>
        )}

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
    </div>
  );
}