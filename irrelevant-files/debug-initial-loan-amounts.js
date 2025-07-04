/**
 * Debug Script: Check initial loan amounts and member data
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugInitialLoanAmounts() {
  console.log('🔍 Debugging Initial Loan Amounts and Member Data...\n');

  try {
    const group = await prisma.group.findFirst({
      include: {
        memberships: {
          include: {
            member: true
          }
        }
      }
    });

    if (!group) {
      console.log('❌ No groups found');
      return;
    }

    console.log(`Group: ${group.name}`);
    console.log(`Members: ${group.memberships.length}\n`);

    console.log('Member data analysis:');
    group.memberships.forEach((membership, index) => {
      const member = membership.member;
      console.log(`\n${index + 1}. ${member.name} (ID: ${member.id})`);
      console.log(`   - Membership initialLoanAmount: ${membership.initialLoanAmount || 'null'}`);
      console.log(`   - Member initialLoanAmount: ${member.initialLoanAmount || 'null'}`);
      console.log(`   - Membership initialShareAmount: ${membership.initialShareAmount || 'null'}`);
      console.log(`   - Membership initialInterest: ${membership.initialInterest || 'null'}`);
    });

    // Check if there are any initial loan amounts
    const membersWithInitialLoans = group.memberships.filter(m => 
      (m.initialLoanAmount && m.initialLoanAmount > 0) || 
      (m.member.initialLoanAmount && m.member.initialLoanAmount > 0)
    );

    console.log(`\n📊 Summary:`);
    console.log(`Total members: ${group.memberships.length}`);
    console.log(`Members with initial loan amounts: ${membersWithInitialLoans.length}`);

    if (membersWithInitialLoans.length > 0) {
      console.log('\nMembers with initial loans:');
      membersWithInitialLoans.forEach(membership => {
        const initialLoan = membership.initialLoanAmount || membership.member.initialLoanAmount || 0;
        console.log(`  - ${membership.member.name}: ₹${initialLoan}`);
      });
    }

    // Test what the API would return
    console.log('\n🔍 API Response Simulation:');
    const formattedMembers = group.memberships.slice(0, 5).map(m => ({
      id: m.member.id,
      name: m.member.name,
      initialLoanAmount: m.initialLoanAmount || m.member.initialLoanAmount || 0,
      currentLoanBalance: m.member.loans?.reduce((total, loan) => total + loan.currentBalance, 0) || 0,
    }));

    formattedMembers.forEach(member => {
      console.log(`${member.name}:`);
      console.log(`  - Initial Loan: ₹${member.initialLoanAmount}`);
      console.log(`  - Current Loan Balance: ₹${member.currentLoanBalance}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugInitialLoanAmounts();
