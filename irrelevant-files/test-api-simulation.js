const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAPILikeCall() {
    try {
        // Simulate what the API does
        const groupId = '6843c8015e7efe4ba8191ca6'; // The group ID we know exists
        
        // Get the most recent periodic record for this group
        const currentPeriod = await prisma.groupPeriodicRecord.findFirst({
            where: { groupId },
            orderBy: { recordSequenceNumber: 'desc' }
        });

        if (!currentPeriod) {
            console.log('No period found');
            return;
        }

        // Get the group to access collection frequency
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            select: { collectionFrequency: true }
        });

        // Determine if the period is closed 
        const isClosed = currentPeriod.totalCollectionThisPeriod !== null && 
                        currentPeriod.totalCollectionThisPeriod > 0;

        // Calculate end date
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

        const periodType = group?.collectionFrequency || 'MONTHLY';
        const endDate = calculateEndDate(currentPeriod.meetingDate, periodType);

        // This is what the API should return
        const apiResponse = {
            success: true,
            period: {
                id: currentPeriod.id,
                startDate: currentPeriod.meetingDate,
                endDate: endDate,
                isClosed,
                periodNumber: currentPeriod.recordSequenceNumber || 1,
                periodType: periodType
            }
        };

        console.log('=== API Response Simulation ===');
        console.log(JSON.stringify(apiResponse, null, 2));
        
        // Test the frontend display format
        console.log('\n=== Frontend Display Format ===');
        const period = apiResponse.period;
        const startDateFormatted = period.startDate ? new Date(period.startDate).toLocaleDateString() : 'Unknown';
        const endDateFormatted = period.endDate ? new Date(period.endDate).toLocaleDateString() : 'Unknown';
        console.log(`Current Period: ${startDateFormatted} - ${endDateFormatted}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testAPILikeCall();
