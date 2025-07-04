const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzePeriods() {
  console.log('🔍 Analyzing All Periods for Group');
  
  try {
    const groupId = '684be1467bb9974051bd19cc';
    
    // Get all periods for this group
    const allPeriods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId },
      orderBy: { meetingDate: 'desc' },
      select: {
        id: true,
        meetingDate: true,
        recordSequenceNumber: true,
        totalCollectionThisPeriod: true
      }
    });
    
    console.log(`\n📊 Found ${allPeriods.length} periods:`);
    
    allPeriods.forEach((period, index) => {
      const isClosed = period.totalCollectionThisPeriod !== null;
      const status = isClosed ? 'CLOSED' : 'OPEN';
      console.log(`${index + 1}. ${period.meetingDate.toDateString()} - Seq:${period.recordSequenceNumber} - Collection:${period.totalCollectionThisPeriod} - ${status}`);
    });
    
    // Now test the API logic
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-based: June=5
    const currentYear = today.getFullYear();
    
    console.log(`\n📅 API Logic Test - Current Month: ${currentMonth + 1}/${currentYear} (Index: ${currentMonth})`);
    
    // Step 1: Look for current month period that's open
    const currentMonthOpenPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { 
        groupId,
        meetingDate: {
          gte: new Date(currentYear, currentMonth, 1),
          lt: new Date(currentYear, currentMonth + 1, 1)
        },
        OR: [
          { totalCollectionThisPeriod: null },
          { totalCollectionThisPeriod: 0 }
        ]
      },
      orderBy: [
        { meetingDate: 'desc' },
        { recordSequenceNumber: 'desc' }
      ]
    });
    
    console.log(`\n🔍 Step 1 - Current Month Open Period: ${currentMonthOpenPeriod ? 'FOUND' : 'NOT FOUND'}`);
    if (currentMonthOpenPeriod) {
      console.log(`   - Date: ${currentMonthOpenPeriod.meetingDate.toDateString()}`);
      console.log(`   - Collection: ${currentMonthOpenPeriod.totalCollectionThisPeriod}`);
    }
    
    // Step 2: Look for any open period
    if (!currentMonthOpenPeriod) {
      const anyOpenPeriod = await prisma.groupPeriodicRecord.findFirst({
        where: { 
          groupId,
          OR: [
            { totalCollectionThisPeriod: null },
            { totalCollectionThisPeriod: 0 }
          ]
        },
        orderBy: [
          { recordSequenceNumber: 'desc' },
          { meetingDate: 'desc' }
        ]
      });
      
      console.log(`🔍 Step 2 - Any Open Period: ${anyOpenPeriod ? 'FOUND' : 'NOT FOUND'}`);
      if (anyOpenPeriod) {
        console.log(`   - Date: ${anyOpenPeriod.meetingDate.toDateString()}`);
        console.log(`   - Collection: ${anyOpenPeriod.totalCollectionThisPeriod}`);
        console.log(`   - This would be returned by the API`);
      }
    } else {
      console.log(`✅ Current month open period would be returned by the API`);
    }
    
    console.log(`\n🎯 Expected Frontend Behavior:`);
    const activePeriod = currentMonthOpenPeriod || allPeriods.find(p => p.totalCollectionThisPeriod === null);
    if (activePeriod) {
      const isClosed = activePeriod.totalCollectionThisPeriod !== null;
      console.log(`- Period Status: ${isClosed ? 'CLOSED' : 'OPEN'}`);
      console.log(`- Red Banner: ${isClosed ? 'VISIBLE' : 'HIDDEN'}`);
      console.log(`- Buttons: ${isClosed ? 'DISABLED ("Period Closed")' : 'ACTIVE ("Mark Paid/Unpaid")'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzePeriods();
