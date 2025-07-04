// Update ACHAL KUMAR OJHA's initialLoanAmount to 85702
const { PrismaClient } = require('@prisma/client');

async function updateAchalLoanAmount() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== UPDATING ACHAL KUMAR OJHA INITIAL LOAN AMOUNT ===');
    
    // Find ACHAL KUMAR OJHA in the correct group
    const achal = await prisma.groupMember.findFirst({
      where: {
        name: 'ACHAL KUMAR OJHA',
        groupId: '6838308f181b2206090ad176'
      }
    });
    
    if (!achal) {
      console.log('❌ ACHAL KUMAR OJHA not found in the specified group');
      return;
    }
    
    console.log('✅ Found ACHAL KUMAR OJHA:', {
      id: achal.id,
      name: achal.name,
      currentInitialLoanAmount: achal.initialLoanAmount
    });
    
    // Update the initialLoanAmount to 85702 (₹85,702)
    const updatedMember = await prisma.groupMember.update({
      where: {
        id: achal.id
      },
      data: {
        initialLoanAmount: 85702
      }
    });
    
    console.log('✅ Updated ACHAL KUMAR OJHA initial loan amount to ₹85,702');
    console.log('Updated member:', {
      id: updatedMember.id,
      name: updatedMember.name,
      initialLoanAmount: updatedMember.initialLoanAmount
    });
    
    // Now test the periodic records API to see if it shows the updated amount
    console.log('\n=== TESTING PERIODIC RECORDS API ===');
    
    const periodicRecord = await prisma.periodicRecord.findUnique({
      where: { id: '68383096181b2206090ad1aa' },
      include: {
        memberRecords: {
          where: {
            memberId: achal.id
          },
          include: {
            member: true
          }
        }
      }
    });
    
    if (periodicRecord && periodicRecord.memberRecords.length > 0) {
      const memberRecord = periodicRecord.memberRecords[0];
      console.log('✅ Found member record in periodic record:', {
        memberName: memberRecord.member.name,
        initialLoanAmount: memberRecord.member.initialLoanAmount
      });
      
      console.log('🔍 This should now show ₹85,702 in the periodic records table');
    } else {
      console.log('❌ No member record found for ACHAL in the periodic record');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAchalLoanAmount();
