#!/usr/bin/env node

/**
 * Add detailed logging to the edit form to track the late fine configuration issue
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addEditFormLogging() {
  console.log('🔧 ADDING DEBUGGING LOGS TO EDIT FORM');
  console.log('=====================================\n');

  try {
    // Test with a specific group that has late fine rules
    const testGroup = await prisma.group.findFirst({
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
      }
    });

    if (!testGroup) {
      console.log('❌ No groups with late fine rules found');
      return;
    }

    console.log(`✅ Found test group: ${testGroup.name} (${testGroup.id})`);
    console.log(`📊 Late fine rules in database:`);
    
    testGroup.lateFineRules.forEach((rule, index) => {
      console.log(`   Rule ${index + 1}:`);
      console.log(`     - ID: ${rule.id}`);
      console.log(`     - Enabled: ${rule.isEnabled}`);
      console.log(`     - Type: ${rule.ruleType}`);
      console.log(`     - Daily Amount: ${rule.dailyAmount}`);
      console.log(`     - Daily Percentage: ${rule.dailyPercentage}`);
      console.log(`     - Tier Rules: ${rule.tierRules.length}`);
      
      if (rule.ruleType === 'TIER_BASED') {
        rule.tierRules.forEach((tier, tierIndex) => {
          console.log(`       Tier ${tierIndex + 1}: Days ${tier.startDay}-${tier.endDay} = ₹${tier.amount}${tier.isPercentage ? '%' : ''}`);
        });
      }
    });

    // Now let's create a more focused test
    console.log('\n🎯 FOCUSED TEST: Data Flow Analysis');
    console.log('===================================');

    const rule = testGroup.lateFineRules[0];
    
    console.log('1. Raw Database Data:');
    console.log(`   isEnabled: ${rule.isEnabled} (type: ${typeof rule.isEnabled})`);
    console.log(`   ruleType: "${rule.ruleType}"`);
    console.log(`   tierRules count: ${rule.tierRules.length}`);

    console.log('\n2. API Response Simulation:');
    const apiResponse = {
      lateFineRules: [{
        id: rule.id,
        isEnabled: rule.isEnabled,
        ruleType: rule.ruleType,
        dailyAmount: rule.dailyAmount,
        dailyPercentage: rule.dailyPercentage,
        tierRules: rule.tierRules.map(tier => ({
          startDay: tier.startDay,
          endDay: tier.endDay,
          amount: tier.amount,
          isPercentage: tier.isPercentage
        }))
      }]
    };
    console.log(`   API structure: lateFineRules[0].isEnabled = ${apiResponse.lateFineRules[0].isEnabled}`);

    console.log('\n3. Edit Form Population Logic:');
    // This is the exact logic from the edit form
    const isLateFineEnabled = apiResponse.lateFineRules && apiResponse.lateFineRules.length > 0 
      ? !!apiResponse.lateFineRules[0]?.isEnabled 
      : false;
    
    const lateFineRuleType = apiResponse.lateFineRules && apiResponse.lateFineRules.length > 0 && apiResponse.lateFineRules[0]?.ruleType
      ? apiResponse.lateFineRules[0].ruleType
      : null;
    
    const lateFineTierRules = apiResponse.lateFineRules && 
      apiResponse.lateFineRules.length > 0 && 
      apiResponse.lateFineRules[0]?.ruleType === 'TIER_BASED' &&
      apiResponse.lateFineRules[0]?.tierRules
        ? apiResponse.lateFineRules[0].tierRules.map(tier => ({
            startDay: tier.startDay,
            endDay: tier.endDay,
            amount: tier.amount,
            isPercentage: tier.isPercentage
          }))
        : [];

    console.log(`   isLateFineEnabled = ${isLateFineEnabled} (type: ${typeof isLateFineEnabled})`);
    console.log(`   lateFineRuleType = "${lateFineRuleType}"`);
    console.log(`   lateFineTierRules count = ${lateFineTierRules.length}`);

    console.log('\n4. Potential Issues Detected:');
    const issues = [];
    
    if (rule.isEnabled !== isLateFineEnabled) {
      issues.push(`Database has isEnabled=${rule.isEnabled} but form gets ${isLateFineEnabled}`);
    }
    
    if (rule.ruleType !== lateFineRuleType) {
      issues.push(`Database has ruleType="${rule.ruleType}" but form gets "${lateFineRuleType}"`);
    }
    
    if (rule.ruleType === 'TIER_BASED' && rule.tierRules.length !== lateFineTierRules.length) {
      issues.push(`Database has ${rule.tierRules.length} tier rules but form gets ${lateFineTierRules.length}`);
    }

    if (issues.length === 0) {
      console.log('   ✅ No issues detected in data flow');
    } else {
      console.log('   ❌ Issues detected:');
      issues.forEach(issue => console.log(`     - ${issue}`));
    }

    // Now let's test the user experience
    console.log('\n🎭 USER EXPERIENCE SIMULATION');
    console.log('=============================');
    
    console.log('Scenario: User creates group with TIER_BASED late fine rule');
    console.log('1. User selects "Enable Late Fine System" ✓');
    console.log('2. User selects "Tier Based" rule type ✓');
    console.log('3. User configures 3 tiers:');
    console.log('   - Days 1-7: ₹5');
    console.log('   - Days 8-15: ₹10');
    console.log('   - Days 16+: ₹15');
    console.log('4. Group is created successfully ✓');
    console.log();
    console.log('Scenario: User edits the same group');
    console.log('Expected behavior:');
    console.log('- "Enable Late Fine System" should be CHECKED');
    console.log('- Rule type should show "Tier Based"');
    console.log('- Tier configuration should show 3 tiers with correct values');
    console.log();
    console.log('Actual behavior based on our analysis:');
    console.log(`- "Enable Late Fine System" will be ${isLateFineEnabled ? 'CHECKED' : 'UNCHECKED'}`);
    console.log(`- Rule type will show "${lateFineRuleType || 'None'}"`);
    console.log(`- Tier configuration will show ${lateFineTierRules.length} tiers`);

    if (isLateFineEnabled && lateFineRuleType === 'TIER_BASED' && lateFineTierRules.length === rule.tierRules.length) {
      console.log('✅ RESULT: Edit form should work correctly!');
    } else {
      console.log('❌ RESULT: Edit form will show incorrect configuration!');
    }

    // Generate specific recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('==================');
    
    if (!isLateFineEnabled && rule.isEnabled) {
      console.log('🔧 Fix needed in edit form population logic for isLateFineEnabled');
    }
    
    if (lateFineRuleType !== rule.ruleType) {
      console.log('🔧 Fix needed in edit form population logic for lateFineRuleType');
    }
    
    if (rule.ruleType === 'TIER_BASED' && lateFineTierRules.length === 0) {
      console.log('🔧 Fix needed in edit form population logic for tier rules');
    }

    console.log('\n📝 NEXT STEPS:');
    console.log('1. Add console.log statements to the edit form to track data flow');
    console.log('2. Test with the browser developer tools');
    console.log('3. Verify the API response structure matches expectations');
    console.log('4. Fix any mapping issues in the form population logic');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addEditFormLogging();
