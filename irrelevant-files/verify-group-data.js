const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyGroupData() {
  try {
    console.log('=== VERIFYING GROUP DATA FOR PERIODIC RECORD FORM ===\n');
    
    // Get the test group data (using "bcv" group which has loans)
    const group = await prisma.group.findFirst({
      where: { name: 'bcv' },
      include: {
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: { status: 'ACTIVE' }
                }
              }
            }
          }
        },
        loans: {
          where: { status: 'ACTIVE' },
          include: {
            member: true
          }
        }
      }
    });

    if (!group) {
      console.log('❌ No test group found');
      return;
    }

    console.log('📊 GROUP DETAILS:');
    console.log(`Name: ${group.name}`);
    console.log(`Cash in Bank: ₹${group.balanceInBank}`);
    console.log(`Cash in Hand: ₹${group.cashInHand}`);
    console.log(`Monthly Contribution per Member: ₹${group.monthlyContribution}`);
    console.log(`Interest Rate: ${group.interestRate}%`);
    console.log(`Collection Frequency: ${group.collectionFrequency}`);
    console.log(`Number of Members: ${group.memberships.length}\n`);

    console.log('💰 LOAN DETAILS:');
    let totalLoanAmount = 0;
    group.loans.forEach(loan => {
      console.log(`${loan.member.name}: ₹${loan.currentBalance} (Status: ${loan.status})`);
      totalLoanAmount += parseFloat(loan.currentBalance);
    });
    console.log(`Total Active Loans: ₹${totalLoanAmount}\n`);

    console.log('🧮 CALCULATED VALUES FOR FORM:');
    const totalCash = parseFloat(group.balanceInBank) + parseFloat(group.cashInHand);
    const totalGroupStanding = totalCash + totalLoanAmount;
    const sharePerMember = totalGroupStanding / group.memberships.length;
    
    // Interest calculation based on collection frequency
    let monthlyInterest = 0;
    if (group.collectionFrequency === 'MONTHLY') {
      monthlyInterest = (totalLoanAmount * parseFloat(group.interestRate)) / 100 / 12;
    } else if (group.collectionFrequency === 'WEEKLY') {
      monthlyInterest = (totalLoanAmount * parseFloat(group.interestRate)) / 100 / 12;
    }

    console.log(`Total Cash: ₹${totalCash}`);
    console.log(`Total Group Standing: ₹${totalGroupStanding}`);
    console.log(`Share per Member: ₹${sharePerMember.toFixed(2)}`);
    console.log(`Monthly Interest Earned: ₹${monthlyInterest.toFixed(2)}\n`);

    console.log('✅ Data verification complete!');
    
  } catch (error) {
    console.error('❌ Error verifying group data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyGroupData();
