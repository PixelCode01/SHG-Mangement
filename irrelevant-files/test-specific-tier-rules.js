#!/usr/bin/env node

/**
 * Test script to create a group with the specific tier rules mentioned by the user
 * Expected: Days 1-5: ₹15, Days 6-15: ₹25, Days 16+: ₹50
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestGroupWithSpecificTierRules() {
  console.log('🧪 CREATING TEST GROUP WITH SPECIFIC TIER RULES');
  console.log('Expected: Days 1-5: ₹15, Days 6-15: ₹25, Days 16+: ₹50');
  console.log('='.repeat(60));

  try {
    // First, get a member to use as leader
    const availableMembers = await prisma.member.findMany({
      take: 1
    });

    if (availableMembers.length === 0) {
      console.log('❌ No members available. Creating a test member first...');
      
      const testMember = await prisma.member.create({
        data: {
          name: 'Test Leader for Tier Rules',
          email: 'testleader.tierrules@example.com'
        }
      });
      
      availableMembers.push(testMember);
      console.log('✅ Created test member:', testMember.name);
    }

    const testGroupData = {
      name: 'TEST_User_Expected_Tier_Rules',
      address: 'Test Address for Tier Rules',
      registrationNumber: 'TEST-TIER-001',
      leaderId: availableMembers[0].id,
      memberCount: 1,
      collectionFrequency: 'MONTHLY',
      collectionDayOfMonth: 15,
      lateFineRule: {
        isEnabled: true,
        ruleType: 'TIER_BASED',
        tierRules: [
          {
            startDay: 1,
            endDay: 5,
            amount: 15, // ₹15 for days 1-5
            isPercentage: false
          },
          {
            startDay: 6,
            endDay: 15,
            amount: 25, // ₹25 for days 6-15
            isPercentage: false
          },
          {
            startDay: 16,
            endDay: 9999,
            amount: 50, // ₹50 for days 16+
            isPercentage: false
          }
        ]
      },
      members: [
        {
          memberId: availableMembers[0].id,
          currentShareAmount: 100,
          currentLoanAmount: 0
        }
      ]
    };

    console.log('📊 Creating group with late fine rule:');
    console.log(JSON.stringify(testGroupData.lateFineRule, null, 2));

    // Make API call to create the group
    const response = await fetch('http://localhost:3000/api/groups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In a real test, you'd need proper authentication headers
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify(testGroupData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ API call failed:', response.status, errorText);
      
      // Try direct database creation instead
      console.log('\n🔧 Trying direct database creation...');
      
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Generate group ID
      const lastGroup = await prisma.group.findFirst({
        where: { groupId: { startsWith: `GRP-${yearMonth}-` } },
        orderBy: { createdAt: 'desc' },
        select: { groupId: true }
      });
      
      let sequentialNumber = 1;
      if (lastGroup?.groupId) {
        const groupIdParts = lastGroup.groupId.split('-');
        if (groupIdParts.length >= 3 && groupIdParts[2]) {
          const lastNumber = parseInt(groupIdParts[2]);
          if (!isNaN(lastNumber)) sequentialNumber = lastNumber + 1;
        }
      }
      
      const groupId = `GRP-${yearMonth}-${String(sequentialNumber).padStart(3, '0')}`;

      const result = await prisma.$transaction(async (tx) => {
        // Create group
        const group = await tx.group.create({
          data: {
            groupId,
            name: testGroupData.name,
            address: testGroupData.address,
            registrationNumber: testGroupData.registrationNumber,
            leaderId: testGroupData.leaderId,
            memberCount: testGroupData.memberCount,
            collectionFrequency: testGroupData.collectionFrequency,
            collectionDayOfMonth: testGroupData.collectionDayOfMonth,
            dateOfStarting: new Date()
          }
        });

        // Create late fine rule
        const lateFineRule = await tx.lateFineRule.create({
          data: {
            groupId: group.id,
            isEnabled: true,
            ruleType: 'TIER_BASED'
          }
        });

        // Create tier rules
        for (const tier of testGroupData.lateFineRule.tierRules) {
          await tx.lateFineRuleTier.create({
            data: {
              lateFineRuleId: lateFineRule.id,
              startDay: tier.startDay,
              endDay: tier.endDay,
              amount: tier.amount,
              isPercentage: tier.isPercentage
            }
          });
        }

        // Create membership
        await tx.memberGroupMembership.create({
          data: {
            groupId: group.id,
            memberId: testGroupData.members[0].memberId,
            currentShareAmount: testGroupData.members[0].currentShareAmount,
            currentLoanAmount: testGroupData.members[0].currentLoanAmount
          }
        });

        return group;
      });

      console.log(`✅ Successfully created test group directly in database`);
      console.log(`   Group ID: ${result.id}`);
      console.log(`   Group Code: ${result.groupId}`);
      console.log(`   Name: ${result.name}`);
      
      // Verify the late fine rules were created correctly
      const createdGroup = await prisma.group.findUnique({
        where: { id: result.id },
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

      console.log('\n📊 Verification - Created late fine rules:');
      if (createdGroup?.lateFineRules && createdGroup.lateFineRules.length > 0) {
        const rule = createdGroup.lateFineRules[0];
        console.log(`   Rule type: ${rule.ruleType}`);
        console.log(`   Enabled: ${rule.isEnabled}`);
        console.log(`   Tier rules:`);
        
        rule.tierRules.forEach((tier, index) => {
          console.log(`      ${index + 1}. Days ${tier.startDay}-${tier.endDay === 9999 ? '∞' : tier.endDay}: ₹${tier.amount}${tier.isPercentage ? '%' : ''}`);
        });
        
        // Calculate late fine for 10 days to test
        let totalFine = 0;
        for (let day = 1; day <= 10; day++) {
          const applicableTier = rule.tierRules.find(tier => day >= tier.startDay && day <= tier.endDay);
          if (applicableTier) {
            totalFine += applicableTier.amount;
          }
        }
        
        console.log(`\n🎯 Late fine calculation for 10 days: ₹${totalFine}`);
        console.log(`   Expected breakdown:`);
        console.log(`      Days 1-5 (5 days × ₹15): ₹${5 * 15} = ₹75`);
        console.log(`      Days 6-10 (5 days × ₹25): ₹${5 * 25} = ₹125`);
        console.log(`      Total expected: ₹200`);
        console.log(`      Actual result: ₹${totalFine}`);
        
        if (totalFine === 200) {
          console.log('   ✅ CORRECT! Late fine calculation matches expected values.');
        } else {
          console.log('   ❌ MISMATCH! Late fine calculation does not match expected values.');
        }
      } else {
        console.log('   ❌ No late fine rules found!');
      }

      console.log(`\n🌐 Test URLs:`);
      console.log(`   Edit form: http://localhost:3000/groups/${result.id}/edit`);
      console.log(`   Group view: http://localhost:3000/groups/${result.id}`);
      
      return result;
    } else {
      const responseData = await response.json();
      console.log('✅ Group created successfully via API');
      console.log('Response:', responseData);
    }

  } catch (error) {
    console.error('❌ Error creating test group:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestGroupWithSpecificTierRules();
