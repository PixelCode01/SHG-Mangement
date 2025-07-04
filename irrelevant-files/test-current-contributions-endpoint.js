const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCurrentContributionsEndpoint() {
  const groupId = '68483f7957a0ff01552c98aa';
  
  console.log('🔍 Testing Current Contributions Endpoint Logic...');
  console.log('=================================================');

  try {
    // Simulate the exact query from the current contributions endpoint
    const currentRecord = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId },
      orderBy: { meetingDate: 'desc' },
      include: {
        memberContributions: {
          include: {
            member: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              }
            }
          }
        }
      }
    });

    if (!currentRecord) {
      console.log('❌ No current record found');
      return;
    }

    const date = new Date(currentRecord.meetingDate);
    const month = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    console.log(`\n📊 Current Record Found:`);
    console.log(`  ID: ${currentRecord.id}`);
    console.log(`  Meeting Date: ${currentRecord.meetingDate.toISOString().split('T')[0]}`);
    console.log(`  Month: ${month}`);
    console.log(`  Sequence: ${currentRecord.recordSequenceNumber}`);
    console.log(`  Standing: ₹${currentRecord.totalGroupStandingAtEndOfPeriod || 0}`);
    console.log(`  Member Contributions: ${currentRecord.memberContributions.length}`);

    // Check if this is the expected August record
    const isAugust = date.getMonth() === 7 && date.getFullYear() === 2025; // August = month 7
    console.log(`  Is August 2025: ${isAugust ? 'YES ✓' : 'NO ✗'}`);

    if (!isAugust) {
      console.log(`\n⚠️ PROBLEM FOUND: Current endpoint is NOT returning August!`);
      console.log(`Expected: August 2025, Got: ${month}`);
      
      // Let's see all records ordered by date desc
      console.log(`\n🔍 All records ordered by meetingDate desc:`);
      const allRecords = await prisma.groupPeriodicRecord.findMany({
        where: { groupId },
        orderBy: { meetingDate: 'desc' }
      });
      
      allRecords.forEach((record, index) => {
        const recordDate = new Date(record.meetingDate);
        const recordMonth = recordDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        console.log(`    ${index + 1}. ${recordMonth} (${recordDate.toISOString().split('T')[0]}) - Seq ${record.recordSequenceNumber}`);
      });
    } else {
      console.log(`\n✅ Current endpoint correctly returns August!`);
    }

    // Check contributions status
    console.log(`\n👥 Member Contributions Analysis:`);
    const contributionStatuses = {};
    currentRecord.memberContributions.forEach(contrib => {
      const status = contrib.status || 'UNKNOWN';
      contributionStatuses[status] = (contributionStatuses[status] || 0) + 1;
    });
    
    console.log(`  Status breakdown:`, contributionStatuses);

    // Check if this looks like an "open" period
    const isOpenPeriod = currentRecord.totalCollectionThisPeriod === null || currentRecord.totalCollectionThisPeriod === 0;
    console.log(`  Is Open Period: ${isOpenPeriod ? 'YES' : 'NO'}`);
    console.log(`  Total Collection: ₹${currentRecord.totalCollectionThisPeriod || 0}`);

    console.log(`\n💡 DIAGNOSIS:`);
    if (isAugust && isOpenPeriod) {
      console.log(`✅ Backend correctly identifies August as current period`);
      console.log(`❌ Frontend must have additional logic causing the July display`);
    } else if (!isAugust) {
      console.log(`❌ Backend is returning wrong period - this needs to be fixed`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCurrentContributionsEndpoint()
  .catch(error => {
    console.error('Test script failed:', error);
    process.exit(1);
  });
