const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function investigateRecordCreation() {
    try {
        console.log('=== INVESTIGATING RECORD CREATION PATTERN ===\n');

        const groupId = '68444854086ea61b8b947d9d';
        
        // Get all records with detailed timestamps
        const allRecords = await prisma.groupPeriodicRecord.findMany({
            where: { groupId },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                meetingDate: true,
                recordSequenceNumber: true,
                totalCollectionThisPeriod: true,
                cashInHandAtEndOfPeriod: true,
                cashInBankAtEndOfPeriod: true,
                totalGroupStandingAtEndOfPeriod: true,
                membersPresent: true,
                createdAt: true,
                updatedAt: true
            }
        });
        
        console.log(`Found ${allRecords.length} records:\n`);
        
        allRecords.forEach((record, index) => {
            const createdTime = record.createdAt.toLocaleString();
            const updatedTime = record.updatedAt.toLocaleString();
            const meetingDate = record.meetingDate ? record.meetingDate.toLocaleDateString() : 'N/A';
            
            console.log(`Record ${index + 1}:`);
            console.log(`  ID: ${record.id}`);
            console.log(`  Meeting Date: ${meetingDate}`);
            console.log(`  Sequence Number: ${record.recordSequenceNumber || 'N/A'}`);
            console.log(`  Collection This Period: ₹${(record.totalCollectionThisPeriod || 0).toLocaleString()}`);
            console.log(`  Group Standing: ₹${(record.totalGroupStandingAtEndOfPeriod || 0).toLocaleString()}`);
            console.log(`  Created At: ${createdTime}`);
            console.log(`  Updated At: ${updatedTime}`);
            
            // Check timing between creation and update
            const timeDiff = record.updatedAt.getTime() - record.createdAt.getTime();
            if (timeDiff > 1000) {  // More than 1 second
                console.log(`  ⏱️  Time between create/update: ${Math.round(timeDiff/1000)} seconds`);
            }
            
            console.log('---');
        });
        
        console.log('\n=== CREATION TIMING ANALYSIS ===\n');
        
        // Check for rapid creation patterns
        for (let i = 1; i < allRecords.length; i++) {
            const prev = allRecords[i-1];
            const curr = allRecords[i];
            
            const timeBetween = curr.createdAt.getTime() - prev.createdAt.getTime();
            
            console.log(`Time between Record ${i} and Record ${i+1}: ${Math.round(timeBetween/1000)} seconds`);
            
            if (timeBetween < 60000) {  // Less than 1 minute
                console.log(`⚠️  RAPID CREATION: Records created within ${Math.round(timeBetween/1000)} seconds of each other`);
            }
        }
        
        console.log('\n=== SEQUENCE NUMBER ANALYSIS ===\n');
        
        const sequenceNumbers = allRecords.map(r => r.recordSequenceNumber).filter(n => n !== null);
        const uniqueSequences = [...new Set(sequenceNumbers)];
        
        console.log(`Sequence numbers found: [${sequenceNumbers.join(', ')}]`);
        console.log(`Unique sequence numbers: [${uniqueSequences.join(', ')}]`);
        
        if (sequenceNumbers.length !== uniqueSequences.length) {
            console.log('❌ DUPLICATE SEQUENCE NUMBERS DETECTED!');
        }
        
        console.log('\n=== RECOMMENDATIONS ===\n');
        
        if (allRecords.length > 1) {
            const hasDuplicateValues = allRecords.some((record, i) => 
                allRecords.some((other, j) => 
                    i !== j && 
                    record.totalGroupStandingAtEndOfPeriod === other.totalGroupStandingAtEndOfPeriod &&
                    record.cashInHandAtEndOfPeriod === other.cashInHandAtEndOfPeriod &&
                    record.cashInBankAtEndOfPeriod === other.cashInBankAtEndOfPeriod
                )
            );
            
            if (hasDuplicateValues) {
                console.log('❌ Found duplicate financial values across multiple records');
                console.log('📋 Recommendation: Remove duplicate records and ensure only one record per period');
            }
            
            const hasIncorrectGroupStanding = allRecords.some(record => 
                record.totalGroupStandingAtEndOfPeriod < 7000000  // Should include loan assets
            );
            
            if (hasIncorrectGroupStanding) {
                console.log('❌ Found records with group standing that appears to exclude loan assets');
                console.log('📋 Recommendation: Update group standing calculations to include loan assets');
            }
        }

    } catch (error) {
        console.error('Error investigating record creation:', error);
    } finally {
        await prisma.$disconnect();
    }
}

investigateRecordCreation();
