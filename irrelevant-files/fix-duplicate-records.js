const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixDuplicateRecords() {
    try {
        console.log('=== FIXING DUPLICATE RECORDS ===\n');

        const groupId = '68444854086ea61b8b947d9d';
        
        // Get the loan assets
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
        
        const totalLoanAssets = group.memberships.reduce((total, membership) => {
            return total + (membership.currentLoanAmount || 0);
        }, 0);
        
        console.log(`Total loan assets: ₹${totalLoanAssets.toLocaleString()}`);
        
        // Based on the user's data
        const correctCashInHand = 214223.6;
        const correctCashInBank = 504921.4;
        const correctGroupStanding = correctCashInHand + correctCashInBank + totalLoanAssets;
        
        console.log(`Correct Cash in Hand: ₹${correctCashInHand.toLocaleString()}`);
        console.log(`Correct Cash in Bank: ₹${correctCashInBank.toLocaleString()}`);
        console.log(`Correct Group Standing: ₹${correctGroupStanding.toLocaleString()}\n`);
        
        // Get all records for this group
        const allRecords = await prisma.groupPeriodicRecord.findMany({
            where: { groupId },
            orderBy: { createdAt: 'desc' }
        });
        
        console.log(`Found ${allRecords.length} records to update:\n`);
        
        // Update each record with correct values
        for (let i = 0; i < allRecords.length; i++) {
            const record = allRecords[i];
            console.log(`Updating Record ${i + 1}:`);
            console.log(`  ID: ${record.id}`);
            console.log(`  Meeting Date: ${record.meetingDate ? record.meetingDate.toLocaleDateString() : 'N/A'}`);
            console.log(`  Before: Cash in Hand: ₹${(record.cashInHandAtEndOfPeriod || 0).toLocaleString()}, Cash in Bank: ₹${(record.cashInBankAtEndOfPeriod || 0).toLocaleString()}, Group Standing: ₹${(record.totalGroupStandingAtEndOfPeriod || 0).toLocaleString()}`);
            
            const updatedRecord = await prisma.groupPeriodicRecord.update({
                where: { id: record.id },
                data: {
                    cashInHandAtEndOfPeriod: correctCashInHand,
                    cashInBankAtEndOfPeriod: correctCashInBank,
                    totalGroupStandingAtEndOfPeriod: correctGroupStanding,
                    membersPresent: 15  // Set to actual member count
                }
            });
            
            console.log(`  After: Cash in Hand: ₹${updatedRecord.cashInHandAtEndOfPeriod.toLocaleString()}, Cash in Bank: ₹${updatedRecord.cashInBankAtEndOfPeriod.toLocaleString()}, Group Standing: ₹${updatedRecord.totalGroupStandingAtEndOfPeriod.toLocaleString()}`);
            console.log(`  ✅ Updated successfully\n`);
        }
        
        console.log('=== CHECKING FOR DUPLICATES TO REMOVE ===\n');
        
        // After updating, check if we should remove one of the duplicates
        const updatedRecords = await prisma.groupPeriodicRecord.findMany({
            where: { groupId },
            orderBy: { createdAt: 'desc' }
        });
        
        // Group by meeting date to find duplicates
        const recordsByDate = {};
        updatedRecords.forEach(record => {
            const dateKey = record.meetingDate ? record.meetingDate.toISOString().split('T')[0] : 'no-date';
            if (!recordsByDate[dateKey]) {
                recordsByDate[dateKey] = [];
            }
            recordsByDate[dateKey].push(record);
        });
        
        // Remove duplicates (keep the older one, remove newer duplicates)
        for (const [dateKey, records] of Object.entries(recordsByDate)) {
            if (records.length > 1) {
                console.log(`❌ Found ${records.length} records for date ${dateKey}`);
                
                // Sort by creation time, keep the first one (oldest)
                records.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                
                // Remove all but the first one
                for (let i = 1; i < records.length; i++) {
                    const recordToDelete = records[i];
                    console.log(`  Deleting duplicate record: ${recordToDelete.id} (created: ${recordToDelete.createdAt.toLocaleDateString()})`);
                    
                    await prisma.groupPeriodicRecord.delete({
                        where: { id: recordToDelete.id }
                    });
                    
                    console.log(`  ✅ Deleted duplicate record`);
                }
                
                console.log(`  Kept original record: ${records[0].id} (created: ${records[0].createdAt.toLocaleDateString()})\n`);
            }
        }
        
        // Final verification
        console.log('=== FINAL VERIFICATION ===\n');
        const finalRecords = await prisma.groupPeriodicRecord.findMany({
            where: { groupId },
            orderBy: { createdAt: 'desc' }
        });
        
        console.log(`Final record count: ${finalRecords.length}`);
        finalRecords.forEach((record, index) => {
            console.log(`Record ${index + 1}:`);
            console.log(`  ID: ${record.id}`);
            console.log(`  Meeting Date: ${record.meetingDate ? record.meetingDate.toLocaleDateString() : 'N/A'}`);
            console.log(`  Cash in Hand: ₹${record.cashInHandAtEndOfPeriod.toLocaleString()}`);
            console.log(`  Cash in Bank: ₹${record.cashInBankAtEndOfPeriod.toLocaleString()}`);
            console.log(`  Group Standing: ₹${record.totalGroupStandingAtEndOfPeriod.toLocaleString()}`);
            console.log(`  Members Present: ${record.membersPresent || 'N/A'}`);
            console.log('---');
        });

    } catch (error) {
        console.error('Error fixing duplicate records:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixDuplicateRecords();
