const { PrismaClient } = require('@prisma/client');

async function checkLoansAndCalculations() {
  const prisma = new PrismaClient();
  
  try {
    // Get all groups
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            loans: true,
            memberships: true
          }
        }
      }
    });
    
    console.log('Groups overview:');
    groups.forEach(group => {
      console.log(`- ${group.name} (${group.id}): ${group._count.memberships} members, ${group._count.loans} loans`);
    });
    
    // Check loans in detail for first group with loans
    const groupWithLoans = groups.find(g => g._count.loans > 0);
    if (groupWithLoans) {
      console.log(`\nDetailed loan info for group: ${groupWithLoans.name}`);
      
      const loans = await prisma.loan.findMany({
        where: { groupId: groupWithLoans.id },
        include: {
          member: {
            select: { name: true }
          }
        }
      });
      
      loans.forEach(loan => {
        console.log(`- ${loan.member.name}: ${loan.loanType}, Amount: ${loan.originalAmount}, Balance: ${loan.currentBalance}, Status: ${loan.status}`);
      });
    } else {
      console.log('\nNo groups with active loans found');
      
      // Check if we have any loans at all
      const totalLoans = await prisma.loan.count();
      console.log(`Total loans in database: ${totalLoans}`);
    }
    
    // Check group memberships and loan amounts
    console.log('\nGroup memberships with loan amounts:');
    const memberships = await prisma.memberGroupMembership.findMany({
      where: {
        currentLoanAmount: {
          gt: 0
        }
      },
      include: {
        member: {
          select: { name: true }
        },
        group: {
          select: { name: true }
        }
      }
    });
    
    memberships.forEach(membership => {
      console.log(`- ${membership.member.name} in ${membership.group.name}: ₹${membership.currentLoanAmount}`);
    });
    
    if (memberships.length === 0) {
      console.log('No memberships with currentLoanAmount > 0 found');
      
      // Check all memberships to see what data we have
      const allMemberships = await prisma.memberGroupMembership.findMany({
        take: 5, // Just first 5 for debugging
        include: {
          member: {
            select: { name: true }
          },
          group: {
            select: { name: true }
          }
        }
      });
      
      console.log('\nSample memberships:');
      allMemberships.forEach(membership => {
        console.log(`- ${membership.member.name} in ${membership.group.name}: currentLoanAmount=${membership.currentLoanAmount}, currentShareAmount=${membership.currentShareAmount}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLoansAndCalculations();
