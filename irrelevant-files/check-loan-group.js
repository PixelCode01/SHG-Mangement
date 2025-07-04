const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    const groupId = '6838308f181b2206090ad176';
    
    // Check if group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true, id: true }
    });
    
    if (!group) {
      console.log('❌ Group not found');
      return;
    }
    
    console.log(`✅ Group found: ${group.name}`);
    
    // Check for periodic records
    const records = await prisma.groupPeriodicRecord.findMany({
      where: { groupId },
      select: { 
        id: true, 
        meetingDate: true,
        recordSequenceNumber: true 
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`📋 Periodic records: ${records.length}`);
    
    if (records.length === 0) {
      console.log('No periodic records exist. Creating a test record...');
      
      // Get members with loan amounts
      const members = await prisma.groupMember.findMany({
        where: { groupId },
        take: 3,
        select: { 
          id: true, 
          name: true, 
          initialLoanAmount: true 
        },
        orderBy: { initialLoanAmount: 'desc' }
      });
      
      console.log('👥 Members available:');
      members.forEach(m => {
        console.log(`   - ${m.name}: ₹${m.initialLoanAmount || 0}`);
      });
      
      if (members.length > 0) {
        // Create a test periodic record
        const newRecord = await prisma.groupPeriodicRecord.create({
          data: {
            groupId,
            meetingDate: new Date(),
            recordSequenceNumber: 1001,
            totalCollectionThisPeriod: 15000,
            standingAtStartOfPeriod: 200000,
            cashInBankAtEndOfPeriod: 0,
            cashInHandAtEndOfPeriod: 213000,
            expensesThisPeriod: 2000,
            totalGroupStandingAtEndOfPeriod: 213000,
            interestEarnedThisPeriod: 0,
            newContributionsThisPeriod: 15000,
            loanProcessingFeesCollectedThisPeriod: 0,
            lateFinesCollectedThisPeriod: 0,
            memberRecords: {
              create: members.map(member => ({
                memberId: member.id,
                compulsoryContribution: 500,
                loanRepaymentPrincipal: 200,
                lateFinePaid: 0
              }))
            }
          }
        });
        
        console.log(`✅ Created test record: ${newRecord.id}`);
        console.log(`🌐 Test URL: http://localhost:3000/groups/${groupId}/periodic-records/${newRecord.id}`);
      }
    } else {
      console.log('📋 Existing periodic records:');
      records.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.id} (${record.meetingDate.toISOString().split('T')[0]})`);
        console.log(`      URL: http://localhost:3000/groups/${groupId}/periodic-records/${record.id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
