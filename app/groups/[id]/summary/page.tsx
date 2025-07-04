'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useParams, notFound } from 'next/navigation';

// Helper function to safely format numbers and prevent NaN display
function safeFormat(value: unknown, type: 'currency' | 'number' | 'percentage' = 'number'): string {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    return type === 'currency' ? '₹0' : type === 'percentage' ? '0%' : '0';
  }
  
  switch (type) {
    case 'currency':
      return `₹${num.toLocaleString()}`;
    case 'percentage':
      return `${num.toFixed(1)}%`;
    default:
      return num.toLocaleString();
  }
}

// Helper function to safely get numbers for calculations
function safeNumber(value: unknown): number {
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? 0 : num;
}

// Chart components (we'll implement these as simple CSS charts for now)
interface ChartData {
  labels: string[];
  data: number[];
  colors?: string[];
}

// Simple bar chart component
function BarChart({ data, title, className = '' }: { data: ChartData; title: string; className?: string }) {
  // Handle empty data
  if (!data.data || data.data.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg border ${className}`}>
        <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">{title}</h4>
        <div className="h-32 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No data available
        </div>
      </div>
    );
  }

  const validData = data.data.map(val => safeNumber(val)).filter(val => val >= 0);
  const maxValue = validData.length > 0 ? Math.max(...validData) : 0;
  
  return (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg border ${className}`}>
      <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">{title}</h4>
      <div className="space-y-2">
        {data.labels.map((label, index) => {
          const value = safeNumber(data.data[index]);
          const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
          
          return (
            <div key={label} className="flex items-center space-x-2">
              <div className="w-24 text-sm text-gray-600 dark:text-gray-400 truncate">{label}</div>
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 relative">
                <div 
                  className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                ></div>
              </div>
              <div className="w-20 text-sm font-medium text-gray-800 dark:text-gray-200 text-right">
                {safeFormat(value, 'currency')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Simple line chart component
function LineChart({ data, title, className = '' }: { data: ChartData; title: string; className?: string }) {
  // Handle empty data
  if (!data.data || data.data.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg border ${className}`}>
        <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">{title}</h4>
        <div className="h-32 relative bg-gray-50 dark:bg-gray-700 rounded p-2 flex items-center justify-center">
          <span className="text-gray-500 dark:text-gray-400">No data available</span>
        </div>
      </div>
    );
  }

  // Filter out invalid values and create array of valid data points with their indices
  const validDataPoints = data.data
    .map((value, index) => ({ value: safeNumber(value), index }))
    .filter(point => point.value >= 0 || point.value < 0); // Allow negative values but filter out NaN/invalid
  
  if (validDataPoints.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg border ${className}`}>
        <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">{title}</h4>
        <div className="h-32 relative bg-gray-50 dark:bg-gray-700 rounded p-2 flex items-center justify-center">
          <span className="text-gray-500 dark:text-gray-400">No valid data available</span>
        </div>
      </div>
    );
  }

  const values = validDataPoints.map(point => point.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1; // Prevent division by zero
  const dataLength = data.data.length;
  
  return (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg border ${className}`}>
      <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">{title}</h4>
      <div className="h-32 relative bg-gray-50 dark:bg-gray-700 rounded p-2">
        <svg className="w-full h-full" viewBox="0 0 400 120">
          <polyline
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2"
            points={validDataPoints.map(point => {
              const x = dataLength > 1 ? (point.index / (dataLength - 1)) * 380 + 10 : 200;
              const y = 110 - ((point.value - minValue) / range) * 100;
              return `${x},${y}`;
            }).join(' ')}
          />
          {validDataPoints.map((point, idx) => {
            const x = dataLength > 1 ? (point.index / (dataLength - 1)) * 380 + 10 : 200;
            const y = 110 - ((point.value - minValue) / range) * 100;
            
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r="3"
                fill="#3B82F6"
              />
            );
          })}
        </svg>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          {data.labels.slice(0, 5).map((label, index) => (
            <span key={index}>
              {label ? new Date(label).toLocaleDateString('en-US', { month: 'short' }) : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Metric card component
function MetricCard({ title, value, subtitle, icon, color = 'blue' }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700'
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

interface SummaryData {
  groupInfo: {
    id: string;
    name: string;
    leader: { id: string; name: string; email: string };
    totalMembers: number;
    dateOfStarting: string | null;
    address: string | null;
    organization: string | null;
    bankAccountNumber: string | null;
    bankName: string | null;
  };
  financialOverview: {
    totalGroupStanding: number;
    currentCashInBank: number;
    currentCashInHand: number;
    sharePerMember: number;
    growthFromStart: number;
  };
  loanStatistics: {
    totalActiveLoans: number;
    totalLoanAmount: number;
    totalOutstandingAmount: number;
    averageLoanSize: number;
    repaymentRate: number;
  };
  recentActivity: {
    totalCollections: number;
    totalInterestEarned: number;
    totalExpenses: number;
    netIncome: number;
    periodsAnalyzed: number;
  };
  interestProfitAnalysis: Array<{
    date: string;
    period: string;
    interestEarned: number;
    expenses: number;
    netInterestProfit: number;
    profitMargin: number;
  }>;
  monthlyTrends: Array<{
    date: string;
    totalStanding: number;
    collections: number;
    expenses: number;
    interestEarned: number;
    cashInBank: number;
    cashInHand: number;
    membersPresent: number;
  }>;
  recordsAnalyzed: number;
  lastUpdated: string;
  // Enhanced contribution tracking data
  contributionAnalytics?: {
    averageContribution: number;
    totalContributionsToDate: number;
    contributionConsistency: number;
    topContributors: Array<{
      memberName: string;
      totalContributions: number;
      averageContribution: number;
      consistencyRate: number;
    }>;
    periodWiseContributions: Array<{
      period: string;
      totalContributions: number;
      averageContribution: number;
      memberCount: number;
    }>;
  };
  memberContributions?: Array<{
    memberId: string;
    memberName: string;
    totalContributions: number;
    lastContribution: number;
    averageContribution: number;
    contributionGrowth: number;
    periodsActive: number;
  }>;
}

// Enhanced Contribution Tracking Component
function ContributionTracker({ summary, onRefresh }: { summary: SummaryData; onRefresh: () => void }) {
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [sortField, setSortField] = useState<'totalContributions' | 'averageContribution' | 'contributionGrowth'>('totalContributions');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Generate mock analytics from existing summary data if contribution analytics aren't available
  const contributionAnalytics = summary.contributionAnalytics || {
    averageContribution: summary.recentActivity.totalCollections / Math.max(summary.groupInfo.totalMembers, 1) / Math.max(summary.recentActivity.periodsAnalyzed, 1),
    totalContributionsToDate: summary.recentActivity.totalCollections,
    contributionConsistency: 85, // Mock consistency rate
    topContributors: [],
    periodWiseContributions: []
  };

  // Generate mock member contributions if not available
  const memberContributions = summary.memberContributions || Array.from({ length: summary.groupInfo.totalMembers }, (_, i) => ({
    memberId: `member-${i + 1}`,
    memberName: `Member ${i + 1}`,
    totalContributions: Math.floor(Math.random() * 5000) + 1000,
    lastContribution: Math.floor(Math.random() * 1000) + 200,
    averageContribution: Math.floor(Math.random() * 800) + 400,
    contributionGrowth: (Math.random() - 0.5) * 20, // -10% to +10%
    periodsActive: Math.floor(Math.random() * summary.recentActivity.periodsAnalyzed) + 1
  }));

  const sortedMembers = memberContributions.sort((a, b) => {
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    return (a[sortField] - b[sortField]) * multiplier;
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Contribution Tracking & Analytics
          </h3>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
            📊 Sample data shown for demonstration - real data will be integrated from periodic records
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMemberDetails(!showMemberDetails)}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {showMemberDetails ? 'Hide Details' : 'Member Details'}
          </button>
          <button
            onClick={onRefresh}
            className="px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>      {/* Contribution Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
          <div className="flex items-center">
            <div className="bg-blue-500 p-2 rounded-lg mr-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Contribution</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {safeFormat(contributionAnalytics.averageContribution, 'currency')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
          <div className="flex items-center">
            <div className="bg-green-500 p-2 rounded-lg mr-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Collected</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {safeFormat(contributionAnalytics.totalContributionsToDate, 'currency')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700">
          <div className="flex items-center">
            <div className="bg-yellow-500 p-2 rounded-lg mr-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Consistency Rate</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {safeFormat(contributionAnalytics.contributionConsistency, 'percentage')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
          <div className="flex items-center">
            <div className="bg-purple-500 p-2 rounded-lg mr-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 009.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Members</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {summary.groupInfo.totalMembers}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Member Contribution Details */}
      {showMemberDetails && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Member Name
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('totalContributions')}
                >
                  <div className="flex items-center">
                    Total Contributions
                    {sortField === 'totalContributions' && (
                      <svg className={`w-3 h-3 ml-1 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('averageContribution')}
                >
                  <div className="flex items-center">
                    Avg Contribution
                    {sortField === 'averageContribution' && (
                      <svg className={`w-3 h-3 ml-1 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Last Contribution
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('contributionGrowth')}
                >
                  <div className="flex items-center">
                    Growth Trend
                    {sortField === 'contributionGrowth' && (
                      <svg className={`w-3 h-3 ml-1 ${sortOrder === 'asc' ? 'transform rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Periods Active
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedMembers.map((member) => (
                <tr key={member.memberId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {member.memberName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {safeFormat(member.totalContributions, 'currency')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {safeFormat(member.averageContribution, 'currency')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {safeFormat(member.lastContribution, 'currency')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        member.contributionGrowth > 0 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                          : member.contributionGrowth < 0 
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {member.contributionGrowth > 0 ? '↗' : member.contributionGrowth < 0 ? '↘' : '→'} 
                        {safeFormat(Math.abs(member.contributionGrowth), 'percentage')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                      {member.periodsActive} periods
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick Actions for Contribution Management */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border">
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Contribution Management Actions</h4>
        <div className="flex flex-wrap gap-3">
          <Link 
            href={`/groups/${summary.groupInfo.id}/periodic-records/create`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Track New Contributions
          </Link>
          
          <Link 
            href={`/groups/${summary.groupInfo.id}/periodic-records`}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            View All Records
          </Link>
          
          <button
            onClick={() => {
              // This could open a modal for bulk contribution analysis
              alert('Bulk contribution analysis feature coming soon!');
            }}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Bulk Analysis
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GroupSummaryPage() {
  const params = useParams();
  const id = params?.id as string;

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/groups/${id}/summary`);
      
      if (!response.ok) {
        if (response.status === 404) {
          notFound();
        }
        const errorData = await response.json().catch(() => ({ message: 'Failed to load summary' }));
        throw new Error(errorData.message || 'Failed to load group summary');
      }

      const data = await response.json();
      setSummary(data);
    } catch (err: unknown) {
      console.error(`Error fetching group summary ${id}:`, err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Could not load group summary due to an unknown error.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchSummary();
    }
  }, [id, fetchSummary]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex justify-center items-center mb-4">
          <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p className="text-muted text-xl">Loading group summary...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 dark:bg-red-900/20 p-8 rounded-lg border border-red-200 dark:border-red-700/50 text-center">
          <p className="text-red-700 dark:text-red-300 font-semibold text-xl">Error Loading Summary</p>
          <p className="text-red-600 dark:text-red-400 mt-2">{error}</p>
          <div className="mt-4 space-x-4">
            <button
              onClick={() => window.location.reload()} 
              className="btn-primary"
            >
              Retry
            </button>
            <Link href={`/groups/${id}`} className="btn-secondary">
              Back to Group
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return notFound();
  }

  // Prepare chart data with proper validation
  const monthlyStandingData: ChartData = {
    labels: summary.monthlyTrends.slice(0, 6).reverse().map(trend => trend.date),
    data: summary.monthlyTrends.slice(0, 6).reverse().map(trend => safeNumber(trend.totalStanding))
  };

  const interestProfitData: ChartData = {
    labels: summary.interestProfitAnalysis.map(period => period.period),
    data: summary.interestProfitAnalysis.map(period => safeNumber(period.netInterestProfit))
  };

  const cashFlowData: ChartData = {
    labels: summary.monthlyTrends.slice(0, 6).reverse().map(trend => 
      new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    ),
    data: summary.monthlyTrends.slice(0, 6).reverse().map(trend => {
      const collections = safeNumber(trend.collections);
      const expenses = safeNumber(trend.expenses);
      return collections - expenses;
    })
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex mb-4" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <Link href="/groups" className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
                </svg>
                Groups
              </Link>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
                </svg>
                <Link href={`/groups/${id}`} className="ml-1 text-sm font-medium text-gray-700 hover:text-blue-600 md:ml-2 dark:text-gray-400 dark:hover:text-white">
                  {summary.groupInfo.name}
                </Link>
              </div>
            </li>
            <li aria-current="page">
              <div className="flex items-center">
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
                </svg>
                <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">Summary</span>
              </div>
            </li>
          </ol>
        </nav>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {summary.groupInfo.name} - Summary
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Comprehensive financial overview and analytics
            </p>
            <div className="flex items-center mt-2 text-sm text-gray-500 dark:text-gray-400">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              {summary.groupInfo.address || 'No address provided'}
              {summary.groupInfo.organization && (
                <>
                  <span className="mx-2">•</span>
                  <span>{summary.groupInfo.organization}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <Link href={`/groups/${id}`} className="btn-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Group
            </Link>
            <Link href={`/groups/${id}/periodic-records`} className="btn-primary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Records
            </Link>
            <Link href={`/groups/${id}/periodic-records/create`} className="btn-success">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Record
            </Link>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Group Standing"
          value={safeFormat(summary.financialOverview.totalGroupStanding, 'currency')}
          subtitle={`${summary.financialOverview.growthFromStart >= 0 ? '+' : ''}${safeFormat(summary.financialOverview.growthFromStart, 'percentage')} growth`}
          color="blue"
          icon={
            <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          }
        />
        
        <MetricCard
          title="Active Members"
          value={safeFormat(summary.groupInfo.totalMembers)}
          subtitle={`${safeFormat(summary.financialOverview.sharePerMember, 'currency')} per member`}
          color="green"
          icon={
            <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />

        <MetricCard
          title="Active Loans"
          value={safeFormat(summary.loanStatistics.totalActiveLoans)}
          subtitle={`${safeFormat(summary.loanStatistics.totalOutstandingAmount, 'currency')} outstanding`}
          color="yellow"
          icon={
            <svg className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          }
        />

        <MetricCard
          title="Repayment Rate"
          value={safeFormat(summary.loanStatistics.repaymentRate, 'percentage')}
          subtitle={`${safeFormat(summary.recentActivity.netIncome, 'currency')} net income (recent)`}
          color={(safeNumber(summary.loanStatistics.repaymentRate)) >= 80 ? 'green' : (safeNumber(summary.loanStatistics.repaymentRate)) >= 60 ? 'yellow' : 'red'}
          icon={
            <svg className="h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
      </div>

      {/* Group Details Section */}
      {(summary.groupInfo.bankAccountNumber || summary.groupInfo.bankName) && (
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Group Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {summary.groupInfo.bankAccountNumber && (
                <div className="flex items-center">
                  <div className="flex-shrink-0 mr-4">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Bank Account Number</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{summary.groupInfo.bankAccountNumber}</p>
                  </div>
                </div>
              )}
              
              {summary.groupInfo.bankName && (
                <div className="flex items-center">
                  <div className="flex-shrink-0 mr-4">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Bank Name</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{summary.groupInfo.bankName}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <LineChart
          data={monthlyStandingData}
          title="Group Standing Trend (Last 6 Periods)"
          className="lg:col-span-1"
        />
        
        <LineChart
          data={cashFlowData}
          title="Net Cash Flow Trend (Last 6 Periods)"
          className="lg:col-span-1"
        />
      </div>

      {/* Interest Profit Analysis Chart */}
      <div className="mb-8">
        <BarChart
          data={interestProfitData}
          title="Interest Profit Analysis (Recent Periods)"
          className="w-full"
        />
      </div>

      {/* Detailed Financial Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Cash Position */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Cash Position</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cash in Bank:</span>
              <span className="font-medium">{safeFormat(summary.financialOverview.currentCashInBank, 'currency')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cash in Hand:</span>
              <span className="font-medium">{safeFormat(summary.financialOverview.currentCashInHand, 'currency')}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between font-semibold">
                <span>Total Cash:</span>
                <span>{safeFormat(safeNumber(summary.financialOverview.currentCashInBank) + safeNumber(summary.financialOverview.currentCashInHand), 'currency')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Summary */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
            Recent Activity ({summary.recentActivity.periodsAnalyzed} periods)
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Collections:</span>
              <span className="font-medium text-green-600">{safeFormat(summary.recentActivity.totalCollections, 'currency')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Interest Earned:</span>
              <span className="font-medium text-green-600">{safeFormat(summary.recentActivity.totalInterestEarned, 'currency')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Expenses:</span>
              <span className="font-medium text-red-600">{safeFormat(summary.recentActivity.totalExpenses, 'currency')}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between font-semibold">
                <span>Net Income:</span>
                <span className={safeNumber(summary.recentActivity.netIncome) >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {safeFormat(summary.recentActivity.netIncome, 'currency')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interest Profit Analysis Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Interest Profit Analysis</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Monthly breakdown of interest earnings vs expenses</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Interest Earned
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Expenses
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Net Profit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Profit Margin
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {summary.interestProfitAnalysis.map((period, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {period.period}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {safeFormat(period.interestEarned, 'currency')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {safeFormat(period.expenses, 'currency')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={safeNumber(period.netInterestProfit) >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {safeFormat(period.netInterestProfit, 'currency')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={safeNumber(period.profitMargin) >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {safeFormat(period.profitMargin, 'percentage')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          Summary based on {summary.recordsAnalyzed} periodic records. 
          Last updated: {new Date(summary.lastUpdated).toLocaleDateString()}
        </p>
      </div>

      {/* Contribution Tracking Component */}
      <ContributionTracker summary={summary} onRefresh={() => fetchSummary()} />
    </div>
  );
}
