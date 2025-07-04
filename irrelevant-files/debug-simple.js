const { PrismaClient } = require('@prisma/client');

async function debugSimple() {
  console.log('Starting debug...');
  const prisma = new PrismaClient();
  
  try {
    console.log('Getting group data...');
    
    const group = await prisma.group.findUnique({
      where: { id: '6847e1af178e279a3c1f546a' },
      include: {
        groupPeriodicRecords: {
          orderBy: { meetingDate: 'desc' },
          take: 2,
          include: {
            memberContributions: {
              include: {
                member: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    if (!group) {
      console.log('No group found');
      return;
    }

    console.log(`Group: ${group.name}, Members: ${group.memberCount}`);
    console.log(`Periods found: ${group.groupPeriodicRecords.length}`);
    
    for (const period of group.groupPeriodicRecords) {
      console.log(`\nPeriod: ${period.meetingDate}`);
      console.log(`- New Contributions: ₹${period.newContributionsThisPeriod || 0}`);
      console.log(`- Interest Earned: ₹${period.interestEarnedThisPeriod || 0}`);
      console.log(`- Late Fines: ₹${period.lateFinesCollectedThisPeriod || 0}`);
      console.log(`- Total Collection: ₹${period.totalCollectionThisPeriod || 0}`);
      console.log(`- Member contributions: ${period.memberContributions.length}`);
      
      // Quick calculation from member contributions
      let totalExpected = 0;
      let totalPaid = 0;
      
      period.memberContributions.forEach(contrib => {
        const expected = (contrib.compulsoryContributionDue || 0) + 
                        (contrib.loanInterestDue || 0) + 
                        (contrib.lateFineAmount || 0);
        const paid = (contrib.compulsoryContributionPaid || 0) + 
                    (contrib.loanInterestPaid || 0) + 
                    (contrib.lateFinePaid || 0);
        
        totalExpected += expected;
        totalPaid += paid;
      });
      
      console.log(`- Calculated Expected: ₹${totalExpected.toFixed(2)}`);
      console.log(`- Calculated Paid: ₹${totalPaid.toFixed(2)}`);
      console.log(`- Remaining: ₹${(totalExpected - totalPaid).toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

console.log('Script loaded, calling function...');
debugSimple().then(() => {
  console.log('Function completed');
}).catch(err => {
  console.error('Function error:', err);
});
