const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkMembershipData() {
  try {
    console.log('=== CHECKING MEMBERSHIP DATA FOR INITIAL LOAN AMOUNTS ===');
    
    // Get memberships for ACHAL KUMAR OJHA and ANUP KUMAR KESHRI
    const memberships = await prisma.memberGroupMembership.findMany({
      where: {
        groupId: '68381a2c05cb588247af871e',
        member: {
          name: {
            in: ['ACHAL KUMAR OJHA', 'ANUP KUMAR KESHRI']
          }
        }
      },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            initialLoanAmount: true
          }
        }
      }
    });

    console.log(`✅ Found ${memberships.length} memberships`);
    
    memberships.forEach((membership, index) => {
      console.log(`\n${index + 1}. ${membership.member.name}`);
      console.log(`   Member ID: ${membership.member.id}`);
      console.log(`   Member.initialLoanAmount: ₹${membership.member.initialLoanAmount || 0}`);
      console.log(`   Membership.initialLoanAmount: ₹${membership.initialLoanAmount || 0}`);
      console.log(`   Membership.initialShareAmount: ₹${membership.initialShareAmount || 0}`);
      console.log(`   Membership.initialInterest: ₹${membership.initialInterest || 0}`);
      console.log(`   Joined: ${membership.joinedAt}`);
      
      // This matches the API logic: m.initialLoanAmount || m.member.initialLoanAmount || 0
      const finalInitialLoan = membership.initialLoanAmount || membership.member.initialLoanAmount || 0;
      console.log(`   🎯 FINAL INITIAL LOAN (API logic): ₹${finalInitialLoan}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMembershipData();
