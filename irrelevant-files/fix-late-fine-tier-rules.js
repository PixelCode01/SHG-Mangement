#!/usr/bin/env node

/**
 * Fix for late fine issue: Groups have TIER_BASED late fine rules enabled but no tier rules defined
 * This script adds default tier rules to groups that have TIER_BASED late fine rules but no tiers
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixLateFineRules() {
  try {
    console.log('🔧 FIXING LATE FINE TIER RULES ISSUE\n');
    
    // Find all groups with TIER_BASED late fine rules that have no tier rules
    const groupsWithIncompleteRules = await prisma.group.findMany({
      include: {
        lateFineRules: {
          include: {
            tierRules: true
          }
        }
      }
    });
    
    console.log(`📋 Found ${groupsWithIncompleteRules.length} groups total`);
    
    let fixedCount = 0;
    
    for (const group of groupsWithIncompleteRules) {
      const tierBasedRules = group.lateFineRules.filter(rule => 
        rule.ruleType === 'TIER_BASED' && rule.isEnabled && rule.tierRules.length === 0
      );
      
      if (tierBasedRules.length > 0) {
        console.log(`\n🔧 Fixing group: ${group.name} (${group.id})`);
        console.log(`   Collection: ${group.collectionFrequency} on ${group.collectionDayOfMonth}${getOrdinalSuffix(group.collectionDayOfMonth)}`);
        
        for (const rule of tierBasedRules) {
          // Create default tier rules
          const defaultTierRules = [
            {
              lateFineRuleId: rule.id,
              startDay: 1,
              endDay: 7,
              amount: 5.0, // ₹5 per day for first week
              isPercentage: false
            },
            {
              lateFineRuleId: rule.id,
              startDay: 8,
              endDay: 15,
              amount: 10.0, // ₹10 per day for second week
              isPercentage: false
            },
            {
              lateFineRuleId: rule.id,
              startDay: 16,
              endDay: 9999, // Large number for unlimited
              amount: 15.0, // ₹15 per day after 15 days
              isPercentage: false
            }
          ];
          
          console.log(`   Adding tier rules for rule ${rule.id}:`);
          
          for (const tierRule of defaultTierRules) {
            try {
              await prisma.lateFineRuleTier.create({
                data: tierRule
              });
              const endText = tierRule.endDay === 9999 ? '∞' : tierRule.endDay;
              console.log(`     ✅ Days ${tierRule.startDay}-${endText}: ₹${tierRule.amount}/day`);
            } catch (error) {
              console.log(`     ❌ Error creating tier rule: ${error.message}`);
            }
          }
        }
        
        fixedCount++;
      }
    }
    
    console.log(`\n🎉 COMPLETED!`);
    console.log(`   Groups fixed: ${fixedCount}`);
    
    if (fixedCount > 0) {
      console.log(`\n📋 What was fixed:`);
      console.log(`   - Groups had TIER_BASED late fine rules enabled`);
      console.log(`   - But no tier rules were defined, causing late fines to always be 0`);
      console.log(`   - Added default tier structure:`);
      console.log(`     • Days 1-7: ₹5 per day`);
      console.log(`     • Days 8-15: ₹10 per day`);
      console.log(`     • Days 16+: ₹15 per day`);
      
      console.log(`\n🌐 Test the groups now:`);
      console.log(`   - Navigate to the group's contribution tracking page`);
      console.log(`   - Late fines should now calculate properly based on collection day`);
      console.log(`   - For monthly collections on the 3rd, late fines apply after the 3rd of each month`);
    } else {
      console.log(`   No groups needed fixing - all late fine rules are properly configured.`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing late fine rules:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

fixLateFineRules();
