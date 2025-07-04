#!/usr/bin/env node

// Check the June period specifically to understand the "8 days overdue" issue

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkJunePeriod() {
  try {
    console.log('=== Checking June Period Details ===');
    
    // Find the June period (previous period)
    const junePeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { 
        groupId: '68499d8a8ebb724c0ebedf0d',
        meetingDate: {
          gte: new Date('2025-06-01'),
          lt: new Date('2025-07-01')
        }
      },
      include: {
        memberContributions: {
          take: 3, // Just a few examples
          include: {
            member: { select: { name: true } }
          }
        }
      }
    });
    
    if (!junePeriod) {
      console.log('No June period found');
      return;
    }
    
    console.log('June Period Details:', {
      id: junePeriod.id,
      meetingDate: junePeriod.meetingDate.toISOString(),
      createdAt: junePeriod.createdAt.toISOString(),
      isClosed: junePeriod.isClosed
    });
    
    console.log('\n=== June Member Contributions (Sample) ===');
    junePeriod.memberContributions.forEach((contrib, index) => {
      console.log(`\nMember ${index + 1}: ${contrib.member.name}`);
      console.log(`  - Status: ${contrib.status}`);
      console.log(`  - Due Date: ${contrib.dueDate?.toISOString() || 'Not set'}`);
      console.log(`  - Days Late: ${contrib.daysLate || 0}`);
      console.log(`  - Late Fine Amount: ₹${contrib.lateFineAmount || 0}`);
      console.log(`  - Total Paid: ₹${contrib.totalPaid || 0}`);
      
      // Calculate what days late should be for June 12th
      if (contrib.dueDate) {
        const june12 = new Date('2025-06-12T00:00:00.000Z');
        const dueDateUTC = new Date(Date.UTC(contrib.dueDate.getUTCFullYear(), contrib.dueDate.getUTCMonth(), contrib.dueDate.getUTCDate()));
        
        const timeDiff = june12.getTime() - dueDateUTC.getTime();
        const calculatedDaysLate = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
        
        console.log(`  - Due Date UTC: ${dueDateUTC.toISOString()}`);
        console.log(`  - June 12 calculation: ${calculatedDaysLate} days late`);
        console.log(`  - Expected for collection day 5th: Should be 7 days late (June 6-12)`);
        
        // The issue might be that due date is set to June 4th instead of June 5th
        if (dueDateUTC.getUTCDate() === 4) {
          console.log(`  - ❌ PROBLEM: Due date is June 4th, should be June 5th!`);
          console.log(`  - This would cause 8 days late (June 5-12) instead of 7`);
        } else if (dueDateUTC.getUTCDate() === 5) {
          console.log(`  - ✅ Due date is correct (June 5th)`);
          console.log(`  - Days late should be 7, not 8`);
        }
      }
    });
    
    // Check if there are any contributions with the "8 days overdue" issue
    const allJuneContributions = await prisma.memberContribution.findMany({
      where: { 
        groupPeriodicRecordId: junePeriod.id,
        daysLate: { gte: 8 }
      },
      include: {
        member: { select: { name: true } }
      }
    });
    
    console.log(`\n=== Members with 8+ Days Late in June ===`);
    console.log(`Found ${allJuneContributions.length} members with 8+ days late`);
    
    allJuneContributions.forEach((contrib, index) => {
      console.log(`\nMember ${index + 1}: ${contrib.member.name}`);
      console.log(`  - Days Late: ${contrib.daysLate}`);
      console.log(`  - Due Date: ${contrib.dueDate?.toISOString()}`);
      console.log(`  - Late Fine: ₹${contrib.lateFineAmount || 0}`);
    });
    
  } catch (error) {
    console.error('Error checking June period:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkJunePeriod();
