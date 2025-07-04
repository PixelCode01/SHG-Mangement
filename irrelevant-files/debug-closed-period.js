const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
const prisma = new PrismaClient();

async function debugClosedPeriod() {
  const groupId = '68481425f418d2300b2df585';
  
  try {
    // Get the latest period record for this group
    const latestPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId: groupId },
      orderBy: { recordSequenceNumber: 'desc' },
      include: {
        memberContributions: {
          include: {
            member: true
          }
        }
      }
    });
    
    if (!latestPeriod) {
      console.log("No period records found for this group!");
      return;
    }
    
    console.log("=== LATEST PERIOD RECORD ===");
    console.log(`ID: ${latestPeriod.id}`);
    console.log(`Meeting Date: ${latestPeriod.meetingDate}`);
    console.log(`Sequence Number: ${latestPeriod.recordSequenceNumber}`);
    console.log(`Standing at Start: ₹${latestPeriod.standingAtStartOfPeriod || 0}`);
    console.log(`Total Group Standing at End: ₹${latestPeriod.totalGroupStandingAtEndOfPeriod || 0}`);
    console.log(`Cash in Hand at End: ₹${latestPeriod.cashInHandAtEndOfPeriod || 0}`);
    console.log(`Cash in Bank at End: ₹${latestPeriod.cashInBankAtEndOfPeriod || 0}`);
    console.log(`Total Collection: ₹${latestPeriod.totalCollectionThisPeriod || 0}`);
    
    // Get active loans
    const activeLoans = await prisma.loan.findMany({
      where: {
        groupId: groupId,
        status: 'ACTIVE',
        createdAt: { lte: latestPeriod.meetingDate }
      }
    });
    
    const totalLoanAssets = activeLoans.reduce((sum, loan) => sum + (loan.currentBalance || 0), 0);
    console.log(`Active Loans: ${activeLoans.length}`);
    console.log(`Total Loan Assets: ₹${totalLoanAssets}`);
    
    // Calculate what the standing should be
    const cash = latestPeriod.cashInHandAtEndOfPeriod || 0;
    const bank = latestPeriod.cashInBankAtEndOfPeriod || 0;
    const correctStanding = cash + bank + totalLoanAssets;
    
    console.log(`Correct Standing: ₹${correctStanding}`);
    console.log(`Difference: ₹${correctStanding - (latestPeriod.totalGroupStandingAtEndOfPeriod || 0)}`);
    
    // Check the group's current totals
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });
    
    console.log("\n=== GROUP CURRENT STATE ===");
    console.log(`Cash in Hand: ₹${group.cashInHand || 0}`);
    console.log(`Cash in Bank: ₹${group.balanceInBank || 0}`);
    console.log(`Membership Count: ${await prisma.memberGroupMembership.count({ where: { groupId } })}`);
    
    // Check if the previous period is correct
    if (latestPeriod.recordSequenceNumber > 1) {
      const previousPeriod = await prisma.groupPeriodicRecord.findFirst({
        where: {
          groupId: groupId,
          recordSequenceNumber: (latestPeriod.recordSequenceNumber || 0) - 1
        }
      });
      
      if (previousPeriod) {
        console.log("\n=== PREVIOUS PERIOD ===");
        console.log(`ID: ${previousPeriod.id}`);
        console.log(`Meeting Date: ${previousPeriod.meetingDate}`);
        console.log(`Standing at Start: ₹${previousPeriod.standingAtStartOfPeriod || 0}`);
        console.log(`Total Group Standing at End: ₹${previousPeriod.totalGroupStandingAtEndOfPeriod || 0}`);
        console.log(`Cash in Hand at End: ₹${previousPeriod.cashInHandAtEndOfPeriod || 0}`);
        console.log(`Cash in Bank at End: ₹${previousPeriod.cashInBankAtEndOfPeriod || 0}`);
        
        // Check if standing values are correct
        console.log(`Previous ending == Current starting?: ${previousPeriod.totalGroupStandingAtEndOfPeriod === latestPeriod.standingAtStartOfPeriod ? 'Yes ✓' : 'No ✗'}`);
      }
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugClosedPeriod().catch(console.error);
