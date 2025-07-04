#!/usr/bin/env node

// Test current database state to understand the late fine display issue

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeLateFineIssue() {
  try {
    console.log('=== Analyzing Late Fine Display Issue ===');
    
    // Find the group with collection day 5th (assuming it's the "kn" group)
    const group = await prisma.group.findFirst({
      where: {
        collectionDayOfMonth: 5
      },
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
    
    console.log('Found Group:', {
      id: group.id,
      name: group.name,
      collectionFrequency: group.collectionFrequency,
      collectionDayOfMonth: group.collectionDayOfMonth,
      lateFineEnabled: group.lateFineRules.length > 0 && group.lateFineRules[0]?.isEnabled
    });
    
    // Get the current (most recent) period
    const currentPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId: group.id },
      orderBy: { meetingDate: 'desc' },
      include: {
        memberContributions: {
          include: {
            member: { select: { name: true } }
          }
        }
      }
    });
    
    if (!currentPeriod) {
      console.log('No current period found');
      return;
    }
    
    console.log('\nCurrent Period:', {
      id: currentPeriod.id,
      meetingDate: currentPeriod.meetingDate.toISOString(),
      createdAt: currentPeriod.createdAt.toISOString(),
      isClosed: currentPeriod.isClosed,
      month: currentPeriod.meetingDate.toISOString().substring(0, 7)
    });
    
    // Get previous period to understand if this is a transition issue
    const previousPeriod = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: group.id },
      orderBy: { meetingDate: 'desc' },
      take: 2
    });
    
    if (previousPeriod.length > 1) {
      console.log('\nPrevious Period:', {
        id: previousPeriod[1].id,
        meetingDate: previousPeriod[1].meetingDate.toISOString(),
        isClosed: previousPeriod[1].isClosed,
        month: previousPeriod[1].meetingDate.toISOString().substring(0, 7)
      });
    }
    
    // Analyze member contributions with late fine issues
    console.log('\n=== Member Contributions Analysis ===');
    currentPeriod.memberContributions.forEach((contrib, index) => {
      console.log(`\nMember ${index + 1}: ${contrib.member.name}`);
      console.log(`  - Status: ${contrib.status}`);
      console.log(`  - Due Date: ${contrib.dueDate?.toISOString() || 'Not set'}`);
      console.log(`  - Days Late: ${contrib.daysLate || 0}`);
      console.log(`  - Late Fine Amount: ₹${contrib.lateFineAmount || 0}`);
      console.log(`  - Expected Contribution: ₹${contrib.compulsoryContributionDue || 0}`);
      console.log(`  - Total Paid: ₹${contrib.totalPaid || 0}`);
      console.log(`  - Remaining: ₹${contrib.remainingAmount || 0}`);
      
      // Calculate what the days late SHOULD be for today
      if (contrib.dueDate) {
        const today = new Date();
        const dueDateUTC = new Date(Date.UTC(contrib.dueDate.getUTCFullYear(), contrib.dueDate.getUTCMonth(), contrib.dueDate.getUTCDate()));
        const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        
        const timeDiff = todayUTC.getTime() - dueDateUTC.getTime();
        const calculatedDaysLate = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
        
        console.log(`  - Today: ${today.toISOString()}`);
        console.log(`  - Due Date UTC: ${dueDateUTC.toISOString()}`);
        console.log(`  - Today UTC: ${todayUTC.toISOString()}`);
        console.log(`  - CALCULATED Days Late: ${calculatedDaysLate}`);
        console.log(`  - STORED Days Late: ${contrib.daysLate || 0}`);
        console.log(`  - MATCH: ${calculatedDaysLate === (contrib.daysLate || 0) ? 'YES' : 'NO'}`);
      }
    });
    
    // Test period due date calculation
    console.log('\n=== Period Due Date Calculation Test ===');
    
    // Test for current period
    const periodMonth = currentPeriod.meetingDate.getUTCMonth();
    const periodYear = currentPeriod.meetingDate.getUTCFullYear();
    const expectedDueDate = new Date(Date.UTC(periodYear, periodMonth, group.collectionDayOfMonth));
    
    console.log(`Period date: ${currentPeriod.meetingDate.toISOString()}`);
    console.log(`Expected due date: ${expectedDueDate.toISOString()}`);
    console.log(`Collection day: ${group.collectionDayOfMonth}`);
    
    // Today's calculation
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const timeDiff = todayUTC.getTime() - expectedDueDate.getTime();
    const shouldBeDaysLate = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
    
    console.log(`Today: ${today.toISOString()}`);
    console.log(`Today UTC: ${todayUTC.toISOString()}`);
    console.log(`Days late should be: ${shouldBeDaysLate}`);
    
  } catch (error) {
    console.error('Error analyzing late fine issue:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeLateFineIssue();
