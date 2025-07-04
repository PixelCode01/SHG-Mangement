const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSimplePeriodStatus() {
  console.log('🔍 Checking Simple Period Status');
  
  try {
    // Get any group
    const group = await prisma.group.findFirst({
      select: {
        id: true,
        name: true
      }
    });
    
    if (!group) {
      console.log('❌ No groups found');
      return;
    }
    
    console.log(`📋 Testing with group: ${group.name} (${group.id})`);
    
    // Get current month/year (using 0-based month like the API)
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-based: June=5
    const currentYear = today.getFullYear();
    
    console.log(`📅 Current period: ${currentMonth + 1}/${currentYear} (Month index: ${currentMonth})`);
    
    // Check if current period exists (using meetingDate like the API)
    const currentPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: {
        groupId: group.id,
        meetingDate: {
          gte: new Date(currentYear, currentMonth, 1), // Start of current month
          lt: new Date(currentYear, currentMonth + 1, 1) // Start of next month
        }
      },
      orderBy: [
        { meetingDate: 'desc' },
        { recordSequenceNumber: 'desc' }
      ]
    });
    
    if (!currentPeriod) {
      console.log('❌ No current period found');
      
      // Create a test period
      console.log('🔧 Creating test period...');
      const meetingDate = new Date(currentYear, currentMonth, 15); // 15th of current month
      const newPeriod = await prisma.groupPeriodicRecord.create({
        data: {
          groupId: group.id,
          meetingDate: meetingDate,
          recordSequenceNumber: 1,
          totalCollectionThisPeriod: null // Start as open
        }
      });
      
      console.log(`✅ Created test period: ${newPeriod.id}`);
      
      // Test the isClosed logic
      const isClosed = newPeriod.totalCollectionThisPeriod !== null;
      console.log(`🔒 Period is ${isClosed ? 'CLOSED' : 'OPEN'}`);
      
      return;
    }
    
    console.log('\n📊 Current Period:');
    console.log(`- ID: ${currentPeriod.id}`);
    console.log(`- Meeting Date: ${currentPeriod.meetingDate}`);
    console.log(`- Sequence: ${currentPeriod.recordSequenceNumber}`);
    console.log(`- Total Collection: ${currentPeriod.totalCollectionThisPeriod}`);
    
    // Test the isClosed logic
    const isClosed = currentPeriod.totalCollectionThisPeriod !== null;
    console.log(`🔒 Period is ${isClosed ? 'CLOSED' : 'OPEN'}`);
    
    // Test closing the period
    if (!isClosed) {
      console.log('\n🔧 Testing period closure...');
      const closedPeriod = await prisma.groupPeriodicRecord.update({
        where: { id: currentPeriod.id },
        data: { totalCollectionThisPeriod: 1000 }
      });
      
      const nowClosed = closedPeriod.totalCollectionThisPeriod !== null;
      console.log(`✅ Period closed: ${nowClosed}`);
      
      // Test reopening
      console.log('\n🔧 Testing period reopening...');
      const reopenedPeriod = await prisma.groupPeriodicRecord.update({
        where: { id: currentPeriod.id },
        data: { totalCollectionThisPeriod: null }
      });
      
      const nowOpen = reopenedPeriod.totalCollectionThisPeriod !== null;
      console.log(`✅ Period reopened: ${!nowOpen}`);
    }
    
    console.log('\n🎯 For manual testing:');
    console.log(`Group ID: ${group.id}`);
    console.log(`URL: http://localhost:3000/groups/${group.id}/contributions`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSimplePeriodStatus();
