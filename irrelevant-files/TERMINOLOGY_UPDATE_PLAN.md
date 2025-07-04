# COMPREHENSIVE LOAN AND SHARE TERMINOLOGY UPDATE PLAN

## Changes Required:

### 1. Database Schema Changes (Prisma)
- Rename `initialLoanAmount` → `currentLoanAmount` 
- Rename `initialShareAmount` → `currentShareAmount`
- Update descriptions and comments

### 2. Backend API Changes
- Update Group API (`/app/api/groups/[id]/route.ts`)
- Update Member Import API (`/app/api/members/import/route.ts`)
- Update Add Member API (`/app/groups/[id]/add-member/page.tsx`)
- Update any other APIs that reference these fields

### 3. Frontend Component Changes
- Update all display labels from "Initial" to "Current"
- Update group detail page (`/app/groups/[id]/page.tsx`)
- Update group edit page (`/app/groups/[id]/edit/page.tsx`)
- Update add member page (`/app/groups/[id]/add-member/page.tsx`)
- Update multi-step group form (`/app/components/MultiStepGroupForm.tsx`)

### 4. Calculation Logic Changes
- Update `currentShareAmount` calculation to use: `totalGroupStanding / numberOfMembers`
- Ensure `currentLoanAmount` includes both existing loans and new loan records
- Update periodic record calculations to use new terminology

### 5. Documentation Updates
- Update all documentation files
- Update test scripts
- Update error messages and validation text

## Implementation Order:
1. Database schema changes first
2. Backend API changes
3. Frontend component changes
4. Calculation logic updates
5. Documentation updates

Let's start implementing...
