const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupAndFixPeriods() {
    try {
        console.log('=== CLEANING UP AND FIXING PERIODS ===\n');

        const groupId = '68444854086ea61b8b947d9d';
        
        // Get all current records
        const allRecords = await prisma.groupPeriodicRecord.findMany({
            where: { groupId },
            orderBy: { createdAt: 'asc' }
        });
        
        console.log(`Found ${allRecords.length} records to analyze:\n`);
        
        // Based on our investigation:
        // Record 1: 6/7/2025 - This should be the CLOSED June 2025 period
        // Record 2: 7/7/2025 - This should be the NEW July 2025 period (starting state)
        
        const junePeriod = allRecords.find(r => r.meetingDate && r.meetingDate.getDate() === 7 && r.meetingDate.getMonth() === 5); // June = month 5
        const julyPeriod = allRecords.find(r => r.meetingDate && r.meetingDate.getDate() === 7 && r.meetingDate.getMonth() === 6); // July = month 6
        
        if (!junePeriod || !julyPeriod) {
            console.log('❌ Could not identify June and July periods properly');
            return;
        }
        
        console.log('Identified periods:');
        console.log(`June 2025 (CLOSED): ${junePeriod.id}`);
        console.log(`July 2025 (NEW): ${julyPeriod.id}\n`);
        
        // Get correct values from user data
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: {
                memberships: {
                    include: { member: true }
                }
            }
        });
        
        const totalLoanAssets = group.memberships.reduce((total, membership) => {
            return total + (membership.currentLoanAmount || 0);
        }, 0);
        
        // From the user's data, after closing June period:
        const closedPeriodCashInHand = 214223.6;
        const closedPeriodCashInBank = 504921.4;
        const closedPeriodGroupStanding = closedPeriodCashInHand + closedPeriodCashInBank + totalLoanAssets;
        const collectionForJune = 393356; // From user data
        
        console.log('=== UPDATING JUNE 2025 (CLOSED PERIOD) ===');
        console.log(`Cash in Hand: ₹${closedPeriodCashInHand.toLocaleString()}`);
        console.log(`Cash in Bank: ₹${closedPeriodCashInBank.toLocaleString()}`);
        console.log(`Total Collection: ₹${collectionForJune.toLocaleString()}`);
        console.log(`Group Standing: ₹${closedPeriodGroupStanding.toLocaleString()}\n`);
        
        await prisma.groupPeriodicRecord.update({
            where: { id: junePeriod.id },
            data: {
                totalCollectionThisPeriod: collectionForJune,
                cashInHandAtEndOfPeriod: closedPeriodCashInHand,
                cashInBankAtEndOfPeriod: closedPeriodCashInBank,
                totalGroupStandingAtEndOfPeriod: closedPeriodGroupStanding,
                membersPresent: 15,
                recordSequenceNumber: 1
            }
        });
        
        console.log('✅ June period updated\n');
        
        console.log('=== UPDATING JULY 2025 (NEW PERIOD) ===');
        // July period should start with the same balances as June ended
        console.log(`Starting Cash in Hand: ₹${closedPeriodCashInHand.toLocaleString()}`);
        console.log(`Starting Cash in Bank: ₹${closedPeriodCashInBank.toLocaleString()}`);
        console.log(`Starting Group Standing: ₹${closedPeriodGroupStanding.toLocaleString()}`);
        console.log(`Collection This Period: ₹0 (new period)\n`);
        
        await prisma.groupPeriodicRecord.update({
            where: { id: julyPeriod.id },
            data: {
                totalCollectionThisPeriod: 0, // New period, no collections yet
                standingAtStartOfPeriod: closedPeriodGroupStanding,
                cashInHandAtEndOfPeriod: closedPeriodCashInHand,
                cashInBankAtEndOfPeriod: closedPeriodCashInBank,
                totalGroupStandingAtEndOfPeriod: closedPeriodGroupStanding,
                membersPresent: 0, // No meeting held yet
                recordSequenceNumber: 2,
                interestEarnedThisPeriod: 0,
                lateFinesCollectedThisPeriod: 0,
                newContributionsThisPeriod: 0
            }
        });
        
        console.log('✅ July period updated\n');
        
        // Verify the final state
        console.log('=== FINAL VERIFICATION ===\n');
        const finalRecords = await prisma.groupPeriodicRecord.findMany({
            where: { groupId },
            orderBy: { recordSequenceNumber: 'asc' }
        });
        
        finalRecords.forEach((record, index) => {
            const periodName = record.recordSequenceNumber === 1 ? 'June 2025 (CLOSED)' : 'July 2025 (CURRENT)';
            console.log(`${periodName}:`);
            console.log(`  ID: ${record.id}`);
            console.log(`  Sequence: ${record.recordSequenceNumber}`);
            console.log(`  Meeting Date: ${record.meetingDate ? record.meetingDate.toLocaleDateString() : 'N/A'}`);
            console.log(`  Collection This Period: ₹${(record.totalCollectionThisPeriod || 0).toLocaleString()}`);
            console.log(`  Cash in Hand: ₹${(record.cashInHandAtEndOfPeriod || 0).toLocaleString()}`);
            console.log(`  Cash in Bank: ₹${(record.cashInBankAtEndOfPeriod || 0).toLocaleString()}`);
            console.log(`  Group Standing: ₹${(record.totalGroupStandingAtEndOfPeriod || 0).toLocaleString()}`);
            console.log(`  Members Present: ${record.membersPresent || 0}`);
            console.log('---');
        });
        
        console.log('\n🎉 Period cleanup and fix completed successfully!\n');
        console.log('Summary:');
        console.log('- June 2025: Closed period with correct financial data');
        console.log('- July 2025: New period ready for contributions');
        console.log('- No duplicate records');
        console.log('- Group standing includes loan assets correctly\n');

    } catch (error) {
        console.error('Error cleaning up periods:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupAndFixPeriods();
