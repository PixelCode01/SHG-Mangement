#!/usr/bin/env node

/**
 * Test script to create a group with late fine rules and verify the issue
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestGroupForDebugging() {
  console.log('🧪 CREATING TEST GROUP FOR LATE FINE DEBUGGING');
  console.log('===============================================');

  try {
    // 1. Get or create a test member
    let testMember = await prisma.member.findFirst({
      where: { email: 'testlatefinedebug@example.com' }
    });

    if (!testMember) {
      testMember = await prisma.member.create({
        data: {
          name: 'Late Fine Debug Tester',
          email: 'testlatefinedebug@example.com',
          phone: '9876543210'
        }
      });
      console.log(`✅ Created test member: ${testMember.name} (${testMember.id})`);
    } else {
      console.log(`✅ Using existing test member: ${testMember.name} (${testMember.id})`);
    }

    // 2. Create a test group with late fine rules
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomId = Math.floor(Math.random() * 1000);
    const groupId = `GRP-${yearMonth}-${String(randomId).padStart(3, '0')}`;

    const testGroup = await prisma.group.create({
      data: {
        groupId,
        name: `Late Fine Debug Group ${randomId}`,
        address: 'Debug Test Address',
        registrationNumber: `DEBUG-${randomId}`,
        leaderId: testMember.id,
        collectionFrequency: 'MONTHLY',
        collectionDayOfMonth: 5,
        memberCount: 1,
        dateOfStarting: new Date(),
        monthlyContribution: 500,
        interestRate: 12,
        description: 'Group created for late fine debugging'
      }
    });

    console.log(`✅ Created test group: ${testGroup.name} (${testGroup.id})`);

    // 3. Create late fine rule with tier-based configuration
    const lateFineRule = await prisma.lateFineRule.create({
      data: {
        groupId: testGroup.id,
        ruleType: 'TIER_BASED',
        isEnabled: true,
        dailyAmount: null,
        dailyPercentage: null,
      }
    });

    console.log(`✅ Created late fine rule: ${lateFineRule.id}`);

    // 4. Create tier rules
    const tierRulesData = [
      { startDay: 1, endDay: 7, amount: 5, isPercentage: false },
      { startDay: 8, endDay: 15, amount: 10, isPercentage: false },
      { startDay: 16, endDay: 9999, amount: 15, isPercentage: false }
    ];

    for (const tierData of tierRulesData) {
      await prisma.lateFineRuleTier.create({
        data: {
          lateFineRuleId: lateFineRule.id,
          ...tierData
        }
      });
    }

    console.log(`✅ Created ${tierRulesData.length} tier rules`);

    // 5. Create membership
    await prisma.memberGroupMembership.create({
      data: {
        groupId: testGroup.id,
        memberId: testMember.id,
        currentShareAmount: 1000,
        currentLoanAmount: 0,
        initialInterest: 0
      }
    });

    console.log(`✅ Created membership for test member`);

    // 6. Verify the complete setup
    const verifyGroup = await prisma.group.findUnique({
      where: { id: testGroup.id },
      include: {
        lateFineRules: {
          include: {
            tierRules: true
          }
        }
      }
    });

    console.log('\n📊 VERIFICATION - Created Group Structure:');
    console.log(`Group ID: ${verifyGroup.id}`);
    console.log(`Group Name: ${verifyGroup.name}`);
    console.log(`Late Fine Rules: ${verifyGroup.lateFineRules.length}`);
    
    if (verifyGroup.lateFineRules.length > 0) {
      const rule = verifyGroup.lateFineRules[0];
      console.log(`  Rule Type: ${rule.ruleType}`);
      console.log(`  Enabled: ${rule.isEnabled}`);
      console.log(`  Tier Rules: ${rule.tierRules.length}`);
      
      rule.tierRules.forEach((tier, index) => {
        console.log(`    Tier ${index + 1}: Days ${tier.startDay}-${tier.endDay === 9999 ? '∞' : tier.endDay} = ₹${tier.amount}`);
      });
    }

    console.log('\n🎯 TESTING INSTRUCTIONS:');
    console.log('========================');
    console.log('1. Start the development server:');
    console.log('   npm run dev');
    console.log('');
    console.log('2. Open the group edit page:');
    console.log(`   http://localhost:3000/groups/${testGroup.id}/edit`);
    console.log('');
    console.log('3. Open browser developer tools (F12) and check Console tab');
    console.log('');
    console.log('4. Look for debug messages starting with 🔍 [DEBUG]');
    console.log('');
    console.log('5. Verify that:');
    console.log('   - Late Fine System checkbox is CHECKED');
    console.log('   - Rule Type shows "TIER_BASED"');
    console.log('   - Tier configuration shows 3 tiers');
    console.log('');
    console.log('6. If the checkbox is unchecked or shows wrong values,');
    console.log('   check the debug logs to identify the issue');

    return testGroup;

  } catch (error) {
    console.error('❌ Error creating test group:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestGroupForDebugging();
