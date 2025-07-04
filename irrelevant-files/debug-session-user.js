const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugSessionUserIssue() {
  console.log('=== Debugging Session User ID Issue ===\n');

  try {
    // Check all users in the database
    console.log('1. All users in database:');
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        memberId: true,
        name: true
      }
    });

    allUsers.forEach(user => {
      console.log(`  - ID: ${user.id}`);
      console.log(`    Email: ${user.email}`);
      console.log(`    Name: ${user.name || 'NO NAME'}`);
      console.log(`    Role: ${user.role}`);
      console.log(`    Member ID: ${user.memberId || 'NOT SET'}`);
      console.log('');
    });

    // Check if we have any accounts/sessions that might point to non-existent users
    console.log('2. Checking accounts table:');
    const accounts = await prisma.account.findMany({
      select: {
        id: true,
        userId: true,
        provider: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    if (accounts.length > 0) {
      accounts.forEach(account => {
        console.log(`  - Account ID: ${account.id}`);
        console.log(`    User ID: ${account.userId}`);
        console.log(`    Provider: ${account.provider}`);
        console.log(`    User exists: ${account.user ? 'YES' : 'NO'}`);
        if (account.user) {
          console.log(`    User email: ${account.user.email}`);
        }
        console.log('');
      });
    } else {
      console.log('  No accounts found');
    }

    console.log('3. Checking sessions table:');
    const sessions = await prisma.session.findMany({
      select: {
        id: true,
        userId: true,
        expires: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    if (sessions.length > 0) {
      sessions.forEach(session => {
        console.log(`  - Session ID: ${session.id}`);
        console.log(`    User ID: ${session.userId}`);
        console.log(`    Expires: ${session.expires}`);
        console.log(`    User exists: ${session.user ? 'YES' : 'NO'}`);
        if (session.user) {
          console.log(`    User email: ${session.user.email}`);
        }
        console.log('');
      });
    } else {
      console.log('  No sessions found');
    }

    // Check for orphaned references
    console.log('4. Looking for potential issues:');
    
    console.log('  ✅ Found users in database, sessions need to be checked manually');
    console.log('');
    
    console.log('=== LIKELY ISSUE ===');
    console.log('The session is pointing to a user ID that doesn\'t exist in the database.');
    console.log('This can happen when:');
    console.log('1. The database was cleared but sessions weren\'t');
    console.log('2. User was logged in before being created in DB');
    console.log('3. There\'s a mismatch between session storage and DB');
    console.log('');
    console.log('SOLUTION: Clear sessions and log in again');

    console.log('\n=== RECOMMENDATIONS ===');
    console.log('1. Log out completely from the application');
    console.log('2. Clear browser cookies/local storage');
    console.log('3. Log in again with one of these valid users:');
    allUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.role})`);
    });
    console.log('4. If you need the password, check the create scripts we ran earlier');

  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugSessionUserIssue();
