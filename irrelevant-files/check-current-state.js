const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCurrentState() {
  try {
    console.log('=== CHECKING CURRENT STATE ===');
    
    // Check if the group exists
    const group = await prisma.group.findUnique({
      where: { id: '68381a2c05cb588247af871e' },
      select: {
        id: true,
        name: true,
        memberships: {
          select: {
            member: {
              select: {
                id: true,
                name: true,
                initialLoanAmount: true
              }
            }
          },
          take: 5
        }
      }
    });

    if (!group) {
      console.log('❌ Group not found');
      
      // List available groups
      const allGroups = await prisma.group.findMany({
        select: { id: true, name: true },
        take: 5
      });
      
      console.log('\n📋 Available groups:');
      allGroups.forEach(g => {
        console.log(`  ${g.id}: ${g.name}`);
      });
      return;
    }

    console.log(`✅ Group found: ${group.name}`);
    console.log(`   Members: ${group.memberships.length}`);
    
    // Check for ACHAL KUMAR OJHA specifically
    const achalMembers = await prisma.member.findMany({
      where: { name: 'ACHAL KUMAR OJHA' },
      select: {
        id: true,
        name: true,
        initialLoanAmount: true,
        createdAt: true
      }
    });
    
    console.log(`\n🔍 ACHAL KUMAR OJHA records found: ${achalMembers.length}`);
    achalMembers.forEach((member, index) => {
      console.log(`  ${index + 1}. ID: ${member.id}`);
      console.log(`     Initial Loan: ${member.initialLoanAmount || 0}`);
      console.log(`     Created: ${member.createdAt}`);
    });

    // Check periodic records for this group
    const periodicRecords = await prisma.groupPeriodicRecord.findMany({
      where: { groupId: '68381a2c05cb588247af871e' },
      select: {
        id: true,
        meetingDate: true,
        memberRecords: {
          select: {
            memberId: true,
            member: {
              select: {
                name: true
              }
            }
          },
          take: 3
        }
      },
      take: 3
    });

    console.log(`\n📅 Periodic records for this group: ${periodicRecords.length}`);
    periodicRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ID: ${record.id}`);
      console.log(`     Date: ${record.meetingDate}`);
      console.log(`     Members: ${record.memberRecords.length}`);
    });

    // Check loan data
    const loans = await prisma.loan.findMany({
      where: { 
        groupId: '68381a2c05cb588247af871e',
        status: 'ACTIVE'
      },
      include: {
        member: {
          select: { name: true }
        }
      }
    });

    console.log(`\n💰 Active loans for this group: ${loans.length}`);
    loans.forEach((loan, index) => {
      console.log(`  ${index + 1}. ${loan.member.name}: ₹${loan.currentBalance}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentState();
