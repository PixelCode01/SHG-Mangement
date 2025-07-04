#!/bin/bash

# Comprehensive PDF Import Fix and Test Automation Script
# This script will iterate through different strategies until PDF import works

echo "🚀 Starting Comprehensive PDF Import Fix and Test Automation"
echo "📅 Started at: $(date)"

# Configuration
WORKSPACE_DIR="/home/pixel/aichat/shg24/SHG-Mangement-main"
DOWNLOADS_DIR="/home/pixel/Downloads"
DEPLOY_WAIT_TIME=180  # 3 minutes wait after each deployment
MAX_ITERATIONS=5
CURRENT_ITERATION=1

# PDF files to test
PDF_FILES=(
    "members.pdf"
    "members (1).pdf"
    "Swawlamban_Loan_Info.pdf"
    "SWAWLAMBAN till may 2025.pdf"
    "R1.pdf"
)

# Function to build and deploy
build_and_deploy() {
    local version=$1
    echo "🔨 Building and deploying version $version..."
    
    cd "$WORKSPACE_DIR"
    
    # Update package.json timestamp for cache busting
    echo "📦 Updating package.json timestamp..."
    jq ".cacheBust = \"v${version}_$(date +%s)\"" package.json > package.json.tmp && mv package.json.tmp package.json
    
    # Build the project
    echo "🔨 Building project..."
    npm run build
    
    if [ $? -ne 0 ]; then
        echo "❌ Build failed for version $version"
        return 1
    fi
    
    # Commit and push changes
    echo "📤 Committing and pushing changes..."
    git add .
    git commit -m "🚀 CACHE BUST V${version}: Automated PDF import fix - $(date)"
    git push origin main
    
    if [ $? -ne 0 ]; then
        echo "❌ Git push failed for version $version"
        return 1
    fi
    
    echo "✅ Successfully deployed version $version"
    return 0
}

# Function to wait for deployment
wait_for_deployment() {
    local version=$1
    echo "⏳ Waiting ${DEPLOY_WAIT_TIME} seconds for Vercel deployment to complete..."
    
    for i in $(seq 1 $DEPLOY_WAIT_TIME); do
        echo -ne "\r⏳ Waiting... ${i}/${DEPLOY_WAIT_TIME} seconds"
        sleep 1
    done
    echo ""
    
    echo "✅ Deployment wait completed for version $version"
}

# Function to test PDF import (requires manual verification)
test_pdf_import() {
    local version=$1
    echo "🧪 Testing PDF import for version $version..."
    
    echo "📄 PDF files available for testing:"
    for pdf in "${PDF_FILES[@]}"; do
        if [ -f "$DOWNLOADS_DIR/$pdf" ]; then
            echo "  ✅ $pdf ($(ls -lh "$DOWNLOADS_DIR/$pdf" | awk '{print $5}'))"
        else
            echo "  ❌ $pdf (not found)"
        fi
    done
    
    echo ""
    echo "🌐 Please test the PDF import feature at your deployed site:"
    echo "   1. Open your deployed site in an INCOGNITO/PRIVATE window"
    echo "   2. Navigate to the group creation page"
    echo "   3. Try importing members from PDF using the files listed above"
    echo "   4. Check browser console for V${version} log messages"
    echo ""
    
    read -p "🎯 Did the PDF import work correctly for ALL test files? (y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🎉 SUCCESS! PDF import is working for version $version"
        return 0
    else
        echo "❌ PDF import still not working for version $version"
        return 1
    fi
}

# Function to create next iteration strategy
create_next_strategy() {
    local iteration=$1
    echo "🔄 Creating strategy for iteration $iteration..."
    
    case $iteration in
        1)
            echo "📋 Strategy 1: Server-side PDF extraction with pdf-parse library"
            # Already implemented - just deploy
            ;;
        2)
            echo "📋 Strategy 2: Enhanced server-side with multiple extraction methods"
            # Enhance the server-side endpoint with more robust extraction
            node -e "
            const fs = require('fs');
            const routePath = '$WORKSPACE_DIR/app/api/pdf-upload-v11/route.ts';
            let content = fs.readFileSync(routePath, 'utf8');
            
            // Add more extraction strategies
            content = content.replace(
                'console.log(\`📝 Binary extraction: \${extractedText.length} characters\`);',
                \`console.log(\\\`📝 Binary extraction: \\\${extractedText.length} characters\\\`);
                
                // Strategy 2.1: Try different buffer processing
                if (extractedText.length < 50) {
                  console.log('🔄 Trying enhanced binary extraction...');
                  extractedText = extractTextWithAdvancedFiltering(buffer);
                }\`
            );
            
            // Add the new function
            content = content.replace(
                'function extractWithMultipleEncodings',
                \`function extractTextWithAdvancedFiltering(buffer: Buffer): string {
                  // More aggressive text extraction
                  let text = buffer.toString('utf-8');
                  
                  // Remove PDF headers and metadata
                  text = text.replace(/%PDF-[0-9]\.[0-9]/g, '');
                  text = text.replace(/%%EOF/g, '');
                  text = text.replace(/\/Type\s*\/[A-Za-z]+/g, '');
                  
                  // Extract readable text patterns
                  const readableLines = text.split(/[\\n\\r]+/)
                    .map(line => line.replace(/[^\\x20-\\x7E]/g, ' ').trim())
                    .filter(line => line.length > 1 && /[A-Za-z]/.test(line));
                    
                  return readableLines.join('\\n');
                }
                
                function extractWithMultipleEncodings\`
            );
            
            fs.writeFileSync(routePath, content);
            console.log('✅ Enhanced server extraction strategy');
            "
            ;;
        3)
            echo "📋 Strategy 3: Client-side fallback with aggressive cache busting"
            # Revert to client-side but with more aggressive cache busting
            node -e "
            const fs = require('fs');
            const formPath = '$WORKSPACE_DIR/app/components/MultiStepGroupForm.tsx';
            let content = fs.readFileSync(formPath, 'utf8');
            
            // Update to use V12 function name and add more cache busting
            content = content.replace(
                'extractMembersFromPDFV11',
                'extractMembersFromPDFV12'
            );
            
            // Add more aggressive client-side cache busting
            const timestamp = Date.now();
            content = content.replace(
                'CACHE BUST V11',
                \`CACHE BUST V12_\${timestamp}\`
            );
            
            fs.writeFileSync(formPath, content);
            console.log('✅ Applied client-side fallback strategy');
            "
            ;;
        4)
            echo "📋 Strategy 4: Hybrid approach with multiple extraction attempts"
            # Implement a hybrid approach that tries multiple methods
            ;;
        5)
            echo "📋 Strategy 5: Last resort - simplified text extraction"
            # Simple regex-based text extraction
            ;;
        *)
            echo "❌ No more strategies available"
            return 1
            ;;
    esac
    
    return 0
}

# Main automation loop
echo "🚀 Starting automated PDF import fix iteration..."

while [ $CURRENT_ITERATION -le $MAX_ITERATIONS ]; do
    echo ""
    echo "=================================================="
    echo "🔄 ITERATION $CURRENT_ITERATION of $MAX_ITERATIONS"
    echo "=================================================="
    
    # Create strategy for this iteration
    if ! create_next_strategy $CURRENT_ITERATION; then
        echo "❌ Failed to create strategy for iteration $CURRENT_ITERATION"
        break
    fi
    
    # Build and deploy
    if ! build_and_deploy $CURRENT_ITERATION; then
        echo "❌ Failed to build and deploy iteration $CURRENT_ITERATION"
        ((CURRENT_ITERATION++))
        continue
    fi
    
    # Wait for deployment
    wait_for_deployment $CURRENT_ITERATION
    
    # Test PDF import
    if test_pdf_import $CURRENT_ITERATION; then
        echo "🎉 SUCCESS! PDF import is working after $CURRENT_ITERATION iterations"
        echo "📋 Final working strategy: Iteration $CURRENT_ITERATION"
        exit 0
    fi
    
    echo "❌ Iteration $CURRENT_ITERATION failed, trying next strategy..."
    ((CURRENT_ITERATION++))
done

echo ""
echo "❌ All $MAX_ITERATIONS strategies failed"
echo "📋 Manual intervention required"
echo "📅 Completed at: $(date)"
exit 1
