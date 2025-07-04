#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDatabaseDirect() {
  console.log('🧹 Starting direct database cleanup...');
  
  try {
    // Delete in proper order to respect foreign key constraints
    const results = {};
    
    results.passwordResetTokens = await prisma.passwordResetToken.deleteMany({});
    results.pendingLeaderships = await prisma.pendingLeadership.deleteMany({});
    results.loanPayments = await prisma.loanPayment.deleteMany({});
    results.loans = await prisma.loan.deleteMany({});
    results.nextGenMembers = await prisma.nextGenMember.deleteMany({});
    results.groupMemberPeriodicRecords = await prisma.groupMemberPeriodicRecord.deleteMany({});
    results.groupPeriodicRecords = await prisma.groupPeriodicRecord.deleteMany({});
    results.bankTransactions = await prisma.bankTransaction.deleteMany({});
    results.memberships = await prisma.memberGroupMembership.deleteMany({});
    results.members = await prisma.member.deleteMany({});
    results.groups = await prisma.group.deleteMany({});
    results.sessions = await prisma.session.deleteMany({});
    results.accounts = await prisma.account.deleteMany({});
    results.verificationTokens = await prisma.verificationToken.deleteMany({});
    results.users = await prisma.user.deleteMany({});

    console.log('\n📊 Cleanup Results:');
    Object.entries(results).forEach(([table, result]) => {
      console.log(`   ${table}: ${result.count} records deleted`);
    });

    const totalDeleted = Object.values(results).reduce((sum, result) => sum + result.count, 0);
    console.log(`\n✅ Total records deleted: ${totalDeleted}`);
    console.log('🎉 Database cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDatabaseDirect()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
