#!/usr/bin/env node

/**
 * Add comprehensive logs to validate the frontend calculation bug analysis
 * This script will add debug logs to confirm the exact issue before implementing the fix
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function validateFrontendCalculationBug() {
  try {
    console.log('🔍 VALIDATING FRONTEND CALCULATION BUG ANALYSIS');
    console.log('=================================================\n');

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
    console.log(`📊 Collection: ${group.collectionFrequency} on ${group.collectionDayOfMonth}th`);
    console.log(`💰 Monthly Contribution: ₹${group.monthlyContribution}`);
    console.log(`⚖️ Late Fine Rule: ${lateFineRule.ruleType} (${lateFineRule.isEnabled ? 'ENABLED' : 'DISABLED'})`);

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
    
    console.log(`\n📅 DATE CALCULATION:`);
    console.log(`   Today: ${today.toDateString()}`);
    console.log(`   Due Date: ${dueDate.toDateString()}`);
    console.log(`   Days Late: ${daysLate}`);

    // Show tier rules
    console.log(`\n📊 TIER RULES (${lateFineRule.tierRules.length} configured):`);
    lateFineRule.tierRules.forEach((tier, index) => {
      const endText = tier.endDay > 1000 ? '∞' : tier.endDay;
      console.log(`   ${index + 1}. Days ${tier.startDay}-${endText}: ₹${tier.amount} per day`);
    });

    // Test the CURRENT (incorrect) frontend logic
    console.log(`\n🚫 CURRENT (INCORRECT) FRONTEND LOGIC:`);
    console.log(`======================================`);
    let totalFine_Current = 0;
    const tierRules = lateFineRule.tierRules || [];
    
    for (const tier of tierRules) {
      console.log(`\n   📋 Processing tier: Days ${tier.startDay}-${tier.endDay}, Amount: ₹${tier.amount}`);
      
      if (daysLate >= tier.startDay) {
        const daysInTier = Math.min(daysLate, tier.endDay) - tier.startDay + 1;
        console.log(`      ✅ Condition met: ${daysLate} >= ${tier.startDay}`);
        console.log(`      📏 Days in tier: min(${daysLate}, ${tier.endDay}) - ${tier.startDay} + 1 = ${daysInTier}`);
        
        const tierFine = tier.amount * daysInTier;
        console.log(`      💰 Tier fine: ₹${tier.amount} × ${daysInTier} = ₹${tierFine}`);
        
        totalFine_Current += tierFine;
        console.log(`      🏃 Running total: ₹${totalFine_Current}`);
      } else {
        console.log(`      ❌ Condition failed: ${daysLate} < ${tier.startDay}`);
      }
    }
    
    console.log(`\n   🔴 CURRENT RESULT: ₹${totalFine_Current}`);

    // Test the CORRECT logic
    console.log(`\n✅ CORRECT LOGIC:`);
    console.log(`=================`);
    
    const applicableTier = tierRules.find(tier => 
      daysLate >= tier.startDay && daysLate <= tier.endDay
    );
    
    if (applicableTier) {
      const correctFine = applicableTier.amount * daysLate;
      console.log(`   🎯 Found applicable tier: Days ${applicableTier.startDay}-${applicableTier.endDay}`);
      console.log(`   💰 Correct calculation: ₹${applicableTier.amount} × ${daysLate} days = ₹${correctFine}`);
      console.log(`   🟢 CORRECT RESULT: ₹${correctFine}`);
      
      // Show the difference
      console.log(`\n📊 COMPARISON:`);
      console.log(`   Current (incorrect): ₹${totalFine_Current}`);
      console.log(`   Correct: ₹${correctFine}`);
      console.log(`   Difference: ₹${correctFine - totalFine_Current}`);
      
      if (totalFine_Current !== correctFine) {
        console.log(`\n🚨 BUG CONFIRMED!`);
        console.log(`   The frontend is using a cumulative tier calculation`);
        console.log(`   when it should be using a single-tier calculation`);
        
        console.log(`\n🔧 FIX NEEDED:`);
        console.log(`   Replace the cumulative tier loop with a single-tier lookup`);
      } else {
        console.log(`\n✅ No bug found - calculations match`);
      }
    } else {
      console.log(`   ❌ No applicable tier found for ${daysLate} days`);
    }

  } catch (error) {
    console.error('❌ Error during validation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

validateFrontendCalculationBug();
