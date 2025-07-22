// Debug script to check if family member counts are being saved correctly
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugFamilyMemberCounts() {
  try {
    console.log('🔍 [DEBUG] Checking Group Social and Family Member Counts...\n');
    
    // Find a group with Group Social enabled
    const groupsWithGS = await prisma.group.findMany({
      where: {
        groupSocialEnabled: true
      },
      include: {
        memberships: {
          include: {
            member: {
              select: {
                id: true,
                name: true,
                familyMembersCount: true
              }
            }
          }
        }
      },
      take: 2
    });

    if (groupsWithGS.length === 0) {
      console.log('❌ No groups with Group Social enabled found.');
      return;
    }

    groupsWithGS.forEach((group, index) => {
      console.log(`📋 Group ${index + 1}: ${group.name}`);
      console.log(`   Group Social Enabled: ${group.groupSocialEnabled}`);
      console.log(`   Amount per Family Member: ₹${group.groupSocialAmountPerFamilyMember || 0}`);
      console.log(`   Members (${group.memberships.length}):`);
      
      group.memberships.forEach((membership, memberIndex) => {
        const member = membership.member;
        const familyCount = member.familyMembersCount || 1;
        const groupSocialAmount = (group.groupSocialAmountPerFamilyMember || 0) * familyCount;
        
        console.log(`     ${memberIndex + 1}. ${member.name}`);
        console.log(`        Family Size: ${familyCount}`);
        console.log(`        Expected Group Social: ₹${groupSocialAmount.toFixed(2)}`);
        
        // Check if family count is null or 1 (which might indicate the issue)
        if (member.familyMembersCount === null || member.familyMembersCount === 1) {
          console.log(`        ⚠️  Family size is ${member.familyMembersCount === null ? 'null' : '1'} - this might be the issue!`);
        }
      });
      
      // Calculate total family members for verification
      const totalFamilyMembers = group.memberships.reduce((sum, membership) => {
        return sum + (membership.member.familyMembersCount || 1);
      }, 0);
      
      const totalGroupSocialDue = totalFamilyMembers * (group.groupSocialAmountPerFamilyMember || 0);
      
      console.log(`   📊 Summary:`);
      console.log(`      Total Family Members: ${totalFamilyMembers}`);
      console.log(`      Total Group Social Due: ₹${totalGroupSocialDue.toFixed(2)}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error debugging family member counts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugFamilyMemberCounts();
