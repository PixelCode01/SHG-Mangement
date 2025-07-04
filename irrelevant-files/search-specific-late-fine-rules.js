#!/usr/bin/env node

/**
 * Search for late fine rules that match the user's expected values
 * Looking for: Days 1-5: ₹15, Days 6-15: ₹25, Days 16+: ₹50
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function searchForSpecificLateFineRules() {
  console.log('🔍 SEARCHING FOR SPECIFIC LATE FINE CONFIGURATION');
  console.log('Expected: Days 1-5: ₹15, Days 6-15: ₹25, Days 16+: ₹50');
  console.log('='.repeat(60));

  try {
    // Search for tier rules with amounts 15, 25, or 50
    const tierRulesWithExpectedAmounts = await prisma.lateFineRuleTier.findMany({
      where: {
        OR: [
          { amount: 15 },
          { amount: 25 },
          { amount: 50 }
        ]
      },
      include: {
        lateFineRule: {
          include: {
            group: true,
            tierRules: true
          }
        }
      }
    });

    console.log(`\n✅ Found ${tierRulesWithExpectedAmounts.length} tier rules with amounts 15, 25, or 50`);

    if (tierRulesWithExpectedAmounts.length === 0) {
      console.log('❌ No tier rules found with the expected amounts');
      
      // Let's see what amounts actually exist
      console.log('\n📊 Let me check what tier rule amounts actually exist in the database:');
      
      const allTierRules = await prisma.lateFineRuleTier.findMany({
        include: {
          lateFineRule: {
            include: {
              group: true
            }
          }
        },
        orderBy: {
          amount: 'asc'
        }
      });

      console.log(`\n📋 All tier rule amounts in database (${allTierRules.length} total):`);
      const uniqueAmounts = [...new Set(allTierRules.map(rule => rule.amount))].sort((a, b) => a - b);
      console.log('Amounts found:', uniqueAmounts.join(', '));

      // Group by late fine rule to show complete tier structures
      const ruleGroups = {};
      allTierRules.forEach(tier => {
        const ruleId = tier.lateFineRule.id;
        if (!ruleGroups[ruleId]) {
          ruleGroups[ruleId] = {
            group: tier.lateFineRule.group,
            tierRules: []
          };
        }
        ruleGroups[ruleId].tierRules.push(tier);
      });

      console.log('\n📋 Complete tier rule structures:');
      Object.values(ruleGroups).forEach((ruleGroup, index) => {
        console.log(`\n${index + 1}. Group: ${ruleGroup.group.name} (ID: ${ruleGroup.group.id})`);
        ruleGroup.tierRules
          .sort((a, b) => a.startDay - b.startDay)
          .forEach(tier => {
            console.log(`   Days ${tier.startDay}-${tier.endDay === 9999 ? '∞' : tier.endDay}: ₹${tier.amount}${tier.isPercentage ? '%' : ''}`);
          });
      });

      return;
    }

    // Group by late fine rule
    const ruleGroups = {};
    tierRulesWithExpectedAmounts.forEach(tier => {
      const ruleId = tier.lateFineRule.id;
      if (!ruleGroups[ruleId]) {
        ruleGroups[ruleId] = {
          rule: tier.lateFineRule,
          matchingTiers: []
        };
      }
      ruleGroups[ruleId].matchingTiers.push(tier);
    });

    console.log('\n📋 Groups with matching tier rule amounts:');
    
    Object.values(ruleGroups).forEach((ruleGroup, index) => {
      console.log(`\n${index + 1}. Group: ${ruleGroup.rule.group.name} (ID: ${ruleGroup.rule.group.id})`);
      console.log(`   Rule enabled: ${ruleGroup.rule.isEnabled}`);
      console.log(`   All tier rules in this group:`);
      
      ruleGroup.rule.tierRules
        .sort((a, b) => a.startDay - b.startDay)
        .forEach(tier => {
          const isMatching = [15, 25, 50].includes(tier.amount);
          const marker = isMatching ? '✅' : '  ';
          console.log(`   ${marker} Days ${tier.startDay}-${tier.endDay === 9999 ? '∞' : tier.endDay}: ₹${tier.amount}${tier.isPercentage ? '%' : ''}`);
        });
      
      console.log(`   🌐 Browser test: http://localhost:3000/groups/${ruleGroup.rule.group.id}/edit`);
    });

    // Also search for any contribution that might show ₹100.00 for 10 days
    console.log('\n\n🔍 SEARCHING FOR ₹100.00 LATE FINE CALCULATION (10 days)');
    console.log('='.repeat(60));
    
    // Calculate what tier structure would result in ₹100 for 10 days
    console.log('\n📊 Analyzing what would cause ₹100.00 for 10 days:');
    console.log('If someone is 10 days late:');
    
    // Check each group's tier structure
    const allGroups = await prisma.group.findMany({
      include: {
        lateFineRules: {
          include: {
            tierRules: true
          }
        }
      }
    });

    allGroups.forEach(group => {
      if (group.lateFineRules.length === 0) return;
      
      const enabledRule = group.lateFineRules.find(rule => rule.isEnabled);
      if (!enabledRule || enabledRule.ruleType !== 'TIER_BASED') return;
      
      const tierRules = enabledRule.tierRules.sort((a, b) => a.startDay - b.startDay);
      if (tierRules.length === 0) return;
      
      // Calculate late fine for 10 days
      let totalFine = 0;
      for (let day = 1; day <= 10; day++) {
        const applicableTier = tierRules.find(tier => day >= tier.startDay && day <= tier.endDay);
        if (applicableTier) {
          totalFine += applicableTier.amount;
        }
      }
      
      if (totalFine === 100) {
        console.log(`\n🎯 FOUND MATCH! Group: ${group.name} (ID: ${group.id})`);
        console.log(`   10-day calculation: ₹${totalFine}`);
        tierRules.forEach(tier => {
          console.log(`   Days ${tier.startDay}-${tier.endDay === 9999 ? '∞' : tier.endDay}: ₹${tier.amount}/day`);
        });
        console.log(`   🌐 Browser test: http://localhost:3000/groups/${group.id}/edit`);
      } else if (totalFine > 80) { // Close matches
        console.log(`\n📊 Close match: Group ${group.name} - 10 days = ₹${totalFine}`);
      }
    });

  } catch (error) {
    console.error('❌ Error searching for late fine rules:', error);
  } finally {
    await prisma.$disconnect();
  }
}

searchForSpecificLateFineRules();
