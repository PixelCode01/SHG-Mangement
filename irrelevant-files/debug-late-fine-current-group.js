#!/usr/bin/env node

/**
 * Debug the specific group showing 0 late fines to identify the root cause
 * This will help us understand what's wrong with the current group
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugCurrentGroupLateFines() {
  try {
    console.log('🔍 DEBUGGING CURRENT GROUP LATE FINE ISSUE\n');
    
    // Find the group mentioned by user - "sa"
    const group = await prisma.group.findFirst({
      where: { 
        name: { contains: 'sa', mode: 'insensitive' } 
      },
      include: {
        lateFineRules: {
          include: {
            tierRules: {
              orderBy: { startDay: 'asc' }
            }
          }
        },
        groupPeriodicRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: { status: 'ACTIVE' }
                }
              }
            }
          }
        }
      }
    });
    
    if (!group) {
      console.log('❌ Group "sa" not found');
      
      // Show available groups
      const groups = await prisma.group.findMany({
        select: { id: true, name: true, createdAt: true }
      });
      console.log('\n📋 Available Groups:');
      groups.forEach(g => {
        console.log(`  - ${g.name} (${g.id})`);
      });
      
      return;
    }
    
    console.log(`📋 GROUP: ${group.name} (${group.id})`);
    console.log(`📅 Collection: ${group.collectionFrequency} on ${group.collectionDayOfMonth}th`);
    console.log(`💰 Monthly Contribution: ₹${group.monthlyContribution}`);
    console.log(`📊 Interest Rate: ${group.interestRate}%`);
    console.log(`👥 Members: ${group.memberships.length}`);
    
    // 1. LATE FINE CONFIGURATION ANALYSIS
    console.log('\n⚖️ LATE FINE CONFIGURATION ANALYSIS:');
    console.log('===================================');
    
    if (!group.lateFineRules || group.lateFineRules.length === 0) {
      console.log('❌ NO LATE FINE RULES FOUND!');
      console.log('   This is the root cause - the group has no late fine rules configured.');
      console.log('   Even though late fines show as "Active" in the UI, there are no actual rules.');
      return;
    }
    
    const lateFineRule = group.lateFineRules[0];
    console.log(`✅ Late Fine Rule Found:`);
    console.log(`   - Rule ID: ${lateFineRule.id}`);
    console.log(`   - Enabled: ${lateFineRule.isEnabled ? '✅' : '❌'}`);
    console.log(`   - Type: ${lateFineRule.ruleType}`);
    console.log(`   - Created: ${lateFineRule.createdAt}`);
    
    // Check rule type specific configuration
    if (lateFineRule.ruleType === 'DAILY_FIXED') {
      console.log(`   - Daily Amount: ₹${lateFineRule.dailyAmount || 0}`);
      if (!lateFineRule.dailyAmount || lateFineRule.dailyAmount <= 0) {
        console.log('   ❌ ISSUE: Daily amount is not configured or is 0!');
      }
    }
    
    if (lateFineRule.ruleType === 'DAILY_PERCENTAGE') {
      console.log(`   - Daily Percentage: ${lateFineRule.dailyPercentage || 0}%`);
      if (!lateFineRule.dailyPercentage || lateFineRule.dailyPercentage <= 0) {
        console.log('   ❌ ISSUE: Daily percentage is not configured or is 0!');
      }
    }
    
    if (lateFineRule.ruleType === 'TIER_BASED') {
      console.log(`   - Tier Rules Count: ${lateFineRule.tierRules.length}`);
      
      if (lateFineRule.tierRules.length === 0) {
        console.log('   ❌ ISSUE: TIER_BASED rule has no tier rules defined!');
        console.log('   This is the classic late fine bug - empty tier rules array');
      } else {
        console.log('   ✅ Tier Rules Configured:');
        lateFineRule.tierRules.forEach((tier, index) => {
          const endText = tier.endDay > 1000 ? '∞' : tier.endDay;
          console.log(`     ${index + 1}. Days ${tier.startDay}-${endText}: ₹${tier.amount}${tier.isPercentage ? '%' : ''} ${tier.isPercentage ? 'of contribution' : 'per day'}`);
        });
      }
    }
    
    // 2. CURRENT PERIOD ANALYSIS
    console.log('\n📅 CURRENT PERIOD ANALYSIS:');
    console.log('===========================');
    
    if (!group.groupPeriodicRecords || group.groupPeriodicRecords.length === 0) {
      console.log('❌ NO PERIODIC RECORDS FOUND!');
      console.log('   This could be another reason - no periodic records to calculate late fines for.');
      console.log('   The group may not have any active periods created yet.');
      
      // In this case, we should check if there's an active period concept
      // or if late fines are calculated based on creation date
      const currentDate = new Date();
      const groupCreationDate = new Date(group.createdAt);
      
      console.log(`   Group created: ${groupCreationDate.toDateString()}`);
      console.log(`   Current date: ${currentDate.toDateString()}`);
      
      // For groups without periodic records, late fines might be calculated
      // based on the group's collection schedule from creation date
      
    } else {
      const latestRecord = group.groupPeriodicRecords[0];
      console.log(`✅ Latest Periodic Record Found:`);
      console.log(`   - Record ID: ${latestRecord.id}`);
      console.log(`   - Meeting Date: ${latestRecord.meetingDate.toISOString()}`);
      console.log(`   - Created: ${latestRecord.createdAt.toISOString()}`);
      console.log(`   - Sequence Number: ${latestRecord.recordSequenceNumber || 'N/A'}`);
    }
    
    // 3. DUE DATE CALCULATION
    console.log('\n📆 DUE DATE CALCULATION:');
    console.log('========================');
    
    const today = new Date();
    console.log(`   Today: ${today.toDateString()}`);
    
    // Calculate the period due date based on collection schedule
    // For groups without periodic records, we calculate from group creation or current month
    let periodStartDate, dueDate;
    
    if (group.groupPeriodicRecords && group.groupPeriodicRecords.length > 0) {
      periodStartDate = new Date(group.groupPeriodicRecords[0].meetingDate);
    } else {
      // Use current month as the period
      periodStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    
    if (group.collectionFrequency === 'MONTHLY') {
      const targetDay = group.collectionDayOfMonth || 5;
      const periodMonth = today.getMonth(); // Use current month
      const periodYear = today.getFullYear();
      
      dueDate = new Date(periodYear, periodMonth, targetDay);
      
      // If the due date this month has already passed, we're late
      // If it hasn't come yet this month, use last month's due date
      if (dueDate > today) {
        dueDate = new Date(periodYear, periodMonth - 1, targetDay);
      }
    } else {
      dueDate = periodStartDate; // Fallback
    }
    
    console.log(`   Period Start: ${periodStartDate.toDateString()}`);
    console.log(`   Calculated Due Date: ${dueDate.toDateString()}`);
    
    // Calculate days late
    const timeDiff = today.getTime() - dueDate.getTime();
    const daysLate = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
    
    console.log(`   Days Late: ${daysLate}`);
    
    // 4. LATE FINE CALCULATION TEST
    console.log('\n💰 LATE FINE CALCULATION TEST:');
    console.log('==============================');
    
    const expectedContribution = group.monthlyContribution || 458;
    
    function calculateLateFine(lateFineRule, daysLate, expectedContribution) {
      if (!lateFineRule || !lateFineRule.isEnabled || daysLate <= 0) {
        return 0;
      }

      switch (lateFineRule.ruleType) {
        case 'DAILY_FIXED':
          return (lateFineRule.dailyAmount || 0) * daysLate;
        
        case 'DAILY_PERCENTAGE':
          const dailyRate = (lateFineRule.dailyPercentage || 0) / 100;
          return Math.round((expectedContribution * dailyRate * daysLate) * 100) / 100;
        
        case 'TIER_BASED':
          if (!lateFineRule.tierRules || lateFineRule.tierRules.length === 0) {
            return 0;
          }
          
          // Find the applicable tier
          for (const tier of lateFineRule.tierRules) {
            if (daysLate >= tier.startDay && daysLate <= tier.endDay) {
              if (tier.isPercentage) {
                return Math.round((expectedContribution * tier.amount / 100) * 100) / 100;
              } else {
                return tier.amount * daysLate;
              }
            }
          }
          return 0;
        
        default:
          return 0;
      }
    }
    
    const calculatedLateFine = calculateLateFine(lateFineRule, daysLate, expectedContribution);
    
    console.log(`   Expected Contribution: ₹${expectedContribution}`);
    console.log(`   Days Late: ${daysLate}`);
    console.log(`   Calculated Late Fine: ₹${calculatedLateFine}`);
    
    if (calculatedLateFine > 0) {
      console.log('   ✅ Late fine calculation should work!');
    } else {
      console.log('   ❌ Late fine calculation returns 0');
      
      if (!lateFineRule.isEnabled) {
        console.log('      Reason: Late fine rule is disabled');
      } else if (daysLate <= 0) {
        console.log('      Reason: No days late (not overdue)');
      } else if (lateFineRule.ruleType === 'TIER_BASED' && lateFineRule.tierRules.length === 0) {
        console.log('      Reason: TIER_BASED rule with no tier rules');
      } else if (lateFineRule.ruleType === 'DAILY_FIXED' && !lateFineRule.dailyAmount) {
        console.log('      Reason: DAILY_FIXED rule with no daily amount');
      } else if (lateFineRule.ruleType === 'DAILY_PERCENTAGE' && !lateFineRule.dailyPercentage) {
        console.log('      Reason: DAILY_PERCENTAGE rule with no daily percentage');
      } else {
        console.log('      Reason: Unknown issue');
      }
    }
    
    // 5. MEMBER LOAN ANALYSIS
    console.log('\n👥 MEMBER LOAN ANALYSIS:');
    console.log('=======================');
    
    let totalActiveLoans = 0;
    group.memberships.forEach((membership, index) => {
      const member = membership.member;
      const activeLoans = member.loans || [];
      const totalLoanBalance = activeLoans.reduce((sum, loan) => sum + loan.currentBalance, 0);
      
      if (index < 5) { // Show first 5 members
        console.log(`   ${index + 1}. ${member.name}: ₹${totalLoanBalance} active loans`);
      }
      
      totalActiveLoans += totalLoanBalance;
    });
    
    console.log(`   Total Active Loan Assets: ₹${totalActiveLoans}`);
    
    // 6. FRONTEND COMPARISON
    console.log('\n🖥️ FRONTEND VS BACKEND COMPARISON:');
    console.log('==================================');
    
    console.log('Based on the screenshot:');
    console.log('  - Late Fines showing: ₹0 (ISSUE)');
    console.log('  - Late Fines status: Active');
    console.log('  - Collection frequency: monthly on the 5th');
    console.log('  - Members: 15');
    console.log('  - All members showing ₹0 late fine');
    
    console.log('\nBackend calculation results:');
    console.log(`  - Late fine rule exists: ${group.lateFineRules.length > 0 ? 'Yes' : 'No'}`);
    console.log(`  - Rule enabled: ${lateFineRule?.isEnabled ? 'Yes' : 'No'}`);
    console.log(`  - Rule type: ${lateFineRule?.ruleType || 'None'}`);
    console.log(`  - Days late: ${daysLate}`);
    console.log(`  - Calculated late fine: ₹${calculatedLateFine}`);
    
    // 7. DIAGNOSIS
    console.log('\n🩺 DIAGNOSIS:');
    console.log('=============');
    
    if (!group.lateFineRules || group.lateFineRules.length === 0) {
      console.log('❌ ROOT CAUSE: No late fine rules configured');
      console.log('   SOLUTION: Create a late fine rule for this group');
    } else if (!lateFineRule.isEnabled) {
      console.log('❌ ROOT CAUSE: Late fine rule is disabled');
      console.log('   SOLUTION: Enable the late fine rule');
    } else if (lateFineRule.ruleType === 'TIER_BASED' && lateFineRule.tierRules.length === 0) {
      console.log('❌ ROOT CAUSE: TIER_BASED rule with no tier rules');
      console.log('   SOLUTION: Add tier rules to the late fine rule');
    } else if (lateFineRule.ruleType === 'DAILY_FIXED' && !lateFineRule.dailyAmount) {
      console.log('❌ ROOT CAUSE: DAILY_FIXED rule with no daily amount');
      console.log('   SOLUTION: Set the daily amount for the late fine rule');
    } else if (lateFineRule.ruleType === 'DAILY_PERCENTAGE' && !lateFineRule.dailyPercentage) {
      console.log('❌ ROOT CAUSE: DAILY_PERCENTAGE rule with no daily percentage');
      console.log('   SOLUTION: Set the daily percentage for the late fine rule');
    } else if (daysLate <= 0) {
      console.log('✅ ROOT CAUSE: Contributions are not overdue yet');
      console.log('   EXPLANATION: Late fines are 0 because due date has not passed');
    } else {
      console.log('✅ Late fine system appears to be working correctly');
      console.log(`   Expected late fine per member: ₹${calculatedLateFine}`);
    }
    
    console.log(`\n📋 GROUP URL: http://localhost:3000/groups/${group.id}/contributions`);
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function for calculating late fines (duplicate for testing)
function testLateFineCalculation(ruleType, ruleConfig, daysLate, contribution) {
  console.log(`\n🧪 Testing ${ruleType} calculation:`);
  console.log(`   Days late: ${daysLate}`);
  console.log(`   Contribution: ₹${contribution}`);
  console.log(`   Rule config:`, ruleConfig);
  
  // Test calculation scenarios
  const testScenarios = [0, 1, 5, 8, 15, 20, 30];
  
  testScenarios.forEach(days => {
    // Implementation would go here
    console.log(`   ${days} days: ₹0 (calculation needed)`);
  });
}

debugCurrentGroupLateFines();
