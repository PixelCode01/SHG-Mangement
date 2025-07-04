const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const groupId = '6838308f181b2206090ad176';
    
    console.log('🔍 Checking members with loan amounts in group...');
    
    const membersWithLoans = await prisma.groupMember.findMany({
      where: { 
        groupId,
        initialLoanAmount: { gt: 0 }
      },
      select: { 
        id: true, 
        name: true, 
        initialLoanAmount: true 
      },
      orderBy: { initialLoanAmount: 'desc' }
    });
    
    console.log(`Found ${membersWithLoans.length} members with loan amounts:`);
    membersWithLoans.forEach(m => {
      console.log(`   - ${m.name}: ₹${m.initialLoanAmount?.toLocaleString()}`);
    });
    
    if (membersWithLoans.length > 0) {
      console.log('\n📋 Creating new periodic record with these members...');
      
      const newRecord = await prisma.groupPeriodicRecord.create({
        data: {
          groupId,
          meetingDate: new Date(),
          recordSequenceNumber: 1002,
          totalCollectionThisPeriod: 25000,
          standingAtStartOfPeriod: 500000,
          cashInBankAtEndOfPeriod: 0,
          cashInHandAtEndOfPeriod: 523000,
          expensesThisPeriod: 2000,
          totalGroupStandingAtEndOfPeriod: 523000,
          interestEarnedThisPeriod: 0,
          newContributionsThisPeriod: 25000,
          loanProcessingFeesCollectedThisPeriod: 0,
          lateFinesCollectedThisPeriod: 0,
          memberRecords: {
            create: membersWithLoans.map(member => ({
              memberId: member.id,
              compulsoryContribution: 500,
              loanRepaymentPrincipal: 300,
              lateFinePaid: 0
            }))
          }
        }
      });
      
      console.log(`✅ Created new record: ${newRecord.id}`);
      console.log(`🌐 Test URL: http://localhost:3000/groups/${groupId}/periodic-records/${newRecord.id}`);
      
      // Test the API
      console.log('\n🧪 Testing API response...');
      const url = `http://localhost:3000/api/groups/${groupId}/periodic-records/${newRecord.id}`;
      
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('API Response - Members with loan amounts:');
      data.memberRecords?.forEach(mr => {
        if (mr.memberCurrentLoanBalance > 0) {
          console.log(`   ✅ ${mr.memberName}: ₹${mr.memberCurrentLoanBalance?.toLocaleString()}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
