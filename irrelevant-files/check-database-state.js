const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabaseState() {
  try {
    console.log('=== CHECKING DATABASE STATE ===\n');

    // Check groups
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        balanceInBank: true,
        cashInHand: true,
        monthlyContribution: true
      }
    });

    console.log(`GROUPS: ${groups.length} found`);
    groups.forEach(group => {
      console.log(`  - ${group.name} (${group.id})`);
      console.log(`    Balance: ₹${group.balanceInBank || 0}, Cash: ₹${group.cashInHand || 0}`);
    });

    // Check periods for each group
    for (const group of groups) {
      const periods = await prisma.groupPeriodicRecord.findMany({
        where: { groupId: group.id },
        select: {
          id: true,
          recordSequenceNumber: true,
          totalCollectionThisPeriod: true,
          meetingDate: true
        },
        orderBy: { recordSequenceNumber: 'desc' }
      });

      console.log(`\n  PERIODS for ${group.name}: ${periods.length} found`);
      periods.forEach(period => {
        const status = period.totalCollectionThisPeriod === null ? 'OPEN' : 'CLOSED';
        console.log(`    - Period #${period.recordSequenceNumber}: ${status} (${period.id})`);
        console.log(`      Collection: ₹${period.totalCollectionThisPeriod || 'Not set'}`);
      });

      // Check members through memberships
      const memberships = await prisma.memberGroupMembership.findMany({
        where: { groupId: group.id },
        include: {
          member: {
            select: {
              id: true,
              name: true,
              currentLoanAmount: true
            }
          }
        }
      });

      console.log(`\n  MEMBERS for ${group.name}: ${memberships.length} found`);
      if (memberships.length > 0) {
        console.log(`    First few: ${memberships.slice(0, 3).map(m => m.member.name).join(', ')}`);
      }

      // Check contributions for open periods
      const openPeriods = periods.filter(p => p.totalCollectionThisPeriod === null);
      if (openPeriods.length > 0) {
        const openPeriod = openPeriods[0];
        const contributions = await prisma.memberContribution.findMany({
          where: { groupPeriodicRecordId: openPeriod.id },
          select: {
            id: true,
            status: true,
            totalPaid: true,
            remainingAmount: true
          }
        });

        console.log(`\n  CONTRIBUTIONS for open period: ${contributions.length} found`);
        const paidCount = contributions.filter(c => c.status === 'PAID').length;
        console.log(`    Paid: ${paidCount}, Pending: ${contributions.length - paidCount}`);
      }
    }

    console.log('\n=== DATABASE STATE CHECK COMPLETE ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseState();
