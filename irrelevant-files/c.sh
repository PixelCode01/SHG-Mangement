#!/bin/bash

# SHG Management System - Complete Cache Clear Script
# This script clears all caches to ensure changes take effect

echo "🧹 SHG Management System - Cache Clear Script"
echo "=============================================="

# 1. Stop any running development servers
echo "1. Stopping development servers..."
pkill -f "next" 2>/dev/null || true
pkill -f "node.*dev" 2>/dev/null || true

# 2. Clear Next.js build cache
echo "2. Clearing Next.js build cache..."
rm -rf .next
rm -rf out

# 3. Clear Node modules cache
echo "3. Clearing Node.js cache..."
rm -rf node_modules/.cache
npm cache clean --force 2>/dev/null || true

# 4. Clear Prisma generated files
echo "4. Regenerating Prisma client..."
npx prisma generate

# 5. Clear TypeScript build info
echo "5. Clearing TypeScript cache..."
rm -f tsconfig.tsbuildinfo

# 6. Fresh build
echo "6. Creating fresh build..."
npm run build

# 7. Start development server
echo "7. Starting fresh development server..."
echo "   Server will start at: http://localhost:3000"
npm run dev &

echo ""
echo "✅ All caches cleared successfully!"
echo "🚀 Development server starting..."
echo ""
echo "Additional manual cache clearing (if needed):"
echo "• Browser: Ctrl+Shift+R (hard refresh)"
echo "• Browser DevTools: Right-click refresh → 'Empty Cache and Hard Reload'"
echo "• VS Code: Restart VS Code window"
echo ""
echo "If changes still don't appear:"
echo "• Check file timestamps: ls -la <filename>"
echo "• Verify file content: cat <filename>"
echo "• Check for file permission issues"
echo "• Restart VS Code entirely"
