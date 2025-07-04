const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPeriods() {
  const periods = await prisma.groupPeriodicRecord.findMany({
    where: { groupId: '684454eda7678bf7dad381bb' },
    orderBy: { recordSequenceNumber: 'asc' }
  });
  
  console.log('Existing periods:');
  periods.forEach(p => {
    console.log(`  - ID: ${p.id}, Sequence: ${p.recordSequenceNumber}, Collection: ₹${p.totalCollectionThisPeriod || 'NULL (open)'}`);
  });
  
  await prisma.$disconnect();
}

checkPeriods();
