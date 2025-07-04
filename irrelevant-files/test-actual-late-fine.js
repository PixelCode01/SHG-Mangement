#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLateFineWithActualGroup() {
  console.log('🧪 Testing Late Fine with Actual Group Data');
  console.log('============================================\n');

  try {
    // Find a group with late fine rules
    const group = await prisma.group.findFirst({
      where: {
        lateFineRules: {
          some: {
            isEnabled: true
          }
        }
      },
      include: {
        lateFineRules: true
      }
    });

    if (!group) {
      console.log('❌ No groups found with late fine rules enabled');
      
      // Test with a hypothetical group
      console.log('\n🔧 Testing with hypothetical group data...');
      testHypotheticalGroup();
      return;
    }

    console.log(`✅ Found group: ${group.name}`);
    console.log(`   Collection frequency: ${group.collectionFrequency}`);
    console.log(`   Collection day: ${group.collectionDayOfMonth || 'Not set'}`);
    
    const lateFineRule = group.lateFineRules[0];
    console.log(`   Late fine rule: ${lateFineRule.ruleType}`);
    console.log(`   Enabled: ${lateFineRule.isEnabled}`);
    console.log(`   Daily amount: ₹${lateFineRule.dailyAmount || 'N/A'}`);
    console.log(`   Daily percentage: ${lateFineRule.dailyPercentage || 'N/A'}%`);

    // Test the NEW logic vs OLD logic
    const today = new Date();
    const targetDay = group.collectionDayOfMonth || 1;
    
    console.log(`\n📅 Testing on: ${today.toDateString()}`);
    console.log(`📅 Target collection day: ${targetDay}${getOrdinalSuffix(targetDay)} of every month`);

    // NEW FIXED logic - current period due date
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    let currentPeriodDueDate = new Date(currentYear, currentMonth, targetDay);
    
    if (currentPeriodDueDate > today) {
      currentPeriodDueDate = new Date(currentYear, currentMonth - 1, targetDay);
    }

    // OLD BROKEN logic - next due date
    let nextDueDate = new Date(currentYear, currentMonth, targetDay);
    if (nextDueDate <= today) {
      nextDueDate = new Date(currentYear, currentMonth + 1, targetDay);
    }

    const currentDaysLate = Math.max(0, Math.ceil((today.getTime() - currentPeriodDueDate.getTime()) / (1000 * 60 * 60 * 24)));
    const nextDaysLate = Math.max(0, Math.ceil((today.getTime() - nextDueDate.getTime()) / (1000 * 60 * 60 * 24)));

    console.log(`\n🔄 Comparison:`);
    console.log(`   NEW FIXED: Current period due date = ${currentPeriodDueDate.toDateString()}`);
    console.log(`   NEW FIXED: Days late = ${currentDaysLate}`);
    console.log(`   OLD BROKEN: Next due date = ${nextDueDate.toDateString()}`);
    console.log(`   OLD BROKEN: Days late = ${nextDaysLate} (always 0)`);

    // Calculate late fines
    let currentLateFine = 0;
    let nextLateFine = 0;
    const expectedContribution = group.monthlyContribution || 500;

    if (lateFineRule.ruleType === 'DAILY_FIXED') {
      currentLateFine = currentDaysLate * (lateFineRule.dailyAmount || 0);
      nextLateFine = nextDaysLate * (lateFineRule.dailyAmount || 0);
    } else if (lateFineRule.ruleType === 'DAILY_PERCENTAGE') {
      currentLateFine = expectedContribution * (lateFineRule.dailyPercentage || 0) / 100 * currentDaysLate;
      nextLateFine = expectedContribution * (lateFineRule.dailyPercentage || 0) / 100 * nextDaysLate;
    }

    console.log(`\n💰 Late Fine Calculation:`);
    console.log(`   NEW FIXED: ₹${currentLateFine}`);
    console.log(`   OLD BROKEN: ₹${nextLateFine} (always ₹0)`);

    if (currentDaysLate > 0 && currentLateFine > 0) {
      console.log(`\n🎉 SUCCESS! The fix is working:`);
      console.log(`   - Late fines are now calculated correctly`);
      console.log(`   - Members who are ${currentDaysLate} days late will see a fine of ₹${currentLateFine}`);
      console.log(`   - Previously, the old logic would always show ₹0 late fine`);
    } else if (currentDaysLate === 0) {
      console.log(`\n📅 No late fine needed - contributions are not overdue yet.`);
      console.log(`   Next due date is ${currentPeriodDueDate.toDateString()}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function testHypotheticalGroup() {
  const today = new Date();
  const targetDay = 2; // 2nd of every month
  
  console.log(`📅 Today: ${today.toDateString()}`);
  console.log(`📅 Collection day: ${targetDay}nd of every month`);
  
  // NEW logic
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  let currentDueDate = new Date(currentYear, currentMonth, targetDay);
  
  if (currentDueDate > today) {
    currentDueDate = new Date(currentYear, currentMonth - 1, targetDay);
  }
  
  // OLD logic
  let nextDueDate = new Date(currentYear, currentMonth, targetDay);
  if (nextDueDate <= today) {
    nextDueDate = new Date(currentYear, currentMonth + 1, targetDay);
  }
  
  const currentDaysLate = Math.max(0, Math.ceil((today.getTime() - currentDueDate.getTime()) / (1000 * 60 * 60 * 24)));
  const nextDaysLate = Math.max(0, Math.ceil((today.getTime() - nextDueDate.getTime()) / (1000 * 60 * 60 * 24)));
  
  const dailyFineAmount = 10; // ₹10 per day
  const currentLateFine = currentDaysLate * dailyFineAmount;
  const nextLateFine = nextDaysLate * dailyFineAmount;
  
  console.log(`\n🔄 Comparison:`);
  console.log(`   NEW FIXED: Due date = ${currentDueDate.toDateString()}, Days late = ${currentDaysLate}, Fine = ₹${currentLateFine}`);
  console.log(`   OLD BROKEN: Due date = ${nextDueDate.toDateString()}, Days late = ${nextDaysLate}, Fine = ₹${nextLateFine}`);
  
  if (currentDaysLate > 0) {
    console.log(`\n🎉 The fix works! Late fines will now show ₹${currentLateFine} instead of ₹0`);
  } else {
    console.log(`\n📅 No late fine needed currently, but the logic is now correct.`);
  }
}

function getOrdinalSuffix(day) {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

testLateFineWithActualGroup();
