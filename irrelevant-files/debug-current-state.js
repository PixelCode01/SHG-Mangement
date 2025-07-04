// Debug current state of loan amounts
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== CHECKING ACHAL KUMAR OJHA ===');
    
    // Find ACHAL KUMAR OJHA
    const achal = await prisma.groupMember.findFirst({
      where: {
        name: 'ACHAL KUMAR OJHA'
      },
      include: {
        loans: true
      }
    });
    
    if (achal) {
      console.log('ACHAL KUMAR OJHA found:');
      console.log('- ID:', achal.id);
      console.log('- Name:', achal.name);
      console.log('- Initial Loan Amount:', achal.initialLoanAmount);
      console.log('- Loans count:', achal.loans.length);
      
      if (achal.loans.length > 0) {
        console.log('- Loan details:');
        achal.loans.forEach((loan, index) => {
          console.log(`  Loan ${index + 1}:`, {
            id: loan.id,
            amount: loan.amount,
            status: loan.status,
            createdAt: loan.createdAt
          });
        });
      }
    } else {
      console.log('ACHAL KUMAR OJHA not found');
    }
    
    console.log('\n=== CHECKING PERIODIC RECORD API DATA ===');
    
    // Check what the periodic record API would return
    const groupId = '6838308f181b2206090ad176';
    const recordId = '68383081181b2206090ad177';
    
    const periodicRecord = await prisma.periodicRecord.findUnique({
      where: { id: recordId },
      include: {
        memberRecords: {
          include: {
            member: {
              include: {
                loans: {
                  where: { status: 'ACTIVE' }
                }
              }
            }
          }
        }
      }
    });
    
    if (periodicRecord) {
      console.log('Periodic record found with', periodicRecord.memberRecords.length, 'member records');
      
      periodicRecord.memberRecords.forEach((mr, index) => {
        const member = mr.member;
        console.log(`\nMember ${index + 1}:`);
        console.log('- Name:', member.name);
        console.log('- Initial Loan Amount:', member.initialLoanAmount);
        console.log('- Active loans count:', member.loans.length);
        
        if (member.loans.length > 0) {
          const totalActiveBalance = member.loans.reduce((sum, loan) => sum + loan.amount, 0);
          console.log('- Total active loan balance:', totalActiveBalance);
        }
      });
    } else {
      console.log('Periodic record not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
