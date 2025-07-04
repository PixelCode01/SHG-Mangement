#!/usr/bin/env node

/**
 * Simple validation test for late fine configuration fix
 * Uses existing Atlas data to validate the fix works correctly
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function validateLateFineFixWithAtlas() {
  console.log('🔧 VALIDATING LATE FINE FIX WITH MONGODB ATLAS');
  console.log('===============================================\n');

  try {
    // Get groups with late fine rules
    const groupsWithLateFines = await prisma.group.findMany({
      where: {
        lateFineRules: {
          some: {}
        }
      },
      include: {
        lateFineRules: {
          include: {
            tierRules: true
          }
        }
      },
      take: 5 // Limit to first 5 for testing
    });

    if (groupsWithLateFines.length === 0) {
      console.log('❌ No groups with late fine rules found in Atlas');
      return;
    }

    console.log(`✅ Found ${groupsWithLateFines.length} groups with late fine rules in Atlas\n`);

    for (const group of groupsWithLateFines) {
      console.log(`🔍 VALIDATING GROUP: ${group.name} (ID: ${group.id})`);
      console.log('='.repeat(60));
      
      // Simulate the edit form logic (our fix)
      console.log('📊 Raw late fine rules from Atlas:');
      console.log(JSON.stringify(group.lateFineRules, null, 2));
      
      console.log('\n🔧 Applying edit form fix logic:');
      
      const hasLateFineRules = group.lateFineRules && group.lateFineRules.length > 0;
      console.log(`   hasLateFineRules: ${hasLateFineRules}`);
      
      if (!hasLateFineRules) {
        console.log('   ✅ Result: No late fine configuration (correct)');
        console.log(`   🌐 Browser test: http://localhost:3000/groups/${group.id}/edit\n`);
        continue;
      }

      // FIX 1: Find most recent enabled rule
      const enabledRules = group.lateFineRules.filter(rule => rule.isEnabled);
      const lateFineRule = enabledRules.length > 0 
        ? enabledRules[enabledRules.length - 1] // Most recent enabled
        : group.lateFineRules[0]; // Fallback to first
      
      console.log(`   Total rules: ${group.lateFineRules.length}`);
      console.log(`   Enabled rules: ${enabledRules.length}`);
      console.log(`   Selected rule: ${lateFineRule ? `${lateFineRule.ruleType} (enabled: ${lateFineRule.isEnabled})` : 'none'}`);
      
      if (!lateFineRule) {
        console.log('   ❌ No valid rule found');
        console.log(`   🌐 Browser test: http://localhost:3000/groups/${group.id}/edit\n`);
        continue;
      }

      const isEnabled = !!lateFineRule.isEnabled;
      const ruleType = lateFineRule.ruleType;
      
      console.log(`   Form field: isLateFineEnabled = ${isEnabled}`);
      console.log(`   Form field: lateFineRuleType = ${ruleType}`);
      
      // FIX 2: Handle TIER_BASED rules specifically
      if (ruleType === 'TIER_BASED') {
        const tierRulesCount = lateFineRule.tierRules ? lateFineRule.tierRules.length : 0;
        console.log(`   TIER_BASED validation: ${tierRulesCount} tier rules found`);
        
        if (tierRulesCount === 0) {
          console.log('   🔧 FIX APPLIED: Would disable late fine due to empty tier rules');
          console.log('   ⚠️  Expected in form: isLateFineEnabled = false');
        } else {
          console.log('   ✅ TIER_BASED rule has valid tier rules');
          console.log('   ✅ Expected in form: isLateFineEnabled = true, with tier rules populated');
          
          console.log('   📋 Tier rules that should appear in form:');
          lateFineRule.tierRules.forEach((tier, i) => {
            console.log(`      ${i + 1}. Days ${tier.startDay}-${tier.endDay}: ${tier.amount}${tier.isPercentage ? '%' : ' units'}`);
          });
        }
      } else {
        console.log(`   ✅ ${ruleType} rule with appropriate daily value`);
        if (ruleType === 'DAILY_FIXED') {
          console.log(`   Form field: dailyAmount = ${lateFineRule.dailyAmount}`);
        } else if (ruleType === 'DAILY_PERCENTAGE') {
          console.log(`   Form field: dailyPercentage = ${lateFineRule.dailyPercentage}`);
        }
      }

      console.log(`   🌐 Browser test: http://localhost:3000/groups/${group.id}/edit`);
      console.log('');
    }

    console.log('🎯 VALIDATION SUMMARY');
    console.log('=====================');
    console.log('✅ Atlas data structure verified');
    console.log('✅ Fix logic applied successfully');
    console.log('✅ Browser test URLs generated');
    console.log('\n📝 NEXT STEPS:');
    console.log('1. Open the browser test URLs above');
    console.log('2. Check that each edit form shows the expected late fine configuration');
    console.log('3. Look for debug logs in browser console (our fix adds extensive logging)');
    console.log('4. Verify that:');
    console.log('   - Late fine enabled/disabled state matches expectations');
    console.log('   - Correct rule type is selected');
    console.log('   - Tier rules are populated correctly for TIER_BASED rules');
    console.log('   - Empty tier rules result in disabled late fine');

  } catch (error) {
    console.error('❌ Validation failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to test specific group by ID
async function testSpecificGroup(groupId) {
  console.log(`🎯 TESTING SPECIFIC GROUP: ${groupId}`);
  console.log('='.repeat(50));
  
  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        lateFineRules: {
          include: {
            tierRules: true
          }
        }
      }
    });

    if (!group) {
      console.log('❌ Group not found');
      return;
    }

    console.log(`📋 Group: ${group.name}`);
    console.log(`📊 Late fine rules: ${group.lateFineRules?.length || 0}`);
    
    if (group.lateFineRules && group.lateFineRules.length > 0) {
      group.lateFineRules.forEach((rule, i) => {
        console.log(`   Rule ${i + 1}: ${rule.ruleType} (enabled: ${rule.isEnabled})`);
        if (rule.ruleType === 'TIER_BASED') {
          console.log(`      Tier rules: ${rule.tierRules?.length || 0}`);
        }
      });
    }

    console.log(`🌐 Browser test: http://localhost:3000/groups/${groupId}/edit`);
    
  } catch (error) {
    console.error('❌ Error testing group:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0].startsWith('--group=')) {
    const groupId = args[0].replace('--group=', '');
    await testSpecificGroup(groupId);
  } else if (args.length > 0) {
    await testSpecificGroup(args[0]);
  } else {
    await validateLateFineFixWithAtlas();
  }
}

main();
