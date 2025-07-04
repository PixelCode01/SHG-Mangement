const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugPeriodQuery() {
  try {
    console.log('=== DEBUGGING PERIOD QUERY ===\n');

    // Check all periods
    const allPeriods = await prisma.groupPeriodicRecord.findMany({
      select: {
        id: true,
        recordSequenceNumber: true,
        totalCollectionThisPeriod: true,
        meetingDate: true,
        group: {
          select: {
            name: true
          }
        }
      }
    });

    console.log(`ALL PERIODS: ${allPeriods.length} found`);
    allPeriods.forEach(period => {
      console.log(`  - Period #${period.recordSequenceNumber} (${period.id})`);
      console.log(`    Group: ${period.group.name}`);
      console.log(`    Collection: ${period.totalCollectionThisPeriod} (${period.totalCollectionThisPeriod === null ? 'NULL/OPEN' : 'SET/CLOSED'})`);
      console.log(`    Date: ${period.meetingDate}`);
    });

    // Test different query variations
    console.log('\n=== TESTING DIFFERENT QUERIES ===');

    const query1 = await prisma.groupPeriodicRecord.findFirst({
      where: {
        totalCollectionThisPeriod: null
      }
    });
    console.log(`Query with null: ${query1 ? 'Found' : 'Not found'}`);

    const query2 = await prisma.groupPeriodicRecord.findFirst({
      where: {
        totalCollectionThisPeriod: { equals: null }
      }
    });
    console.log(`Query with equals null: ${query2 ? 'Found' : 'Not found'}`);

    const query3 = await prisma.groupPeriodicRecord.findFirst({
      where: {
        totalCollectionThisPeriod: { not: { not: null } }
      }
    });
    console.log(`Query with double negative: ${query3 ? 'Found' : 'Not found'}`);

    const query4 = await prisma.groupPeriodicRecord.findFirst({
      where: {
        OR: [
          { totalCollectionThisPeriod: null },
          { totalCollectionThisPeriod: { equals: null } }
        ]
      }
    });
    console.log(`Query with OR: ${query4 ? 'Found' : 'Not found'}`);

    // Try just getting the first one
    const firstPeriod = await prisma.groupPeriodicRecord.findFirst();
    console.log(`First period query: ${firstPeriod ? 'Found' : 'Not found'}`);
    if (firstPeriod) {
      console.log(`  Collection value: ${firstPeriod.totalCollectionThisPeriod}`);
      console.log(`  Type: ${typeof firstPeriod.totalCollectionThisPeriod}`);
      console.log(`  Is null: ${firstPeriod.totalCollectionThisPeriod === null}`);
      console.log(`  Is undefined: ${firstPeriod.totalCollectionThisPeriod === undefined}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPeriodQuery();
