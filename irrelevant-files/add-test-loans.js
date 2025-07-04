const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addTestLoans() {
  try {
    // Find the test group
    const group = await prisma.group.findFirst({
      where: {
        name: 'Test Group for Late Fines'
      },
      include: {
        memberships: {
          include: {
            member: true
          }
        }
      }
    });

    if (!group) {
      console.log('No test group found');
      return;
    }

    console.log(`Found group: ${group.name} (ID: ${group.id})`);

    // Check existing loans
    const existingLoans = await prisma.loan.findMany({
      where: {
        groupId: group.id
      },
      include: {
        member: {
          select: { name: true }
        }
      }
    });

    console.log(`\nExisting loans: ${existingLoans.length}`);
    existingLoans.forEach(loan => {
      console.log(`  ${loan.member.name}: ${loan.originalAmount} (current: ${loan.currentBalance}) - ${loan.status}`);
    });

    // Add active loans for the first two members if they don't have any
    const membersToAddLoans = group.memberships.slice(0, 2);
    
    for (let i = 0; i < membersToAddLoans.length; i++) {
      const membership = membersToAddLoans[i];
      const member = membership.member;
      
      // Check if member already has an active loan
      const memberActiveLoans = existingLoans.filter(loan => 
        loan.memberId === member.id && loan.status === 'ACTIVE'
      );
      
      if (memberActiveLoans.length === 0) {
        const loanAmount = (i + 1) * 10000; // 10000, 20000
        
        const newLoan = await prisma.loan.create({
          data: {
            groupId: group.id,
            memberId: member.id,
            loanType: 'PERSONAL',
            originalAmount: loanAmount,
            currentBalance: loanAmount,
            interestRate: group.interestRate / 100, // Convert percentage to decimal
            dateIssued: new Date(),
            status: 'ACTIVE'
          }
        });
        
        console.log(`\n✓ Created loan for ${member.name}: ${loanAmount}`);
      } else {
        console.log(`\n- ${member.name} already has active loan(s): ${memberActiveLoans.map(l => l.currentBalance).join(', ')}`);
      }
    }

    console.log('\n✓ Test loans setup completed');

  } catch (error) {
    console.error('Error adding test loans:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestLoans();
