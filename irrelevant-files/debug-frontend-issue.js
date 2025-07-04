const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugFrontendIssue() {
  console.log('🔍 Debugging Frontend Period Display Issue...\n');
  
  const groupId = '68499d8a8ebb724c0ebedf0d';
  
  try {
    // 1. Check all periods for this group
    console.log('📊 1. Checking all periods for group...');
    const periods = await prisma.groupPeriodicRecord.findMany({
      where: { groupId },
      orderBy: { recordSequenceNumber: 'asc' },
      include: { 
        memberContributions: {
          select: { id: true, status: true, totalPaid: true }
        }
      }
    });
    
    console.log(`Found ${periods.length} periods:\n`);
    periods.forEach((period, index) => {
      const date = new Date(period.meetingDate);
      const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const status = period.totalCollectionThisPeriod === null ? 'OPEN' : 'CLOSED';
      const paidContributions = period.memberContributions.filter(mc => mc.status === 'PAID' || mc.totalPaid > 0).length;
      
      console.log(`  ${index + 1}. ${month} (Seq: ${period.recordSequenceNumber}) - ${status}`);
      console.log(`     ID: ${period.id}`);
      console.log(`     Collection: ₹${period.totalCollectionThisPeriod || 0}`);
      console.log(`     Member Contributions: ${period.memberContributions.length} (${paidContributions} paid)`);
      console.log('');
    });
    
    // 2. Test current period API logic exactly as frontend would call it
    console.log('🌐 2. Testing current period API (simulating frontend call)...');
    
    // Simulate the exact query that the current period API uses
    const currentPeriod = await prisma.groupPeriodicRecord.findFirst({
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
    
    if (currentPeriod) {
      const date = new Date(currentPeriod.meetingDate);
      const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`✅ Current period found: ${month} (Seq: ${currentPeriod.recordSequenceNumber})`);
      console.log(`   ID: ${currentPeriod.id}`);
      console.log(`   Meeting Date: ${currentPeriod.meetingDate.toISOString()}`);
      console.log(`   Collection: ₹${currentPeriod.totalCollectionThisPeriod || 0}`);
    } else {
      console.log('❌ No current period found with API logic');
    }
    
    // 3. Check which period the frontend contributions API would return
    console.log('\n📋 3. Testing contributions endpoint logic...');
    
    // This simulates /api/groups/[id]/contributions/current
    const contributionsRecord = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId },
      orderBy: { meetingDate: 'desc' },
      include: {
        memberContributions: {
          include: {
            member: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });
    
    if (contributionsRecord) {
      const date = new Date(contributionsRecord.meetingDate);
      const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`✅ Contributions endpoint would return: ${month} (Seq: ${contributionsRecord.recordSequenceNumber})`);
      console.log(`   ID: ${contributionsRecord.id}`);
      console.log(`   Collection: ₹${contributionsRecord.totalCollectionThisPeriod || 0}`);
      console.log(`   Member Contributions: ${contributionsRecord.memberContributions.length}`);
    }
    
    // 4. Check for any July period that might be confusing the frontend
    console.log('\n🔍 4. Checking July period specifically...');
    
    const julyPeriod = periods.find(p => {
      const date = new Date(p.meetingDate);
      return date.getMonth() === 6 && date.getFullYear() === 2025; // July 2025
    });
    
    if (julyPeriod) {
      const isOpen = julyPeriod.totalCollectionThisPeriod === null;
      console.log(`📅 July period found:`);
      console.log(`   Status: ${isOpen ? 'OPEN' : 'CLOSED'}`);
      console.log(`   Collection: ₹${julyPeriod.totalCollectionThisPeriod || 0}`);
      console.log(`   Member Contributions: ${julyPeriod.memberContributions.length}`);
      
      if (isOpen) {
        console.log('   ⚠️  PROBLEM: July period is still OPEN!');
        console.log('   This explains why frontend shows July as current');
      } else {
        console.log('   ✅ July period is properly closed');
      }
    } else {
      console.log('📅 No July period found');
    }
    
    // 5. Summary and diagnosis
    console.log('\n💡 DIAGNOSIS:');
    
    const openPeriods = periods.filter(p => p.totalCollectionThisPeriod === null);
    const latestPeriod = periods[periods.length - 1];
    const latestDate = new Date(latestPeriod.meetingDate);
    const latestMonth = latestDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    console.log(`- Total periods: ${periods.length}`);
    console.log(`- Open periods: ${openPeriods.length}`);
    console.log(`- Latest period: ${latestMonth} (${latestPeriod.totalCollectionThisPeriod === null ? 'OPEN' : 'CLOSED'})`);
    
    if (openPeriods.length > 1) {
      console.log('❌ MULTIPLE OPEN PERIODS FOUND - This is the problem!');
      openPeriods.forEach((p, i) => {
        const date = new Date(p.meetingDate);
        const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        console.log(`   ${i + 1}. ${month} (Seq: ${p.recordSequenceNumber})`);
      });
    } else if (openPeriods.length === 1) {
      const openPeriod = openPeriods[0];
      const date = new Date(openPeriod.meetingDate);
      const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`✅ Single open period: ${month}`);
      
      if (month.includes('July')) {
        console.log('❌ Open period is July - should be August');
      } else if (month.includes('August')) {
        console.log('✅ Open period is August - correct');
        console.log('🤔 Frontend issue might be caching or API endpoint selection');
      }
    } else {
      console.log('❌ NO OPEN PERIODS - This would break the frontend');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugFrontendIssue().catch(console.error);
