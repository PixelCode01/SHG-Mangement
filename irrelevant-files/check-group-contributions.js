const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGroupContributions() {
  const groupId = '68481425f418d2300b2df585';
  
  try {
    // Get group details
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: { member: true }
        }
      }
    });

    if (!group) {
      console.log("Group not found!");
      return;
    }

    console.log("=== GROUP INFO ===");
    console.log(`Name: ${group.name}`);
    console.log(`ID: ${group.id}`);
    console.log(`Members: ${group.memberships.length}`);
    console.log(`Cash in Bank: ₹${group.balanceInBank || 0}`);
    console.log(`Cash in Hand: ₹${group.cashInHand || 0}`);
    console.log(`Monthly Contribution: ₹${group.monthlyContribution || 0}`);
    console.log(`Interest Rate: ${group.interestRate || 0}%`);
    
    // Get periodic records for this group
    const periodicRecords = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: groupId },
      orderBy: { meetingDate: 'desc' },
      include: {
        memberContributions: true
      }
    });
    
    console.log("\n=== PERIODIC RECORDS ===");
    for (const record of periodicRecords) {
      console.log(`\nRecord ID: ${record.id}`);
      console.log(`Meeting Date: ${record.meetingDate}`);
      console.log(`Sequence: ${record.recordSequenceNumber}`);
      console.log(`Standing at Start: ₹${record.standingAtStartOfPeriod || 0}`);
      console.log(`Total Group Standing at End: ₹${record.totalGroupStandingAtEndOfPeriod || 0}`);
      console.log(`Cash in Hand: ₹${record.cashInHandAtEndOfPeriod || 0}`);
      console.log(`Cash in Bank: ₹${record.cashInBankAtEndOfPeriod || 0}`);
      
      // Calculate what the total standing should be
      const cashInHand = record.cashInHandAtEndOfPeriod || 0;
      const cashInBank = record.cashInBankAtEndOfPeriod || 0;
      
      // Get active loans as of this record's date
      const activeLoans = await prisma.loan.findMany({
        where: {
          groupId: groupId,
          status: 'ACTIVE',
          createdAt: { lte: record.meetingDate }
        }
      });
      
      const totalLoanAssets = activeLoans.reduce((sum, loan) => sum + (loan.currentBalance || 0), 0);
      const correctTotalStanding = cashInHand + cashInBank + totalLoanAssets;
      
      console.log(`Active Loans: ${activeLoans.length}`);
      console.log(`Total Loan Assets: ₹${totalLoanAssets}`);
      console.log(`Correct Total Standing: ₹${correctTotalStanding}`);
      console.log(`Difference: ₹${correctTotalStanding - (record.totalGroupStandingAtEndOfPeriod || 0)}`);
      
      console.log(`Contributions: ${record.memberContributions.length}`);
    }
    
    // Get active loans
    const activeLoans = await prisma.loan.findMany({
      where: {
        groupId: groupId,
        status: 'ACTIVE'
      },
      include: {
        member: true
      }
    });
    
    console.log("\n=== ACTIVE LOANS ===");
    console.log(`Total Active Loans: ${activeLoans.length}`);
    
    let totalLoanBalance = 0;
    for (const loan of activeLoans) {
      console.log(`\nLoan ID: ${loan.id}`);
      console.log(`Member: ${loan.member?.name || 'Unknown'}`);
      console.log(`Original Amount: ₹${loan.originalAmount || 0}`);
      console.log(`Current Balance: ₹${loan.currentBalance || 0}`);
      console.log(`Interest Rate: ${loan.interestRate || 0}%`);
      totalLoanBalance += loan.currentBalance || 0;
    }
    
    console.log(`\nTotal Loan Balance: ₹${totalLoanBalance}`);
    
    // Calculate what the total standing should be
    const cashInHand = group.cashInHand || 0;
    const cashInBank = group.balanceInBank || 0;
    const currentTotalStanding = cashInHand + cashInBank + totalLoanBalance;
    
    console.log("\n=== CURRENT TOTALS ===");
    console.log(`Cash in Hand: ₹${cashInHand}`);
    console.log(`Cash in Bank: ₹${cashInBank}`);
    console.log(`Total Loan Assets: ₹${totalLoanBalance}`);
    console.log(`Current Total Standing: ₹${currentTotalStanding}`);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGroupContributions().catch(console.error);
