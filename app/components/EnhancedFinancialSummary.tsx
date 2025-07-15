import React from 'react';

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
  collectionDayOfMonth?: number;
  collectionDayOfWeek?: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  collectionWeekOfMonth?: number;
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
  loanInsuranceEnabled?: boolean;
  loanInsurancePercent?: number;
  groupSocialEnabled?: boolean;
  groupSocialAmountPerFamilyMember?: number;
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
  compulsoryContributionDue: number;
  loanInterestDue?: number;
  loanInsuranceDue?: number;
  groupSocialDue?: number;
  minimumDueAmount: number;
  compulsoryContributionPaid: number;
  loanInterestPaid: number;
  lateFineAmount?: number;
  lateFinePaid: number;
  loanInsurancePaid: number;
  groupSocialPaid: number;
  totalPaid: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'LATE';
  dueDate: string;
  paidDate?: string;
  daysLate: number;
  remainingAmount: number;
  cashAllocation?: string;
  createdAt: string;
  updatedAt: string;
  baseAmount?: number;
  lateFine?: number;
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
  loanInsuranceAmount?: number;
  groupSocialAmount?: number;
}

interface EnhancedFinancialSummaryProps {
  group: GroupData;
  actualContributions: Record<string, ContributionRecord>;
  memberContributions: MemberContributionStatus[];
  totalCollected: number;
}

const EnhancedFinancialSummary: React.FC<EnhancedFinancialSummaryProps> = ({ 
  group, 
  actualContributions, 
  memberContributions, 
  totalCollected 
}) => {
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
    return sum + Math.ceil((record.totalPaid || 0) * 0.3); // Round up to match PDF
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
    return sum + Math.ceil((record.totalPaid || 0) * 0.7); // Round up to match PDF
  }, 0);
  
  const startingCashInHand = group.cashInHand || 0;
  const startingCashInBank = group.balanceInBank || 0;
  const totalCashInHand = Math.ceil(startingCashInHand + currentPeriodCashInHand);
  const totalCashInBank = Math.ceil(startingCashInBank + currentPeriodCashInBank);
  
  const totalLoanAssets = Math.ceil(memberContributions.reduce((sum, member) => {
    return sum + (member.currentLoanBalance || 0);
  }, 0));
  
  const collectionThisPeriod = Math.ceil(totalCollected);
  const interestThisPeriod = Math.ceil(memberContributions.reduce((sum, member) => {
    return sum + member.expectedInterest;
  }, 0));

  // Calculate LI and GS fund amounts (round up)
  const totalLoanInsuranceFund = group.loanInsuranceEnabled ? 
    Math.ceil(Object.values(actualContributions).reduce((sum, record) => {
      return sum + (record.loanInsurancePaid || 0);
    }, 0)) : 0;
  
  const totalGroupSocialFund = group.groupSocialEnabled ? 
    Math.ceil(Object.values(actualContributions).reduce((sum, record) => {
      return sum + (record.groupSocialPaid || 0);
    }, 0)) : 0;
  
  // Calculate late fines
  const totalLateFines = Math.ceil(Object.values(actualContributions).reduce((sum, record) => {
    return sum + (record.lateFine || 0);
  }, 0));

  // Enhanced calculations when GS or LI are enabled
  const shouldShowEnhancedFormula = group.groupSocialEnabled || group.loanInsuranceEnabled;

  if (shouldShowEnhancedFormula) {
    // Enhanced Total Collection Formula
    const monthlyCompulsoryContribution = Math.ceil(Object.values(actualContributions).reduce((sum, record) => {
      return sum + (record.baseAmount || 0);
    }, 0));
    
    const enhancedTotalCollection = Math.ceil(
      monthlyCompulsoryContribution + 
      totalLateFines + 
      interestThisPeriod + 
      totalLoanInsuranceFund + 
      totalGroupSocialFund
    );

    // Enhanced Group Standing Formula
    const previousMonthBalance = startingCashInHand + startingCashInBank;
    const interestIncome = interestThisPeriod;
    const expenses = 0; // Assume no expenses for now
    const remainingPersonalLoanAmount = totalLoanAssets;
    
    const enhancedGroupStanding = Math.ceil(
      previousMonthBalance + 
      enhancedTotalCollection + 
      interestIncome - 
      expenses + 
      remainingPersonalLoanAmount - 
      totalGroupSocialFund - 
      totalLoanInsuranceFund
    );

    return (
      <div className="space-y-6">
        {/* Enhanced Total Collection Formula */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-700 border-2">
          <h4 className="font-bold text-green-800 dark:text-green-200 mb-2 text-lg">Enhanced Total Collection</h4>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-green-300 dark:border-green-600">
            <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">Formula:</p>
            <p className="text-sm font-bold text-green-800 dark:text-green-200 mb-3">
              Total Collection = Sum of (Monthly Compulsory Contribution + Late Fine + Interest Paid (Personal Loan) + Loan Insurance + Group Social) for all members
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Monthly Compulsory Contribution:</span>
                <span>₹{monthlyCompulsoryContribution.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Late Fine:</span>
                <span>₹{totalLateFines.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Interest Paid (Personal Loans):</span>
                <span>₹{interestThisPeriod.toLocaleString()}</span>
              </div>
              {group.loanInsuranceEnabled && (
                <div className="flex justify-between">
                  <span>Loan Insurance:</span>
                  <span>₹{totalLoanInsuranceFund.toLocaleString()}</span>
                </div>
              )}
              {group.groupSocialEnabled && (
                <div className="flex justify-between">
                  <span>Group Social:</span>
                  <span>₹{totalGroupSocialFund.toLocaleString()}</span>
                </div>
              )}
              <hr className="border-green-200 dark:border-green-600" />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total Collection:</span>
                <span>₹{enhancedTotalCollection.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Group Standing Formula */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700 border-2">
          <h4 className="font-bold text-purple-800 dark:text-purple-200 mb-2 text-lg">Enhanced Group Standing</h4>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-purple-300 dark:border-purple-600">
            <p className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-2">Formula:</p>
            <p className="text-sm font-bold text-purple-800 dark:text-purple-200 mb-3">
              Total Group Standing = [(Previous Month Balance + Total Collection + Interest Income − Expenses) + Remaining Personal Loan Amount] − Group Social Fund − Loan Insurance Fund
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Previous Month Balance:</span>
                <span>₹{previousMonthBalance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Collection:</span>
                <span>₹{enhancedTotalCollection.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Interest Income:</span>
                <span>₹{interestIncome.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Expenses:</span>
                <span>₹{expenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Remaining Personal Loan Amount:</span>
                <span>₹{remainingPersonalLoanAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-red-600 dark:text-red-400">
                <span>Group Social Fund:</span>
                <span>-₹{totalGroupSocialFund.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-red-600 dark:text-red-400">
                <span>Loan Insurance Fund:</span>
                <span>-₹{totalLoanInsuranceFund.toLocaleString()}</span>
              </div>
              <hr className="border-purple-200 dark:border-purple-600" />
              <div className="flex justify-between font-semibold text-lg">
                <span>Enhanced Group Standing:</span>
                <span>₹{enhancedGroupStanding.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Display Group Social and Loan Insurance totals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {group.groupSocialEnabled && (
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
              <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Group Social Fund (GS)</h4>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                ₹{totalGroupSocialFund.toLocaleString()}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                Total contributions to Group Social
              </div>
            </div>
          )}
          
          {group.loanInsuranceEnabled && (
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Loan Insurance Fund (LI)</h4>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                ₹{totalLoanInsuranceFund.toLocaleString()}
              </div>
              <div className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                Total Loan Insurance collected
              </div>
            </div>
          )}
        </div>

        {/* Financial Values Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-600 dark:text-gray-400">Current Cash in Hand:</span>
              <span className="font-medium text-green-700 dark:text-green-300">₹{totalCashInHand.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-600 dark:text-gray-400">Current Cash in Bank:</span>
              <span className="font-medium text-blue-700 dark:text-blue-300">₹{totalCashInBank.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Loan Assets:</span>
              <span className="font-medium text-purple-600 dark:text-purple-400">₹{totalLoanAssets.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-4 rounded-lg border border-orange-200 dark:border-orange-700">
              <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2">Final Group Standing</h4>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                ₹{enhancedGroupStanding.toLocaleString()}
              </div>
              <div className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                Share per Member: ₹{Math.ceil(enhancedGroupStanding / group.memberCount).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    // Original formula when GS/LI are not enabled
    const originalGroupStanding = Math.ceil(totalCashInHand + totalCashInBank + totalLoanAssets);
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-600 dark:text-gray-400">Current Cash in Hand:</span>
              <span className="font-medium text-green-700 dark:text-green-300">₹{totalCashInHand.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-600 dark:text-gray-400">Current Cash in Bank:</span>
              <span className="font-medium text-blue-700 dark:text-blue-300">₹{totalCashInBank.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Loan Assets:</span>
              <span className="font-medium text-purple-600 dark:text-purple-400">₹{totalLoanAssets.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
              <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">Group Standing</h4>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                ₹{originalGroupStanding.toLocaleString()}
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                Share per Member: ₹{Math.ceil(originalGroupStanding / group.memberCount).toLocaleString()}
              </div>
              <div className="text-xs text-purple-500 dark:text-purple-400 mt-2">
                Formula: Cash in Hand + Cash in Bank + Loan Assets
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
};

export default EnhancedFinancialSummary;
