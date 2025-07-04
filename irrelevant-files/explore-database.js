const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function exploreDatabases() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        
        // List all databases
        const admin = client.db().admin();
        const databases = await admin.listDatabases();
        
        console.log('🗄️ Available databases:');
        databases.databases.forEach(db => {
            console.log(`  - ${db.name} (${db.sizeOnDisk} bytes)`);
        });
        
        // Check the default database
        const db = client.db();
        console.log(`\n📚 Current database: ${db.databaseName}`);
        
        // List collections in current database
        const collections = await db.listCollections().toArray();
        console.log(`\n📁 Collections in ${db.databaseName}:`);
        collections.forEach(col => {
            console.log(`  - ${col.name}`);
        });
        
        // Check specific collections for data
        const collectionNames = ['groups', 'periods', 'members', 'contributions'];
        
        for (const colName of collectionNames) {
            try {
                const count = await db.collection(colName).countDocuments();
                console.log(`\n📊 ${colName}: ${count} documents`);
                
                if (count > 0 && count < 10) {
                    const sample = await db.collection(colName).findOne();
                    console.log(`  Sample document:`, JSON.stringify(sample, null, 2));
                }
            } catch (error) {
                console.log(`\n❌ Error checking ${colName}:`, error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

exploreDatabases().catch(console.error);
