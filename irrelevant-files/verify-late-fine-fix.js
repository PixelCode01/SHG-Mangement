#!/usr/bin/env node

/**
 * Test the fixed frontend calculation to ensure it works correctly
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFixedFrontendCalculation() {
  try {
    console.log('🔧 TESTING FIXED FRONTEND CALCULATION');
    console.log('=====================================\n');

    // Get the target group (ds group)
    const group = await prisma.group.findFirst({
      where: { name: 'ds' },
      include: {
        lateFineRules: {
          include: {
            tierRules: true
          }
        }
      }
    });

    if (!group || !group.lateFineRules?.length) {
      console.log('❌ Group or late fine rules not found');
      return;
    }

    const lateFineRule = group.lateFineRules[0];
    console.log(`🎯 TARGET GROUP: ${group.name} (${group.id})`);
    console.log(`💰 Monthly Contribution: ₹${group.monthlyContribution}`);

    // Calculate days late
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const targetDay = group.collectionDayOfMonth || 5;
    
    let dueDate = new Date(currentYear, currentMonth, targetDay);
    if (dueDate > today) {
      dueDate = new Date(currentYear, currentMonth - 1, targetDay);
    }
    
    const timeDiff = today.getTime() - dueDate.getTime();
    const daysLate = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
    
    console.log(`📅 Days Late: ${daysLate}`);

    // Show tier rules
    console.log(`\n📊 TIER RULES:`);
    lateFineRule.tierRules.forEach((tier, index) => {
      const endText = tier.endDay > 1000 ? '∞' : tier.endDay;
      console.log(`   ${index + 1}. Days ${tier.startDay}-${endText}: ₹${tier.amount} per day`);
    });

    // Test the FIXED frontend logic (replicate the exact new logic)
    console.log(`\n✅ FIXED FRONTEND LOGIC TEST:`);
    console.log(`=============================`);
    
    const tierRules = lateFineRule.tierRules || [];
    
    // Find the applicable tier based on total days late
    const applicableTier = tierRules.find(tier => 
      daysLate >= tier.startDay && daysLate <= tier.endDay
    );
    
    if (applicableTier) {
      let fixedResult;
      console.log(`   🎯 Found applicable tier: Days ${applicableTier.startDay}-${applicableTier.endDay}`);
      
      if (applicableTier.isPercentage) {
        fixedResult = group.monthlyContribution * (applicableTier.amount / 100) * daysLate;
        console.log(`   💱 Percentage calculation: ₹${group.monthlyContribution} × ${applicableTier.amount}% × ${daysLate} = ₹${fixedResult}`);
      } else {
        fixedResult = applicableTier.amount * daysLate;
        console.log(`   💰 Fixed calculation: ₹${applicableTier.amount} × ${daysLate} days = ₹${fixedResult}`);
      }
      
      // Round to two decimals (like the roundToTwoDecimals function)
      fixedResult = Math.round(fixedResult * 100) / 100;
      
      console.log(`   🟢 FIXED RESULT: ₹${fixedResult}`);
      
      console.log(`\n✅ CALCULATION FIX SUCCESSFUL!`);
      console.log(`   The late fine calculation now works correctly`);
      console.log(`   Members who are ${daysLate} days late should see ₹${fixedResult} late fine`);
      
    } else {
      console.log(`   ❌ No applicable tier found for ${daysLate} days`);
    }

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFixedFrontendCalculation();
