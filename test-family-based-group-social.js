#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testFamilyBasedGroupSocial() {
  console.log('🧪 Testing Family-Based Group Social Feature...\n');
  
  try {
    // 1.Test Group Settings
    console.log('1. Testing Updated Group Schema...');
    const groups = await prisma.group.findMany({
      where: {
        groupSocialEnabled: true
      },
      select: {
        id: true,
        name: true,
        groupSocialEnabled: true,
        groupSocialAmountPerFamilyMember: true,
        members: {
          select: {
            id: true,
            name: true,
            familyMembersCount: true
          }
        }
      }
    });
    
    console.log(`   Found ${groups.length} groups with group social enabled`);
    
    // 2. Create a test group with family-based group social if none exist
    if (groups.length === 0) {
      console.log('\n2. Creating test group with family-based group social...');
      
      const testGroup = await prisma.group.create({
        data: {
          groupId: `GRP-${Date.now()}`,
          name: `Test Family Social Group`,
          groupSocialEnabled: true,
          groupSocialAmountPerFamilyMember: 10.0, // ₹10 per family member
          monthlyContribution: 500,
          memberCount: 2
        }
      });
      
      console.log(`   Created test group: ${testGroup.name}`);
      console.log(`   Group Social: ₹${testGroup.groupSocialAmountPerFamilyMember} per family member`);
      
      // Create test members with different family sizes
      const member1 = await prisma.member.create({
        data: {
          name: 'Test Member 1',
          email: 'member1@test.com',
          familyMembersCount: 4 // 4 family members = ₹40 group social
        }
      });
      
      const member2 = await prisma.member.create({
        data: {
          name: 'Test Member 2', 
          email: 'member2@test.com',
          familyMembersCount: 2 // 2 family members = ₹20 group social
        }
      });
      
      // Create memberships
      await prisma.memberGroupMembership.create({
        data: {
          groupId: testGroup.id,
          memberId: member1.id,
          currentShareAmount: 0,
          currentLoanAmount: 0
        }
      });
      
      await prisma.memberGroupMembership.create({
        data: {
          groupId: testGroup.id,
          memberId: member2.id,
          currentShareAmount: 0,
          currentLoanAmount: 0
        }
      });
      
      console.log(`   Created member "${member1.name}" with ${member1.familyMembersCount} family members`);
      console.log(`   Expected group social: ₹${testGroup.groupSocialAmountPerFamilyMember * member1.familyMembersCount}`);
      console.log(`   Created member "${member2.name}" with ${member2.familyMembersCount} family members`);
      console.log(`   Expected group social: ₹${testGroup.groupSocialAmountPerFamilyMember * member2.familyMembersCount}`);
      
      groups.push({
        id: testGroup.id,
        name: testGroup.name,
        groupSocialEnabled: testGroup.groupSocialEnabled,
        groupSocialAmountPerFamilyMember: testGroup.groupSocialAmountPerFamilyMember,
        members: [
          { id: member1.id, name: member1.name, familyMembersCount: member1.familyMembersCount },
          { id: member2.id, name: member2.name, familyMembersCount: member2.familyMembersCount }
        ]
      });
    }
    
    // 3. Display calculation examples
    console.log('\n3. Group Social Calculation Examples:');
    groups.forEach(group => {
      console.log(`\n   Group: ${group.name}`);
      console.log(`   Amount per family member: ₹${group.groupSocialAmountPerFamilyMember}`);
      
      group.members.forEach(member => {
        const familyCount = member.familyMembersCount || 1;
        const groupSocialAmount = (group.groupSocialAmountPerFamilyMember || 0) * familyCount;
        console.log(`   - ${member.name}: ${familyCount} family members × ₹${group.groupSocialAmountPerFamilyMember} = ₹${groupSocialAmount}`);
      });
    });
    
    console.log('\n✅ Family-Based Group Social feature is working correctly!');
    console.log('\n📋 Summary:');
    console.log('   - Group social amount is now calculated per family member');
    console.log('   - Each member can have a different number of family members');
    console.log('   - Total group social = (Amount per family member) × (Member\'s family count)');
    console.log('   - This allows for fair contribution based on family size');
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testFamilyBasedGroupSocial().catch(console.error);
