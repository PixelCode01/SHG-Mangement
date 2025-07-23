'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { devConsole, rateLogger } from '../../../utils/performance';
import Link from 'next/link';
import dynamic from 'next/dynamic';
// Import DatePicker dynamically to avoid SSR issues
const DatePicker = dynamic(() => import('react-datepicker'), { ssr: false });
import 'react-datepicker/dist/react-datepicker.css';
import { calculatePeriodInterestFromDecimal } from '@/app/lib/interest-utils';
import ReportModal from '@/app/components/ReportModal';
import { roundToTwoDecimals, formatCurrency } from '@/app/lib/currency-utils';
import { getPreviousPeriodStanding, calculateMonthlyGrowth } from '@/app/lib/report-utils';

// Type declaration for jspdf-autotable
declare module 'jspdf' {
  interface jsPDF {
    // ...existing code...
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
  familyMembersCount?: number;
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
  establishmentYear?: string; // Year the group was established
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
  
  // Loan Insurance settings
  loanInsuranceEnabled?: boolean;
  loanInsurancePercent?: number;
  loanInsuranceBalance?: number; // Previous balance from step 4 of group creation
  
  // Group Social settings
  groupSocialEnabled?: boolean;
  groupSocialAmountPerFamilyMember?: number;
  groupSocialBalance?: number; // Previous balance from step 4 of group creation
  
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
  loanInsuranceDue?: number;
  groupSocialDue?: number;
  minimumDueAmount: number;
  
  // Actual payments
  compulsoryContributionPaid: number;
  loanInterestPaid: number;
  lateFinePaid: number;
  loanInsurancePaid: number;
  groupSocialPaid: number;
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
  familySize: number; // Added family size
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
  // New fields for loan insurance and group social
  loanInsuranceAmount?: number;
  groupSocialAmount?: number;
}

export default function ContributionTrackingPage() {
  const params = useParams();
  const groupId = params.id as string;
  const { data: session } = useSession();

  // State declarations must come before any functions that use them
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
    loanInsuranceCollectedThisPeriod?: number | null;
    groupSocialCollectedThisPeriod?: number | null;
    isDelinquencyPeriod?: boolean;
    delinquencyStartDate?: string | null;
    totalGroupStanding?: number | null;
    bankInterestEarned?: number | null;
    totalSavingsThisPeriod?: number | null;
    totalWithdrawalsThisPeriod?: number | null;
    cumulativeShares?: number | null;
    cumulativeInterest?: number | null;
    fundBalanceLI?: number | null;
    fundBalanceGS?: number | null;
  } | null>(null);
  const [allPeriods, setAllPeriods] = useState<Array<{
    id: string;
    startDate: string;
    endDate?: string;
    isClosed: boolean;
    periodNumber: number;
    periodType: string;
  }>>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({
    status: '' as 'ALL' | 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE' | '',
    member: ''
  });
  const [selectedMemberForPayment, setSelectedMemberForPayment] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  
  // Function to get formatted period name
  const getCurrentPeriodName = () => {
    if (!currentPeriod) return "Current Period";
    
    const startDate = currentPeriod.startDate 
      ? new Date(currentPeriod.startDate) 
      : new Date();
      
    return startDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  };
  
  // Function to format period name for historical periods
  const formatPeriodName = (period: any) => {
    if (!period) return "Unknown Period";
    
    const startDate = period.startDate 
      ? new Date(period.startDate) 
      : new Date();
      
    return startDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Generate report function to open the report modal
  const generateReport = () => {
    setShowReportModal(true);
  };
  const [showContributionAmountModal, setShowContributionAmountModal] = useState(false);
  const [newContributionAmount, setNewContributionAmount] = useState('');
  const [showInterestRateModal, setShowInterestRateModal] = useState(false);
  const [newInterestRate, setNewInterestRate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [currentSortConfig, setCurrentSortConfig] = useState<{ 
    key: keyof MemberContributionStatus | null; 
    direction: 'asc' | 'desc' 
  }>({ 
    key: null, 
    direction: 'asc' 
  });

  // PDF Export Handler with dynamic import to avoid SSR issues
  const handleDownloadPDF = useCallback(async () => {
    if (!group || !currentPeriod) return;

    try {
      // Dynamic import to avoid SSR issues
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF();

      // Header
      doc.setFontSize(16);
      doc.text(group.name || 'Group Name', 14, 16);
      doc.setFontSize(10);
      doc.text(`Est. ${group.dateOfStarting ? new Date(group.dateOfStarting).getFullYear() : ''}`, 14, 22);
      doc.text(`Period: ${currentPeriod.startDate ? new Date(currentPeriod.startDate).toLocaleString('default', { month: 'long', year: 'numeric' }) : ''}`,
        14, 28);

      // Financial Summary
      const cashInHand = Math.ceil(group.cashInHand || 0);
      const cashInBank = Math.ceil(group.balanceInBank || 0);
      const totalLoanAssets = Math.ceil(group.members.reduce((sum, m) => sum + (m.currentLoanBalance || 0), 0));
      const groupStanding = cashInHand + cashInBank + totalLoanAssets;
      const memberCount = group.members.length;
      const sharePerMember = memberCount > 0 ? Math.ceil(groupStanding / memberCount) : 0;

      doc.setFontSize(12);
      doc.text('Financial Summary', 14, 38);
      autoTable(doc, {
        startY: 42,
        head: [['Cash in Hand', 'Cash in Bank', 'Total Loan Assets', 'Group Standing', 'Members', 'Share/Member']],
        body: [[
          cashInHand.toLocaleString(),
          cashInBank.toLocaleString(),
          totalLoanAssets.toLocaleString(),
          groupStanding.toLocaleString(),
          memberCount,
          sharePerMember.toLocaleString()
        ]],
        theme: 'grid',
        styles: { fontSize: 10 },
      });

      // Fund Breakdown (GS, FD, LI, EL) - use available fields only
      // For demo, only GS and LI if available
      let fundRows = [];
      if (group.groupSocialEnabled) {
        fundRows.push(['Group Social (GS)', Math.ceil((group.groupSocialAmountPerFamilyMember || 0) * memberCount).toLocaleString()]);
      }
      if (group.loanInsuranceEnabled) {
        fundRows.push(['Loan Insurance (LI)', Math.ceil((group.loanInsurancePercent || 0) * totalLoanAssets / 100).toLocaleString()]);
      }
      if (fundRows.length > 0) {
        doc.text('Fund Breakdown', 14, doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 60);
        autoTable(doc, {
          startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 14 : 64,
          head: [['Fund', 'Amount']],
          body: fundRows,
          theme: 'grid',
          styles: { fontSize: 10 },
        });
      }

      // Member Table
      doc.text('Member Contributions', 14, doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 90);
      const memberRows = group.members.map((m) => [
        m.name,
        Math.ceil(m.currentShareAmount || 0).toLocaleString(),
        Math.ceil(m.currentLoanBalance || 0).toLocaleString(),
        m.familyMembersCount || '',
      ]);
      autoTable(doc, {
        startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 14 : 94,
        head: [['Name', 'Share Amount', 'Loan Balance', 'Family Size']],
        body: memberRows,
        theme: 'grid',
        styles: { fontSize: 9 },
      });

      // Standing Calculation Formula
      doc.setFontSize(10);
      doc.text('Group Standing = Cash in Hand + Cash in Bank + Total Loan Assets', 14, doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 120);

      doc.save(`${group.name || 'group'}-statement.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF report. Please try again.');
    }
  }, [group, currentPeriod]);

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
  
  // Additional state declarations (avoiding duplicates)
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
  const [selectedLoanMember, setSelectedLoanMember] = useState<GroupMember | null>(null);
  const [newLoanAmount, setNewLoanAmount] = useState('');
  const [loanRepaymentAmount, setLoanRepaymentAmount] = useState('');
  const [savingLoanOperation, setSavingLoanOperation] = useState(false);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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
  const [submissionDate, setSubmissionDate] = useState<Date>(new Date()); // New state for submission date
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
    loanInsurancePaid: number;
    groupSocialPaid: number;
    remainingLoan: number;
    submissionDate: Date; // Added submission date for each member
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
      devConsole.log('📋 [FETCH DATA] Fetching current period...');
      try {
        const periodResponse = await fetch(`/api/groups/${groupId}/contributions/periods/current`);
        devConsole.log('📋 [FETCH DATA] Current period API response status:', periodResponse.status);
        
        if (periodResponse.ok) {
          const periodData = await periodResponse.json();
          devConsole.log('📋 [FETCH DATA] Current period API response data:', periodData);
          
          if (periodData.period) {
            devConsole.log('📋 [FETCH DATA] Setting current period:', {
              id: periodData.period.id,
              startDate: periodData.period.startDate,
              periodNumber: periodData.period.periodNumber,
              isClosed: periodData.period.isClosed
            });
            setCurrentPeriod(periodData.period);
          } else {
            // No current period exists, create one
            devConsole.log('📋 [FETCH DATA] No current period found, creating a new one...');
            await createNewPeriod(groupData);
          }
        } else {
          // API error, try to create a new period
          devConsole.log('📋 [FETCH DATA] Period API error, attempting to create a new one...');
          const errorText = await periodResponse.text();
          devConsole.log('📋 [FETCH DATA] Error details:', errorText);
          await createNewPeriod(groupData);
        }
      } catch (_err) {
        devConsole.log('📋 [FETCH DATA] Exception fetching period, creating a new one...', _err);
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
      const calculatedContributions = calculateMemberContributions(group, actualContributions);
      setMemberContributions(calculatedContributions);

      // Initialize member collections state for new members (only if they don't exist)
      const initialCollections: Record<string, any> = {};
      let hasNewMembers = false;
      
      calculatedContributions.forEach((contribution: any) => {
        if (!memberCollections[contribution.memberId]) {
          hasNewMembers = true;
          initialCollections[contribution.memberId] = {
            cashAmount: 0,
            bankAmount: 0,
            compulsoryContribution: 0,
            interestPaid: 0,
            loanRepayment: 0,
            lateFinePaid: 0,
            loanInsurancePaid: 0,
            groupSocialPaid: 0,
            remainingLoan: contribution.currentLoanBalance || 0,
            submissionDate: new Date() // Add submission date with default value
          };
        }
      });

      if (hasNewMembers && Object.keys(initialCollections).length > 0) {
        setMemberCollections((prev: any) => ({ ...prev, ...initialCollections }));
      }
    }
  }, [group, currentPeriod, actualContributions]); // Remove memberCollections to prevent infinite loop

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
    
    rateLogger.log('due-date-calc', `🔍 [DUE DATE CALCULATION] Starting calculation:`, {
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
        
        rateLogger.log('monthly-calc', `🔍 [DUE DATE DEBUG] Monthly calculation:`, {
          targetDay,
          activePeriod
        });
        
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
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔍 [DUE DATE FIX] Using active period month for due date calculation:`);
            console.log(`   Active Period: ${periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
            console.log(`   Target Day: ${targetDay}`);
            console.log(`   Calculated Due Date: ${dueDate.toDateString()}`);
          }
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
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚠️ [DUE DATE FALLBACK] No active period info, using current month:`);
          console.log(`   Current Month: ${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
          console.log(`   Fallback Due Date: ${dueDate.toDateString()}`);
          console.log(`   This is likely causing the incorrect overdue calculation!`);
        }
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

  // Calculate late fine dynamically based on submission date
  const calculateLateFineForSubmissionDate = (groupData: GroupData, submissionDate: Date, expectedContribution: number): { daysLate: number, lateFineAmount: number } => {
    if (!currentPeriod) return { daysLate: 0, lateFineAmount: 0 };
    
    const currentPeriodDueDate = calculateCurrentPeriodDueDate(groupData, currentPeriod);
    const daysLate = Math.max(0, Math.floor((submissionDate.getTime() - currentPeriodDueDate.getTime()) / (1000 * 60 * 60 * 24)));
    const lateFineAmount = calculateLateFine(groupData, daysLate, expectedContribution);
    
    return { daysLate, lateFineAmount };
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
      
      // Calculate loan insurance amount (only if member has a loan and feature is enabled)
      const loanInsuranceAmount = groupData.loanInsuranceEnabled && currentLoanBalance > 0 
        ? roundToTwoDecimals(currentLoanBalance * (groupData.loanInsurancePercent || 0) / 100)
        : 0;
      
      // Calculate group social amount (family-based if feature is enabled)
      const groupSocialAmount = groupData.groupSocialEnabled 
        ? roundToTwoDecimals((groupData.groupSocialAmountPerFamilyMember || 0) * (member.familyMembersCount || 1))
        : 0;
      
      // DEBUG: Enhanced logging for family member counts and group social calculation
      if (groupData.groupSocialEnabled) {
        console.log(`🔍 [Group Social Debug] ${member.name}:`, {
          familyMembersCount: member.familyMembersCount,
          familyMembersCountType: typeof member.familyMembersCount,
          familyMembersCountIsNull: member.familyMembersCount === null,
          familyMembersCountIsUndefined: member.familyMembersCount === undefined,
          usedFamilySize: member.familyMembersCount || 1,
          groupSocialAmountPerFamilyMember: groupData.groupSocialAmountPerFamilyMember,
          calculatedGroupSocialAmount: groupSocialAmount,
          memberObject: JSON.stringify(member, null, 2)
        });
      }
      
      // Always calculate days late and late fine using frontend logic
      // Backend calculation is not reliable for late fines currently
      let daysLate = 0;
      let lateFineAmount = 0;
      
      // Calculate days late based on current period due date
      daysLate = Math.max(0, Math.floor((today.getTime() - currentPeriodDueDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Calculate late fine using frontend calculation (now fixed)
      lateFineAmount = calculateLateFine(groupData, daysLate, expectedContribution);
      
      const totalExpected = roundToTwoDecimals(expectedContribution + expectedInterest + lateFineAmount + loanInsuranceAmount + groupSocialAmount);
      
      // Use actual payment data from MemberContribution records if available
      const actualContribution = actualContributions[member.id];
      let paidAmount = 0;
      let status: 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE' = 'PENDING';
      let lastPaymentDate: string | undefined;

      if (actualContribution) {
        // Get data from actual MemberContribution record
        paidAmount = roundToTwoDecimals(actualContribution.totalPaid || 0);
        lastPaymentDate = actualContribution.paidDate;
        
        // � CRITICAL FIX: Use API status directly when available
        // The backend determines the authoritative status based on business rules
        if (actualContribution.status) {
          status = actualContribution.status;
          
          // For API-determined PAID status, trust the backend calculation
          if (status === 'PAID') {
            // Override frontend calculation with API's determination
            // This ensures frontend matches backend business logic
            const apiRemainingAmount = actualContribution.remainingAmount || 0;
            
            // 🔍 DEBUG: Log API vs Frontend discrepancy resolution
            if (process.env.NODE_ENV === 'development' && member.name.includes('AISHWARYA')) {
              console.log('🔧 [STATUS FIX] Using API status for', member.name, {
                apiStatus: actualContribution.status,
                apiRemainingAmount,
                frontendTotalExpected: totalExpected,
                frontendPaidAmount: paidAmount,
                frontendCalculatedRemaining: totalExpected - paidAmount,
                statusSource: 'API_AUTHORITATIVE'
              });
            }
            
            // When API says PAID, respect that determination
            return {
              memberId: member.id,
              memberName: member.name,
              expectedContribution: roundToTwoDecimals(expectedContribution),
              expectedInterest,
              currentLoanBalance: roundToTwoDecimals(currentLoanBalance),
              lateFineAmount,
              daysLate,
              dueDate: currentPeriodDueDate,
              totalExpected: paidAmount, // Use paid amount as total when PAID
              paidAmount,
              remainingAmount: 0, // API says it's paid, so remaining is 0
              status: 'PAID',
              lastPaymentDate,
              loanInsuranceAmount,
              groupSocialAmount,
            } as MemberContributionStatus;
          }
        }
        
        // �🔍 DEBUG: Log payment calculation details for non-PAID statuses
        if (process.env.NODE_ENV === 'development' && member.name.includes('AISHWARYA')) {
          console.log('🔍 [STATUS DEBUG] Payment calculation for', member.name, {
            totalExpected,
            paidAmount,
            actualContribution,
            expectedContribution,
            lateFineAmount,
            groupSocialAmount,
            loanInsuranceAmount
          });
        }
        
        // Calculate remaining amount first to ensure accurate status
        const remainingAmountRaw = totalExpected - paidAmount;
        
        // 🔍 DEBUG: Log status calculation details
        if (process.env.NODE_ENV === 'development' && member.name.includes('AISHWARYA')) {
          console.log('🔍 [STATUS DEBUG] Status calculation for', member.name, {
            remainingAmountRaw,
            daysLate,
            paidAmount,
            willMarkAsPaid: remainingAmountRaw <= 0.01
          });
        }
        
        // Fallback to frontend calculation if no API status or not PAID
        if (!actualContribution.status) {
          if (remainingAmountRaw <= 0.01) { // Allow for small rounding errors (1 cent)
            status = 'PAID';
          } else if (paidAmount > 0) {
            status = daysLate > 0 ? 'OVERDUE' : 'PARTIAL';
          } else if (daysLate > 0) {
            status = 'OVERDUE';
          }
        }
      } else {
        // No contribution record exists yet - all amounts are pending
        paidAmount = 0;
        status = daysLate > 0 ? 'OVERDUE' : 'PENDING';
      }
      
      const remainingAmount = roundToTwoDecimals(Math.max(0, totalExpected - paidAmount));
      
      // 🔍 DEBUG: Final status check for AISHWARYA
      if (process.env.NODE_ENV === 'development' && member.name.includes('AISHWARYA')) {
        console.log('🔍 [STATUS DEBUG] Final status for', member.name, {
          finalStatus: status,
          remainingAmount,
          totalExpected,
          paidAmount,
          statusLogic: {
            remainingAmountCheck: remainingAmount <= 0.01,
            hasPaidSomething: paidAmount > 0,
            apiStatusUsed: actualContribution?.status === 'PAID' ? 'YES' : 'NO'
          }
        });
      }
      
      return {
        memberId: member.id,
        memberName: member.name,
        familySize: member.familySize || 0,
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
        loanInsuranceAmount,
        groupSocialAmount,
      } as MemberContributionStatus;
    });
  };

  // New function to submit member collection with comprehensive logging for GS/LI input collection and total calculation
  const submitMemberCollection = async (memberId: string) => {
    const collection = memberCollections[memberId];
    if (!collection || !currentPeriod) return;

    // 🔍 LOG 1: Check what's in the collection object - FIXED FIELD NAMES
    console.log('🔍 [SUBMIT DEBUG] Raw collection object - FIXED:', {
      memberId,
      collection,
      hasGroupSocialPaid: 'groupSocialPaid' in collection,  // 🔧 FIXED field name
      hasLoanInsurancePaid: 'loanInsurancePaid' in collection,  // 🔧 FIXED field name
      groupSocialPaidValue: collection.groupSocialPaid,  // 🔧 FIXED field name
      loanInsurancePaidValue: collection.loanInsurancePaid,  // 🔧 FIXED field name
      compulsoryContribution: collection.compulsoryContribution,
      interestPaid: collection.interestPaid,
      lateFinePaid: collection.lateFinePaid,
      loanRepayment: collection.loanRepayment
    });

    // 🔍 LOG 2: Check total calculation - FIXED TO INCLUDE GS AND LI
    const calculatedTotal = (collection.compulsoryContribution || 0) + 
                           (collection.interestPaid || 0) + 
                           (collection.lateFinePaid || 0) + 
                           (collection.groupSocialPaid || 0) +  // 🔧 FIXED: was collection.groupSocial
                           (collection.loanInsurancePaid || 0);  // 🔧 FIXED: was collection.loanInsurance
    
    console.log('🔍 [SUBMIT DEBUG] Total calculation breakdown - FIXED:', {
      compulsoryContribution: collection.compulsoryContribution || 0,
      interestPaid: collection.interestPaid || 0,
      lateFinePaid: collection.lateFinePaid || 0,
      groupSocialPaid: collection.groupSocialPaid || 0,  // 🔧 FIXED field name
      loanInsurancePaid: collection.loanInsurancePaid || 0,  // 🔧 FIXED field name
      calculatedTotal
    });

    setSavingPayment(memberId);
    
    try {
      const contributionId = actualContributions[memberId]?.id;
      if (!contributionId) {
        throw new Error('No contribution record found for this member');
      }

      // 🔍 LOG 3: Check API payload being sent - FIXED FIELD NAMES
      const apiPayload = {
        compulsoryContributionPaid: collection.compulsoryContribution,
        loanInterestPaid: collection.interestPaid,
        lateFinePaid: collection.lateFinePaid || 0,
        groupSocialPaid: collection.groupSocialPaid || 0,  // � FIXED: was collection.groupSocial
        loanInsurancePaid: collection.loanInsurancePaid || 0,  // � FIXED: was collection.loanInsurance
        totalPaid: calculatedTotal,
        status: 'PAID'
      };

      console.log('🔍 [SUBMIT DEBUG] API payload being sent:', apiPayload);

      const response = await fetch(`/api/groups/${groupId}/contributions/${contributionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('🔍 [SUBMIT DEBUG] API Error Response:', errorData);
        throw new Error(errorData.error || 'Failed to update contribution');
      }

      const { contribution: updatedContribution } = await response.json();

      // 🔍 LOG 4: Check what API returned
      console.log('🔍 [SUBMIT DEBUG] API Response:', {
        updatedContribution,
        status: updatedContribution.status,
        totalPaid: updatedContribution.totalPaid,
        remainingAmount: updatedContribution.remainingAmount,
        groupSocialPaid: updatedContribution.groupSocialPaid,
        loanInsurancePaid: updatedContribution.loanInsurancePaid
      });

      // Update local state immediately for instant UI feedback
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 [SUBMISSION] Updating local state with:', updatedContribution);
      }
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

      // Refresh group data to update loan balances and contribution data
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 [SUBMISSION] Refreshing group data...');
      }
      await fetchGroupData();
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 [SUBMISSION] Group data refreshed successfully');
      }
      
      // Clear the member collection data after successful submission and refresh
      setMemberCollections((prev: any) => {
        const newState = { ...prev };
        delete newState[memberId];
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 [SUBMISSION] Cleared member collection for:', memberId);
        }
        return newState;
      });

      // Force recalculation of member contributions to update status
      if (group) {
        const updatedPaymentData = {
          ...actualContributions,
          [memberId]: updatedContribution
        };
        const recalculatedContributions = calculateMemberContributions(group, updatedPaymentData);
        setMemberContributions(recalculatedContributions);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 [SUBMISSION] Recalculated member contributions:', recalculatedContributions);
        }
      }

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
    lateFineToHand?: number;
    lateFineToBank?: number;
    groupSocialToHand?: number;
    groupSocialToBank?: number;
    loanInsuranceToHand?: number;
    loanInsuranceToBank?: number;
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

      // Allocate payment: first to compulsory contribution, then interest, then late fine, then GS, then LI, and finally loan balance
      let remainingPayment = roundToTwoDecimals(amount);
      let compulsoryPaid = roundToTwoDecimals(memberContribution.compulsoryContributionPaid || 0);
      let interestPaid = roundToTwoDecimals(memberContribution.loanInterestPaid || 0);
      let lateFinesPaid = roundToTwoDecimals(memberContribution.lateFinePaid || 0);
      let groupSocialPaid = roundToTwoDecimals(memberContribution.groupSocialPaid || 0);
      let loanInsurancePaid = roundToTwoDecimals(memberContribution.loanInsurancePaid || 0);

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

      // Pay late fines third
      if (remainingPayment > 0 && lateFinesPaid < memberContrib.lateFineAmount) {
        const needToPayLateFines = roundToTwoDecimals(memberContrib.lateFineAmount - lateFinesPaid);
        const payLateFines = roundToTwoDecimals(Math.min(remainingPayment, needToPayLateFines));
        lateFinesPaid = roundToTwoDecimals(lateFinesPaid + payLateFines);
        remainingPayment = roundToTwoDecimals(remainingPayment - payLateFines);
      }
      
      // Pay group social fourth
      if (remainingPayment > 0 && group?.groupSocialEnabled && groupSocialPaid < (memberContrib.groupSocialAmount || 0)) {
        const needToPayGS = roundToTwoDecimals((memberContrib.groupSocialAmount || 0) - groupSocialPaid);
        const payGS = roundToTwoDecimals(Math.min(remainingPayment, needToPayGS));
        groupSocialPaid = roundToTwoDecimals(groupSocialPaid + payGS);
        remainingPayment = roundToTwoDecimals(remainingPayment - payGS);
      }
      
      // Pay loan insurance fifth
      if (remainingPayment > 0 && group?.loanInsuranceEnabled && loanInsurancePaid < (memberContrib.loanInsuranceAmount || 0)) {
        const needToPayLI = roundToTwoDecimals((memberContrib.loanInsuranceAmount || 0) - loanInsurancePaid);
        const payLI = roundToTwoDecimals(Math.min(remainingPayment, needToPayLI));
        loanInsurancePaid = roundToTwoDecimals(loanInsurancePaid + payLI);
        remainingPayment = roundToTwoDecimals(remainingPayment - payLI);
      }

      // Update the contribution via API with cash allocation data
      const response = await fetch(`/api/groups/${groupId}/contributions/${memberContribution.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compulsoryContributionPaid: compulsoryPaid,
          loanInterestPaid: interestPaid,
          lateFinePaid: lateFinesPaid,
          groupSocialPaid: groupSocialPaid,
          loanInsurancePaid: loanInsurancePaid,
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
  const calculateAutoAllocation = () => {
    if (!selectedMember) return;
    
    const paymentAmt = Number(paymentAmount) || 0;
    if (paymentAmt <= 0) return;
    
    // Auto-allocate based on payment distribution
    let remainingPayment = paymentAmt;
    let contributionPayment = 0;
    let interestPayment = 0;
    let lateFinePayment = 0;
    let groupSocialPayment = 0;
    let loanInsurancePayment = 0;
    
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
    
    // Then allocate to late fines
    if (remainingPayment > 0 && selectedMember.lateFineAmount > 0) {
      lateFinePayment = Math.min(remainingPayment, selectedMember.lateFineAmount);
      remainingPayment -= lateFinePayment;
    }
    
    // Then allocate to group social
    if (remainingPayment > 0 && group?.groupSocialEnabled && selectedMember.groupSocialAmount > 0) {
      groupSocialPayment = Math.min(remainingPayment, selectedMember.groupSocialAmount);
      remainingPayment -= groupSocialPayment;
    }
    
    // Then allocate to loan insurance
    if (remainingPayment > 0 && group?.loanInsuranceEnabled && selectedMember.loanInsuranceAmount > 0) {
      loanInsurancePayment = Math.min(remainingPayment, selectedMember.loanInsuranceAmount);
      remainingPayment -= loanInsurancePayment;
    }
    
    // Set the allocation amounts - 30% to cash in hand, 70% to bank by default
    setContributionAllocation({
      cashInHand: roundToTwoDecimals(contributionPayment * 0.3),
      cashInBank: roundToTwoDecimals(contributionPayment * 0.7)
    });
    
    setInterestAllocation({
      cashInHand: roundToTwoDecimals(interestPayment * 0.3),
      cashInBank: roundToTwoDecimals(interestPayment * 0.7)
    });
    
    // Note: We're not exposing UI for allocating late fine, group social, and loan insurance in the payment modal
    // They will follow the same cash allocation pattern as the main payment
  };

  // Function to generate CSV report with loan insurance and group social support
  const generateCSVReport = () => {
    if (!group) return;
    
    // Helper function to format period name
    const formatPeriodName = (period: any) => {
      if (!period) return 'Current Period';
      
      const frequency = group.collectionFrequency || 'MONTHLY';
      const startDate = new Date(period.startDate);
      
      if (frequency === 'MONTHLY') {
        return startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      } else if (frequency === 'WEEKLY') {
        return `Week of ${startDate.toLocaleDateString('en-IN')}`;
      } else if (frequency === 'YEARLY') {
        return startDate.toLocaleDateString('en-IN', { year: 'numeric' });
      } else {
        return `${startDate.toLocaleDateString('en-IN')} to ${new Date().toLocaleDateString('en-IN')}`;
      }
    };
    
    try {
      // Calculate all financial data
      const totalExpected = memberContributions.reduce((sum, c) => sum + (c.totalExpected || 0), 0);
      const totalCollected = memberContributions.reduce((sum, c) => sum + (c.paidAmount || 0), 0);
      const totalCompulsoryContribution = memberContributions.reduce((sum, c) => sum + (c.expectedContribution || 0), 0);
      const totalInterestPaid = memberContributions.reduce((sum, c) => sum + (c.expectedInterest || 0), 0);
      const totalLateFines = memberContributions.reduce((sum, c) => sum + (c.lateFineAmount || 0), 0);
      const totalLoanInsurance = memberContributions.reduce((sum, c) => sum + (c.loanInsuranceAmount || 0), 0);
      const totalGroupSocial = memberContributions.reduce((sum, c) => sum + (c.groupSocialAmount || 0), 0);
      const totalPersonalLoanOutstanding = memberContributions.reduce((sum, c) => sum + (c.currentLoanBalance || 0), 0);
      
      // Calculate cash allocation totals
      const totalCashInHand = Object.values(actualContributions).reduce((sum, record) => {
        if (record.cashAllocation) {
          try {
            const allocation = JSON.parse(record.cashAllocation);
            return sum + (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
          } catch (_e) { return sum; }
        }
        return sum + Math.ceil((record.totalPaid || 0) * 0.3); // Default 30% to cash
      }, 0);
      
      const totalCashInBank = Object.values(actualContributions).reduce((sum, record) => {
        if (record.cashAllocation) {
          try {
            const allocation = JSON.parse(record.cashAllocation);
            return sum + (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
          } catch (_e) { return sum; }
        }
        return sum + Math.ceil((record.totalPaid || 0) * 0.7); // Default 70% to bank
      }, 0);

      // Create dynamic headers based on enabled features
      const headers = ['SL', 'Member Name', 'Compulsory Contribution'];
      
      // Add conditional columns
      if (memberContributions.some(m => (m.expectedInterest || 0) > 0)) {
        headers.push('Personal Loan Interest');
      }
      
      if (memberContributions.some(m => (m.lateFineAmount || 0) > 0)) {
        headers.push('Late Fine');
      }
      
      if (group.loanInsuranceEnabled && memberContributions.some(m => (m.loanInsuranceAmount || 0) > 0)) {
        headers.push('Loan Insurance');
      }
      
      if (group.groupSocialEnabled && memberContributions.some(m => (m.groupSocialAmount || 0) > 0)) {
        headers.push('Group Social');
      }
      
      headers.push('Total Expected', 'Status');

      // Create member data rows dynamically
      const memberData = memberContributions.map((member, index) => {
        const row = [
          (index + 1).toString(),
          `"${member.memberName || ''}"`,
          (member.expectedContribution || 0).toString()
        ];
        
        // Add conditional data
        if (memberContributions.some(m => (m.expectedInterest || 0) > 0)) {
          row.push((member.expectedInterest || 0).toString());
        }
        
        if (memberContributions.some(m => (m.lateFineAmount || 0) > 0)) {
          row.push((member.lateFineAmount || 0).toString());
        }
        
        if (group.loanInsuranceEnabled && memberContributions.some(m => (m.loanInsuranceAmount || 0) > 0)) {
          row.push((member.loanInsuranceAmount || 0).toString());
        }
        
        if (group.groupSocialEnabled && memberContributions.some(m => (m.groupSocialAmount || 0) > 0)) {
          row.push((member.groupSocialAmount || 0).toString());
        }
        
        row.push((member.totalExpected || 0).toString());
        row.push(member.status === 'PAID' ? 'Paid' : member.status === 'PARTIAL' ? 'Partial' : 'Pending');
        
        return row;
      });

      // Create totals row
      const totalsRow = ['', '"TOTAL"', totalCompulsoryContribution.toString()];
      
      // Add conditional totals
      if (memberContributions.some(m => (m.expectedInterest || 0) > 0)) {
        totalsRow.push(totalInterestPaid.toString());
      }
      
      if (memberContributions.some(m => (m.lateFineAmount || 0) > 0)) {
        totalsRow.push(totalLateFines.toString());
      }
      
      if (group.loanInsuranceEnabled && memberContributions.some(m => (m.loanInsuranceAmount || 0) > 0)) {
        totalsRow.push(totalLoanInsurance.toString());
      }
      
      if (group.groupSocialEnabled && memberContributions.some(m => (m.groupSocialAmount || 0) > 0)) {
        totalsRow.push(totalGroupSocial.toString());
      }
      
      totalsRow.push(totalExpected.toString());
      totalsRow.push(`"${memberContributions.filter(c => c.status === 'PAID').length}/${memberContributions.length}"`);

      // Previous month data
      const previousCashInHand = group.cashInHand || 0;
      const previousCashInBank = group.balanceInBank || 0;
      const previousMonthBalance = previousCashInHand + previousCashInBank;

      // Calculate Group Standing using the specified formula
      const newCashInGroup = previousMonthBalance + totalCollected;
      const groupSocialFund = totalGroupSocial;
      const loanInsuranceFund = totalLoanInsurance;
      const totalGroupStanding = newCashInGroup + totalPersonalLoanOutstanding - groupSocialFund - loanInsuranceFund;
      const sharePerMember = group.memberCount > 0 ? totalGroupStanding / group.memberCount : 0;

      const periodName = showOldContributions && selectedPeriodId 
        ? formatPeriodName(closedPeriods.find(p => p.id === selectedPeriodId))
        : formatPeriodName(currentPeriod);

      // Create comprehensive CSV content matching the PDF format
      const csvContent = [
        // Header Section
        [`"${group.name.toUpperCase()}"`],
        [`"GROUP STATEMENT - ${periodName.toUpperCase()}"`],
        [],
        // Group Information
        [`"Establishment Year:","${group.establishmentYear || 'N/A'}","","Monthly Contribution:","₹${group.monthlyContribution?.toLocaleString() || '0'}"`],
        [`"Total Members:","${group.memberCount || memberContributions.length}","","Interest Rate:","${Number(group.interestRate) || 0}% per month"`],
        [`"Collection Frequency:","${(group.collectionFrequency || 'MONTHLY').toLowerCase().replace('_', ' ')}","","Report Generated:","${new Date().toLocaleDateString('en-IN')}"`],
        [],
        // Member Contributions Table
        headers,
        ...memberData,
        totalsRow,
        [],
        // Group Cash Summary
        [`"GROUP CASH SUMMARY"`],
        [],
        [`"PREVIOUS MONTH"`],
        [`"Cash in Hand","${previousCashInHand}"`],
        [`"Cash in Bank","${previousCashInBank}"`],
        [`"Total Previous Balance","${previousMonthBalance}"`],
        [],
        [`"THIS MONTH COLLECTION"`],
        [`"Monthly Contribution","${totalCompulsoryContribution}"`],
        [`"Interest on Personal Loan","${totalInterestPaid}"`],
        ...(totalLateFines > 0 ? [[`"Late Fine","${totalLateFines}"`]] : []),
        ...(group.loanInsuranceEnabled && totalLoanInsurance > 0 ? [[`"Loan Insurance","${totalLoanInsurance}"`]] : []),
        ...(group.groupSocialEnabled && totalGroupSocial > 0 ? [[`"Group Social","${totalGroupSocial}"`]] : []),
        [`"Total Collection This Month","${totalCollected}"`],
        [],
        [`"CASH ALLOCATION"`],
        [`"Cash in Hand","${totalCashInHand}"`],
        [`"Cash in Bank","${totalCashInBank}"`],
        [],
        [`"NEW TOTALS"`],
        [`"New Cash in Hand","${previousCashInHand + totalCashInHand}"`],
        [`"New Cash in Bank","${previousCashInBank + totalCashInBank}"`],
        [`"Personal Loan Outstanding","${totalPersonalLoanOutstanding}"`],
        ...(group.groupSocialEnabled && totalGroupSocial > 0 ? [[`"Group Social Fund","${totalGroupSocial + (group.groupSocialBalance || 0)}"`]] : []),
        ...(group.loanInsuranceEnabled && totalLoanInsurance > 0 ? [[`"Loan Insurance Fund","${totalLoanInsurance + (group.loanInsuranceBalance || 0)}"`]] : []),
        [],
        [`"TOTAL GROUP STANDING"`],
        [`"New Cash in Group","${newCashInGroup}"`],
        [`"+ Personal Loan Outstanding","${totalPersonalLoanOutstanding}"`],
        ...(groupSocialFund > 0 ? [[`"- Group Social Fund","${groupSocialFund}"`]] : []),
        ...(loanInsuranceFund > 0 ? [[`"- Loan Insurance Fund","${loanInsuranceFund}"`]] : []),
        [`"= TOTAL GROUP STANDING","${totalGroupStanding}"`],
        [],
        [`"Share per Member","${sharePerMember.toFixed(2)}","(₹${totalGroupStanding.toLocaleString()} ÷ ${group.memberCount})"`],
        [],
        [`"Generated on ${new Date().toLocaleString('en-IN')}"`]
      ].map(row => row.join(',')).join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      
      const fileName = `${group.name.replace(/[^a-zA-Z0-9]/g, '_')}_Statement_${periodName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      link.download = fileName;
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
    
    // Helper function to safely format currency
    const formatCurrency = (amount: number | undefined | null): number => {
      return Math.ceil(Number(amount) || 0);
    };

    // Helper function to format period name
    const formatPeriodName = (period: any) => {
      if (!period) return 'Current Period';
      
      const frequency = group.collectionFrequency || 'MONTHLY';
      const startDate = new Date(period.startDate);
      
      if (frequency === 'MONTHLY') {
        return startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      } else if (frequency === 'WEEKLY') {
        return `Week of ${startDate.toLocaleDateString('en-IN')}`;
      } else if (frequency === 'YEARLY') {
        return startDate.toLocaleDateString('en-IN', { year: 'numeric' });
      } else {
        return `${startDate.toLocaleDateString('en-IN')} to ${new Date().toLocaleDateString('en-IN')}`;
      }
    };
    
    try {
      // Calculate all financial data
      const totalExpected = memberContributions.reduce((sum, c) => sum + (c.totalExpected || 0), 0);
      const totalCollected = memberContributions.reduce((sum, c) => sum + (c.paidAmount || 0), 0);
      const totalCompulsoryContribution = memberContributions.reduce((sum, c) => sum + (c.expectedContribution || 0), 0);
      const totalInterestPaid = memberContributions.reduce((sum, c) => sum + (c.expectedInterest || 0), 0);
      const totalLateFines = memberContributions.reduce((sum, c) => sum + (c.lateFineAmount || 0), 0);
      const totalLoanInsurance = memberContributions.reduce((sum, c) => sum + (c.loanInsuranceAmount || 0), 0);
      const totalGroupSocial = memberContributions.reduce((sum, c) => sum + (c.groupSocialAmount || 0), 0);
      const totalPersonalLoanOutstanding = memberContributions.reduce((sum, c) => sum + (c.currentLoanBalance || 0), 0);
      
      // Calculate cash allocation totals
      const totalCashInHand = Object.values(actualContributions).reduce((sum, record) => {
        if (record.cashAllocation) {
          try {
            const allocation = JSON.parse(record.cashAllocation);
            return sum + (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
          } catch (_e) { return sum; }
        }
        return sum + Math.ceil((record.totalPaid || 0) * 0.3); // Default 30% to cash
      }, 0);
      
      const totalCashInBank = Object.values(actualContributions).reduce((sum, record) => {
        if (record.cashAllocation) {
          try {
            const allocation = JSON.parse(record.cashAllocation);
            return sum + (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
          } catch (_e) { return sum; }
        }
        return sum + Math.ceil((record.totalPaid || 0) * 0.7); // Default 70% to bank
      }, 0);

      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Group Statement');

      // === HEADER SECTION ===
      // Title row
      const titleRow = worksheet.addRow([group.name.toUpperCase()]);
      titleRow.height = 30;
      titleRow.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
      worksheet.mergeCells('A1:N1');
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('A1').fill = { 
        type: 'pattern', 
        pattern: 'solid', 
        fgColor: { argb: '4831D4' }
      };

      // Subtitle
      const periodName = showOldContributions && selectedPeriodId 
        ? formatPeriodName(closedPeriods.find(p => p.id === selectedPeriodId))
        : formatPeriodName(currentPeriod);
      const subtitleRow = worksheet.addRow([`GROUP STATEMENT - ${periodName.toUpperCase()}`]);
      subtitleRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      worksheet.mergeCells('A2:N2');
      subtitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('A2').fill = { 
        type: 'pattern', 
        pattern: 'solid', 
        fgColor: { argb: '4831D4' }
      };
      
      worksheet.addRow([]); // Empty row
      
      // === GROUP INFO SECTION ===
      const infoSection = [
        ['Establishment Year:', group.establishmentYear?.toString() || 'N/A', '', 'Monthly Contribution:', formatCurrency(group.monthlyContribution)],
        ['Total Members:', (group.memberCount || memberContributions.length).toString(), '', 'Interest Rate:', `${Number(group.interestRate) || 0}% per month`],
        ['Collection Frequency:', (group.collectionFrequency || 'MONTHLY').toLowerCase().replace('_', ' '), '', 'Report Generated:', new Date().toLocaleDateString('en-IN')]
      ];
      
      let rowNum = 4;
      infoSection.forEach(rowData => {
        const row = worksheet.addRow(rowData);
        rowNum++;
        
        // Format label cells
        [1, 4].forEach(col => {
          const cell = row.getCell(col);
          cell.font = { bold: true };
        });
        
        // Style the info section
        for (let j = 1; j <= 14; j++) {
          const cell = row.getCell(j);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
          };
        }
      });
      
      worksheet.addRow([]); // Empty row
      rowNum++;

      // === MEMBER CONTRIBUTIONS TABLE ===
      // Create headers dynamically based on enabled features
      const tableHeaders = ['SL', 'Member Name', 'Compulsory Contribution'];
      
      // Add conditional columns
      if (memberContributions.some(m => (m.expectedInterest || 0) > 0)) {
        tableHeaders.push('Personal Loan Interest');
      }
      
      if (memberContributions.some(m => (m.lateFineAmount || 0) > 0)) {
        tableHeaders.push('Late Fine');
      }
      
      if (group.loanInsuranceEnabled && memberContributions.some(m => (m.loanInsuranceAmount || 0) > 0)) {
        tableHeaders.push('Loan Insurance');
      }
      
      if (group.groupSocialEnabled && memberContributions.some(m => (m.groupSocialAmount || 0) > 0)) {
        tableHeaders.push('Group Social');
      }
      
      tableHeaders.push('Total', 'Status');

      // Add headers
      const headerRow = worksheet.addRow(tableHeaders);
      rowNum++;
      
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4831D4' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
        };
      });

      // Add member data
      memberContributions.forEach((member, index) => {
        const rowData = [
          index + 1,
          member.memberName || '',
          formatCurrency(member.expectedContribution)
        ];
        
        // Add conditional data
        if (memberContributions.some(m => (m.expectedInterest || 0) > 0)) {
          rowData.push(formatCurrency(member.expectedInterest));
        }
        
        if (memberContributions.some(m => (m.lateFineAmount || 0) > 0)) {
          rowData.push(formatCurrency(member.lateFineAmount || 0));
        }
        
        if (group.loanInsuranceEnabled && memberContributions.some(m => (m.loanInsuranceAmount || 0) > 0)) {
          rowData.push(formatCurrency(member.loanInsuranceAmount || 0));
        }
        
        if (group.groupSocialEnabled && memberContributions.some(m => (m.groupSocialAmount || 0) > 0)) {
          rowData.push(formatCurrency(member.groupSocialAmount || 0));
        }
        
        rowData.push(formatCurrency(member.totalExpected));
        rowData.push(member.status === 'PAID' ? '✓' : member.status === 'PARTIAL' ? '~' : '✗');
        
        const row = worksheet.addRow(rowData);
        rowNum++;
        
        // Set row height for better spacing and text visibility
        row.height = 25;
        
        // Format currency cells with proper alignment and spacing
        row.eachCell((cell, colNumber) => {
          // Align first column (SL) to center
          if (colNumber === 1) {
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          }
          // Align member name to left with padding and text wrapping
          else if (colNumber === 2) {
            cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true };
          }
          // Align currency columns to right with padding and text wrapping
          else if (colNumber >= 3 && colNumber < rowData.length) {
            cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1, wrapText: true };
            // Format as currency if it's a number
            if (typeof rowData[colNumber - 1] === 'number') {
              cell.numFmt = 'Rs. #,##0.00';
            }
          }
          // Align status column to center with text wrapping
          else {
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          }
          
          // Add borders for better visual separation
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
          };
        });
        
        // Format currency cells (keep existing logic for compatibility)
        for (let i = 3; i < rowData.length - 1; i++) {
          if (typeof rowData[i] === 'number') {
            row.getCell(i).numFmt = 'Rs. #,##0.00';
          }
        }
        
        // Alternate row styling
        if (index % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
          });
        }
        
        // Status column styling
        const statusCell = row.getCell(rowData.length);
        if (member.status === 'PAID') {
          statusCell.font = { color: { argb: '2E7D32' }, bold: true };
        } else if (member.status === 'PARTIAL') {
          statusCell.font = { color: { argb: 'C68200' }, bold: true };
        } else {
          statusCell.font = { color: { argb: 'C62828' }, bold: true };
        }
      });

      // Add totals row
      const totalsData = ['', 'TOTAL', formatCurrency(totalCompulsoryContribution)];
      
      if (memberContributions.some(m => (m.expectedInterest || 0) > 0)) {
        totalsData.push(formatCurrency(totalInterestPaid));
      }
      
      if (memberContributions.some(m => (m.lateFineAmount || 0) > 0)) {
        totalsData.push(formatCurrency(totalLateFines));
      }
      
      if (group.loanInsuranceEnabled && memberContributions.some(m => (m.loanInsuranceAmount || 0) > 0)) {
        totalsData.push(formatCurrency(totalLoanInsurance));
      }
      
      if (group.groupSocialEnabled && memberContributions.some(m => (m.groupSocialAmount || 0) > 0)) {
        totalsData.push(formatCurrency(totalGroupSocial));
      }
      
      totalsData.push(formatCurrency(totalExpected));
      totalsData.push(`${memberContributions.filter(c => c.status === 'PAID').length}/${memberContributions.length}`);

      const totalsRow = worksheet.addRow(totalsData);
      rowNum++;
      
      // Set row height for totals row
      totalsRow.height = 30;
      
      totalsRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };
        
        // Align cells properly
        if (colNumber === 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        } else if (colNumber === 2) {
          cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true };
        } else if (colNumber >= 3 && colNumber < totalsData.length) {
          cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1, wrapText: true };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        }
      });

      // Format currency in totals with proper spacing
      for (let i = 3; i < totalsData.length - 1; i++) {
        if (typeof totalsData[i] === 'number') {
          totalsRow.getCell(i).numFmt = 'Rs. #,##0.00';
        }
      }

      worksheet.addRow([]); // Empty row
      rowNum += 2;

      // === GROUP CASH SUMMARY SECTION ===
      const summaryHeaderRow = worksheet.addRow(['GROUP CASH SUMMARY']);
      summaryHeaderRow.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
      summaryHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell(`A${rowNum}`).fill = { 
        type: 'pattern', 
        pattern: 'solid', 
        fgColor: { argb: '4831D4' }
      };
      rowNum++;

      // Previous month data
      const previousCashInHand = group.cashInHand || 0;
      const previousCashInBank = group.balanceInBank || 0;
      const previousMonthBalance = previousCashInHand + previousCashInBank;
      
      // Create cash summary data
      const cashSummaryData = [
        ['PREVIOUS MONTH', '', ''],
        ['Cash in Hand', previousCashInHand, ''],
        ['Cash in Bank', previousCashInBank, ''],
        ['Total Previous Balance', previousMonthBalance, ''],
        ['', '', ''],
        ['THIS MONTH COLLECTION', '', ''],
        ['Monthly Contribution', totalCompulsoryContribution, ''],
        ['Interest on Personal Loan', totalInterestPaid, ''],
      ];

      // Add conditional rows
      if (totalLateFines > 0) {
        cashSummaryData.push(['Late Fine', totalLateFines, '']);
      }
      
      if (group.loanInsuranceEnabled && totalLoanInsurance > 0) {
        cashSummaryData.push(['Loan Insurance', totalLoanInsurance, '']);
      }
      
      if (group.groupSocialEnabled && totalGroupSocial > 0) {
        cashSummaryData.push(['Group Social', totalGroupSocial, '']);
      }

      cashSummaryData.push(
        ['Total Collection This Month', totalCollected, ''],
        ['', '', ''],
        ['CASH ALLOCATION', '', ''],
        ['Cash in Hand', totalCashInHand, ''],
        ['Cash in Bank', totalCashInBank, ''],
        ['', '', ''],
        ['NEW TOTALS', '', ''],
        ['New Cash in Hand', previousCashInHand + totalCashInHand, ''],
        ['New Cash in Bank', previousCashInBank + totalCashInBank, ''],
        ['Personal Loan Outstanding', totalPersonalLoanOutstanding, '']
      );

      // Add fund rows if applicable
      if (group.groupSocialEnabled && totalGroupSocial > 0) {
        cashSummaryData.push(['Group Social Fund', totalGroupSocial + (group.groupSocialBalance || 0), '']);
      }
      
      if (group.loanInsuranceEnabled && totalLoanInsurance > 0) {
        cashSummaryData.push(['Loan Insurance Fund', totalLoanInsurance + (group.loanInsuranceBalance || 0), '']);
      }

      // Calculate and add group standing
      const newCashInGroup = previousMonthBalance + totalCollected;
      const groupSocialFund = totalGroupSocial + (group.groupSocialBalance || 0);
      const loanInsuranceFund = totalLoanInsurance + (group.loanInsuranceBalance || 0);
      const totalGroupStanding = Math.ceil(newCashInGroup + totalPersonalLoanOutstanding - groupSocialFund - loanInsuranceFund);
      const sharePerMember = group.memberCount > 0 ? Math.ceil(totalGroupStanding / group.memberCount) : 0;

      // Find previous period's standing
      let previousMonthStanding = 0;
      if (currentPeriod && oldPeriods.length > 0) {
        const previousPeriod = oldPeriods
          .filter(p => p.isClosed && p.totalGroupStandingAtEndOfPeriod)
          .sort((a, b) => b.periodNumber - a.periodNumber)
          .find(p => p.periodNumber < currentPeriod.periodNumber);
        
        if (previousPeriod) {
          previousMonthStanding = Math.ceil(previousPeriod.totalGroupStandingAtEndOfPeriod);
        }
      }

      const groupMonthlyGrowth = Math.ceil(totalGroupStanding - previousMonthStanding);

      cashSummaryData.push(
        ['', '', ''],
        ['TOTAL GROUP STANDING', '', ''],
        ['New Cash in Group', newCashInGroup, ''],
        ['+ Personal Loan Outstanding', totalPersonalLoanOutstanding, ''],
      );

      if (groupSocialFund > 0) {
        cashSummaryData.push(['- Group Social Fund', groupSocialFund, '']);
      }
      
      if (loanInsuranceFund > 0) {
        cashSummaryData.push(['- Loan Insurance Fund', loanInsuranceFund, '']);
      }

      cashSummaryData.push(
        ['= TOTAL GROUP STANDING', totalGroupStanding, ''],
        ['', '', ''],
        ['Share per Member', sharePerMember, `(₹${totalGroupStanding.toLocaleString()} ÷ ${group.memberCount})`]
      );

      // Add group monthly growth
      if (previousMonthStanding > 0) {
        const monthlyGrowth = calculateMonthlyGrowth(totalGroupStanding, previousMonthStanding);
        cashSummaryData.push(
          ['', '', ''],
          ['Group Monthly Growth', monthlyGrowth.amount, `(${monthlyGrowth.percentage.toFixed(2)}%)`]
        );
      }

      // Add cash summary to worksheet
      cashSummaryData.forEach(rowData => {
        const row = worksheet.addRow(rowData);
        rowNum++;
        
        // Set row height for better spacing and text visibility
        row.height = 22;
        
        // Format cells with proper alignment and spacing
        row.eachCell((cell, colNumber) => {
          // Description column - left aligned with indent
          if (colNumber === 1) {
            cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true };
            cell.font = { size: 10 };
          }
          // Amount column - right aligned with indent and currency formatting
          else if (colNumber === 2 && typeof rowData[1] === 'number' && rowData[1] !== 0) {
            cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1, wrapText: true };
            cell.numFmt = 'Rs. #,##0.00';
            cell.font = { size: 10 };
          }
          // Comment column - left aligned
          else if (colNumber === 3) {
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            cell.font = { size: 9, italic: true, color: { argb: '666666' } };
          }
          
          // Add subtle borders for better visual separation
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFF5F5F5' } },
            bottom: { style: 'thin', color: { argb: 'FFF5F5F5' } },
            left: { style: 'thin', color: { argb: 'FFF5F5F5' } },
            right: { style: 'thin', color: { argb: 'FFF5F5F5' } }
          };
        });
        
        // Format currency cells (maintain existing compatibility)
        if (typeof rowData[1] === 'number' && rowData[1] !== 0) {
          row.getCell(2).numFmt = 'Rs. #,##0.00';
        }
        
        // Style header rows based on exact string matching
        const cellText = String(rowData[0] || '');
        if (cellText === 'PREVIOUS MONTH' || cellText === 'THIS MONTH COLLECTION' || 
            cellText === 'CASH ALLOCATION' || cellText === 'NEW TOTALS' ||
            cellText === 'TOTAL GROUP STANDING') {
          row.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F8FF' } };
          });
        }
        
        // Style the final total
        if (cellText === '= TOTAL GROUP STANDING') {
          row.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4831D4' } };
          });
        }
        
        // Style the monthly growth
        if (cellText === 'Group Monthly Growth') {
          row.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6FFE6' } };
          });
        }
      });

      // Final step: Comprehensive text visibility fix
      // Set generous column widths to prevent any text cutoff
      worksheet.columns = [
        { width: 10, style: { alignment: { wrapText: true, vertical: 'middle' } } },  // SL
        { width: 50, style: { alignment: { wrapText: true, vertical: 'middle' } } },  // Description/Name - extra wide
        { width: 25, style: { alignment: { wrapText: true, vertical: 'middle' } } },  // Amount
        { width: 25, style: { alignment: { wrapText: true, vertical: 'middle' } } },  // Additional columns
        { width: 25, style: { alignment: { wrapText: true, vertical: 'middle' } } },  // Loan Interest
        { width: 25, style: { alignment: { wrapText: true, vertical: 'middle' } } },  // Late Fine
        { width: 25, style: { alignment: { wrapText: true, vertical: 'middle' } } },  // Loan Insurance
        { width: 25, style: { alignment: { wrapText: true, vertical: 'middle' } } },  // Group Social
        { width: 25, style: { alignment: { wrapText: true, vertical: 'middle' } } },  // Total Expected
        { width: 20, style: { alignment: { wrapText: true, vertical: 'middle' } } },  // Status
        { width: 25, style: { alignment: { wrapText: true, vertical: 'middle' } } },  // Extra columns
        { width: 25, style: { alignment: { wrapText: true, vertical: 'middle' } } },
        { width: 25, style: { alignment: { wrapText: true, vertical: 'middle' } } },
        { width: 50, style: { alignment: { wrapText: true, vertical: 'middle' } } }   // Description column - extra wide
      ];
      
      // Ensure all cells have proper text wrapping and alignment
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          // Ensure cell has alignment object
          if (!cell.alignment) {
            cell.alignment = {};
          }
          
          // Enable text wrapping for all cells
          cell.alignment.wrapText = true;
          cell.alignment.vertical = 'middle';
          
          // Set specific alignment based on column type
          if (colNumber === 1) {
            // SL column - center aligned
            cell.alignment.horizontal = 'center';
          } else if (colNumber === 2) {
            // Name/Description column - left aligned with indent
            cell.alignment.horizontal = 'left';
            cell.alignment.indent = 1;
          } else if (colNumber >= 3 && colNumber <= 9) {
            // Currency/number columns - right aligned with indent
            cell.alignment.horizontal = 'right';
            cell.alignment.indent = 1;
          } else {
            // Status and other columns - center aligned
            cell.alignment.horizontal = 'center';
          }
        });
        
        // Ensure adequate row height for text wrapping
        if (row.height < 25) {
          row.height = 25;
        }
      });

      // Generate and download Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const fileName = `${group.name.replace(/[^a-zA-Z0-9]/g, '_')}_Statement_${periodName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      
      setShowReportModal(false);
      
    } catch (err) {
      console.error('Excel generation error:', err);
      alert(err instanceof Error ? err.message : 'An error occurred generating Excel report');
    }
  };



  // Function to generate PDF report
  const generatePDFReport = async () => {
    if (!group) return;
    
    // Helper function to safely format currency - robust approach
    const formatCurrency = (amount: number | undefined | null): string => {
      const numValue = Math.ceil(Number(amount) || 0);
      // Use 'Rs.' instead of '₹' symbol for better PDF compatibility
      return `Rs. ${numValue.toLocaleString('en-IN')}`;
    };
    
    // Helper function to get previous period standing
    const getPreviousPeriodStanding = (): number => {
      if (!currentPeriod || !oldPeriods.length) return 0;
      
      // Find the most recent closed period before the current one
      const previousPeriod = oldPeriods
        .filter(p => p.isClosed && p.totalGroupStandingAtEndOfPeriod)
        .sort((a, b) => b.periodNumber - a.periodNumber)
        .find(p => p.periodNumber < currentPeriod.periodNumber);
      
      return previousPeriod?.totalGroupStandingAtEndOfPeriod || 0;
    };

    // Helper function to format period name
    const formatPeriodName = (period: any) => {
      if (!period) return 'Current Period';
      
      const frequency = group.collectionFrequency || 'MONTHLY';
      const startDate = new Date(period.startDate);
      const endDate = period.endDate ? new Date(period.endDate) : new Date();
      
      if (frequency === 'MONTHLY') {
        return startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      } else if (frequency === 'WEEKLY') {
        return `Week of ${startDate.toLocaleDateString('en-IN')}`;
      } else if (frequency === 'YEARLY') {
        return startDate.toLocaleDateString('en-IN', { year: 'numeric' });
      } else {
        return `${startDate.toLocaleDateString('en-IN')} to ${endDate.toLocaleDateString('en-IN')}`;
      }
    };

    try {
      // Import jsPDF and autoTable dynamically to avoid SSR issues
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // === HEADER SECTION ===
      doc.setFillColor(72, 49, 212); // Primary brand color
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(group.name.toUpperCase(), pageWidth / 2, 15, { align: 'center' });
      const periodName = showOldContributions && selectedPeriodId 
        ? formatPeriodName(closedPeriods.find(p => p.id === selectedPeriodId))
        : formatPeriodName(currentPeriod);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`GROUP STATEMENT - ${periodName.toUpperCase()}`, pageWidth / 2, 28, { align: 'center' });

      // === CALCULATE ALL FINANCIAL DATA ===
      const totalExpected = memberContributions.reduce((sum, c) => sum + (c.totalExpected || 0), 0);
      const totalCollected = memberContributions.reduce((sum, c) => sum + (c.paidAmount || 0), 0);
      const totalCompulsoryContribution = memberContributions.reduce((sum, c) => sum + (c.expectedContribution || 0), 0);
      const totalInterestPaid = memberContributions.reduce((sum, c) => sum + (c.expectedInterest || 0), 0);
      const totalLateFines = memberContributions.reduce((sum, c) => sum + (c.lateFineAmount || 0), 0);
      const totalLoanInsurance = memberContributions.reduce((sum, c) => sum + (c.loanInsuranceAmount || 0), 0);
      const totalGroupSocial = memberContributions.reduce((sum, c) => sum + (c.groupSocialAmount || 0), 0);
      const totalPersonalLoanOutstanding = memberContributions.reduce((sum, c) => sum + (c.currentLoanBalance || 0), 0);
      
      const totalCashInHand = Object.values(actualContributions).reduce((sum, record) => {
        if (record.cashAllocation) {
          try {
            const allocation = JSON.parse(record.cashAllocation);
            return sum + (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
          } catch (_e) { return sum; }
        }
        return sum + Math.ceil((record.totalPaid || 0) * 0.3);
      }, 0);
      
      const totalCashInBank = Object.values(actualContributions).reduce((sum, record) => {
        if (record.cashAllocation) {
          try {
            const allocation = JSON.parse(record.cashAllocation);
            return sum + (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
          } catch (_e) { return sum; }
        }
        return sum + Math.ceil((record.totalPaid || 0) * 0.7);
      }, 0);

      // === GROUP INFO SECTION ===
      let lastY = 45;
      const groupInfoData = [
        [{content: 'Establishment Year:', styles: {fontStyle: 'bold' as const}}, group.establishmentYear?.toString() || 'N/A'],
        [{content: 'Total Members:', styles: {fontStyle: 'bold' as const}}, (group.memberCount || memberContributions.length).toString()],
        [{content: 'Collection Frequency:', styles: {fontStyle: 'bold' as const}}, (group.collectionFrequency || 'MONTHLY').toLowerCase().replace('_', ' ')],
        [{content: 'Monthly Contribution:', styles: {fontStyle: 'bold' as const}}, formatCurrency(group.monthlyContribution)],
        [{content: 'Interest Rate:', styles: {fontStyle: 'bold' as const}}, `${Number(group.interestRate) || 0}% per month`],
        [{content: 'Report Generated:', styles: {fontStyle: 'bold' as const}}, new Date().toLocaleDateString('en-IN')],
      ];

      autoTable(doc, {
        startY: lastY,
        body: groupInfoData,
        theme: 'grid',
        styles: { fontSize: 9 },
      });
      lastY = (doc as any).lastAutoTable.finalY;

      // === MEMBER CONTRIBUTIONS TABLE ===
      lastY += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Member Contributions', 14, lastY);
      lastY += 5;

      const tableHeaders = ['SL', 'Member Name', 'Contrib', 'Interest', 'Fine', 'LI', 'GS', 'Total Exp', 'Paid', 'Remain', 'Loan', 'Status', 'Late Days', 'Due Date'];
      const columnWidths = [8, 45, 20, 20, 18, 18, 18, 22, 22, 22, 22, 18, 18, 22];

      const tableData = memberContributions.map((member, index) => {
        return [
          (index + 1).toString(),
          member.memberName || '',
          formatCurrency(member.expectedContribution),
          formatCurrency(member.expectedInterest),
          formatCurrency(member.lateFineAmount || 0),
          formatCurrency(member.loanInsuranceAmount || 0),
          formatCurrency(member.groupSocialAmount || 0),
          formatCurrency(member.totalExpected),
          formatCurrency(member.paidAmount || 0),
          formatCurrency(member.remainingAmount || 0),
          formatCurrency(member.currentLoanBalance || 0),
          member.status,
          (member.daysLate || 0).toString(),
          new Date(member.dueDate).toLocaleDateString(),
        ];
      });

      const totalsRow = [
        '', 
        'TOTAL',
        formatCurrency(totalCompulsoryContribution),
        formatCurrency(totalInterestPaid),
        formatCurrency(totalLateFines),
        formatCurrency(totalLoanInsurance),
        formatCurrency(totalGroupSocial),
        formatCurrency(totalExpected),
        formatCurrency(totalCollected),
        formatCurrency(totalExpected - totalCollected),
        formatCurrency(totalPersonalLoanOutstanding),
        `${memberContributions.filter(c => c.status === 'PAID').length}/${memberContributions.length}`,
        '', // Days late total - empty
        '' // Due date total - empty
      ];

      autoTable(doc, {
        startY: lastY,
        head: [tableHeaders],
        body: [...tableData, totalsRow],
        headStyles: {
          fillColor: [72, 49, 212],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8
        },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: Object.fromEntries(
          columnWidths.map((width, index) => [index, { cellWidth: width }])
        ),
        alternateRowStyles: { fillColor: [250, 250, 250] },
        didParseCell: function(data) {
          if (data.row.index === tableData.length) {
            data.cell.styles.fillColor = [240, 240, 240];
            data.cell.styles.fontStyle = 'bold';
          }
          const statusColIndex = tableHeaders.indexOf('Status');
          if (data.column.index === statusColIndex && data.section === 'body') {
            const status = data.cell.raw;
            if (status === 'PAID') data.cell.styles.textColor = [46, 125, 50];
            else if (status === 'PARTIAL') data.cell.styles.textColor = [198, 130, 0];
            else if (status === 'OVERDUE' || status === 'PENDING') data.cell.styles.textColor = [198, 40, 40];
          }
        }
      });
      lastY = (doc as any).lastAutoTable.finalY;

      // === GROUP CASH SUMMARY SECTION ===
      let summarySectionY = lastY + 15;
      if (summarySectionY > 160) { // Adjusted for landscape
        doc.addPage();
        summarySectionY = 20;
      }
      
      doc.setFillColor(72, 49, 212);
      doc.rect(10, summarySectionY, pageWidth - 20, 12, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Group Cash Summary', pageWidth / 2, summarySectionY + 8, { align: 'center' });
      summarySectionY += 15;
      
      const previousCashInHand = group.cashInHand || 0;
      const previousCashInBank = group.balanceInBank || 0;
      const previousMonthBalance = previousCashInHand + previousCashInBank;
      
      const cashSummaryData = [
        ['PREVIOUS MONTH', '', ''],
        ['Cash in Hand', formatCurrency(previousCashInHand), ''],
        ['Cash in Bank', formatCurrency(previousCashInBank), ''],
        ['Total Previous Balance', formatCurrency(previousMonthBalance), ''],
        ['', '', ''],
        ['THIS MONTH COLLECTION', '', ''],
        ['Monthly Contribution', formatCurrency(totalCompulsoryContribution), ''],
        ['Interest on Personal Loan', formatCurrency(totalInterestPaid), ''],
        ...(totalLateFines > 0 ? [['Late Fine', formatCurrency(totalLateFines), '']] : []),
        ...(group.loanInsuranceEnabled && totalLoanInsurance > 0 ? [['Loan Insurance', formatCurrency(totalLoanInsurance), '']] : []),
        ...(group.groupSocialEnabled && totalGroupSocial > 0 ? [['Group Social', formatCurrency(totalGroupSocial), '']] : []),
        ['Total Collection This Month', formatCurrency(totalCollected), ''],
        ['', '', ''],
        ['CASH ALLOCATION', '', ''],
        ['Cash in Hand', formatCurrency(totalCashInHand), ''],
        ['Cash in Bank', formatCurrency(totalCashInBank), ''],
        ['', '', ''],
        ['NEW TOTALS', '', ''],
        ['New Cash in Hand', formatCurrency(previousCashInHand + totalCashInHand), ''],
        ['New Cash in Bank', formatCurrency(previousCashInBank + totalCashInBank), ''],
        ['Personal Loan Outstanding', formatCurrency(totalPersonalLoanOutstanding), ''],
      ];

      if (group.groupSocialEnabled && totalGroupSocial > 0) {
        cashSummaryData.push(['Group Social Fund', formatCurrency(totalGroupSocial + (group.groupSocialBalance || 0)), '']);
      }
      if (group.loanInsuranceEnabled && totalLoanInsurance > 0) {
        cashSummaryData.push(['Loan Insurance Fund', formatCurrency(totalLoanInsurance + (group.loanInsuranceBalance || 0)), '']);
      }

      const newCashInGroup = previousMonthBalance + totalCollected;
      const groupSocialFund = totalGroupSocial + (group.groupSocialBalance || 0);
      const loanInsuranceFund = totalLoanInsurance + (group.loanInsuranceBalance || 0);
      const totalGroupStanding = Math.ceil(newCashInGroup + totalPersonalLoanOutstanding - groupSocialFund - loanInsuranceFund);
      const sharePerMember = group.memberCount > 0 ? Math.ceil(totalGroupStanding / group.memberCount) : 0;
      const previousMonthStanding = getPreviousPeriodStanding();
      const { amount: groupMonthlyGrowth, percentage: growthPercentage } = calculateMonthlyGrowth(
        totalGroupStanding,
        previousMonthStanding
      );

      cashSummaryData.push(
        ['', '', ''],
        ['TOTAL GROUP STANDING', '', ''],
        ['New Cash in Group', formatCurrency(newCashInGroup), ''],
        ['+ Personal Loan Outstanding', formatCurrency(totalPersonalLoanOutstanding), ''],
      );
      if (groupSocialFund > 0) {
        cashSummaryData.push(['- Group Social Fund', formatCurrency(groupSocialFund), '']);
      }
      if (loanInsuranceFund > 0) {
        cashSummaryData.push(['- Loan Insurance Fund', formatCurrency(loanInsuranceFund), '']);
      }
      cashSummaryData.push(
        ['= TOTAL GROUP STANDING', formatCurrency(totalGroupStanding), ''],
        ['', '', ''],
          ['Share per Member', formatCurrency(sharePerMember), `(${formatCurrency(totalGroupStanding)} ÷ ${group.memberCount})`]
      );
      if (previousMonthStanding > 0) {
        cashSummaryData.push(
          ['', '', ''],
          ['Group Monthly Growth', formatCurrency(groupMonthlyGrowth), `${formatCurrency(groupMonthlyGrowth)} (${growthPercentage.toFixed(0)}%)`]
        );
      }      autoTable(doc, {
        startY: summarySectionY,
        body: cashSummaryData,
        theme: 'grid',
        columnStyles: {
          0: { cellWidth: 60, fontStyle: 'bold' },
          1: { cellWidth: 40, halign: 'right' },
          2: { cellWidth: 60, fontSize: 7, textColor: [100, 100, 100] }
        },
        bodyStyles: { fontSize: 9, cellPadding: 1.5 },
        didParseCell: function(data) {
          const cellValue = String(data.cell.raw || '');
          if (['PREVIOUS MONTH', 'THIS MONTH COLLECTION', 'CASH ALLOCATION', 'NEW TOTALS', 'TOTAL GROUP STANDING'].includes(cellValue)) {
            data.cell.styles.fillColor = [240, 248, 255];
            data.cell.styles.fontStyle = 'bold';
          }
          if (cellValue === '= TOTAL GROUP STANDING') {
            data.cell.styles.fillColor = [72, 49, 212];
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
          if (cellValue === 'Group Monthly Growth') {
            data.cell.styles.fillColor = [230, 255, 230];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      // === FOOTER ===
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Generated on ${new Date().toLocaleString('en-IN')} | Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      const fileName = `${group.name.replace(/[^a-zA-Z0-9]/g, '_')}_Statement_${periodName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
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
          if (errorData.error?.includes('exceeds current balance')) {
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

  // 🔍 DEBUG: Calculate filtered contributions for display
  const paidContributions = memberContributions.filter(c => c.status === 'PAID');
  const unpaidContributions = memberContributions.filter(c => c.status !== 'PAID');

  // 🔍 DEBUG: Log filtering results for AISHWARYA
  if (process.env.NODE_ENV === 'development') {
    const aishwarya = memberContributions.find(c => c.memberName.includes('AISHWARYA'));
    if (aishwarya) {
      console.log('🔍 [FILTER DEBUG] AISHWARYA filtering result:', {
        status: aishwarya.status,
        isInCompleted: paidContributions.some(c => c.memberName.includes('AISHWARYA')),
        isInPending: unpaidContributions.some(c => c.memberName.includes('AISHWARYA')),
        totalExpected: aishwarya.totalExpected,
        paidAmount: aishwarya.paidAmount,
        remainingAmount: aishwarya.remainingAmount
      });
    }
  }

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
                  
                  <button
                    onClick={generateReport}
                    className="btn-secondary bg-purple-100 hover:bg-purple-200 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:hover:bg-purple-800/50 dark:text-purple-300 dark:border-purple-700/50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Generate Report
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
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">₹{Math.ceil(totalExpected).toLocaleString()}</p>
          </div>
        </div>
        <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300">Total Collected</h3>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">₹{Math.ceil(totalCollected).toLocaleString()}</p>
          </div>
        </div>
        {lateFinesEnabled && (
          <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">Total Late Fines</h3>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">₹{Math.ceil(totalLateFines).toLocaleString()}</p>
            </div>
          </div>
        )}
        <div className="card bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700/50">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-orange-700 dark:text-orange-300">Remaining</h3>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">₹{Math.ceil(totalRemaining).toLocaleString()}</p>
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
            // Calculate financial values using the new formulas - incorporating both actualContributions and memberCollections
            const previousMonthCashInHand = group.cashInHand || 0;
            const previousMonthCashInBank = group.balanceInBank || 0;
            const previousMonthBalance = previousMonthCashInHand + previousMonthCashInBank;

            // Calculate Total Collection components from both actual contributions and current input
            // 🔧 FIX: Use the main totalCollected value and break it down properly
            const totalCollectionCalculated = totalCollected + Object.values(memberCollections).reduce((sum, collection) => {
              return sum + (collection.compulsoryContribution || 0) + (collection.lateFinePaid || 0) + 
                     (collection.interestPaid || 0) + (collection.loanInsurancePaid || 0) + (collection.groupSocialPaid || 0);
            }, 0);

            // Break down the total collection into components based on memberContributions data
            const monthlyContribution = memberContributions.reduce((sum, member) => sum + member.expectedContribution, 0) * 
              (totalCollected / (totalExpected > 0 ? totalExpected : 1));

            const lateFine = memberContributions.reduce((sum, member) => sum + (member.lateFineAmount || 0), 0) * 
              (totalCollected / (totalExpected > 0 ? totalExpected : 1));

            const interestPaidPersonalLoans = memberContributions.reduce((sum, member) => sum + member.expectedInterest, 0) * 
              (totalCollected / (totalExpected > 0 ? totalExpected : 1));

            const loanInsurance = group.loanInsuranceEnabled ? 
              memberContributions.reduce((sum, member) => sum + (member.loanInsuranceAmount || 0), 0) * 
              (totalCollected / (totalExpected > 0 ? totalExpected : 1)) : 0;

            const groupSocial = group.groupSocialEnabled ? 
              memberContributions.reduce((sum, member) => sum + (member.groupSocialAmount || 0), 0) * 
              (totalCollected / (totalExpected > 0 ? totalExpected : 1)) : 0;

            // Total Collection = Use the main calculated value plus current inputs
            const totalCollection = totalCollectionCalculated;

            // Interest Income = Income by Interest (Personal Loan)
            const interestIncome = interestPaidPersonalLoans;

            // Expenses in This Month (assume 0 for now, can be calculated from actual expense records)
            const expensesThisMonth = 0;

            // New Cash in Group = Previous Month Balance + Total Collection + Interest Income − Expenses in This Month
            const newCashInGroup = previousMonthBalance + totalCollection + interestIncome - expensesThisMonth;

            // Personal Loan Outstanding = Sum of all current loan balances from memberContributions
            const personalLoanOutstanding = memberContributions.reduce((sum, member) => {
              return sum + (member.currentLoanBalance || 0);
            }, 0);

            // Group Social Fund = current period contributions + previous balance from step 4 of group creation
            const groupSocialFund = groupSocial + (group.groupSocialBalance || 0);

            // Loan Insurance Fund = current period contributions + previous balance from step 4 of group creation
            const loanInsuranceFund = loanInsurance + (group.loanInsuranceBalance || 0);

            // Total Group Standing = New Cash in Group + Personal Loan Outstanding − Group Social Fund − Loan Insurance Fund
            const totalGroupStanding = Math.ceil(newCashInGroup + personalLoanOutstanding - groupSocialFund - loanInsuranceFund);

            const sharePerMember = group.memberCount > 0 ? Math.ceil(totalGroupStanding / group.memberCount) : 0;

            // Calculate current period cash breakdown for display (including dynamic input)
            const currentPeriodCashInHand = Object.values(actualContributions).reduce((sum, record) => {
              if (record.cashAllocation) {
                try {
                  const allocation = JSON.parse(record.cashAllocation);
                  return sum + (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
                } catch (_e) {
                  return sum;
                }
              }
              return sum + Math.ceil((record.totalPaid || 0) * 0.3);
            }, 0) + Object.values(memberCollections).reduce((sum, collection) => {
              return sum + (collection.cashAmount || 0);
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
              return sum + Math.ceil((record.totalPaid || 0) * 0.7);
            }, 0) + Object.values(memberCollections).reduce((sum, collection) => {
              return sum + (collection.bankAmount || 0);
            }, 0);
            
            const totalCashInHand = Math.ceil(previousMonthCashInHand + currentPeriodCashInHand);
            const totalCashInBank = Math.ceil(previousMonthCashInBank + currentPeriodCashInBank);
            
            return (
              <div className="space-y-6">
                {/* New Formula Display */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-800/20 p-6 rounded-lg border-2 border-blue-200 dark:border-blue-700">
                  <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4">Total Group Standing Formula</h3>
                  

                  
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-blue-300 dark:border-blue-600 mb-4">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Formula:</p>
                    <p className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4">
                      Total Group Standing = New Cash in Group + Personal Loan Outstanding − Group Social Fund − Loan Insurance Fund
                    </p>
                    
                    {/* Calculation Breakdown */}
                    <div className="space-y-3 text-sm">
                      <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                        <p className="font-semibold mb-2">New Cash in Group = Previous Month Balance + Total Collection + Interest Income − Expenses</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <span>Previous Month Balance:</span><span>₹{previousMonthBalance.toLocaleString()}</span>
                          <span>Total Collection:</span><span>₹{totalCollection.toLocaleString()}</span>
                          <span>Interest Income:</span><span>₹{interestIncome.toLocaleString()}</span>
                          <span>Expenses This Month:</span><span>₹{expensesThisMonth.toLocaleString()}</span>
                          <hr className="col-span-2 border-gray-300 dark:border-gray-600"/>
                          <span className="font-bold">New Cash in Group:</span><span className="font-bold">₹{newCashInGroup.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                        <p className="font-semibold mb-2">Total Collection = Monthly Contribution + Late Fine + Interest Paid + Loan Insurance + Group Social</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <span>Monthly Contribution:</span><span>₹{monthlyContribution.toLocaleString()}</span>
                          <span>Late Fine:</span><span>₹{lateFine.toLocaleString()}</span>
                          <span>Interest Paid (Personal Loans):</span><span>₹{interestPaidPersonalLoans.toLocaleString()}</span>
                          {group.loanInsuranceEnabled && (<><span>Loan Insurance:</span><span>₹{loanInsurance.toLocaleString()}</span></>)}
                          {group.groupSocialEnabled && (<><span>Group Social:</span><span>₹{groupSocial.toLocaleString()}</span></>)}
                          <hr className="col-span-2 border-gray-300 dark:border-gray-600"/>
                          <span className="font-bold">Total Collection:</span><span className="font-bold">₹{totalCollection.toLocaleString()}</span>
                        </div>
                        
                        {/* Breakdown of input vs actual */}
                        <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Breakdown:</p>
                          <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 dark:text-gray-500">
                            <span>From Submitted:</span><span>₹{totalCollected.toLocaleString()}</span>
                            <span>From Current Input:</span><span>₹{(
                              Object.values(memberCollections).reduce((sum, collection) => {
                                return sum + (collection.compulsoryContribution || 0) + (collection.lateFinePaid || 0) + 
                                       (collection.interestPaid || 0) + (collection.loanInsurancePaid || 0) + (collection.groupSocialPaid || 0);
                              }, 0)
                            ).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                        <p className="font-semibold mb-2">Final Calculation:</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <span>New Cash in Group:</span><span>₹{newCashInGroup.toLocaleString()}</span>
                          <span>Personal Loan Outstanding:</span><span>₹{personalLoanOutstanding.toLocaleString()}</span>
                          {group.groupSocialEnabled && (<><span>Group Social Fund:</span><span className="text-red-600">-₹{groupSocialFund.toLocaleString()}</span></>)}
                          {group.loanInsuranceEnabled && (<><span>Loan Insurance Fund:</span><span className="text-red-600">-₹{loanInsuranceFund.toLocaleString()}</span></>)}
                          <hr className="col-span-2 border-gray-300 dark:border-gray-600"/>
                          <span className="font-bold text-lg">Total Group Standing:</span><span className="font-bold text-lg text-blue-600">₹{totalGroupStanding.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Current Period Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        <p className="text-xl font-bold text-green-800 dark:text-green-200">₹{totalCashInHand.toLocaleString()}</p>
                        {!showOldContributions && currentPeriodCashInHand > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400">
                            Base: ₹{previousMonthCashInHand.toLocaleString()} + Period: ₹{currentPeriodCashInHand.toLocaleString()}
                          </p>
                        )}
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
                        <p className="text-xl font-bold text-blue-800 dark:text-blue-200">₹{totalCashInBank.toLocaleString()}</p>
                        {!showOldContributions && currentPeriodCashInBank > 0 && (
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Base: ₹{previousMonthCashInBank.toLocaleString()} + Period: ₹{currentPeriodCashInBank.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Loan Assets */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700/50">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-600 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Loan Assets</p>
                        <p className="text-xl font-bold text-purple-800 dark:text-purple-200">₹{personalLoanOutstanding.toLocaleString()}</p>
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
                        <p className="text-xl font-bold text-orange-800 dark:text-orange-200">₹{totalGroupStanding.toLocaleString()}</p>
                        <p className="text-xs text-orange-600 dark:text-orange-400">
                          Per Member: ₹{sharePerMember.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}



        </div>
      </div>

      {/* Progress Bar */}
      <div className="card mb-6">
        <div className="p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-foreground">Collection Progress</h3>
            <span className="text-sm font-medium text-primary">
              {(() => {
                // Calculate dynamic collection rate
                const actualCollected = totalCollected;
                const inputCollected = Object.values(memberCollections).reduce((sum, collection) => {
                  return sum + (collection.cashAmount || 0) + (collection.bankAmount || 0);
                }, 0);
                const totalDynamicCollected = actualCollected + inputCollected;
                const collectionRate = totalExpected > 0 ? Math.min(Math.round((totalDynamicCollected / totalExpected) * 100), 100) : 0;
                return `${collectionRate}% ₹${totalDynamicCollected.toLocaleString()} collected`;
              })()}
            </span>
          </div>
          
          {/* Enhanced Progress Bar */}
          <div className="relative">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 shadow-inner">
              <div 
                className="bg-gradient-to-r from-green-500 to-blue-500 h-6 rounded-full transition-all duration-700 ease-out shadow-lg relative overflow-hidden"
                style={{ 
                  width: `${(() => {
                    const actualCollected = totalCollected;
                    const inputCollected = Object.values(memberCollections).reduce((sum, collection) => {
                      return sum + (collection.cashAmount || 0) + (collection.bankAmount || 0);
                    }, 0);
                    const totalDynamicCollected = actualCollected + inputCollected;
                    return totalExpected > 0 ? Math.min((totalDynamicCollected / totalExpected) * 100, 100) : 0;
                  })()}%` 
                }}
              >
                {/* Animated shine effect */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                
                {/* Percentage text inside bar (when there's enough space) */}
                {(() => {
                  const actualCollected = totalCollected;
                  const inputCollected = Object.values(memberCollections).reduce((sum, collection) => {
                    return sum + (collection.cashAmount || 0) + (collection.bankAmount || 0);
                  }, 0);
                  const totalDynamicCollected = actualCollected + inputCollected;
                  const collectionPercentage = totalExpected > 0 ? (totalDynamicCollected / totalExpected) * 100 : 0;
                  
                  return collectionPercentage > 20 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white font-bold text-sm drop-shadow-lg">
                        {Math.min(Math.round(collectionPercentage), 100)}%
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          
          {/* Progress details */}
          <div className="flex justify-between mt-3 text-sm">
            <div className="flex items-center space-x-4">
              <span className="text-muted">Target: ₹{totalExpected.toLocaleString()}</span>
              <span className="text-green-600 dark:text-green-400 font-medium">
                Collected: ₹{(() => {
                  const actualCollected = totalCollected;
                  const inputCollected = Object.values(memberCollections).reduce((sum, collection) => {
                    return sum + (collection.cashAmount || 0) + (collection.bankAmount || 0);
                  }, 0);
                  return (actualCollected + inputCollected).toLocaleString();
                })()}
              </span>
            </div>
            <span className="text-orange-600 dark:text-orange-400 font-medium">
              Remaining: ₹{(() => {
                const actualCollected = totalCollected;
                const inputCollected = Object.values(memberCollections).reduce((sum, collection) => {
                  return sum + (collection.cashAmount || 0) + (collection.bankAmount || 0);
                }, 0);
                const totalDynamicCollected = actualCollected + inputCollected;
                const dynamicRemaining = Math.max(0, totalExpected - totalDynamicCollected);
                return dynamicRemaining.toLocaleString();
              })()}
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
                  Paid: {(() => {
                    // Calculate completed members including current inputs
                    const baseCompleted = paidContributions.length;
                    const inputCompleted = Object.keys(memberCollections).filter(memberId => {
                      const collection = memberCollections[memberId];
                      const totalInput = (collection.cashAmount || 0) + (collection.bankAmount || 0);
                      return totalInput > 0;
                    }).length;
                    return baseCompleted + inputCompleted;
                  })()}
                </span>
                <span className="text-orange-600 dark:text-orange-400 font-medium">
                  Pending: {(() => {
                    const basePending = unpaidContributions.length;
                    const inputCompleted = Object.keys(memberCollections).filter(memberId => {
                      const collection = memberCollections[memberId];
                      const totalInput = (collection.cashAmount || 0) + (collection.bankAmount || 0);
                      return totalInput > 0;
                    }).length;
                    return Math.max(0, basePending - inputCompleted);
                  })()}
                </span>
              </div>
              <div className="text-right">
                <span className="text-muted text-xs">
                  {(() => {
                    const baseCompleted = completedContributions.length;
                    const inputCompleted = Object.keys(memberCollections).filter(memberId => {
                      const collection = memberCollections[memberId];
                      const totalInput = (collection.cashAmount || 0) + (collection.bankAmount || 0);
                      return totalInput > 0;
                    }).length;
                    const totalCompleted = baseCompleted + inputCompleted;
                    return memberContributions.length > 0 ? Math.round((totalCompleted / memberContributions.length) * 100) : 0;
                  })()}% members completed
                </span>
              </div>
            </div>
            
            {/* Member Progress Bar */}
            <div className="mt-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${(() => {
                      const baseCompleted = completedContributions.length;
                      const inputCompleted = Object.keys(memberCollections).filter(memberId => {
                        const collection = memberCollections[memberId];
                        const totalInput = (collection.cashAmount || 0) + (collection.bankAmount || 0);
                        return totalInput > 0;
                      }).length;
                      const totalCompleted = baseCompleted + inputCompleted;
                      return memberContributions.length > 0 ? Math.min((totalCompleted / memberContributions.length) * 100, 100) : 0;
                    })()}%` 
                  }}
                ></div>
              </div>
            </div>
            
            {/* Remaining Members Display */}
            {(() => {
              const basePending = pendingContributions.length;
              const membersWithInput = Object.keys(memberCollections).filter(memberId => {
                const collection = memberCollections[memberId];
                const totalInput = (collection.cashAmount || 0) + (collection.bankAmount || 0);
                return totalInput > 0;
              });
              const dynamicPending = Math.max(0, basePending - membersWithInput.length);
              
              return dynamicPending > 0 && (
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-foreground">Members Yet to Pay</h4>
                    <span className="text-xs text-muted">{dynamicPending} remaining</span>
                  </div>
                  
                  <div className="max-h-24 overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {pendingContributions
                        .filter(member => !membersWithInput.includes(member.memberId))
                        .slice(0, 10)
                        .map((member) => (
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
                            {member.familySize > 0 && (
                              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                ({member.familySize})
                              </span>
                            )}
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
                      {dynamicPending > 10 && (
                        <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          +{dynamicPending - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {dynamicPending > 10 && (
                    <div className="mt-2 text-xs text-muted">
                      Showing first 10 members. View full list below in the contributions table.
                    </div>
                  )}
                </div>
              );
            })()}
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
        <div className="overflow-x-auto" style={{ minHeight: '400px' }}>
          <table className="min-w-full table-auto">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider sticky left-0 bg-white dark:bg-gray-800 z-10">Member</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider min-w-[180px]">
                  <div className="text-center font-bold">Collection</div>
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    <div className="text-center text-xs font-medium">Cash</div>
                    <div className="text-center text-xs font-medium">Bank</div>
                  </div>
                </th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider min-w-[120px]">
                  <div className="text-center">Monthly</div>
                  <div className="text-center">Contribution</div>
                </th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider min-w-[100px]">
                  <div className="text-center">Interest</div>
                  <div className="text-center">Due</div>
                </th>
                {lateFinesEnabled && (
                  <th className="px-3 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider min-w-[100px]">
                    <div className="text-center">Late</div>
                    <div className="text-center">Fine</div>
                  </th>
                )}
                {group?.loanInsuranceEnabled && (
                  <th className="px-3 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider min-w-[100px]">
                    <div className="text-center">Loan</div>
                    <div className="text-center">Insurance</div>
                  </th>
                )}
                {group?.groupSocialEnabled && (
                  <th className="px-3 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider min-w-[100px]">
                    <div className="text-center">Group</div>
                    <div className="text-center">Social</div>
                  </th>
                )}
                <th className="px-3 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider min-w-[120px]">
                  <div className="text-center">Loan</div>
                  <div className="text-center">Balance</div>
                </th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider min-w-[100px]">
                  <div className="text-center">Remaining</div>
                  <div className="text-center">Loan</div>
                </th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider min-w-[80px]">Status</th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider min-w-[120px]">
                  <div className="text-center">Submission</div>
                  <div className="text-center">Date</div>
                </th>
                <th className="px-3 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider min-w-[100px] sticky right-0 bg-white dark:bg-gray-800 z-10 border-l border-gray-200 dark:border-gray-700">
                  <div className="text-center font-bold text-primary">Actions</div>
                </th>
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
                  loanInsurancePaid: 0,
                  groupSocialPaid: 0,
                  remainingLoan: contribution.currentLoanBalance || 0,
                  submissionDate: new Date() // Default to current date
                };

                // Auto-calculate distributions when amounts change
                const handleCollectionChange = (field: 'cashAmount' | 'bankAmount', value: number) => {
                  // Round up decimal values
                  const roundedValue = Math.ceil(value);
                  
                  // Calculate maximum allowable total collection amount
                  const maxTotalDue = contribution.expectedContribution + 
                                    contribution.expectedInterest + 
                                    (contribution.lateFineAmount || 0) + 
                                    (contribution.loanInsuranceAmount || 0) + 
                                    (contribution.groupSocialAmount || 0) + 
                                    contribution.currentLoanBalance;
                  
                  const otherFieldAmount = field === 'cashAmount' ? memberCollection.bankAmount : memberCollection.cashAmount;
                  const proposedTotal = roundedValue + otherFieldAmount;
                  
                  // Prevent entering more than total due amount
                  const finalValue = Math.min(roundedValue, Math.max(0, maxTotalDue - otherFieldAmount));
                  
                  const totalCollected = field === 'cashAmount' 
                    ? finalValue + memberCollection.bankAmount 
                    : memberCollection.cashAmount + finalValue;
                  
                  // Distribute: compulsory contribution → interest → late fine → group social → loan insurance → loan repayment
                  let remaining = totalCollected;
                  let compulsoryContribution = 0;
                  let interestPaid = 0;
                  let lateFinePaid = 0;
                  let groupSocialPaid = 0;
                  let loanInsurancePaid = 0;
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
                  
                  // Third priority: Late fine
                  if (remaining > 0 && (contribution.lateFineAmount || 0) > 0) {
                    lateFinePaid = Math.min(remaining, contribution.lateFineAmount || 0);
                    remaining -= lateFinePaid;
                  }
                  
                  // Fourth priority: Group Social
                  if (remaining > 0 && group?.groupSocialEnabled && (contribution.groupSocialAmount || 0) > 0) {
                    groupSocialPaid = Math.min(remaining, contribution.groupSocialAmount || 0);
                    remaining -= groupSocialPaid;
                  }
                  
                  // Fifth priority: Loan Insurance
                  if (remaining > 0 && group?.loanInsuranceEnabled && (contribution.loanInsuranceAmount || 0) > 0) {
                    loanInsurancePaid = Math.min(remaining, contribution.loanInsuranceAmount || 0);
                    remaining -= loanInsurancePaid;
                  }
                  
                  // Sixth priority: Loan repayment
                  if (remaining > 0 && contribution.currentLoanBalance > 0) {
                    loanRepayment = Math.min(remaining, contribution.currentLoanBalance);
                  }
                  
                  const newRemainingLoan = Math.max(0, contribution.currentLoanBalance - loanRepayment);
                  
                  setMemberCollections(prev => ({
                    ...prev,
                    [memberId]: {
                      ...memberCollection,
                      [field]: finalValue,
                      compulsoryContribution,
                      interestPaid,
                      lateFinePaid,
                      groupSocialPaid,
                      loanInsurancePaid,
                      loanRepayment,
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
                    <td className="px-3 py-4 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-200 dark:border-gray-700">
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
                    <td className="px-4 py-4 whitespace-nowrap">
                      {(() => {
                        // Calculate max total due amount for validation
                        const maxTotalDue = contribution.expectedContribution + 
                                          contribution.expectedInterest + 
                                          (contribution.lateFineAmount || 0) + 
                                          (contribution.loanInsuranceAmount || 0) + 
                                          (contribution.groupSocialAmount || 0) + 
                                          contribution.currentLoanBalance;
                        
                        return (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cash</label>
                                <input
                                  type="number"
                                  value={memberCollection.cashAmount === 0 ? '' : memberCollection.cashAmount}
                                  onFocus={(e) => {
                                    // Clear field if value is 0 for better UX
                                    if (Number(e.target.value) === 0) {
                                      e.target.value = '';
                                    }
                                  }}
                                  onWheel={(e) => {
                                    // Prevent mouse wheel from changing number input values
                                    e.currentTarget.blur();
                                  }}
                                  onChange={(e) => {
                                    const inputValue = e.target.value;
                                    const value = Math.max(0, Number(inputValue) || 0);
                                    // Round up decimal values
                                    const roundedValue = Math.ceil(value);
                                    handleCollectionChange('cashAmount', roundedValue);
                                  }}
                                  className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-gray-100 ${
                                    memberCollection.cashAmount > Math.max(0, maxTotalDue - memberCollection.bankAmount)
                                      ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20'
                                      : 'border-gray-300 dark:border-gray-600'
                                  }`}
                                  min="0"
                                  max={Math.max(0, maxTotalDue - memberCollection.bankAmount)}
                                  step="1"
                                  disabled={currentPeriod?.isClosed}
                                  placeholder="0"
                                  title={`Maximum allowed: ₹${Math.max(0, maxTotalDue - memberCollection.bankAmount)}`}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bank</label>
                                <input
                                  type="number"
                                  value={memberCollection.bankAmount === 0 ? '' : memberCollection.bankAmount}
                                  onFocus={(e) => {
                                    // Clear field if value is 0 for better UX
                                    if (Number(e.target.value) === 0) {
                                      e.target.value = '';
                                    }
                                  }}
                                  onWheel={(e) => {
                                    // Prevent mouse wheel from changing number input values
                                    e.currentTarget.blur();
                                  }}
                                  onChange={(e) => {
                                    const inputValue = e.target.value;
                                    const value = Math.max(0, Number(inputValue) || 0);
                                    // Round up decimal values
                                    const roundedValue = Math.ceil(value);
                                    handleCollectionChange('bankAmount', roundedValue);
                                  }}
                                  className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-gray-100 ${
                                    memberCollection.bankAmount > Math.max(0, maxTotalDue - memberCollection.cashAmount)
                                      ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20'
                                      : 'border-gray-300 dark:border-gray-600'
                                  }`}
                                  min="0"
                                  max={Math.max(0, maxTotalDue - memberCollection.cashAmount)}
                                  step="1"
                                  disabled={currentPeriod?.isClosed}
                                  placeholder="0"
                                  title={`Maximum allowed: ₹${Math.max(0, maxTotalDue - memberCollection.cashAmount)}`}
                                />
                              </div>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
                              <div className="font-medium">
                                Total: ₹{formatCurrency(memberCollection.cashAmount + memberCollection.bankAmount)}
                              </div>
                              <div className="text-xs mt-1">
                                Max Due: ₹{formatCurrency(maxTotalDue)}
                              </div>
                              {(memberCollection.cashAmount + memberCollection.bankAmount) > maxTotalDue && (
                                <div className="text-red-500 text-xs mt-1 font-medium">
                                  ⚠️ Exceeds total due amount
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
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
                          onWheel={(e) => {
                            // Prevent mouse wheel from changing number input values
                            e.currentTarget.blur();
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
                            
                            // Recalculate total cash/bank allocation based on all payments
                            const totalPayments = (updatedCollection.compulsoryContribution || 0) + 
                                                (updatedCollection.interestPaid || 0) + 
                                                (updatedCollection.lateFinePaid || 0) + 
                                                (updatedCollection.groupSocialPaid || 0) + 
                                                (updatedCollection.loanInsurancePaid || 0) + 
                                                (updatedCollection.loanRepayment || 0);
                            
                            // If there are payments but no cash/bank allocation, auto-allocate to cash
                            if (totalPayments > 0 && (updatedCollection.cashAmount + updatedCollection.bankAmount) === 0) {
                              updatedCollection.cashAmount = totalPayments;
                              updatedCollection.bankAmount = 0;
                            }
                            // If payments changed and there's existing allocation, update proportionally
                            else if (totalPayments > 0 && (updatedCollection.cashAmount + updatedCollection.bankAmount) > 0) {
                              const currentTotal = updatedCollection.cashAmount + updatedCollection.bankAmount;
                              if (currentTotal !== totalPayments) {
                                // Keep the same ratio but adjust total
                                const cashRatio = updatedCollection.cashAmount / currentTotal;
                                updatedCollection.cashAmount = Math.ceil(totalPayments * cashRatio);
                                updatedCollection.bankAmount = totalPayments - updatedCollection.cashAmount;
                              }
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
                    <td className="px-3 py-4 whitespace-nowrap">
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
                          onWheel={(e) => {
                            // Prevent mouse wheel from changing number input values
                            e.currentTarget.blur();
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
                            
                            // Recalculate total cash/bank allocation based on all payments
                            const totalPayments = (updatedCollection.compulsoryContribution || 0) + 
                                                (updatedCollection.interestPaid || 0) + 
                                                (updatedCollection.lateFinePaid || 0) + 
                                                (updatedCollection.groupSocialPaid || 0) + 
                                                (updatedCollection.loanInsurancePaid || 0) + 
                                                (updatedCollection.loanRepayment || 0);
                            
                            // If there are payments but no cash/bank allocation, auto-allocate to cash
                            if (totalPayments > 0 && (updatedCollection.cashAmount + updatedCollection.bankAmount) === 0) {
                              updatedCollection.cashAmount = totalPayments;
                              updatedCollection.bankAmount = 0;
                            }
                            // If payments changed and there's existing allocation, update proportionally
                            else if (totalPayments > 0 && (updatedCollection.cashAmount + updatedCollection.bankAmount) > 0) {
                              const currentTotal = updatedCollection.cashAmount + updatedCollection.bankAmount;
                              if (currentTotal !== totalPayments) {
                                // Keep the same ratio but adjust total
                                const cashRatio = updatedCollection.cashAmount / currentTotal;
                                updatedCollection.cashAmount = Math.ceil(totalPayments * cashRatio);
                                updatedCollection.bankAmount = totalPayments - updatedCollection.cashAmount;
                              }
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
                      <td className="px-3 py-4 whitespace-nowrap">
                        {(() => {
                          // Calculate dynamic late fine based on submission date
                          const submissionDate = memberCollection.submissionDate || new Date();
                          const { daysLate, lateFineAmount } = calculateLateFineForSubmissionDate(group!, submissionDate, contribution.expectedContribution);
                          
                          return (
                            <>
                              <div className="text-sm font-medium text-foreground mb-1">
                                Due: ₹{formatCurrency(lateFineAmount)} 
                                {daysLate > 0 && <span className="text-xs text-gray-500 ml-1">({daysLate} days late)</span>}
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
                                  onWheel={(e) => {
                                    // Prevent mouse wheel from changing number input values
                                    e.currentTarget.blur();
                                  }}
                                  onChange={(e) => {
                                    const inputValue = e.target.value;
                                    const value = Math.max(0, Number(inputValue) || 0);
                                    const maxAmount = lateFineAmount; // Use dynamic late fine amount
                                    
                                    // Show warning if user tries to enter more than due amount
                                    if (value > maxAmount && maxAmount > 0) {
                                      // Optional: Show a brief warning (you could add a toast notification here)
                                      console.warn(`Late fine payment (₹${value}) cannot exceed due amount (₹${maxAmount})`);
                                    }
                                    
                                    // Round up decimal values and enforce maximum limit
                                    const roundedValue = Math.ceil(value);
                                    const finalValue = Math.min(roundedValue, maxAmount);
                                    
                                    // Update the specific field and recalculate cash/bank allocation
                                    const updatedCollection = {
                                      ...memberCollection,
                                      lateFinePaid: finalValue
                                    };
                                    
                                    // Recalculate total cash/bank allocation based on all payments
                                    const totalPayments = (updatedCollection.compulsoryContribution || 0) + 
                                                        (updatedCollection.interestPaid || 0) + 
                                                        (updatedCollection.lateFinePaid || 0) + 
                                                        (updatedCollection.groupSocialPaid || 0) + 
                                                        (updatedCollection.loanInsurancePaid || 0) + 
                                                        (updatedCollection.loanRepayment || 0);
                                    
                                    // If there are payments but no cash/bank allocation, auto-allocate to cash
                                    if (totalPayments > 0 && (updatedCollection.cashAmount + updatedCollection.bankAmount) === 0) {
                                      updatedCollection.cashAmount = totalPayments;
                                      updatedCollection.bankAmount = 0;
                                    }
                                    // If payments changed and there's existing allocation, update proportionally
                                    else if (totalPayments > 0 && (updatedCollection.cashAmount + updatedCollection.bankAmount) > 0) {
                                      const currentTotal = updatedCollection.cashAmount + updatedCollection.bankAmount;
                                      if (currentTotal !== totalPayments) {
                                        // Keep the same ratio but adjust total
                                        const cashRatio = updatedCollection.cashAmount / currentTotal;
                                        updatedCollection.cashAmount = Math.ceil(totalPayments * cashRatio);
                                        updatedCollection.bankAmount = totalPayments - updatedCollection.cashAmount;
                                      }
                                    }
                                    
                                    setMemberCollections(prev => ({
                                      ...prev,
                                      [memberId]: updatedCollection
                                    }));
                                  }}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-red-500 dark:bg-gray-700 dark:text-gray-100"
                                  min="0"
                                  max={lateFineAmount} // Use dynamic late fine amount
                                  step="0.01"
                                  disabled={currentPeriod?.isClosed}
                                />
                                {lateFineAmount > 0 && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Max: ₹{formatCurrency(lateFineAmount)}
                                  </div>
                                )}
                                {lateFineAmount === 0 && memberCollection.lateFinePaid > 0 && (
                                  <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                    No fine due - payment will be reset
                                  </div>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </td>
                    )}
                    {group?.loanInsuranceEnabled && (
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground mb-1">
                          Due: ₹{formatCurrency(contribution.loanInsuranceAmount || 0)}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Paid Amount</label>
                          <input
                            type="number"
                            value={memberCollection.loanInsurancePaid === 0 ? '' : memberCollection.loanInsurancePaid}
                            onFocus={(e) => {
                              // Clear field if value is 0 for better UX
                              if (Number(e.target.value) === 0) {
                                e.target.value = '';
                              }
                            }}
                            onWheel={(e) => {
                              // Prevent mouse wheel from changing number input values
                              e.currentTarget.blur();
                            }}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              const value = Math.max(0, Number(inputValue) || 0);
                              const maxAmount = contribution.loanInsuranceAmount || 0;
                              
                              // Round up decimal values
                              const roundedValue = Math.ceil(value);
                              const finalValue = Math.min(roundedValue, maxAmount);
                              
                              // Update the specific field and recalculate cash/bank allocation
                              const updatedCollection = {
                                ...memberCollection,
                                loanInsurancePaid: finalValue
                              };
                              
                              // Recalculate total cash/bank allocation based on all payments
                              const totalPayments = (updatedCollection.compulsoryContribution || 0) + 
                                                  (updatedCollection.interestPaid || 0) + 
                                                  (updatedCollection.lateFinePaid || 0) + 
                                                  (updatedCollection.groupSocialPaid || 0) + 
                                                  (updatedCollection.loanInsurancePaid || 0) + 
                                                  (updatedCollection.loanRepayment || 0);
                              
                              // If there are payments but no cash/bank allocation, auto-allocate to cash
                              if (totalPayments > 0 && (updatedCollection.cashAmount + updatedCollection.bankAmount) === 0) {
                                updatedCollection.cashAmount = totalPayments;
                                updatedCollection.bankAmount = 0;
                              }
                              // If payments changed and there's existing allocation, update proportionally
                              else if (totalPayments > 0 && (updatedCollection.cashAmount + updatedCollection.bankAmount) > 0) {
                                const currentTotal = updatedCollection.cashAmount + updatedCollection.bankAmount;
                                if (currentTotal !== totalPayments) {
                                  // Keep the same ratio but adjust total
                                  const cashRatio = updatedCollection.cashAmount / currentTotal;
                                  updatedCollection.cashAmount = Math.ceil(totalPayments * cashRatio);
                                  updatedCollection.bankAmount = totalPayments - updatedCollection.cashAmount;
                                }
                              }
                              
                              setMemberCollections(prev => ({
                                ...prev,
                                [memberId]: updatedCollection
                              }));
                            }}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-gray-100"
                            min="0"
                            max={contribution.loanInsuranceAmount || 0}
                            step="0.01"
                            disabled={currentPeriod?.isClosed}
                          />
                        </div>
                      </td>
                    )}
                    {group?.groupSocialEnabled && (
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground mb-1">
                          Due: ₹{formatCurrency(contribution.groupSocialAmount || 0)}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Paid Amount</label>
                          <input
                            type="number"
                            value={memberCollection.groupSocialPaid === 0 ? '' : memberCollection.groupSocialPaid}
                            onFocus={(e) => {
                              // Clear field if value is 0 for better UX
                              if (Number(e.target.value) === 0) {
                                e.target.value = '';
                              }
                            }}
                            onWheel={(e) => {
                              // Prevent mouse wheel from changing number input values
                              e.currentTarget.blur();
                            }}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              const value = Math.max(0, Number(inputValue) || 0);
                              const maxAmount = contribution.groupSocialAmount || 0;
                              
                              // Round up decimal values
                              const roundedValue = Math.ceil(value);
                              const finalValue = Math.min(roundedValue, maxAmount);
                              
                              // Update the specific field and recalculate cash/bank allocation
                              const updatedCollection = {
                                ...memberCollection,
                                groupSocialPaid: finalValue
                              };
                              
                              // Recalculate total cash/bank allocation based on all payments
                              const totalPayments = (updatedCollection.compulsoryContribution || 0) + 
                                                  (updatedCollection.interestPaid || 0) + 
                                                  (updatedCollection.lateFinePaid || 0) + 
                                                  (updatedCollection.groupSocialPaid || 0) + 
                                                  (updatedCollection.loanInsurancePaid || 0) + 
                                                  (updatedCollection.loanRepayment || 0);
                              
                              // If there are payments but no cash/bank allocation, auto-allocate to cash
                              if (totalPayments > 0 && (updatedCollection.cashAmount + updatedCollection.bankAmount) === 0) {
                                updatedCollection.cashAmount = totalPayments;
                                updatedCollection.bankAmount = 0;
                              }
                              // If payments changed and there's existing allocation, update proportionally
                              else if (totalPayments > 0 && (updatedCollection.cashAmount + updatedCollection.bankAmount) > 0) {
                                const currentTotal = updatedCollection.cashAmount + updatedCollection.bankAmount;
                                if (currentTotal !== totalPayments) {
                                  // Keep the same ratio but adjust total
                                  const cashRatio = updatedCollection.cashAmount / currentTotal;
                                  updatedCollection.cashAmount = Math.ceil(totalPayments * cashRatio);
                                  updatedCollection.bankAmount = totalPayments - updatedCollection.cashAmount;
                                }
                              }
                              
                              setMemberCollections(prev => ({
                                ...prev,
                                [memberId]: updatedCollection
                              }));
                            }}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-gray-700 dark:text-gray-100"
                            min="0"
                            max={contribution.groupSocialAmount || 0}
                            step="0.01"
                            disabled={currentPeriod?.isClosed}
                          />
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-4 whitespace-nowrap">
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
                          onWheel={(e) => {
                            // Prevent mouse wheel from changing number input values
                            e.currentTarget.blur();
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
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-orange-600 dark:text-orange-400">
                        ₹{formatCurrency(memberCollection.remainingLoan)}
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
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
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Date</label>
                        <DatePicker
                          selected={memberCollection.submissionDate || new Date()}
                          onChange={(date) => {
                            if (date) {
                              // Calculate new late fine amount based on the new submission date
                              const { daysLate, lateFineAmount } = calculateLateFineForSubmissionDate(group!, date, contribution.expectedContribution);
                              
                              // Get current paid amount for late fine
                              const currentLateFinesPaid = memberCollection.lateFinePaid || 0;
                              
                              // If current paid amount exceeds new due amount, adjust it
                              const adjustedLateFinesPaid = Math.min(currentLateFinesPaid, lateFineAmount);
                              
                              // Update member collection with new submission date and adjusted late fine paid
                              const updatedCollection = {
                                ...memberCollection,
                                submissionDate: date,
                                lateFinePaid: adjustedLateFinesPaid
                              };
                              
                              // If late fine paid was adjusted, recalculate cash/bank allocation
                              if (adjustedLateFinesPaid !== currentLateFinesPaid) {
                                const totalPayments = (updatedCollection.compulsoryContribution || 0) + 
                                                    (updatedCollection.interestPaid || 0) + 
                                                    (updatedCollection.lateFinePaid || 0) + 
                                                    (updatedCollection.groupSocialPaid || 0) + 
                                                    (updatedCollection.loanInsurancePaid || 0) + 
                                                    (updatedCollection.loanRepayment || 0);
                                
                                // Update cash allocation proportionally
                                if (totalPayments > 0 && (updatedCollection.cashAmount + updatedCollection.bankAmount) > 0) {
                                  const currentTotal = updatedCollection.cashAmount + updatedCollection.bankAmount;
                                  if (currentTotal !== totalPayments) {
                                    const cashRatio = updatedCollection.cashAmount / currentTotal;
                                    updatedCollection.cashAmount = Math.ceil(totalPayments * cashRatio);
                                    updatedCollection.bankAmount = totalPayments - updatedCollection.cashAmount;
                                  }
                                }
                              }
                              
                              setMemberCollections(prev => ({
                                ...prev,
                                [memberId]: updatedCollection
                              }));
                              
                              // Show notification if late fine paid was adjusted
                              if (adjustedLateFinesPaid !== currentLateFinesPaid) {
                                console.log(`Late fine payment adjusted from ₹${currentLateFinesPaid} to ₹${adjustedLateFinesPaid} due to submission date change`);
                                // You could add a toast notification here for better UX
                              }
                            }
                          }}
                          dateFormat="MMM dd, yyyy"
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                          maxDate={new Date()}
                          disabled={currentPeriod?.isClosed}
                          placeholderText="Select date"
                        />
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Affects late fines
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm sticky right-0 bg-white dark:bg-gray-800 z-10 border-l border-gray-200 dark:border-gray-700">
                      <button
                        onClick={async () => {
                          const totalAmount = memberCollection.cashAmount + memberCollection.bankAmount;
                          if (totalAmount > 0) {
                            await submitMemberCollection(memberId);
                          } else {
                            alert('Please enter collection amount in cash or bank');
                          }
                        }}
                        disabled={savingPayment === contribution.memberId || currentPeriod?.isClosed || 
                                (memberCollection.cashAmount + memberCollection.bankAmount) <= 0}
                        className={`w-full btn-primary text-xs py-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed ${
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
                  <td colSpan={
                    9 + 
                    (lateFinesEnabled ? 1 : 0) + 
                    (group?.loanInsuranceEnabled ? 1 : 0) + 
                    (group?.groupSocialEnabled ? 1 : 0)
                  } className="px-6 py-12 text-center">
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
            Collection rate: {(() => {
              const actualCollected = totalCollected;
              const inputCollected = Object.values(memberCollections).reduce((sum, collection) => {
                return sum + (collection.cashAmount || 0) + (collection.bankAmount || 0);
              }, 0);
              const totalDynamicCollected = actualCollected + inputCollected;
              return totalExpected > 0 ? Math.min(((totalDynamicCollected / totalExpected) * 100), 100).toFixed(1) : 0;
            })()}%
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
                  {group?.groupSocialEnabled && selectedMember.groupSocialAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Group Social:</span>
                      <span className="font-medium text-purple-600 dark:text-purple-400">₹{selectedMember.groupSocialAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {group?.loanInsuranceEnabled && selectedMember.loanInsuranceAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Loan Insurance:</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">₹{selectedMember.loanInsuranceAmount.toLocaleString()}</span>
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
                      
                      // Calculate how much payment goes to contribution vs interest vs late fine vs GS vs LI
                      let contributionPayment = 0;
                      let interestPayment = 0;
                      let lateFinePayment = 0;
                      let groupSocialPayment = 0;
                      let loanInsurancePayment = 0;
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
                      
                      // Then allocate to late fines
                      if (remainingPayment > 0 && lateFinesEnabled && selectedMember.lateFineAmount > 0) {
                        lateFinePayment = Math.min(remainingPayment, selectedMember.lateFineAmount);
                        remainingPayment -= lateFinePayment;
                      }
                      
                      // Then allocate to group social
                      if (remainingPayment > 0 && group?.groupSocialEnabled && selectedMember.groupSocialAmount > 0) {
                        groupSocialPayment = Math.min(remainingPayment, selectedMember.groupSocialAmount);
                        remainingPayment -= groupSocialPayment;
                      }
                      
                      // Then allocate to loan insurance
                      if (remainingPayment > 0 && group?.loanInsuranceEnabled && selectedMember.loanInsuranceAmount > 0) {
                        loanInsurancePayment = Math.min(remainingPayment, selectedMember.loanInsuranceAmount);
                        remainingPayment -= loanInsurancePayment;
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
                        interestToCashInBank: finalInterestAllocation.cashInBank,
                        // Default allocation for late fine, GS and LI - all to hand for now
                        // These can be expanded in future with UI controls
                        lateFineToHand: lateFinePayment,
                        lateFineToBank: 0,
                        groupSocialToHand: groupSocialPayment,
                        groupSocialToBank: 0,
                        loanInsuranceToHand: loanInsurancePayment,
                        loanInsuranceToBank: 0
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
      <ReportModal 
        showModal={showReportModal}
        onClose={() => setShowReportModal(false)}
        onGeneratePDF={generatePDFReport}
        onGenerateExcel={generateExcelReport}
        onGenerateCSV={generateCSVReport}
        periodName={showOldContributions && selectedPeriodId 
          ? formatPeriodName(closedPeriods.find(p => p.id === selectedPeriodId)) 
          : getCurrentPeriodName()}
        isHistorical={showOldContributions}
      />

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

      {/* Generate Report Modal */}
      <ReportModal 
        showModal={showReportModal}
        onClose={() => setShowReportModal(false)}
        onGeneratePDF={generatePDFReport}
        onGenerateExcel={generateExcelReport}
        onGenerateCSV={generateCSVReport}
        periodName={showOldContributions && selectedPeriodId 
          ? formatPeriodName(closedPeriods.find(p => p.id === selectedPeriodId)) 
          : getCurrentPeriodName()}
        isHistorical={showOldContributions}
      />

    </div>
  );
}