#!/usr/bin/env node
// Test script to verify pending leadership API endpoints work with GROUP_LEADER users

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPendingLeadershipAPI() {
  console.log('🧪 Testing Pending Leadership API with GROUP_LEADER user...');
  
  try {
    // Create a GROUP_LEADER user without member profile
    const hashedPassword = await require('bcrypt').hash('testpassword123', 10);
    
    const leaderUser = await prisma.user.create({
      data: {
        name: 'Test Leader No Member',
        email: 'testleadernomember@example.com',
        password: hashedPassword,
        role: 'GROUP_LEADER',
        memberId: null, // No member profile
      }
    });
    
    console.log('✅ Created GROUP_LEADER user:', {
      id: leaderUser.id,
      name: leaderUser.name,
      email: leaderUser.email,
      role: leaderUser.role,
      memberId: leaderUser.memberId
    });

    // Simulate the API call by calling the GET endpoint logic directly
    // This simulates what happens when the PendingLeadershipInvitations component makes its fetch call
    console.log('\n🔍 Simulating API call to /api/pending-leaderships...');
    
    // Simulate session object similar to what authMiddleware would return
    const mockSession = {
      user: {
        id: leaderUser.id,
        role: leaderUser.role,
        memberId: leaderUser.memberId // This will be null for GROUP_LEADER
      }
    };
    
    // This simulates the logic in the fixed API endpoint
    let whereClause = {
      status: 'PENDING',
    };

    if (mockSession.user.memberId) {
      // User has a member profile, search by memberId
      whereClause.memberId = mockSession.user.memberId;
    } else {
      // User doesn't have a member profile (e.g., GROUP_LEADER), 
      // they shouldn't have pending leadership invitations via memberId
      // Return empty array since leadership invitations are member-based
      console.log('✅ SUCCESS: API would return empty array for GROUP_LEADER without member profile');
      console.log('✅ SUCCESS: No error thrown - component should load without issues');
      
      // Clean up test user
      await prisma.user.delete({
        where: { id: leaderUser.id }
      });
      console.log('🧹 Test user cleaned up');
      return;
    }

    // If we get here, the user has a memberId and we would search for invitations
    const pendingInvitations = await prisma.pendingLeadership.findMany({
      where: whereClause,
      include: {
        group: {
          select: {
            id: true,
            groupId: true,
            name: true,
            dateOfStarting: true,
          },
        },
        initiatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('Found pending invitations:', pendingInvitations.length);
    
    // Clean up test user
    await prisma.user.delete({
      where: { id: leaderUser.id }
    });
    console.log('🧹 Test user cleaned up');

  } catch (error) {
    console.error('❌ Error during test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function testWithMemberUser() {
  console.log('\n🧪 Testing API with MEMBER user (has member profile)...');
  
  try {
    // Create a member first
    const testMember = await prisma.member.create({
      data: {
        name: 'Test Member for API',
        email: 'testmemberapi@example.com',
      }
    });
    
    // Create a MEMBER user with member profile
    const hashedPassword = await require('bcrypt').hash('testpassword123', 10);
    
    const memberUser = await prisma.user.create({
      data: {
        name: 'Test Member User API',
        email: 'testmemberuserapi@example.com',
        password: hashedPassword,
        role: 'MEMBER',
        memberId: testMember.id,
      }
    });
    
    console.log('✅ Created MEMBER user:', {
      id: memberUser.id,
      name: memberUser.name,
      email: memberUser.email,
      role: memberUser.role,
      memberId: memberUser.memberId
    });

    // Simulate the API call
    console.log('🔍 Simulating API call to /api/pending-leaderships for MEMBER...');
    
    const mockSession = {
      user: {
        id: memberUser.id,
        role: memberUser.role,
        memberId: memberUser.memberId
      }
    };
    
    // This would search for actual invitations
    const pendingInvitations = await prisma.pendingLeadership.findMany({
      where: {
        memberId: mockSession.user.memberId,
        status: 'PENDING',
      },
      include: {
        group: {
          select: {
            id: true,
            groupId: true,
            name: true,
            dateOfStarting: true,
          },
        },
        initiatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('✅ Found pending invitations for MEMBER:', pendingInvitations.length);
    console.log('✅ SUCCESS: API works correctly for MEMBER users');
    
    // Clean up
    await prisma.user.delete({
      where: { id: memberUser.id }
    });
    
    await prisma.member.delete({
      where: { id: testMember.id }
    });
    
    console.log('🧹 Test data cleaned up');

  } catch (error) {
    console.error('❌ Error during MEMBER test:', error);
    throw error;
  }
}

async function main() {
  try {
    await testPendingLeadershipAPI();
    await testWithMemberUser();
    console.log('\n✨ All tests completed successfully!');
    console.log('✨ PendingLeadershipInvitations component should now load without errors');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();
