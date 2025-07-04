#!/usr/bin/env node

// Correctly fix the due dates - period represents the month for which contributions are due

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function calculateCorrectDueDate(groupCollectionDay, periodMeetingDate) {
  // For monthly collections, the due date is the collection day of the SAME month as the meeting
  // This is because the period represents contributions due for that month
  
  const meetingYear = periodMeetingDate.getUTCFullYear();
  const meetingMonth = periodMeetingDate.getUTCMonth(); // 0-based
  
  // Create due date on the collection day of the same month as the meeting
  let dueDate = new Date(Date.UTC(meetingYear, meetingMonth, groupCollectionDay, 0, 0, 0, 0));
  
  // Handle months with fewer days (e.g., February 30 → February 28/29)
  if (dueDate.getUTCMonth() !== meetingMonth) {
    // If the collection day doesn't exist in this month, use the last day of the month
    dueDate = new Date(Date.UTC(meetingYear, meetingMonth + 1, 0, 0, 0, 0, 0)); // Last day of the month
  }
  
  return dueDate;
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

async function fixDueDatesCorrectly() {
  try {
    console.log('=== Fixing Due Dates Correctly ===');
    
    // Get the group
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
      console.log('No group found');
      return;
    }
    
    console.log('Group:', group.name);
    console.log('Collection Day:', group.collectionDayOfMonth);
    
    // Get all periods
    const periods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: group.id },
      orderBy: { meetingDate: 'asc' },
      include: {
        memberContributions: true
      }
    });
    
    let totalFixed = 0;
    
    for (const period of periods) {
      const meetingDate = period.meetingDate;
      const correctDueDate = calculateCorrectDueDate(group.collectionDayOfMonth, meetingDate);
      
      console.log(`\nPeriod: ${meetingDate.toISOString().substring(0, 7)}`);
      console.log(`  Meeting Date: ${meetingDate.toISOString()}`);
      console.log(`  Correct Due Date: ${correctDueDate.toISOString()}`);
      
      // Calculate late fine info for today
      const today = new Date();
      const daysLateToday = calculateDaysLate(correctDueDate, today);
      
      console.log(`  Days late as of today (${today.toISOString().substring(0, 10)}): ${daysLateToday}`);
      
      // Update all contributions for this period
      for (const contrib of period.memberContributions) {
        // Calculate late fine amount
        let lateFineAmount = 0;
        if (group.lateFineRules.length > 0 && group.lateFineRules[0].isEnabled && daysLateToday > 0) {
          const rule = group.lateFineRules[0];
          if (rule.ruleType === 'DAILY_FIXED') {
            lateFineAmount = (rule.dailyAmount || 0) * daysLateToday;
          } else if (rule.ruleType === 'DAILY_PERCENTAGE') {
            const dailyRate = (rule.dailyPercentage || 0) / 100;
            lateFineAmount = Math.round((contrib.compulsoryContributionDue * dailyRate * daysLateToday) * 100) / 100;
          }
        }
        
        // Calculate remaining amount
        const remainingAmount = Math.max(0, 
          (contrib.compulsoryContributionDue || 0) + 
          (contrib.loanInterestDue || 0) + 
          lateFineAmount - 
          (contrib.totalPaid || 0)
        );
        
        await prisma.memberContribution.update({
          where: { id: contrib.id },
          data: {
            dueDate: correctDueDate,
            daysLate: daysLateToday,
            lateFineAmount: lateFineAmount,
            remainingAmount: remainingAmount
          }
        });
        
        totalFixed++;
      }
    }
    
    console.log(`\n✅ Fixed ${totalFixed} contributions`);
    
    // Test the calculation
    console.log('\n=== Final Test ===');
    const june12 = new Date('2025-06-12T00:00:00.000Z');
    
    // June period should be due June 5th
    const juneDueDate = new Date(Date.UTC(2025, 5, 5)); // June 5th
    const juneDaysLate = calculateDaysLate(juneDueDate, june12);
    
    // July period should be due July 5th  
    const julyDueDate = new Date(Date.UTC(2025, 6, 5)); // July 5th
    const julyDaysLate = calculateDaysLate(julyDueDate, june12);
    
    console.log(`June period (due June 5th): ${juneDaysLate} days late on June 12th`);
    console.log(`July period (due July 5th): ${julyDaysLate} days late on June 12th`);
    console.log('✅ Expected: June=7 days late, July=0 days late');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDueDatesCorrectly();
