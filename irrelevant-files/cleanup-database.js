#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDatabase() {
  console.log('🧹 Starting comprehensive database cleanup...');
  console.log('⚠️  This will remove ALL data while preserving the database structure');
  
  try {
    // Start a transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      console.log('\n📋 Cleanup order (respecting foreign key constraints):');
      
      // 1. Delete dependent records first
      console.log('1. Deleting password reset tokens...');
      const passwordResetCount = await tx.passwordResetToken.deleteMany({});
      console.log(`   ✅ Deleted ${passwordResetCount.count} password reset tokens`);

      console.log('2. Deleting pending leadership invitations...');
      const pendingLeadershipCount = await tx.pendingLeadership.deleteMany({});
      console.log(`   ✅ Deleted ${pendingLeadershipCount.count} pending leadership invitations`);

      console.log('3. Deleting loan payments...');
      const loanPaymentCount = await tx.loanPayment.deleteMany({});
      console.log(`   ✅ Deleted ${loanPaymentCount.count} loan payments`);

      console.log('4. Deleting loans...');
      const loanCount = await tx.loan.deleteMany({});
      console.log(`   ✅ Deleted ${loanCount.count} loans`);

      console.log('5. Deleting next generation members...');
      const nextGenCount = await tx.nextGenMember.deleteMany({});
      console.log(`   ✅ Deleted ${nextGenCount.count} next generation members`);

      console.log('6. Deleting group member periodic records...');
      const memberPeriodicCount = await tx.groupMemberPeriodicRecord.deleteMany({});
      console.log(`   ✅ Deleted ${memberPeriodicCount.count} member periodic records`);

      console.log('7. Deleting group periodic records...');
      const groupPeriodicCount = await tx.groupPeriodicRecord.deleteMany({});
      console.log(`   ✅ Deleted ${groupPeriodicCount.count} group periodic records`);

      console.log('8. Deleting bank transactions...');
      const bankTransactionCount = await tx.bankTransaction.deleteMany({});
      console.log(`   ✅ Deleted ${bankTransactionCount.count} bank transactions`);

      console.log('9. Deleting member group memberships...');
      const membershipCount = await tx.memberGroupMembership.deleteMany({});
      console.log(`   ✅ Deleted ${membershipCount.count} memberships`);

      console.log('10. Deleting members...');
      const memberCount = await tx.member.deleteMany({});
      console.log(`   ✅ Deleted ${memberCount.count} members`);

      console.log('11. Deleting groups...');
      const groupCount = await tx.group.deleteMany({});
      console.log(`   ✅ Deleted ${groupCount.count} groups`);

      console.log('12. Deleting user sessions...');
      const sessionCount = await tx.session.deleteMany({});
      console.log(`   ✅ Deleted ${sessionCount.count} sessions`);

      console.log('13. Deleting user accounts...');
      const accountCount = await tx.account.deleteMany({});
      console.log(`   ✅ Deleted ${accountCount.count} accounts`);

      console.log('14. Deleting verification tokens...');
      const verificationTokenCount = await tx.verificationToken.deleteMany({});
      console.log(`   ✅ Deleted ${verificationTokenCount.count} verification tokens`);

      console.log('15. Deleting users...');
      const userCount = await tx.user.deleteMany({});
      console.log(`   ✅ Deleted ${userCount.count} users`);
    });

    console.log('\n🎉 Database cleanup completed successfully!');
    console.log('📊 Summary: All user data has been removed while preserving the database structure');
    console.log('💡 The database is now ready for fresh data');
    
  } catch (error) {
    console.error('\n❌ Database cleanup failed:', error);
    console.error('🔄 Rolling back all changes...');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Add confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('⚠️  Are you sure you want to delete ALL data from the database? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    cleanupDatabase()
      .then(() => {
        console.log('\n✨ Cleanup process completed!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n💥 Cleanup process failed:', error.message);
        process.exit(1);
      });
  } else {
    console.log('❌ Cleanup cancelled by user');
    process.exit(0);
  }
  rl.close();
});
