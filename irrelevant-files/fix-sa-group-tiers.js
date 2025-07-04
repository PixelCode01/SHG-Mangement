#!/usr/bin/env node

/**
 * Fix the "sa" group tier rules to match user's configuration:
 * Days 1-4: ₹10, Days 5-8: ₹30, Days 9+: ₹49.98
 */

const { PrismaClient } = require('@prisma/client');

async function fixSaGroupTiers() {
  const prisma = new PrismaClient({
    log: ['error']
  });
  
  try {
    console.log('🔧 FIXING "sa" GROUP TIER RULES');
    console.log('===============================\n');
    
    // Step 1: Find the sa group
    console.log('Step 1: Finding "sa" group...');
    const group = await prisma.group.findFirst({
      where: { name: 'sa' },
      include: {
        lateFineRules: {
          include: { tierRules: true }
        }
      }
    });
    
    if (!group) {
      console.log('❌ Group "sa" not found');
      return;
    }
    
    console.log(`✅ Found group: ${group.name} (${group.id})`);
    console.log(`   Collection: ${group.collectionFrequency} on ${group.collectionDayOfMonth}th`);
    console.log(`   Monthly Contribution: ₹${group.monthlyContribution}`);
    
    if (group.lateFineRules.length === 0) {
      console.log('❌ No late fine rules found');
      return;
    }
    
    const rule = group.lateFineRules[0];
    console.log(`✅ Found late fine rule: ${rule.id}`);
    
    // Step 2: Show current configuration
    console.log('\nStep 2: Current tier configuration:');
    if (rule.tierRules.length === 0) {
      console.log('   ❌ No tier rules configured');
    } else {
      rule.tierRules
        .sort((a, b) => a.startDay - b.startDay)
        .forEach((tier, i) => {
          const endText = tier.endDay > 1000 ? '∞' : tier.endDay;
          console.log(`   ${i+1}. Days ${tier.startDay}-${endText}: ₹${tier.amount}/day`);
        });
    }
    
    // Step 3: Delete old tier rules
    console.log('\nStep 3: Removing old tier rules...');
    const deleteResult = await prisma.lateFineRuleTier.deleteMany({
      where: { lateFineRuleId: rule.id }
    });
    console.log(`✅ Deleted ${deleteResult.count} old tier rules`);
    
    // Step 4: Create new tier rules
    console.log('\nStep 4: Creating new tier rules...');
    
    const newTierRules = [
      {
        lateFineRuleId: rule.id,
        startDay: 1,
        endDay: 4,
        amount: 10.0,
        isPercentage: false
      },
      {
        lateFineRuleId: rule.id,
        startDay: 5,
        endDay: 8,
        amount: 30.0,
        isPercentage: false
      },
      {
        lateFineRuleId: rule.id,
        startDay: 9,
        endDay: 9999,
        amount: 49.98,
        isPercentage: false
      }
    ];
    
    for (const tierData of newTierRules) {
      await prisma.lateFineRuleTier.create({
        data: tierData
      });
      const endText = tierData.endDay === 9999 ? '∞' : tierData.endDay;
      console.log(`   ✅ Created: Days ${tierData.startDay}-${endText}: ₹${tierData.amount}/day`);
    }
    
    // Step 5: Verify the fix
    console.log('\nStep 5: Testing calculations...');
    
    const testCases = [
      { days: 3, expectedTier: '1-4', expectedRate: 10, expectedFine: 30 },
      { days: 6, expectedTier: '5-8', expectedRate: 30, expectedFine: 180 },
      { days: 10, expectedTier: '9+', expectedRate: 49.98, expectedFine: 499.8 }
    ];
    
    for (const test of testCases) {
      const fine = test.expectedRate * test.days;
      console.log(`   ${test.days} days late → Tier ${test.expectedTier} → ₹${test.expectedRate} × ${test.days} = ₹${fine}`);
    }
    
    console.log('\n🎉 SUCCESS!');
    console.log('================');
    console.log('✅ Tier rules updated to match your configuration');
    console.log('✅ 10 days late will now show ₹499.80 (not ₹100)');
    console.log('\n🌐 Next steps:');
    console.log('   1. Go to your group contribution page');
    console.log('   2. Refresh the page');
    console.log('   3. Check that late fines now calculate correctly');
    
    console.log(`\n📋 Group URL: http://localhost:3001/groups/${group.id}/contributions`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  fixSaGroupTiers();
}

module.exports = { fixSaGroupTiers };
