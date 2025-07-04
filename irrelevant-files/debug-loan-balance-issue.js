/**
 * Debug Script: Investigate why Current Loan Balance is not showing
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugLoanBalanceIssue() {
  console.log('🔍 Debugging Current Loan Balance Issue...\n');

  try {
    // First, let's check if there are any groups
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            memberships: true
          }
        }
      },
      take: 5
    });

    console.log(`Found ${groups.length} groups:`);
    groups.forEach(group => {
      console.log(`  - ${group.name} (ID: ${group.id}) - ${group._count.memberships} members`);
    });

    if (groups.length === 0) {
      console.log('❌ No groups found in database');
      return;
    }

    // Pick the first group for detailed analysis
    const testGroupId = groups[0].id;
    console.log(`\n🔍 Analyzing group: ${groups[0].name}`);

    // Check if there are any loans at all
    const allLoans = await prisma.loan.findMany({
      where: {
        groupId: testGroupId
      },
      include: {
        member: {
          select: { name: true }
        }
      }
    });

    console.log(`\nTotal loans in group: ${allLoans.length}`);
    if (allLoans.length === 0) {
      console.log('❌ No loans found in this group');
      
      // Check loans across all groups
      const allLoansAnyGroup = await prisma.loan.findMany({
        include: {
          member: { select: { name: true } },
          group: { select: { name: true } }
        },
        take: 10
      });
      
      console.log(`\nTotal loans across all groups: ${allLoansAnyGroup.length}`);
      if (allLoansAnyGroup.length === 0) {
        console.log('❌ No loans found in entire database');
      } else {
        console.log('Found loans in other groups:');
        allLoansAnyGroup.forEach(loan => {
          console.log(`  - ${loan.member.name} in ${loan.group.name}: ₹${loan.currentBalance} (${loan.status})`);
        });
      }
      return;
    }

    // Analyze loan status distribution
    const loansByStatus = allLoans.reduce((acc, loan) => {
      acc[loan.status] = (acc[loan.status] || 0) + 1;
      return acc;
    }, {});

    console.log('\nLoan status distribution:');
    Object.entries(loansByStatus).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count} loans`);
    });

    // Show active loans specifically
    const activeLoans = allLoans.filter(loan => loan.status === 'ACTIVE');
    console.log(`\nActive loans: ${activeLoans.length}`);
    activeLoans.forEach(loan => {
      console.log(`  - ${loan.member.name}: ₹${loan.currentBalance} (${loan.loanType})`);
    });

    // Now test the group API logic exactly as implemented
    console.log('\n🔍 Testing Group API Logic...');

    const groupWithMembers = await prisma.group.findUnique({
      where: { id: testGroupId },
      include: {
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: {
                    groupId: testGroupId,
                    status: 'ACTIVE'
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log('\nMember loan analysis:');
    groupWithMembers.memberships.forEach(membership => {
      const member = membership.member;
      const memberLoans = member.loans || [];
      const currentLoanBalance = memberLoans.reduce((total, loan) => total + loan.currentBalance, 0);
      
      console.log(`\n  Member: ${member.name} (ID: ${member.id})`);
      console.log(`    - Total loans: ${memberLoans.length}`);
      console.log(`    - Loans detail:`);
      memberLoans.forEach(loan => {
        console.log(`      * Loan ${loan.id}: ₹${loan.currentBalance} (${loan.status}, ${loan.loanType})`);
      });
      console.log(`    - Calculated currentLoanBalance: ₹${currentLoanBalance}`);
    });

    // Test the exact API response format
    console.log('\n🔍 Simulating API Response Format...');
    const formattedMembers = groupWithMembers.memberships.map(m => ({
      id: m.member.id,
      name: m.member.name,
      initialLoanAmount: m.initialLoanAmount || m.member.initialLoanAmount || 0,
      currentLoanBalance: m.member.loans?.reduce((total, loan) => total + loan.currentBalance, 0) || 0,
      loansCount: m.member.loans?.length || 0
    }));

    console.log('\nFormatted members (as API would return):');
    formattedMembers.forEach(member => {
      console.log(`  - ${member.name}:`);
      console.log(`    * Initial Loan: ₹${member.initialLoanAmount}`);
      console.log(`    * Current Loan Balance: ₹${member.currentLoanBalance}`);
      console.log(`    * Number of loans: ${member.loansCount}`);
    });

    // Check for potential issues
    console.log('\n🔍 Checking for Potential Issues...');
    
    const totalCurrentBalance = formattedMembers.reduce((sum, member) => sum + member.currentLoanBalance, 0);
    console.log(`Total current loan balance across all members: ₹${totalCurrentBalance}`);

    if (totalCurrentBalance === 0) {
      console.log('\n❌ ISSUE IDENTIFIED: All current loan balances are 0');
      console.log('Possible causes:');
      console.log('1. No ACTIVE loans in the group');
      console.log('2. All loan currentBalance values are 0');
      console.log('3. Loans are associated with wrong groupId');
      console.log('4. Database relationship issues');
    } else {
      console.log('\n✅ Current loan balances are correctly calculated');
    }

  } catch (error) {
    console.error('Error in debug script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugLoanBalanceIssue();
