const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGroupsAndPeriods() {
    try {
        // Get all groups
        const groups = await prisma.group.findMany({
            select: {
                id: true,
                name: true,
                collectionFrequency: true,
                cashInHand: true,
                balanceInBank: true
            }
        });
        
        console.log('Available groups:', groups.length);
        
        for (const group of groups) {
            console.log(`\nGroup: ${group.name} (${group.id})`);
            console.log(`Collection frequency: ${group.collectionFrequency}`);
            
            // Check for periods
            const periods = await prisma.groupPeriodicRecord.findMany({
                where: { groupId: group.id },
                orderBy: { recordSequenceNumber: 'desc' },
                take: 3
            });
            
            console.log(`Periods: ${periods.length}`);
            
            if (periods.length > 0) {
                console.log('Latest period:');
                console.log('  Start Date:', periods[0].meetingDate);
                console.log('  Sequence:', periods[0].recordSequenceNumber);
                console.log('  Total Collection:', periods[0].totalCollectionThisPeriod);
                
                // Test end date calculation for this group
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
                const endDate = calculateEndDate(periods[0].meetingDate, periodType);
                
                console.log('  Calculated End Date:', endDate.toLocaleDateString());
                console.log('  Period Range:', `${periods[0].meetingDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
            } else {
                console.log('  No periods found for this group');
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkGroupsAndPeriods();
