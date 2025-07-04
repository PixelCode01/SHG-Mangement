const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function investigateDuplicateRecords() {
    try {
        console.log('=== INVESTIGATING DUPLICATE RECORDS ===\n');

        // Check the specific group
        const groupId = '68444854086ea61b8b947d9d';
        
        console.log('1. GROUP DETAILS:');
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: {
                memberships: {
                    include: {
                        member: true
                    }
                }
            }
        });
        
        if (!group) {
            console.log('❌ Group not found!');
            return;
        }
        
        console.log(`Group: ${group.name}`);
        console.log(`Members: ${group.memberships.length}`);
        
        // Calculate actual loan assets
        const totalLoanAssets = group.memberships.reduce((total, membership) => {
            return total + (membership.currentLoanAmount || 0);
        }, 0);
        
        console.log(`Total loan assets: ₹${totalLoanAssets.toLocaleString()}`);
        
        console.log('\n2. ALL PERIODIC RECORDS:');
        const allRecords = await prisma.groupPeriodicRecord.findMany({
            where: { groupId },
            orderBy: { createdAt: 'desc' }
        });
        
        console.log(`Total records found: ${allRecords.length}\n`);
        
        allRecords.forEach((record, index) => {
            console.log(`Record ${index + 1}:`);
            console.log(`  ID: ${record.id}`);
            console.log(`  Meeting Date: ${record.meetingDate ? record.meetingDate.toLocaleDateString() : 'N/A'}`);
            console.log(`  Cash in Hand: ₹${(record.cashInHandAtEndOfPeriod || 0).toLocaleString()}`);
            console.log(`  Cash in Bank: ₹${(record.cashInBankAtEndOfPeriod || 0).toLocaleString()}`);
            console.log(`  Group Standing: ₹${(record.totalGroupStandingAtEndOfPeriod || 0).toLocaleString()}`);
            console.log(`  Members Present: ${record.membersPresent || 'N/A'}`);
            console.log(`  Created: ${record.createdAt.toLocaleDateString()}`);
            console.log(`  Updated: ${record.updatedAt.toLocaleDateString()}`);
            console.log('---');
        });
        
        console.log('\n3. PERIODS STATUS:');
        // Note: This schema doesn't seem to have a separate Period model
        // GroupPeriodicRecord seems to be the main record model
        
        console.log('\n4. EXPECTED VALUES:');
        const expectedCashInHand = 214223.6;
        const expectedCashInBank = 504921.4; 
        const expectedGroupStanding = expectedCashInHand + expectedCashInBank + totalLoanAssets;
        
        console.log(`Expected Cash in Hand: ₹${expectedCashInHand.toLocaleString()}`);
        console.log(`Expected Cash in Bank: ₹${expectedCashInBank.toLocaleString()}`);
        console.log(`Expected Total Loan Assets: ₹${totalLoanAssets.toLocaleString()}`);
        console.log(`Expected Group Standing: ₹${expectedGroupStanding.toLocaleString()}`);
        
        // Check for duplicates
        console.log('\n5. DUPLICATE ANALYSIS:');
        const duplicateGroups = {};
        allRecords.forEach(record => {
            const cashInHand = record.cashInHandAtEndOfPeriod || 0;
            const cashInBank = record.cashInBankAtEndOfPeriod || 0;
            const groupStanding = record.totalGroupStandingAtEndOfPeriod || 0;
            const key = `${cashInHand}-${cashInBank}-${groupStanding}`;
            if (!duplicateGroups[key]) {
                duplicateGroups[key] = [];
            }
            duplicateGroups[key].push(record);
        });
        
        Object.entries(duplicateGroups).forEach(([key, records]) => {
            if (records.length > 1) {
                console.log(`❌ DUPLICATE FOUND - Values: ${key}`);
                records.forEach(record => {
                    console.log(`  Record ID: ${record.id}, Created: ${record.createdAt.toLocaleDateString()}`);
                });
            }
        });

    } catch (error) {
        console.error('Error investigating records:', error);
    } finally {
        await prisma.$disconnect();
    }
}

investigateDuplicateRecords();
