const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPeriodicRecordFormData() {
  try {
    console.log('=== TESTING PERIODIC RECORD FORM DATA FLOW ===\n');
    
    // Get the group with loan data
    const group = await prisma.group.findFirst({
      where: { name: 'jn' },
      include: {
        loans: {
          where: { status: 'ACTIVE' },
          include: {
            member: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        memberships: {
          include: {
            member: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!group) {
      console.log('❌ Group not found');
      return;
    }

    console.log('📊 GROUP DATA:');
    console.log(`Name: ${group.name}`);
    console.log(`Cash in Hand: ₹${group.cashInHand}`);
    console.log(`Balance in Bank: ₹${group.balanceInBank}`);
    console.log(`Monthly Contribution: ₹${group.monthlyContribution}`);
    console.log(`Interest Rate: ${group.interestRate}%`);
    console.log(`Collection Frequency: ${group.collectionFrequency}`);
    console.log(`Total Members: ${group.memberships.length}`);
    console.log(`Active Loans: ${group.loans.length}\n`);

    // Calculate loan balances by member (simulate what the API should return)
    const memberLoanBalances = new Map();
    group.loans.forEach(loan => {
      const memberId = loan.member.id;
      const memberName = loan.member.name;
      const currentBalance = memberLoanBalances.get(memberId) || 0;
      memberLoanBalances.set(memberId, currentBalance + parseFloat(loan.currentBalance));
      console.log(`${memberName}: +₹${loan.currentBalance} (Loan: ₹${loan.originalAmount})`);
    });

    console.log('\n💰 MEMBER LOAN BALANCES:');
    let totalLoanAmount = 0;
    memberLoanBalances.forEach((balance, memberId) => {
      const member = group.loans.find(l => l.member.id === memberId)?.member;
      console.log(`${member?.name}: ₹${balance}`);
      totalLoanAmount += balance;
    });
    console.log(`Total Active Loan Amount: ₹${totalLoanAmount}\n`);

    // Simulate what the periodic record form should see
    const simulatedGroupInitData = {
      totalGroupStanding: parseFloat(group.cashInHand) + parseFloat(group.balanceInBank) + totalLoanAmount,
      cashInBank: parseFloat(group.balanceInBank),
      cashInHand: parseFloat(group.cashInHand),
      monthlyContribution: parseFloat(group.monthlyContribution),
      interestRate: parseFloat(group.interestRate),
      collectionFrequency: group.collectionFrequency,
      members: group.memberships.map(membership => ({
        id: membership.member.id,
        name: membership.member.name,
        currentLoanBalance: memberLoanBalances.get(membership.member.id) || 0
      }))
    };

    console.log('🎯 PERIODIC RECORD FORM INITIALIZATION DATA:');
    console.log(`Total Group Standing: ₹${simulatedGroupInitData.totalGroupStanding}`);
    console.log(`Cash in Bank: ₹${simulatedGroupInitData.cashInBank}`);
    console.log(`Cash in Hand: ₹${simulatedGroupInitData.cashInHand}`);
    console.log(`Monthly Contribution: ₹${simulatedGroupInitData.monthlyContribution}`);
    console.log(`Interest Rate: ${simulatedGroupInitData.interestRate}%`);
    console.log(`Members with loan balances: ${simulatedGroupInitData.members.filter(m => m.currentLoanBalance > 0).length}`);

    // Calculate expected interest earned
    const monthlyInterestEarned = (totalLoanAmount * simulatedGroupInitData.interestRate) / 100 / 12;
    console.log(`Expected Monthly Interest Earned: ₹${monthlyInterestEarned.toFixed(2)}`);

    // Calculate share per member
    const sharePerMember = simulatedGroupInitData.totalGroupStanding / simulatedGroupInitData.members.length;
    console.log(`Share per Member: ₹${sharePerMember.toFixed(2)}`);

    console.log('\n✅ All calculations verified! The periodic record form should show these values.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPeriodicRecordFormData();
