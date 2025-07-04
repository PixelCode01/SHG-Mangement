#!/usr/bin/env node

// Fix the incorrect due dates in existing member contributions

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Import utility functions for due date calculation
// Since we can't import TS files directly, we'll recreate the logic here

function calculatePeriodDueDate(groupSchedule, periodDate) {
  const frequency = groupSchedule.collectionFrequency || 'MONTHLY';
  
  if (frequency === 'MONTHLY') {
    const targetDay = groupSchedule.collectionDayOfMonth || 1;
    
    // For monthly collections, the due date is the collection day of the period's month
    const periodMonth = periodDate.getUTCMonth();
    const periodYear = periodDate.getUTCFullYear();
    
    // Create due date on the target day of the period's month using UTC
    let dueDate = new Date(Date.UTC(periodYear, periodMonth, targetDay, 0, 0, 0, 0));
    
    // Handle months with fewer days (e.g., February 30 → February 28/29)
    if (dueDate.getUTCMonth() !== periodMonth) {
      // If the target day doesn't exist in this month, use the last day of the month
      dueDate = new Date(Date.UTC(periodYear, periodMonth + 1, 0, 0, 0, 0, 0)); // Last day of the month
    }
    
    // If the due date is before the period start, move to next month
    if (dueDate < periodDate) {
      dueDate = new Date(Date.UTC(periodYear, periodMonth + 1, targetDay, 0, 0, 0, 0));
      
      // Handle months with fewer days for next month too
      if (dueDate.getUTCMonth() !== (periodMonth + 1) % 12) {
        dueDate = new Date(Date.UTC(periodYear, periodMonth + 2, 0, 0, 0, 0, 0)); // Last day of next month
      }
    }
    
    return dueDate;
  }
  
  // For other frequencies, return the period date as fallback
  return periodDate;
}

function calculateDaysLate(dueDate, paymentDate = new Date()) {
  // Convert both dates to UTC date-only for consistent comparison
  const dueDateUTC = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));
  const paymentDateUTC = new Date(Date.UTC(paymentDate.getUTCFullYear(), paymentDate.getUTCMonth(), paymentDate.getUTCDate()));
  
  const timeDiff = paymentDateUTC.getTime() - dueDateUTC.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  
  // Only consider it late if payment is after the due date
  return Math.max(0, daysDiff);
}

async function fixDueDatesAndLateFines() {
  try {
    console.log('=== Fixing Due Dates and Late Fine Calculations ===');
    
    // Get the group with collection day 5th
    const group = await prisma.group.findFirst({
      where: { collectionDayOfMonth: 5 },
      include: {
        lateFineRules: {
          include: {
            tierRules: true
          }
        }
      }
    });
    
    if (!group) {
      console.log('No group found with collection day 5th');
      return;
    }
    
    console.log('Processing Group:', group.name);
    console.log('Collection Day:', group.collectionDayOfMonth);
    
    // Get all periodic records for this group
    const periodicRecords = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: group.id },
      orderBy: { meetingDate: 'asc' },
      include: {
        memberContributions: true
      }
    });
    
    console.log(`Found ${periodicRecords.length} periodic records`);
    
    let totalContributionsFixed = 0;
    
    for (const record of periodicRecords) {
      console.log(`\nProcessing period: ${record.meetingDate.toISOString().substring(0, 7)}`);
      console.log(`  Meeting Date: ${record.meetingDate.toISOString()}`);
      
      const groupSchedule = {
        collectionFrequency: group.collectionFrequency,
        collectionDayOfMonth: group.collectionDayOfMonth,
        collectionDayOfWeek: group.collectionDayOfWeek,
        collectionWeekOfMonth: group.collectionWeekOfMonth
      };
      
      // Calculate the correct due date for this period
      const correctDueDate = calculatePeriodDueDate(groupSchedule, record.meetingDate);
      console.log(`  Correct Due Date: ${correctDueDate.toISOString()}`);
      
      // Update all member contributions for this period
      const contributionsToUpdate = record.memberContributions;
      console.log(`  Contributions to update: ${contributionsToUpdate.length}`);
      
      for (const contrib of contributionsToUpdate) {
        const currentDueDate = contrib.dueDate;
        const needsUpdate = !currentDueDate || 
          Math.abs(currentDueDate.getTime() - correctDueDate.getTime()) > 24 * 60 * 60 * 1000; // More than 1 day difference
        
        if (needsUpdate) {
          // Calculate correct days late
          const today = new Date();
          const newDaysLate = calculateDaysLate(correctDueDate, today);
          
          // Calculate late fine amount (simplified version)
          let newLateFineAmount = 0;
          if (group.lateFineRules.length > 0 && group.lateFineRules[0].isEnabled && newDaysLate > 0) {
            const rule = group.lateFineRules[0];
            if (rule.ruleType === 'DAILY_FIXED') {
              newLateFineAmount = (rule.dailyAmount || 0) * newDaysLate;
            } else if (rule.ruleType === 'DAILY_PERCENTAGE') {
              const dailyRate = (rule.dailyPercentage || 0) / 100;
              newLateFineAmount = Math.round((contrib.compulsoryContributionDue * dailyRate * newDaysLate) * 100) / 100;
            }
          }
          
          console.log(`    Updating contribution for member ${contrib.memberId}`);
          console.log(`      Old Due Date: ${currentDueDate?.toISOString() || 'null'}`);
          console.log(`      New Due Date: ${correctDueDate.toISOString()}`);
          console.log(`      Old Days Late: ${contrib.daysLate || 0}`);
          console.log(`      New Days Late: ${newDaysLate}`);
          console.log(`      Old Late Fine: ₹${contrib.lateFineAmount || 0}`);
          console.log(`      New Late Fine: ₹${newLateFineAmount}`);
          
          // Update the contribution
          await prisma.memberContribution.update({
            where: { id: contrib.id },
            data: {
              dueDate: correctDueDate,
              daysLate: newDaysLate,
              lateFineAmount: newLateFineAmount,
              // Recalculate remaining amount if needed
              remainingAmount: Math.max(0, 
                (contrib.compulsoryContributionDue || 0) + 
                (contrib.loanInterestDue || 0) + 
                newLateFineAmount - 
                (contrib.totalPaid || 0)
              )
            }
          });
          
          totalContributionsFixed++;
        }
      }
    }
    
    console.log(`\n✅ Fixed ${totalContributionsFixed} member contributions`);
    
    // Now test the calculation for today (June 12th)
    console.log('\n=== Testing Current Calculation ===');
    const june12 = new Date('2025-06-12T00:00:00.000Z');
    const juneDueDate = new Date(Date.UTC(2025, 5, 5)); // June 5th, 2025
    const julyDueDate = new Date(Date.UTC(2025, 6, 5)); // July 5th, 2025
    
    const juneDaysLate = calculateDaysLate(juneDueDate, june12);
    const julyDaysLate = calculateDaysLate(julyDueDate, june12);
    
    console.log(`June period (due June 5th): ${juneDaysLate} days late on June 12th`);
    console.log(`July period (due July 5th): ${julyDaysLate} days late on June 12th`);
    console.log('Expected: June should be 7 days late, July should be 0 days late');
    
  } catch (error) {
    console.error('Error fixing due dates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDueDatesAndLateFines();
