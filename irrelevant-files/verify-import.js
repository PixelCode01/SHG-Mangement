const { PrismaClient } = require('@prisma/client');

async function verifyImport() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Verifying SWAWLAMBAN member import...');
    
    // Count total members
    const totalMembers = await prisma.member.count();
    console.log(`📊 Total members in database: ${totalMembers}`);
    
    // Get members with loan amounts
    const membersWithLoans = await prisma.member.findMany({
      where: {
        initialLoanAmount: {
          gt: 0
        }
      },
      select: {
        name: true,
        initialLoanAmount: true
      },
      orderBy: {
        initialLoanAmount: 'desc'
      }
    });
    
    console.log(`💰 Members with loans: ${membersWithLoans.length}`);
    
    // Show top 10 members by loan amount
    console.log('\n🏆 Top 10 members by loan amount:');
    console.log('='.repeat(60));
    for (let i = 0; i < Math.min(10, membersWithLoans.length); i++) {
      const member = membersWithLoans[i];
      console.log(`${(i+1).toString().padStart(3)}. ${member.name.padEnd(25)} | ₹${member.initialLoanAmount.toLocaleString()}`);
    }
    
    // Calculate total loan amount
    const totalLoanAmount = membersWithLoans.reduce((sum, member) => sum + member.initialLoanAmount, 0);
    console.log(`\n💰 Total loan amount: ₹${totalLoanAmount.toLocaleString()}`);
    
    // Get recent members (likely the imported ones)
    const recentMembers = await prisma.member.findMany({
      select: {
        name: true,
        initialLoanAmount: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    console.log('\n🕐 Most recently added members:');
    console.log('='.repeat(60));
    recentMembers.forEach((member, index) => {
      const loanText = member.initialLoanAmount ? `₹${member.initialLoanAmount.toLocaleString()}` : 'No loan';
      console.log(`${(index+1).toString().padStart(3)}. ${member.name.padEnd(25)} | ${loanText}`);
    });
    
  } catch (error) {
    console.log('❌ Error verifying import:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyImport().catch(console.error);
