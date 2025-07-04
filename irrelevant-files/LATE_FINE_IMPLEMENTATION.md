# Late Fine Implementation Summary

## Overview
The Track Contributions page has been enhanced to support automatic late fine calculation based on the group's collection schedule and late fine rules.

## Key Features Implemented

### 1. Collection Schedule Support
- **Monthly**: Collection on a specific day of the month (e.g., 8th of every month)
- **Weekly**: Collection on a specific day of the week (e.g., every Monday)
- **Fortnightly**: Collection every two weeks on a specific day
- **Yearly**: Collection on a specific date annually

### 2. Late Fine Calculation Types
- **Daily Fixed**: Fixed amount per day (e.g., ₹5 per day late)
- **Daily Percentage**: Percentage of contribution per day (e.g., 0.5% per day late)
- **Tier-Based**: Progressive penalties with different rates for different time periods

### 3. Automatic Due Date Calculation
- Calculates next due date based on collection frequency and schedule
- Determines how many days late a member is
- Handles edge cases like months with different numbers of days

### 4. UI Enhancements
- **Late Fine Column**: Shows late fine amounts only when enabled
- **Status Updates**: Added "OVERDUE" status for late payments
- **Visual Indicators**: 
  - Red highlighting for overdue contributions
  - Days late display under member names
  - Late fine breakdown in the late fine column
- **Summary Cards**: Shows total late fines when enabled
- **Responsive Layout**: Adapts grid layout based on whether late fines are enabled

### 5. Smart Display Logic
- Late fine information only appears when late fines are enabled for the group
- Table columns adjust dynamically based on late fine settings
- Due date information shown in header based on collection schedule

## Implementation Details

### Database Integration
- Modified API route to include `lateFineRules` with `tierRules`
- Added proper Prisma relations for late fine data

### Calculation Logic
```typescript
// Due date calculation based on collection frequency
const calculateNextDueDate = (groupData: GroupData): Date => {
  // Handles WEEKLY, FORTNIGHTLY, MONTHLY, YEARLY frequencies
}

// Late fine calculation based on rule type
const calculateLateFine = (groupData: GroupData, daysLate: number, expectedContribution: number): number => {
  // Handles DAILY_FIXED, DAILY_PERCENTAGE, TIER_BASED rules
}
```

### Enhanced Data Structure
```typescript
interface MemberContributionStatus {
  memberId: string;
  memberName: string;
  expectedContribution: number;
  expectedInterest: number;
  currentLoanBalance: number;
  lateFineAmount: number;        // NEW: Calculated late fine
  daysLate: number;             // NEW: Days past due date
  dueDate: Date;                // NEW: Calculated due date
  totalExpected: number;        // NOW: Includes late fine
  paidAmount: number;
  remainingAmount: number;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE'; // NEW: Added OVERDUE
  lastPaymentDate?: string;
}
```

## Examples

### Example 1: Monthly Collection with Fixed Late Fine
- Collection Date: 8th of every month
- Late Fine: ₹5 per day after due date
- Member A pays on 15th: 7 days late = ₹35 late fine

### Example 2: Weekly Collection with Percentage Late Fine
- Collection Day: Every Monday
- Late Fine: 0.5% of contribution per day
- Member B (₹1000 contribution) pays 5 days late = ₹25 late fine

### Example 3: Tier-Based Late Fine
- Days 1-7: ₹2 per day
- Days 8-14: ₹5 per day  
- Days 15+: 1% of contribution per day
- Member C (₹1000 contribution) pays 20 days late:
  - Week 1: 7 × ₹2 = ₹14
  - Week 2: 7 × ₹5 = ₹35
  - Days 15-20: 6 × ₹10 = ₹60
  - Total: ₹109

## Usage Instructions
1. Group leader enables late fines during group setup or via settings
2. Leader selects collection frequency and schedule
3. Leader configures late fine rule (fixed, percentage, or tiered)
4. System automatically calculates due dates and late fines
5. Track Contributions page shows late fine information and totals
6. Members can see their overdue status and accumulated late fines

## Technical Benefits
- No dependency on periodic records - fetches all data directly from group
- Real-time calculation of late fines based on current date
- Flexible rule system supporting various penalty structures
- Responsive UI that adapts to group settings
- Maintains backward compatibility with existing functionality

## Future Enhancements
- Late fine payment tracking and history
- Automated notifications for overdue payments
- Bulk late fine adjustments
- Late fine waiver/forgiveness functionality
- Integration with SMS/email reminders
