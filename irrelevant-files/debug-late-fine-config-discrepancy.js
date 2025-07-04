#!/usr/bin/env node

/**
 * Debug script to validate assumptions about late fine configuration discrepancy
 * between group creation and editing
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugLateFineConfigDiscrepancy() {
  console.log('🔍 DEBUGGING LATE FINE CONFIGURATION DISCREPANCY');
  console.log('=================================================\n');

  try {
    // ASSUMPTION 1: Data Structure Mismatch
    console.log('📊 ASSUMPTION 1: Data Structure Mismatch');
    console.log('----------------------------------------');
    
    // Find a group with late fine rules to examine the structure
    const groupWithLateFines = await prisma.group.findFirst({
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

    if (!groupWithLateFines) {
      console.log('❌ No groups with late fine rules found for testing');
      return;
    }

    console.log(`✅ Testing with group: ${groupWithLateFines.name} (ID: ${groupWithLateFines.id})`);
    console.log(`📋 Raw lateFineRules from database:`);
    console.log(JSON.stringify(groupWithLateFines.lateFineRules, null, 2));

    // Simulate what the API GET endpoint returns
    console.log('\n📤 Simulated API GET /api/groups/[id] response structure:');
    const apiResponse = {
      lateFineRules: groupWithLateFines.lateFineRules.map(rule => ({
        id: rule.id,
        isEnabled: rule.isEnabled,
        ruleType: rule.ruleType,
        dailyAmount: rule.dailyAmount,
        dailyPercentage: rule.dailyPercentage,
        tierRules: rule.tierRules?.map(tier => ({
          startDay: tier.startDay,
          endDay: tier.endDay,
          amount: tier.amount,
          isPercentage: tier.isPercentage
        }))
      }))
    };
    console.log(JSON.stringify(apiResponse, null, 2));

    // Simulate what the edit form expects to populate
    console.log('\n📝 Edit form population logic simulation:');
    const editFormData = {
      isLateFineEnabled: apiResponse.lateFineRules && apiResponse.lateFineRules.length > 0 
        ? !!apiResponse.lateFineRules[0]?.isEnabled 
        : false,
      lateFineRuleType: apiResponse.lateFineRules && apiResponse.lateFineRules.length > 0 && apiResponse.lateFineRules[0]?.ruleType
        ? apiResponse.lateFineRules[0].ruleType
        : null,
      dailyAmount: apiResponse.lateFineRules && apiResponse.lateFineRules.length > 0 && apiResponse.lateFineRules[0]?.dailyAmount !== undefined
        ? apiResponse.lateFineRules[0].dailyAmount
        : null,
      dailyPercentage: apiResponse.lateFineRules && apiResponse.lateFineRules.length > 0 && apiResponse.lateFineRules[0]?.dailyPercentage !== undefined
        ? apiResponse.lateFineRules[0].dailyPercentage
        : null,
      lateFineTierRules: apiResponse.lateFineRules && 
        apiResponse.lateFineRules.length > 0 && 
        apiResponse.lateFineRules[0]?.ruleType === 'TIER_BASED' &&
        apiResponse.lateFineRules[0]?.tierRules
          ? apiResponse.lateFineRules[0].tierRules.map(tier => ({
              startDay: tier.startDay,
              endDay: tier.endDay,
              amount: tier.amount,
              isPercentage: tier.isPercentage
            }))
          : [],
    };

    console.log('📋 Edit Form Data:');
    console.log(JSON.stringify(editFormData, null, 2));

    // ASSUMPTION 2: Form Population Logic Issues
    console.log('\n\n📊 ASSUMPTION 2: Form Population Logic Issues');
    console.log('---------------------------------------------');

    // Test different scenarios that could cause issues
    const testScenarios = [
      {
        name: 'Multiple Late Fine Rules',
        data: { lateFineRules: [
          { id: '1', isEnabled: true, ruleType: 'DAILY_FIXED', dailyAmount: 10 },
          { id: '2', isEnabled: false, ruleType: 'TIER_BASED', tierRules: [] }
        ]}
      },
      {
        name: 'Disabled Late Fine Rule',
        data: { lateFineRules: [
          { id: '1', isEnabled: false, ruleType: 'DAILY_FIXED', dailyAmount: 10 }
        ]}
      },
      {
        name: 'Empty Tier Rules',
        data: { lateFineRules: [
          { id: '1', isEnabled: true, ruleType: 'TIER_BASED', tierRules: [] }
        ]}
      },
      {
        name: 'Null/Undefined Values',
        data: { lateFineRules: [
          { id: '1', isEnabled: true, ruleType: 'DAILY_FIXED', dailyAmount: null, dailyPercentage: undefined }
        ]}
      }
    ];

    testScenarios.forEach((scenario, index) => {
      console.log(`\n🧪 Test ${index + 1}: ${scenario.name}`);
      
      const formData = {
        isLateFineEnabled: scenario.data.lateFineRules && scenario.data.lateFineRules.length > 0 
          ? !!scenario.data.lateFineRules[0]?.isEnabled 
          : false,
        lateFineRuleType: scenario.data.lateFineRules && scenario.data.lateFineRules.length > 0 && scenario.data.lateFineRules[0]?.ruleType
          ? scenario.data.lateFineRules[0].ruleType
          : null,
        dailyAmount: scenario.data.lateFineRules && scenario.data.lateFineRules.length > 0 && scenario.data.lateFineRules[0]?.dailyAmount !== undefined
          ? scenario.data.lateFineRules[0].dailyAmount
          : null,
        lateFineTierRules: scenario.data.lateFineRules && 
          scenario.data.lateFineRules.length > 0 && 
          scenario.data.lateFineRules[0]?.ruleType === 'TIER_BASED' &&
          scenario.data.lateFineRules[0]?.tierRules
            ? scenario.data.lateFineRules[0].tierRules
            : [],
      };
      
      console.log(`   Result: isLateFineEnabled = ${formData.isLateFineEnabled}`);
      console.log(`   Result: lateFineRuleType = ${formData.lateFineRuleType}`);
      console.log(`   Result: dailyAmount = ${formData.dailyAmount}`);
      console.log(`   Result: tierRules count = ${formData.lateFineTierRules.length}`);
      
      // Check for potential issues
      if (scenario.data.lateFineRules[0]?.isEnabled && !formData.isLateFineEnabled) {
        console.log(`   ❌ ISSUE: isEnabled=${scenario.data.lateFineRules[0].isEnabled} but formData.isLateFineEnabled=${formData.isLateFineEnabled}`);
      }
      
      if (scenario.data.lateFineRules[0]?.ruleType === 'TIER_BASED' && formData.lateFineTierRules.length === 0) {
        console.log(`   ❌ ISSUE: TIER_BASED rule but no tier rules populated`);
      }
    });

    // DIAGNOSTIC: Check creation vs edit API differences
    console.log('\n\n📊 DIAGNOSTIC: Creation vs Edit API Structure Differences');
    console.log('--------------------------------------------------------');
    
    console.log('📤 Group Creation Payload Structure (from frontend):');
    const creationPayload = {
      name: 'Test Group',
      // ... other fields
      lateFineRule: {  // ← SINGULAR "Rule"
        isEnabled: true,
        ruleType: 'TIER_BASED',
        tierRules: [
          { startDay: 1, endDay: 5, amount: 10, isPercentage: false },
          { startDay: 6, endDay: 15, amount: 25, isPercentage: false }
        ]
      }
    };
    console.log(JSON.stringify({ lateFineRule: creationPayload.lateFineRule }, null, 2));
    
    console.log('\n📥 Group Edit API Response Structure:');
    console.log(JSON.stringify({ lateFineRules: apiResponse.lateFineRules }, null, 2)); // ← PLURAL "Rules"
    
    console.log('\n🔍 KEY DIFFERENCES IDENTIFIED:');
    console.log('1. Creation uses "lateFineRule" (singular) object');
    console.log('2. Edit uses "lateFineRules" (plural) array');
    console.log('3. Different nesting structures for tier rules');
    console.log('4. Potential type coercion issues with boolean values');

    // VALIDATION: Test actual API behavior
    console.log('\n\n📊 VALIDATION: Testing Actual API Behavior');
    console.log('-------------------------------------------');
    
    try {
      // Make actual API call to get group data
      const response = await fetch(`http://localhost:3000/api/groups/${groupWithLateFines.id}`);
      if (response.ok) {
        const actualApiData = await response.json();
        console.log('✅ Actual API Response Structure:');
        console.log(JSON.stringify({
          hasLateFineRules: !!actualApiData.lateFineRules,
          lateFineRulesCount: actualApiData.lateFineRules?.length || 0,
          firstRuleStructure: actualApiData.lateFineRules?.[0] || null
        }, null, 2));
        
        // Compare with expected structure
        const differences = [];
        if (!actualApiData.lateFineRules) differences.push('Missing lateFineRules field');
        if (actualApiData.lateFineRules && !Array.isArray(actualApiData.lateFineRules)) differences.push('lateFineRules is not an array');
        
        if (differences.length > 0) {
          console.log('❌ API Response Issues:');
          differences.forEach(diff => console.log(`   - ${diff}`));
        } else {
          console.log('✅ API Response structure looks correct');
        }
      } else {
        console.log(`❌ API call failed: ${response.status} ${response.statusText}`);
      }
    } catch (apiError) {
      console.log(`❌ API call error: ${apiError.message}`);
      console.log('   (This might be because the dev server is not running)');
    }

  } catch (error) {
    console.error('❌ Debug script error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Self-executing function
debugLateFineConfigDiscrepancy();
