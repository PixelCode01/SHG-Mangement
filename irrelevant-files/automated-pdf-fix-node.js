const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// Configuration
const WORKSPACE_DIR = '/home/pixel/aichat/shg24/SHG-Mangement-main';
const DOWNLOADS_DIR = '/home/pixel/Downloads';
const DEPLOY_WAIT_TIME = 180000; // 3 minutes in milliseconds
const MAX_ITERATIONS = 5;

// PDF files to test
const PDF_FILES = [
    'members.pdf',
    'members (1).pdf',
    'Swawlamban_Loan_Info.pdf',
    'SWAWLAMBAN till may 2025.pdf',
    'R1.pdf'
];

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to ask user questions
const askQuestion = (question) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase().startsWith('y'));
        });
    });
};

// Function to execute shell commands
const execCommand = (command, options = {}) => {
    try {
        console.log(`🔧 Executing: ${command}`);
        const result = execSync(command, { 
            cwd: WORKSPACE_DIR, 
            stdio: 'inherit',
            ...options 
        });
        return true;
    } catch (error) {
        console.error(`❌ Command failed: ${command}`);
        console.error(error.message);
        return false;
    }
};

// Function to update package.json for cache busting
const updatePackageJson = (version) => {
    const packagePath = path.join(WORKSPACE_DIR, 'package.json');
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    packageData.cacheBust = `v${version}_${Date.now()}`;
    fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2));
    console.log(`📦 Updated package.json with cache bust v${version}`);
};

// Function to build and deploy
const buildAndDeploy = async (version) => {
    console.log(`🔨 Building and deploying version ${version}...`);
    
    // Update package.json
    updatePackageJson(version);
    
    // Build the project
    console.log('🔨 Building project...');
    if (!execCommand('npm run build')) {
        throw new Error(`Build failed for version ${version}`);
    }
    
    // Commit and push changes
    console.log('📤 Committing and pushing changes...');
    execCommand('git add .');
    
    const commitMsg = `🚀 AUTOMATED PDF FIX V${version}: Server-side extraction - ${new Date().toISOString()}`;
    if (!execCommand(`git commit -m "${commitMsg}"`)) {
        console.log('⚠️ Nothing to commit (no changes)');
    }
    
    if (!execCommand('git push origin main')) {
        throw new Error(`Git push failed for version ${version}`);
    }
    
    console.log(`✅ Successfully deployed version ${version}`);
};

// Function to wait for deployment with progress
const waitForDeployment = async (version) => {
    console.log(`⏳ Waiting ${DEPLOY_WAIT_TIME/1000} seconds for Vercel deployment...`);
    
    const startTime = Date.now();
    const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = DEPLOY_WAIT_TIME - elapsed;
        const progress = Math.round((elapsed / DEPLOY_WAIT_TIME) * 100);
        
        if (remaining > 0) {
            console.log(`⏳ Deployment progress: ${progress}% (${Math.round(remaining/1000)}s remaining)`);
        }
    }, 10000); // Update every 10 seconds
    
    await sleep(DEPLOY_WAIT_TIME);
    clearInterval(interval);
    
    console.log(`✅ Deployment wait completed for version ${version}`);
};

// Function to test PDF import
const testPDFImport = async (version) => {
    console.log(`🧪 Testing PDF import for version ${version}...`);
    
    console.log('📄 PDF files available for testing:');
    PDF_FILES.forEach(pdf => {
        const pdfPath = path.join(DOWNLOADS_DIR, pdf);
        if (fs.existsSync(pdfPath)) {
            const stats = fs.statSync(pdfPath);
            const sizeKB = Math.round(stats.size / 1024);
            console.log(`  ✅ ${pdf} (${sizeKB} KB)`);
        } else {
            console.log(`  ❌ ${pdf} (not found)`);
        }
    });
    
    console.log('\\n🌐 Testing Instructions:');
    console.log('1. Open your deployed site in an INCOGNITO/PRIVATE window');
    console.log('2. Navigate to the group creation page');
    console.log('3. Try importing members from PDF using the files listed above');
    console.log(`4. Check browser console for V${version} log messages`);
    console.log('5. Verify that members are extracted correctly');
    console.log('');
    
    return await askQuestion('🎯 Did the PDF import work correctly for ALL test files? (y/n): ');
};

// Strategy implementations
const strategies = {
    1: () => {
        console.log('📋 Strategy 1: Server-side PDF extraction with pdf-parse library');
        // Already implemented - just deploy
    },
    
    2: () => {
        console.log('📋 Strategy 2: Enhanced server-side with more robust extraction');
        
        const routePath = path.join(WORKSPACE_DIR, 'app/api/pdf-upload-v11/route.ts');
        let content = fs.readFileSync(routePath, 'utf8');
        
        // Add version identifier
        content = content.replace(
            'PDF-UPLOAD-V11:',
            'PDF-UPLOAD-V12:'
        );
        
        // Enhance extraction logic
        const enhancement = `
        // V12 Enhancement: More robust text extraction
        if (extractedText.length < 50) {
          console.log('🔄 V12: Trying enhanced binary extraction...');
          extractedText = extractTextWithAdvancedFiltering(buffer);
        }`;
        
        content = content.replace(
            'console.log(`📝 Binary extraction: ${extractedText.length} characters`);',
            `console.log(\`📝 Binary extraction: \${extractedText.length} characters\`);\n${enhancement}`
        );
        
        fs.writeFileSync(routePath, content);
        console.log('✅ Applied enhanced server extraction strategy');
    },
    
    3: () => {
        console.log('📋 Strategy 3: Update endpoint to V13 with additional parsing methods');
        
        // Create new endpoint version
        const oldRoutePath = path.join(WORKSPACE_DIR, 'app/api/pdf-upload-v11/route.ts');
        const newRoutePath = path.join(WORKSPACE_DIR, 'app/api/pdf-upload-v13/route.ts');
        
        let content = fs.readFileSync(oldRoutePath, 'utf8');
        content = content.replace(/PDF-UPLOAD-V1[12]:/g, 'PDF-UPLOAD-V13:');
        content = content.replace(/V1[12] Enhancement/g, 'V13 Enhancement');
        
        // Create directory if it doesn't exist
        const apiDir = path.dirname(newRoutePath);
        if (!fs.existsSync(apiDir)) {
            fs.mkdirSync(apiDir, { recursive: true });
        }
        
        fs.writeFileSync(newRoutePath, content);
        
        // Update frontend to use new endpoint
        const formPath = path.join(WORKSPACE_DIR, 'app/components/MultiStepGroupForm.tsx');
        let formContent = fs.readFileSync(formPath, 'utf8');
        formContent = formContent.replace(
            '/api/pdf-upload-v11',
            '/api/pdf-upload-v13'
        );
        formContent = formContent.replace(
            'CACHE BUST V11',
            'CACHE BUST V13'
        );
        fs.writeFileSync(formPath, formContent);
        
        console.log('✅ Applied V13 endpoint strategy');
    },
    
    4: () => {
        console.log('📋 Strategy 4: Fallback to enhanced client-side extraction');
        
        const formPath = path.join(WORKSPACE_DIR, 'app/components/MultiStepGroupForm.tsx');
        let content = fs.readFileSync(formPath, 'utf8');
        
        // Create a more robust client-side extraction as fallback
        const newFallback = `
        console.log('🔄 V14: Using enhanced client-side fallback...');
        // Try reading as text with different approaches
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Method 1: Try UTF-8 decoding
        const decoder = new TextDecoder('utf-8', { fatal: false });
        let text = decoder.decode(uint8Array);
        
        // Method 2: Filter and extract readable text
        text = text.replace(/[\\x00-\\x1F\\x7F-\\x9F]/g, ' '); // Remove control chars
        text = text.replace(/[^\\x20-\\x7E\\n\\r\\t]/g, ' '); // Keep printable ASCII
        text = text.replace(/\\s+/g, ' ').trim();
        
        return processExtractedPDFLines(text.split('\\n'));`;
        
        content = content.replace(
            'return await extractMembersFromPDFV8(file);',
            newFallback
        );
        
        fs.writeFileSync(formPath, content);
        console.log('✅ Applied enhanced client-side fallback strategy');
    },
    
    5: () => {
        console.log('📋 Strategy 5: Last resort - simplified manual parsing guidance');
        
        const formPath = path.join(WORKSPACE_DIR, 'app/components/MultiStepGroupForm.tsx');
        let content = fs.readFileSync(formPath, 'utf8');
        
        // Add more detailed error messaging and guidance
        const guidanceMessage = `
        console.error('❌ V15: All PDF extraction methods failed');
        console.log('📋 V15: Please try the following:');
        console.log('1. Convert PDF to text format first');
        console.log('2. Copy and paste member names manually');
        console.log('3. Use a different PDF viewer to extract text');
        alert('PDF extraction failed. Please convert PDF to text or enter members manually.');
        return [];`;
        
        content = content.replace(
            'return processExtractedPDFLines(text.split(\'\\n\'));',
            guidanceMessage
        );
        
        fs.writeFileSync(formPath, content);
        console.log('✅ Applied last resort strategy with user guidance');
    }
};

// Main automation function
const runAutomation = async () => {
    console.log('🚀 Starting Automated PDF Import Fix and Test Process');
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log('');
    
    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
        console.log('='.repeat(60));
        console.log(`🔄 ITERATION ${iteration} of ${MAX_ITERATIONS}`);
        console.log('='.repeat(60));
        
        try {
            // Apply strategy for this iteration
            if (strategies[iteration]) {
                strategies[iteration]();
            } else {
                console.log('❌ No more strategies available');
                break;
            }
            
            // Build and deploy
            await buildAndDeploy(iteration);
            
            // Wait for deployment
            await waitForDeployment(iteration);
            
            // Test PDF import
            const success = await testPDFImport(iteration);
            
            if (success) {
                console.log('🎉 SUCCESS! PDF import is working');
                console.log(`📋 Working strategy: Iteration ${iteration}`);
                console.log(`📅 Completed at: ${new Date().toISOString()}`);
                process.exit(0);
            }
            
            console.log(`❌ Iteration ${iteration} failed, trying next strategy...`);
            console.log('');
            
        } catch (error) {
            console.error(`❌ Error in iteration ${iteration}:`, error.message);
            console.log('');
        }
    }
    
    console.log('❌ All strategies failed');
    console.log('📋 Manual intervention required');
    console.log(`📅 Completed at: ${new Date().toISOString()}`);
    process.exit(1);
};

// Run the automation
runAutomation().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
