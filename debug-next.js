#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Debugging Next.js Setup...\n');

// Check Node.js version
console.log('📦 Node.js version:', process.version);

// Check if package.json exists
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  console.log('✅ package.json found');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log('📋 Project name:', pkg.name);
  console.log('📋 Version:', pkg.version);
} else {
  console.log('❌ package.json not found');
}

// Check if node_modules exists
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('✅ node_modules directory found');
} else {
  console.log('❌ node_modules directory not found - run npm install');
}

// Check if next.config.ts exists
const nextConfigPath = path.join(__dirname, 'next.config.ts');
if (fs.existsSync(nextConfigPath)) {
  console.log('✅ next.config.ts found');
} else {
  console.log('❌ next.config.ts not found');
}

// Check if .next directory exists
const nextBuildPath = path.join(__dirname, '.next');
if (fs.existsSync(nextBuildPath)) {
  console.log('⚠️ .next build directory exists (may need to be cleared)');
} else {
  console.log('✅ No .next build directory (clean state)');
}

// Check for TypeScript config
const tsConfigPath = path.join(__dirname, 'tsconfig.json');
if (fs.existsSync(tsConfigPath)) {
  console.log('✅ tsconfig.json found');
} else {
  console.log('❌ tsconfig.json not found');
}

// Check for critical dependencies
const criticalDeps = ['next', 'react', 'react-dom', 'typescript'];
try {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  
  console.log('\n📚 Critical Dependencies:');
  criticalDeps.forEach(dep => {
    if (deps[dep]) {
      console.log(`✅ ${dep}: ${deps[dep]}`);
    } else {
      console.log(`❌ ${dep}: not found`);
    }
  });
} catch (err) {
  console.log('❌ Could not check dependencies');
}

console.log('\n🔧 Recommended fixes:');
console.log('1. Clear build cache: rm -rf .next');
console.log('2. Reinstall dependencies: npm install');
console.log('3. Run development server: npm run dev');
