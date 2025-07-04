const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPeriodicRecordMembers() {
  try {
    console.log('=== CHECKING PERIODIC RECORD MEMBERS ===');
    
    // Check the specific periodic record we're working with
    const periodicRecord = await prisma.groupPeriodicRecord.findUnique({
      where: { id: '68381a3405cb588247af8752' },
      include: {
        memberRecords: {
          include: {
            member: {
              select: {
                id: true,
                name: true,
                initialLoanAmount: true,
                loans: {
                  where: { status: 'ACTIVE' },
                  select: {
                    id: true,
                    currentBalance: true,
                    status: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!periodicRecord) {
      console.log('❌ Periodic record not found');
      return;
    }

    console.log(`✅ Periodic record found: ${periodicRecord.id}`);
    console.log(`   Meeting Date: ${periodicRecord.meetingDate}`);
    console.log(`   Member Records: ${periodicRecord.memberRecords.length}`);
    
    console.log('\n👥 Members in this periodic record:');
    periodicRecord.memberRecords.forEach((mr, index) => {
      console.log(`\n  ${index + 1}. ${mr.member.name}`);
      console.log(`     Member ID: ${mr.member.id}`);
      console.log(`     Initial Loan: ₹${mr.member.initialLoanAmount || 0}`);
      console.log(`     Active Loans: ${mr.member.loans.length}`);
      
      if (mr.member.loans.length > 0) {
        mr.member.loans.forEach((loan, loanIndex) => {
          console.log(`       Loan ${loanIndex + 1}: ₹${loan.currentBalance} (${loan.status})`);
        });
        
        const totalCurrentBalance = mr.member.loans.reduce((total, loan) => total + loan.currentBalance, 0);
        console.log(`     🎯 TOTAL CURRENT BALANCE: ₹${totalCurrentBalance}`);
      } else {
        console.log(`     🎯 TOTAL CURRENT BALANCE: ₹0`);
      }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPeriodicRecordMembers();
