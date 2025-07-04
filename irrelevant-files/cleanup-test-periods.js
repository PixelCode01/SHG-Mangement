const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupTestPeriods() {
  console.log('🧹 Cleaning up test periods...');
  
  // Find all periods for the test group
  const periods = await prisma.groupPeriodicRecord.findMany({
    where: { groupId: '684454eda7678bf7dad381bb' },
    orderBy: { recordSequenceNumber: 'asc' }
  });
  
  console.log(`Found ${periods.length} periods`);
  
  if (periods.length > 1) {
    // Keep only the first period, delete the rest
    const periodsToDelete = periods.slice(1);
    
    for (const period of periodsToDelete) {
      console.log(`Deleting period ${period.id} (sequence ${period.recordSequenceNumber})`);
      
      // Delete member contributions first
      await prisma.groupMemberPeriodicRecord.deleteMany({
        where: { groupPeriodicRecordId: period.id }
      });
      
      await prisma.memberContribution.deleteMany({
        where: { groupPeriodicRecordId: period.id }
      });
      
      // Delete the period
      await prisma.groupPeriodicRecord.delete({
        where: { id: period.id }
      });
    }
    
    console.log(`✅ Cleaned up ${periodsToDelete.length} duplicate periods`);
  }
  
  // Reset the remaining period to open state
  const remainingPeriod = periods[0];
  await prisma.groupPeriodicRecord.update({
    where: { id: remainingPeriod.id },
    data: {
      totalCollectionThisPeriod: null,
      recordSequenceNumber: 1
    }
  });
  
  console.log('✅ Reset remaining period to open state');
  
  await prisma.$disconnect();
}

cleanupTestPeriods();
