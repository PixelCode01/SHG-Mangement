const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAllPeriodsForGroup() {
  try {
    console.log('=== Checking All Periods for Groups ===');
    
    // Get all groups with all their periods
    const groups = await prisma.group.findMany({
      include: {
        groupPeriodicRecords: {
          orderBy: { recordSequenceNumber: 'desc' },
        }
      }
    });
    
    for (const group of groups) {
      console.log(`\n📊 Group: ${group.name} (ID: ${group.id})`);
      console.log(`   Total Periods: ${group.groupPeriodicRecords.length}`);
      
      if (group.groupPeriodicRecords.length > 0) {
        console.log(`   All Periods:`);
        group.groupPeriodicRecords.forEach((period, index) => {
          const isOpen = period.totalCollectionThisPeriod === null || period.totalCollectionThisPeriod === 0;
          const status = isOpen ? 'OPEN' : 'CLOSED';
          console.log(`     ${index + 1}. Period #${period.recordSequenceNumber || 'N/A'} [${status}]`);
          console.log(`        - Meeting Date: ${period.meetingDate.toLocaleDateString()}`);
          console.log(`        - Total Collection: ₹${period.totalCollectionThisPeriod?.toFixed(2) || '0.00'}`);
          console.log(`        - Created: ${period.createdAt.toLocaleString()}`);
        });
        
        // Check if there's an open period that should be the "current" one
        const openPeriods = group.groupPeriodicRecords.filter(p => 
          p.totalCollectionThisPeriod === null || p.totalCollectionThisPeriod === 0
        );
        
        if (openPeriods.length > 0) {
          console.log(`\n   🔓 Open Periods: ${openPeriods.length}`);
          openPeriods.forEach(period => {
            console.log(`     - Period #${period.recordSequenceNumber} (${period.meetingDate.toLocaleDateString()})`);
          });
        } else {
          console.log(`\n   ⚠️  No open periods found - may need to create a new period`);
        }
        
        // Check latest period for member contributions
        const latestPeriod = group.groupPeriodicRecords[0];
        const contributionCount = await prisma.memberContribution.count({
          where: { groupPeriodicRecordId: latestPeriod.id }
        });
        
        console.log(`\n   📝 Latest Period (#${latestPeriod.recordSequenceNumber}) has ${contributionCount} member contributions`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking periods:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllPeriodsForGroup();
