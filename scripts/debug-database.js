// Debug script to check the database structure and content
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function debugDatabase() {
  try {
    console.log('=== DATABASE DEBUG ===');
    
    // Check if we can connect to the database
    await prisma.$connect();
    console.log('✅ Connected to database');
    
    // Check Users table
    const userCount = await prisma.user.count();
    console.log(`Found ${userCount} users`);
    
    if (userCount > 0) {
      const users = await prisma.user.findMany({
        take: 3,
        include: {
          member: true
        }
      });
      
      console.log('Sample users:');
      users.forEach(user => {
        console.log(`- ${user.name} (${user.id}), email: ${user.email}, role: ${user.role}, memberId: ${user.memberId}`);
        if (user.member) {
          console.log(`  Linked to member: ${user.member.name}`);
        }
      });
    }
    
    // Check Members table
    const memberCount = await prisma.member.count();
    console.log(`\nFound ${memberCount} members`);
    
    if (memberCount > 0) {
      const members = await prisma.member.findMany({
        take: 3,
        include: {
          users: true
        }
      });
      
      console.log('Sample members:');
      members.forEach(member => {
        console.log(`- ${member.name} (${member.id})`);
        if (member.users && member.users.length > 0) {
          console.log(`  Linked to users: ${member.users.map(u => u.email).join(', ')}`);
        }
      });
    }
    
    // Check Groups table
    const groupCount = await prisma.group.count();
    console.log(`\nFound ${groupCount} groups`);
    
    if (groupCount > 0) {
      const groups = await prisma.group.findMany({
        take: 3,
        include: {
          leader: true,
          memberships: {
            include: {
              member: true
            }
          }
        }
      });
      
      console.log('Sample groups:');
      groups.forEach(group => {
        console.log(`- ${group.name} (${group.id}), Group ID: ${group.groupId}`);
        if (group.leader) {
          console.log(`  Leader: ${group.leader.name} (${group.leader.id})`);
        } else {
          console.log(`  No leader assigned`);
        }
        console.log(`  Members: ${group.memberships.length}`);
        group.memberships.forEach(membership => {
          console.log(`    - ${membership.member.name}`);
        });
      });
    }
    
    // Check PendingLeadership table
    const pendingLeadershipCount = await prisma.pendingLeadership.count();
    console.log(`\nFound ${pendingLeadershipCount} pending leadership invitations`);
    
    if (pendingLeadershipCount > 0) {
      const pendingLeaderships = await prisma.pendingLeadership.findMany({
        include: {
          group: true,
          member: true,
          initiatedByUser: true
        }
      });
      
      console.log('Pending leadership invitations:');
      pendingLeaderships.forEach(invitation => {
        console.log(`- ID: ${invitation.id}`);
        console.log(`  Group: ${invitation.group ? invitation.group.name : 'Unknown'} (${invitation.groupId})`);
        console.log(`  Member: ${invitation.member ? invitation.member.name : 'Unknown'} (${invitation.memberId})`);
        console.log(`  Status: ${invitation.status}`);
        console.log(`  Initiated by: ${invitation.initiatedByUser ? invitation.initiatedByUser.name : 'Unknown'}`);
        console.log(`  Created at: ${invitation.createdAt}`);
      });
    }
    
  } catch (error) {
    console.error('Error debugging database:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\n=== DEBUG COMPLETE ===');
  }
}

debugDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
