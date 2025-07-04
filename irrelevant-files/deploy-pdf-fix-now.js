const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 IMMEDIATE PDF FIX DEPLOYMENT - V11 Server-side Extraction');
console.log('📅 Starting immediate deployment...');

const WORKSPACE_DIR = '/home/pixel/aichat/shg24/SHG-Mangement-main';

// Helper function to execute commands
const execCommand = (command) => {
    try {
        console.log(`🔧 ${command}`);
        execSync(command, { cwd: WORKSPACE_DIR, stdio: 'inherit' });
        return true;
    } catch (error) {
        console.error(`❌ Command failed: ${command}`);
        return false;
    }
};

// Update package.json for cache busting
const updatePackageJson = () => {
    const packagePath = path.join(WORKSPACE_DIR, 'package.json');
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    packageData.cacheBust = `v11_server_${Date.now()}`;
    fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2));
    console.log('📦 Updated package.json with V11 cache bust');
};

const main = async () => {
    try {
        // Update cache bust
        updatePackageJson();
        
        // Build
        console.log('🔨 Building project...');
        if (!execCommand('npm run build')) {
            throw new Error('Build failed');
        }
        
        // Commit and push
        console.log('📤 Deploying to production...');
        execCommand('git add .');
        execCommand('git commit -m "🚀 V11 PDF IMPORT FIX: Server-side extraction with pdf-parse"');
        execCommand('git push origin main');
        
        console.log('✅ Deployment initiated successfully!');
        console.log('');
        console.log('⏳ WAITING 180 SECONDS FOR VERCEL DEPLOYMENT...');
        console.log('📄 Test with these PDFs:');
        
        const DOWNLOADS_DIR = '/home/pixel/Downloads';
        const PDF_FILES = ['members.pdf', 'members (1).pdf', 'Swawlamban_Loan_Info.pdf', 'SWAWLAMBAN till may 2025.pdf'];
        
        PDF_FILES.forEach(pdf => {
            const pdfPath = path.join(DOWNLOADS_DIR, pdf);
            if (fs.existsSync(pdfPath)) {
                const stats = fs.statSync(pdfPath);
                const sizeKB = Math.round(stats.size / 1024);
                console.log(`  ✅ ${pdf} (${sizeKB} KB)`);
            }
        });
        
        console.log('');
        console.log('🌐 After deployment completes:');
        console.log('1. Open your site in INCOGNITO mode');
        console.log('2. Go to group creation page');
        console.log('3. Try PDF import with the files above');
        console.log('4. Check console for "V11" messages');
        
        // Start countdown
        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = 180000 - elapsed;
            
            if (remaining > 0) {
                const remainingSeconds = Math.round(remaining / 1000);
                process.stdout.write(`\\r⏳ ${remainingSeconds} seconds remaining...`);
            } else {
                clearInterval(interval);
                console.log('\\n✅ Deployment should be complete! Test now!');
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        process.exit(1);
    }
};

main();
