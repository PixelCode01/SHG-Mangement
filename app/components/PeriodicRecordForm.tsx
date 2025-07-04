'use client';

import React, { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CollectionFrequency } from '@prisma/client';
import { calculatePeriodInterest } from '@/app/lib/interest-utils';
import { roundToTwoDecimals } from '@/app/lib/currency-utils';

// Define enums for collection schedule
const dayOfWeekEnum = z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]);
const lateFineRuleTypeEnum = z.enum(["DAILY_FIXED", "DAILY_PERCENTAGE", "TIER_BASED"]);

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
  ruleType: lateFineRuleTypeEnum.optional(),
  dailyAmount: z.number().nonnegative().optional(),
  dailyPercentage: z.number().nonnegative().max(100).optional(),
  tierRules: z.array(lateFineRuleTierSchema).optional(),
}).optional();

// Define Zod schemas
const groupMemberPeriodicRecordSchema = z.object({
  memberId: z.string(),
  memberName: z.string(), // For display
  memberCurrentLoanBalance: z.coerce.number().nonnegative('Cannot be negative'), // Editable current loan balance
  compulsoryContribution: z.coerce.number().nonnegative('Cannot be negative'),
  loanRepaymentPrincipal: z.coerce.number().nonnegative('Cannot be negative'),
  lateFinePaid: z.coerce.number().nonnegative('Cannot be negative'),
});

const periodicRecordFormSchema = z.object({
  meetingDate: z.date({ required_error: 'Meeting date is required' }),
  recordSequenceNumber: z.coerce.number().int().positive('Must be a positive number'),
  standingAtStartOfPeriod: z.number().nonnegative('Cannot be negative'),
  cashInBankAtEndOfPeriod: z.coerce.number().nonnegative('Cannot be negative'),
  cashInHandAtEndOfPeriod: z.coerce.number().nonnegative('Cannot be negative'),
  expensesThisPeriod: z.coerce.number().nonnegative('Cannot be negative'),
  loanProcessingFeesCollectedThisPeriod: z.coerce.number().nonnegative('Cannot be negative'),
  newMembersJoinedThisPeriod: z.coerce.number().int().nonnegative('Cannot be negative'),
  memberRecords: z.array(groupMemberPeriodicRecordSchema).min(1, 'At least one member record is required'),

  // interestEarnedThisPeriod is now automatically calculated based on members' loan balances and group interest rate
  interestEarnedThisPeriod: z.coerce.number().nonnegative('Cannot be negative'),
  sharePerMemberThisPeriod: z.number().nonnegative(), // Auto-calculated: group standing / member count
  newContributionsThisPeriod: z.number().nonnegative(), // Auto-calculated
  lateFinesCollectedThisPeriod: z.number().nonnegative(), // Auto-calculated
  totalCollectionThisPeriod: z.number().nonnegative(), // Auto-calculated
  totalGroupStandingAtEndOfPeriod: z.number().nonnegative(), // Auto-calculated
  
  // Next collection schedule fields (conditional based on group frequency)
  nextCollectionDayOfMonth: z.number().int().min(1).max(31).optional(),
  nextCollectionDayOfWeek: dayOfWeekEnum.optional(),
  nextCollectionWeekOfMonth: z.number().int().min(1).max(4).optional(),
  nextCollectionMonth: z.number().int().min(1).max(12).optional(),
  nextCollectionDate: z.number().int().min(1).max(31).optional(),
  
  // Late fine configuration for this period
  lateFineRule: lateFineRuleSchema.optional(),
});
// Note: Validation based on groupFrequency prop is handled in component logic, not here

export type PeriodicRecordFormValues = z.infer<typeof periodicRecordFormSchema>;

interface PeriodicRecordFormProps {
  groupId: string;
  groupName: string;
  groupFrequency: CollectionFrequency;
  members: { id: string; name: string }[];
  onSubmit: (data: PeriodicRecordFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  recordToEdit?: Partial<PeriodicRecordFormValues>; // For editing
  latestRecord?: { // For pre-filling
    totalGroupStandingAtEndOfPeriod?: number | null,
    recordSequenceNumber?: number | null,
    meetingDate?: Date | string | null,
    cashInBankAtEndOfPeriod?: number | null,
    cashInHandAtEndOfPeriod?: number | null,
  };
  // Group initialization data for new records
  groupInitData?: {
    totalGroupStanding?: number;
    cashInBank?: number;
    cashInHand?: number;
    monthlyContribution?: number;
    interestRate?: number; // Annual percentage
    collectionFrequency?: CollectionFrequency;
    members?: {
      id: string;
      name: string;
      currentLoanBalance?: number;
    }[];
  };
}

export default function PeriodicRecordForm({
  groupId,
  groupName,
  groupFrequency,
  members,
  onSubmit,
  onCancel,
  isLoading,
  recordToEdit,
  latestRecord,
  groupInitData,
}: PeriodicRecordFormProps) {
  const isEditing = !!recordToEdit;
  
  // Loan management state
  const [showLoanManagement, setShowLoanManagement] = useState(false);
  const [currentInterestRate, setCurrentInterestRate] = useState(groupInitData?.interestRate || 0);
  const [memberLoans, setMemberLoans] = useState<{[memberId: string]: {currentBalance: number, originalAmount: number, loanId?: string}}>({});
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);

  // Cash allocation state
  const [autoAllocateCash, setAutoAllocateCash] = useState(false);

  // Bulk contribution update state
  const [bulkContributionAmount, setBulkContributionAmount] = useState<number>(0);
  const [showBulkContributionUpdate, setShowBulkContributionUpdate] = useState(false);

  // Load current loan data when component mounts
  useEffect(() => {
    const loadMemberLoans = async () => {
      if (!groupId) return;
      
      setIsLoadingLoans(true);
      try {
        // First, try to get loans from the Loan table
        const response = await fetch(`/api/groups/${groupId}/loans`);
        const loansByMember: {[memberId: string]: {currentBalance: number, originalAmount: number, loanId?: string}} = {};
        
        if (response.ok) {
          const loans = await response.json();
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          loans.forEach((loan: any) => { // Loan API response structure varies
            if (loan.status === 'ACTIVE') {
              loansByMember[loan.memberId] = {
                currentBalance: loan.currentBalance || 0,
                originalAmount: loan.originalAmount || 0,
                loanId: loan.id
              };
            }
          });
        }
        
        // If no loans found in Loan table but we have groupInitData, use that
        if (Object.keys(loansByMember).length === 0 && groupInitData?.members) {
          groupInitData.members.forEach(member => {
            if (member.currentLoanBalance && member.currentLoanBalance > 0) {
              loansByMember[member.id] = {
                currentBalance: member.currentLoanBalance,
                originalAmount: member.currentLoanBalance, // Assume original = current if no other data
              };
            }
          });
        }
        
        setMemberLoans(loansByMember);
      } catch (error) {
        console.error('Error loading loans:', error);
        
        // If API fails but we have groupInitData, use that as fallback
        if (groupInitData?.members) {
          const loansByMemberFromInit: {[memberId: string]: {currentBalance: number, originalAmount: number}} = {};
          
          groupInitData.members.forEach(member => {
            if (member.currentLoanBalance && member.currentLoanBalance > 0) {
              loansByMemberFromInit[member.id] = {
                currentBalance: member.currentLoanBalance,
                originalAmount: member.currentLoanBalance, // Assume original = current if no other data
              };
            }
          });
          
          setMemberLoans(loansByMemberFromInit);
        }
      } finally {
        setIsLoadingLoans(false);
      }
    };

    loadMemberLoans();
  }, [groupId, groupInitData?.members]);

  // Save loan changes to backend
  const saveLoanChanges = useCallback(async (memberId: string, newAmount: number) => {
    const memberLoan = memberLoans[memberId];
    if (!memberLoan) return false;
    
    try {
      let response;
      
      // If we have a loanId, update the Loan table
      if (memberLoan.loanId) {
        response = await fetch(`/api/groups/${groupId}/loans/${memberLoan.loanId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentBalance: newAmount,
            originalAmount: memberLoan.originalAmount
          })
        });
      } else {
        // If no loanId, update the membership currentLoanAmount
        response = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentLoanAmount: newAmount
          })
        });
      }
      
      if (response.ok) {
        setMemberLoans(prev => {
          const existingLoan = prev[memberId];
          const updatedLoan: { currentBalance: number; originalAmount: number; loanId?: string } = {
            currentBalance: newAmount,
            originalAmount: existingLoan?.originalAmount || 0
          };
          
          // Only include loanId if it exists and is not undefined
          if (existingLoan?.loanId) {
            updatedLoan.loanId = existingLoan.loanId;
          }
          
          return {
            ...prev,
            [memberId]: updatedLoan
          };
        });
        return true;
      } else {
        console.error('Failed to save loan changes:', await response.text());
      }
    } catch (error) {
      console.error('Error saving loan changes:', error);
    }
    return false;
  }, [groupId, memberLoans]);

  // Apply interest rate to all members
  const applyInterestRateToAll = useCallback(async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/loans/bulk-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interestRate: currentInterestRate,
          updateAllLoans: true
        })
      });
      
      if (response.ok) {
        alert(`Interest rate of ${currentInterestRate}% applied to all member loans`);
      } else {
        alert('Failed to update interest rate');
      }
    } catch (error) {
      console.error('Error updating interest rate:', error);
      alert('Error updating interest rate');
    }
  }, [groupId, currentInterestRate]);

  const getFrequencyLabel = (frequency: CollectionFrequency): string => {
    switch (frequency) {
      case 'WEEKLY': return 'Weekly';
      case 'FORTNIGHTLY': return 'Fortnightly';
      case 'MONTHLY': return 'Monthly';
      case 'YEARLY': return 'Yearly';
      default: return 'Periodic';
    }
  };

  const frequencyLabel = getFrequencyLabel(groupFrequency);

  // Calculate total loan amount for interest calculation and display
  const totalLoanAmount = useMemo(() => {
    // Check if we have valid members data with loan balances
    if (!groupInitData?.members?.length) {
      return 0;
    }
    
    // Sum up all current loan balances from members, safely
    const total = groupInitData.members.reduce((sum: number, member: { id: string; name: string; currentLoanBalance?: number }) => {
      const loanBalance = typeof member.currentLoanBalance === 'number' ? member.currentLoanBalance : 0;
      return sum + loanBalance;
    }, 0);
    
    return total;
  }, [groupInitData?.members]);

  const defaultMemberRecords = useMemo(() => {
    // Use the monthly contribution from group if available
    const defaultContribution = groupInitData?.monthlyContribution || 0;
    
    return (members || []).map(member => {
      // Find loan balance for this member from groupInitData
      const memberInitData = groupInitData?.members?.find(m => m.id === member.id);
      
      return {
        memberId: member.id,
        memberName: member.name,
        memberCurrentLoanBalance: memberInitData?.currentLoanBalance || 0,
        compulsoryContribution: defaultContribution,
        loanRepaymentPrincipal: 0,
        lateFinePaid: 0,
      };
    });
  }, [members, groupInitData?.monthlyContribution, groupInitData?.members]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<PeriodicRecordFormValues>({
    resolver: zodResolver(periodicRecordFormSchema),
    defaultValues: {
      meetingDate: new Date(),
      recordSequenceNumber: 1,
      standingAtStartOfPeriod: 0,
      cashInBankAtEndOfPeriod: 0,
      cashInHandAtEndOfPeriod: 0,
      expensesThisPeriod: 0,
      loanProcessingFeesCollectedThisPeriod: 0,
      newMembersJoinedThisPeriod: 0,
      interestEarnedThisPeriod: 0,
      sharePerMemberThisPeriod: 0, // Auto-calculated
      memberRecords: defaultMemberRecords,
      newContributionsThisPeriod: 0,
      lateFinesCollectedThisPeriod: 0,
      totalCollectionThisPeriod: 0,
      totalGroupStandingAtEndOfPeriod: 0,
      // Default values for new fields
      nextCollectionDayOfMonth: undefined,
      nextCollectionDayOfWeek: undefined,
      nextCollectionWeekOfMonth: undefined,
      nextCollectionMonth: undefined,
      nextCollectionDate: undefined,
      lateFineRule: {
        isEnabled: false,
        ruleType: undefined,
        dailyAmount: undefined,
        dailyPercentage: undefined,
        tierRules: [],
      },
    },
  });

  // Watch form values for conditional rendering
  // Note: late fine related watches removed as they're not currently used
  
  const { fields } = useFieldArray({
    control,
    name: 'memberRecords',
  });

  // Helper function to calculate interest earned this period
  const calculateInterestEarned = useCallback((
    totalLoanAmount: number, 
    annualInterestRate: number, 
    frequency: CollectionFrequency
  ): number => {
    return roundToTwoDecimals(calculatePeriodInterest(totalLoanAmount, annualInterestRate, frequency));
  }, []);

  // Recalculate interest when loan balances or interest rate changes
  const recalculateInterest = useCallback(() => {
    if (!currentInterestRate) return;
    
    // Use form data first, fallback to memberLoans state
    const memberRecordsData = watch('memberRecords');
    let totalCurrentLoanBalance = 0;
    
    if (memberRecordsData && memberRecordsData.length > 0) {
      // Calculate from current form values
      totalCurrentLoanBalance = memberRecordsData.reduce((sum, record) => {
        const loanBalance = typeof record.memberCurrentLoanBalance === 'number' ? record.memberCurrentLoanBalance : 0;
        return sum + loanBalance;
      }, 0);
    } else if (Object.keys(memberLoans).length > 0) {
      // Fallback to memberLoans state
      totalCurrentLoanBalance = Object.values(memberLoans).reduce(
        (sum, loan) => sum + loan.currentBalance, 
        0
      );
    }
    
    const newInterestEarned = calculateInterestEarned(
      totalCurrentLoanBalance,
      currentInterestRate,
      groupFrequency
    );
    
    setValue('interestEarnedThisPeriod', newInterestEarned);
  }, [currentInterestRate, memberLoans, calculateInterestEarned, groupFrequency, setValue, watch]);

  // Update interest calculation when loan balances or interest rate changes
  useEffect(() => {
    recalculateInterest();
  }, [recalculateInterest]);

  // Enhanced update loan balance function
  const updateLoanBalance = useCallback((memberId: string, repaymentAmount: number) => {
    setMemberLoans(prev => {
      if (!prev[memberId]) return prev;
      
      const newBalance = Math.max(0, prev[memberId].currentBalance - repaymentAmount);
      const updated = {
        ...prev,
        [memberId]: {
          ...prev[memberId],
          currentBalance: newBalance
        }
      };
      
      // Recalculate interest with new balances
      setTimeout(() => recalculateInterest(), 0);
      
      return updated;
    });
  }, [recalculateInterest]);

  const memberRecordsWatch = watch('memberRecords');
  const standingAtStartWatch = watch('standingAtStartOfPeriod');
  const expensesThisPeriodWatch = watch('expensesThisPeriod');
  const loanProcessingFeesCollectedWatch = watch('loanProcessingFeesCollectedThisPeriod');
  const interestEarnedThisPeriodWatch = watch('interestEarnedThisPeriod');
  // const totalGroupStandingWatch = watch('totalGroupStandingAtEndOfPeriod');
  
  // Watch cash allocation fields
  const cashInBankWatch = watch('cashInBankAtEndOfPeriod');
  const cashInHandWatch = watch('cashInHandAtEndOfPeriod');
  const totalCollectionWatch = watch('totalCollectionThisPeriod');

  useEffect(() => {
    // Run only once on mount to initialize form values
    if (isEditing && recordToEdit) {
      const editValues: PeriodicRecordFormValues = {
        meetingDate: recordToEdit.meetingDate ? new Date(recordToEdit.meetingDate) : new Date(),
        recordSequenceNumber: recordToEdit.recordSequenceNumber ?? (latestRecord?.recordSequenceNumber ? latestRecord.recordSequenceNumber + 1 : 1),
        standingAtStartOfPeriod: recordToEdit.standingAtStartOfPeriod ?? latestRecord?.totalGroupStandingAtEndOfPeriod ?? 0,
        cashInBankAtEndOfPeriod: recordToEdit.cashInBankAtEndOfPeriod ?? 0,
        cashInHandAtEndOfPeriod: recordToEdit.cashInHandAtEndOfPeriod ?? 0,
        expensesThisPeriod: recordToEdit.expensesThisPeriod ?? 0,
        loanProcessingFeesCollectedThisPeriod: recordToEdit.loanProcessingFeesCollectedThisPeriod ?? 0,
        newMembersJoinedThisPeriod: recordToEdit.newMembersJoinedThisPeriod ?? 0,
        interestEarnedThisPeriod: recordToEdit.interestEarnedThisPeriod ?? 0,
        sharePerMemberThisPeriod: 0, // Will be auto-calculated
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        memberRecords: recordToEdit.memberRecords?.map((mr: any) => ({ // Member record structure varies
          memberId: String(mr.memberId),
          memberName: String(mr.memberName),
          memberCurrentLoanBalance: mr.memberCurrentLoanBalance ?? 0,
          compulsoryContribution: mr.compulsoryContribution ?? 0,
          loanRepaymentPrincipal: mr.loanRepaymentPrincipal ?? 0,
          lateFinePaid: mr.lateFinePaid ?? 0,
        })) ?? defaultMemberRecords,
        newContributionsThisPeriod: recordToEdit.newContributionsThisPeriod ?? 0,
        lateFinesCollectedThisPeriod: recordToEdit.lateFinesCollectedThisPeriod ?? 0,
        totalCollectionThisPeriod: recordToEdit.totalCollectionThisPeriod ?? 0,
        totalGroupStandingAtEndOfPeriod: recordToEdit.totalGroupStandingAtEndOfPeriod ?? 0,
      };
      reset(editValues);
    } else if (!isEditing) {
      // For new records, use group initialization data if available
      const isFirstRecord = !latestRecord?.totalGroupStandingAtEndOfPeriod;
      
      // Calculate interest earned this period if group init data is available
      let calculatedInterestEarned = 0;
      const hasInterestRate = typeof groupInitData?.interestRate === 'number' && groupInitData.interestRate > 0;
      const hasLoans = totalLoanAmount > 0;
      
      if (hasInterestRate && hasLoans) {
        // We've already checked that interestRate is a number above
        const interestRate = groupInitData?.interestRate as number;
        calculatedInterestEarned = calculateInterestEarned(
          totalLoanAmount, 
          interestRate, 
          groupFrequency
        );
      }
      
      // For new records, compute the starting values from group data
      let initialStanding;
      if (isFirstRecord && groupInitData?.totalGroupStanding) {
        // For the very first record, use the total group standing which includes cash + loans
        initialStanding = groupInitData.totalGroupStanding;
      } else {
        // For subsequent records, use the previous record's ending balance
        initialStanding = latestRecord?.totalGroupStandingAtEndOfPeriod ?? 0;
      }
        
      const initialCashInBank = isFirstRecord && groupInitData?.cashInBank !== undefined 
        ? groupInitData.cashInBank 
        : 0;
        
      const initialCashInHand = isFirstRecord && groupInitData?.cashInHand !== undefined 
        ? groupInitData.cashInHand 
        : 0;
        
      // Initialize with appropriate values from the group
      const newRecordDefaults: PeriodicRecordFormValues = {
        meetingDate: new Date(),
        recordSequenceNumber: latestRecord?.recordSequenceNumber ? latestRecord.recordSequenceNumber + 1 : 1,
        standingAtStartOfPeriod: initialStanding,
        cashInBankAtEndOfPeriod: initialCashInBank,
        cashInHandAtEndOfPeriod: initialCashInHand,
        expensesThisPeriod: 0,
        loanProcessingFeesCollectedThisPeriod: 0,
        newMembersJoinedThisPeriod: 0,
        interestEarnedThisPeriod: calculatedInterestEarned,
        sharePerMemberThisPeriod: 0, // Will be auto-calculated
        memberRecords: defaultMemberRecords, // Already initialized with compulsory contribution
        newContributionsThisPeriod: 0,
        lateFinesCollectedThisPeriod: 0,
        totalCollectionThisPeriod: 0,
        totalGroupStandingAtEndOfPeriod: 0,
      };
      
      console.log("Using defaults for new record:", {
        isFirstRecord,
        initialStanding,
        initialCashInBank,
        initialCashInHand,
        calculatedInterest: calculatedInterestEarned,
        monthlyContribution: groupInitData?.monthlyContribution,
        totalLoanAmount,
        totalGroupStanding: groupInitData?.totalGroupStanding
      });
      reset(newRecordDefaults);
      
      // Force recalculation after reset to ensure values are properly initialized
      setTimeout(() => {
        const defaultContributions = roundToTwoDecimals(defaultMemberRecords.reduce((sum, record) => sum + Number(record.compulsoryContribution || 0), 0));
        const totalCollection = roundToTwoDecimals(defaultContributions + calculatedInterestEarned);
        const totalStandingEnd = roundToTwoDecimals(initialStanding + totalCollection);
        
        setValue('newContributionsThisPeriod', defaultContributions, { shouldValidate: false });
        setValue('totalCollectionThisPeriod', totalCollection, { shouldValidate: false });
        setValue('totalGroupStandingAtEndOfPeriod', totalStandingEnd, { shouldValidate: false });
        setValue('sharePerMemberThisPeriod', roundToTwoDecimals(defaultMemberRecords.length > 0 ? totalStandingEnd / defaultMemberRecords.length : 0), { shouldValidate: false });
      }, 100);
    }
  }, [isEditing, recordToEdit, reset, defaultMemberRecords, latestRecord, groupInitData, groupFrequency, calculateInterestEarned, totalLoanAmount, setValue]);

  // Force initial calculation when form is loaded
  useEffect(() => {
    // Trigger initial calculations after a short delay to ensure form is properly initialized
    const timer = setTimeout(() => {
      const currentValues = getValues();
      const memberRecords = currentValues.memberRecords || [];
      
      if (memberRecords.length > 0) {
        const newContributions = roundToTwoDecimals(memberRecords.reduce((sum, record) => sum + Number(record.compulsoryContribution || 0), 0));
        const lateFines = roundToTwoDecimals(memberRecords.reduce((sum, record) => sum + Number(record.lateFinePaid || 0), 0));
        const standingAtStart = Number(currentValues.standingAtStartOfPeriod || 0);
        const interestEarned = Number(currentValues.interestEarnedThisPeriod || 0);
        const processingFees = Number(currentValues.loanProcessingFeesCollectedThisPeriod || 0);
        const expenses = Number(currentValues.expensesThisPeriod || 0);
        
        const totalCollection = roundToTwoDecimals(newContributions + interestEarned + lateFines + processingFees);
        const totalStandingEnd = roundToTwoDecimals(standingAtStart + totalCollection - expenses);
        const sharePerMember = roundToTwoDecimals(memberRecords.length > 0 ? totalStandingEnd / memberRecords.length : 0);
        
        // Update calculated fields
        setValue('newContributionsThisPeriod', newContributions, { shouldValidate: false });
        setValue('lateFinesCollectedThisPeriod', lateFines, { shouldValidate: false });
        setValue('totalCollectionThisPeriod', totalCollection, { shouldValidate: false });
        setValue('totalGroupStandingAtEndOfPeriod', totalStandingEnd, { shouldValidate: false });
        setValue('sharePerMemberThisPeriod', sharePerMember, { shouldValidate: false });
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [setValue, getValues]);

  // Memoize calculations to prevent infinite loops
  const calculatedValues = useMemo(() => {
    try {
      const numLoanProcessingFeesCollected = Number(loanProcessingFeesCollectedWatch || 0);
      const numStandingAtStart = Number(standingAtStartWatch || 0);
      const numExpensesThisPeriod = Number(expensesThisPeriodWatch || 0);
      const numInterestEarnedThisPeriod = Number(interestEarnedThisPeriodWatch || 0);

      const newContributions = (memberRecordsWatch || []).reduce((sum, record) => sum + Number(record.compulsoryContribution || 0), 0);
      const lateFines = (memberRecordsWatch || []).reduce((sum, record) => sum + Number(record.lateFinePaid || 0), 0);
      // const principalRepaid = (memberRecordsWatch || []).reduce((sum, record) => sum + Number(record.loanRepaymentPrincipal || 0), 0);

      // FIXED: Loan repayments should NOT be included in total collection as they don't increase group standing
      // They are internal transfers from loan assets to cash assets
      const totalCollection = roundToTwoDecimals(newContributions + numInterestEarnedThisPeriod + lateFines + numLoanProcessingFeesCollected);
      
      // Total standing = Previous standing + New inflows - Outflows
      // Loan repayments don't change total standing (they convert loan assets to cash)
      const totalStandingEnd = roundToTwoDecimals(numStandingAtStart + totalCollection - numExpensesThisPeriod);
      const sharePerMember = memberRecordsWatch && memberRecordsWatch.length > 0 
        ? roundToTwoDecimals(totalStandingEnd / memberRecordsWatch.length)
        : 0;

      return {
        newContributions: roundToTwoDecimals(Math.max(0, newContributions)),
        lateFines: roundToTwoDecimals(Math.max(0, lateFines)),
        totalCollection: roundToTwoDecimals(Math.max(0, totalCollection)),
        totalStandingEnd: roundToTwoDecimals(Math.max(0, totalStandingEnd)),
        sharePerMember: roundToTwoDecimals(Math.max(0, sharePerMember))
      };
    } catch (error) {
      console.error('Error calculating values:', error);
      return {
        newContributions: 0,
        lateFines: 0,
        totalCollection: 0,
        totalStandingEnd: 0,
        sharePerMember: 0
      };
    }
  }, [
    memberRecordsWatch, // Add the watched member records for completeness
    standingAtStartWatch,
    expensesThisPeriodWatch,
    loanProcessingFeesCollectedWatch,
    interestEarnedThisPeriodWatch
  ]);

  // Use useEffect to update calculated fields, but avoid infinite loops
  const prevCalculatedValues = useRef(calculatedValues);
  const hasInitialized = useRef(false);
  
  useEffect(() => {
    // Always run on first mount to ensure initial values are set
    const hasChanges = !hasInitialized.current ||
      prevCalculatedValues.current.newContributions !== calculatedValues.newContributions ||
      prevCalculatedValues.current.lateFines !== calculatedValues.lateFines ||
      prevCalculatedValues.current.totalCollection !== calculatedValues.totalCollection ||
      prevCalculatedValues.current.totalStandingEnd !== calculatedValues.totalStandingEnd ||
      prevCalculatedValues.current.sharePerMember !== calculatedValues.sharePerMember;
      
    // Only update if there are actual changes or if it's the first run
    if (hasChanges) {
      // Update all values in batch to minimize renders
      setValue('newContributionsThisPeriod', calculatedValues.newContributions, { shouldValidate: false });
      setValue('lateFinesCollectedThisPeriod', calculatedValues.lateFines, { shouldValidate: false });
      setValue('totalCollectionThisPeriod', calculatedValues.totalCollection, { shouldValidate: false });
      setValue('totalGroupStandingAtEndOfPeriod', calculatedValues.totalStandingEnd, { shouldValidate: false });
      setValue('sharePerMemberThisPeriod', calculatedValues.sharePerMember, { shouldValidate: false });
      
      // Update ref with current values for next comparison
      prevCalculatedValues.current = { ...calculatedValues };
      hasInitialized.current = true;
    }
  }, [calculatedValues, setValue]);

  // Determine if this is the first record
  // const isFirstRecord = useMemo(() => {
  //   return !latestRecord?.totalGroupStandingAtEndOfPeriod;
  // }, [latestRecord]);

  // Trigger initial calculation when form is mounted and data is available
  useEffect(() => {
    // Only run for new records (not editing) and when we have member data
    if (!isEditing && memberRecordsWatch && memberRecordsWatch.length > 0) {
      const timer = setTimeout(() => {
        // Force trigger the calculation by updating a watched field
        const currentStanding = watch('standingAtStartOfPeriod');
        setValue('standingAtStartOfPeriod', currentStanding, { shouldValidate: false });
      }, 200);
      
      return () => clearTimeout(timer);
    }
    
    // Return undefined for other code paths
    return undefined;
  }, [isEditing, memberRecordsWatch?.length, memberRecordsWatch, setValue, watch]);

  // Cash allocation calculations and helpers
  const totalCashCollection = useMemo(() => {
    const collection = Number(totalCollectionWatch || 0);
    const loanRepayments = (memberRecordsWatch || []).reduce((sum, record) => sum + Number(record.loanRepaymentPrincipal || 0), 0);
    
    // For cash allocation, we only consider actual cash flows, not the full standing
    // The backend handles the full standing calculation including loan assets
    return collection + loanRepayments;
  }, [totalCollectionWatch, memberRecordsWatch]);

  const totalCashAllocated = useMemo(() => {
    return Number(cashInBankWatch || 0) + Number(cashInHandWatch || 0);
  }, [cashInBankWatch, cashInHandWatch]);

  const cashAllocationDifference = useMemo(() => {
    return totalCashCollection - totalCashAllocated;
  }, [totalCashCollection, totalCashAllocated]);

  // Auto-allocate cash when enabled and collection changes
  useEffect(() => {
    if (autoAllocateCash && totalCashCollection > 0) {
      const bankAmount = roundToTwoDecimals(totalCashCollection * 0.7); // 70% to bank
      const handAmount = roundToTwoDecimals(totalCashCollection - bankAmount); // 30% to hand
      
      setValue('cashInBankAtEndOfPeriod', bankAmount, { shouldValidate: false });
      setValue('cashInHandAtEndOfPeriod', handAmount, { shouldValidate: false });
    }
  }, [autoAllocateCash, totalCashCollection, setValue]);

  // Handle cash allocation adjustments
  const handleCashInBankChange = useCallback((value: number) => {
    const newBankAmount = roundToTwoDecimals(Math.max(0, value));
    setValue('cashInBankAtEndOfPeriod', newBankAmount, { shouldValidate: false });
    
    if (autoAllocateCash) {
      const remainingAmount = roundToTwoDecimals(Math.max(0, totalCashCollection - newBankAmount));
      setValue('cashInHandAtEndOfPeriod', remainingAmount, { shouldValidate: false });
    }
  }, [autoAllocateCash, totalCashCollection, setValue]);

  const handleCashInHandChange = useCallback((value: number) => {
    const newHandAmount = roundToTwoDecimals(Math.max(0, value));
    setValue('cashInHandAtEndOfPeriod', newHandAmount, { shouldValidate: false });
    
    if (autoAllocateCash) {
      const remainingAmount = roundToTwoDecimals(Math.max(0, totalCashCollection - newHandAmount));
      setValue('cashInBankAtEndOfPeriod', remainingAmount, { shouldValidate: false });
    }
  }, [autoAllocateCash, totalCashCollection, setValue]);

  const allocateAllToBank = useCallback(() => {
    setValue('cashInBankAtEndOfPeriod', totalCashCollection, { shouldValidate: false });
    setValue('cashInHandAtEndOfPeriod', 0, { shouldValidate: false });
  }, [totalCashCollection, setValue]);

  const allocateAllToHand = useCallback(() => {
    setValue('cashInHandAtEndOfPeriod', totalCashCollection, { shouldValidate: false });
    setValue('cashInBankAtEndOfPeriod', 0, { shouldValidate: false });
  }, [totalCashCollection, setValue]);

  // Bulk contribution update function
  const updateAllMemberContributions = useCallback((amount: number) => {
    const memberRecords = getValues('memberRecords');
    memberRecords.forEach((_, index) => {
      setValue(`memberRecords.${index}.compulsoryContribution`, amount, { shouldValidate: false });
    });
  }, [setValue, getValues]);

  const applyBulkContributionUpdate = useCallback(() => {
    if (bulkContributionAmount >= 0) {
      updateAllMemberContributions(bulkContributionAmount);
      setShowBulkContributionUpdate(false);
      setBulkContributionAmount(0);
      // Show success message briefly
      setTimeout(() => {
        // Could add a toast notification here if available
        console.log(`Updated all member contributions to ₹${bulkContributionAmount}`);
      }, 100);
    }
  }, [bulkContributionAmount, updateAllMemberContributions]);

  // Calculate sharePerMemberThisPeriod for display only (no form updates here)
  // const sharePerMemberThisPeriod = useMemo(() => {
  //   // Get values safely to prevent NaN
  //   const totalStanding = parseFloat(String(totalGroupStandingWatch)) || 0;
  //   const memberCount = (memberRecordsWatch || []).length || 1; // Prevent division by zero
  //   
  //   // Calculate share - this is only for display, actual form value is set in batch update
  //   return totalStanding / memberCount;
  // }, [totalGroupStandingWatch, memberRecordsWatch?.length]);

  const formSubmitHandler = async (data: PeriodicRecordFormValues) => {
    // Check if loan balances have changed and need to be updated in the database
    const loanUpdates: { memberId: string; newBalance: number; loanId?: string }[] = [];
    
    data.memberRecords.forEach((record) => {
      const originalLoan = memberLoans[record.memberId];
      const newBalance = record.memberCurrentLoanBalance;
      
      // If the balance has changed from the original, track it for update
      if (originalLoan && originalLoan.currentBalance !== newBalance && originalLoan.loanId) {
        loanUpdates.push({
          memberId: record.memberId,
          newBalance: newBalance,
          loanId: originalLoan.loanId
        });
      }
    });
    
    // If there are loan updates, apply them before submitting the form
    if (loanUpdates.length > 0) {
      try {
        for (const update of loanUpdates) {
          if (update.loanId) {
            await saveLoanChanges(update.memberId, update.newBalance);
          }
        }
      } catch (error) {
        console.error('Error updating loan balances:', error);
        // You might want to show an error message to the user here
      }
    }
    
    onSubmit(data);
  };
  
  const getCalculatedValue = (fieldName: keyof PeriodicRecordFormValues) => {
    const value = watch(fieldName);
    return typeof value === 'number' ? value.toFixed(2) : '0.00';
  };

  // Helper function to format currency values consistently
  const formatCurrency = (value: number | undefined | null): string => {
    return (value ?? 0).toFixed(2);
  };

  return (
    <form onSubmit={handleSubmit(formSubmitHandler, (rhfErrors) => { console.error('[PeriodicRecordForm] RHF validation errors:', rhfErrors); })} className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        {isEditing ? 'Edit' : 'Add New'} {frequencyLabel} Record for {groupName}
      </h2>

      {/* Group Level Financials */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border p-4 rounded-md dark:border-gray-700">
        <div>
          <label htmlFor="meetingDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Meeting Date</label>
          <Controller
            name="meetingDate"
            control={control}
            render={({ field }) => (
              <input
                type="date"
                value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value}
                onChange={(e) => field.onChange(new Date(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
              />
            )}
          />
          {errors.meetingDate && <p className="mt-1 text-sm text-red-500">{errors.meetingDate.message}</p>}
        </div>

        <div>
          <label htmlFor="recordSequenceNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Record Sequence No.</label>
          <Controller
            name="recordSequenceNumber"
            control={control}
            render={({ field }) => <input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-100" />}
          />
          {errors.recordSequenceNumber && <p className="mt-1 text-sm text-red-500">{errors.recordSequenceNumber.message}</p>}
        </div>
        
        <div>
          <label htmlFor="standingAtStartOfPeriod" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Standing at Start of Period</label>
          <Controller
            name="standingAtStartOfPeriod"
            control={control}
            render={({ field }) => <input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-100" step="0.01" />}
          />
          {errors.standingAtStartOfPeriod && <p className="mt-1 text-sm text-red-500">{errors.standingAtStartOfPeriod.message}</p>}
        </div>

        {/* Cash Allocation Section */}
        {totalCashCollection > 0 && (
          <div className="border border-blue-200 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3">Cash Allocation</h4>
            
            {/* Collection Summary */}
            <div className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              <div className="grid grid-cols-2 gap-2">
                <div>Total Collections: ₹{totalCollectionWatch?.toLocaleString('en-IN') || '0'}</div>
                <div>Loan Repayments: ₹{((memberRecordsWatch || []).reduce((sum, record) => sum + Number(record.loanRepaymentPrincipal || 0), 0)).toLocaleString('en-IN')}</div>
              </div>
              <div className="font-semibold mt-1">Available Cash: ₹{totalCashCollection.toLocaleString('en-IN')}</div>
            </div>

            {/* Auto-allocation checkbox */}
            <div className="mb-3">
              <label className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={autoAllocateCash}
                  onChange={(e) => setAutoAllocateCash(e.target.checked)}
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Auto-allocate cash between bank and hand
              </label>
              {autoAllocateCash && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  70% to bank, 30% to hand (adjusting one field will auto-adjust the other)
                </p>
              )}
            </div>

            {/* Allocation Summary */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-gray-600 dark:text-gray-400">
                <div>Total Allocated: ₹{totalCashAllocated.toLocaleString('en-IN')}</div>
                <div className={`font-medium ${cashAllocationDifference === 0 ? 'text-green-600 dark:text-green-400' : cashAllocationDifference > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
                  {cashAllocationDifference === 0 ? 'Fully Allocated' : 
                   cashAllocationDifference > 0 ? `Remaining: ₹${cashAllocationDifference.toLocaleString('en-IN')}` :
                   `Over-allocated: ₹${Math.abs(cashAllocationDifference).toLocaleString('en-IN')}`}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={allocateAllToBank}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  All to Bank
                </button>
                <button
                  type="button"
                  onClick={allocateAllToHand}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  All to Hand
                </button>
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="cashInBankAtEndOfPeriod" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cash in Bank at End</label>
          <Controller
            name="cashInBankAtEndOfPeriod"
            control={control}
            render={({ field }) => <input type="number" {...field} onChange={e => handleCashInBankChange(parseFloat(e.target.value) || 0)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-100" step="0.01" />}
          />
          {errors.cashInBankAtEndOfPeriod && <p className="mt-1 text-sm text-red-500">{errors.cashInBankAtEndOfPeriod.message}</p>}
        </div>

        <div>
          <label htmlFor="cashInHandAtEndOfPeriod" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cash in Hand at End</label>
          <Controller
            name="cashInHandAtEndOfPeriod"
            control={control}
            render={({ field }) => <input type="number" {...field} onChange={e => handleCashInHandChange(parseFloat(e.target.value) || 0)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-100" step="0.01" />}
          />
          {errors.cashInHandAtEndOfPeriod && <p className="mt-1 text-sm text-red-500">{errors.cashInHandAtEndOfPeriod.message}</p>}
        </div>

        <div>
          <label htmlFor="expensesThisPeriod" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Expenses This Period</label>
          <Controller
            name="expensesThisPeriod"
            control={control}
            render={({ field }) => <input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-100" step="0.01" />}
          />
          {errors.expensesThisPeriod && <p className="mt-1 text-sm text-red-500">{errors.expensesThisPeriod.message}</p>}
        </div>
        
        <div>
          <label htmlFor="loanProcessingFeesCollectedThisPeriod" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Loan Processing Fees</label>
          <Controller
            name="loanProcessingFeesCollectedThisPeriod"
            control={control}
            render={({ field }) => <input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-100" step="0.01" />}
          />
          {errors.loanProcessingFeesCollectedThisPeriod && <p className="mt-1 text-sm text-red-500">{errors.loanProcessingFeesCollectedThisPeriod.message}</p>}
        </div>

        <div>
          <label htmlFor="interestEarnedThisPeriod" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Interest Earned This Period</label>
          {groupInitData?.interestRate && !isEditing && totalLoanAmount > 0 ? (
            <input 
              type="text" 
              value={formatCurrency(watch('interestEarnedThisPeriod'))} 
              readOnly 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-100 dark:bg-gray-600 dark:text-gray-100 cursor-not-allowed" 
            />
          ) : (
            <Controller
              name="interestEarnedThisPeriod"
              control={control}
              render={({ field }) => <input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-100" step="0.01" />}
            />
          )}
          {groupInitData?.interestRate && !isEditing && totalLoanAmount > 0 ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Automatically calculated based on total loan amounts ({totalLoanAmount.toLocaleString('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0})}) 
              and {groupInitData.interestRate}% interest per annum
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {totalLoanAmount > 0 ? `Total outstanding loans: ${totalLoanAmount.toLocaleString('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0})}` : 'No active loans for interest calculation'}
            </p>
          )}
          {errors.interestEarnedThisPeriod && <p className="mt-1 text-sm text-red-500">{errors.interestEarnedThisPeriod.message}</p>}
        </div>

        <div>
          <label htmlFor="sharePerMemberThisPeriod" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Share of Each Member (₹)</label>
          <Controller
            name="sharePerMemberThisPeriod"
            control={control}
            render={({ field }) => (
              <input 
                type="text" 
                value={formatCurrency(field.value)}
                readOnly
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-100 dark:bg-gray-600 dark:text-gray-100 cursor-not-allowed" 
              />
            )}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Automatically calculated: Total Group Standing / Member Count</p>
        </div>

        <div>
          <label htmlFor="newMembersJoinedThisPeriod" className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Members Joined</label>
          <Controller
            name="newMembersJoinedThisPeriod"
            control={control}
            render={({ field }) => <input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-100" />}
          />
          {errors.newMembersJoinedThisPeriod && <p className="mt-1 text-sm text-red-500">{errors.newMembersJoinedThisPeriod.message}</p>}
        </div>
      </div> {/* Closing the grid div */}

      {/* Calculated Values Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border p-4 rounded-md dark:border-gray-700">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">New Contributions:</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">₹{getCalculatedValue('newContributionsThisPeriod')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Late Fines Collected:</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">₹{getCalculatedValue('lateFinesCollectedThisPeriod')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Collection This Period:</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">₹{getCalculatedValue('totalCollectionThisPeriod')}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Group Standing at End:</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">₹{getCalculatedValue('totalGroupStandingAtEndOfPeriod')}</p>
        </div>
      </div>

      {/* Member Level Records */}
      <div className="space-y-4 border p-4 rounded-md dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Member Contributions & Repayments</h3>
          <button
            type="button"
            onClick={() => setShowBulkContributionUpdate(!showBulkContributionUpdate)}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {showBulkContributionUpdate ? 'Hide' : 'Bulk Update Contributions'}
          </button>
        </div>

        {/* Bulk Contribution Update Section */}
        {showBulkContributionUpdate && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700 mb-4">
            <h4 className="text-md font-medium text-blue-900 dark:text-blue-100 mb-3">Update All Member Contributions</h4>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label htmlFor="bulkContributionAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Contribution Amount (₹)
                </label>
                <input
                  type="number"
                  id="bulkContributionAmount"
                  value={bulkContributionAmount || ''}
                  onChange={(e) => setBulkContributionAmount(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="e.g., 1000"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={applyBulkContributionUpdate}
                  disabled={bulkContributionAmount < 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Apply to All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const defaultContribution = groupInitData?.monthlyContribution || 0;
                    setBulkContributionAmount(defaultContribution);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Use Default
                </button>
                <button
                  type="button"
                  onClick={() => setBulkContributionAmount(0)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                >
                  Set to Zero
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              This will update the compulsory contribution for all members. 
              {groupInitData?.monthlyContribution && (
                <span> Default group contribution: ₹{groupInitData.monthlyContribution}</span>
              )}
            </p>
          </div>
        )}

        {fields.map((item, index) => (
          <div key={item.id} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-3 border dark:border-gray-600 rounded-md">
            <p className="md:col-span-1 font-medium text-gray-700 dark:text-gray-300 self-center">{getValues(`memberRecords.${index}.memberName`)}</p>

            {/* Editable current loan balance */}
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Current Loan Amount</label>
              <Controller
                name={`memberRecords.${index}.memberCurrentLoanBalance`}
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    {...field}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      field.onChange(value);
                      // Update memberLoans state to keep UI in sync
                      setMemberLoans(prev => ({
                        ...prev,
                        [item.memberId]: {
                          ...prev[item.memberId],
                          currentBalance: value,
                          originalAmount: prev[item.memberId]?.originalAmount || value
                        }
                      }));
                      // Recalculate interest when loan amounts change
                      setTimeout(() => recalculateInterest(), 0);
                    }}
                    className="mt-1 block w-full px-2 py-1 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm dark:bg-gray-700 dark:text-gray-100"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                )}
              />
              {errors.memberRecords?.[index]?.memberCurrentLoanBalance && (
                <p className="mt-1 text-xs text-red-500">{errors.memberRecords?.[index]?.memberCurrentLoanBalance?.message}</p>
              )}
            </div>

            <div className="md:col-span-1">
              <label htmlFor={`memberRecords.${index}.compulsoryContribution`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Compulsory Contribution</label>
              <Controller
                name={`memberRecords.${index}.compulsoryContribution`}
                control={control}
                render={({ field }) => <input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="mt-1 block w-full px-2 py-1 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm dark:bg-gray-700 dark:text-gray-100" step="0.01" />}
              />
              {errors.memberRecords?.[index]?.compulsoryContribution && <p className="mt-1 text-xs text-red-500">{errors.memberRecords?.[index]?.compulsoryContribution?.message}</p>}
            </div>

            <div className="md:col-span-1">
              <label htmlFor={`memberRecords.${index}.loanRepaymentPrincipal`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">Loan Repayment (Principal)</label>
              <Controller
                name={`memberRecords.${index}.loanRepaymentPrincipal`}
                control={control}
                render={({ field }) => (
                  <input
                    type="number"
                    {...field}
                    onChange={e => {
                      const value = parseFloat(e.target.value) || 0;
                      field.onChange(value);
                      // Update loan balance in UI
                      if (memberLoans[item.memberId]) {
                        updateLoanBalance(item.memberId, value);
                      }
                    }}
                    className="mt-1 block w-full px-2 py-1 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm dark:bg-gray-700 dark:text-gray-100"
                    step="0.01"
                  />
                )}
              />
              {errors.memberRecords?.[index]?.loanRepaymentPrincipal && <p className="mt-1 text-xs text-red-500">{errors.memberRecords?.[index]?.loanRepaymentPrincipal?.message}</p>}
            </div>

            <div className="md:col-span-1">
              <label htmlFor={`memberRecords.${index}.lateFinePaid`} className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                Contribution Late Fine
                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">(for overdue contributions)</span>
              </label>
              <Controller
                name={`memberRecords.${index}.lateFinePaid`}
                control={control}
                render={({ field }) => <input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} className="mt-1 block w-full px-2 py-1 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm dark:bg-gray-700 dark:text-gray-100" step="0.01" />}
              />
              {errors.memberRecords?.[index]?.lateFinePaid && <p className="mt-1 text-xs text-red-500">{errors.memberRecords?.[index]?.lateFinePaid?.message}</p>}
            </div>
          </div>
        ))}
        {errors.memberRecords && !errors.memberRecords.root && !Array.isArray(errors.memberRecords) && <p className="mt-1 text-sm text-red-500">{errors.memberRecords.message}</p>}
      </div>

      {/* Loan Management */}
      <div className="space-y-4 border p-4 rounded-md dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Loan Management</h3>
          <button
            type="button"
            onClick={() => setShowLoanManagement(!showLoanManagement)}
            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            {showLoanManagement ? 'Hide' : 'Show'} Loan Details
          </button>
        </div>

        {showLoanManagement && (
          <div className="space-y-4">
            {/* Interest Rate Control */}
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label htmlFor="interestRate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Interest Rate (% per annum)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={currentInterestRate}
                    onChange={(e) => setCurrentInterestRate(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-100"
                    placeholder="e.g., 12.0"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={applyInterestRateToAll}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Apply to All Members
                  </button>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Current rate: {currentInterestRate}%
                </div>
              </div>
            </div>

            {/* Member Loan Details */}
            {isLoadingLoans ? (
              <div className="text-center py-4">
                <p className="text-gray-600 dark:text-gray-400">Loading loan details...</p>
              </div>
            ) : Object.keys(memberLoans).length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">Active Member Loans</h4>
                {Object.entries(memberLoans).map(([memberId, loan]) => {
                  const memberName = members.find(m => m.id === memberId)?.name || 'Unknown Member';
                  return (
                    <LoanMemberRow
                      key={memberId}
                      memberId={memberId}
                      memberName={memberName}
                      loan={loan}
                      onBalanceUpdate={(newBalance) => {
                        setMemberLoans(prev => {
                          const existingLoan = prev[memberId];
                          const updatedLoan: { currentBalance: number; originalAmount: number; loanId?: string } = {
                            currentBalance: newBalance,
                            originalAmount: existingLoan?.originalAmount || 0
                          };
                          
                          if (existingLoan?.loanId) {
                            updatedLoan.loanId = existingLoan.loanId;
                          }
                          
                          return {
                            ...prev,
                            [memberId]: updatedLoan
                          };
                        });
                      }}
                      onSave={() => saveLoanChanges(memberId, loan.currentBalance)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600 dark:text-gray-400">No active loans found for members in this group.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting || isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isSubmitting || isLoading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Record')}
        </button>
      </div>
    </form>
  );
}

// Loan Member Row Component
interface LoanMemberRowProps {
  memberId: string;
  memberName: string;
  loan: {
    currentBalance: number;
    originalAmount: number;
    loanId?: string;
  };
  onBalanceUpdate: (newBalance: number) => void;
  onSave: () => Promise<boolean>;
}

function LoanMemberRow({ memberId: _memberId, memberName, loan, onBalanceUpdate, onSave }: LoanMemberRowProps) {
  const [editableBalance, setEditableBalance] = useState(loan.currentBalance);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const success = await onSave();
    if (success) {
      onBalanceUpdate(editableBalance);
    }
    setIsSaving(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
      <div className="md:col-span-1">
        <p className="font-medium text-gray-900 dark:text-gray-100">{memberName}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Member</p>
      </div>
      
      <div className="md:col-span-1">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Original Amount</label>
        <input
          type="text"
          value={loan.originalAmount.toFixed(2)}
          readOnly
          className="mt-1 block w-full px-2 py-1 border border-gray-300 dark:border-gray-500 rounded-md text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-100 cursor-not-allowed"
        />
      </div>

      <div className="md:col-span-1">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Edit Balance</label>
        <input
          type="number"
          value={editableBalance}
          onChange={(e) => setEditableBalance(parseFloat(e.target.value) || 0)}
          className="mt-1 block w-full px-2 py-1 border border-gray-300 dark:border-gray-500 rounded-md text-sm dark:bg-gray-700 dark:text-gray-100"
          min="0"
          max={loan.originalAmount}
          step="0.01"
        />
      </div>

      <div className="md:col-span-1">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Reduction</label>
        <input
          type="text"
          value={(loan.currentBalance - editableBalance).toFixed(2)}
          readOnly
          className="mt-1 block w-full px-2 py-1 border border-gray-300 dark:border-gray-500 rounded-md text-sm bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-100 cursor-not-allowed"
        />
      </div>

      <div className="md:col-span-1">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Actions</label>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || editableBalance === loan.currentBalance}
          className="mt-1 w-full px-2 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}