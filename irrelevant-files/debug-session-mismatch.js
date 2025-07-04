const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugSessionMismatch() {
  console.log('=== Session User Debug ===');
  
  try {
    // Check all users in the database
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        memberId: true,
        createdAt: true
      }
    });
    
    console.log('\nAll users in database:');
    allUsers.forEach(user => {
      console.log(`- ID: ${user.id}, Email: ${user.email}, Role: ${user.role}, MemberID: ${user.memberId}`);
    });
    
    // The session shows "User: nm" - let's check if there's a user with email containing "nm"
    const nmUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'nm' } },
          { email: { contains: 'NM' } },
          { id: { contains: 'nm' } },
          { id: { contains: 'NM' } }
        ]
      }
    });
    
    console.log('\nUsers matching "nm":');
    nmUsers.forEach(user => {
      console.log(`- ID: ${user.id}, Email: ${user.email}, Role: ${user.role}`);
    });
    
    // Check if there are any sessions or accounts that might be causing issues
    console.log('\nChecking for authentication records...');
    
    // Check if there are Account records
    try {
      const accounts = await prisma.account.findMany({
        select: {
          id: true,
          userId: true,
          provider: true,
          providerAccountId: true
        }
      });
      console.log(`Found ${accounts.length} account records`);
      accounts.forEach(account => {
        console.log(`- Account: ${account.id}, UserID: ${account.userId}, Provider: ${account.provider}`);
      });
    } catch (e) {
      console.log('No Account table or error accessing it:', e.message);
    }
    
    // Check if there are Session records
    try {
      const sessions = await prisma.session.findMany({
        select: {
          id: true,
          userId: true,
          expires: true,
          sessionToken: true
        }
      });
      console.log(`Found ${sessions.length} session records`);
      sessions.forEach(session => {
        console.log(`- Session: ${session.id}, UserID: ${session.userId}, Expires: ${session.expires}`);
      });
    } catch (e) {
      console.log('No Session table or error accessing it:', e.message);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugSessionMismatch();
