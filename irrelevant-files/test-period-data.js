const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCurrentPeriodData() {
    try {
        // Get first group
        const groups = await prisma.group.findMany({
            take: 1
        });
        
        if (groups.length === 0) {
            console.log('No groups found');
            return;
        }
        
        const group = groups[0];
        console.log('Testing with group:', group.name);
        console.log('Collection frequency:', group.collectionFrequency);
        
        // Get current period
        const currentPeriod = await prisma.groupPeriodicRecord.findFirst({
            where: { groupId: group.id },
            orderBy: { recordSequenceNumber: 'desc' }
        });
        
        if (!currentPeriod) {
            console.log('No current period found');
            return;
        }
        
        console.log('\n=== Current Period Data ===');
        console.log('Period ID:', currentPeriod.id);
        console.log('Meeting Date (Start):', currentPeriod.meetingDate);
        console.log('Sequence Number:', currentPeriod.recordSequenceNumber);
        console.log('Total Collection:', currentPeriod.totalCollectionThisPeriod);
        
        // Calculate end date like the API does
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
        const endDate = calculateEndDate(currentPeriod.meetingDate, periodType);
        
        console.log('\n=== Calculated End Date ===');
        console.log('Period Type:', periodType);
        console.log('Start Date:', currentPeriod.meetingDate.toLocaleDateString());
        console.log('Calculated End Date:', endDate.toLocaleDateString());
        console.log('End Date ISO:', endDate.toISOString());
        
    } catch (error) {
        console.error('Error testing current period data:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testCurrentPeriodData();
