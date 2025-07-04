const fetch = require('node-fetch');

// Test the current period API to verify endDate calculation
async function testCurrentPeriodAPI() {
    try {
        // First, let's get available groups
        const groupsResponse = await fetch('http://localhost:3000/api/groups');
        if (!groupsResponse.ok) {
            throw new Error(`Groups API failed: ${groupsResponse.status}`);
        }
        
        const groups = await groupsResponse.json();
        console.log('Available groups:', groups.length);
        
        if (groups.length === 0) {
            console.log('No groups found');
            return;
        }
        
        // Test with the first group
        const testGroup = groups[0];
        console.log(`\nTesting with group: ${testGroup.name} (ID: ${testGroup.id})`);
        console.log(`Collection frequency: ${testGroup.collectionFrequency}`);
        
        // Test current period API
        const currentPeriodResponse = await fetch(`http://localhost:3000/api/groups/${testGroup.id}/contributions/periods/current`);
        
        if (!currentPeriodResponse.ok) {
            throw new Error(`Current period API failed: ${currentPeriodResponse.status}`);
        }
        
        const currentPeriod = await currentPeriodResponse.json();
        console.log('\n=== Current Period API Response ===');
        console.log('Period ID:', currentPeriod.id);
        console.log('Start Date:', currentPeriod.startDate);
        console.log('End Date:', currentPeriod.endDate);
        console.log('Is Closed:', currentPeriod.isClosed);
        console.log('Period Number:', currentPeriod.periodNumber);
        
        if (currentPeriod.endDate) {
            const startDate = new Date(currentPeriod.startDate);
            const endDate = new Date(currentPeriod.endDate);
            console.log('\n=== Date Calculation Verification ===');
            console.log('Start Date (parsed):', startDate.toLocaleDateString());
            console.log('End Date (parsed):', endDate.toLocaleDateString());
            console.log('Days difference:', Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
        }
        
        // Also check financial summary
        if (currentPeriod.summary) {
            console.log('\n=== Financial Summary ===');
            console.log('Starting Cash In Hand:', currentPeriod.summary.startingCashInHand);
            console.log('Starting Cash In Bank:', currentPeriod.summary.startingCashInBank);
            console.log('Ending Cash In Hand:', currentPeriod.summary.endingCashInHand);
            console.log('Ending Cash In Bank:', currentPeriod.summary.endingCashInBank);
            console.log('Total Loan Assets:', currentPeriod.summary.totalLoanAssets);
            console.log('Group Standing:', currentPeriod.summary.groupStanding);
        }
        
    } catch (error) {
        console.error('Error testing current period API:', error);
    }
}

testCurrentPeriodAPI();
