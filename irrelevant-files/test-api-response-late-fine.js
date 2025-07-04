#!/usr/bin/env node

/**
 * Test the specific group API response to validate late fine configuration
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testApiResponseForLateFine() {
  console.log('🔍 TESTING API RESPONSE FOR LATE FINE CONFIGURATION');
  console.log('====================================================');

  try {
    const groupId = '684d45849f5311a32a95f7d4'; // Our test group

    // Simulate the exact query the API does
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        leader: {
          select: { id: true, name: true, email: true }
        },
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: {
                    groupId: groupId,
                    status: 'ACTIVE'
                  }
                }
              }
            }
          },
          orderBy: {
            member: {
              name: 'asc'
            }
          }
        },
        groupPeriodicRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        lateFineRules: {
          include: {
            tierRules: true // Include tier-based rules
          },
          orderBy: { createdAt: 'desc' },
          take: 1 // Get the latest late fine rule
        }
      },
    });

    if (!group) {
      console.log('❌ Group not found');
      return;
    }

    console.log('✅ Group found:', group.name);
    console.log('\n📊 LATE FINE RULES ANALYSIS:');
    console.log('===============================');
    
    console.log('Raw lateFineRules from database:');
    console.log(JSON.stringify(group.lateFineRules, null, 2));

    if (!group.lateFineRules || group.lateFineRules.length === 0) {
      console.log('❌ NO LATE FINE RULES FOUND');
      return;
    }

    const lateFineRule = group.lateFineRules[0];
    console.log('\n📋 FIRST LATE FINE RULE:');
    console.log(`  ID: ${lateFineRule.id}`);
    console.log(`  Group ID: ${lateFineRule.groupId}`);
    console.log(`  Rule Type: ${lateFineRule.ruleType}`);
    console.log(`  Is Enabled: ${lateFineRule.isEnabled} (type: ${typeof lateFineRule.isEnabled})`);
    console.log(`  Daily Amount: ${lateFineRule.dailyAmount}`);
    console.log(`  Daily Percentage: ${lateFineRule.dailyPercentage}`);
    console.log(`  Tier Rules Count: ${lateFineRule.tierRules ? lateFineRule.tierRules.length : 0}`);

    if (lateFineRule.tierRules && lateFineRule.tierRules.length > 0) {
      console.log('\n📋 TIER RULES:');
      lateFineRule.tierRules.forEach((tier, index) => {
        console.log(`  Tier ${index + 1}:`);
        console.log(`    Start Day: ${tier.startDay}`);
        console.log(`    End Day: ${tier.endDay}`);
        console.log(`    Amount: ${tier.amount}`);
        console.log(`    Is Percentage: ${tier.isPercentage}`);
      });
    }

    // Now simulate the exact API response structure
    console.log('\n📤 SIMULATED API RESPONSE STRUCTURE:');
    console.log('=====================================');
    
    const apiResponse = {
      lateFineRules: group.lateFineRules // This is exactly what the API returns
    };

    console.log('API Response lateFineRules:');
    console.log(JSON.stringify(apiResponse.lateFineRules, null, 2));

    // Now simulate the form population logic from the edit page
    console.log('\n📝 FORM POPULATION SIMULATION:');
    console.log('===============================');

    const hasLateFineRules = apiResponse.lateFineRules && apiResponse.lateFineRules.length > 0;
    console.log(`hasLateFineRules: ${hasLateFineRules}`);

    if (hasLateFineRules) {
      const rule = apiResponse.lateFineRules[0];
      console.log('\nProcessing first rule:');
      console.log(`  rule.isEnabled: ${rule.isEnabled} (type: ${typeof rule.isEnabled})`);
      console.log(`  rule.ruleType: "${rule.ruleType}"`);
      
      const isEnabled = !!rule.isEnabled;
      console.log(`  !!rule.isEnabled = ${isEnabled}`);
      
      const ruleType = rule.ruleType;
      console.log(`  ruleType assignment: "${ruleType}"`);
      
      const dailyAmount = rule.dailyAmount !== undefined ? rule.dailyAmount : null;
      console.log(`  dailyAmount: ${dailyAmount}`);
      
      const dailyPercentage = rule.dailyPercentage !== undefined ? rule.dailyPercentage : null;
      console.log(`  dailyPercentage: ${dailyPercentage}`);

      // Handle tier rules
      if (ruleType === 'TIER_BASED' && rule.tierRules) {
        console.log(`\n  Processing TIER_BASED rules:`);
        console.log(`  rule.tierRules exists: ${!!rule.tierRules}`);
        console.log(`  rule.tierRules.length: ${rule.tierRules.length}`);
        
        const tierRulesForForm = rule.tierRules.map((tier, index) => {
          console.log(`    Processing tier ${index + 1}:`, tier);
          return {
            startDay: tier.startDay,
            endDay: tier.endDay,
            amount: tier.amount,
            isPercentage: tier.isPercentage
          };
        });
        
        console.log(`  tierRulesForForm:`, JSON.stringify(tierRulesForForm, null, 2));
      }

      console.log('\n✅ EXPECTED FORM VALUES:');
      console.log(`  isLateFineEnabled: ${isEnabled}`);
      console.log(`  lateFineRuleType: "${ruleType}"`);
      console.log(`  dailyAmount: ${dailyAmount}`);
      console.log(`  dailyPercentage: ${dailyPercentage}`);
      
      if (ruleType === 'TIER_BASED' && rule.tierRules) {
        console.log(`  lateFineTierRules: ${rule.tierRules.length} tiers`);
      } else {
        console.log(`  lateFineTierRules: [] (empty array)`);
      }

      console.log('\n🎯 CONCLUSION:');
      if (isEnabled && ruleType === 'TIER_BASED' && rule.tierRules && rule.tierRules.length > 0) {
        console.log('✅ Form should populate correctly with:');
        console.log('   - Late Fine System: CHECKED');
        console.log('   - Rule Type: TIER_BASED');
        console.log(`   - ${rule.tierRules.length} tier rules configured`);
        
        console.log('\n🤔 IF THE FORM STILL SHOWS WRONG VALUES:');
        console.log('The issue is likely in:');
        console.log('1. Browser caching/stale data');
        console.log('2. React Hook Form not updating properly');
        console.log('3. Component re-rendering issues');
        console.log('4. TypeScript type coercion problems');
        console.log('5. Async timing issues in useEffect');
        
      } else {
        console.log('❌ Form will NOT populate correctly');
        if (!isEnabled) console.log('   - isEnabled is false');
        if (ruleType !== 'TIER_BASED') console.log(`   - ruleType is ${ruleType}, not TIER_BASED`);
        if (!rule.tierRules || rule.tierRules.length === 0) console.log('   - No tier rules found');
      }
    } else {
      console.log('❌ No late fine rules found - form will show defaults');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testApiResponseForLateFine();
