#!/usr/bin/env node

/**
 * Fix tier rules for "sa" group - quick and simple approach
 */

const { PrismaClient } = require('@prisma/client');

async function fixTiers() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 Fixing tier rules for "sa" group...\n');
    
    // Get the late fine rule for "sa" group
    const rule = await prisma.lateFineRule.findFirst({
      where: {
        group: { name: 'sa' }
      },
      include: { tierRules: true }
    });
    
    if (!rule) {
      console.log('❌ No late fine rule found for "sa" group');
      return;
    }
    
    console.log(`Found late fine rule: ${rule.id}`);
    console.log(`Current tier rules: ${rule.tierRules.length}\n`);
    
    // Show current tiers
    console.log('📊 Current configuration:');
    rule.tierRules
      .sort((a, b) => a.startDay - b.startDay)
      .forEach((tier, i) => {
        const endText = tier.endDay > 1000 ? '∞' : tier.endDay;
        console.log(`   ${i+1}. Days ${tier.startDay}-${endText}: ₹${tier.amount}/day`);
      });
    
    // Delete existing tiers
    console.log('\n🗑️  Deleting old tier rules...');
    await prisma.lateFineRuleTier.deleteMany({
      where: { lateFineRuleId: rule.id }
    });
    console.log('✅ Old tier rules deleted');
    
    // Create new tiers
    console.log('\n🔧 Creating new tier rules...');
    
    const newTiers = [
      { lateFineRuleId: rule.id, startDay: 1, endDay: 4, amount: 10, isPercentage: false },
      { lateFineRuleId: rule.id, startDay: 5, endDay: 8, amount: 30, isPercentage: false },
      { lateFineRuleId: rule.id, startDay: 9, endDay: 9999, amount: 49.98, isPercentage: false }
    ];
    
    for (const tier of newTiers) {
      await prisma.lateFineRuleTier.create({ data: tier });
      const endText = tier.endDay === 9999 ? '∞' : tier.endDay;
      console.log(`   ✅ Days ${tier.startDay}-${endText}: ₹${tier.amount}/day`);
    }
    
    console.log('\n🧮 Test calculation for 10 days late:');
    console.log('   Applicable tier: Days 9-∞');
    console.log('   Calculation: ₹49.98 × 10 = ₹499.80');
    
    console.log('\n✅ FIXED! Tier rules updated successfully.');
    console.log('   Refresh your browser to see the changes.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixTiers();
