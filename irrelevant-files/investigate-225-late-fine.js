#!/usr/bin/env node

/**
 * Investigate the ₹225 late fine calculation discrepancy
 * Expected vs Actual calculation for 9 days
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigateLateFineCalculation() {
  console.log('🔍 INVESTIGATING ₹225 LATE FINE CALCULATION');
  console.log('User Configuration: Days 1-3: ₹15, Days 4-15: ₹25, Days 16+: ₹50');
  console.log('User Reported: ₹225.00 for 9 days');
  console.log('='.repeat(60));

  try {
    // Get the specific group
    const groupId = '684d600a7bd2e5d6ab668f17'; // Group "aa"
    
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        lateFineRules: {
          include: {
            tierRules: {
              orderBy: { startDay: 'asc' }
            }
          }
        }
      }
    });

    if (!group) {
      console.log('❌ Group not found');
      return;
    }

    console.log(`📋 Group: ${group.name} (ID: ${group.id})`);
    
    if (!group.lateFineRules || group.lateFineRules.length === 0) {
      console.log('❌ No late fine rules found');
      return;
    }

    const lateFineRule = group.lateFineRules[0];
    console.log(`\n📊 Late Fine Rule: ${lateFineRule.ruleType} (enabled: ${lateFineRule.isEnabled})`);
    
    if (lateFineRule.ruleType !== 'TIER_BASED') {
      console.log('❌ Not a tier-based rule');
      return;
    }

    console.log('\n📋 Tier Rules in Database:');
    lateFineRule.tierRules.forEach((tier, index) => {
      console.log(`   ${index + 1}. Days ${tier.startDay}-${tier.endDay === 9999 ? '∞' : tier.endDay}: ₹${tier.amount}${tier.isPercentage ? '%' : ''}`);
    });

    // Calculate late fine for 9 days using the CORRECT algorithm
    console.log('\n🔢 CORRECT CALCULATION for 9 days:');
    let totalFineCorrect = 0;
    const dailyBreakdown = [];
    
    for (let day = 1; day <= 9; day++) {
      const applicableTier = lateFineRule.tierRules.find(tier => day >= tier.startDay && day <= tier.endDay);
      if (applicableTier) {
        totalFineCorrect += applicableTier.amount;
        dailyBreakdown.push(`Day ${day}: ₹${applicableTier.amount} (Tier: ${applicableTier.startDay}-${applicableTier.endDay === 9999 ? '∞' : applicableTier.endDay})`);
      }
    }
    
    console.log('   Daily breakdown:');
    dailyBreakdown.forEach(line => console.log(`     ${line}`));
    
    console.log(`\n   Days 1-3 (3 days × ₹15): ₹${3 * 15} = ₹45`);
    console.log(`   Days 4-9 (6 days × ₹25): ₹${6 * 25} = ₹150`);
    console.log(`   ✅ EXPECTED TOTAL: ₹${45 + 150} = ₹195`);
    console.log(`   🔍 ACTUAL TOTAL (calculated): ₹${totalFineCorrect}`);
    
    if (totalFineCorrect === 195) {
      console.log('   ✅ Calculation is CORRECT according to tier rules');
    } else {
      console.log('   ❌ Calculation MISMATCH!');
    }

    // Now let's investigate where ₹225 could come from
    console.log('\n🕵️ INVESTIGATING WHERE ₹225 COMES FROM:');
    
    // Possibility 1: Different tier structure
    console.log('\n   Theory 1: Different tier amounts');
    console.log('   If it were ₹25 for all 9 days: 9 × ₹25 = ₹225 ✅');
    console.log('   This suggests the system might be using ₹25/day for all days instead of tiered rates');
    
    // Possibility 2: Wrong tier boundaries
    console.log('\n   Theory 2: Wrong tier boundaries');
    console.log('   If Days 1-9 were all in the ₹25 tier: 9 × ₹25 = ₹225 ✅');
    
    // Let's check if there are any other late fine rules or calculation issues
    console.log('\n🔍 CHECKING FOR CALCULATION ISSUES:');
    
    // Test different scenarios
    const testScenarios = [
      { days: 1, expected: 15 },
      { days: 3, expected: 45 },  // 3 × 15
      { days: 4, expected: 70 },  // 3 × 15 + 1 × 25
      { days: 9, expected: 195 }, // 3 × 15 + 6 × 25
      { days: 15, expected: 345 }, // 3 × 15 + 12 × 25
      { days: 16, expected: 395 }, // 3 × 15 + 12 × 25 + 1 × 50
    ];
    
    console.log('\n   Test calculations:');
    testScenarios.forEach(scenario => {
      let total = 0;
      for (let day = 1; day <= scenario.days; day++) {
        const tier = lateFineRule.tierRules.find(t => day >= t.startDay && day <= t.endDay);
        if (tier) total += tier.amount;
      }
      
      const status = total === scenario.expected ? '✅' : '❌';
      console.log(`     ${scenario.days} days: Expected ₹${scenario.expected}, Calculated ₹${total} ${status}`);
      
      if (total === 225 && scenario.days === 9) {
        console.log('       🎯 FOUND MATCH! This calculation gives ₹225');
      }
    });

    // Check for any late fine calculation functions in the codebase
    console.log('\n🔍 NEXT STEPS TO INVESTIGATE:');
    console.log('1. Check where late fine calculations are performed in the application');
    console.log('2. Look for any late fine display logic that might use wrong tier rules');
    console.log('3. Verify that the frontend is reading the correct tier rules from the API');
    console.log('4. Check if there are any caching issues with late fine calculations');
    
    console.log(`\n🌐 BROWSER TESTS:`);
    console.log(`   Edit form: http://localhost:3000/groups/${group.id}/edit`);
    console.log(`   Group view: http://localhost:3000/groups/${group.id}`);
    console.log('   Check the browser console for any calculation logs');

  } catch (error) {
    console.error('❌ Error investigating late fine calculation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateLateFineCalculation();
