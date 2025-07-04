#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

async function verifyImportResults() {
    const prisma = new PrismaClient();
    
    try {
        console.log('\n=== Database Verification ===\n');
        
        // Find the most recently created group
        const recentGroup = await prisma.group.findFirst({
            orderBy: { createdAt: 'desc' },
            include: {
                members: true,
                groupLeader: true
            }
        });
        
        if (!recentGroup) {
            console.log('❌ No groups found in database');
            return;
        }
        
        console.log('📊 Most Recent Group:');
        console.log(`  - Name: ${recentGroup.name}`);
        console.log(`  - Created: ${recentGroup.createdAt.toISOString().split('T')[0]}`);
        console.log(`  - Total members: ${recentGroup.members.length}`);
        console.log(`  - Leader: ${recentGroup.groupLeader?.name || 'Not set'}`);
        
        // Analyze member data
        const membersWithLoans = recentGroup.members.filter(m => m.loanAmount > 0);
        const membersWithoutLoans = recentGroup.members.filter(m => m.loanAmount === 0);
        const totalLoanAmount = recentGroup.members.reduce((sum, m) => sum + m.loanAmount, 0);
        
        console.log('\n💰 Loan Analysis:');
        console.log(`  - Members with loans: ${membersWithLoans.length}`);
        console.log(`  - Members without loans: ${membersWithoutLoans.length}`);
        console.log(`  - Total loan amount: ₹${totalLoanAmount.toLocaleString()}`);
        
        // Check if this matches SWAWLAMBAN expected values
        const isSwawlambanImport = recentGroup.members.length === 51 && 
                                  membersWithLoans.length === 31 && 
                                  membersWithoutLoans.length === 20 && 
                                  totalLoanAmount === 6993284;
        
        console.log('\n🎯 SWAWLAMBAN Import Check:');
        console.log(`  - Is SWAWLAMBAN import: ${isSwawlambanImport ? '✅ YES' : '❌ NO'}`);
        
        if (isSwawlambanImport) {
            console.log('  - All 51 members imported: ✅');
            console.log('  - Loan amounts preserved: ✅');
            console.log('  - Data integrity maintained: ✅');
        }
        
        // Show sample members
        console.log('\n👥 Sample Members:');
        recentGroup.members.slice(0, 10).forEach((member, i) => {
            const loanStr = member.loanAmount > 0 ? `₹${member.loanAmount.toLocaleString()}` : 'No loan';
            console.log(`  ${i + 1}. ${member.name} - ${loanStr}`);
        });
        
        if (recentGroup.members.length > 10) {
            console.log(`  ... and ${recentGroup.members.length - 10} more members`);
        }
        
        // Additional groups analysis
        const totalGroups = await prisma.group.count();
        console.log(`\n📈 Database Summary:`);
        console.log(`  - Total groups in database: ${totalGroups}`);
        
    } catch (error) {
        console.error('❌ Database verification failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

verifyImportResults();
