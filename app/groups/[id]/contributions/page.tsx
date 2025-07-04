'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { calculatePeriodInterestFromDecimal } from '@/app/lib/interest-utils';
import { roundToTwoDecimals, formatCurrency } from '@/app/lib/currency-utils';

// Type declaration for jspdf-autotable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

interface GroupMember {
  id: string;
  memberId: string;
  name: string;
  email?: string;
  phone?: string;
  joinedAt: string;
  currentShareAmount?: number;
  currentLoanAmount?: number;
  currentLoanBalance?: number;
  initialInterest?: number;
}

interface GroupData {
  id: string;
  groupId: string;
  name: string;
  address?: string;
  leader: {
    id: string;
    name: string;
    email: string;
  };
  memberCount: number;
  dateOfStarting?: string;
  description?: string;
  cashInHand?: number;
  balanceInBank?: number;
  monthlyContribution?: number;
  interestRate?: number;
  collectionFrequency?: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'YEARLY';
  collectionDayOfMonth?: number; // Day of month (1-31) for MONTHLY/YEARLY
  collectionDayOfWeek?: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'; // Day of week for WEEKLY/FORTNIGHTLY
  collectionWeekOfMonth?: number; // Week of month (1-4) for FORTNIGHTLY
  // Late fine configuration via LateFineRule model
  lateFineRules?: {
    id: string;
    ruleType: 'DAILY_FIXED' | 'DAILY_PERCENTAGE' | 'TIER_BASED';
    isEnabled: boolean;
    dailyAmount?: number;
    dailyPercentage?: number;
    tierRules?: {
      startDay: number;
      endDay: number;
      amount: number;
      isPercentage: boolean;
    }[];
  }[];
  members: GroupMember[];
  userPermissions: {
    canEdit: boolean;
    canViewMemberIds: boolean;
  };
}

interface ContributionRecord {
  id: string;
  groupPeriodicRecordId: string;
  memberId: string;
  member?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  
  // Required amounts
  compulsoryContributionDue: number;
  loanInterestDue?: number;
  minimumDueAmount: number;
  
  // Actual payments
  compulsoryContributionPaid: number;
  loanInterestPaid: number;
  lateFinePaid: number;
  totalPaid: number;
  
  // Status and tracking
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'LATE';
  dueDate: string;
  paidDate?: string;
  daysLate: number;
  lateFineAmount: number;
  
  // Remaining amounts
  remainingAmount: number;
  
  // Cash allocation tracking
  cashAllocation?: string; // JSON string containing allocation details
  
  createdAt: string;
  updatedAt: string;
}

interface MemberContributionStatus {
  memberId: string;
  memberName: string;
  expectedContribution: number;
  expectedInterest: number;
  currentLoanBalance: number;
  lateFineAmount: number;
  daysLate: number;
  dueDate: Date;
  totalExpected: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE';
  lastPaymentDate?: string;
}

export default function ContributionTrackingPage() {
  const params = useParams();
  const groupId = params.id as string;
  const { data: session } = useSession();

  // Helper function to get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
  const getOrdinalSuffix = (num: number): string => {
    const lastDigit = num % 10;
    const lastTwoDigits = num % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return 'th';
    }
    
    switch (lastDigit) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  
  const [group, setGroup] = useState<GroupData | null>(null);
  const [memberContributions, setMemberContributions] = useState<MemberContributionStatus[]>([]);
  const [actualContributions, setActualContributions] = useState<Record<string, ContributionRecord>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [savingPayment, setSavingPayment] = useState<string | null>(null);
  
  // New state for period management
  const [currentPeriod, setCurrentPeriod] = useState<{
    id: string;
    startDate: string;
    endDate?: string;
    isClosed: boolean;
    periodNumber: number;
    periodType: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'YEARLY';
    // Additional fields to help detect closed periods
    totalCollectionThisPeriod?: number | null;
    interestEarnedThisPeriod?: number | null;
    lateFinesCollectedThisPeriod?: number | null;
    newContributionsThisPeriod?: number | null;
    updatedAt?: Date | string;
  } | null>(null);
  const [showOldContributions, setShowOldContributions] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [oldPeriods, setOldPeriods] = useState<any[]>([]);
  const [closingPeriod, setClosingPeriod] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopeningPeriod, setReopeningPeriod] = useState(false);
  const [selectedReopenPeriod, setSelectedReopenPeriod] = useState<any>(null);
  
  // Loan Management state
  const [showLoanManagement, setShowLoanManagement] = useState(false);
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [showLoanRepaymentModal, setShowLoanRepaymentModal] = useState(false);
  const [showInterestRateModal, setShowInterestRateModal] = useState(false);
  const [showContributionAmountModal, setShowContributionAmountModal] = useState(false);
  const [selectedLoanMember, setSelectedLoanMember] = useState<GroupMember | null>(null);
  const [newLoanAmount, setNewLoanAmount] = useState('');
  const [loanRepaymentAmount, setLoanRepaymentAmount] = useState('');
  const [newInterestRate, setNewInterestRate] = useState('');
  const [newContributionAmount, setNewContributionAmount] = useState('');
  const [savingLoanOperation, setSavingLoanOperation] = useState(false);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showClosePeriodModal, setShowClosePeriodModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{
    id: string;
    name: string;
    expectedContribution: number;
    expectedInterest: number;
    remainingAmount: number;
    lateFineAmount?: number;
    daysLate?: number;
  } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [contributionAllocation, setContributionAllocation] = useState({
    cashInHand: 0,
    cashInBank: 0
  });
  const [interestAllocation, setInterestAllocation] = useState({
    cashInHand: 0,
    cashInBank: 0
  });

  // New state for individual member collection inputs
  const [memberCollections, setMemberCollections] = useState<Record<string, {
    cashAmount: number;
    bankAmount: number;
    compulsoryContribution: number;
    interestPaid: number;
    loanRepayment: number;
    lateFinePaid: number;
    remainingLoan: number;
  }>>({});

  useEffect(() => {
    fetchGroupData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Helper function to create a new period when none exists
  const createNewPeriod = async (groupData: GroupData) => {
    try {
      const today = new Date();
      const response = await fetch(`/api/groups/${groupId}/contributions/periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingDate: today.toISOString(),
          recordSequenceNumber: 1,
          standingAtStartOfPeriod: (groupData.cashInHand || 0) + (groupData.balanceInBank || 0) + 
            groupData.members.reduce((sum, member) => sum + (member.currentLoanAmount || 0), 0),
          cashInHandAtEndOfPeriod: groupData.cashInHand || 0,
          cashInBankAtEndOfPeriod: groupData.balanceInBank || 0,
          totalGroupStandingAtEndOfPeriod: (groupData.cashInHand || 0) + (groupData.balanceInBank || 0) + 
            groupData.members.reduce((sum, member) => sum + (member.currentLoanAmount || 0), 0),
          totalCollectionThisPeriod: 0,
          interestEarnedThisPeriod: 0,
          lateFinesCollectedThisPeriod: 0,
          newContributionsThisPeriod: 0,
        })
      });

      if (response.ok) {
        const newPeriodData = await response.json();
        const endDate = calculateNextDueDate(groupData);
        
        setCurrentPeriod({
          id: newPeriodData.id,
          startDate: today.toISOString(),
          endDate: endDate.toISOString(),
          isClosed: false,
          periodNumber: 1,
          periodType: (groupData.collectionFrequency || 'MONTHLY') as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'YEARLY'
        });
        
        console.log('Successfully created new period:', newPeriodData.id);
      }
    } catch (error) {
      console.error('Error creating new period:', error);
    }
  };

  const fetchGroupData = useCallback(async () => {
    try {
      // Fetch group data
      const groupResponse = await fetch(`/api/groups/${groupId}`);
      if (!groupResponse.ok) throw new Error('Failed to fetch group details');
      
      const groupData: GroupData = await groupResponse.json();
      setGroup(groupData);
      
      // Fetch current period information
      console.log('📋 [FETCH DATA] Fetching current period...');
      try {
        const periodResponse = await fetch(`/api/groups/${groupId}/contributions/periods/current`);
        console.log('📋 [FETCH DATA] Current period API response status:', periodResponse.status);
        
        if (periodResponse.ok) {
          const periodData = await periodResponse.json();
          console.log('📋 [FETCH DATA] Current period API response data:', periodData);
          
          if (periodData.period) {
            console.log('📋 [FETCH DATA] Setting current period:', {
              id: periodData.period.id,
              startDate: periodData.period.startDate,
              periodNumber: periodData.period.periodNumber,
              isClosed: periodData.period.isClosed
            });
            setCurrentPeriod(periodData.period);
          } else {
            // No current period exists, create one
            console.log('📋 [FETCH DATA] No current period found, creating a new one...');
            await createNewPeriod(groupData);
          }
        } else {
          // API error, try to create a new period
          console.log('📋 [FETCH DATA] Period API error, attempting to create a new one...');
          const errorText = await periodResponse.text();
          console.log('📋 [FETCH DATA] Error details:', errorText);
          await createNewPeriod(groupData);
        }
      } catch (_err) {
        console.log('📋 [FETCH DATA] Exception fetching period, creating a new one...', _err);
        await createNewPeriod(groupData);
      }
      
      // Fetch old periods for viewing history
      try {
        const oldPeriodsResponse = await fetch(`/api/groups/${groupId}/contributions/periods`);
        if (oldPeriodsResponse.ok) {
          const periodsData = await oldPeriodsResponse.json();
          setOldPeriods(periodsData.periods || []);
        }
      } catch (_err) {
        console.log('No old periods found');
      }
      
      // Fetch current contribution data
      let contributionData: Record<string, ContributionRecord> = {};
      try {
        const contributionResponse = await fetch(`/api/groups/${groupId}/contributions/current`);
        if (contributionResponse.ok) {
          const contributionsResult = await contributionResponse.json();
          // Convert contribution array to a map by member ID
          contributionData = contributionsResult.contributions?.reduce((acc: Record<string, ContributionRecord>, contrib: ContributionRecord) => {
            acc[contrib.memberId] = contrib;
            return acc;
          }, {}) || {};
          setActualContributions(contributionData);
        }
      } catch (_err) {
        console.log('No existing contribution records found, using group data only');
        // This is fine - it means no contributions have been recorded yet for the current period
      }

      // Ensure all current group members have contribution records
      if (groupData?.members) {
        const missingMembers = groupData.members.filter(member => 
          !contributionData[member.id] && !contributionData[member.memberId]
        );

        if (missingMembers.length > 0) {
          console.log(`Found ${missingMembers.length} members without contribution records, creating them...`);
          
          for (const member of missingMembers) {
            try {
              const createResponse = await fetch(`/api/groups/${groupId}/contributions/current`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  memberId: member.id || member.memberId,
                  compulsoryContributionDue: groupData.monthlyContribution || 0,
                  loanInterestDue: 0
                })
              });

              if (createResponse.ok) {
                const newContribution = await createResponse.json();
                contributionData[member.id || member.memberId] = newContribution;
                console.log(`Created contribution record for member: ${member.name}`);
              }
            } catch (createError) {
              console.warn(`Failed to create contribution record for member ${member.name}:`, createError);
            }
          }
          
          // Update the state with the new contribution data
          setActualContributions(contributionData);
        }
      }
      
      // Member contributions will be calculated in a separate useEffect
      // when both group and currentPeriod are available
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  // Calculate member contributions when both group and currentPeriod are available
  useEffect(() => {
    if (group && currentPeriod && Object.keys(actualContributions).length >= 0) {
      console.log('🧮 [CONTRIBUTIONS CALC] Recalculating member contributions with period data');
      console.log('🧮 [CONTRIBUTIONS CALC] Current Period:', currentPeriod);
      console.log('🧮 [CONTRIBUTIONS CALC] Group data available:', !!group);
      
      const calculatedContributions = calculateMemberContributions(group, actualContributions);
      setMemberContributions(calculatedContributions);

      // Initialize member collections state for new members
      const initialCollections: Record<string, any> = {};
      calculatedContributions.forEach((contribution: any) => {
        if (!memberCollections[contribution.memberId]) {
          initialCollections[contribution.memberId] = {
            cashAmount: 0,
            bankAmount: 0,
            compulsoryContribution: 0,
            interestPaid: 0,
            loanRepayment: 0,
            lateFinePaid: 0,
            remainingLoan: contribution.currentLoanBalance || 0
          };
        }
      });

      if (Object.keys(initialCollections).length > 0) {
        setMemberCollections((prev: any) => ({ ...prev, ...initialCollections }));
      }
    }
  }, [group, currentPeriod, actualContributions, memberCollections]);

  // Calculate the next due date based on collection frequency
  const calculateNextDueDate = (groupData: GroupData): Date => {
    const today = new Date();
    const frequency = groupData.collectionFrequency || 'MONTHLY';
    
    switch (frequency) {
      case 'WEEKLY': {
        const targetDay = getDayOfWeekNumber(groupData.collectionDayOfWeek || 'MONDAY');
        const currentDay = today.getDay();
        const daysUntilTarget = (targetDay - currentDay + 7) % 7;
        const dueDate = new Date(today);
        dueDate.setDate(today.getDate() + daysUntilTarget);
        return dueDate;
      }
      
      case 'FORTNIGHTLY': {
        const targetDay = getDayOfWeekNumber(groupData.collectionDayOfWeek || 'MONDAY');
        const weekOfMonth = groupData.collectionWeekOfMonth || 1;
        const currentDay = today.getDay();
        const daysUntilTarget = (targetDay - currentDay + 7) % 7;
        const nextWeeklyDate = new Date(today);
        nextWeeklyDate.setDate(today.getDate() + daysUntilTarget);
        
        // Adjust for fortnightly schedule
        if (weekOfMonth === 1 || weekOfMonth === 3) {
          // First or third week of month
          const firstWeekDate = new Date(nextWeeklyDate.getFullYear(), nextWeeklyDate.getMonth(), 1);
          firstWeekDate.setDate(1 + ((targetDay - firstWeekDate.getDay() + 7) % 7));
          if (weekOfMonth === 3) {
            firstWeekDate.setDate(firstWeekDate.getDate() + 14);
          }
          return firstWeekDate;
        } else {
          // Second or fourth week of month
          const secondWeekDate = new Date(nextWeeklyDate.getFullYear(), nextWeeklyDate.getMonth(), 1);
          secondWeekDate.setDate(1 + ((targetDay - secondWeekDate.getDay() + 7) % 7) + 7);
          if (weekOfMonth === 4) {
            secondWeekDate.setDate(secondWeekDate.getDate() + 14);
          }
          return secondWeekDate;
        }
      }
      
      case 'MONTHLY': {
        const targetDay = groupData.collectionDayOfMonth || 1;
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        let dueDate = new Date(currentYear, currentMonth, targetDay);
        
        // If the target day has passed this month, move to next month
        if (dueDate <= today) {
          dueDate = new Date(currentYear, currentMonth + 1, targetDay);
        }
        
        // Handle months with fewer days (e.g., February 30 -> February 28/29)
        if (dueDate.getMonth() !== (currentMonth + 1) % 12) {
          dueDate = new Date(currentYear, currentMonth + 1, 0); // Last day of the month
        }
        
        return dueDate;
      }
      
      case 'YEARLY': {
        const targetDay = groupData.collectionDayOfMonth || 1;
        const targetMonth = 0; // January by default, can be extended to support specific months
        const currentYear = today.getFullYear();
        let dueDate = new Date(currentYear, targetMonth, targetDay);
        
        // If the target date has passed this year, move to next year
        if (dueDate <= today) {
          dueDate = new Date(currentYear + 1, targetMonth, targetDay);
        }
        
        return dueDate;
      }
      
      default:
        return today;
    }
  };

  // Calculate the current period's due date (for late fine calculation)
  const calculateCurrentPeriodDueDate = (groupData: GroupData, activePeriod: typeof currentPeriod): Date => {
    const today = new Date();
    const frequency = groupData.collectionFrequency || 'MONTHLY';
    
    console.log(`🔍 [DUE DATE CALCULATION] Starting calculation:`, {
      frequency,
      activePeriod: activePeriod ? {
        id: activePeriod.id,
        startDate: activePeriod.startDate,
        periodNumber: activePeriod.periodNumber
      } : null,
      today: today.toDateString()
    });
    
    switch (frequency) {
      case 'WEEKLY': {
        const targetDay = getDayOfWeekNumber(groupData.collectionDayOfWeek || 'MONDAY');
        const currentDay = today.getDay();
        // Find the most recent target day (could be today or in the past)
        const daysFromTarget = (currentDay - targetDay + 7) % 7;
        const dueDate = new Date(today);
        dueDate.setDate(today.getDate() - daysFromTarget);
        return dueDate;
      }
      
      case 'FORTNIGHTLY': {
        // For fortnightly, find the most recent occurrence of the target day
        const targetDay = getDayOfWeekNumber(groupData.collectionDayOfWeek || 'MONDAY');
        const weekOfMonth = groupData.collectionWeekOfMonth || 1;
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        // Calculate the target dates for current month
        const firstWeekDate = new Date(currentYear, currentMonth, 1);
        firstWeekDate.setDate(1 + ((targetDay - firstWeekDate.getDay() + 7) % 7));
        
        const secondWeekDate = new Date(firstWeekDate);
        secondWeekDate.setDate(firstWeekDate.getDate() + 7);
        
        const thirdWeekDate = new Date(firstWeekDate);
        thirdWeekDate.setDate(firstWeekDate.getDate() + 14);
        
        const fourthWeekDate = new Date(firstWeekDate);
        fourthWeekDate.setDate(firstWeekDate.getDate() + 21);
        
        const targetDates = [];
        if (weekOfMonth === 1 || weekOfMonth === 3) {
          targetDates.push(firstWeekDate, thirdWeekDate);
        } else {
          targetDates.push(secondWeekDate, fourthWeekDate);
        }
        
        // Find the most recent target date that's not in the future
        const validDates = targetDates.filter(date => date <= today);
        if (validDates.length > 0) {
          return validDates[validDates.length - 1]!;
        }
        
        // If no valid date in current month, check previous month
        const prevMonth = new Date(currentYear, currentMonth - 1, 1);
        const prevFirstWeek = new Date(prevMonth);
        prevFirstWeek.setDate(1 + ((targetDay - prevFirstWeek.getDay() + 7) % 7));
        
        if (weekOfMonth === 1 || weekOfMonth === 3) {
          const prevThirdWeek = new Date(prevFirstWeek);
          prevThirdWeek.setDate(prevFirstWeek.getDate() + 14);
          return prevThirdWeek <= today ? prevThirdWeek : prevFirstWeek;
        } else {
          const prevSecondWeek = new Date(prevFirstWeek);
          prevSecondWeek.setDate(prevFirstWeek.getDate() + 7);
          const prevFourthWeek = new Date(prevFirstWeek);
          prevFourthWeek.setDate(prevFirstWeek.getDate() + 21);
          return prevFourthWeek <= today ? prevFourthWeek : prevSecondWeek;
        }
      }
      
      case 'MONTHLY': {
        const targetDay = groupData.collectionDayOfMonth || 1;
        
        console.log(`🔍 [DUE DATE DEBUG] Monthly calculation started:`);
        console.log(`   Target Day: ${targetDay}`);
        console.log(`   Active Period:`, activePeriod);
        
        // **FIX: Use active period's month instead of current calendar month**
        if (activePeriod && activePeriod.startDate) {
          // Use the active period's month for calculation
          const periodDate = new Date(activePeriod.startDate);
          const periodMonth = periodDate.getMonth();
          const periodYear = periodDate.getFullYear();
          
          let dueDate = new Date(periodYear, periodMonth, targetDay);
          
          // Handle months with fewer days
          if (dueDate.getMonth() !== periodMonth) {
            dueDate = new Date(periodYear, periodMonth + 1, 0); // Last day of period month
          }
          
          console.log(`🔍 [DUE DATE FIX] Using active period month for due date calculation:`);
          console.log(`   Active Period: ${periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
          console.log(`   Target Day: ${targetDay}`);
          console.log(`   Calculated Due Date: ${dueDate.toDateString()}`);
          
          return dueDate;
        }
        
        // Fallback to current month if no active period information
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        let dueDate = new Date(currentYear, currentMonth, targetDay);
        
        // Handle months with fewer days
        if (dueDate.getMonth() !== currentMonth) {
          dueDate = new Date(currentYear, currentMonth + 1, 0); // Last day of current month
        }
        
        console.log(`⚠️ [DUE DATE FALLBACK] No active period info, using current month:`);
        console.log(`   Current Month: ${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
        console.log(`   Fallback Due Date: ${dueDate.toDateString()}`);
        console.log(`   This is likely causing the incorrect overdue calculation!`);
        
        return dueDate;
      }
      
      case 'YEARLY': {
        const targetDay = groupData.collectionDayOfMonth || 1;
        const targetMonth = 0; // January by default
        const currentYear = today.getFullYear();
        let dueDate = new Date(currentYear, targetMonth, targetDay);
        
        // If the target date hasn't passed this year, use last year's date
        if (dueDate > today) {
          dueDate = new Date(currentYear - 1, targetMonth, targetDay);
        }
        
        return dueDate;
      }
      
      default:
        return today;
    }
  };

  // Helper function to convert day name to number (0 = Sunday, 1 = Monday, etc.)
  const getDayOfWeekNumber = (dayName: string): number => {
    const days = {
      'SUNDAY': 0,
      'MONDAY': 1,
      'TUESDAY': 2,
      'WEDNESDAY': 3,
      'THURSDAY': 4,
      'FRIDAY': 5,
      'SATURDAY': 6
    };
    return days[dayName as keyof typeof days] || 1;
  };

  // Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
  // Commented out as it's not being used
  // const getOrdinalSuffix = (day: number): string => {
  //   if (day > 3 && day < 21) return 'th';
  //   switch (day % 10) {
  //     case 1: return 'st';
  //     case 2: return 'nd';
  //     case 3: return 'rd';
  //     default: return 'th';
  //   }
  // };

  // Calculate late fine based on group's late fine rules
  const calculateLateFine = (groupData: GroupData, daysLate: number, expectedContribution: number): number => {
    const lateFineRule = groupData.lateFineRules?.[0];
    
    if (!lateFineRule || !lateFineRule.isEnabled || daysLate <= 0) {
      return 0;
    }

    switch (lateFineRule.ruleType) {
      case 'DAILY_FIXED':
        return roundToTwoDecimals((lateFineRule.dailyAmount || 0) * daysLate);
      
      case 'DAILY_PERCENTAGE':
        return roundToTwoDecimals(expectedContribution * (lateFineRule.dailyPercentage || 0) / 100 * daysLate);
      
      case 'TIER_BASED':
        const tierRules = lateFineRule.tierRules || [];
        
        if (tierRules.length === 0) {
          return 0;
        }
        
        // Calculate cumulative fine for all days (tier-based is per day, not total)
        let totalFine = 0;
        
        for (let day = 1; day <= daysLate; day++) {
          // Find the applicable tier for this specific day
          const applicableTier = tierRules.find(tier => 
            day >= tier.startDay && day <= tier.endDay
          );
          
          if (applicableTier) {
            // Add the daily fine for this day based on its tier
            if (applicableTier.isPercentage) {
              const tierRate = applicableTier.amount / 100;
              totalFine += expectedContribution * tierRate; // Daily percentage fine
            } else {
              totalFine += applicableTier.amount; // Daily fixed fine
            }
          }
        }
        
        return roundToTwoDecimals(totalFine);
      
      default:
        return 0;
    }
  };

  const calculateMemberContributions = (groupData: GroupData, actualContributions: Record<string, any> = {}): MemberContributionStatus[] => {
    const expectedContribution = groupData.monthlyContribution || 0;
    const interestRate = (groupData.interestRate || 0) / 100;
    const currentPeriodDueDate = calculateCurrentPeriodDueDate(groupData, currentPeriod);
    const today = new Date();
    
    return groupData.members.map(member => {
      const currentLoanBalance = member.currentLoanBalance || 0;
      // Fix: Calculate period-adjusted interest instead of annual interest
      const expectedInterest = roundToTwoDecimals(calculatePeriodInterestFromDecimal(
        currentLoanBalance,
        interestRate,
        groupData.collectionFrequency || 'MONTHLY'
      ));
      
      // Always calculate days late and late fine using frontend logic
      // Backend calculation is not reliable for late fines currently
      let daysLate = 0;
      let lateFineAmount = 0;
      
      // Calculate days late based on current period due date
      daysLate = Math.max(0, Math.floor((today.getTime() - currentPeriodDueDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Calculate late fine using frontend calculation (now fixed)
      lateFineAmount = calculateLateFine(groupData, daysLate, expectedContribution);
      
      const totalExpected = roundToTwoDecimals(expectedContribution + expectedInterest + lateFineAmount);
      
      // Use actual payment data from MemberContribution records if available
      const actualContribution = actualContributions[member.id];
      let paidAmount = 0;
      let status: 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE' = 'PENDING';
      let lastPaymentDate: string | undefined;

      if (actualContribution) {
        // Get data from actual MemberContribution record
        paidAmount = roundToTwoDecimals(actualContribution.totalPaid || 0);
        lastPaymentDate = actualContribution.paidDate;
        
        // Calculate remaining amount first to ensure accurate status
        const remainingAmountRaw = totalExpected - paidAmount;
        
        // Determine status based on actual payment with better precision handling
        if (remainingAmountRaw <= 0.01) { // Allow for small rounding errors (1 cent)
          status = 'PAID';
        } else if (paidAmount > 0) {
          status = daysLate > 0 ? 'OVERDUE' : 'PARTIAL';
        } else if (daysLate > 0) {
          status = 'OVERDUE';
        }
      } else {
        // No contribution record exists yet - all amounts are pending
        paidAmount = 0;
        status = daysLate > 0 ? 'OVERDUE' : 'PENDING';
      }
      
      const remainingAmount = roundToTwoDecimals(Math.max(0, totalExpected - paidAmount));
      
      // Final status check: if remaining amount is essentially zero, mark as PAID
      if (remainingAmount <= 0.01 && paidAmount > 0) {
        status = 'PAID';
      }
      
      return {
        memberId: member.id,
        memberName: member.name,
        expectedContribution: roundToTwoDecimals(expectedContribution),
        expectedInterest,
        currentLoanBalance: roundToTwoDecimals(currentLoanBalance),
        lateFineAmount,
        daysLate,
        dueDate: currentPeriodDueDate,
        totalExpected,
        paidAmount,
        remainingAmount,
        status,
        lastPaymentDate,
      } as MemberContributionStatus;
    });
  };

  // Function to dynamically update cash and bank allocation based on payment amounts
  const updateCashBankAllocation = (memberId: string, currentCollection: any) => {
    const totalPaid = (currentCollection.compulsoryContribution || 0) + 
                     (currentCollection.interestPaid || 0) + 
                     (currentCollection.lateFinePaid || 0);
    
    if (totalPaid > 0) {
      // Auto-distribute cash vs bank (default 30% cash, 70% bank)
      const defaultCashRatio = 0.3;
      const defaultBankRatio = 0.7;
      
      const newCashAmount = Math.round(totalPaid * defaultCashRatio * 100) / 100;
      const newBankAmount = Math.round(totalPaid * defaultBankRatio * 100) / 100;
      
      setMemberCollections(prev => ({
        ...prev,
        [memberId]: {
          ...currentCollection,
          cashAmount: newCashAmount,
          bankAmount: newBankAmount
        }
      }));
    }
  };

  // New function to submit member collection with automatic distribution
  const submitMemberCollection = async (memberId: string, collection: {
    cashAmount: number;
    bankAmount: number;
    compulsoryContribution: number;
    interestPaid: number;
    loanRepayment: number;
    lateFinePaid: number;
    remainingLoan: number;
  }) => {
    setSavingPayment(memberId);
    try {
      const totalAmount = collection.cashAmount + collection.bankAmount;
      
      if (totalAmount <= 0) {
        throw new Error('Collection amount must be greater than zero');
      }

      // Find or create contribution record
      let memberContribution = actualContributions[memberId];
      
      if (!memberContribution) {
        // Create a new contribution record
        try {
          const member = group?.members.find((m: any) => m.id === memberId || m.memberId === memberId);
          if (!member) {
            throw new Error('Member not found');
          }

          const createResponse = await fetch(`/api/groups/${groupId}/contributions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: memberId,
              periodId: currentPeriod?.id
            })
          });

          if (!createResponse.ok) {
            throw new Error('Failed to create contribution record');
          }

          const newContribution = await createResponse.json();
          memberContribution = newContribution;
          setActualContributions((prev: any) => ({
            ...prev,
            [memberId]: newContribution
          }));
        } catch (createError) {
          console.error('Failed to create contribution record:', createError);
          throw new Error(`Unable to process payment: ${createError instanceof Error ? createError.message : 'Failed to create contribution record'}`);
        }
      }

      if (!memberContribution) {
        throw new Error('Failed to create or find contribution record');
      }

      // Prepare cash allocation based on collection type
      const cashAllocation = {
        contributionToCashInHand: collection.compulsoryContribution * (collection.cashAmount / totalAmount),
        contributionToCashInBank: collection.compulsoryContribution * (collection.bankAmount / totalAmount),
        interestToCashInHand: collection.interestPaid * (collection.cashAmount / totalAmount),
        interestToCashInBank: collection.interestPaid * (collection.bankAmount / totalAmount),
        lateFineToCashInHand: (collection.lateFinePaid || 0) * (collection.cashAmount / totalAmount),
        lateFineToCashInBank: (collection.lateFinePaid || 0) * (collection.bankAmount / totalAmount)
      };

      // Update the contribution via API
      const response = await fetch(`/api/groups/${groupId}/contributions/${memberContribution.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compulsoryContributionPaid: collection.compulsoryContribution,
          loanInterestPaid: collection.interestPaid,
          lateFinePaid: collection.lateFinePaid || 0,
          totalPaid: collection.compulsoryContribution + collection.interestPaid + (collection.lateFinePaid || 0),
          cashAllocation: cashAllocation
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update contribution');
      }

      const { contribution: updatedContribution } = await response.json();

      // Update local state
      setActualContributions((prev: any) => ({
        ...prev,
        [memberId]: updatedContribution
      }));

      // Handle loan repayment if any
      if (collection.loanRepayment > 0) {
        const loanResponse = await fetch(`/api/groups/${groupId}/loans/repay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: memberId,
            amount: collection.loanRepayment
          })
        });

        if (!loanResponse.ok) {
          console.warn('Loan repayment failed but contribution was recorded');
        }
      }

      // Refresh group data to update loan balances
      await fetchGroupData();
      
      // Clear the member collection data after successful submission
      setMemberCollections((prev: any) => {
        const newState = { ...prev };
        delete newState[memberId];
        return newState;
      });

      alert(`Collection submitted successfully! Contribution: ₹${collection.compulsoryContribution}, Interest: ₹${collection.interestPaid}, Late Fine: ₹${collection.lateFinePaid || 0}, Loan Repayment: ₹${collection.loanRepayment}`);
      
    } catch (err) {
      console.error('Error submitting collection:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit collection';
      alert(`Error: ${errorMessage}`);
    } finally {
      setSavingPayment(null);
    }
  };

  const markContributionPaid = async (memberId: string, amount: number, cashAllocation?: {
    contributionToCashInHand: number;
    contributionToCashInBank: number;
    interestToCashInHand: number;
    interestToCashInBank: number;
  }) => {
    setSavingPayment(memberId);
    try {
      // OVERPAYMENT PREVENTION: Check if payment exceeds remaining amount
      const memberContribData = memberContributions.find(c => c.memberId === memberId);
      if (!memberContribData) {
        throw new Error('Member contribution data not found');
      }
      
      if (amount > memberContribData.remainingAmount) {
        throw new Error(`Payment amount ₹${amount.toLocaleString()} exceeds remaining amount ₹${memberContribData.remainingAmount.toLocaleString()}. Maximum allowed: ₹${memberContribData.remainingAmount.toFixed(2)}`);
      }
      
      if (amount <= 0) {
        throw new Error('Payment amount must be greater than zero');
      }
      // Find the contribution record for this member
      let memberContribution = actualContributions[memberId];
      
      // If no contribution record exists, create one
      if (!memberContribution) {
        try {
          console.log(`No contribution record found for member ${memberId}, creating one...`);
          
          // Get member info for the creation
          const member = group?.members.find(m => m.id === memberId || m.memberId === memberId);
          if (!member) {
            throw new Error('Member not found in group');
          }

          // Create a new contribution record via API
          const createResponse = await fetch(`/api/groups/${params.id}/contributions/current`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: memberId,
              compulsoryContributionDue: group?.monthlyContribution || 0,
              loanInterestDue: 0 // Will be calculated by the API if needed
            })
          });

          if (!createResponse.ok) {
            throw new Error('Failed to create contribution record');
          }

          const newContribution = await createResponse.json();
          
          // Update local state with the new contribution
          memberContribution = newContribution;
          setActualContributions(prev => ({
            ...prev,
            [memberId]: newContribution
          }));
          
          console.log('Successfully created contribution record for member:', memberId);
        } catch (createError) {
          console.error('Failed to create contribution record:', createError);
          throw new Error(`Unable to process payment: ${createError instanceof Error ? createError.message : 'Failed to create contribution record'}`);
        }
      }

      // Calculate how to allocate the payment
      const memberContrib = memberContributions.find(c => c.memberId === memberId);
      if (!memberContrib) {
        throw new Error('Member contribution data not found');
      }

      // Get the actual contribution record
      if (!memberContribution) {
        throw new Error('Member contribution record not found');
      }

      // Allocate payment: first to compulsory contribution, then interest, then late fine
      let remainingPayment = roundToTwoDecimals(amount);
      let compulsoryPaid = roundToTwoDecimals(memberContribution.compulsoryContributionPaid || 0);
      let interestPaid = roundToTwoDecimals(memberContribution.loanInterestPaid || 0);
      let lateFinesPaid = roundToTwoDecimals(memberContribution.lateFinePaid || 0);

      // Pay compulsory contribution first
      if (remainingPayment > 0 && compulsoryPaid < memberContrib.expectedContribution) {
        const needToPayCompulsory = roundToTwoDecimals(memberContrib.expectedContribution - compulsoryPaid);
        const payCompulsory = roundToTwoDecimals(Math.min(remainingPayment, needToPayCompulsory));
        compulsoryPaid = roundToTwoDecimals(compulsoryPaid + payCompulsory);
        remainingPayment = roundToTwoDecimals(remainingPayment - payCompulsory);
      }

      // Pay interest second
      if (remainingPayment > 0 && interestPaid < memberContrib.expectedInterest) {
        const needToPayInterest = roundToTwoDecimals(memberContrib.expectedInterest - interestPaid);
        const payInterest = roundToTwoDecimals(Math.min(remainingPayment, needToPayInterest));
        interestPaid = roundToTwoDecimals(interestPaid + payInterest);
        remainingPayment = roundToTwoDecimals(remainingPayment - payInterest);
      }

      // Pay late fines last
      if (remainingPayment > 0 && lateFinesPaid < memberContrib.lateFineAmount) {
        const needToPayLateFines = roundToTwoDecimals(memberContrib.lateFineAmount - lateFinesPaid);
        const payLateFines = roundToTwoDecimals(Math.min(remainingPayment, needToPayLateFines));
        lateFinesPaid = roundToTwoDecimals(lateFinesPaid + payLateFines);
        remainingPayment = roundToTwoDecimals(remainingPayment - payLateFines);
      }

      // Update the contribution via API with cash allocation data
      const response = await fetch(`/api/groups/${groupId}/contributions/${memberContribution.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compulsoryContributionPaid: compulsoryPaid,
          loanInterestPaid: interestPaid,
          lateFinePaid: lateFinesPaid,
          totalPaid: roundToTwoDecimals((memberContribution.totalPaid || 0) + amount),
          cashAllocation: cashAllocation || {
            contributionToCashInHand: amount,
            contributionToCashInBank: 0,
            interestToCashInHand: 0,
            interestToCashInBank: 0
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update payment');
      }

      const { contribution: updatedContribution } = await response.json();

      // Update local state with the API response
      setActualContributions(prev => ({
        ...prev,
        [memberId]: updatedContribution
      }));

      // Recalculate member contributions with updated payment data
      if (group) {
        const updatedPaymentData = {
          ...actualContributions,
          [memberId]: updatedContribution
        };
        const recalculatedContributions = calculateMemberContributions(group, updatedPaymentData);
        setMemberContributions(recalculatedContributions);
      }
      
    } catch (err) {
      console.error('Error updating payment:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update payment';
      
      // Provide more user-friendly error messages
      let userMessage = errorMessage;
      if (errorMessage.includes('No contribution record found')) {
        userMessage = 'Unable to process payment. The contribution record for this member could not be found or created. Please try refreshing the page or contact support.';
      } else if (errorMessage.includes('Member not found')) {
        userMessage = 'Member information could not be found. Please refresh the page and try again.';
      } else if (errorMessage.includes('Failed to create contribution record')) {
        userMessage = 'Unable to create contribution record. Please ensure you have proper permissions and try again.';
      }
      
      alert(userMessage);
    } finally {
      setSavingPayment(null);
    }
  };

  // Payment modal helper functions
  const markContributionUnpaid = async (memberId: string) => {
    if (!confirm('Are you sure you want to mark this contribution as unpaid? This will reset all payment records for this member.')) {
      return;
    }

    setSavingPayment(memberId);
    try {
      // Find the contribution record for this member
      const memberContribution = actualContributions[memberId];
      if (!memberContribution) {
        throw new Error('Member contribution record not found');
      }

      // Reset all payment amounts to 0
      const response = await fetch(`/api/groups/${groupId}/contributions/${memberContribution.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compulsoryContributionPaid: 0,
          loanInterestPaid: 0,
          lateFinePaid: 0,
          totalPaid: 0,
          status: 'PENDING',
          cashAllocation: {
            contributionToCashInHand: 0,
            contributionToCashInBank: 0,
            interestToCashInHand: 0,
            interestToCashInBank: 0
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark as unpaid');
      }

      const { contribution: updatedContribution } = await response.json();

      // Update local state with the API response
      setActualContributions(prev => ({
        ...prev,
        [memberId]: updatedContribution
      }));

      // Recalculate member contributions with updated payment data
      if (group) {
        const updatedPaymentData = {
          ...actualContributions,
          [memberId]: updatedContribution
        };
        const recalculatedContributions = calculateMemberContributions(group, updatedPaymentData);
        setMemberContributions(recalculatedContributions);
      }
      
    } catch (err) {
      console.error('Error marking contribution as unpaid:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark as unpaid';
      alert(`Error: ${errorMessage}`);
    } finally {
      setSavingPayment(null);
    }
  };

  // Payment modal helper functions
  const calculateAutoAllocation = () => {
    if (!selectedMember) return;
    
    const paymentAmt = Number(paymentAmount) || 0;
    if (paymentAmt <= 0) return;
    
    // Auto-allocate based on payment distribution
    let remainingPayment = paymentAmt;
    let contributionPayment = 0;
    let interestPayment = 0;
    
    // First allocate to compulsory contribution
    if (remainingPayment > 0 && selectedMember.expectedContribution > 0) {
      contributionPayment = Math.min(remainingPayment, selectedMember.expectedContribution);
      remainingPayment -= contributionPayment;
    }
    
    // Then allocate to interest
    if (remainingPayment > 0 && selectedMember.expectedInterest > 0) {
      interestPayment = Math.min(remainingPayment, selectedMember.expectedInterest);
      remainingPayment -= interestPayment;
    }
    
    // Set the allocation amounts
    setContributionAllocation({
      cashInHand: roundToTwoDecimals(contributionPayment * 0.3), // 30% to hand by default
      cashInBank: roundToTwoDecimals(contributionPayment * 0.7)  // 70% to bank by default
    });
    
    setInterestAllocation({
      cashInHand: roundToTwoDecimals(interestPayment * 0.3),
      cashInBank: roundToTwoDecimals(interestPayment * 0.7)
    });
  };

  const generateReport = async () => {
    setShowReportModal(true);
  };

  // Function to generate CSV report
  const generateCSVReport = () => {
    if (!group) return;
    
    try {
      // Calculate cash allocation totals
      const totalCashInHand = Object.values(actualContributions).reduce((sum, record) => {
        if (record.cashAllocation) {
          try {
            const allocation = JSON.parse(record.cashAllocation);
            return sum + (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
          } catch (_e) {
            return sum;
          }
        }
        return sum;
      }, 0);
      
      const totalCashInBank = Object.values(actualContributions).reduce((sum, record) => {
        if (record.cashAllocation) {
          try {
            const allocation = JSON.parse(record.cashAllocation);
            return sum + (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
          } catch (_e) {
            return sum;
          }
        }
        return sum;
      }, 0);

      // Create report data with cash allocation breakdown
      const reportData = memberContributions.map(member => {
        // Parse cash allocation if it exists
        let cashInHand = 0;
        let cashInBank = 0;
        
        const contributionRecord = actualContributions[member.memberId];
        if (contributionRecord && contributionRecord.cashAllocation) {
          try {
            const allocation = JSON.parse(contributionRecord.cashAllocation);
            cashInHand = (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
            cashInBank = (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
          } catch (e) {
            console.error('Error parsing cash allocation:', e);
          }
        }
        
        return {
          'Member Name': member.memberName,
          'Expected Contribution': member.expectedContribution,
          'Expected Interest': member.expectedInterest,
          'Late Fine': member.lateFineAmount || 0,
          'Days Late': member.daysLate || 0,
          'Total Expected': member.totalExpected,
          'Amount Paid': member.paidAmount,
          'Cash in Hand': cashInHand,
          'Cash in Bank': cashInBank,
          'Current Loan Amount': member.currentLoanBalance || 0,
          'Remaining Amount': member.remainingAmount,
          'Status': member.status,
          'Payment Date': (contributionRecord?.paidDate) ? 
            new Date(contributionRecord.paidDate).toLocaleDateString() : 'Not Paid'
        };
      });

      // Calculate totals for summary
      const totalLoanAmounts = memberContributions.reduce((sum, c) => sum + (c.currentLoanBalance || 0), 0);

      // Add summary row with cash allocation totals
      const summaryRow = {
        'Member Name': 'TOTAL SUMMARY',
        'Expected Contribution': memberContributions.reduce((sum, c) => sum + c.expectedContribution, 0),
        'Expected Interest': memberContributions.reduce((sum, c) => sum + c.expectedInterest, 0),
        'Late Fine': memberContributions.reduce((sum, c) => sum + (c.lateFineAmount || 0), 0),
        'Days Late': '---',
        'Total Expected': memberContributions.reduce((sum, c) => sum + c.totalExpected, 0),
        'Amount Paid': memberContributions.reduce((sum, c) => sum + c.paidAmount, 0),
        'Cash in Hand': totalCashInHand,
        'Cash in Bank': totalCashInBank,
        'Current Loan Amount': totalLoanAmounts,
        'Remaining Amount': memberContributions.reduce((sum, c) => sum + c.remainingAmount, 0),
        'Status': `${memberContributions.filter(c => c.status === 'PAID').length}/${memberContributions.length} Completed`,
        'Payment Date': ''
      };

      // Calculate collection statistics for report footer
      const totalExpected = memberContributions.reduce((sum, c) => sum + c.totalExpected, 0);
      const totalCollected = memberContributions.reduce((sum, c) => sum + c.paidAmount, 0);
      const totalLateFines = memberContributions.reduce((sum, c) => sum + (c.lateFineAmount || 0), 0);
      const membersWithLateFines = memberContributions.filter(c => (c.lateFineAmount || 0) > 0).length;
      const membersOverdue = memberContributions.filter(c => (c.daysLate || 0) > 0).length;
      
      // Fix: Cap collection rate at 100% and round to prevent precision errors
      const collectionRate = totalExpected > 0 ? Math.min((totalCollected / totalExpected) * 100, 100) : 0;
      const groupStanding = totalCollected + (group.cashInHand || 0) + (group.balanceInBank || 0) + totalLoanAmounts;
      const sharePerMember = group.memberCount > 0 ? groupStanding / group.memberCount : 0;

      // Create enhanced CSV content with better headers and summary section
      const csvContent = [
        // Title
        ['CONTRIBUTION REPORT'],
        [''], // Empty row
        // Header info
        [`Group:,${group.name},,Monthly Contribution:,₹${group.monthlyContribution?.toLocaleString()}`],
        [`Report Date:,${new Date().toLocaleDateString()},,Interest Rate:,${group.interestRate || 0}%`],
        [`Collection Frequency:,${group.collectionFrequency || 'Monthly'}`],
        [''], // Empty row for spacing
        // Column headers
        Object.keys(reportData[0] || {}),
        // Data rows
        ...reportData.map(row => Object.values(row)),
        [''], // Empty row before summary
        Object.values(summaryRow),
        [''], // Empty row after summary
        ['COLLECTION STATISTICS & SUMMARY'],
        [''], // Empty row
        ['Collection Statistics:,,Cash Allocation:,,Group Standing:'],
        [`Total Expected:,₹${totalExpected.toLocaleString()},Cash in Hand:,₹${totalCashInHand.toLocaleString()},Group Standing:,₹${groupStanding.toLocaleString()}`],
        [`Total Collected:,₹${totalCollected.toLocaleString()},Cash in Bank:,₹${totalCashInBank.toLocaleString()},Total Revenue:,₹${totalCollected.toLocaleString()}`],
        [`Collection Rate:,${collectionRate.toFixed(1)}%,Total Loan Amounts:,₹${totalLoanAmounts.toLocaleString()},Share per Member:,₹${sharePerMember.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
        [`Members Completed:,${memberContributions.filter(c => c.status === 'PAID').length}/${memberContributions.length},,,,`],
        [''], // Empty row
        ['Late Fine Details:,,,,'],
        [`Total Late Fines:,₹${totalLateFines.toLocaleString()},Members with Late Fines:,${membersWithLateFines}/${memberContributions.length},Members Overdue:,${membersOverdue}/${memberContributions.length}`],
        [''], // Empty row
        [`Generated on ${new Date().toLocaleString()}`]
      ].map(row => {
        // Make sure all elements in the row are strings to avoid CSV parsing issues
        return row.map(cell => {
          if (cell === null || cell === undefined) return '';
          if (typeof cell === 'string') return `"${cell.replace(/"/g, '""')}"`;
          return cell;
        }).join(',');
      }).join('\n');

      // Download CSV with better filename
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${group.name}_Contributions_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      setShowReportModal(false);
    } catch (err) {
      console.error('CSV generation error:', err);
      alert(err instanceof Error ? err.message : 'An error occurred generating CSV');
    }
  };

  // Function to generate Excel report
  const generateExcelReport = async () => {
    if (!group) return;
    
    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Contributions Report');

      // Title row with colored header
      const titleRow = worksheet.addRow(['CONTRIBUTION REPORT']);
      titleRow.height = 30;
      titleRow.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
      worksheet.mergeCells('A1:M1');
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('A1').fill = { 
        type: 'pattern', 
        pattern: 'solid', 
        fgColor: { argb: '4831D4' } // Primary color (72, 49, 212)
      };

      // Group info section with light gray background
      worksheet.addRow([]);
      
      // Add group info with better formatting
      const infoSection = [
        ['Group Name:', group.name, '', 'Monthly Contribution:', `₹${group.monthlyContribution?.toLocaleString()}`],
        ['Report Date:', new Date().toLocaleDateString(), '', 'Interest Rate:', `${group.interestRate || 0}%`],
        ['Collection Frequency:', group.collectionFrequency || 'Monthly', '', '', '']
      ];
      
      // Add group info rows with formatting
      let rowNum = 3;
      infoSection.forEach(rowData => {
        const row = worksheet.addRow(rowData);
        rowNum++;
        
        // Format label cells (columns A, D)
        [1, 4].forEach(col => {
          if (rowData[col-1]) {
            const cell = row.getCell(col);
            cell.font = { bold: true };
          }
        });
      });
      
      // Style the info section
      worksheet.mergeCells(`A3:M${rowNum}`);
      for (let i = 3; i <= rowNum; i++) {
        for (let j = 1; j <= 13; j++) {
          const cell = worksheet.getCell(i, j);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } }; // Light gray
        }
      }
      
      worksheet.addRow([]); // Empty row before table
      rowNum++;
      
      // Headers with better formatting and current loan amount
      const headers = [
        'Member Name', 'Expected Contribution', 'Expected Interest', 'Late Fine', 'Days Late',
        'Total Expected', 'Amount Paid', 'Cash in Hand', 'Cash in Bank',
        'Current Loan Amount', 'Remaining Amount', 'Status', 'Payment Date'
      ];
      const headerRow = worksheet.addRow(headers);
      rowNum++;
      
      // Style headers with primary color
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4831D4' } }; // Primary color
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Data rows with cash allocation breakdown and loan amounts
      let rowCount = 0;
      memberContributions.forEach(member => {
        // Parse cash allocation if it exists
        let cashInHand = 0;
        let cashInBank = 0;
        
        const contributionRecord = actualContributions[member.memberId];
        if (contributionRecord && contributionRecord.cashAllocation) {
          try {
            const allocation = JSON.parse(contributionRecord.cashAllocation);
            cashInHand = (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
            cashInBank = (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
          } catch (e) {
            console.error('Error parsing cash allocation:', e);
          }
        }
        
        const row = worksheet.addRow([
          member.memberName || '',
          formatCurrency(member.expectedContribution),
          formatCurrency(member.expectedInterest),
          formatCurrency(member.lateFineAmount || 0),
          (member.daysLate || 0).toString(),
          formatCurrency(member.totalExpected),
          formatCurrency(member.paidAmount),
          formatCurrency(cashInHand),
          formatCurrency(cashInBank),
          formatCurrency(member.currentLoanBalance),
          formatCurrency(member.remainingAmount),
          member.status || 'PENDING'
        ]);
        rowNum++;
        rowCount++;
        
        // Apply alternate row styling
        if (rowCount % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } }; // Light gray for alternating rows
          });
        }
        
        // Apply special formatting to status column (column J)
        const statusCell = row.getCell(10);
        if (member.status === 'PAID') {
          statusCell.font = { color: { argb: '2E7D32' } }; // Green color for PAID
        } else if (member.status === 'PARTIAL') {
          statusCell.font = { color: { argb: 'C68200' } }; // Orange color for PARTIAL
        } else if (member.status === 'OVERDUE') {
          statusCell.font = { color: { argb: 'C62828' } }; // Red color for OVERDUE
        }
      });

      // Calculate totals for summary
      const totalLoanAmounts = memberContributions.reduce((sum, c) => sum + (c.currentLoanBalance || 0), 0);

      // Add summary row with cash allocation totals
      const summaryRow = {
        'Member Name': 'TOTAL SUMMARY',
        'Expected Contribution': memberContributions.reduce((sum, c) => sum + c.expectedContribution, 0),
        'Expected Interest': memberContributions.reduce((sum, c) => sum + c.expectedInterest, 0),
        'Late Fine': memberContributions.reduce((sum, c) => sum + (c.lateFineAmount || 0), 0),
        'Days Late': '---',
        'Total Expected': memberContributions.reduce((sum, c) => sum + c.totalExpected, 0),
        'Amount Paid': memberContributions.reduce((sum, c) => sum + c.paidAmount, 0),
        'Cash in Hand': totalCashInHand,
        'Cash in Bank': totalCashInBank,
        'Current Loan Amount': totalLoanAmounts,
        'Remaining Amount': memberContributions.reduce((sum, c) => sum + c.remainingAmount, 0),
        'Status': `${memberContributions.filter(c => c.status === 'PAID').length}/${memberContributions.length} Completed`,
        'Payment Date': ''
      };

      // Calculate collection statistics for report footer
      const totalExpected = memberContributions.reduce((sum, c) => sum + c.totalExpected, 0);
      const totalCollected = memberContributions.reduce((sum, c) => sum + c.paidAmount, 0);
      const totalLateFines = memberContributions.reduce((sum, c) => sum + (c.lateFineAmount || 0), 0);
      const membersWithLateFines = memberContributions.filter(c => (c.lateFineAmount || 0) > 0).length;
      const membersOverdue = memberContributions.filter(c => (c.daysLate || 0) > 0).length;
      
      // Fix: Cap collection rate at 100% and round to prevent precision errors
      const collectionRate = totalExpected > 0 ? Math.min((totalCollected / totalExpected) * 100, 100) : 0;
      const groupStanding = totalCollected + (group.cashInHand || 0) + (group.balanceInBank || 0) + totalLoanAmounts;
      const sharePerMember = group.memberCount > 0 ? groupStanding / group.memberCount : 0;

      // Create enhanced CSV content with better headers and summary section
      const csvContent = [
        // Title
        ['CONTRIBUTION REPORT'],
        [''], // Empty row
        // Header info
        [`Group:,${group.name},,Monthly Contribution:,₹${group.monthlyContribution?.toLocaleString()}`],
        [`Report Date:,${new Date().toLocaleDateString()},,Interest Rate:,${group.interestRate || 0}%`],
        [`Collection Frequency:,${group.collectionFrequency || 'Monthly'}`],
        [''], // Empty row for spacing
        // Column headers
        Object.keys(reportData[0] || {}),
        // Data rows
        ...reportData.map(row => Object.values(row)),
        [''], // Empty row before summary
        Object.values(summaryRow),
        [''], // Empty row after summary
        ['COLLECTION STATISTICS & SUMMARY'],
        [''], // Empty row
        ['Collection Statistics:,,Cash Allocation:,,Group Standing:'],
        [`Total Expected:,₹${totalExpected.toLocaleString()},Cash in Hand:,₹${totalCashInHand.toLocaleString()},Group Standing:,₹${groupStanding.toLocaleString()}`],
        [`Total Collected:,₹${totalCollected.toLocaleString()},Cash in Bank:,₹${totalCashInBank.toLocaleString()},Total Revenue:,₹${totalCollected.toLocaleString()}`],
        [`Collection Rate:,${collectionRate.toFixed(1)}%,Total Loan Amounts:,₹${totalLoanAmounts.toLocaleString()},Share per Member:,₹${sharePerMember.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
        [`Members Completed:,${memberContributions.filter(c => c.status === 'PAID').length}/${memberContributions.length},,,,`],
        [''], // Empty row
        ['Late Fine Details:,,,,'],
        [`Total Late Fines:,₹${totalLateFines.toLocaleString()},Members with Late Fines:,${membersWithLateFines}/${memberContributions.length},Members Overdue:,${membersOverdue}/${memberContributions.length}`],
        [''], // Empty row
        [`Generated on ${new Date().toLocaleString()}`]
      ].map(row => {
        // Make sure all elements in the row are strings to avoid CSV parsing issues
        return row.map(cell => {
          if (cell === null || cell === undefined) return '';
          if (typeof cell === 'string') return `"${cell.replace(/"/g, '""')}"`;
          return cell;
        }).join(',');
      }).join('\n');

      // Download CSV with better filename
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${group.name}_Contributions_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      setShowReportModal(false);
    } catch (err) {
      console.error('CSV generation error:', err);
      alert(err instanceof Error ? err.message : 'An error occurred generating CSV');
    }
  };



  // Function to generate PDF report
  const generatePDFReport = async () => {
    if (!group) return;
    
    // Helper function to safely format currency - robust approach
    const formatCurrency = (amount: number | undefined | null): string => {
      const numValue = Number(amount);
      if (isNaN(numValue)) return '0';
      if (numValue === 0) return '0';
      
      // Use simple formatting that PDF can definitely handle
      const formattedValue = numValue.toFixed(2);
      return `₹${formattedValue}`;
    };

    try {
      // Import jsPDF and autoTable dynamically to avoid SSR issues
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF();

      // Header with colored background
      doc.setFillColor(72, 49, 212); // Primary color (adjust as needed)
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 30, 'F');
      
      // Title with white text
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255); // White text
      doc.text('Contribution Report', 20, 20);
      
      // Group info - with better formatting
      doc.setFillColor(245, 247, 250); // Light gray background
      doc.rect(10, 35, doc.internal.pageSize.getWidth() - 20, 40, 'F');
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0); // Black text
      
      doc.setFont('helvetica', 'bold');
      doc.text('Group:', 20, 45);
      doc.setFont('helvetica', 'normal');
      doc.text(group.name, 65, 45);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Report Date:', 20, 55);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleDateString(), 65, 55);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Collection Frequency:', 20, 65);
      doc.setFont('helvetica', 'normal');
      doc.text(group.collectionFrequency || 'Monthly', 65, 65);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Monthly Contribution:', 120, 45);
      doc.setFont('helvetica', 'normal');
      doc.text(formatCurrency(group.monthlyContribution), 170, 45);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Interest Rate:', 120, 55);
      doc.setFont('helvetica', 'normal');
      doc.text(`${Number(group.interestRate) || 0}%`, 170, 55);

      // Calculate totals for group standing
      const totalExpected = memberContributions.reduce((sum, c) => sum + (c.totalExpected || 0), 0);
      const totalCollected = memberContributions.reduce((sum, c) => sum + (c.paidAmount || 0), 0);
      const totalLoanAmounts = memberContributions.reduce((sum, c) => sum + (c.currentLoanBalance || 0), 0);
      const totalLateFines = memberContributions.reduce((sum, c) => sum + (c.lateFineAmount || 0), 0);
      const membersWithLateFines = memberContributions.filter(c => (c.lateFineAmount || 0) > 0).length;
      const membersOverdue = memberContributions.filter(c => (c.daysLate || 0) > 0).length;
      const groupStanding = totalCollected + (group.cashInHand || 0) + (group.balanceInBank || 0) + totalLoanAmounts;
      const sharePerMember = group.memberCount > 0 ? groupStanding / group.memberCount : 0;

      // Prepare data for the table with cash allocation and loan amounts
      const tableData = memberContributions.map(member => {
        // Parse cash allocation if it exists
        let cashInHand = 0;
        let cashInBank = 0;
        
        const contributionRecord = actualContributions[member.memberId];
        if (contributionRecord && contributionRecord.cashAllocation) {
          try {
            const allocation = JSON.parse(contributionRecord.cashAllocation);
            cashInHand = Number((allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0)) || 0;
            cashInBank = Number((allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0)) || 0;
          } catch (e) {
            console.error('Error parsing cash allocation:', e);
          }
        }
        
        return [
          member.memberName || '',
          formatCurrency(member.expectedContribution),
          formatCurrency(member.expectedInterest),
          formatCurrency(member.lateFineAmount || 0),
          (member.daysLate || 0).toString(),
          formatCurrency(member.totalExpected),
          formatCurrency(member.paidAmount),
          formatCurrency(cashInHand),
          formatCurrency(cashInBank),
          formatCurrency(member.currentLoanBalance),
          formatCurrency(member.remainingAmount),
          member.status || 'PENDING'
        ];
      });

      // Debug: Log table data after creation
      console.log('Table data sample:', tableData.slice(0, 2));
      console.log('Sample formatted values:', {
        raw: memberContributions[0]?.expectedContribution,
        formatted: formatCurrency(memberContributions[0]?.expectedContribution)
      });
      
      // Calculate cash allocation totals
      const totalCashInHand = Object.values(actualContributions).reduce((sum, record) => {
        if (record.cashAllocation) {
          try {
            const allocation = JSON.parse(record.cashAllocation);
            return sum + (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
          } catch (_e) {
            return sum;
          }
        }
        return sum;
      }, 0);
      
      const totalCashInBank = Object.values(actualContributions).reduce((sum, record) => {
        if (record.cashAllocation) {
          try {
            const allocation = JSON.parse(record.cashAllocation);
            return sum + (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
          } catch (_e) {
            return sum;
          }
        }
        return sum;
      }, 0);

      // Use autoTable for better formatting
      autoTable(doc, {
        startY: 85,
        head: [['Member Name', 'Expected', 'Interest', 'Late Fine', 'Days Late', 'Total', 'Paid', 'Cash Hand', 'Cash Bank', 'Loan Amt', 'Remaining', 'Status']],
        body: tableData,
        foot: [
          [
            'TOTALS', 
            formatCurrency(memberContributions.reduce((sum, c) => sum + (c.expectedContribution || 0), 0)),
            formatCurrency(memberContributions.reduce((sum, c) => sum + (c.expectedInterest || 0), 0)),
            formatCurrency(memberContributions.reduce((sum, c) => sum + (c.lateFineAmount || 0), 0)),
            '---',
            formatCurrency(totalExpected),
            formatCurrency(totalCollected),
            formatCurrency(totalCashInHand),
            formatCurrency(totalCashInBank),
            formatCurrency(totalLoanAmounts),
            formatCurrency(memberContributions.reduce((sum, c) => sum + (c.remainingAmount || 0), 0)),
            `${memberContributions.filter(c => c.status === 'PAID').length}/${memberContributions.length}`
          ]
        ],
        headStyles: {
          fillColor: [72, 49, 212],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        footStyles: {
          fillColor: [245, 247, 250],
          textColor: [0, 0, 0],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250]
        },
        columnStyles: {
          0: { cellWidth: 25 }, // Name
          1: { cellWidth: 16 }, // Expected
          2: { cellWidth: 16 }, // Interest
          3: { cellWidth: 14 }, // Late Fine
          4: { cellWidth: 12 }, // Days Late
          5: { cellWidth: 16 }, // Total
          6: { cellWidth: 16 }, // Paid
          7: { cellWidth: 14 }, // Cash Hand
          8: { cellWidth: 14 }, // Cash Bank
          9: { cellWidth: 16 }, // Loan Amount
          10: { cellWidth: 16 }, // Remaining
          11: { cellWidth: 14 }  // Status
        },
        styles: {
          fontSize: 8,
          cellPadding: 1.5,
          overflow: 'linebreak'
        },
        didParseCell: function(data) {
          // Format the status column with colors
          if (data.section === 'body' && data.column.index === 11) {
            const status = data.cell.raw;
            if (status === 'PAID') {
              data.cell.styles.textColor = [46, 125, 50]; // Green color for PAID
            } else if (status === 'PARTIAL') {
              data.cell.styles.textColor = [198, 130, 0]; // Orange color for PARTIAL
            } else if (status === 'OVERDUE') {
              data.cell.styles.textColor = [198, 40, 40]; // Red color for OVERDUE
            }
          }
          
          // Debug: Log cell content for monetary columns
          if (data.section === 'body' && data.column.index >= 1 && data.column.index <= 10) {
            console.log(`Cell [${data.row.index}, ${data.column.index}]:`, data.cell.raw);
          }
        }
      });

      // Add comprehensive summary section
      const finalY = (doc as any).lastAutoTable.finalY || 200;
      let summaryY = finalY + 20;
      
      if (summaryY > 210) {
        doc.addPage();
        summaryY = 20;
      }
      
      doc.setFillColor(245, 247, 250);
      doc.rect(10, summaryY, doc.internal.pageSize.getWidth() - 20, 130, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(72, 49, 212);
      doc.text('Financial Summary & Group Standing', 20, summaryY + 12);
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      
      // Left column - Collection statistics
      doc.setFont('helvetica', 'bold');
      doc.text('Collection Statistics:', 20, summaryY + 27);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Total Expected: ${formatCurrency(totalExpected)}`, 25, summaryY + 37);
      doc.text(`• Total Collected: ${formatCurrency(totalCollected)}`, 25, summaryY + 47);
      
      // Fix: Cap collection rate at 100% and round to prevent precision errors
      const collectionRate = totalExpected > 0 ? Math.min((totalCollected / totalExpected) * 100, 100) : 0;
      doc.text(`• Collection Rate: ${collectionRate.toFixed(1)}%`, 25, summaryY + 57);
      doc.text(`• Members Completed: ${memberContributions.filter(c => c.status === 'PAID').length}/${memberContributions.length}`, 25, summaryY + 67);
      
      // Right column - Cash allocation
      doc.setFont('helvetica', 'bold');
      doc.text('Cash Allocation:', 110, summaryY + 27);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Cash in Hand: ${formatCurrency(totalCashInHand)}`, 115, summaryY + 37);
      doc.text(`• Cash in Bank: ${formatCurrency(totalCashInBank)}`, 115, summaryY + 47);
      doc.text(`• Total Loan Amounts: ${formatCurrency(totalLoanAmounts)}`, 115, summaryY + 57);
      
      // Late Fine Analysis section
      doc.setFont('helvetica', 'bold');
      doc.text('Late Fine Analysis:', 20, summaryY + 77);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Total Late Fines: ${formatCurrency(totalLateFines)}`, 25, summaryY + 87);
      doc.text(`• Members with Fines: ${membersWithLateFines}/${memberContributions.length}`, 25, summaryY + 97);
      doc.text(`• Members Overdue: ${membersOverdue}/${memberContributions.length}`, 25, summaryY + 107);
      
      // Group Standing section
      doc.setFont('helvetica', 'bold');
      doc.text('Group Standing & Overview:', 110, summaryY + 77);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Group Standing: ${formatCurrency(groupStanding)}`, 115, summaryY + 87);
      doc.text(`• Share per Member: ${formatCurrency(sharePerMember)}`, 115, summaryY + 97);
      doc.text(`(${formatCurrency(groupStanding)} ÷ ${group.memberCount} members)`, 115, summaryY + 107);
      
      // Footer with date and page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`, 
          doc.internal.pageSize.getWidth() / 2, 
          doc.internal.pageSize.getHeight() - 10, 
          { align: 'center' }
        );
      }

      // Download PDF
      doc.save(`${group.name}_Contributions_${new Date().toISOString().split('T')[0]}.pdf`);
      setShowReportModal(false);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert(err instanceof Error ? err.message : 'An error occurred generating PDF');
    }
  };

  // Period management functions
  const handleClosePeriod = async () => {
    setShowClosePeriodModal(false);
    
    try {
      if (!currentPeriod) {
        throw new Error('No current period found to close.');
      }
      
      // Check if period is still valid before attempting to close
      const checkResponse = await fetch(`/api/groups/${groupId}/contributions/periods/current`);
      if (!checkResponse.ok) {
        // If this fails, the period might have been closed already
        await fetchGroupData(); // Refresh data
        throw new Error('Unable to verify current period status. Please refresh and try again.');
      }
      
      const periodData = await checkResponse.json();
      if (!periodData.period || periodData.period.id !== currentPeriod.id) {
        await fetchGroupData(); // Refresh data
        throw new Error('The current period has changed. Please refresh to see the latest data.');
      }
      
      // Now proceed with closing
      await closePeriod();
    } catch (err) {
      console.error('Period close preparation error:', err);
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const closePeriod = async () => {
    if (!group || !currentPeriod) return;
    
    // Prevent double submission with additional checks
    if (closingPeriod) {
      console.log('Period closure already in progress, ignoring duplicate request');
      return;
    }
    
    // Check if period is already closed before proceeding
    // The API now defines a period as closed if totalCollectionThisPeriod is set
    const isPeriodClosed = currentPeriod.isClosed || 
                          (currentPeriod.totalCollectionThisPeriod !== null && 
                           currentPeriod.totalCollectionThisPeriod !== undefined);
    
    if (isPeriodClosed) {
      console.log('Period appears to be already closed, skipping closure', {
        isClosed: currentPeriod.isClosed,
        totalCollectionThisPeriod: currentPeriod.totalCollectionThisPeriod,
        periodId: currentPeriod.id
      });
      await fetchGroupData(); // Refresh to get latest state
      alert('This period has already been closed. The page has been refreshed with the latest data.');
      return;
    }
    
    // Additional protection: check with a unique operation ID
    const operationId = `close-${currentPeriod.id}-${Date.now()}`;
    const existingOperation = sessionStorage.getItem('closing-operation');
    
    if (existingOperation) {
      const operationParts = existingOperation.split('-');
      const operationTime = operationParts[2] ? parseInt(operationParts[2]) : 0;
      if (Date.now() - operationTime < 30000) {
        console.log('Recent closure operation detected, aborting to prevent duplicate');
        alert('A period close operation is already in progress. Please wait for it to complete.');
        return;
      }
    }
    
    sessionStorage.setItem('closing-operation', operationId);
    
    // Show debug info for troubleshooting
    console.log("Closing period as:", {
      sessionUserId: session?.user?.id,
      groupLeaderId: group.leader?.id,
      isMatching: session?.user?.id === group.leader?.id,
      groupLeaderName: group.leader?.name,
      sessionUserName: session?.user?.name,
      operationId
    });
    
    setClosingPeriod(true);
    try {
      const requestData = {
        periodId: currentPeriod.id,
        memberContributions: memberContributions,
        actualContributions: actualContributions
      };
      
      console.log('Closing period with data:', requestData);
      console.log('Current period:', currentPeriod);
      console.log('Member contributions:', memberContributions);
      console.log('Actual contributions:', actualContributions);
      
      const response = await fetch(`/api/groups/${groupId}/contributions/periods/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Close period API error:', response.status, errorData);
        
        // Handle specific error cases
        if (response.status === 409) {
          // Period already closed - refresh data and show user-friendly message
          await fetchGroupData(); // Refresh to get latest state
          
          // Try to parse as JSON for better error message
          let message = 'This period has already been closed. The page has been refreshed with the latest data.';
          try {
            const errorJson = JSON.parse(errorData);
            if (errorJson.message) {
              message = errorJson.message;
            }
            // Add details about when the period was closed if available
            if (errorJson.periodId) {
              console.log('Period was previously closed:', errorJson);
            }
          } catch (_e) {
            // Use the default message if it's not valid JSON
          }
          
          alert(message);
          return; // Don't throw, just return as this is handled
        }
        
        // Try to parse as JSON for better error message, fall back to text
        let errorMessage = errorData;
        try {
          const errorJson = JSON.parse(errorData);
          errorMessage = errorJson.error || errorJson.message || errorData;
        } catch (_e) {
          // Use the text as-is if it's not valid JSON
        }
        
        throw new Error(`Failed to close period: ${response.status} - ${errorMessage}`);
      }

      const result = await response.json();
      console.log('✅ [CLOSE PERIOD] Success response:', result);
      
      // **DIAGNOSTIC LOGGING** - Track state transition
      console.log('🔄 [CLOSE PERIOD] Starting state transition...');
      console.log('   - Old Current Period ID:', currentPeriod?.id);
      console.log('   - Old Period Start Date:', currentPeriod?.startDate);
      console.log('   - Created New Period ID:', result.newPeriod?.id);
      console.log('   - Contributions Before Clear:', Object.keys(actualContributions).length);
      console.log('   - Member Contributions Before Clear:', memberContributions.length);
      
      // Clear current state to force a fresh fetch
      setCurrentPeriod(null);
      setActualContributions({});
      setMemberContributions([]);
      
      console.log('🔄 [CLOSE PERIOD] State cleared, fetching fresh data...');
      
      // Refresh data to get new period
      await fetchGroupData();
      
      console.log('🔄 [CLOSE PERIOD] Fresh data fetched, checking new state...');
      
      // **ENHANCED**: Provide better feedback about the period transition
      let successMessage = 'Period closed successfully!';
      
      if (result.newPeriod) {
        successMessage += ` New period created with ID: ${result.newPeriod.id}`;
      } else if (result.currentPeriod) {
        successMessage += ` Continue with period ID: ${result.currentPeriod.id}`;
      }
      
      if (result.transition) {
        if (result.transition.nextContributionTracking === 'READY') {
          successMessage += ' - Contribution tracking is ready for the next period.';
        } else {
          successMessage += ' - Setting up contribution tracking for the next period...';
        }
      }
      
      // **NEW**: Additional verification - ensure we have a current period
      if (!currentPeriod && result.currentPeriod) {
        console.log('🔄 [CLOSE PERIOD] Setting current period from API response...');
        setCurrentPeriod(result.currentPeriod);
      }
      
      alert(successMessage);
    } catch (err) {
      console.error('Error closing period:', err);
      
      // Check if this is a "already closed" error from the backend
      if (err instanceof Error && err.message.includes('already been closed')) {
        // This was already handled above in the 409 case, but check if it came through a different path
        await fetchGroupData();
        alert('This period has already been closed. The page has been refreshed with the latest data.');
      } else {
        alert(err instanceof Error ? err.message : 'Failed to close period. Please try again.');
      }
    } finally {
      setClosingPeriod(false);
      // Clear the operation lock
      sessionStorage.removeItem('closing-operation');
    }
  };

  const viewOldContributions = async (periodId: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/contributions/periods/${periodId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch period data');
      }

      const periodData = await response.json();
      
      // Set the contributions data for the selected period
      setActualContributions(periodData.contributions || {});
      setSelectedPeriodId(periodId);
      setShowOldContributions(true);
      
      // Calculate member contributions for this period
      if (group) {
        const calculatedContributions = calculateMemberContributions(group, periodData.contributions || {});
        setMemberContributions(calculatedContributions);
      }
    } catch (err) {
      console.error('Error fetching old contributions:', err);
      alert('Failed to load period data. Please try again.');
    }
  };

  const returnToCurrentPeriod = () => {
    setShowOldContributions(false);
    setSelectedPeriodId('');
    fetchGroupData(); // Refresh current data
  };

  // Reopen period functions
  const handleReopenPeriod = (period: any) => {
    setSelectedReopenPeriod(period);
    setShowReopenModal(true);
  };

  const reopenPeriod = async () => {
    if (!selectedReopenPeriod) return;
    
    setShowReopenModal(false);
    setReopeningPeriod(true);
    
    try {
      const response = await fetch(`/api/groups/${groupId}/contributions/periods/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodId: selectedReopenPeriod.id
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Reopen period API error:', response.status, errorData);
        throw new Error(`Failed to reopen period: ${response.status} - ${errorData}`);
      }

      const result = await response.json();
      console.log('Reopen period success:', result);
      
      // Clear current state to force a fresh fetch
      setCurrentPeriod(null);
      setActualContributions({});
      setMemberContributions([]);
      setShowOldContributions(false);
      setSelectedPeriodId('');
      
      // Refresh data to get reopened period as current
      await fetchGroupData();
      
      alert(`Period reopened successfully! You can now mark payments for ${formatPeriodName(selectedReopenPeriod)}.`);
    } catch (err) {
      console.error('Error reopening period:', err);
      alert('Failed to reopen period. Please try again.');
    } finally {
      setReopeningPeriod(false);
      setSelectedReopenPeriod(null);
    }
  };

  const formatPeriodName = (period: any) => {
    if (!period) return 'Unknown Period';
    
    const dateStr = period.meetingDate || period.startDate;
    if (!dateStr) return 'Unknown Period';
    
    const startDate = new Date(dateStr);
    if (isNaN(startDate.getTime())) return 'Invalid Date';
    
    const frequency = group?.collectionFrequency || 'MONTHLY';
    
    switch (frequency) {
      case 'WEEKLY':
        return `Week of ${startDate.toLocaleDateString()}`;
      case 'FORTNIGHTLY':
        return `Fortnight of ${startDate.toLocaleDateString()}`;
      case 'MONTHLY':
        return `${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
      case 'YEARLY':
        return `Year ${startDate.getFullYear()}`;
      default:
        return startDate.toLocaleDateString();
    }
  };

  const getCurrentPeriodName = () => {
    if (!group) return '';
    
    // If we have current period data, use it for accurate labeling
    if (currentPeriod && currentPeriod.startDate) {
      const periodDate = new Date(currentPeriod.startDate);
      const frequency = group.collectionFrequency || 'MONTHLY';
      
      switch (frequency) {
        case 'WEEKLY':
          return `Week of ${periodDate.toLocaleDateString()}`;
        case 'FORTNIGHTLY':
          return `Fortnight of ${periodDate.toLocaleDateString()}`;
        case 'MONTHLY':
          return `${periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
        case 'YEARLY':
          return `Year ${periodDate.getFullYear()}`;
        default:
          return `Period of ${periodDate.toLocaleDateString()}`;
      }
    }
    
    // Fallback to today's date if no current period
    const today = new Date();
    const frequency = group.collectionFrequency || 'MONTHLY';
    
    switch (frequency) {
      case 'WEEKLY':
        return `Current Week (${today.toLocaleDateString()})`;
      case 'FORTNIGHTLY':
        return `Current Fortnight (${today.toLocaleDateString()})`;
      case 'MONTHLY':
        return `Current Month (${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`;
      case 'YEARLY':
        return `Current Year (${today.getFullYear()})`;
      default:
        return `Current Period (${today.toLocaleDateString()})`;
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex justify-center items-center mb-4">
          <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p className="text-muted text-xl">Loading contribution tracking...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 dark:bg-red-900/20 p-8 rounded-lg border border-red-200 dark:border-red-700/50 text-center shadow-xl">
          <div className="flex justify-center items-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-red-700 dark:text-red-300 font-semibold text-2xl">Failed to load contribution data</p>
          <p className="text-red-600 dark:text-red-400 mt-2 text-base">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-secondary mt-6 text-sm bg-red-100 dark:bg-red-700/50 dark:hover:bg-red-600/50 dark:text-red-300 dark:border-red-500/50"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-gray-50 dark:bg-gray-800 p-8 rounded-lg border border-border text-center">
          <p className="text-muted text-xl">Group not found</p>
          <Link
            href="/groups"
            className="btn-primary mt-4"
          >
            Return to Groups
          </Link>
        </div>
      </div>
    );
  }

  const pendingContributions = memberContributions.filter(c => c.status === 'PENDING' || c.status === 'PARTIAL' || c.status === 'OVERDUE');
  const completedContributions = memberContributions.filter(c => c.status === 'PAID');
  const totalExpected = memberContributions.reduce((sum, c) => sum + c.totalExpected, 0);
  const totalCollected = memberContributions.reduce((sum, c) => sum + c.paidAmount, 0);
  const totalRemaining = memberContributions.reduce((sum, c) => sum + c.remainingAmount, 0);
  const totalLateFines = memberContributions.reduce((sum, c) => sum + c.lateFineAmount, 0);
  
  // Filter to only include truly closed periods for history
  const closedPeriods = oldPeriods.filter(period => 
    period.totalCollectionThisPeriod !== null && 
    period.totalCollectionThisPeriod !== undefined &&
    period.totalCollectionThisPeriod > 0
  );
  
  // Check if late fines are enabled for this group
  const lateFinesEnabled = group?.lateFineRules?.[0]?.isEnabled || false;

  // Loan Management Functions
  const handleNewLoan = async () => {
    if (!selectedLoanMember || !newLoanAmount) return;
    
    setSavingLoanOperation(true);
    
    const loanData = {
      memberId: selectedLoanMember.id,
      loanType: 'PERSONAL', // Default loan type
      originalAmount: parseFloat(newLoanAmount),
      interestRate: group?.interestRate || 0,
      dateIssued: new Date().toISOString(),
      status: 'ACTIVE'
    };
    
    console.log('🔄 [LOAN CREATION] Starting loan creation...');
    console.log('📋 [LOAN CREATION] Loan data:', loanData);
    console.log('🎯 [LOAN CREATION] API endpoint:', `/api/groups/${groupId}/loans`);
    
    try {
      const response = await fetch(`/api/groups/${groupId}/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loanData)
      });

      console.log('📡 [LOAN CREATION] Response status:', response.status);
      console.log('📡 [LOAN CREATION] Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [LOAN CREATION] API error response:', errorText);
        console.error('❌ [LOAN CREATION] Full response status:', response.status);
        console.error('❌ [LOAN CREATION] Response headers:', [...response.headers.entries()]);
        
        // Try to parse error details for better user feedback
        let errorMessage = 'Failed to create loan';
        try {
          const errorData = JSON.parse(errorText);
          console.error('❌ [LOAN CREATION] Parsed error data:', errorData);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
          if (errorData.details) {
            console.error('❌ [LOAN CREATION] Validation details:', errorData.details);
          }
        } catch (parseError) {
          console.error('❌ [LOAN CREATION] Could not parse error response:', parseError);
          // If we can't parse the error, use the raw text if it's helpful
          if (errorText && errorText.length < 200) {
            errorMessage = errorText;
          }
        }
        
        throw new Error(errorMessage);
      }

      console.log('✅ [LOAN CREATION] Loan created successfully!');
      await fetchGroupData();
      setNewLoanAmount('');
      setSelectedLoanMember(null);
      setShowNewLoanModal(false);
      alert('Loan created successfully!');
    } catch (err) {
      console.error('💥 [LOAN CREATION] Error creating loan:', err);
      console.error('💥 [LOAN CREATION] Error type:', typeof err);
      console.error('💥 [LOAN CREATION] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      const errorMessage = err instanceof Error ? err.message : 'Failed to create loan. Please try again.';
      alert(errorMessage);
    } finally {
      console.log('🏁 [LOAN CREATION] Finished loan creation process');
      setSavingLoanOperation(false);
    }
  };

  const handleLoanRepayment = async () => {
    console.log('🚀 LOAN REPAYMENT: Starting process...');
    console.log('📋 Initial validation check:', {
      selectedLoanMember: selectedLoanMember ? {
        id: selectedLoanMember.id,
        name: selectedLoanMember.name,
        currentLoanBalance: selectedLoanMember.currentLoanBalance
      } : null,
      loanRepaymentAmount: loanRepaymentAmount,
      loanRepaymentAmountType: typeof loanRepaymentAmount
    });

    if (!selectedLoanMember || !loanRepaymentAmount) {
      console.log('❌ LOAN REPAYMENT: Early return - missing required data');
      return;
    }
    
    const parsedAmount = parseFloat(loanRepaymentAmount);
    console.log('💰 LOAN REPAYMENT: Amount parsing result:', {
      originalAmount: loanRepaymentAmount,
      parsedAmount: parsedAmount,
      isValid: !isNaN(parsedAmount) && parsedAmount > 0
    });

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      console.log('❌ LOAN REPAYMENT: Invalid amount detected');
      alert('Please enter a valid repayment amount');
      return;
    }
    
    setSavingLoanOperation(true);
    try {
      const requestPayload = {
        memberId: selectedLoanMember.id,
        amount: parsedAmount
      };
      
      console.log('📤 LOAN REPAYMENT: Sending API request:', {
        url: `/api/groups/${groupId}/loans/repay`,
        payload: requestPayload,
        groupId: groupId
      });

      const response = await fetch(`/api/groups/${groupId}/loans/repay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      console.log('📥 LOAN REPAYMENT: API response status:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ LOAN REPAYMENT: API error response:', errorText);
        
        // Try to parse error details for better user feedback
        let errorMessage = 'Failed to process loan repayment';
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.includes('exceeds current balance')) {
            errorMessage = `Repayment amount exceeds the current loan balance. Please check the current balance and try again.`;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If we can't parse the error, check for common patterns in the text
          if (errorText.includes('exceeds') && errorText.includes('balance')) {
            errorMessage = `Repayment amount exceeds the current loan balance. Please refresh the page and try again.`;
          }
        }
        
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log('✅ LOAN REPAYMENT: API success response:', responseData);

      await fetchGroupData();
      setLoanRepaymentAmount('');
      setSelectedLoanMember(null);
      setShowLoanRepaymentModal(false);
      alert('Loan repayment processed successfully!');
      console.log('🎉 LOAN REPAYMENT: Process completed successfully');
    } catch (err) {
      console.error('❌ LOAN REPAYMENT: Error caught in try-catch:', {
        error: err,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        errorStack: err instanceof Error ? err.stack : undefined
      });
      
      // Show specific error message to user
      const errorMessage = err instanceof Error ? err.message : 'Failed to process loan repayment. Please try again.';
      alert(errorMessage);
    } finally {
      setSavingLoanOperation(false);
      console.log('🏁 LOAN REPAYMENT: Process finished, loading state reset');
    }
  };

  const handleInterestRateChange = async () => {
    if (!newInterestRate) return;
    
    setSavingLoanOperation(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/interest-rate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interestRate: parseFloat(newInterestRate)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update interest rate');
      }

      await fetchGroupData();
      setNewInterestRate('');
      setShowInterestRateModal(false);
      alert('Interest rate updated successfully for all members!');
    } catch (err) {
      console.error('Error updating interest rate:', err);
      alert('Failed to update interest rate. Please try again.');
    } finally {
      setSavingLoanOperation(false);
    }
  };

  const handleContributionAmountChange = async () => {
    if (!newContributionAmount) return;
    
    setSavingLoanOperation(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/contribution-amount`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyContribution: parseFloat(newContributionAmount)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update contribution amount');
      }

      await fetchGroupData();
      setNewContributionAmount('');
      setShowContributionAmountModal(false);
      alert('Monthly contribution amount updated successfully for all members!');
    } catch (err) {
      console.error('Error updating contribution amount:', err);
      alert('Failed to update contribution amount. Please try again.');
    } finally {
      setSavingLoanOperation(false);
    }
  };

  return (
    <div>
      {/* Period Management Section */}
      <div className="card mb-6">
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {showOldContributions ? 'Historical Contributions' : 'Contribution Tracking'}
              </h2>
              <p className="text-sm text-muted mt-1">
                {showOldContributions 
                  ? `Viewing: ${formatPeriodName(closedPeriods.find(p => p.id === selectedPeriodId))}`
                  : getCurrentPeriodName()
                }
              </p>
              
              {/* Period Status Indicator */}
              {!showOldContributions && currentPeriod?.isClosed && (
                <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md text-red-700 dark:text-red-300 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="font-medium">Period Closed</span>
                  <span className="text-xs">- Contribution changes are disabled until period is reopened</span>
                </div>
              )}
              
              {/* Collection Schedule Information */}
              <div className="text-xs text-muted mt-2 space-y-1">
                <div className="flex items-center gap-4">
                  <span>
                    <strong>Collection:</strong> {group.collectionFrequency?.toLowerCase().replace('_', ' ')} 
                    {group.collectionDayOfMonth && (group.collectionFrequency === 'MONTHLY' || group.collectionFrequency === 'YEARLY') && 
                      ` on the ${group.collectionDayOfMonth}${getOrdinalSuffix(group.collectionDayOfMonth)}`
                    }
                    {group.collectionDayOfWeek && (group.collectionFrequency === 'WEEKLY' || group.collectionFrequency === 'FORTNIGHTLY') && 
                      ` on ${group.collectionDayOfWeek?.toLowerCase()}`
                    }
                    {group.collectionWeekOfMonth && group.collectionFrequency === 'FORTNIGHTLY' && 
                      ` (${group.collectionWeekOfMonth === 1 ? '1st' : group.collectionWeekOfMonth === 2 ? '2nd' : group.collectionWeekOfMonth === 3 ? '3rd' : '4th'} week)`
                    }
                  </span>
                  {lateFinesEnabled && (
                    <span className="text-amber-600 dark:text-amber-400">
                      <strong>Late Fines:</strong> Active
                    </span>
                  )}
                </div>
              </div>
              
              {showOldContributions && selectedPeriodId && (
                <p className="text-xs text-muted mt-1">
                  Period closed on: {(() => {
                    const period = closedPeriods.find(p => p.id === selectedPeriodId);
                    return period?.updatedAt ? new Date(period.updatedAt).toLocaleString() : 'Unknown';
                  })()}
                </p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3">
              {!showOldContributions && (
                <>
                  <button
                    onClick={() => setShowOldContributions(true)}
                    className="btn-secondary"
                    disabled={closedPeriods.length === 0}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    View History ({closedPeriods.length})
                  </button>
                  
                  {group.userPermissions?.canEdit && session?.user?.memberId === group.leader?.id && (
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowClosePeriodModal(true)}
                        disabled={closingPeriod || !currentPeriod || memberContributions.length === 0}
                        className="btn-primary bg-green-600 hover:bg-green-700"
                        title="Close the current period and create a new one"
                      >
                        {closingPeriod ? (
                          <>
                            <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Closing...
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Close This {
                              group.collectionFrequency === 'WEEKLY' ? 'Week' :
                              group.collectionFrequency === 'FORTNIGHTLY' ? 'Fortnight' :
                              group.collectionFrequency === 'MONTHLY' ? 'Month' :
                              group.collectionFrequency === 'YEARLY' ? 'Year' :
                              'Period'
                            }
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
              
              {showOldContributions && (
                <>
                  <select
                    value={selectedPeriodId}
                    onChange={(e) => {
                      if (e.target.value) {
                        viewOldContributions(e.target.value);
                      }
                    }}
                    className="px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select Period</option>
                    {closedPeriods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {formatPeriodName(period)} - Closed {period.updatedAt ? new Date(period.updatedAt).toLocaleDateString() : 'Unknown'}
                      </option>
                    ))}
                  </select>
                  
                  <button
                    onClick={returnToCurrentPeriod}
                    className="btn-secondary"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                    </svg>
                    Back to Current
                  </button>
                  
                  {/* Reopen Period Button - only show for group leaders and when viewing a specific period */}
                  {group.userPermissions?.canEdit && session?.user?.memberId === group.leader?.id && selectedPeriodId && (
                    <button
                      onClick={() => handleReopenPeriod(closedPeriods.find(p => p.id === selectedPeriodId))}
                      disabled={reopeningPeriod}
                      className="btn-primary bg-blue-600 hover:bg-blue-700"
                      title="Reopen this period to allow marking payments"
                    >
                      {reopeningPeriod ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Reopening...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          </svg>
                          Reopen Period
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Period Status Indicator */}
          <div className="flex items-center gap-2 mt-4">
            <div className={`w-3 h-3 rounded-full ${showOldContributions ? 'bg-gray-400' : 'bg-green-500'}`}></div>
            <span className="text-sm text-muted">
              {showOldContributions ? 'Historical Period (Closed)' : 'Active Period (Open for contributions)'}
            </span>
            {!showOldContributions && totalRemaining === 0 && pendingContributions.length === 0 && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full ml-2">
                All contributions collected - Ready to close
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="card bg-primary/10 dark:bg-primary/20 border-primary/20">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-primary">Total Members</h3>
            <p className="text-2xl font-bold text-primary">{memberContributions.length}</p>
          </div>
        </div>
        <div className="card bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/50">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">Total Expected</h3>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">₹{totalExpected.toLocaleString()}</p>
          </div>
        </div>
        <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300">Total Collected</h3>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">₹{totalCollected.toLocaleString()}</p>
          </div>
        </div>
        {lateFinesEnabled && (
          <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">Total Late Fines</h3>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">₹{totalLateFines.toLocaleString()}</p>
            </div>
          </div>
        )}
        <div className="card bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700/50">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-orange-700 dark:text-orange-300">Remaining</h3>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">₹{totalRemaining.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Group Standing Section */}
      <div className="card mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-foreground">Group Standing</h2>
            <div className="text-sm text-muted">
              {showOldContributions ? 'Historical View' : 'Current Period'}
            </div>
          </div>
          
          {(() => {
            // Calculate group standing dynamically
            const currentPeriodCashInHand = Object.values(actualContributions).reduce((sum, record) => {
              if (record.cashAllocation) {
                try {
                  const allocation = JSON.parse(record.cashAllocation);
                  return sum + (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
                } catch (_e) {
                  return sum;
                }
              }
              return sum + roundToTwoDecimals((record.totalPaid || 0) * 0.3); // Default 30% to cash
            }, 0);
            
            const currentPeriodCashInBank = Object.values(actualContributions).reduce((sum, record) => {
              if (record.cashAllocation) {
                try {
                  const allocation = JSON.parse(record.cashAllocation);
                  return sum + (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
                } catch (_e) {
                  return sum;
                }
              }
              return sum + roundToTwoDecimals((record.totalPaid || 0) * 0.7); // Default 70% to bank
            }, 0);
            
            const totalCashInHand = (group.cashInHand || 0) + currentPeriodCashInHand;
            const totalCashInBank = (group.balanceInBank || 0) + currentPeriodCashInBank;
            const totalLoanAssets = memberContributions.reduce((sum, member) => {
              return sum + (member.currentLoanBalance || 0);
            }, 0);
            const groupStanding = totalCashInHand + totalCashInBank + totalLoanAssets;
            const sharePerMember = group.memberCount > 0 ? groupStanding / group.memberCount : 0;
            
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Cash in Hand */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-700/50">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-600 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">Cash in Hand</p>
                      {(() => {
                        // Calculate cash allocation from current contributions
                        const currentPeriodCashInHand = Object.values(actualContributions).reduce((sum, record) => {
                          if (record.cashAllocation) {
                            try {
                              const allocation = JSON.parse(record.cashAllocation);
                              return sum + (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
                            } catch (_e) {
                              return sum;
                            }
                          }
                          // If no allocation data, use simplified calculation (30% of payments to cash)
                          return sum + roundToTwoDecimals((record.totalPaid || 0) * 0.3);
                        }, 0);
                        
                        const totalCashInHand = (group.cashInHand || 0) + currentPeriodCashInHand;
                        
                        return (
                          <>
                            <p className="text-xl font-bold text-green-800 dark:text-green-200">
                              ₹{totalCashInHand.toLocaleString()}
                            </p>
                            {!showOldContributions && currentPeriodCashInHand > 0 && (
                              <p className="text-xs text-green-600 dark:text-green-400">
                                Base: ₹{(group.cashInHand || 0).toLocaleString()} + Period: ₹{currentPeriodCashInHand.toLocaleString()}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Cash in Bank */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700/50">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-600 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Cash in Bank</p>
                      {(() => {
                        // Calculate cash allocation to bank from current contributions
                        const currentPeriodCashInBank = Object.values(actualContributions).reduce((sum, record) => {
                          if (record.cashAllocation) {
                            try {
                              const allocation = JSON.parse(record.cashAllocation);
                              return sum + (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
                            } catch (_e) {
                              return sum;
                            }
                          }
                          // If no allocation data, use simplified calculation (70% of payments to bank)
                          return sum + roundToTwoDecimals((record.totalPaid || 0) * 0.7);
                        }, 0);
                        
                        const totalCashInBank = (group.balanceInBank || 0) + currentPeriodCashInBank;
                        
                        return (
                          <>
                            <p className="text-xl font-bold text-blue-800 dark:text-blue-200">
                              ₹{totalCashInBank.toLocaleString()}
                            </p>
                            {!showOldContributions && currentPeriodCashInBank > 0 && (
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                Base: ₹{(group.balanceInBank || 0).toLocaleString()} + Period: ₹{currentPeriodCashInBank.toLocaleString()}
                              </p>
                            )}
                            {!showOldContributions && currentPeriodCashInBank === 0 && (
                              <p className="text-xs text-blue-600 dark:text-blue-400">Bank Balance</p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Total Loan Assets */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700/50">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-600 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Loan Assets</p>
                      <p className="text-xl font-bold text-purple-800 dark:text-purple-200">
                        ₹{totalLoanAssets.toLocaleString()}
                      </p>
                      <p className="text-xs text-purple-600 dark:text-purple-400">
                        Active Loans: {memberContributions.filter(m => m.currentLoanBalance > 0).length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Group Standing */}
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 rounded-lg border border-orange-200 dark:border-orange-700/50">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-600 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Group Standing</p>
                      <p className="text-xl font-bold text-orange-800 dark:text-orange-200">
                        ₹{groupStanding.toLocaleString()}
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        Per Member: ₹{sharePerMember.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Group Standing Details */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-foreground mb-3">Group Standing Breakdown</h3>
            {(() => {
              // Calculate dynamic cash allocation
              const currentPeriodCashInHand = Object.values(actualContributions).reduce((sum, record) => {
                if (record.cashAllocation) {
                  try {
                    const allocation = JSON.parse(record.cashAllocation);
                    return sum + (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
                  } catch (_e) {
                    return sum;
                  }
                }
                return sum + roundToTwoDecimals((record.totalPaid || 0) * 0.3); // Default 30% to cash
              }, 0);
              
              const currentPeriodCashInBank = Object.values(actualContributions).reduce((sum, record) => {
                if (record.cashAllocation) {
                  try {
                    const allocation = JSON.parse(record.cashAllocation);
                    return sum + (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
                  } catch (_e) {
                    return sum;
                  }
                }
                return sum + roundToTwoDecimals((record.totalPaid || 0) * 0.7); // Default 70% to bank
              }, 0);
              
              const startingCashInHand = group.cashInHand || 0;
              const startingCashInBank = group.balanceInBank || 0;
              const totalCashInHand = startingCashInHand + currentPeriodCashInHand;
              const totalCashInBank = startingCashInBank + currentPeriodCashInBank;
              
              const totalLoanAssets = memberContributions.reduce((sum, member) => {
                return sum + (member.currentLoanBalance || 0);
              }, 0);
              const collectionThisPeriod = totalCollected;
              const interestThisPeriod = memberContributions.reduce((sum, member) => {
                return sum + member.expectedInterest;
              }, 0);
              const totalGroupStanding = totalCashInHand + totalCashInBank + totalLoanAssets;
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-sm text-muted">Starting Cash in Hand:</span>
                      <span className="font-medium">₹{startingCashInHand.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-sm text-muted">Starting Cash in Bank:</span>
                      <span className="font-medium">₹{startingCashInBank.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-sm text-muted">Collection This Period:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">+₹{collectionThisPeriod.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-sm text-muted">Period Cash to Hand:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">+₹{currentPeriodCashInHand.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-sm text-muted">Period Cash to Bank:</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">+₹{currentPeriodCashInBank.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-sm text-muted">Current Cash in Hand:</span>
                      <span className="font-medium text-green-700 dark:text-green-300">₹{totalCashInHand.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-sm text-muted">Current Cash in Bank:</span>
                      <span className="font-medium text-blue-700 dark:text-blue-300">₹{totalCashInBank.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-sm text-muted">Interest This Period:</span>
                      <span className="font-medium text-purple-600 dark:text-purple-400">₹{interestThisPeriod.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-sm text-muted">Total Loan Assets:</span>
                      <span className="font-medium text-purple-600 dark:text-purple-400">₹{totalLoanAssets.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-sm text-muted">Total Members:</span>
                      <span className="font-medium">{group.memberCount}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                      <span className="text-sm text-muted">Share per Member:</span>
                      <span className="font-medium">₹{(totalGroupStanding / group.memberCount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-t-2 border-primary pt-3">
                      <span className="text-base font-semibold text-foreground">Total Group Standing:</span>
                      <span className="text-lg font-bold text-primary">₹{totalGroupStanding.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Calculation Formula */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700/50">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">Calculation Formula:</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Group Standing = Current Cash in Hand + Current Cash in Bank + Total Loan Assets
              </p>
              {!showOldContributions && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  <strong>Real-time Update:</strong> Cash values include starting amounts plus allocated contributions from this period. 
                  When closing the period, all values are finalized and recorded in the periodic record.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="card mb-6">
        <div className="p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-foreground">Collection Progress</h3>
            <span className="text-sm font-medium text-primary">
              {/* Fix: Cap collection rate at 100% to prevent display of >100% */}
              {totalExpected > 0 ? Math.min(Math.round((totalCollected / totalExpected) * 100), 100) : 0}% ₹{totalCollected.toLocaleString()} collected
            </span>
          </div>
          
          {/* Enhanced Progress Bar */}
          <div className="relative">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 shadow-inner">
              <div 
                className="bg-gradient-to-r from-green-500 to-blue-500 h-6 rounded-full transition-all duration-700 ease-out shadow-lg relative overflow-hidden"
                style={{ width: `${totalExpected > 0 ? Math.min((totalCollected / totalExpected) * 100, 100) : 0}%` }}
              >
                {/* Animated shine effect */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                
                {/* Percentage text inside bar (when there's enough space) */}
                {totalExpected > 0 && (totalCollected / totalExpected) * 100 > 20 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white font-bold text-sm drop-shadow-lg">
                      {/* Fix: Cap collection rate at 100% to prevent display of >100% */}
                      {Math.min(Math.round((totalCollected / totalExpected) * 100), 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Progress details */}
          <div className="flex justify-between mt-3 text-sm">
            <div className="flex items-center space-x-4">
              <span className="text-muted">Target: ₹{totalExpected.toLocaleString()}</span>
              <span className="text-green-600 dark:text-green-400 font-medium">
                Collected: ₹{totalCollected.toLocaleString()}
              </span>
            </div>
            <span className="text-orange-600 dark:text-orange-400 font-medium">
              Remaining: ₹{totalRemaining.toLocaleString()}
            </span>
          </div>
          
          {/* Member Progress */}
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center space-x-4">
                <span className="text-muted">
                  Total Members: <span className="font-medium">{memberContributions.length}</span>
                </span>
                <span className="text-green-600 dark:text-green-400 font-medium">
                  Paid: {completedContributions.length}
                </span>
                <span className="text-orange-600 dark:text-orange-400 font-medium">
                  Pending: {pendingContributions.length}
                </span>
              </div>
              <div className="text-right">
                <span className="text-muted text-xs">
                  {memberContributions.length > 0 ? Math.round((completedContributions.length / memberContributions.length) * 100) : 0}% members completed
                </span>
              </div>
            </div>
            
            {/* Member Progress Bar */}
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${memberContributions.length > 0 ? Math.min((completedContributions.length / memberContributions.length) * 100, 100) : 0}%` }}
                ></div>
              </div>
            </div>
            
            {/* Remaining Members Display */}
            {pendingContributions.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-foreground">Members Yet to Pay</h4>
                  <span className="text-xs text-muted">{pendingContributions.length} remaining</span>
                </div>
                
                <div className="max-h-24 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {pendingContributions.slice(0, 10).map((member) => (
                      <div
                        key={member.memberId}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          member.status === 'OVERDUE' 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' 
                            : member.status === 'PARTIAL'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                        }`}
                        title={`${member.memberName} - ₹${member.remainingAmount.toLocaleString()} remaining${member.daysLate > 0 ? ` (${member.daysLate} days late)` : ''}`}
                      >
                        {member.memberName}
                        {member.status === 'PARTIAL' && (
                          <span className="ml-1 text-xs">
                            (₹{member.remainingAmount.toLocaleString()})
                          </span>
                        )}
                        {member.daysLate > 0 && (
                          <span className="ml-1 text-xs text-red-600 dark:text-red-400">
                            ⏰
                          </span>
                        )}
                      </div>
                    ))}
                    {pendingContributions.length > 10 && (
                      <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        +{pendingContributions.length - 10} more
                      </div>
                    )}
                  </div>
                </div>
                
                {pendingContributions.length > 10 && (
                  <div className="mt-2 text-xs text-muted">
                    Showing first 10 members. View full list below in the contributions table.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Toggle */}
      <div className="mb-6">
        <div className="flex space-x-4">
          <button
            onClick={() => setShowCompleted(false)}
            className={`px-6 py-3 rounded-lg transition-all duration-200 font-medium ${
              !showCompleted 
                ? 'bg-primary text-white shadow-lg transform scale-105' 
                : 'bg-card-bg text-muted border border-border hover:border-primary/50 hover:text-primary'
            }`}
          >
            Pending ({pendingContributions.length})
          </button>
          <button
            onClick={() => setShowCompleted(true)}
            className={`px-6 py-3 rounded-lg transition-all duration-200 font-medium ${
              showCompleted 
                ? 'bg-secondary text-white shadow-lg transform scale-105' 
                : 'bg-card-bg text-muted border border-border hover:border-secondary/50 hover:text-secondary'
            }`}
          >
            Completed ({completedContributions.length})
          </button>
        </div>
      </div>

      {/* Contributions List */}
      <div className="card mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-hover">
          <h2 className="text-lg font-semibold text-foreground">
            {showCompleted ? 'Completed Contributions' : 'Pending Contributions'}
          </h2>
          <p className="text-sm text-muted mt-1">
            {showCompleted 
              ? `${completedContributions.length} members have completed their contributions`
              : `${pendingContributions.length} members have pending contributions`
            }
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Member</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Monthly Contribution</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Interest Due</th>
                {lateFinesEnabled && (
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Late Fine</th>
                )}
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Loan Balance</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  <div className="text-center">Collection</div>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    <div className="text-center text-xs">Cash</div>
                    <div className="text-center text-xs">Bank</div>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Remaining Loan</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(showCompleted ? completedContributions : pendingContributions).map((contribution) => {
                const memberId = contribution.memberId;
                const memberCollection = memberCollections[memberId] || {
                  cashAmount: 0,
                  bankAmount: 0,
                  compulsoryContribution: 0,
                  interestPaid: 0,
                  loanRepayment: 0,
                  lateFinePaid: 0,
                  remainingLoan: contribution.currentLoanBalance || 0
                };

                // Auto-calculate distributions when amounts change
                const handleCollectionChange = (field: 'cashAmount' | 'bankAmount', value: number) => {
                  // Round up decimal values
                  const roundedValue = Math.ceil(value);
                  
                  const totalCollected = field === 'cashAmount' 
                    ? roundedValue + memberCollection.bankAmount 
                    : memberCollection.cashAmount + roundedValue;
                  
                  // Distribute: compulsory contribution → interest → loan repayment
                  let remaining = totalCollected;
                  let compulsoryContribution = 0;
                  let interestPaid = 0;
                  let loanRepayment = 0;
                  
                  // First priority: Compulsory contribution
                  if (remaining > 0 && contribution.expectedContribution > 0) {
                    compulsoryContribution = Math.min(remaining, contribution.expectedContribution);
                    remaining -= compulsoryContribution;
                  }
                  
                  // Second priority: Interest
                  if (remaining > 0 && contribution.expectedInterest > 0) {
                    interestPaid = Math.min(remaining, contribution.expectedInterest);
                    remaining -= interestPaid;
                  }
                  
                  // Third priority: Loan repayment
                  if (remaining > 0 && contribution.currentLoanBalance > 0) {
                    loanRepayment = Math.min(remaining, contribution.currentLoanBalance);
                  }
                  
                  const newRemainingLoan = Math.max(0, contribution.currentLoanBalance - loanRepayment);
                  
                  setMemberCollections(prev => ({
                    ...prev,
                    [memberId]: {
                      ...memberCollection,
                      [field]: roundedValue,
                      compulsoryContribution,
                      interestPaid,
                      loanRepayment,
                      lateFinePaid: memberCollection.lateFinePaid || 0,
                      remainingLoan: newRemainingLoan
                    }
                  }));
                };

                return (
                  <tr 
                    key={contribution.memberId} 
                    className={`transition-colors duration-150 hover:bg-hover ${
                      contribution.status === 'PARTIAL' ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : 
                      contribution.status === 'OVERDUE' ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">{contribution.memberName}</div>
                      {contribution.currentLoanBalance > 0 && (
                        <div className="text-sm text-muted">Active Loan: ₹{formatCurrency(contribution.currentLoanBalance)}</div>
                      )}
                      {contribution.daysLate > 0 && (
                        <div className="text-sm text-red-600 dark:text-red-400">
                          {contribution.daysLate} day{contribution.daysLate > 1 ? 's' : ''} late
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground mb-1">
                        Due: ₹{formatCurrency(contribution.expectedContribution)}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Paid Amount</label>
                        <input
                          type="number"
                          value={memberCollection.compulsoryContribution === 0 ? '' : memberCollection.compulsoryContribution}
                          onFocus={(e) => {
                            // Clear field if value is 0 for better UX
                            if (Number(e.target.value) === 0) {
                              e.target.value = '';
                            }
                          }}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            const value = Math.max(0, Number(inputValue) || 0);
                            const maxAmount = contribution.expectedContribution;
                            
                            // Calculate total dues to prevent overpayment
                            const totalDues = contribution.expectedContribution + contribution.expectedInterest + contribution.lateFineAmount;
                            const currentOtherPayments = (memberCollection.interestPaid || 0) + (memberCollection.lateFinePaid || 0) + (memberCollection.loanRepayment || 0);
                            const maxAllowedForThisField = Math.min(maxAmount, totalDues - currentOtherPayments);
                            
                            // Round up decimal values
                            const roundedValue = Math.ceil(value);
                            const finalValue = Math.min(roundedValue, Math.max(0, maxAllowedForThisField));
                            
                            // Auto-allocate to cash by default when entering payment
                            const updatedCollection = {
                              ...memberCollection,
                              compulsoryContribution: finalValue
                            };
                            
                            // If user entered a payment amount, auto-allocate to cash
                            if (finalValue > 0 && (memberCollection.cashAmount + memberCollection.bankAmount) === 0) {
                              const totalPayments = finalValue + (memberCollection.interestPaid || 0) + (memberCollection.loanRepayment || 0) + (memberCollection.lateFinePaid || 0);
                              updatedCollection.cashAmount = totalPayments;
                              updatedCollection.bankAmount = 0;
                            }
                            
                            setMemberCollections(prev => ({
                              ...prev,
                              [memberId]: updatedCollection
                            }));
                          }}
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
                          min="0"
                          max={contribution.expectedContribution}
                          step="0.01"
                          disabled={currentPeriod?.isClosed}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground mb-1">
                        Due: ₹{formatCurrency(contribution.expectedInterest)}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Paid Amount</label>
                        <input
                          type="number"
                          value={memberCollection.interestPaid === 0 ? '' : memberCollection.interestPaid}
                          onFocus={(e) => {
                            // Clear field if value is 0 for better UX
                            if (Number(e.target.value) === 0) {
                              e.target.value = '';
                            }
                          }}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            const value = Math.max(0, Number(inputValue) || 0);
                            const maxAmount = contribution.expectedInterest;
                            
                            // Calculate total dues to prevent overpayment
                            const totalDues = contribution.expectedContribution + contribution.expectedInterest + contribution.lateFineAmount;
                            const currentOtherPayments = (memberCollection.compulsoryContribution || 0) + (memberCollection.lateFinePaid || 0) + (memberCollection.loanRepayment || 0);
                            const maxAllowedForThisField = Math.min(maxAmount, totalDues - currentOtherPayments);
                            
                            // Round up decimal values
                            const roundedValue = Math.ceil(value);
                            const finalValue = Math.min(roundedValue, Math.max(0, maxAllowedForThisField));
                            
                            // Auto-allocate to cash by default when entering payment
                            const updatedCollection = {
                              ...memberCollection,
                              interestPaid: finalValue
                            };
                            
                            // If user entered a payment amount, auto-allocate to cash
                            if (finalValue > 0 && (memberCollection.cashAmount + memberCollection.bankAmount) === 0) {
                              const totalPayments = (memberCollection.compulsoryContribution || 0) + finalValue + (memberCollection.loanRepayment || 0) + (memberCollection.lateFinePaid || 0);
                              updatedCollection.cashAmount = totalPayments;
                              updatedCollection.bankAmount = 0;
                            }
                            
                            setMemberCollections(prev => ({
                              ...prev,
                              [memberId]: updatedCollection
                            }));
                          }}
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                          min="0"
                          max={contribution.expectedInterest}
                          step="0.01"
                          disabled={currentPeriod?.isClosed}
                        />
                      </div>
                    </td>
                    {lateFinesEnabled && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground mb-1">
                          Due: ₹{formatCurrency(contribution.lateFineAmount)}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Paid Amount</label>
                          <input
                            type="number"
                            value={memberCollection.lateFinePaid === 0 ? '' : memberCollection.lateFinePaid}
                            onFocus={(e) => {
                              // Clear field if value is 0 for better UX
                              if (Number(e.target.value) === 0) {
                                e.target.value = '';
                              }
                            }}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              const value = Math.max(0, Number(inputValue) || 0);
                              const maxAmount = contribution.lateFineAmount;
                              
                              // Calculate total dues to prevent overpayment
                              const totalDues = contribution.expectedContribution + contribution.expectedInterest + contribution.lateFineAmount;
                              const currentOtherPayments = (memberCollection.compulsoryContribution || 0) + (memberCollection.interestPaid || 0) + (memberCollection.loanRepayment || 0);
                              const maxAllowedForThisField = Math.min(maxAmount, totalDues - currentOtherPayments);
                              
                              // Round up decimal values
                              const roundedValue = Math.ceil(value);
                              const finalValue = Math.min(roundedValue, Math.max(0, maxAllowedForThisField));
                              
                              // Auto-allocate to cash by default when entering payment
                              const updatedCollection = {
                                ...memberCollection,
                                lateFinePaid: finalValue
                              };
                              
                              // If user entered a payment amount, auto-allocate to cash
                              if (finalValue > 0 && (memberCollection.cashAmount + memberCollection.bankAmount) === 0) {
                                const totalPayments = (memberCollection.compulsoryContribution || 0) + (memberCollection.interestPaid || 0) + (memberCollection.loanRepayment || 0) + finalValue;
                                updatedCollection.cashAmount = totalPayments;
                                updatedCollection.bankAmount = 0;
                              }
                              
                              setMemberCollections(prev => ({
                                ...prev,
                                [memberId]: updatedCollection
                              }));
                            }}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-red-500 dark:bg-gray-700 dark:text-gray-100"
                            min="0"
                            max={contribution.lateFineAmount}
                            step="0.01"
                            disabled={currentPeriod?.isClosed}
                          />
                        </div>
                        {contribution.daysLate > 0 && contribution.lateFineAmount > 0 && (
                          <div className="text-xs text-red-500 dark:text-red-400 mt-1">
                            ({contribution.daysLate} days late)
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-primary mb-1">
                        Balance: ₹{formatCurrency(contribution.currentLoanBalance)}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Loan Paid</label>
                        <input
                          type="number"
                          value={memberCollection.loanRepayment === 0 ? '' : memberCollection.loanRepayment}
                          onFocus={(e) => {
                            // Clear field if value is 0 for better UX
                            if (Number(e.target.value) === 0) {
                              e.target.value = '';
                            }
                          }}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            const value = Math.max(0, Number(inputValue) || 0);
                            const maxAmount = contribution.currentLoanBalance;
                            
                            // Calculate total dues to prevent overpayment (loan repayment is separate from other dues)
                            // For loan repayment, we only limit by the current loan balance
                            const roundedValue = Math.ceil(value);
                            const finalValue = Math.min(roundedValue, maxAmount);
                            const newRemainingLoan = Math.max(0, contribution.currentLoanBalance - finalValue);
                            
                            // Auto-allocate to cash by default when entering payment
                            const updatedCollection = {
                              ...memberCollection,
                              loanRepayment: finalValue,
                              remainingLoan: newRemainingLoan
                            };
                            
                            // If user entered a payment amount, auto-allocate to cash
                            if (finalValue > 0 && (memberCollection.cashAmount + memberCollection.bankAmount) === 0) {
                              const totalPayments = (memberCollection.compulsoryContribution || 0) + (memberCollection.interestPaid || 0) + finalValue + (memberCollection.lateFinePaid || 0);
                              updatedCollection.cashAmount = totalPayments;
                              updatedCollection.bankAmount = 0;
                            }
                            
                            setMemberCollections(prev => ({
                              ...prev,
                              [memberId]: updatedCollection
                            }));
                          }}
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-gray-100"
                          min="0"
                          max={contribution.currentLoanBalance}
                          step="0.01"
                          disabled={currentPeriod?.isClosed}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Cash</label>
                          <input
                            type="number"
                            value={memberCollection.cashAmount === 0 ? '' : memberCollection.cashAmount}
                            onFocus={(e) => {
                              // Clear field if value is 0 for better UX
                              if (Number(e.target.value) === 0) {
                                e.target.value = '';
                              }
                            }}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              const value = Math.max(0, Number(inputValue) || 0);
                              // Round up decimal values
                              const roundedValue = Math.ceil(value);
                              handleCollectionChange('cashAmount', roundedValue);
                            }}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                            min="0"
                            step="1"
                            disabled={currentPeriod?.isClosed}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Bank</label>
                          <input
                            type="number"
                            value={memberCollection.bankAmount === 0 ? '' : memberCollection.bankAmount}
                            onFocus={(e) => {
                              // Clear field if value is 0 for better UX
                              if (Number(e.target.value) === 0) {
                                e.target.value = '';
                              }
                            }}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              const value = Math.max(0, Number(inputValue) || 0);
                              // Round up decimal values
                              const roundedValue = Math.ceil(value);
                              handleCollectionChange('bankAmount', roundedValue);
                            }}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                            min="0"
                            step="1"
                            disabled={currentPeriod?.isClosed}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-muted mt-1 text-center">
                        Total: ₹{formatCurrency(memberCollection.cashAmount + memberCollection.bankAmount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-orange-600 dark:text-orange-400">
                        ₹{formatCurrency(memberCollection.remainingLoan)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        memberCollection.compulsoryContribution >= contribution.expectedContribution && 
                        memberCollection.interestPaid >= contribution.expectedInterest
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                        memberCollection.compulsoryContribution > 0 || memberCollection.interestPaid > 0 || memberCollection.loanRepayment > 0
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                        contribution.status === 'OVERDUE'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                          'bg-gray-100 dark:bg-gray-700/30 text-gray-800 dark:text-gray-300'
                      }`}>
                        {memberCollection.compulsoryContribution >= contribution.expectedContribution && 
                         memberCollection.interestPaid >= contribution.expectedInterest ? 'PAID' :
                         memberCollection.compulsoryContribution > 0 || memberCollection.interestPaid > 0 || memberCollection.loanRepayment > 0 ? 'PARTIAL' :
                         contribution.status === 'OVERDUE' ? 'OVERDUE' : 'PENDING'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={async () => {
                          const totalAmount = memberCollection.cashAmount + memberCollection.bankAmount;
                          if (totalAmount > 0) {
                            await submitMemberCollection(memberId, memberCollection);
                          } else {
                            alert('Please enter collection amount in cash or bank');
                          }
                        }}
                        disabled={savingPayment === contribution.memberId || currentPeriod?.isClosed || 
                                (memberCollection.cashAmount + memberCollection.bankAmount) <= 0}
                        className={`btn-primary text-xs py-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed ${
                          currentPeriod?.isClosed 
                            ? 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-not-allowed' 
                            : ''
                        }`}
                      >
                        {savingPayment === contribution.memberId 
                          ? 'Submitting...' 
                          : currentPeriod?.isClosed 
                            ? 'Period Closed' 
                            : 'Submit'
                        }
                      </button>
                    </td>
                  </tr>
                );
              })}
              {(showCompleted ? completedContributions : pendingContributions).length === 0 && (
                <tr>
                  <td colSpan={lateFinesEnabled ? 9 : 8} className="px-6 py-12 text-center">
                    <div className="text-muted">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-lg">
                        {showCompleted ? 'No completed contributions yet' : 'No pending contributions'}
                      </p>
                      <p className="text-sm mt-1">
                        {showCompleted 
                          ? 'Contributions will appear here once members make payments' 
                          : 'All members have completed their contributions for this period'
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 justify-between items-center mt-4">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={generateReport}
            className="btn-secondary bg-purple-100 hover:bg-purple-200 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:hover:bg-purple-800/50 dark:text-purple-300 dark:border-purple-700/50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Generate Report
          </button>

          {/* Close Period Button - Only for Group Leaders */}
          {session?.user?.memberId && group?.leader?.id && String(session?.user?.memberId) === String(group?.leader?.id) ? (
            <button
              onClick={() => setShowClosePeriodModal(true)}
              disabled={closingPeriod}
              className="btn-secondary bg-red-100 hover:bg-red-200 text-red-700 border-red-300 dark:bg-red-900/30 dark:hover:bg-red-800/50 dark:text-red-300 dark:border-red-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Close the current contribution period and start a new one"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {closingPeriod ? 'Closing...' : 'Close Period'}
            </button>
          ) : (
            <div
              className="btn-secondary bg-gray-100 hover:bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed opacity-50"
              title={`Only the group leader (${group?.leader?.name}) can close periods`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Close Period (Leader Only)
            </div>
          )}
          
          <button
            onClick={() => {
              const refreshed = confirm('This will refresh the contribution status. Continue?');
              if (refreshed) {
                fetchGroupData();
              }
            }}
            className="btn-secondary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Data
          </button>
        </div>

        <div className="text-sm text-muted">
          <p>Last updated: {new Date().toLocaleString()}</p>
          <p className="mt-1">
            {/* Fix: Cap collection rate at 100% to prevent display of >100% */}
            Collection rate: {totalExpected > 0 ? Math.min(((totalCollected / totalExpected) * 100), 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* Info Note */}
      <div className="mt-8 card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50">
        <div className="p-4">
          <div className="flex items-start space-x-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">About Contribution Tracking</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                This page tracks member contributions based on your group&apos;s settings. 
                Monthly contributions of ₹{group?.monthlyContribution || 0} are expected from each member.
                {group?.interestRate && group?.interestRate > 0 && (
                  <span> Interest on active loans is calculated at {group?.interestRate}% rate.</span>
                )}
                {group?.collectionFrequency && (
                  <span> Collection frequency is set to {group?.collectionFrequency.toLowerCase()}.</span>
                )}
                {lateFinesEnabled && (
                  <span> Late fines are automatically calculated for overdue payments based on your group&apos;s late fine rules.</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Record Payment - {selectedMember.name}
                </h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Payment Summary */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Outstanding Amounts</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Compulsory Contribution:</span>
                    <span className="font-medium">₹{selectedMember.expectedContribution.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Interest:</span>
                    <span className="font-medium">₹{selectedMember.expectedInterest.toLocaleString()}</span>
                  </div>
                  {lateFinesEnabled && selectedMember.lateFineAmount && selectedMember.lateFineAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Late Fine (for contribution):</span>
                      <span className="font-medium text-red-600 dark:text-red-400">₹{selectedMember.lateFineAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-300 dark:border-gray-600 pt-1 font-semibold">
                    <span>Total Remaining:</span>
                    <span>₹{selectedMember.remainingAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payment Amount */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    const numericValue = Number(inputValue);
                    
                    // Prevent overpayments by capping at remaining amount
                    if (numericValue > selectedMember.remainingAmount) {
                      setPaymentAmount(selectedMember.remainingAmount.toString());
                    } else {
                      setPaymentAmount(inputValue);
                    }
                    calculateAutoAllocation();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                  min="0"
                  max={selectedMember.remainingAmount}
                  step="0.01"
                />
                {selectedMember.remainingAmount <= 0 && (
                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-700 dark:text-green-300">
                    ✅ This member has already paid in full for this period.
                  </div>
                )}
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500">
                    Max: ₹{selectedMember.remainingAmount.toLocaleString()}
                  </span>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Prevent overpayment by using minimum of expected contribution and remaining amount
                        const payAmount = Math.min(selectedMember.expectedContribution, selectedMember.remainingAmount);
                        setPaymentAmount(payAmount.toString());
                        calculateAutoAllocation();
                      }}
                      disabled={selectedMember.remainingAmount <= 0}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Pay Contribution Only
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentAmount(selectedMember.remainingAmount.toString());
                        calculateAutoAllocation();
                      }}
                      disabled={selectedMember.remainingAmount <= 0}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Pay Remaining Amount
                    </button>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={calculateAutoAllocation}
                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                  >
                    Auto-Allocate (30% Hand, 70% Bank)
                  </button>
                </div>
              </div>

              {/* Cash Allocation for Compulsory Contribution */}
              {selectedMember.expectedContribution > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Compulsory Contribution Allocation
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Cash in Hand (₹)</label>
                      <input
                        type="number"
                        value={contributionAllocation.cashInHand}
                        onChange={(e) => {
                          const value = Number(e.target.value) || 0;
                          setContributionAllocation(prev => ({
                            ...prev,
                            cashInHand: value
                          }));
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Cash in Bank (₹)</label>
                      <input
                        type="number"
                        value={contributionAllocation.cashInBank}
                        onChange={(e) => {
                          const value = Number(e.target.value) || 0;
                          setContributionAllocation(prev => ({
                            ...prev,
                            cashInBank: value
                          }));
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 text-xs">
                    <span className="text-gray-600 dark:text-gray-400">
                      Total: ₹{(contributionAllocation.cashInHand + contributionAllocation.cashInBank).toLocaleString()}
                    </span>
                    <div className="space-x-2">
                      <button
                        type="button"
                        onClick={() => setContributionAllocation({
                          cashInHand: selectedMember.expectedContribution,
                          cashInBank: 0
                        })}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        All Hand
                      </button>
                      <button
                        type="button"
                        onClick={() => setContributionAllocation({
                          cashInHand: 0,
                          cashInBank: selectedMember.expectedContribution
                        })}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        All Bank
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Cash Allocation for Interest */}
              {selectedMember.expectedInterest > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Interest Allocation
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Cash in Hand (₹)</label>
                      <input
                        type="number"
                        value={interestAllocation.cashInHand}
                        onChange={(e) => {
                          const value = Number(e.target.value) || 0;
                          setInterestAllocation(prev => ({
                            ...prev,
                            cashInHand: value
                          }));
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Cash in Bank (₹)</label>
                      <input
                        type="number"
                        value={interestAllocation.cashInBank}
                        onChange={(e) => {
                          const value = Number(e.target.value) || 0;
                          setInterestAllocation(prev => ({
                            ...prev,
                            cashInBank: value
                          }));
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 text-xs">
                    <span className="text-gray-600 dark:text-gray-400">
                      Total: ₹{(interestAllocation.cashInHand + interestAllocation.cashInBank).toLocaleString()}
                    </span>
                    <div className="space-x-2">
                      <button
                        type="button"
                        onClick={() => setInterestAllocation({
                          cashInHand: selectedMember.expectedInterest,
                          cashInBank: 0
                        })}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        All Hand
                      </button>
                      <button
                        type="button"
                        onClick={() => setInterestAllocation({
                          cashInHand: 0,
                          cashInBank: selectedMember.expectedInterest
                        })}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        All Bank
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mb-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                  <strong>Default Allocation:</strong> If you don&apos;t manually allocate cash, the payment will go to Cash in Hand by default.
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const amount = Number(paymentAmount);
                    if (amount > 0 && amount <= selectedMember.remainingAmount) {
                      // Check if user has manually allocated the cash
                      const totalContributionAllocated = contributionAllocation.cashInHand + contributionAllocation.cashInBank;
                      const totalInterestAllocated = interestAllocation.cashInHand + interestAllocation.cashInBank;
                      
                      // Calculate how much payment goes to contribution vs interest
                      let contributionPayment = 0;
                      let interestPayment = 0;
                      let remainingPayment = amount;
                      
                      // Allocate to contribution first
                      if (remainingPayment > 0 && selectedMember.expectedContribution > 0) {
                        contributionPayment = Math.min(remainingPayment, selectedMember.expectedContribution);
                        remainingPayment -= contributionPayment;
                      }
                      
                      // Then allocate to interest
                      if (remainingPayment > 0 && selectedMember.expectedInterest > 0) {
                        interestPayment = Math.min(remainingPayment, selectedMember.expectedInterest);
                        remainingPayment -= interestPayment;
                      }
                      
                      // If user hasn't manually allocated, use default allocation (all to cash in hand)
                      let finalContributionAllocation = contributionAllocation;
                      let finalInterestAllocation = interestAllocation;
                      
                      if (totalContributionAllocated === 0 && contributionPayment > 0) {
                        finalContributionAllocation = {
                          cashInHand: contributionPayment,
                          cashInBank: 0
                        };
                      }
                      
                      if (totalInterestAllocated === 0 && interestPayment > 0) {
                        finalInterestAllocation = {
                          cashInHand: interestPayment,
                          cashInBank: 0
                        };
                      }
                      
                      const cashAllocation = {
                        contributionToCashInHand: finalContributionAllocation.cashInHand,
                        contributionToCashInBank: finalContributionAllocation.cashInBank,
                        interestToCashInHand: finalInterestAllocation.cashInHand,
                        interestToCashInBank: finalInterestAllocation.cashInBank
                      };
                      
                      setShowPaymentModal(false);
                      await markContributionPaid(selectedMember.id, amount, cashAllocation);
                    } else {
                      alert('Please enter a valid payment amount');

                    }
                  }}
                  disabled={!paymentAmount || Number(paymentAmount) <= 0 || Number(paymentAmount) > selectedMember.remainingAmount}
                  className="flex-1 px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Generation Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Generate Report
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose the format for your contribution report:
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={generatePDFReport}
                  className="w-full flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center">
                    <svg className="w-8 h-8 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    <div className="text-left">
                      <div className="font-medium text-gray-900 dark:text-gray-100">PDF Report</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Formatted document with tables</div>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={generateExcelReport}
                  className="w-full flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center">
                    <svg className="w-8 h-8 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    <div className="text-left">
                      <div className="font-medium text-gray-900 dark:text-gray-100">Excel Report</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Spreadsheet with calculations</div>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={generateCSVReport}
                  className="w-full flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center">
                    <svg className="w-8 h-8 text-blue-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    <div className="text-left">
                      <div className="font-medium text-gray-900 dark:text-gray-100">CSV Report</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Data for import/analysis</div>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Period Confirmation Modal */}
      {showClosePeriodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] shadow-xl overflow-hidden flex flex-col">
            <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Close Period Confirmation
                </h3>
                <button
                  onClick={() => setShowClosePeriodModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Important Notice
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Closing this period will finalize all contributions and move to the next period. 
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p><strong>Current Period:</strong> {currentPeriod?.startDate ? new Date(currentPeriod.startDate).toLocaleDateString() : 'Unknown'} - {currentPeriod?.endDate ? new Date(currentPeriod.endDate).toLocaleDateString() : 'Unknown'}</p>
                </div>
                
                {/* Financial Summary for Close Period */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-2">
                    Period Financial Summary
                  </h4>
                  
                  {(() => {
                    const totalCollected = memberContributions.reduce((sum: number, member: MemberContributionStatus) => sum + member.paidAmount, 0);
                    const totalRemaining = memberContributions.reduce((sum: number, member: MemberContributionStatus) => sum + member.remainingAmount, 0);
                    const interestEarned = memberContributions.reduce((sum: number, member: MemberContributionStatus) => sum + member.expectedInterest, 0);
                    const totalLoanAssets = memberContributions.reduce((sum, member) => sum + (member.currentLoanBalance || 0), 0);
                    
                    // Calculate starting values (from group creation)
                    const startingCashInHand = group.cashInHand || 0;
                    const startingCashInBank = group.balanceInBank || 0;
                    const startingGroupStanding = startingCashInHand + startingCashInBank + totalLoanAssets;
                    
                    // Calculate ending values using actual cash allocation from user input
                    // Check if there's an active periodic record with user-specified cash allocation
                    let endingCashInHand = startingCashInHand;
                    let endingCashInBank = startingCashInBank;
                    let bankAllocation = 0;
                    let handAllocation = 0;
                    
                    // Look for actual user allocation in the current contributions
                    const userAllocatedCashInHand = Object.values(actualContributions).reduce((sum, record) => {
                      if (record.cashAllocation) {
                        try {
                          const allocation = JSON.parse(record.cashAllocation);
                          return sum + (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
                        } catch (_e) {
                          return sum;
                        }
                      }
                      return sum;
                    }, 0);
                    
                    const userAllocatedCashInBank = Object.values(actualContributions).reduce((sum, record) => {
                      if (record.cashAllocation) {
                        try {
                          const allocation = JSON.parse(record.cashAllocation);
                          return sum + (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
                        } catch (_e) {
                          return sum;
                        }
                      }
                      return sum;
                    }, 0);
                    
                    // If user has made specific allocations, use those; otherwise use default 70/30 split
                    if (userAllocatedCashInHand > 0 || userAllocatedCashInBank > 0) {
                      // Use actual user allocation
                      handAllocation = userAllocatedCashInHand;
                      bankAllocation = userAllocatedCashInBank;
                      endingCashInHand = startingCashInHand + handAllocation;
                      endingCashInBank = startingCashInBank + bankAllocation;
                    } else {
                      // Fall back to 70/30 split when no specific allocation exists
                      bankAllocation = Math.round(totalCollected * 0.7); // 70% to bank
                      handAllocation = totalCollected - bankAllocation; // 30% to hand
                      endingCashInHand = startingCashInHand + handAllocation;
                      endingCashInBank = startingCashInBank + bankAllocation;
                    }
                    const endingGroupStanding = endingCashInHand + endingCashInBank + totalLoanAssets;
                    
                    const isFirstPeriod = currentPeriod?.periodNumber === 1;
                    
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {/* Starting Values */}
                        <div className="space-y-2">
                          <h5 className="font-medium text-gray-700 dark:text-gray-300">
                            {isFirstPeriod ? 'Starting Values (Group Creation)' : 'Starting Values (Previous Period)'}
                          </h5>
                          <div className="space-y-1 pl-2 border-l-2 border-blue-200 dark:border-blue-700">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Cash in Hand:</span>
                              <span className="font-medium">₹{startingCashInHand.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Cash in Bank:</span>
                              <span className="font-medium">₹{startingCashInBank.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Loan Assets:</span>
                              <span className="font-medium">₹{totalLoanAssets.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-1">
                              <span className="text-gray-700 dark:text-gray-300 font-medium">Starting Standing:</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">₹{startingGroupStanding.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* This Period's Activity */}
                        <div className="space-y-2">
                          <h5 className="font-medium text-gray-700 dark:text-gray-300">This Period&apos;s Activity</h5>
                          <div className="space-y-1 pl-2 border-l-2 border-green-200 dark:border-green-700">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Total Collection:</span>
                              <span className="font-medium text-green-600 dark:text-green-400">₹{totalCollected.toLocaleString()}</span>
                            </div>
                            {userAllocatedCashInHand > 0 || userAllocatedCashInBank > 0 ? (
                              <>
                                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                  <span className="pl-2">↳ To Bank (user allocated):</span>
                                  <span>₹{bankAllocation.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                  <span className="pl-2">↳ To Hand (user allocated):</span>
                                  <span>₹{handAllocation.toLocaleString()}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                  <span className="pl-2">↳ To Bank (70%):</span>
                                  <span>₹{bankAllocation.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                  <span className="pl-2">↳ To Hand (30%):</span>
                                  <span>₹{handAllocation.toLocaleString()}</span>
                                </div>
                              </>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Interest Earned:</span>
                              <span className="font-medium text-blue-600 dark:text-blue-400">₹{interestEarned.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Pending Collections:</span>
                              <span className="font-medium text-orange-600 dark:text-orange-400">₹{totalRemaining.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-1">
                              <span className="text-gray-700 dark:text-gray-300 font-medium">Ending Cash in Hand:</span>
                              <span className="font-bold text-green-600 dark:text-green-400">₹{endingCashInHand.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-700 dark:text-gray-300 font-medium">Ending Cash in Bank:</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">₹{endingCashInBank.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-t-2 border-primary pt-1">
                              <span className="text-gray-800 dark:text-gray-200 font-bold">Ending Group Standing:</span>
                              <span className="font-bold text-primary text-base">₹{endingGroupStanding.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
                    <strong>Note:</strong> When closing this period, these values will be recorded as the final state.
                    {(() => {
                      // Check if user has made specific allocations
                      const userAllocatedCashInHand = Object.values(actualContributions).reduce((sum, record) => {
                        if (record.cashAllocation) {
                          try {
                            const allocation = JSON.parse(record.cashAllocation);
                            return sum + (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
                          } catch (_e) {
                            return sum;
                          }
                        }
                        return sum;
                      }, 0);
                      
                      const userAllocatedCashInBank = Object.values(actualContributions).reduce((sum, record) => {
                        if (record.cashAllocation) {
                          try {
                            const allocation = JSON.parse(record.cashAllocation);
                            return sum + (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
                          } catch (_e) {
                            return sum;
                          }
                        }
                        return sum;
                      }, 0);
                      
                      if (userAllocatedCashInHand > 0 || userAllocatedCashInBank > 0) {
                        return ' Collections are allocated based on your actual inputs from the Track Contribution page.';
                      } else {
                        return ' Collections are automatically allocated: 70% to bank and 30% to hand (default allocation).';
                      }
                    })()}
                    {currentPeriod?.periodNumber === 1 && " This is the first period, so starting values from group creation will be included."}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowClosePeriodModal(false)}
                  className="flex-1 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClosePeriod}
                  disabled={closingPeriod || currentPeriod?.isClosed}
                  className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {closingPeriod ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Closing...
                    </>
                  ) : (
                    'Close Period'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Period Confirmation Modal */}
      {showReopenModal && selectedReopenPeriod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Reopen Period Confirmation
              </h3>
              <button
                onClick={() => {setShowReopenModal(false); setSelectedReopenPeriod(null);}}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Reopen Period
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      This will reopen the closed period and allow you to mark payments and make changes again. 
                      Any current active period will be deleted.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p><strong>Period to Reopen:</strong> {formatPeriodName(selectedReopenPeriod)}</p>
                  <p><strong>Originally Closed:</strong> {selectedReopenPeriod?.updatedAt ? new Date(selectedReopenPeriod.updatedAt).toLocaleDateString() : 'Unknown'}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    <strong>Note:</strong> After reopening, this period will become the current active period.
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {setShowReopenModal(false); setSelectedReopenPeriod(null);}}
                  className="flex-1 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={reopenPeriod}
                  disabled={reopeningPeriod}
                  className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {reopeningPeriod ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Reopening...
                    </>
                  ) : (
                    'Reopen Period'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loan Management Section */}
      <div className="mt-8">
        <div className="card">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Loan Management</h2>
                <p className="text-sm text-muted mt-1">
                  Manage loans, repayments, and group settings
                </p>
              </div>
              <button
                onClick={() => setShowLoanManagement(!showLoanManagement)}
                className="btn-secondary"
              >
                {showLoanManagement ? 'Hide' : 'Show'} Loan Management
              </button>
            </div>

            {showLoanManagement && (
              <div className="space-y-6">
                {/* Current Loan Summary */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Current Loan Summary
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        ₹{group.members.reduce((sum, member) => sum + (member.currentLoanBalance || 0), 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total Outstanding Loans</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {group?.interestRate || 0}%
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Current Interest Rate</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        ₹{group?.monthlyContribution || 0}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Monthly Contribution</div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <button
                    onClick={() => setShowNewLoanModal(true)}
                    className="btn-primary flex items-center justify-center"
                    disabled={!group.userPermissions?.canEdit}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    New Loan
                  </button>
                  
                  <button
                    onClick={() => setShowLoanRepaymentModal(true)}
                    className="btn-secondary flex items-center justify-center"
                    disabled={!group.userPermissions?.canEdit}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    Loan Repayment
                  </button>
                  
                  <button
                    onClick={() => {
                      setNewInterestRate(group?.interestRate?.toString() || '');
                      setShowInterestRateModal(true);
                    }}
                    className="btn-secondary flex items-center justify-center"
                    disabled={!group.userPermissions?.canEdit || session?.user?.memberId !== group.leader?.id}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Interest Rate
                  </button>
                  
                  <button
                    onClick={() => {
                      setNewContributionAmount(group?.monthlyContribution?.toString() || '');
                      setShowContributionAmountModal(true);
                    }}
                    className="btn-secondary flex items-center justify-center"
                    disabled={!group.userPermissions?.canEdit || session?.user?.memberId !== group.leader?.id}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Contribution Amount
                  </button>
                </div>

                {/* Member Loan Status Table */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Member Loan Status
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-900/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Member
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Current Loan
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Annual Interest
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {group.members.map((member) => {
                          const annualInterest = member.currentLoanBalance ? 
                            (member.currentLoanBalance * (group?.interestRate || 0) / 100) : 0;
                          
                          return (
                            <tr key={member.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {member.name}
                                </div>
                                {member.email && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {member.email}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  ₹{(member.currentLoanBalance || 0).toLocaleString()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  ₹{annualInterest.toLocaleString()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                <button
                                  onClick={() => {
                                    setSelectedLoanMember(member);
                                    setShowNewLoanModal(true);
                                  }}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                  disabled={!group.userPermissions?.canEdit}
                                >
                                  Add Loan
                                </button>                                  {member.currentLoanBalance && member.currentLoanBalance > 0 && (
                                    <button
                                      onClick={() => {
                                        console.log('💰 LOAN REPAYMENT: Setting up repayment for member:', {
                                          member: member,
                                          id: member.id,
                                          name: member.name,
                                          currentLoanBalance: member.currentLoanBalance
                                        });
                                        setSelectedLoanMember(member);
                                        setShowLoanRepaymentModal(true);
                                      }}
                                      className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                                      disabled={!group.userPermissions?.canEdit}
                                    >
                                      Repay
                                    </button>
                                  )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Loan Modal */}
      {showNewLoanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Add New Loan
              </h3>
              <button
                onClick={() => {
                  setShowNewLoanModal(false);
                  setSelectedLoanMember(null);
                  setNewLoanAmount('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Member
                </label>
                <select
                  value={selectedLoanMember?.id || ''}
                  onChange={(e) => {
                    const member = group.members.find(m => m.id === e.target.value);
                    setSelectedLoanMember(member || null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="">Select a member</option>
                  {group.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} - Current Loan: ₹{(member.currentLoanBalance || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Loan Amount (₹)
                </label>
                <input
                  type="number"
                  value={newLoanAmount}
                  onChange={(e) => setNewLoanAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Enter loan amount"
                  min="0"
                  step="1"
                />
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p><strong>Current Interest Rate:</strong> {group?.interestRate || 0}% per annum</p>
                {selectedLoanMember && newLoanAmount && (
                  <p><strong>Annual Interest:</strong> ₹{(parseFloat(newLoanAmount) * (group?.interestRate || 0) / 100).toFixed(2)}</p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowNewLoanModal(false);
                    setSelectedLoanMember(null);
                    setNewLoanAmount('');
                  }}
                  className="flex-1 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNewLoan}
                  disabled={!selectedLoanMember || !newLoanAmount || savingLoanOperation}
                  className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {savingLoanOperation ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Create Loan'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loan Repayment Modal */}
      {showLoanRepaymentModal && selectedLoanMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Loan Repayment
              </h3>
              <button
                onClick={() => {
                  setShowLoanRepaymentModal(false);
                  setSelectedLoanMember(null);
                  setLoanRepaymentAmount('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Member:</strong> {selectedLoanMember.name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Current Loan Balance:</strong> ₹{(selectedLoanMember.currentLoanBalance || 0).toLocaleString()}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Repayment Amount (₹)
                </label>
                <input
                  type="number"
                  value={loanRepaymentAmount}
                  onChange={(e) => {
                    console.log('💰 LOAN REPAYMENT: Amount input changed:', {
                      newValue: e.target.value,
                      valueType: typeof e.target.value,
                      previousValue: loanRepaymentAmount
                    });
                    setLoanRepaymentAmount(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Enter repayment amount"
                  min="0"
                  max={selectedLoanMember.currentLoanBalance || 0}
                  step="1"
                />
              </div>
              
              {loanRepaymentAmount && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p><strong>Remaining Balance:</strong> ₹{Math.max(0, (selectedLoanMember.currentLoanBalance || 0) - parseFloat(loanRepaymentAmount)).toLocaleString()}</p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowLoanRepaymentModal(false);
                    setSelectedLoanMember(null);
                    setLoanRepaymentAmount('');
                  }}
                  className="flex-1 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    console.log('💰 LOAN REPAYMENT: Submit button clicked', {
                      selectedLoanMember: selectedLoanMember ? {
                        id: selectedLoanMember.id, 
                        name: selectedLoanMember.name,
                        currentLoanBalance: selectedLoanMember.currentLoanBalance
                      } : null,
                      loanRepaymentAmount: loanRepaymentAmount,
                      savingLoanOperation: savingLoanOperation
                    });
                    handleLoanRepayment();
                  }}
                  disabled={!loanRepaymentAmount || savingLoanOperation}
                  className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {savingLoanOperation ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    'Process Repayment'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interest Rate Change Modal */}
      {showInterestRateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Update Interest Rate
              </h3>
              <button
                onClick={() => {
                  setShowInterestRateModal(false);
                  setNewInterestRate('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Important Notice
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      This will update the interest rate for all current and future loans.
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Interest Rate (% per month)
                </label>
                <input
                  type="number"
                  value={newInterestRate}
                  onChange={(e) => setNewInterestRate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Enter new interest rate"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p><strong>Current Rate:</strong> {group?.interestRate || 0}% per month</p>
                {newInterestRate && (
                  <p><strong>New Rate:</strong> {newInterestRate}% per month</p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowInterestRateModal(false);
                    setNewInterestRate('');
                  }}
                  className="flex-1 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInterestRateChange}
                  disabled={!newInterestRate || savingLoanOperation}
                  className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {savingLoanOperation ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    'Update Rate'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contribution Amount Change Modal */}
      {showContributionAmountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Update Monthly Contribution
              </h3>
              <button
                onClick={() => {
                  setShowContributionAmountModal(false);
                  setNewContributionAmount('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Important Notice
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      This will update the monthly contribution amount for all members.
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Monthly Contribution (₹)
                </label>
                <input
                  type="number"
                  value={newContributionAmount}
                  onChange={(e) => setNewContributionAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Enter new contribution amount"
                  min="0"
                  step="1"
                />
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p><strong>Current Amount:</strong> ₹{(group?.monthlyContribution || 0).toLocaleString()}</p>
                {newContributionAmount && (
                  <p><strong>New Amount:</strong> ₹{parseFloat(newContributionAmount).toLocaleString()}</p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowContributionAmountModal(false);
                    setNewContributionAmount('');
                  }}
                  className="flex-1 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleContributionAmountChange}
                  disabled={!newContributionAmount || savingLoanOperation}
                  className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {savingLoanOperation ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    'Update Amount'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}