const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function examineDocumentStructure() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db();
        
        console.log('🔍 Examining document structure...\n');
        
        // Sample Group document
        const group = await db.collection('Group').findOne({});
        console.log('📋 Sample Group document:');
        console.log(JSON.stringify(group, null, 2));
        
        // Sample Member document
        const member = await db.collection('Member').findOne({});
        console.log('\n📋 Sample Member document:');
        console.log(JSON.stringify(member, null, 2));
        
        // Sample MemberContribution document
        const contribution = await db.collection('MemberContribution').findOne({});
        console.log('\n📋 Sample MemberContribution document:');
        console.log(JSON.stringify(contribution, null, 2));
        
        // Sample GroupPeriodicRecord document
        const period = await db.collection('GroupPeriodicRecord').findOne({});
        console.log('\n📋 Sample GroupPeriodicRecord document:');
        console.log(JSON.stringify(period, null, 2));
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

examineDocumentStructure().catch(console.error);
