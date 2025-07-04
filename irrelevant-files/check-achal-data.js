// Simple direct database check for ACHAL KUMAR OJHA loan amount
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Find ACHAL KUMAR OJHA in the database
    const member = await prisma.groupMember.findFirst({
      where: {
        name: 'ACHAL KUMAR OJHA'
      },
      select: {
        id: true,
        name: true,
        initialLoanAmount: true,
        groupId: true
      }
    });

    if (member) {
      console.log('✅ Found ACHAL KUMAR OJHA:');
      console.log(`   ID: ${member.id}`);
      console.log(`   Group: ${member.groupId}`);
      console.log(`   Initial Loan Amount: ₹${member.initialLoanAmount || 0}`);
      
      // Check if he's in any periodic records
      const periodicRecords = await prisma.groupMemberPeriodicRecord.findMany({
        where: {
          memberId: member.id
        },
        include: {
          groupPeriodicRecord: {
            select: {
              id: true,
              meetingDate: true
            }
          }
        }
      });
      
      console.log(`\n📋 Found in ${periodicRecords.length} periodic records:`);
      periodicRecords.forEach(record => {
        console.log(`   - Record ${record.groupPeriodicRecord.id} (${record.groupPeriodicRecord.meetingDate.toISOString().split('T')[0]})`);
      });
      
    } else {
      console.log('❌ ACHAL KUMAR OJHA not found in database');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
