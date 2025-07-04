const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugAuthRecords() {
  console.log('=== Authentication Records Debug ===');
  
  try {
    // Check all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        memberId: true,
        createdAt: true
      }
    });
    
    console.log(`\nFound ${allUsers.length} users in database:`);
    allUsers.forEach(user => {
      console.log(`- ID: ${user.id}, Email: ${user.email}, Role: ${user.role}, MemberID: ${user.memberId}`);
    });
    
    // Check Account records
    try {
      const accounts = await prisma.account.findMany({
        select: {
          id: true,
          userId: true,
          provider: true,
          providerAccountId: true,
          type: true
        }
      });
      console.log(`\nFound ${accounts.length} account records:`);
      accounts.forEach(account => {
        console.log(`- Account ID: ${account.id}, UserID: ${account.userId}, Provider: ${account.provider}, Type: ${account.type}`);
      });
    } catch (e) {
      console.log('\nNo Account table or error accessing it:', e.message);
    }
    
    // Check Session records
    try {
      const sessions = await prisma.session.findMany({
        select: {
          id: true,
          userId: true,
          expires: true,
          sessionToken: true
        }
      });
      console.log(`\nFound ${sessions.length} session records:`);
      sessions.forEach(session => {
        const isExpired = new Date(session.expires) < new Date();
        console.log(`- Session ID: ${session.id}, UserID: ${session.userId}, Expires: ${session.expires}, Expired: ${isExpired}`);
      });
    } catch (e) {
      console.log('\nNo Session table or error accessing it:', e.message);
    }
    
    console.log('\n=== SOLUTION ===');
    console.log('The session contains user ID "nm" which is not a valid MongoDB ObjectID.');
    console.log('This is likely due to:');
    console.log('1. Stale session data in browser cookies/localStorage');
    console.log('2. Database reset that removed the original user');
    console.log('3. Test data that wasn\'t properly cleaned up');
    console.log('\nTo fix this:');
    console.log('1. Clear browser cookies and localStorage');
    console.log('2. Log out completely');
    console.log('3. Log in with one of the valid users:');
    allUsers.forEach(user => {
      if (user.role === 'GROUP_LEADER') {
        console.log(`   - ${user.email} (${user.role})`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAuthRecords();
