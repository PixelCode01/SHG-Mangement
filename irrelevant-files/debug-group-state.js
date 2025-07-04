const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugGroupState() {
  console.log('🔍 Debugging Group Financial State...\n');

  try {
    const groupId = '6847ff683e08f76916ea987d'; // The test group
    
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        groupPeriodicRecords: {
          orderBy: { meetingDate: 'desc' },
          take: 3
        },
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: { status: 'ACTIVE' }
                }
              }
            }
          }
        }
      }
    });

    if (!group) {
      console.log('❌ Group not found');
      return;
    }

    console.log(`📊 Group: ${group.name}`);
    console.log(`💰 Group Cash in Hand: ₹${group.cashInHand || 0}`);
    console.log(`🏦 Group Balance in Bank: ₹${group.balanceInBank || 0}`);
    console.log(`💵 Total Group Cash: ₹${(group.cashInHand || 0) + (group.balanceInBank || 0)}`);
    
    console.log(`\n📋 Recent Periodic Records:`);
    group.groupPeriodicRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.meetingDate.toISOString().split('T')[0]}: Standing ₹${record.totalGroupStandingAtEndOfPeriod || 0}`);
    });

    console.log(`\n💳 Member Loans:`);
    let totalActiveLoans = 0;
    let totalMembershipLoans = 0;
    
    group.memberships.forEach(membership => {
      const memberActiveLoans = membership.member.loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
      const membershipLoan = membership.currentLoanAmount || 0;
      
      if (memberActiveLoans > 0 || membershipLoan > 0) {
        console.log(`  ${membership.member.name}:`);
        console.log(`    - Active loans: ₹${memberActiveLoans}`);
        console.log(`    - Membership loan: ₹${membershipLoan}`);
      }
      
      totalActiveLoans += memberActiveLoans;
      totalMembershipLoans += membershipLoan;
    });

    console.log(`\n📊 Summary:`);
    console.log(`  Total Active Loans: ₹${totalActiveLoans}`);
    console.log(`  Total Membership Loans: ₹${totalMembershipLoans}`);
    console.log(`  Total Group Cash: ₹${(group.cashInHand || 0) + (group.balanceInBank || 0)}`);
    
    const expectedStanding = (group.cashInHand || 0) + (group.balanceInBank || 0) + Math.max(totalActiveLoans, totalMembershipLoans);
    console.log(`  Expected Total Standing: ₹${expectedStanding}`);
    
    const latestRecordStanding = group.groupPeriodicRecords[0]?.totalGroupStandingAtEndOfPeriod || 0;
    console.log(`  Latest Record Standing: ₹${latestRecordStanding}`);
    console.log(`  Difference: ₹${expectedStanding - latestRecordStanding}`);

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugGroupState();
