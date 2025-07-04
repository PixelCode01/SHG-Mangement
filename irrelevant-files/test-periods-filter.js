const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPeriodsFiltering() {
  try {
    const group = await prisma.group.findFirst();
    if (!group) {
      console.log('❌ No group found');
      return;
    }

    console.log(`✅ Testing with group: ${group.name}`);

    // Get all periods
    const allPeriods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: group.id },
      orderBy: { meetingDate: 'desc' },
      select: {
        id: true,
        meetingDate: true,
        totalCollectionThisPeriod: true
      }
    });

    console.log(`📊 Total periods in database: ${allPeriods.length}`);
    allPeriods.forEach((p, i) => {
      console.log(`   ${i+1}. Total: ${p.totalCollectionThisPeriod}, Date: ${p.meetingDate.toISOString().split('T')[0]}`);
    });

    // Test the API filter (periods with totalCollectionThisPeriod > 0)
    const closedPeriodsAPI = await prisma.groupPeriodicRecord.findMany({
      where: { 
        groupId: group.id,
        totalCollectionThisPeriod: { gt: 0 }
      }
    });

    console.log(`\n🔍 Periods returned by API (totalCollectionThisPeriod > 0): ${closedPeriodsAPI.length}`);
    
    // Test the frontend filter
    const closedPeriodsFrontend = allPeriods.filter(period => 
      period.totalCollectionThisPeriod !== null && 
      period.totalCollectionThisPeriod !== undefined &&
      period.totalCollectionThisPeriod > 0
    );

    console.log(`🎨 Periods filtered by frontend: ${closedPeriodsFrontend.length}`);

    if (closedPeriodsAPI.length === 0 && closedPeriodsFrontend.length === 0) {
      console.log('\n✅ SUCCESS: No periods shown in View History - the issue is fixed!');
    } else {
      console.log('\n❌ ISSUE: Periods are still being shown in View History');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPeriodsFiltering();
