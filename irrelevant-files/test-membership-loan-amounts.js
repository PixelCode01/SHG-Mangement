const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testMembershipLoanAmounts() {
  try {
    console.log('Testing membership loan amounts retrieval...\n');

    // Get all groups
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        memberships: {
          include: {
            member: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    });

    if (groups.length === 0) {
      console.log('No groups found in database.');
      return;
    }

    for (const group of groups) {
      console.log(`\n=== Group: ${group.name} (${group.id}) ===`);
      
      if (group.memberships.length === 0) {
        console.log('  No memberships found.');
        continue;
      }

      console.log('  Members and their initial loan amounts:');
      for (const membership of group.memberships) {
        const memberName = membership.member?.name || 'Unknown';
        const initialLoanAmount = membership.initialLoanAmount || 0;
        
        console.log(`    - ${memberName}: ₹${initialLoanAmount.toLocaleString('en-IN')}`);
      }

      // Check if group has periodic records
      const periodicRecords = await prisma.groupPeriodicRecord.findMany({
        where: { groupId: group.id },
        select: {
          id: true,
          meetingDate: true,
        }
      });

      if (periodicRecords.length > 0) {
        console.log(`\n  Periodic Records (${periodicRecords.length} found):`);
        for (const record of periodicRecords) {
          console.log(`    - Record ID: ${record.id}, Date: ${record.meetingDate}`);
        }
      } else {
        console.log('\n  No periodic records found.');
      }
    }

    console.log('\n=== Summary ===');
    const totalMemberships = groups.reduce((sum, group) => sum + group.memberships.length, 0);
    const membershipsWithLoanAmounts = groups.reduce((sum, group) => 
      sum + group.memberships.filter(m => m.initialLoanAmount && m.initialLoanAmount > 0).length, 0
    );

    console.log(`Total memberships: ${totalMemberships}`);
    console.log(`Memberships with loan amounts > 0: ${membershipsWithLoanAmounts}`);
    console.log(`Memberships with no loan amounts: ${totalMemberships - membershipsWithLoanAmounts}`);

  } catch (error) {
    console.error('Error testing membership loan amounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMembershipLoanAmounts();
