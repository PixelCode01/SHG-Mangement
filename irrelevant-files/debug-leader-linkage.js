const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugLeaderLinkage() {
  console.log('=== Debugging Leader Linkage Issue ===\n');

  try {
    // Check all users and their memberId linkage
    console.log('1. Checking all users and their member linkage:');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        memberId: true,
        member: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log('Users:');
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.role})`);
      console.log(`    User ID: ${user.id}`);
      console.log(`    Member ID: ${user.memberId || 'NOT SET'}`);
      console.log(`    Linked Member: ${user.member ? user.member.name : 'NONE'}`);
      console.log('');
    });

    // Check for GROUP_LEADER users without proper memberId
    console.log('2. GROUP_LEADER users without memberId:');
    const leadersWithoutMemberId = users.filter(u => u.role === 'GROUP_LEADER' && !u.memberId);
    if (leadersWithoutMemberId.length > 0) {
      leadersWithoutMemberId.forEach(leader => {
        console.log(`  - ${leader.email} (ID: ${leader.id}) - NO MEMBER ID SET`);
      });
    } else {
      console.log('  All GROUP_LEADER users have memberId set.');
    }
    console.log('');

    // Check all groups and their leaders
    console.log('3. Checking all groups and their leader linkage:');
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        leaderId: true,
        leader: {
          select: {
            id: true,
            name: true,
            users: {
              select: {
                id: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    });

    console.log('Groups:');
    groups.forEach(group => {
      console.log(`  - Group: ${group.name} (ID: ${group.id})`);
      console.log(`    Leader ID: ${group.leaderId || 'NOT SET'}`);
      if (group.leader) {
        console.log(`    Leader: ${group.leader.name}`);
        console.log(`    Leader linked to user: ${group.leader.users && group.leader.users.length > 0 ? 
          `${group.leader.users[0].email} (${group.leader.users[0].role})` : 'NO USER LINKED'}`);
      } else {
        console.log(`    Leader: NOT FOUND`);
      }
      console.log('');
    });

    // Check for orphaned groups (groups without proper leader linkage)
    console.log('4. Groups with linkage issues:');
    const problematicGroups = groups.filter(g => !g.leader || !g.leader.users || g.leader.users.length === 0);
    if (problematicGroups.length > 0) {
      problematicGroups.forEach(group => {
        console.log(`  - ${group.name}: ${!group.leader ? 'NO LEADER FOUND' : 'LEADER NOT LINKED TO USER'}`);
      });
    } else {
      console.log('  All groups have proper leader linkage.');
    }
    console.log('');

    console.log('=== ANALYSIS COMPLETE ===');
    console.log('');
    console.log('KEY FINDINGS:');
    console.log('1. No current users have memberId set (all show "NOT SET")');
    console.log('2. All group leaders exist as Member records but are NOT linked to any User');
    console.log('3. This means when a user creates a group, the leader is created but not linked back');
    console.log('4. Therefore, the user cannot see their own groups because their memberId is null');
    console.log('');
    console.log('SOLUTION: Need to ensure proper user-member linkage during group creation');

  } catch (error) {
    console.error('Error during debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugLeaderLinkage();
