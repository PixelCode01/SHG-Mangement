#!/usr/bin/env node

/**
 * Debug the specific frontend late fine calculation logic
 * Tests the TIER_BASED calculation that should be generating ₹90 but shows ₹0
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugFrontendLateFineCalculation() {
  try {
    console.log('🔍 DEBUGGING FRONTEND LATE FINE CALCULATION\n');
    
    // Get the target group (ds with 15 members, monthly on 5th)
    const group = await prisma.group.findFirst({
      where: {
        memberships: { some: {} },
        collectionDayOfMonth: 5,
        collectionFrequency: 'MONTHLY'
      },
      include: {
        lateFineRules: {
          include: {
            tierRules: {
              orderBy: { startDay: 'asc' }
            }
          }
        },
        memberships: {
          include: {
            member: true
          }
        }
      }
    });
    
    if (!group) {
      console.log('❌ Target group not found');
      return;
    }
    
    console.log(`🎯 TARGET GROUP: ${group.name} (${group.id})`);
    console.log(`📊 Members: ${group.memberships.length}`);
    console.log(`📅 Collection: ${group.collectionFrequency} on ${group.collectionDayOfMonth}th`);
    console.log(`💰 Monthly Contribution: ₹${group.monthlyContribution}`);
    
    const lateFineRule = group.lateFineRules[0];
    console.log(`\n⚖️ LATE FINE RULE:`);
    console.log(`   Type: ${lateFineRule.ruleType}`);
    console.log(`   Enabled: ${lateFineRule.isEnabled}`);
    console.log(`   Tier Rules: ${lateFineRule.tierRules.length}`);
    
    // Show tier rules
    console.log(`\n📊 TIER RULES:`);
    lateFineRule.tierRules.forEach((tier, index) => {
      const endText = tier.endDay > 1000 ? '∞' : tier.endDay;
      console.log(`   ${index + 1}. Days ${tier.startDay}-${endText}: ₹${tier.amount}${tier.isPercentage ? '%' : ''} ${tier.isPercentage ? 'of contribution' : 'per day'}`);
    });
    
    // Calculate current due date and days late
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const targetDay = group.collectionDayOfMonth;
    
    let dueDate = new Date(currentYear, currentMonth, targetDay);
    if (dueDate > today) {
      dueDate = new Date(currentYear, currentMonth - 1, targetDay);
    }
    
    const timeDiff = today.getTime() - dueDate.getTime();
    const daysLate = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
    
    console.log(`\n📆 DATE CALCULATION:`);
    console.log(`   Today: ${today.toDateString()}`);
    console.log(`   Due Date: ${dueDate.toDateString()}`);
    console.log(`   Days Late: ${daysLate}`);
    
    // Test the FRONTEND calculation logic (replicate exactly)
    console.log(`\n🧮 FRONTEND CALCULATION TEST:`);
    console.log(`===============================`);
    
    const expectedContribution = group.monthlyContribution || 458;
    
    // This is the exact logic from the frontend
    function calculateLateFine_Frontend(lateFineRule, daysLate, expectedContribution) {
      if (!lateFineRule || !lateFineRule.isEnabled || daysLate <= 0) {
        console.log('   ❌ Early exit: rule disabled or not late');
        return 0;
      }

      switch (lateFineRule.ruleType) {
        case 'TIER_BASED':
          let totalFine = 0;
          const tierRules = lateFineRule.tierRules || [];
          
          console.log(`   🔍 Processing TIER_BASED with ${tierRules.length} tiers:`);
          
          for (const tier of tierRules) {
            console.log(`   📋 Checking tier: Days ${tier.startDay}-${tier.endDay}, Amount: ₹${tier.amount}, Percentage: ${tier.isPercentage}`);
            
            if (daysLate >= tier.startDay) {
              const daysInTier = Math.min(daysLate, tier.endDay) - tier.startDay + 1;
              console.log(`   📏 Days in tier: min(${daysLate}, ${tier.endDay}) - ${tier.startDay} + 1 = ${daysInTier}`);
              
              if (tier.isPercentage) {
                const tierFine = expectedContribution * (tier.amount / 100) * daysInTier;
                console.log(`   💱 Percentage calculation: ₹${expectedContribution} × ${tier.amount}% × ${daysInTier} = ₹${tierFine}`);
                totalFine += tierFine;
              } else {
                const tierFine = tier.amount * daysInTier;
                console.log(`   💰 Fixed calculation: ₹${tier.amount} × ${daysInTier} = ₹${tierFine}`);
                totalFine += tierFine;
              }
              
              console.log(`   🏃 Running total: ₹${totalFine}`);
            } else {
              console.log(`   ⏭️ Skip tier: ${daysLate} < ${tier.startDay}`);
            }
          }
          
          console.log(`   ✅ Final TIER_BASED result: ₹${totalFine}`);
          return totalFine;
        
        default:
          console.log(`   ❌ Unknown rule type: ${lateFineRule.ruleType}`);
          return 0;
      }
    }
    
    // Test the calculation
    const frontendResult = calculateLateFine_Frontend(lateFineRule, daysLate, expectedContribution);
    
    console.log(`\n📊 CALCULATION RESULTS:`);
    console.log(`   Expected Contribution: ₹${expectedContribution}`);
    console.log(`   Days Late: ${daysLate}`);
    console.log(`   Frontend Result: ₹${frontendResult}`);
    console.log(`   Expected (from backend): ₹90`);
    
    if (frontendResult === 0) {
      console.log(`\n❌ ISSUE CONFIRMED: Frontend calculation returns ₹0`);
      
      // Additional debugging
      console.log(`\n🔍 DEBUGGING TIER LOGIC:`);
      console.log(`================================`);
      
      lateFineRule.tierRules.forEach((tier, index) => {
        console.log(`\nTier ${index + 1}:`);
        console.log(`   startDay: ${tier.startDay} (type: ${typeof tier.startDay})`);
        console.log(`   endDay: ${tier.endDay} (type: ${typeof tier.endDay})`);
        console.log(`   amount: ${tier.amount} (type: ${typeof tier.amount})`);
        console.log(`   isPercentage: ${tier.isPercentage} (type: ${typeof tier.isPercentage})`);
        
        console.log(`   Condition: ${daysLate} >= ${tier.startDay} = ${daysLate >= tier.startDay}`);
        
        if (daysLate >= tier.startDay) {
          const daysInTier = Math.min(daysLate, tier.endDay) - tier.startDay + 1;
          console.log(`   Days in tier: ${daysInTier}`);
          
          if (daysInTier > 0) {
            if (tier.isPercentage) {
              const fine = expectedContribution * (tier.amount / 100) * daysInTier;
              console.log(`   Percentage fine: ${expectedContribution} * ${tier.amount}/100 * ${daysInTier} = ₹${fine}`);
            } else {
              const fine = tier.amount * daysInTier;
              console.log(`   Fixed fine: ${tier.amount} * ${daysInTier} = ₹${fine}`);
            }
          }
        }
      });
      
    } else if (frontendResult !== 90) {
      console.log(`\n⚠️ CALCULATION MISMATCH: Frontend=₹${frontendResult}, Expected=₹90`);
    } else {
      console.log(`\n✅ FRONTEND CALCULATION IS CORRECT`);
      console.log(`   The issue might be elsewhere (data loading, state management, etc.)`);
    }
    
    // Test a simpler manual calculation
    console.log(`\n🧪 MANUAL VERIFICATION:`);
    console.log(`======================`);
    
    // Manual calculation based on the tier rules we found
    console.log(`Manual calculation for ${daysLate} days late:`);
    let manualTotal = 0;
    
    for (const tier of lateFineRule.tierRules) {
      if (daysLate >= tier.startDay && daysLate <= tier.endDay) {
        if (tier.isPercentage) {
          const fine = expectedContribution * (tier.amount / 100);
          console.log(`  Tier ${tier.startDay}-${tier.endDay}: ₹${expectedContribution} × ${tier.amount}% = ₹${fine}`);
          manualTotal += fine;
        } else {
          const fine = tier.amount * daysLate;
          console.log(`  Tier ${tier.startDay}-${tier.endDay}: ₹${tier.amount} × ${daysLate} = ₹${fine}`);
          manualTotal += fine;
        }
        break; // Only first matching tier for this simpler calculation
      }
    }
    
    console.log(`Manual total: ₹${manualTotal}`);
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugFrontendLateFineCalculation();
