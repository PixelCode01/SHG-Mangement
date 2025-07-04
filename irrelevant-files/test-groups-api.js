const { PrismaClient } = require('@prisma/client');

async function testGroupsAPI() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing Groups API logic...');
    
    // Get the user data
    const userId = '684ab2f4d03dee6a5554fe2f';
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        member: true
      }
    });
    
    console.log('User data:', {
      id: user.id,
      name: user.name,
      role: user.role,
      hasMember: !!user.member
    });
    
    // Simulate the API logic for GROUP_LEADER
    if (user.role === 'GROUP_LEADER') {
      console.log('User is GROUP_LEADER, checking for led groups...');
      
      const userWithGroups = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          member: {
            select: {
              ledGroups: {
                include: {
                  leader: { select: { id: true, name: true } },
                  memberships: { select: { memberId: true } },
                }
              }
            }
          }
        }
      });
      
      console.log('User member data:', userWithGroups?.member);
      
      const groups = userWithGroups?.member?.ledGroups || [];
      console.log('Led groups:', groups);
      
      const formattedGroups = groups.map((group) => ({
        id: group.id,
        groupId: group.groupId,
        name: group.name,
        createdAt: group.createdAt,
        leaderName: group.leader?.name ?? 'N/A',
        memberCount: group.memberships.length,
      }));
      
      console.log('Formatted groups to return:', formattedGroups);
      console.log('API would return:', JSON.stringify(formattedGroups, null, 2));
    }
    
  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testGroupsAPI();
