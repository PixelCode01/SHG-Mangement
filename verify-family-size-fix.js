// Verification script to check if family size fix worked
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyFamilySizeFix() {
  try {
    console.log("🔍 Verifying family size data fix...\n");
    
    // Check specific members that should have been updated
    const testMembers = [
      { name: 'Anup Kumar Keshri', expected: 2 },
      { name: 'Santosh Mishra', expected: 3 },
      { name: 'Vijay Keshri', expected: 14 },
      { name: 'Sudhakar Kumar', expected: 4 },
      { name: 'Dilip Kumar Rajak', expected: 2 }
    ];
    
    console.log("=== KEY MEMBERS VERIFICATION ===");
    for (const test of testMembers) {
      const member = await prisma.member.findFirst({
        where: { name: test.name },
        select: {
          name: true,
          familyMembersCount: true,
          groupMemberships: {
            select: {
              group: {
                select: {
                  name: true,
                  groupSocialEnabled: true,
                  groupSocialAmountPerFamilyMember: true
                }
              }
            }
          }
        }
      });
      
      if (member) {
        const isCorrect = member.familyMembersCount === test.expected;
        console.log(`${isCorrect ? '✅' : '❌'} ${test.name}:`);
        console.log(`   Expected: ${test.expected}, Actual: ${member.familyMembersCount}`);
        
        const group = member.groupMemberships[0]?.group;
        if (group && group.groupSocialEnabled) {
          const groupSocialAmount = (member.familyMembersCount || 1) * (group.groupSocialAmountPerFamilyMember || 0);
          console.log(`   Group: ${group.name}`);
          console.log(`   Group Social Amount: ₹${groupSocialAmount}`);
        }
        console.log();
      } else {
        console.log(`❌ Member not found: ${test.name}\n`);
      }
    }
    
    // Summary statistics
    const totalMembers = await prisma.member.count();
    const membersWithFamilySize = await prisma.member.count({
      where: {
        familyMembersCount: {
          not: null
        }
      }
    });
    
    console.log("=== OVERALL STATISTICS ===");
    console.log(`Total members: ${totalMembers}`);
    console.log(`Members with family size data: ${membersWithFamilySize}`);
    console.log(`Coverage: ${totalMembers > 0 ? Math.round((membersWithFamilySize / totalMembers) * 100) : 0}%`);
    
    // Check group social settings
    const groupsWithSocial = await prisma.group.findMany({
      where: {
        groupSocialEnabled: true
      },
      select: {
        name: true,
        groupSocialAmountPerFamilyMember: true
      }
    });
    
    if (groupsWithSocial.length > 0) {
      console.log("\n=== GROUPS WITH SOCIAL FUND ===");
      groupsWithSocial.forEach(group => {
        console.log(`${group.name}: ₹${group.groupSocialAmountPerFamilyMember || 0} per family member`);
      });
    }
    
  } catch (error) {
    console.error('Verification error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyFamilySizeFix();
