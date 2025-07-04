const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestPeriod() {
    try {
        // Get the group
        const group = await prisma.group.findFirst({
            select: {
                id: true,
                name: true,
                cashInHand: true,
                balanceInBank: true,
                collectionFrequency: true
            }
        });
        
        if (!group) {
            console.log('No group found');
            return;
        }
        
        console.log(`Creating test period for group: ${group.name}`);
        
        // Create a test period
        const testPeriod = await prisma.groupPeriodicRecord.create({
            data: {
                groupId: group.id,
                meetingDate: new Date('2025-06-07'), // Today's date as mentioned in the context
                recordSequenceNumber: 1,
                totalCollectionThisPeriod: 0,
                standingAtStartOfPeriod: (group.cashInHand || 0) + (group.balanceInBank || 0),
                cashInBankAtEndOfPeriod: group.balanceInBank || 0,
                cashInHandAtEndOfPeriod: group.cashInHand || 0,
                totalGroupStandingAtEndOfPeriod: (group.cashInHand || 0) + (group.balanceInBank || 0),
            }
        });
        
        console.log('Created test period:');
        console.log('  ID:', testPeriod.id);
        console.log('  Meeting Date:', testPeriod.meetingDate);
        console.log('  Sequence Number:', testPeriod.recordSequenceNumber);
        
        // Test the end date calculation
        const calculateEndDate = (startDate, periodType) => {
            const start = new Date(startDate);
            switch (periodType) {
                case 'WEEKLY':
                    start.setDate(start.getDate() + 7);
                    break;
                case 'FORTNIGHTLY':
                    start.setDate(start.getDate() + 14);
                    break;
                case 'MONTHLY':
                    start.setMonth(start.getMonth() + 1);
                    break;
                case 'YEARLY':
                    start.setFullYear(start.getFullYear() + 1);
                    break;
                default:
                    start.setMonth(start.getMonth() + 1);
            }
            start.setDate(start.getDate() - 1);
            return start;
        };
        
        const periodType = group.collectionFrequency || 'MONTHLY';
        const endDate = calculateEndDate(testPeriod.meetingDate, periodType);
        
        console.log('\nEnd Date Calculation:');
        console.log('  Period Type:', periodType);
        console.log('  Start Date:', testPeriod.meetingDate.toLocaleDateString());
        console.log('  End Date:', endDate.toLocaleDateString());
        console.log('  Period Range:', `${testPeriod.meetingDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
        
    } catch (error) {
        console.error('Error creating test period:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createTestPeriod();
