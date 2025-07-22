// Debug script to test family size data in the database
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugFamilySize() {
  try {
    console.log("=== FAMILY SIZE DEBUG REPORT ===");
    
    // Get all members with their family size
    const allMembers = await prisma.member.findMany({
      select: {
        id: true,
        name: true,
        familyMembersCount: true,
        groupMemberships: {
          select: {
            group: {
              select: {
                id: true,
                name: true,
                groupSocialEnabled: true,
                groupSocialAmountPerFamilyMember: true
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log("\n=== ALL MEMBERS FAMILY SIZE DATA ===");
    allMembers.forEach(member => {
      const groupInfo = member.groupMemberships[0]?.group;
      console.log(`${member.name}:`, {
        familyMembersCount: member.familyMembersCount,
        type: typeof member.familyMembersCount,
        inGroup: groupInfo?.name || 'No group',
        groupSocialEnabled: groupInfo?.groupSocialEnabled,
        perFamilyMemberAmount: groupInfo?.groupSocialAmountPerFamilyMember
      });
    });

    // Check specific members from your JSON data
    console.log("\n=== SPECIFIC MEMBERS CHECK ===");
    const specificMembers = [
      'Anup Kumar Keshri',
      'Santosh Mishra', 
      'Vijay Keshri',
      'Sudhakar Kumar'
    ];

    for (const memberName of specificMembers) {
      const member = await prisma.member.findFirst({
        where: { name: memberName },
        include: {
          groupMemberships: {
            include: {
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
        console.log(`✅ Found ${memberName}:`, {
          familyMembersCount: member.familyMembersCount,
          expectedFromJson: memberName === 'Anup Kumar Keshri' ? 2 : 
                          memberName === 'Santosh Mishra' ? 3 :
                          memberName === 'Vijay Keshri' ? 14 :
                          memberName === 'Sudhakar Kumar' ? 4 : 'unknown',
          matches: member.familyMembersCount === (memberName === 'Anup Kumar Keshri' ? 2 : 
                                                memberName === 'Santosh Mishra' ? 3 :
                                                memberName === 'Vijay Keshri' ? 14 :
                                                memberName === 'Sudhakar Kumar' ? 4 : null)
        });
      } else {
        console.log(`❌ Not found: ${memberName}`);
      }
    }

    // Check group social settings
    console.log("\n=== GROUP SOCIAL SETTINGS ===");
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        groupSocialEnabled: true,
        groupSocialAmountPerFamilyMember: true,
        _count: {
          select: {
            memberships: true
          }
        }
      }
    });

    groups.forEach(group => {
      console.log(`Group: ${group.name}`, {
        membersCount: group._count.memberships,
        groupSocialEnabled: group.groupSocialEnabled,
        amountPerFamily: group.groupSocialAmountPerFamilyMember
      });
    });

  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugFamilySize();
