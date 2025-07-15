'use client';

// 🚨 LOAN AMOUNT FIX DEPLOYED - CACHE BUST 2025-06-17T19:30:00.000Z
// � Field mapping fix: currentLoanAmount extraction corrected
// 🚨 PDF extraction garbage data issue FIXED
// 🚨 NO MORE raw PDF byte extraction that creates 1000+ fake entries
import { useState, useEffect, ChangeEvent, useMemo, useCallback, useRef } from 'react';
import { useForm, Controller, useFieldArray, SubmitHandler, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod'; // Import Zod
import { useRouter } from 'next/navigation'; // Import useRouter
import { useSession } from 'next-auth/react'; // Import useSession
import DatePicker from 'react-datepicker'; // Import DatePicker
import 'react-datepicker/dist/react-datepicker.css'; // Import DatePicker CSS
import { roundToTwoDecimals } from '@/app/lib/currency-utils';

// Import CollectionFrequency from Prisma client
import { CollectionFrequency } from '@prisma/client';

// Define enums for form validation
const dayOfWeekEnum = z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]);
const lateFineRuleTypeEnum = z.enum(["DAILY_FIXED", "DAILY_PERCENTAGE", "TIER_BASED"]);

// Schema for individual member data within the form
const memberDataSchema = z.object({
  memberId: z.string(),
  name: z.string(), // Include name for display purposes
  currentShare: z.number().nonnegative().optional(),
  currentLoanAmount: z.number().nonnegative().optional(),
  familyMembersCount: z.number().int().positive('Family size must be at least 1').optional(),
});

// Define CollectionFrequency enum for Zod validation
const collectionFrequencyEnum = z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY", "YEARLY"]);

// Late fine tier schema
const lateFineRuleTierSchema = z.object({
  startDay: z.number().int().min(1),
  endDay: z.number().int().min(1),
  amount: z.number().nonnegative(),
  isPercentage: z.boolean(),
});

// Late fine rule schema
const lateFineRuleSchema = z.object({
  isEnabled: z.boolean(),
  ruleType: lateFineRuleTypeEnum.optional(),
  dailyAmount: z.number().nonnegative().optional(),
  dailyPercentage: z.number().nonnegative().max(100).optional(),
  tierRules: z.array(lateFineRuleTierSchema).optional(),
  // Tier-based individual fields for easier form handling
  tier1StartDay: z.number().int().min(1).optional(),
  tier1EndDay: z.number().int().min(1).optional(),
  tier1Amount: z.number().nonnegative().optional(),
  tier2StartDay: z.number().int().min(1).optional(),
  tier2EndDay: z.number().int().min(1).optional(),
  tier2Amount: z.number().nonnegative().optional(),
  tier3StartDay: z.number().int().min(1).optional(),
  tier3Amount: z.number().nonnegative().optional(),
}).optional();

// Define the main schema for group creation
const groupSchema = z.object({
  // Step 1: Basic Information
  name: z.string().min(1, 'Group name is required'),
  address: z.string().min(1, 'Address is required'),
  registrationNumber: z.string().min(1, 'Registration number is required'),
  organization: z.string().optional(), 
  collectionFrequency: collectionFrequencyEnum,
  
  // Collection schedule fields
  collectionDayOfMonth: z.number().int().min(1).max(31).optional(),
  collectionDayOfWeek: dayOfWeekEnum.optional(),
  collectionWeekOfMonth: z.number().int().min(1).max(4).optional(),
  collectionMonth: z.number().int().min(1).max(12).optional(), // For yearly collections
  collectionDate: z.number().int().min(1).max(31).optional(),  // For yearly collections
  
  // Late fine configuration
  lateFineRule: lateFineRuleSchema.optional(),
  
  bankAccountNumber: z.string()
    .refine((val) => val === '' || /^\d+$/.test(val), 'Bank account number must contain only numeric digits or be empty')
    .optional(),
  bankName: z.string().optional(),

  // Step 2: Member Import (Optional)
  // Step 3: Member Information
  leaderId: z.string().min(1, 'Leader selection is required'),
  memberCount: z.number().int().positive('Member count must be positive')
    .min(1, 'Member count must be at least 1')
    .max(1000, 'Member count cannot exceed 1000'),
  dateOfStarting: z.date({
    errorMap: (issue: z.ZodIssueOptionalMessage, ctx: z.ErrorMapCtx) => { // Add types for issue and ctx
      if (issue.code === z.ZodIssueCode.invalid_type && issue.expected === 'date') {
        return { message: 'Valid date is required' };
      }
      return { message: ctx.defaultError };
    }
  }).refine((date: Date) => { // Add type for date
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return selectedDate <= today;
  }, { message: "Date cannot be in the future." }),
  description: z.string().optional(),
  members: z.array(memberDataSchema).min(1, 'At least the leader must be selected'),
  
  // Step 4: Current Month Financial Data
  cashInHand: z.number().nonnegative().optional(),
  balanceInBank: z.number().nonnegative().optional(),
  interestRate: z.number().nonnegative().max(100, 'Interest rate cannot exceed 100%').optional(),
  monthlyContribution: z.number().nonnegative().optional(),
  globalShareAmount: z.number().nonnegative().optional(),
  
  // Loan Insurance Settings
  loanInsuranceEnabled: z.boolean().optional(),
  loanInsurancePercent: z.number().nonnegative().max(100, 'Loan insurance rate cannot exceed 100%').optional(),
  
  // Group Social Settings
  groupSocialEnabled: z.boolean().optional(),
  groupSocialAmountPerFamilyMember: z.number().nonnegative().optional(),
  groupSocialPreviousBalance: z.number().nonnegative().optional(),
  loanInsurancePreviousBalance: z.number().nonnegative().optional(),
  
  // Period Tracking Settings
  includeDataTillCurrentPeriod: z.boolean().optional(),
  currentPeriodMonth: z.number().int().min(1).max(12).optional(),
  currentPeriodYear: z.number().int().optional(),
}).superRefine((data, ctx) => {
  // Conditional validation based on collection frequency
  if (data.collectionFrequency === 'MONTHLY') {
    if (!data.collectionDayOfMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Collection day of month is required for monthly frequency',
        path: ['collectionDayOfMonth'],
      });
    }
  }
  
  if (data.collectionFrequency === 'WEEKLY') {
    if (!data.collectionDayOfWeek) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Collection day of week is required for weekly frequency',
        path: ['collectionDayOfWeek'],
      });
    }
  }
  
  if (data.collectionFrequency === 'FORTNIGHTLY') {
    if (!data.collectionDayOfWeek) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Collection day of week is required for fortnightly frequency',
        path: ['collectionDayOfWeek'],
      });
    }
    if (!data.collectionWeekOfMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Collection week pattern is required for fortnightly frequency',
        path: ['collectionWeekOfMonth'],
      });
    }
  }
  
  if (data.collectionFrequency === 'YEARLY') {
    if (!data.collectionMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Collection month is required for yearly frequency',
        path: ['collectionMonth'],
      });
    }
    if (!data.collectionDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Collection date is required for yearly frequency',
        path: ['collectionDate'],
      });
    }
  }
  
  // Late fine rule validation
  if (data.lateFineRule?.isEnabled === true) {
    if (!data.lateFineRule.ruleType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Late fine rule type is required when late fine is enabled',
        path: ['lateFineRule', 'ruleType'],
      });
    }
    
    if (data.lateFineRule.ruleType === 'DAILY_FIXED' && (!data.lateFineRule.dailyAmount || data.lateFineRule.dailyAmount <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Daily amount is required for fixed amount rule type',
        path: ['lateFineRule', 'dailyAmount'],
      });
    }
    
    if (data.lateFineRule.ruleType === 'DAILY_PERCENTAGE' && (!data.lateFineRule.dailyPercentage || data.lateFineRule.dailyPercentage <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Daily percentage is required for percentage rule type',
        path: ['lateFineRule', 'dailyPercentage'],
      });
    }
  }
});

type GroupFormValues = z.infer<typeof groupSchema>;

// Define a type for the data structure actually passed to onSubmit
type GroupSubmissionData = Omit<GroupFormValues, 'dateOfStarting' | 'members' | 'groupSocialPreviousBalance' | 'loanInsurancePreviousBalance'> & {
  dateOfStarting: string; 
  collectionFrequency: CollectionFrequency;
  // New field mappings for API compatibility
  loanInsuranceBalance?: number;
  groupSocialBalance?: number;
  members: {
    memberId: string;
    currentShare?: number;
    currentLoanAmount?: number;
    familyMembersCount?: number;
  }[];
};

// Define the type for existing group data when editing
interface ExistingGroupData extends Omit<GroupFormValues, 'members' | 'dateOfStarting'> {
  id: string;
  dateOfStarting: string; 
  collectionFrequency: CollectionFrequency; 
  members: { 
    memberId: string;
    currentShare?: number;
    currentLoanAmount?: number;
  }[];
}

interface MultiStepGroupFormProps {
  members: { id: string; name: string }[]; 
  onSubmit: (data: GroupSubmissionData, groupId?: string) => Promise<{ groupId: string } | void>; // Modified onSubmit return type
  groupToEdit?: ExistingGroupData; 
  onMemberCreated?: () => Promise<void>; 
}

export default function MultiStepGroupForm({ members: initialAvailableMembers = [], onSubmit, groupToEdit, onMemberCreated }: MultiStepGroupFormProps) {
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Helper function to process PDF text into member records - BALANCED EXTRACTION
  const processExtractedPDFLines = useCallback((lines: string[]): MemberImportRow[] => {
    console.log(`🔧 BALANCED PDF EXTRACTION: Processing ${lines.length} lines from PDF text`);
    
    // Debug the first few lines of text
    console.log("First 10 lines:", lines.slice(0, 10));
    
    // Create a single string for pattern matching
    const fullText = lines.join('\n');
    
    // Clean up the text to remove any problematic characters or patterns
    const cleanedText = fullText
      .replace(/\u0000/g, '') // Remove null characters
      .replace(/[\r\n]+/g, '\n') // Normalize line endings
      .replace(/\n\s*\n/g, '\n'); // Remove empty lines
    
    console.log("Cleaned text sample (first 500 chars):", cleanedText.substring(0, 500));
    
    const members: MemberImportRow[] = [];
    
    // METHOD 1: Look for SWAWLAMBAN format (NAMELOAN header) - BALANCED
    console.log('\n🔍 METHOD 1: BALANCED SWAWLAMBAN format detection...');
    const isSwawlambanPDF = /NAMELOAN/i.test(fullText);
    console.log(`SWAWLAMBAN format detected: ${isSwawlambanPDF}`);
    
    if (isSwawlambanPDF) {
      console.log("Processing SWAWLAMBAN format with BALANCED validation");
      
      const cleanLines = fullText.split('\n')
        .map(line => line.trim())
        .filter(line => line && line !== 'NAMELOAN' && line !== 'AI');
      
      console.log(`Processing ${cleanLines.length} lines for SWAWLAMBAN format`);
      
      let validCount = 0;
      for (const line of cleanLines) {
        // BALANCED pattern for name+amount: 
        // - Must look like a name (2+ words or single Indian name, mixed case allowed)
        // - Followed by reasonable loan amount (2-8 digits)
        const match = line.match(/^([A-Z][A-Za-z\s\.]{2,30}[A-Za-z])\s*(\d{2,8})$/);
        
        if (match?.[1] && match[2]) {
          const name = match[1].trim();
          const amount = match[2];
          
          // BALANCED validation - filter out obvious non-names
          const hasBlacklistedWord = name.match(/\b(ENTRY|DATA|FIELD|METADATA|VALUE|PATTERN|RANDOM|TEXT|OBJECT|REFERENCE|STREAM|TYPE|COUNT|SUBTYPE|CREATOR|ADOBE|ACROBAT|TABLE|CELL|HEADER|WIDGET|ELEMENT|INTERFACE|CONTROL|NAVIGATION|USER|FORM|PDF|PAGE|DOCUMENT|FONT|SIZE|TOTAL|GRAND|SUM|SUBTOTAL|AMOUNT|NUMBER)\b/i);
          
          // Name should look like a person's name
          const nameWords = name.split(/\s+/);
          const looksLikeName = nameWords.length >= 1 && nameWords.length <= 4 && 
            nameWords.every(word => /^[A-Z][A-Za-z]{1,}$/.test(word)) &&
            !hasBlacklistedWord;
          
          if (looksLikeName) {
            const parsedAmount = parseInt(amount);
            // Reasonable loan amount (₹100 to ₹50,00,000)
            if (parsedAmount >= 100 && parsedAmount <= 5000000) {
              console.log(`✅ BALANCED SWAWLAMBAN - Valid: "${name}" with amount "₹${parsedAmount.toLocaleString()}"`);
              members.push({ 
                id: (validCount + 1).toString(),
                memberId: `IMPORT_${validCount + 1}`,
                name: name, 
                currentShare: 0,
                currentLoanAmount: parsedAmount,
                isExisting: false,
                isValid: true
              });
              validCount++;
            } else {
              console.log(`⚠️ BALANCED SWAWLAMBAN - Invalid amount: "${name}" with amount "₹${parsedAmount.toLocaleString()}" (outside reasonable range)`);
            }
          } else {
            console.log(`⚠️ BALANCED SWAWLAMBAN - Doesn't look like name: "${name}"`);
          }
        }
      }
      
      console.log(`\n📊 BALANCED METHOD 1 RESULT: Found ${validCount} valid members with SWAWLAMBAN pattern`);
      
      if (members.length > 0) {
        console.log('\n✅ BALANCED METHOD 1 SUCCESS - Returning validated SWAWLAMBAN results');
        return members;
      }
    }

    // METHOD 2: BALANCED NAME/LOAN headers with flexible validation
    console.log('\n🔍 METHOD 2: BALANCED NAME/LOAN headers...');
    const nameHeaderPatterns = [/^NAME\s*$/i, /^MEMBER\s*NAME\s*$/i, /^MEMBERS\s*$/i, /^NAME\s+LOAN/i];
    const loanHeaderPatterns = [/^LOAN\s*$/i, /^AMOUNT\s*$/i, /^LOAN\s*AMOUNT\s*$/i];
    
    let start = -1;
    let split = -1;
    
    // Find name header
    for (let i = 0; i < lines.length; i++) {
      const lineElement = lines[i];
      if (!lineElement) continue;
      const line = lineElement.trim();
      if (nameHeaderPatterns.some(pattern => pattern.test(line))) {
        start = i;
        break;
      }
    }
    
    // Find loan header after name header
    if (start >= 0) {
      for (let i = start + 1; i < lines.length; i++) {
        const lineElement = lines[i];
        if (!lineElement) continue;
        const line = lineElement.trim();
        if (loanHeaderPatterns.some(pattern => pattern.test(line))) {
          split = i;
          break;
        }
      }
    }
    
    console.log(`NAME section found at line ${start}, LOAN section found at line ${split}`);
    
    if (start >= 0 && split > start) {
      console.log("✅ Found structured NAME/LOAN format - applying BALANCED validation");
      
      // Process names section with BALANCED validation
      const names = lines.slice(start + 1, split)
        .map((l) => l.trim())
        .filter((l) => {
          return !!l && 
                 !/^(NAME|LOAN|AMOUNT|MEMBER|MEMBERS|-+|_+)\s*$/i.test(l) && 
                 l.length > 2;
        })
        .filter(name => {
          // BALANCED name validation: flexible but excludes obvious non-names
          const hasBlacklistedWord = name.match(/\b(ENTRY|DATA|FIELD|METADATA|VALUE|PATTERN|RANDOM|TEXT|OBJECT|REFERENCE|STREAM|TYPE|COUNT|SUBTYPE|CREATOR|ADOBE|ACROBAT|TABLE|CELL|HEADER|WIDGET|ELEMENT|INTERFACE|CONTROL|NAVIGATION|USER|FORM|PDF|PAGE|DOCUMENT|FONT|SIZE)\b/i);
          const nameWords = name.split(/\s+/);
          return !hasBlacklistedWord && 
            nameWords.length >= 1 && nameWords.length <= 4 && 
            nameWords.every(word => /^[A-Z][A-Za-z]{1,}$/.test(word));
        });
      
      // Process loan amounts section with BALANCED validation
      const loans = lines.slice(split + 1)
        .map((l) => l.trim())
        .filter((l) => {
          return !!l && 
                 !/^(NAME|LOAN|AMOUNT|MEMBER|MEMBERS|-+|_+|TOTAL)\s*$/i.test(l) &&
                 /^\d{2,8}$/.test(l); // Must be purely numeric, 2-8 digits
        })
        .map(l => parseInt(l))
        .filter(amount => amount >= 100 && amount <= 5000000); // Reasonable range
      
      console.log(`BALANCED validation: Found ${names.length} valid names and ${loans.length} valid loan amounts`);
      
      // Match names with loan amounts
      const maxLength = Math.min(names.length, loans.length);
      let balancedCount = 0;
      for (let i = 0; i < maxLength; i++) {
        const name = names[i];
        const loanAmount = loans[i];
        
        // Ensure both name and loanAmount are valid
        if (name && loanAmount !== undefined && loanAmount !== null) {
          console.log(`✅ BALANCED NAME/LOAN - Valid: "${name}" with amount "₹${loanAmount.toLocaleString()}"`);
          members.push({ 
            id: (balancedCount + 1).toString(),
            memberId: `IMPORT_${balancedCount + 1}`,
            name: name,
            currentShare: 0,
            currentLoanAmount: loanAmount,
            isExisting: false,
            isValid: true
          });
          balancedCount++;
        }
      }
      
      console.log(`\n📊 BALANCED METHOD 2 RESULT: Found ${balancedCount} valid members with NAME/LOAN sections`);
      
      if (members.length > 0) {
        console.log('\n✅ BALANCED METHOD 2 SUCCESS - Returning validated NAME/LOAN results');
        return members;
      }
    }

    // METHOD 3: BALANCED member-like patterns
    console.log('\n🔍 METHOD 3: BALANCED member-like patterns...');
    
    // Look for name-amount patterns with balanced strictness
    const balancedMemberPattern = /^([A-Z][A-Za-z\s\.]{2,30}[A-Za-z])\s+(?:Rs\.?\s*|₹\s*)?(\d{2,8})$/gm;
    const matches = [...fullText.matchAll(balancedMemberPattern)];
    
    console.log(`Found ${matches.length} potential balanced member patterns`);
    
    let balancedPatternCount = 0;
    for (const match of matches) {
      if (!match?.[1] || !match[2]) continue;
      
      const name = match[1].trim();
      const amount = parseInt(match[2]);
      
      // BALANCED validation: exclude obvious non-names but allow various formats
      const hasBlacklistedWord = name.match(/\b(ENTRY|DATA|FIELD|METADATA|VALUE|PATTERN|RANDOM|TEXT|OBJECT|REFERENCE|STREAM|TYPE|COUNT|SUBTYPE|CREATOR|ADOBE|ACROBAT|TABLE|CELL|HEADER|WIDGET|ELEMENT|INTERFACE|CONTROL|NAVIGATION|USER|FORM|PDF|PAGE|DOCUMENT|FONT|SIZE|TOTAL|SUM)\b/i);
      
      if (!hasBlacklistedWord && amount >= 100 && amount <= 5000000) {
        const nameWords = name.split(/\s+/);
        // Must be 1-4 words (single name to full name)
        if (nameWords.length >= 1 && nameWords.length <= 4 && 
            nameWords.every(word => /^[A-Z][A-Za-z]{1,}$/.test(word))) {
          
          console.log(`✅ BALANCED pattern - Valid: "${name}" with amount "₹${amount.toLocaleString()}"`);
          members.push({ 
            id: (balancedPatternCount + 1).toString(),
            memberId: `IMPORT_${balancedPatternCount + 1}`,
            name: name,
            currentShare: 0,
            currentLoanAmount: amount,
            isExisting: false,
            isValid: true
          });
          balancedPatternCount++;
        } else {
          console.log(`⚠️ BALANCED pattern - Invalid name structure: "${name}"`);
        }
      } else {
        console.log(`⚠️ BALANCED pattern - Blacklisted or invalid amount: "${name}" (₹${amount.toLocaleString()})`);
      }
    }
    
    console.log(`\n📊 BALANCED METHOD 3 RESULT: Found ${balancedPatternCount} valid members with balanced patterns`);

    // METHOD 4: Fallback for single-line name+amount (common in Indian PDFs)
    console.log('\n🔍 METHOD 4: BALANCED single-line name+amount...');
    
    if (members.length === 0) {
      const singleLinePattern = /([A-Z][A-Za-z\s\.]{2,30})\s+(\d{2,8})/g;
      const singleMatches = [...fullText.matchAll(singleLinePattern)];
      
      console.log(`Found ${singleMatches.length} potential single-line patterns`);
      
      let singleLineCount = 0;
      for (const match of singleMatches) {
        if (!match?.[1] || !match[2]) continue;
        
        const name = match[1].trim();
        const amount = parseInt(match[2]);
        
        // Very permissive but still exclude obvious garbage
        const hasBlacklistedWord = name.match(/\b(ENTRY|DATA|FIELD|METADATA|VALUE|PATTERN|RANDOM|TEXT|OBJECT|REFERENCE|STREAM|TYPE|COUNT|SUBTYPE|CREATOR|ADOBE|ACROBAT|TABLE|CELL|HEADER|WIDGET|ELEMENT|INTERFACE|CONTROL|NAVIGATION|USER|FORM|PDF|PAGE|DOCUMENT|FONT|SIZE|TOTAL|SUM|VERSION|EXPORT|IMPORT)\b/i);
        
        if (!hasBlacklistedWord && amount >= 100 && amount <= 5000000) {
          console.log(`✅ BALANCED single-line - Valid: "${name}" with amount "₹${amount.toLocaleString()}"`);
          members.push({ 
            id: (singleLineCount + 1).toString(),
            memberId: `IMPORT_${singleLineCount + 1}`,
            name: name,
            currentShare: 0,
            currentLoanAmount: amount,
            isExisting: false,
            isValid: true
          });
          singleLineCount++;
        }
      }
      
      console.log(`\n📊 BALANCED METHOD 4 RESULT: Found ${singleLineCount} valid members with single-line patterns`);
    }

    console.log(`\n📊 FINAL BALANCED RESULT: ${members.length} valid members`);
    
    // Show final breakdown by method
    const breakdown: {[key: string]: number} = {};
    members.forEach(m => {
      const source = m.id ? 'BALANCED_EXTRACTION' : 'UNKNOWN';
      breakdown[source] = (breakdown[source] || 0) + 1;
    });
    console.log('\n📊 FINAL BREAKDOWN BY METHOD:');
    Object.entries(breakdown).forEach(([method, count]) => {
      console.log(`  ${method}: ${count} members`);
    });
    
    console.log(`\n🎯 BALANCED EXTRACTION COMPLETE: Extracted ${members.length} valid members, filtered out garbage data`);
    return members;
  }, []);

  // V29: Server-side PDF extraction with automatic PDF-to-Excel fallback
  const extractMembersFromPDFV11 = useCallback(async (file: File): Promise<MemberImportRow[]> => {
    console.log(`🚀 PDF EXTRACTION: ${file.name}, size: ${file.size} bytes`);
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('pdf', file);
      console.log('📦 V29: FormData created successfully');
      
      // Try the working pdf-parse endpoint (v18 - V27)
      console.log('📤 Uploading PDF to /api/pdf-upload-v18...');
      
      // Call server-side endpoint - UPDATED TO USE WORKING V27 EXTRACTION
      const response = await fetch('/api/pdf-upload-v18', {
        method: 'POST',
        body: formData,
        headers: {
          // Don't set Content-Type for FormData - browser will set it automatically with boundary
        }
      });
      
      console.log(`📊 Response status: ${response.status}`);
      
      if (!response.ok) {
        console.log(`❌ V29: Response not OK - status ${response.status}`);
        
        // Check if this is a 422 (server requesting fallback)
        if (response.status === 422) {
          console.log('🔄 V29: Server requested fallback to client-side processing (422)');
          const errorData = await response.json();
          console.log('📋 V29: 422 error data:', errorData);
          if (errorData.fallbackRequired || errorData.emergencyFix) {
            console.log('🚨 V29: Emergency fix active - using PDF-to-Excel fallback');
            throw new Error('FALLBACK_REQUIRED');
          }
        }
        
        const errorText = await response.text();
        console.error('❌ V29: Server extraction failed:', response.status, errorText.substring(0, 200));
        throw new Error(`Server extraction failed: ${response.status} ${errorText.substring(0, 100)}`);
      }
      
      console.log('📄 V29: Parsing response as JSON...');
      const result = await response.json();
      console.log('✅ V29: Server extraction response:', result);
      
      if (!result.success) {
        console.log('❌ V29: Server reports extraction unsuccessful');
        throw new Error(result.error || 'Server extraction failed');
      }
      
      console.log(`✅ Server successfully extracted ${result.members?.length || 0} members`);
      
      // Check if we got meaningful data
      if (!result.members || result.members.length === 0) {
        console.log('⚠️ No members found in PDF - triggering PDF-to-Excel fallback');
        throw new Error('NO_MEMBERS_FOUND');
      }
      
      // Convert server response to MemberImportRow format
      const members: MemberImportRow[] = result.members.map((member: any, index: number) => ({
        id: (index + 1).toString(),
        memberId: `IMPORT_${index + 1}`,
        name: member.name,
        currentShare: member.currentShare || 0,
        currentLoanAmount: member.currentLoanAmount || member.loanAmount || 0,
        isExisting: false,
        isValid: true
      }));
      
      console.log(`✅ Successfully extracted ${members.length} members from server`);
      
      return members;
      
    } catch (error) {
      console.error('❌ Primary PDF extraction failed:', error);
      console.log(`🔧 V29: Error message: ${error instanceof Error ? error.message : String(error)}`);
      
      // AUTOMATIC PDF-TO-EXCEL FALLBACK - NO UI EXPOSURE
      console.log('🔄 V29: Starting automatic PDF-to-Excel conversion fallback...');
      
      try {
        console.log('📊 V29: Converting PDF to Excel automatically...');
        
        // Create FormData for PDF-to-Excel conversion
        const conversionFormData = new FormData();
        conversionFormData.append('file', file);
        
        // Call PDF-to-Excel conversion endpoint
        const conversionResponse = await fetch('/api/pdf-to-excel', {
          method: 'POST',
          body: conversionFormData,
        });
        
        if (!conversionResponse.ok) {
          throw new Error(`PDF-to-Excel conversion failed: ${conversionResponse.status}`);
        }
        
        console.log('✅ V29: PDF-to-Excel conversion successful');
        
        // Get the Excel buffer from the response
        const excelBuffer = await conversionResponse.arrayBuffer();
        console.log(`📊 V29: Excel buffer received: ${excelBuffer.byteLength} bytes`);
        
        // Parse the Excel buffer directly without downloading
        console.log('📖 V29: Parsing Excel buffer with ExcelJS...');
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(excelBuffer);
        const worksheet = workbook.getWorksheet(1);
        
        if (!worksheet) {
          throw new Error('No worksheet found in converted Excel file');
        }
        
        const extractedMembers: MemberImportRow[] = [];
        const headers: string[] = [];
        
        // Get headers from first row
        worksheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber - 1] = cell.text;
        });
        
        console.log('📋 V29: Excel headers found:', headers);
        
        // Process data rows
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) { // Skip header row
            const rowData: any = {};
            row.eachCell((cell, colNumber) => {
              const header = headers[colNumber - 1];
              if (header) {
                rowData[header] = cell.text;
              }
            });
            
            // Extract member data from the row
            const name = (rowData.Name || rowData.name || rowData.NAME || '').trim();
            const loanAmount = parseFloat(rowData['Loan Amount'] || rowData['loan amount'] || rowData.LoanAmount || '0') || 0;
            
            if (name && name.length > 1) {
              extractedMembers.push({
                id: extractedMembers.length + 1 + '',
                memberId: `EXCEL_IMPORT_${extractedMembers.length + 1}`,
                name: name,
                currentShare: 0,
                currentLoanAmount: loanAmount,
                isExisting: false,
                isValid: true
              });
            }
          }
        });
        
        console.log(`🎉 V29: PDF-to-Excel fallback successful! Extracted ${extractedMembers.length} members`);
        console.log('👥 V29: Fallback extracted members:', extractedMembers.map(m => m.name).join(', '));
        
        if (extractedMembers.length === 0) {
          throw new Error('No valid members found in converted Excel file');
        }
        
        return extractedMembers;
        
      } catch (fallbackError) {
        console.error('❌ V29: PDF-to-Excel fallback also failed:', fallbackError);
        
        // Show comprehensive error message since all automated methods failed
        const errorMessage = `
❌ PDF Import Failed

We couldn't extract member names from this PDF file using any of our automated methods:
1. Direct PDF text extraction  
2. Automatic PDF-to-Excel conversion

Please try one of these alternatives:
1. 📝 Copy and paste member names manually
2. 📊 Convert PDF to Excel/CSV format manually first  
3. ➕ Add members individually using the form

The PDF may contain scanned images or use an unsupported format.
        `.trim();
        
        alert(errorMessage);
        return [];
      }
    }
  }, [processExtractedPDFLines]);

  const router = useRouter();
  const { data: session } = useSession(); 
  
  // All useState hooks must be declared before any useEffect hooks
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; groupId: string; dateOfStarting?: Date, groupName?: string, collectionFrequency?: CollectionFrequency, members?: GroupFormValues['members'] } | null>(null);
  const [recordCreationStatus, setRecordCreationStatus] = useState<string | null>(null);
  const [recordCreationError, setRecordCreationError] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  
  // New state for member import functionality
  const [showMemberImport, setShowMemberImport] = useState(false);
  const [memberImportStatus, setMemberImportStatus] = useState<string | null>(null);
  const [memberImportError, setMemberImportError] = useState<string | null>(null);
  const [importedMembers, setImportedMembers] = useState<Array<{
    name: string;
    loanAmount: number;
    email?: string;
    phone?: string;
  }>>([]);
  const [showImportedMembers, setShowImportedMembers] = useState(false);
  const [fileProcessingType, setFileProcessingType] = useState<'pdf' | 'excel' | 'csv' | null>(null);
  const [isFileProcessing, setIsFileProcessing] = useState(false);
  
  // COMPONENT LOAD DIAGNOSTIC - EMERGENCY STEP 2 FIX
  useEffect(() => {
    console.log('🚨 EMERGENCY STEP 2 FIX ACTIVE - Component loaded');
    console.log('🚨 Version: 0.1.3-FINAL-PDF-FIX-1750074881610'); 
    console.log('🚨 All PDF endpoints will return 422 to force client-side processing');
    console.log('🚨 If you see this message, the fix is deployed');
    console.log('🔍 CACHE BUST V7: MultiStepGroupForm loaded');
    console.log('🔍 CACHE BUST V7: Component version v7.0-ROBUST-PDF-' + Date.now());
    console.log('🔍 CACHE BUST V7: Robust PDF extraction code should be active');
    console.log('🔍 CACHE BUST V7: If you see OLD log messages, hard refresh browser (Ctrl+Shift+R)!');
    console.log('🔍 CACHE BUST V7: Expected NEW messages start with "🔄 CACHE BUST V7:"');
    console.log('🔍 CACHE BUST V7: Load time:', new Date().toISOString());
    console.log('🚫 CACHE BUST V7: NO MORE /api/pdf-extract-v4 CALLS!');
    console.log('💪 CACHE BUST V7: CSP-COMPLIANT PDF PROCESSING!');
  }, []);
  
  // State for creating a new member inline
  const [showCreateMemberForm, setShowCreateMemberForm] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberLoan, setNewMemberLoan] = useState(0);
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [createMemberError, setCreateMemberError] = useState<string | null>(null);
  
  // State for bulk creating members from import
  const [isCreatingMembers, setIsCreatingMembers] = useState(false);

  // State to manage the list of members displayable in dropdowns within this form instance
  const [displayableMembers, setDisplayableMembers] = useState<{ id: string; name: string }[]>(initialAvailableMembers);
  
  // State for leader linking notification
  const [leaderLinkingStatus, setLeaderLinkingStatus] = useState<string | null>(null);
  const [showLeaderLinkingNotification, setShowLeaderLinkingNotification] = useState(false);

  const totalSteps = 4; // Increased to 4 steps

  const isEditing = !!groupToEdit; // Flag to determine if in edit mode

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors },
    setFocus,
    reset, // Added reset
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema) as any,
    mode: 'onSubmit', // Changed to onSubmit to reduce validation noise
    reValidateMode: 'onChange', // Re-validate on change after first submit
    defaultValues: { // Initial default values, will be overridden by reset in edit mode
      name: '',
      address: '',
      registrationNumber: '',
      organization: '',
      collectionFrequency: 'MONTHLY', // Added default
      collectionDayOfMonth: undefined,
      collectionDayOfWeek: undefined,
      collectionWeekOfMonth: undefined,
      lateFineRule: {
        isEnabled: false,
        ruleType: undefined,
        dailyAmount: undefined,
        dailyPercentage: undefined,
        tierRules: [],
      },
      bankAccountNumber: '',
      bankName: '',
      leaderId: '',
      memberCount: 1,
      dateOfStarting: new Date(),
      description: '',
      members: [],
      cashInHand: 0,
      balanceInBank: 0,
      interestRate: 0,
      monthlyContribution: 0,
      globalShareAmount: 0,
      
      // Loan Insurance defaults
      loanInsuranceEnabled: false,
      loanInsurancePercent: 0,
      
      // Group Social defaults
      groupSocialEnabled: false,
      groupSocialAmountPerFamilyMember: 0,
    },
  });

  // Use useFieldArray for managing the members array in the form state
  const { fields: memberFields, append, remove, update } = useFieldArray({
    control,
    name: "members",
    keyName: "fieldId" // Use a different key name than default 'id' to avoid conflicts
  });

  const selectedLeaderId = useWatch({ control, name: 'leaderId' });
  const collectionFrequency = useWatch({ control, name: 'collectionFrequency' });
  // const lateFineEnabled = useWatch({ control, name: 'lateFineRule.isEnabled' });
  // const lateFineRuleType = useWatch({ control, name: 'lateFineRule.ruleType' });
  
  // Watch loan insurance and group social fields for dynamic visibility - NOW USING CONTROLLER PATTERN
  // const loanInsuranceEnabled = useWatch({ control, name: 'loanInsuranceEnabled' });
  // const groupSocialEnabled = useWatch({ control, name: 'groupSocialEnabled' });
  
  // Watch group social enabled for family size field requirement indicator
  const groupSocialEnabled = useWatch({ control, name: 'groupSocialEnabled' });

  // Clear irrelevant fields when collection frequency changes
  useEffect(() => {
    if (collectionFrequency) {
      // Clear all conditional fields first
      setValue('collectionDayOfMonth', undefined, { shouldValidate: false });
      setValue('collectionDayOfWeek', undefined, { shouldValidate: false });
      setValue('collectionWeekOfMonth', undefined, { shouldValidate: false });
      setValue('collectionMonth', undefined, { shouldValidate: false });
      setValue('collectionDate', undefined, { shouldValidate: false });
    }
  }, [collectionFrequency, setValue]);

  // Function to generate dynamic share label based on collection frequency
  const getShareLabel = useCallback(() => {
    switch (collectionFrequency) {
      case 'WEEKLY':
        return 'Current Share of each member till his week';
      case 'FORTNIGHTLY':
        return 'Current Share of each member till his fortnight';
      case 'YEARLY':
        return 'Current Share of each member till his year';
      case 'MONTHLY':
      default:
        return 'Current Share of each member till his month';
    }
  }, [collectionFrequency]);

  // Effect to update the memberCount form value based on the actual number of selected members
  useEffect(() => {
    const currentMemberCount = getValues('memberCount');
    if (currentMemberCount !== memberFields.length) {
      setValue('memberCount', memberFields.length, { shouldValidate: false, shouldDirty: false });
    }
  }, [memberFields.length, setValue, getValues]);

  // Effect for auto-selecting leader if current user is GROUP_LEADER and creating a new group
  useEffect(() => {
    if (!isEditing && session?.user?.role === 'GROUP_LEADER' && session?.user?.memberId) {
      const groupLeaderAsMember = displayableMembers.find(m => m.id === session.user.memberId);
      if (groupLeaderAsMember) {
        const currentLeaderId = getValues('leaderId');
        // Check if leaderId is already set to avoid infinite loops
        if (currentLeaderId !== session.user.memberId) {
          setValue('leaderId', session.user.memberId, { shouldValidate: false, shouldDirty: false });
        }
      }
    }
  }, [session?.user?.role, session?.user?.memberId, isEditing, setValue, displayableMembers, getValues]);

  // Effect to populate form data when in edit mode
  useEffect(() => {
    if (isEditing && groupToEdit) {
      const membersForForm = groupToEdit.members.map(apiMember => {
        const availableMember = displayableMembers.find(m => m.id === apiMember.memberId);
        return {
          memberId: apiMember.memberId,
          name: availableMember ? availableMember.name : 'Unknown Member',
          currentLoanAmount: apiMember.currentLoanAmount ?? 0,
        };
      });
      reset({
        ...groupToEdit,
        dateOfStarting: new Date(groupToEdit.dateOfStarting), // Convert string date to Date object
        members: membersForForm,
      });
    }
  }, [isEditing, groupToEdit, reset, displayableMembers]);

  // Effect to automatically add/remove the leader to/from the members array
  useEffect(() => {
    if (selectedLeaderId) {
      const leaderMember = displayableMembers.find(m => m.id === selectedLeaderId);
      if (!leaderMember) return;

      const leaderIndex = memberFields.findIndex(field => field.memberId === selectedLeaderId);

      if (leaderIndex === -1) {
        // Add leader if not present
        append({ 
          memberId: leaderMember.id, 
          name: leaderMember.name, 
          currentShare: 0,
          currentLoanAmount: 0
        });
      } else {
        // Ensure leader's name is up-to-date if already present (shouldn't happen often)
        const existingMember = memberFields[leaderIndex];
        if (existingMember && existingMember.name !== leaderMember.name) {
          update(leaderIndex, { ...existingMember, name: leaderMember.name });
        }
      }
    } else {
      // If leader is deselected, remove them from the members array
      const leaderIndex = memberFields.findIndex(field => displayableMembers.find(m => m.id === field.memberId)?.id === selectedLeaderId);
      if (leaderIndex !== -1) {
        // This logic might need refinement if the previous leader ID isn't readily available.
        // For simplicity, let's assume deselection means clearing the leaderId field.
        // A better approach might involve storing the previous leaderId.
      }
    }
  }, [selectedLeaderId, displayableMembers, memberFields, append, remove, update]);
  
  // Effect to handle leader selection notification and linking
  useEffect(() => {
    if (selectedLeaderId && !isEditing && session?.user?.id) {
      const selectedLeader = displayableMembers.find(m => m.id === selectedLeaderId);
      if (selectedLeader && selectedLeaderId !== session?.user?.memberId) {
        setLeaderLinkingStatus(`Selected leader "${selectedLeader.name}" will be linked to your account when the group is created.`);
        setShowLeaderLinkingNotification(true);
        
        // Auto-hide notification after 8 seconds
        const timer = setTimeout(() => {
          setShowLeaderLinkingNotification(false);
        }, 8000);
        
        return () => clearTimeout(timer);
      } else if (selectedLeader && selectedLeaderId === session?.user?.memberId) {
        setLeaderLinkingStatus(`You are already linked to the selected leader "${selectedLeader.name}".`);
        setShowLeaderLinkingNotification(true);
        
        // Auto-hide notification after 5 seconds
        const timer = setTimeout(() => {
          setShowLeaderLinkingNotification(false);
        }, 5000);
        
        return () => clearTimeout(timer);
      } else {
        setShowLeaderLinkingNotification(false);
      }
    } else {
      setShowLeaderLinkingNotification(false);
    }
    
    // Explicit return for consistency
    return undefined;
  }, [selectedLeaderId, isEditing, session?.user?.id, session?.user?.memberId, displayableMembers]);

  // Function to toggle a member in the members array
  const toggleMember = (memberId: string, memberName: string) => {
    const memberIndex = memberFields.findIndex(field => field.memberId === memberId);

    if (memberIndex === -1) {        // Add member with default current month data
        append({
          memberId,
          name: memberName,
          currentShare: 0,
          currentLoanAmount: 0,  
        });
    } else {
      // Remove member (unless it's the leader)
      if (memberId !== selectedLeaderId) {
        remove(memberIndex);
      }
    }
  };

  // Function to select all or deselect all members
  const toggleSelectAll = () => {
    const nonLeaderMembers = displayableMembers.filter(member => member.id !== selectedLeaderId);
    const selectedNonLeaderMembers = memberFields.filter(field => field.memberId !== selectedLeaderId);
    
    if (selectedNonLeaderMembers.length === nonLeaderMembers.length) {
      // All non-leader members are selected, so deselect all (except leader)
      const leaderMemberIndex = memberFields.findIndex(field => field.memberId === selectedLeaderId);
      // Clear all members except keep the leader if they exist
      if (leaderMemberIndex !== -1) {
        const leaderMember = memberFields[leaderMemberIndex];
        // Remove all members
        for (let i = memberFields.length - 1; i >= 0; i--) {
          remove(i);
        }
        // Re-add only the leader if it exists
        if (leaderMember) {
          append(leaderMember);
        }
      } else {
        // Remove all members
        for (let i = memberFields.length - 1; i >= 0; i--) {
          remove(i);
        }
      }
    } else {
      // Not all members are selected, so select all
      nonLeaderMembers.forEach(member => {
        const isAlreadySelected = memberFields.some(field => field.memberId === member.id);
        if (!isAlreadySelected) {
          append({
            memberId: member.id,
            name: member.name,
            currentShare: 0,
            currentLoanAmount: 0,
          });
        }
      });
    }
  };

  // Helper function to check if all non-leader members are selected
  const areAllMembersSelected = () => {
    const nonLeaderMembers = displayableMembers.filter(member => member.id !== selectedLeaderId);
    const selectedNonLeaderMembers = memberFields.filter(field => field.memberId !== selectedLeaderId);
    return nonLeaderMembers.length > 0 && selectedNonLeaderMembers.length === nonLeaderMembers.length;
  };

  const goToNextStep = async () => {
    const fieldsToValidate = currentStep === 1
      ? ['name', 'address', 'registrationNumber', 'organization', 'collectionFrequency', 'lateFineRule']
      : currentStep === 2
        ? [] // Step 2 is optional member import, no validation needed
        : currentStep === 3
          ? ['leaderId', 'memberCount', 'dateOfStarting', 'members'] // Validate members array too
          : currentStep === 4
            ? ['cashInHand', 'balanceInBank', 'globalShareAmount', 'members'] // Include globalShareAmount validation
            : [];

    // Use `keyof GroupFormValues` for type safety
    const isStepValid = fieldsToValidate.length === 0 || await trigger(fieldsToValidate as (keyof GroupFormValues)[]);

    if (isStepValid) {
      setCurrentStep(Math.min(currentStep + 1, totalSteps));
    } else {
      // If validation fails, focus on the first field with an error in the current step
      for (const field of fieldsToValidate as (keyof GroupFormValues)[]) {
        if (errors[field]) {
          setFocus(field);
          break;
        }
      }
    }
  };

  const goToPreviousStep = () => {
    setCurrentStep(Math.max(currentStep - 1, 1));
  };

  // Handle form submission
  const handleFormSubmit: SubmitHandler<GroupFormValues> = async (data) => {
    setIsLoading(true);
    setError(null);
    setRecordCreationStatus(null); 
    setRecordCreationError(null); 
    try {
      // Transform late fine rule data from individual tier fields to API format
      let transformedLateFineRule = data.lateFineRule;
      if (data.lateFineRule?.isEnabled && data.lateFineRule.ruleType === 'TIER_BASED') {
        // Build tierRules array from individual tier fields
        const tierRules = [];
        
        // Tier 1 (Days 1-5 by default)
        if (data.lateFineRule.tier1Amount && data.lateFineRule.tier1Amount > 0) {
          tierRules.push({
            startDay: data.lateFineRule.tier1StartDay || 1,
            endDay: data.lateFineRule.tier1EndDay || 5,
            amount: data.lateFineRule.tier1Amount,
            isPercentage: false
          });
        }
        
        // Tier 2 (Days 6-15 by default)
        if (data.lateFineRule.tier2Amount && data.lateFineRule.tier2Amount > 0) {
          tierRules.push({
            startDay: data.lateFineRule.tier2StartDay || 6,
            endDay: data.lateFineRule.tier2EndDay || 15,
            amount: data.lateFineRule.tier2Amount,
            isPercentage: false
          });
        }
        
        // Tier 3 (Days 16+ by default)
        if (data.lateFineRule.tier3Amount && data.lateFineRule.tier3Amount > 0) {
          tierRules.push({
            startDay: data.lateFineRule.tier3StartDay || 16,
            endDay: 9999, // Represents "onwards"
            amount: data.lateFineRule.tier3Amount,
            isPercentage: false
          });
        }
        
        // Create the properly formatted late fine rule
        transformedLateFineRule = {
          isEnabled: data.lateFineRule.isEnabled,
          ruleType: data.lateFineRule.ruleType,
          tierRules: tierRules
        };
        
        console.log('🔧 [TIER_BASED FIX] Transformed tier rules:', JSON.stringify(tierRules, null, 2));
      }

      const submissionData: GroupSubmissionData = {
        ...data,
        dateOfStarting: (data.dateOfStarting instanceof Date ? data.dateOfStarting.toISOString() : new Date(data.dateOfStarting).toISOString()),
        collectionFrequency: data.collectionFrequency || 'MONTHLY', 
        lateFineRule: transformedLateFineRule, // Use the transformed late fine rule
        // Send the new field names for balance tracking
        loanInsuranceBalance: data.loanInsurancePreviousBalance || 0,
        groupSocialBalance: data.groupSocialPreviousBalance || 0,
        members: data.members.map((m: z.infer<typeof memberDataSchema>) => ({ // Add type for m
          memberId: m.memberId,
          currentShare: data.globalShareAmount || 0, // Apply global share amount to all members
          currentLoanAmount: m.currentLoanAmount || 0, // Ensure currentLoanAmount is always a number
          familyMembersCount: m.familyMembersCount || 1, // Include family members count
        })),
      };
      
      // Debug logging
      console.log('Form submission data:', JSON.stringify(submissionData, null, 2));
      
      const result = await onSubmit(submissionData, groupToEdit?.id);
      const submittedDateOfStarting = data.dateOfStarting instanceof Date ? data.dateOfStarting : new Date(data.dateOfStarting);

      if (isEditing && groupToEdit) {
        setSuccess({ 
          message: 'Group updated successfully!', 
          groupId: groupToEdit.id, 
          dateOfStarting: submittedDateOfStarting, 
          groupName: data.name, 
          collectionFrequency: data.collectionFrequency || 'MONTHLY', 
          members: data.members 
        });
      } else if (result && 'groupId' in result) { // Check if result has groupId for new group
        // Link the selected leader to the current user's account if different
        if (data.leaderId && data.leaderId !== session?.user?.memberId && session?.user?.id) {
          try {
            const linkResponse = await fetch('/api/auth/link-member', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ memberId: data.leaderId }),
            });
            
            if (linkResponse.ok) {
              console.log(`Successfully linked leader ${data.leaderId} to user account`);
              setLeaderLinkingStatus('Leader successfully linked to your account!');
            } else {
              const linkError = await linkResponse.json();
              console.warn('Failed to link leader to user account:', linkError.message);
            }
          } catch (linkError) {
            console.warn('Error linking leader to user account:', linkError);
          }
        }
        
        setSuccess({ 
          message: 'Group created successfully!', 
          groupId: result.groupId, 
          dateOfStarting: submittedDateOfStarting, 
          groupName: data.name, 
          collectionFrequency: data.collectionFrequency || 'MONTHLY', 
          members: data.members 
        });
        
        // Start countdown timer
        setRedirectCountdown(3);
        const countdownInterval = setInterval(() => {
          setRedirectCountdown(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(countdownInterval);
              // Use setTimeout to ensure navigation happens outside of setState
              setTimeout(() => {
                if (isMountedRef.current) {
                  router.push('/groups?refresh=true');
                }
              }, 0);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (error: unknown) {
      console.error('Error submitting form:', error);
      setError((error as Error).message || 'An error occurred while saving the group. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for creating a new member
  const handleNewMemberSubmit = async (): Promise<boolean> => {
    if (!newMemberName.trim()) {
      setCreateMemberError("Member name is required.");
      return false;
    }
    
    // Check if the new member name matches the current user's linked member name
    const currentUserLinkedMember = displayableMembers.find(m => m.id === session?.user?.memberId);
    if (currentUserLinkedMember && newMemberName.trim().toLowerCase() === currentUserLinkedMember.name.trim().toLowerCase()) {
      setCreateMemberError("Cannot create a member with the same name as your linked account.");
      return false;
    }
    
    // Check if the new member name matches the current user's registered name
    if (session?.user?.name && newMemberName.trim().toLowerCase() === session.user.name.trim().toLowerCase()) {
      setCreateMemberError("Cannot create a member with the same name as your registered account.");
      return false;
    }
    
    // Also check if a member with this name already exists
    const existingMember = displayableMembers.find(m => m.name.trim().toLowerCase() === newMemberName.trim().toLowerCase());
    if (existingMember) {
      setCreateMemberError("A member with this name already exists.");
      return false;
    }
    
    // Basic email validation (optional, enhance as needed)
    if (newMemberEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newMemberEmail)) {
        setCreateMemberError("Please enter a valid email address.");
        return false;
    }

    setIsCreatingMember(true);
    setCreateMemberError(null);
    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newMemberName, 
          email: newMemberEmail || undefined,
          phone: newMemberPhone || undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create member');
      }
      const createdMember = await response.json(); // Expects { id: string, name: string, email?: string }

      // Trigger parent to refetch its master list of members.
      // This updates the initialAvailableMembers prop for future renders or other components.
      if (onMemberCreated) {
        await onMemberCreated(); 
      }

      // Add the newly created member to our local displayableMembers list if not already present
      // This ensures it appears in dropdowns within this form immediately.
      setDisplayableMembers(prev => {
        if (prev.find(m => m.id === createdMember.id)) {
          return prev;
        }
        return [...prev, { id: createdMember.id, name: createdMember.name }];
      });

      // Automatically select the newly created member by appending them to the form's memberFields
      const isAlreadySelectedInForm = memberFields.some(mf => mf.memberId === createdMember.id);
      if (!isAlreadySelectedInForm) {
        append({
          memberId: createdMember.id,
          name: createdMember.name, 
          currentShare: 0,
          currentLoanAmount: newMemberLoan || 0, // Use the loan amount from the form
        });
      }
      
      // Return success
      return true;

    } catch (error: unknown) {
      setCreateMemberError((error as Error).message);
      return false;
    } finally {
      setIsCreatingMember(false);
    }
  };


  const copyGroupId = async () => {
    if (success?.groupId) { // Null check for success remains relevant
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(success.groupId);
          alert('Group ID copied to clipboard!');
        } else {
          // Fallback method
          const textArea = document.createElement('textarea');
          textArea.value = success.groupId;
          textArea.style.position = 'fixed';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            const successful = document.execCommand('copy');
            if (successful) {
              alert('Group ID copied to clipboard!');
            } else {
              alert('Unable to copy to clipboard. Please copy it manually.');
            }
          } catch {
            alert('Unable to copy to clipboard. Please copy it manually.');
          }
          document.body.removeChild(textArea);
        }
      } catch (err) {
        console.error('Failed to copy: ', err);
        alert('Unable to copy to clipboard. Please copy it manually.');
      }
    }
  };

  // Add delete group and member options
  const deleteGroup = async (groupId: string) => {
    if (confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' });
        if (response.ok) {
          alert('Group deleted successfully.');
          router.push('/groups');
        } else {
          const errorData = await response.json();
          alert(`Failed to delete group: ${errorData.error}`);
        }
      } catch (error) {
        console.error('Error deleting group:', error);
        alert('An error occurred while deleting the group. Please try again.');
      }
    }
  };

  // Step 1: Basic Information - Memoized to prevent unnecessary re-renders
  const Step1 = useMemo(() => (
    <div className="card p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Step 1: Basic Information</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Group Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            key="group-name-input"
            {...register("name")}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Address <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="address"
            key="group-address-input"
            {...register("address")}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.address && <p className="mt-1 text-sm text-red-500">{errors.address.message}</p>}
        </div>
        <div>
          <label htmlFor="registrationNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Registration Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="registrationNumber"
            key="group-registration-input"
            {...register("registrationNumber")}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.registrationNumber && <p className="mt-1 text-sm text-red-500">{errors.registrationNumber.message}</p>}
        </div>
        <div>
          <label htmlFor="organization" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Organization (Optional)
          </label>
          <input // Changed from select to input as per schema update
            type="text"
            id="organization"
            key="group-organization-input"
            {...register("organization")}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., JSK, GOVT_JHARKHAND, NGO, OTHER"
          />
          {errors.organization && <p className="mt-1 text-sm text-red-500">{errors.organization.message}</p>}
        </div>
        <div>
          <label htmlFor="collectionFrequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Collection Frequency <span className="text-red-500">*</span>
          </label>
          <select
            id="collectionFrequency"
            key="group-frequency-select"
            {...register("collectionFrequency")}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="WEEKLY">Weekly</option>
            <option value="FORTNIGHTLY">Fortnightly</option>
            <option value="YEARLY">Yearly</option>
          </select>
          {errors.collectionFrequency && <p className="mt-1 text-sm text-red-500">{errors.collectionFrequency.message}</p>}
        </div>
        
        {/* Collection Schedule Fields - Conditional based on frequency */}
        {collectionFrequency === 'MONTHLY' && (
          <div>
            <label htmlFor="collectionDayOfMonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Collection Day of Month <span className="text-red-500">*</span>
            </label>
            <select
              id="collectionDayOfMonth"
              {...register("collectionDayOfMonth", { valueAsNumber: true })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select day of month</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Choose which day of the month to collect contributions (e.g., 8th of every month)</p>
            {errors.collectionDayOfMonth && <p className="mt-1 text-sm text-red-500">{errors.collectionDayOfMonth.message}</p>}
          </div>
        )}
        
        {collectionFrequency === 'WEEKLY' && (
          <div>
            <label htmlFor="collectionDayOfWeek" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Collection Day of Week <span className="text-red-500">*</span>
            </label>
            <select
              id="collectionDayOfWeek"
              {...register("collectionDayOfWeek")}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select day of week</option>
              <option value="MONDAY">Monday</option>
              <option value="TUESDAY">Tuesday</option>
              <option value="WEDNESDAY">Wednesday</option>
              <option value="THURSDAY">Thursday</option>
              <option value="FRIDAY">Friday</option>
              <option value="SATURDAY">Saturday</option>
              <option value="SUNDAY">Sunday</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">Choose which day of the week to collect contributions</p>
            {errors.collectionDayOfWeek && <p className="mt-1 text-sm text-red-500">{errors.collectionDayOfWeek.message}</p>}
          </div>
        )}
        
        {collectionFrequency === 'FORTNIGHTLY' && (
          <div>
            <label htmlFor="collectionDayOfWeek" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Collection Day of Week <span className="text-red-500">*</span>
            </label>
            <select
              id="collectionDayOfWeek"
              {...register("collectionDayOfWeek")}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select day of week</option>
              <option value="MONDAY">Monday</option>
              <option value="TUESDAY">Tuesday</option>
              <option value="WEDNESDAY">Wednesday</option>
              <option value="THURSDAY">Thursday</option>
              <option value="FRIDAY">Friday</option>
              <option value="SATURDAY">Saturday</option>
              <option value="SUNDAY">Sunday</option>
            </select>
            <div className="mt-2">
              <label htmlFor="collectionWeekOfMonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Which weeks of the month? <span className="text-red-500">*</span>
              </label>
              <select
                id="collectionWeekOfMonth"
                {...register("collectionWeekOfMonth", { valueAsNumber: true })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select week pattern</option>
                <option value={1}>1st and 3rd weeks</option>
                <option value={2}>2nd and 4th weeks</option>
              </select>
            </div>
            <p className="mt-1 text-xs text-gray-500">Choose day of week and which weeks to collect contributions fortnightly</p>
            {(errors.collectionDayOfWeek || errors.collectionWeekOfMonth) && (
              <p className="mt-1 text-sm text-red-500">
                {errors.collectionDayOfWeek?.message || errors.collectionWeekOfMonth?.message}
              </p>
            )}
          </div>
        )}
        
        {collectionFrequency === 'YEARLY' && (
          <div>
            <label htmlFor="collectionMonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Collection Month <span className="text-red-500">*</span>
            </label>
            <select
              id="collectionMonth"
              {...register("collectionMonth", { valueAsNumber: true })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select month</option>
              <option value={1}>January</option>
              <option value={2}>February</option>
              <option value={3}>March</option>
              <option value={4}>April</option>
              <option value={5}>May</option>
              <option value={6}>June</option>
              <option value={7}>July</option>
              <option value={8}>August</option>
              <option value={9}>September</option>
              <option value={10}>October</option>
              <option value={11}>November</option>
              <option value={12}>December</option>
            </select>
            
            <div className="mt-2">
              <label htmlFor="collectionDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Collection Date <span className="text-red-500">*</span>
              </label>
              <select
                id="collectionDate"
                {...register("collectionDate", { valueAsNumber: true })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select date</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(date => (
                  <option key={date} value={date}>{date}</option>
                ))}
              </select>
            </div>
            
            <p className="mt-1 text-xs text-gray-500">Choose the month and date for yearly contribution collection (e.g., January 15th of every year)</p>
            {(errors.collectionMonth || errors.collectionDate) && (
              <p className="mt-1 text-sm text-red-500">
                {errors.collectionMonth?.message || errors.collectionDate?.message}
              </p>
            )}
          </div>
        )}
        
        {/* Late Fine Configuration */}
        <div className="border-t pt-4">
          <Controller
            name="lateFineRule.isEnabled"
            control={control}
            render={({ field }) => (
              <>
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    id="lateFineEnabled"
                    checked={field.value || false}
                    onChange={(e) => {
                      field.onChange(e.target.checked);
                    }}
                    className="mr-2"
                  />
                  <label htmlFor="lateFineEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enable Late Fine System
                  </label>
                </div>
                
                {/* Use field.value directly instead of useWatch */}
                {field.value === true && (
                  <div className="space-y-4 pl-6 border-l-4 border-gray-400 dark:border-gray-500 bg-gray-50 dark:bg-gray-800/50 p-4 rounded shadow-sm">
                    <div className="text-gray-800 dark:text-gray-200 font-medium mb-2">
                      ✅ Late Fine Configuration
                    </div>
                    <Controller
                      name="lateFineRule.ruleType"
                      control={control}
                      render={({ field: ruleTypeField }) => (
                        <>
                          <div>
                            <label htmlFor="lateFineRuleType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Late Fine Rule Type <span className="text-red-500">*</span>
                            </label>
                            <select
                              id="lateFineRuleType"
                              value={ruleTypeField.value || ''}
                              onChange={(e) => ruleTypeField.onChange(e.target.value)}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Select rule type</option>
                              <option value="DAILY_FIXED">Fixed amount per day</option>
                              <option value="DAILY_PERCENTAGE">Percentage of contribution per day</option>
                              <option value="TIER_BASED">Tier-based rules</option>
                            </select>
                            {errors.lateFineRule?.ruleType && <p className="mt-1 text-sm text-red-500">{errors.lateFineRule.ruleType.message}</p>}
                          </div>
                          
                          {ruleTypeField.value === 'DAILY_FIXED' && (
                            <div>
                              <label htmlFor="dailyAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Daily Fine Amount (₹) <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                id="dailyAmount"
                                {...register("lateFineRule.dailyAmount", { valueAsNumber: true })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., 10"
                                min="0"
                                step="0.01"
                              />
                              <p className="mt-1 text-xs text-gray-500">Amount charged per day for late submission</p>
                              {errors.lateFineRule?.dailyAmount && <p className="mt-1 text-sm text-red-500">{errors.lateFineRule.dailyAmount.message}</p>}
                            </div>
                          )}
                          
                          {ruleTypeField.value === 'DAILY_PERCENTAGE' && (
                            <div>
                              <label htmlFor="dailyPercentage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Daily Fine Percentage (%) <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                id="dailyPercentage"
                                {...register("lateFineRule.dailyPercentage", { valueAsNumber: true })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., 1.5"
                                min="0"
                                max="100"
                                step="0.1"
                              />
                              <p className="mt-1 text-xs text-gray-500">Percentage of contribution amount charged per day for late submission</p>
                              {errors.lateFineRule?.dailyPercentage && <p className="mt-1 text-sm text-red-500">{errors.lateFineRule.dailyPercentage.message}</p>}
                            </div>
                          )}
                          
                          {ruleTypeField.value === 'TIER_BASED' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Tier-based Rules <span className="text-red-500">*</span>
                              </label>
                              <div className="space-y-3">
                                <p className="text-sm text-gray-600 dark:text-gray-400">Define fine amounts for different day ranges:</p>
                                
                                {/* Tier 1: Days 1-5 */}
                                <div className="grid grid-cols-4 gap-2 items-end">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Days</label>
                                    <input
                                      type="number"
                                      {...register("lateFineRule.tier1StartDay", { valueAsNumber: true })}
                                      defaultValue={1}
                                      min="1"
                                      className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    />
                                  </div>
                                  <div className="text-center text-sm text-gray-500 dark:text-gray-400">to</div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Days</label>
                                    <input
                                      type="number"
                                      {...register("lateFineRule.tier1EndDay", { valueAsNumber: true })}
                                      defaultValue={5}
                                      min="1"
                                      className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Amount (₹)</label>
                                    <input
                                      type="number"
                                      {...register("lateFineRule.tier1Amount", { valueAsNumber: true })}
                                      placeholder="10"
                                      min="0"
                                      step="0.01"
                                      className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    />
                                  </div>
                                </div>
                                
                                {/* Tier 2: Days 6-15 */}
                                <div className="grid grid-cols-4 gap-2 items-end">
                                  <div>
                                    <input
                                      type="number"
                                      {...register("lateFineRule.tier2StartDay", { valueAsNumber: true })}
                                      defaultValue={6}
                                      min="1"
                                      className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    />
                                  </div>
                                  <div className="text-center text-sm text-gray-500 dark:text-gray-400">to</div>
                                  <div>
                                    <input
                                      type="number"
                                      {...register("lateFineRule.tier2EndDay", { valueAsNumber: true })}
                                      defaultValue={15}
                                      min="1"
                                      className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    />
                                  </div>
                                  <div>
                                    <input
                                      type="number"
                                      {...register("lateFineRule.tier2Amount", { valueAsNumber: true })}
                                      placeholder="20"
                                      min="0"
                                      step="0.01"
                                      className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    />
                                  </div>
                                </div>
                                
                                {/* Tier 3: Days 16+ */}
                                <div className="grid grid-cols-4 gap-2 items-end">
                                  <div>
                                    <input
                                      type="number"
                                      {...register("lateFineRule.tier3StartDay", { valueAsNumber: true })}
                                      defaultValue={16}
                                      min="1"
                                      className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    />
                                  </div>
                                  <div className="text-center text-sm text-gray-500 dark:text-gray-400">+</div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">onwards</div>
                                  <div>
                                    <input
                                      type="number"
                                      {...register("lateFineRule.tier3Amount", { valueAsNumber: true })}
                                      placeholder="50"
                                      min="0"
                                      step="0.01"
                                      className="mt-1 block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    />
                                  </div>
                                </div>
                                
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  Example: Days 1-5: ₹10/day, Days 6-15: ₹20/day, Days 16+: ₹50/day
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    />
                  </div>
                )}
              </>
            )}
          />
        </div>
        <div>
          <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bank Name (Optional)
          </label>
          <input
            type="text"
            id="bankName"
            key="group-bank-name-input"
            {...register("bankName")}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., State Bank of India, HDFC Bank"
          />
          {errors.bankName && <p className="mt-1 text-sm text-red-500">{errors.bankName.message}</p>}
        </div>
        <div>
          <label htmlFor="bankAccountNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bank Account Number (Optional)
          </label>
          <input
            type="number"
            id="bankAccountNumber"
            key="group-bank-account-input"
            {...register("bankAccountNumber")}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter numeric bank account number"
            pattern="[0-9]*"
            inputMode="numeric"
          />
          {errors.bankAccountNumber && <p className="mt-1 text-sm text-red-500">{errors.bankAccountNumber.message}</p>}
        </div>
      </div>
    </div>
  ), [register, errors, collectionFrequency]);

  // Member import interfaces and functions - moved here to fix hoisting issue
  interface MemberImportRow {
    id?: string; // Add id property for our balanced extraction
    Name?: string;
    'Loan Amount'?: string;
    Email?: string;
    Phone?: string;
    'Phone Number'?: string;
    name?: string;
    'loan amount'?: string;
    email?: string;
    phone?: string;
    'phone number'?: string;
    memberNumber?: string;
    accountNumber?: string;
    loanAmount?: number; // Added to support our enhanced parsing
    personalContribution?: number;
    monthlyContribution?: number;
    joinedAt?: Date;
    // Add missing properties that are being accessed
    NAME?: string;
    EMAIL?: string;
    PHONE?: string;
    LOAN?: string;
    Loan?: string;
    // Add properties used in the balanced extraction
    memberId?: string;
    currentShare?: number;
    currentLoanAmount?: number;
    isExisting?: boolean;
    isValid?: boolean;
  }

  const handleMemberImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    console.log("File selection event triggered");
    
    // Clear any previous state
    setMemberImportError(null);
    setMemberImportStatus(null);
    setImportedMembers([]);
    setShowImportedMembers(false);
    
    const files = event.target.files;
    if (!files || files.length === 0) {
      setMemberImportError("No file selected.");
      setMemberImportStatus(null);
      setFileProcessingType(null);
      setIsFileProcessing(false);
      return;
    }
    
    const file = files[0];
    if (!file) {
      setMemberImportError("No file selected.");
      setFileProcessingType(null);
      setIsFileProcessing(false);
      return;
    }

    console.log(`File selected: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.pdf') && 
        !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') &&
        fileType !== 'text/csv' && fileType !== 'application/pdf') {
      setMemberImportError("Invalid file type. Please upload a CSV, Excel, or PDF file.");
      setMemberImportStatus(null);
      setFileProcessingType(null);
      setIsFileProcessing(false);
      event.target.value = '';
      return;
    }

    setMemberImportStatus("Processing file...");
    setMemberImportError(null);
    setIsFileProcessing(true);
    
    if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
      setFileProcessingType('csv');
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      setFileProcessingType('excel');
    } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      setFileProcessingType('pdf');
      setMemberImportStatus("Processing PDF file... Extracting text and identifying tables...");
    }

    try {
      let rows: MemberImportRow[] = [];

      if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
        // Parse CSV file using dynamic import
        const Papa = await import('papaparse');
        await new Promise<void>((resolve, reject) => {
          Papa.parse<MemberImportRow>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              rows = results.data;
              resolve();
            },
            error: (error) => reject(error),
          });
        });
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse Excel file using dynamic import
        const ExcelJS = await import('exceljs');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.getWorksheet(1); // Get first worksheet
        const jsonData: MemberImportRow[] = [];
        
        if (worksheet) {
          const headers: string[] = [];
          // Get headers from first row
          worksheet.getRow(1).eachCell((cell, colNumber) => {
            headers[colNumber - 1] = cell.text;
          });
          
          // Process data rows
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) { // Skip header row
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const rowData: any = {};
              row.eachCell((cell, colNumber) => {
                const header = headers[colNumber - 1];
                if (header) {
                  rowData[header] = cell.text;
                }
              });
              if (rowData.Name || rowData.name || rowData.NAME) { // Only add rows with names
                jsonData.push(rowData);
              }
            }
          });
        }
        rows = jsonData;
      } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        // Use shared PDF extraction utility
        setFileProcessingType('pdf');
        setMemberImportStatus('Extracting members from PDF...');
        console.log(`Starting PDF extraction process for file: ${fileName}`);
        try {
          // Store the filename for better error reporting
          console.log(`Processing ${fileName} (${file.size} bytes)`);
          
          // extractMembersFromPDFV11 is defined via useCallback above - V11 server-side
          rows = await extractMembersFromPDFV11(file as File);
          console.log(`PDF extraction complete. Found ${rows.length} rows.`);
          
          if (rows.length > 0) {
            // Process each row, with special handling for SWAWLAMBAN format
            const processedMembers = rows.map(row => {
              // Get the name and clean it from any "NAME LOAN" prefixes
              let name = (row.name || row.Name || '').trim();
              
              // Special handling for SWAWLAMBAN format where "NAME LOAN" might be part of the name
              name = name.replace(/^NAME\s+LOAN\s+/i, '');
              
              // Extract loan amount from API response fields
              let loanAmountRaw = (row.currentLoanAmount || row.loanAmount || row['loan amount'] || row['Loan Amount'] || '0').toString();
              // Clean the amount by removing currency symbols, commas, etc.
              loanAmountRaw = loanAmountRaw.replace(/[₹Rs\s,]/g, '').trim();
              const loanAmount = parseFloat(loanAmountRaw) || 0;
              
              // CRITICAL DEBUG: Log the loan amount processing
              if (loanAmount > 0) {
                console.log(`🔧 LOAN AMOUNT DEBUG: ${name} -> ₹${loanAmount.toLocaleString()}`);
              }
              
              // Get email and phone, ensuring they're either a non-empty string or omitted
              const emailStr = (row.email || row.Email || '').trim();
              const phoneStr = (row.phone || row.Phone || '').trim();
              
              return {
                name: name,
                loanAmount: loanAmount,
                // Only include email/phone if they're not empty strings
                ...(emailStr ? { email: emailStr } : {}),
                ...(phoneStr ? { phone: phoneStr } : {})
              };
            }).filter(member => member.name && member.name.length > 1); // Filter out empty names
            
            console.log(`Processed ${processedMembers.length} members from PDF, sample:`, 
              processedMembers.slice(0, 3));
            
            // 🔍 DEBUG: Check loan amounts before setting state
            console.log('🔍 DEBUG: Pre-state loan amounts check:');
            processedMembers.slice(0, 5).forEach((member, i) => {
              console.log(`  ${i + 1}. ${member.name} - loanAmount: ${member.loanAmount} (type: ${typeof member.loanAmount})`);
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const totalLoanAmount = processedMembers.reduce((sum: number, m: any) => sum + (m.loanAmount || 0), 0);
            console.log(`🔍 DEBUG: Total loan amount before state: ₹${totalLoanAmount.toLocaleString()}`);
            
            // Display detailed information about what was found
            console.log(`Member names found: ${processedMembers.map(m => m.name).join(', ').substring(0, 100)}...`);
            
            if (processedMembers.length > 0) {
              setImportedMembers(processedMembers);
              
              // 🔍 DEBUG: Check state immediately after setting
              setTimeout(() => {
                console.log('🔍 DEBUG: Checking importedMembers state after setting...');
              }, 100);
              
              setShowImportedMembers(true);
              setMemberImportStatus(`Successfully extracted ${processedMembers.length} members from PDF.`);
              setIsFileProcessing(false);
              setFileProcessingType(null);
              return;
            } else {
              setMemberImportError("No valid members processed from PDF data. Please check the file format.");
            }
          } else {
            setMemberImportError(`No member data found in "${fileName}". Please check the file format.`);
          }
        } catch (pdfError) {
          console.error("PDF extraction error:", pdfError);
          setMemberImportError(`PDF processing error with "${fileName}": ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
          setMemberImportStatus(null);
          setIsFileProcessing(false);
          setFileProcessingType(null);
          event.target.value = '';
          return;
        }
      }

      // Process rows and validate required fields
      const validMembers: Array<{
        name: string;
        loanAmount: number;
        email?: string;
        phone?: string;
      }> = [];
      const invalidRows: string[] = [];
      const skippedExisting: string[] = [];

      rows.forEach((row: MemberImportRow, index: number) => {
        const name = (row['Name'] || row['name'] || row['NAME'] || '').trim();
        const loanAmountStrRaw = row['Loan Amount'] || row['loan amount'] || row['LOAN'] || row['Loan'] || '';
        const loanAmountStr = loanAmountStrRaw.replace(/,/g, '').trim();
        const email = (row['Email'] || row['email'] || row['EMAIL'] || '').trim();
        const phone = (row['Phone'] || row['phone'] || row['Phone Number'] || row['phone number'] || row['PHONE'] || '').trim();

        if (!name.trim()) {
          invalidRows.push(`Row ${index + 1}: Missing name`);
          return;
        }

        // Treat missing loan amount as zero
        let loanAmount: number;
        if (loanAmountStr) {
          const parsed = parseFloat(loanAmountStr);
          if (isNaN(parsed) || parsed < 0) {
            invalidRows.push(`Row ${index + 1}: Invalid loan amount`);
            return;
          }
          loanAmount = parsed;
        } else {
          loanAmount = 0;
        }

        // Prepare email and phone conditionally
        const trimmedEmail = email.trim();
        const trimmedPhone = phone.trim();
        
        // Create member object with required fields
        const memberObj: {
          name: string;
          loanAmount: number;
          email?: string;
          phone?: string;
        } = {
          name: name.trim(),
          loanAmount,
        };
        
        // Conditionally add optional fields
        if (trimmedEmail) {
          memberObj.email = trimmedEmail;
        }
        
        if (trimmedPhone) {
          memberObj.phone = trimmedPhone;
        }
        
        validMembers.push(memberObj);
      });

      if (invalidRows.length > 0) {
        setMemberImportError(`Found issues: ${invalidRows.join(', ')}`);
      }

      if (validMembers.length === 0) {
        if (skippedExisting.length > 0) {
          setMemberImportError(`No new members to import. All ${skippedExisting.length} member(s) already exist: ${skippedExisting.join(', ')}`);
        } else if (invalidRows.length > 0) {
          setMemberImportError(`No valid members found. Issues: ${invalidRows.join('; ')}`);
        } else {
          setMemberImportError("No valid members found in the file. Please ensure the file format is correct and retry.");
        }
        setMemberImportStatus(null);
        setIsFileProcessing(false);
        setFileProcessingType(null);
        return;
      } else {
        setImportedMembers(validMembers);
        setShowImportedMembers(true);
        let statusMessage = `Successfully parsed ${validMembers.length} new member(s) from file.`;
        if (skippedExisting.length > 0) {
          statusMessage += ` Skipped ${skippedExisting.length} existing member(s): ${skippedExisting.join(', ')}.`;
        }
        if (invalidRows.length > 0) {
          statusMessage += ` ${invalidRows.length} row(s) had issues and were skipped.`;
        }
        setMemberImportStatus(statusMessage);
      }

      event.target.value = '';
      setIsFileProcessing(false);
      setFileProcessingType(null);
    } catch (error) {
      console.error("Member Import Error:", error);
      setMemberImportError(`Error parsing file: ${(error as Error).message}`);
      setMemberImportStatus(null);
      setIsFileProcessing(false);
      setFileProcessingType(null);
      event.target.value = '';
    }
  };

  // Step 2: Member Import (Optional)
  const Step2 = useMemo(() => (
    <div className="card p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Step 2: Add Members (Optional)</h2>
      <div className="space-y-6">
        
        {/* Manual Member Addition Section */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Add Members Manually</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Add members one by one with their details:
          </p>
          
          <button
            type="button"
            onClick={() => { 
              setShowCreateMemberForm(prev => !prev); 
              setCreateMemberError(null); 
            }}
            className="mb-4 px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            {showCreateMemberForm ? 'Cancel' : 'Add New Member'}
          </button>

          {showCreateMemberForm && (
            <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-800/50 shadow">
              <h4 className="text-md font-semibold mb-3 text-gray-800 dark:text-gray-200">Member Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="step2-newMemberName" className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="step2-newMemberName"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700"
                    disabled={isCreatingMember}
                    placeholder="Enter member's full name"
                  />
                </div>
                <div>
                  <label htmlFor="step2-newMemberLoan" className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                    Loan Amount
                  </label>
                  <input
                    type="number"
                    id="step2-newMemberLoan"
                    value={newMemberLoan}
                    onChange={(e) => setNewMemberLoan(Number(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700"
                    disabled={isCreatingMember}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label htmlFor="step2-newMemberEmail" className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    id="step2-newMemberEmail"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700"
                    disabled={isCreatingMember}
                    placeholder="Enter member's email address"
                  />
                </div>
                <div>
                  <label htmlFor="step2-newMemberPhone" className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    id="step2-newMemberPhone"
                    value={newMemberPhone}
                    onChange={(e) => setNewMemberPhone(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700"
                    disabled={isCreatingMember}
                    placeholder="Enter member's phone number"
                  />
                </div>
              </div>
              {createMemberError && <p className="mt-2 text-sm text-red-500">{createMemberError}</p>}
              <div className="flex pt-4 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const success = await handleNewMemberSubmit();
                    // Don't close the form after adding, just reset the fields for next member
                    if (success) {
                      setNewMemberName('');
                      setNewMemberLoan(0);
                      setNewMemberEmail('');
                      setNewMemberPhone('');
                    }
                  }}
                  disabled={isCreatingMember || !newMemberName.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingMember ? 'Adding...' : 'Add Member'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const success = await handleNewMemberSubmit();
                    // Close the form after adding this member
                    if (success) {
                      setShowCreateMemberForm(false);
                      setNewMemberName('');
                      setNewMemberLoan(0);
                      setNewMemberEmail('');
                      setNewMemberPhone('');
                    }
                  }}
                  disabled={isCreatingMember || !newMemberName.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingMember ? 'Adding...' : 'Add & Done'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMemberForm(false);
                    setNewMemberName('');
                    setNewMemberLoan(0);
                    setNewMemberEmail('');
                    setNewMemberPhone('');
                    setCreateMemberError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-md text-gray-600 bg-gray-200 hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Show manually added members */}
          {displayableMembers.length > 0 && (
            <div className="mt-4 p-4 border rounded-md bg-blue-50 dark:bg-blue-900/20">
              <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
                Available Members ({displayableMembers.length})
              </h4>
              <div className="max-h-40 overflow-y-auto">
                <ul className="space-y-1">
                  {displayableMembers.map((member) => (
                    <li key={member.id} className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-2 text-green-500">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                      {member.name}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                These members will be available for selection in Step 3
              </p>
            </div>
          )}
        </div>

        {/* File Import Section */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Import from File</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            You can import members from a CSV, Excel, or PDF file. The file should contain:
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside ml-4 mb-4">
            <li><strong>Name</strong> (required) - Member name</li>
            <li><strong>Loan Amount</strong> (required) - Current loan amount</li>
            <li><strong>Email</strong> (optional) - Member email address</li>
            <li><strong>Phone</strong> (optional) - Member phone number (also supports &quot;Phone Number&quot; column)</li>
          </ul>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                setShowMemberImport(!showMemberImport);
                setMemberImportError(null);
                setMemberImportStatus(null);
              }}
              className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {showMemberImport ? 'Cancel Import' : 'Import Members from File'}
            </button>

            {displayableMembers.length > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 text-sm font-medium rounded-md text-gray-600 bg-gray-200 hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                Skip & Use Existing Members
              </button>
            )}
          </div>
        </div>

        {showMemberImport && (
          <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-800/50">
            <h4 className="text-md font-semibold mb-3 text-gray-800 dark:text-gray-200">Upload File</h4>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {/* Force a new file input on each render to ensure it works properly */}
                <input
                  type="file"
                  key={`file-input-${Date.now()}`}
                  id="member-file-upload"
                  accept=".csv,.xlsx,.xls,.pdf"
                  onChange={handleMemberImportFileChange}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
                  disabled={isFileProcessing}
                />
                {!isFileProcessing && (
                  <button
                    type="button"
                    onClick={() => {
                      // Reset the file input
                      const fileInput = document.getElementById('member-file-upload') as HTMLInputElement;
                      if (fileInput) fileInput.value = '';
                      setMemberImportError(null);
                      setMemberImportStatus(null);
                      setImportedMembers([]);
                      setShowImportedMembers(false);
                    }}
                    className="px-3 py-2 text-xs rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {isFileProcessing ? 'Processing file...' : 'Choose a CSV, Excel, or PDF file containing member data.'}
              </div>
            </div>
            
            {isFileProcessing && fileProcessingType === 'pdf' && (
              <div className="mt-4 p-4 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
                <div className="flex items-center">
                  <div className="relative flex items-center justify-center w-12 h-12 mr-3">
                    <div className="absolute w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-medium text-blue-700 dark:text-blue-300">PDF Processing</h5>
                    <p className="text-sm text-blue-600 dark:text-blue-400">{memberImportStatus || "Analyzing PDF structure..."}</p>
                  </div>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-1.5 mt-3">
                  <div className="bg-blue-600 h-1.5 rounded-full animate-pulse"></div>
                </div>
              </div>
            )}
            
            {isFileProcessing && fileProcessingType === 'excel' && (
              <div className="mt-4 p-4 border border-green-200 rounded-lg bg-green-50 dark:bg-green-900/20 dark:border-green-800">
                <div className="flex items-center">
                  <div className="relative w-10 h-10 mr-3 flex items-center justify-center">
                    <div className="absolute w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-medium text-green-700 dark:text-green-300">Excel Processing</h5>
                    <p className="text-sm text-green-600 dark:text-green-400">Parsing spreadsheet data...</p>
                  </div>
                </div>
              </div>
            )}
            
            {isFileProcessing && fileProcessingType === 'csv' && (
              <div className="mt-4 p-4 border border-yellow-200 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
                <div className="flex items-center">
                  <div className="relative w-10 h-10 mr-3 flex items-center justify-center">
                    <div className="absolute w-10 h-10 border-4 border-yellow-200 border-t-yellow-600 rounded-full animate-spin"></div>
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v3a2 2 0 01-2 2M5 12a2 2 0 00-2 2v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-medium text-yellow-700 dark:text-yellow-300">CSV Processing</h5>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">Processing CSV data...</p>
                  </div>
                </div>
              </div>
            )}
            
            {!isFileProcessing && memberImportStatus && (
              <p className="mt-2 text-sm text-green-600 dark:text-green-400">{memberImportStatus}</p>
            )}
            
            {memberImportError && (
              <p className="mt-2 text-sm text-red-500">{memberImportError}</p>
            )}
          </div>
        )}

        {showImportedMembers && importedMembers.length > 0 && (
          <div className="p-4 border rounded-md bg-green-50 dark:bg-green-900/20">
            {/* 🔍 DEBUG: Log the current state of importedMembers at render time */}
            {(() => {
              console.log('🔍 RENDER STATE DEBUG: showImportedMembers =', showImportedMembers);
              console.log('🔍 RENDER STATE DEBUG: importedMembers.length =', importedMembers.length);
              console.log('🔍 RENDER STATE DEBUG: importedMembers sample (first 3):', 
                importedMembers.slice(0, 3).map(m => ({
                  name: m.name,
                  loanAmount: m.loanAmount,
                  type: typeof m.loanAmount
                }))
              );
              const totalLoanAmount = importedMembers.reduce((sum, m) => sum + (m.loanAmount || 0), 0);
              console.log('🔍 RENDER STATE DEBUG: Total loan amount in state:', totalLoanAmount);
              return null;
            })()}
            
            <div className="flex items-center mb-3">
              <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 flex-1">
                Imported Members Preview ({importedMembers.length} members)
              </h4>
              
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">
                Ready to Create
              </span>
            </div>
            
            <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Loan Amount</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Email</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {importedMembers.map((member, index) => {
                    // 🔍 DEBUG: Log each member as it's being rendered
                    if (index < 5) {
                      console.log(`🔍 RENDER DEBUG Member ${index + 1}:`, {
                        name: member.name,
                        loanAmount: member.loanAmount,
                        loanAmountType: typeof member.loanAmount,
                        loanAmountValue: member.loanAmount,
                        conditionCheck: member.loanAmount > 0,
                        memberObj: JSON.stringify(member)
                      });
                    }
                    
                    return (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-700'}>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{index + 1}</td>
                      <td className="py-2 px-3 font-medium">{member.name}</td>
                      <td className="py-2 px-3 text-right">
                        {member.loanAmount > 0 ? (
                          <span className="text-green-600 dark:text-green-400">₹{member.loanAmount.toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">₹0</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{member.email || '-'}</td>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{member.phone || '-'}</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Create Members button clicked');
                  createMembersFromImport();
                }}
                disabled={isCreatingMembers}
                className={`px-4 py-2 text-sm font-medium rounded-md text-white ${
                  isCreatingMembers 
                    ? 'bg-green-500 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700'
                } flex items-center`}
              >
                {isCreatingMembers ? (
                  <>
                    <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create These Members
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportedMembers([]);
                  setShowImportedMembers(false);
                  setMemberImportStatus(null);
                }}
                className="px-4 py-2 text-sm font-medium rounded-md text-gray-600 bg-gray-200 hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p className="font-medium mb-2">Current available members: {displayableMembers.length}</p>
          {displayableMembers.length > 0 && (
            <div className="max-h-32 overflow-y-auto">
              <ul className="list-disc list-inside">
                {displayableMembers.map((member) => (
                  <li key={member.id}>{member.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  ), [showMemberImport, memberImportError, memberImportStatus, displayableMembers, isFileProcessing, fileProcessingType, showImportedMembers, importedMembers, showCreateMemberForm, newMemberName, newMemberEmail, newMemberPhone, newMemberLoan, createMemberError, isCreatingMember]);

  // Step 3: Member Selection & Group Setup - Memoized to prevent unnecessary re-renders
  const Step3 = useMemo(() => (
    <div className="card p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Step 3: Member & Group Setup</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="leaderId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Select Leader <span className="text-red-500">*</span>
          </label>
          <select
            id="leaderId"
            {...register("leaderId")}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Select a Leader --</option>
            {displayableMembers.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
          {errors.leaderId && <p className="mt-1 text-sm text-red-500">{errors.leaderId.message}</p>}
          
          {/* Leader linking notification */}
          {showLeaderLinkingNotification && leaderLinkingStatus && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700 dark:text-blue-200">
                    {leaderLinkingStatus}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Select Members (Leader is auto-selected) <span className="text-red-500">*</span>
          </label>

          <button
            type="button"
            onClick={() => { setShowCreateMemberForm(prev => !prev); setCreateMemberError(null); }}
            className="my-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-1">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            {showCreateMemberForm ? 'Cancel Creating Member' : 'Create New Member'}
          </button>

          {showCreateMemberForm && (
            <div className="my-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-800/50 shadow">
              <h4 className="text-md font-semibold mb-3 text-gray-800 dark:text-gray-200">Add New Member Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="step3-newMemberName" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    id="step3-newMemberName"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700"
                    disabled={isCreatingMember}
                    placeholder="Enter member's full name"
                  />
                </div>
                <div>
                  <label htmlFor="step3-newMemberLoan" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Loan Amount</label>
                  <input
                    type="number"
                    id="step3-newMemberLoan"
                    value={newMemberLoan}
                    onChange={(e) => setNewMemberLoan(Number(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700"
                    disabled={isCreatingMember}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label htmlFor="step3-newMemberEmail" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Email (Optional)</label>
                  <input
                    type="email"
                    id="step3-newMemberEmail"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700"
                    disabled={isCreatingMember}
                    placeholder="Enter member's email address"
                  />
                </div>
                <div>
                  <label htmlFor="step3-newMemberPhone" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Phone (Optional)</label>
                  <input
                    type="tel"
                    id="step3-newMemberPhone"
                    value={newMemberPhone}
                    onChange={(e) => setNewMemberPhone(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700"
                    disabled={isCreatingMember}
                    placeholder="Enter member's phone number"
                  />
                </div>
              </div>
              {createMemberError && <p className="mt-2 text-xs text-red-500">{createMemberError}</p>}
              <div className="flex pt-3 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const success = await handleNewMemberSubmit();
                    if (success) {
                      setShowCreateMemberForm(false);
                      setNewMemberName('');
                      setNewMemberLoan(0);
                      setNewMemberEmail('');
                      setNewMemberPhone('');
                      setCreateMemberError(null);
                    }
                  }}
                  disabled={isCreatingMember || !newMemberName.trim()}
                  className="px-3 py-1.5 text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCreatingMember ? 'Saving...' : 'Save & Add Member'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMemberForm(false);
                    setNewMemberName('');
                    setNewMemberLoan(0);
                    setNewMemberEmail('');
                    setNewMemberPhone('');
                    setCreateMemberError(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-600 bg-gray-200 hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Select All/Deselect All functionality */}
          {displayableMembers.filter(member => member.id !== selectedLeaderId).length > 0 && (
            <div className="mt-2 mb-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                <input
                  type="checkbox"
                  checked={areAllMembersSelected()}
                  onChange={() => {}} // Handled by button click
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded mr-2 pointer-events-none"
                />
                {areAllMembersSelected() ? 'Deselect All Members' : 'Select All Members'}
                <span className="ml-1 text-gray-500 dark:text-gray-400">
                  ({displayableMembers.filter(member => member.id !== selectedLeaderId).length} members)
                </span>
              </button>
            </div>
          )}

          <div className="mt-2 space-y-2 max-h-60 overflow-auto p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700/50">
            {initialAvailableMembers.length === 0 && !showCreateMemberForm && (
                 <p className="text-sm text-gray-500 dark:text-gray-400">No members available. You can create one above.</p>
            )}
            {displayableMembers.map((member) => (
              <div key={member.id} className="flex items-center">
                <input
                  type="checkbox"
                  id={`member-select-${member.id}`}
                  checked={memberFields.some(field => field.memberId === member.id) || member.id === selectedLeaderId}
                  disabled={member.id === selectedLeaderId} // Disable checkbox for the leader
                  onChange={() => toggleMember(member.id, member.name)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <label
                  htmlFor={`member-select-${member.id}`}
                  className="ml-2 block text-sm text-gray-900 dark:text-gray-100"
                >
                  {member.name} {member.id === selectedLeaderId ? "(Leader)" : ""}
                </label>
              </div>
            ))}
          </div>
          {errors.members && <p className="mt-1 text-sm text-red-500">{errors.members.message}</p>}
        </div>
        
        <div>
          <label htmlFor="memberCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Total Member Count <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="memberCount"
            {...register("memberCount", { valueAsNumber: true })}
            readOnly
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-100 dark:bg-gray-700/50"
          />
          {errors.memberCount && <p className="mt-1 text-sm text-red-500">{errors.memberCount.message}</p>}
        </div>

        <div>
          <label htmlFor="dateOfStarting" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date of Starting <span className="text-red-500">*</span>
          </label>
          <Controller
            control={control}
            name="dateOfStarting"
            render={({ field: { onChange, value, onBlur, ref } }) => (
              <DatePicker
                key="group-start-date-picker"
                selected={value}
                onChange={onChange}
                onBlur={onBlur}
                ref={ref}
                dateFormat="MMMM d, yyyy"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholderText="Select date"
                maxDate={new Date()} // Changed to use new Date() directly
                popperPlacement="bottom-start"
                showYearDropdown
                showMonthDropdown
                dropdownMode="select"
              />
            )}
          />
          {errors.dateOfStarting && <p className="mt-1 text-sm text-red-500">{errors.dateOfStarting.message}</p>}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description (Optional)
          </label>
          <textarea
            id="description"
            key="group-description-textarea"
            {...register("description")}
            rows={3}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Complex component with many interdependent state variables and functions
  ), [register, errors, control, displayableMembers]);

  // Step 4: Current Month Financial Data
  // Watch specific values for dynamic updates
  const watchedMembers = watch('members');
  const watchedCashInHand = watch('cashInHand');
  const watchedBalanceInBank = watch('balanceInBank');
  const watchedGlobalShareAmount = watch('globalShareAmount');
  const watchedInterestRate = watch('interestRate');
  const watchedMonthlyContribution = watch('monthlyContribution');
  const watchedGroupSocialEnabled = watch('groupSocialEnabled');
  const watchedGroupSocialAmountPerFamilyMember = watch('groupSocialAmountPerFamilyMember');
  const watchedLoanInsuranceEnabled = watch('loanInsuranceEnabled');
  const watchedLoanInsurancePercent = watch('loanInsurancePercent');
  const watchedGroupSocialPreviousBalance = watch('groupSocialPreviousBalance');
  const watchedLoanInsurancePreviousBalance = watch('loanInsurancePreviousBalance');
  const watchedIncludeDataTillCurrentPeriod = watch('includeDataTillCurrentPeriod');

  const Step4 = useMemo(() => {
    const memberFieldsData = watchedMembers || []; // Use watched value
    const currentCashInHand = Number(watchedCashInHand) || 0;
    const currentBalanceInBank = Number(watchedBalanceInBank) || 0;
    const globalShareAmount = Number(watchedGlobalShareAmount) || 0;
    const interestRate = Number(watchedInterestRate) || 0;
    const monthlyContribution = Number(watchedMonthlyContribution) || 0;
    
    // Calculate total loan amount from all members
    const totalLoanAmount = memberFieldsData.reduce((sum: number, member) => {
      // Safely extract and convert the loan amount
      const loanAmount = typeof member.currentLoanAmount === 'number' ? member.currentLoanAmount : 0;
      return sum + loanAmount;
    }, 0);
    
    // Calculate total share amount using global share amount
    const totalShareAmount = globalShareAmount * memberFieldsData.length;
    
    // Calculate total group standing - ensure proper number conversion
    const totalGroupStanding = roundToTwoDecimals(totalLoanAmount + currentCashInHand + currentBalanceInBank);
    
    // Calculate additional dynamic insights
    const totalMonthlyCollection = roundToTwoDecimals(monthlyContribution * memberFieldsData.length);
    const monthlyInterestOnLoans = totalLoanAmount > 0 ? roundToTwoDecimals((totalLoanAmount * (interestRate / 100)) / 12) : 0;

    return (
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Step 4: Current Financial Data
          </h2>
        </div>

        <div className="space-y-6">
          {/* Group Financial Information */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">Group Financial Summary</h3>
            
            {/* Financial Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cashInHand" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cash in Hand (₹)
                </label>
                <Controller
                  name="cashInHand"
                  control={control}
                  defaultValue={0}
                  render={({ field: { onChange, onBlur, value, name } }) => (
                    <input
                      type="number"
                      id={name}
                      value={value || ''}
                      onChange={e => onChange(parseFloat(e.target.value) || 0)}
                      onBlur={onBlur}
                      min="0"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 10000"
                    />
                  )}
                />
                {errors.cashInHand && (
                  <p className="mt-1 text-sm text-red-500">{errors.cashInHand.message}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="balanceInBank" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Balance in Bank (₹)
                </label>
                <Controller
                  name="balanceInBank"
                  control={control}
                  defaultValue={0}
                  render={({ field: { onChange, onBlur, value, name } }) => (
                    <input
                      type="number"
                      id={name}
                      value={value || ''}
                      onChange={e => onChange(parseFloat(e.target.value) || 0)}
                      onBlur={onBlur}
                      min="0"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 25000"
                    />
                  )}
                />
                {errors.balanceInBank && (
                  <p className="mt-1 text-sm text-red-500">{errors.balanceInBank.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="interestRate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Interest Rate (% per annum)
                </label>
                <Controller
                  name="interestRate"
                  control={control}
                  defaultValue={0}
                  render={({ field: { onChange, onBlur, value, name } }) => (
                    <input
                      type="number"
                      id={name}
                      value={value || ''}
                      onChange={e => onChange(parseFloat(e.target.value) || 0)}
                      onBlur={onBlur}
                      min="0"
                      max="100"
                      step="0.1"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 2.5"
                    />
                  )}
                />
                {errors.interestRate && (
                  <p className="mt-1 text-sm text-red-500">{errors.interestRate.message}</p>
                )}
                {interestRate > 0 && totalLoanAmount > 0 && (
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    Monthly interest income: ₹{monthlyInterestOnLoans.toFixed(2)}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="monthlyContribution" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {collectionFrequency === 'WEEKLY' ? 'Weekly' : 
                   collectionFrequency === 'FORTNIGHTLY' ? 'Fortnightly' :
                   collectionFrequency === 'YEARLY' ? 'Yearly' : 'Monthly'} Contribution per Member (₹)
                </label>
                <Controller
                  name="monthlyContribution"
                  control={control}
                  defaultValue={0}
                  render={({ field: { onChange, onBlur, value, name } }) => (
                    <input
                      type="number"
                      id={name}
                      value={value || ''}
                      onChange={e => onChange(parseFloat(e.target.value) || 0)}
                      onBlur={onBlur}
                      min="0"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 1000"
                    />
                  )}
                />
                {errors.monthlyContribution && (
                  <p className="mt-1 text-sm text-red-500">{errors.monthlyContribution.message}</p>
                )}
                {monthlyContribution > 0 && memberFieldsData.length > 0 && (
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    Total {collectionFrequency === 'WEEKLY' ? 'weekly' : 
                           collectionFrequency === 'FORTNIGHTLY' ? 'fortnightly' :
                           collectionFrequency === 'YEARLY' ? 'yearly' : 'monthly'} collection: ₹{totalMonthlyCollection.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Group Social Settings */}
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="text-lg font-medium text-green-900 dark:text-green-100 mb-3">Group Social Settings</h3>
            <Controller
              name="groupSocialEnabled"
              control={control}
              render={({ field }) => (
                <>
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id="groupSocialEnabled"
                      checked={field.value || false}
                      onChange={(e) => {
                        field.onChange(e.target.checked);
                      }}
                      className="mr-2"
                    />
                    <label htmlFor="groupSocialEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable Group Social System
                    </label>
                  </div>
                  
                  {/* Use field.value directly instead of useWatch */}
                  {field.value === true && (
                    <div className="space-y-4 pl-6 border-l-4 border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-800/50 p-4 rounded shadow-sm">
                      <div className="text-green-800 dark:text-green-200 font-medium mb-2">
                        ✅ Group Social Configuration
                      </div>
                      <div>
                        <label htmlFor="groupSocialAmountPerFamilyMember" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Amount per Family Member (₹) <span className="text-gray-500 text-sm">(Optional)</span>
                        </label>
                        <Controller
                          name="groupSocialAmountPerFamilyMember"
                          control={control}
                          defaultValue={0}
                          render={({ field: { onChange, onBlur, value, name } }) => (
                            <input
                              type="number"
                              id={name}
                              value={value || ''}
                              onChange={e => onChange(parseFloat(e.target.value) || 0)}
                              onBlur={onBlur}
                              min="0"
                              className="mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                              placeholder="e.g., 50 (Leave 0 if not applicable)"
                            />
                          )}
                        />
                        {errors.groupSocialAmountPerFamilyMember && (
                          <p className="mt-1 text-sm text-red-500">{errors.groupSocialAmountPerFamilyMember.message}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Leave as 0 if you don't want to set a specific amount. Family-based tracking will still be available.
                        </p>
                        <div className="mt-2 p-3 bg-green-100 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                          <p className="text-sm text-green-800 dark:text-green-200">
                            ✅ <strong>Group Social enabled!</strong> Members can set their family size for fair contribution tracking.
                          </p>
                        </div>
                        {/* Add editable total Group Social amount */}
                        <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800">
                          <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Group Social Fund</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Calculated Current Period:
                              </label>
                              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                                ₹{(() => {
                                  const totalFamilyMembers = memberFieldsData.reduce((sum, member) => {
                                    return sum + (member.familyMembersCount || 1);
                                  }, 0);
                                  return ((watchedGroupSocialAmountPerFamilyMember || 0) * totalFamilyMembers).toFixed(2);
                                })()}
                              </p>
                            </div>
                            <div>
                              <label htmlFor="groupSocialPreviousBalance" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Previous Balance (₹):
                              </label>
                              <Controller
                                name="groupSocialPreviousBalance"
                                control={control}
                                defaultValue={0}
                                render={({ field: { onChange, onBlur, value, name } }) => (
                                  <input
                                    type="number"
                                    id={name}
                                    value={value || ''}
                                    onChange={e => onChange(parseFloat(e.target.value) || 0)}
                                    onBlur={onBlur}
                                    min="0"
                                    className="input-field-sm"
                                    placeholder="Previous balance"
                                  />
                                )}
                              />
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Any previous amount in group social fund (default: 0)
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            />
          </div>

          {/* Loan Insurance Settings */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <h3 className="text-lg font-medium text-yellow-900 dark:text-yellow-100 mb-3">Loan Insurance Settings</h3>
            <Controller
              name="loanInsuranceEnabled"
              control={control}
              render={({ field }) => (
                <>
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id="loanInsuranceEnabledEnhanced"
                      checked={field.value || false}
                      onChange={(e) => {
                        field.onChange(e.target.checked);
                      }}
                      className="mr-2"
                    />
                    <label htmlFor="loanInsuranceEnabledEnhanced" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable Loan Insurance System
                    </label>
                  </div>
                  
                  {field.value === true && (
                    <div className="space-y-4 pl-6 border-l-4 border-yellow-400 dark:border-yellow-500 bg-yellow-50 dark:bg-yellow-800/50 p-4 rounded shadow-sm">
                      <div className="text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                        ✅ Loan Insurance Configuration
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="loanInsurancePercent" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Loan Insurance Rate (% per loan amount) <span className="text-red-500">*</span>
                          </label>
                          <Controller
                            name="loanInsurancePercent"
                            control={control}
                            defaultValue={0}
                            render={({ field: { onChange, onBlur, value, name } }) => (
                              <input
                                type="number"
                                id={name}
                                value={value || ''}
                                onChange={e => onChange(parseFloat(e.target.value) || 0)}
                                onBlur={onBlur}
                                min="0"
                                max="100"
                                step="0.1"
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                                placeholder="e.g., 1.5"
                              />
                            )}
                          />
                          {errors.loanInsurancePercent && (
                            <p className="mt-1 text-sm text-red-500">{errors.loanInsurancePercent.message}</p>
                          )}
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Members with loans will pay this percentage of their loan amount as insurance
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Calculated Total Insurance Amount
                          </label>
                          <p className="text-xl font-medium text-yellow-700 dark:text-yellow-300">
                            ₹{(() => {
                              const loanInsurancePercent = Number(watchedLoanInsurancePercent) || 0;
                              return (totalLoanAmount * (loanInsurancePercent / 100)).toFixed(2);
                            })()}
                          </p>
                        </div>
                      </div>
                      
                      {/* Add editable total Loan Insurance amount */}
                      <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-200 dark:border-yellow-800">
                        <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Loan Insurance Fund</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Calculated Current Period:
                            </label>
                            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                              ₹{(() => {
                                const loanInsurancePercent = Number(watchedLoanInsurancePercent) || 0;
                                return (totalLoanAmount * (loanInsurancePercent / 100)).toFixed(2);
                              })()}
                            </p>
                          </div>
                          <div>
                            <label htmlFor="loanInsurancePreviousBalance" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Previous Balance (₹):
                            </label>
                            <Controller
                              name="loanInsurancePreviousBalance"
                              control={control}
                              defaultValue={0}
                              render={({ field: { onChange, onBlur, value, name } }) => (
                                <input
                                  type="number"
                                  id={name}
                                  value={value || ''}
                                  onChange={e => onChange(parseFloat(e.target.value) || 0)}
                                  onBlur={onBlur}
                                  min="0"
                                  className="input-field-sm"
                                  placeholder="Previous balance"
                                />
                              )}
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Any previous amount in loan insurance fund (default: 0)
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            />
          </div>

          {/* Period Tracking Settings */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">Period Tracking Settings</h3>
            <Controller
              name="includeDataTillCurrentPeriod"
              control={control}
              render={({ field }) => (
                <>
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id="includeDataTillCurrentPeriod"
                      checked={field.value || false}
                      onChange={(e) => {
                        field.onChange(e.target.checked);
                        if (e.target.checked) {
                          // Set current period to next month for contribution tracking
                          const currentDate = new Date();
                          const nextMonth = currentDate.getMonth() + 2; // +2 because getMonth() is 0-based, and we want next month
                          const nextYear = nextMonth > 12 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();
                          const adjustedMonth = nextMonth > 12 ? 1 : nextMonth;
                          
                          setValue('currentPeriodMonth', adjustedMonth);
                          setValue('currentPeriodYear', adjustedMonth === 1 ? nextYear : currentDate.getFullYear());
                        } else {
                          // Set current period to current month
                          const currentDate = new Date();
                          setValue('currentPeriodMonth', currentDate.getMonth() + 1);
                          setValue('currentPeriodYear', currentDate.getFullYear());
                        }
                      }}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="includeDataTillCurrentPeriod" className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Include historical data till current period
                    </label>
                  </div>
                  
                  {field.value && (
                    <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
                      <div className="mb-3">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <strong>Current Period for Contribution Tracking:</strong> {(() => {
                            const currentDate = new Date();
                            const nextMonth = currentDate.getMonth() + 2;
                            const nextYear = nextMonth > 12 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();
                            const adjustedMonth = nextMonth > 12 ? 1 : nextMonth;
                            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'];
                            return `${monthNames[adjustedMonth - 1]} ${adjustedMonth === 1 ? nextYear : currentDate.getFullYear()}`;
                          })()}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                          Since you're including data till current period, contribution tracking will start from the next period.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {!field.value && (
                    <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
                      <div className="mb-3">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <strong>Current Period for Contribution Tracking:</strong> {(() => {
                            const currentDate = new Date();
                            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'];
                            return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
                          })()}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                          Contribution tracking will start from the current period.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            />
          </div>

          {/* Global Share Amount */}
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
            <h3 className="text-lg font-medium text-purple-900 dark:text-purple-100 mb-3">Member Share Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="globalShareAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {getShareLabel()} per Member (₹)
                </label>
                <div className="flex gap-2">
                  <Controller
                    name="globalShareAmount"
                    control={control}
                    defaultValue={0}
                    render={({ field: { onChange, onBlur, value, name } }) => (
                      <input
                        type="number"
                        id={name}
                        value={value || ''}
                        onChange={e => onChange(parseFloat(e.target.value) || 0)}
                        onBlur={onBlur}
                        min="0"
                        className="flex-1 mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                        placeholder="e.g., 500"
                      />
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (memberFieldsData.length > 0 && totalGroupStanding > 0) {
                        // Calculate exact share to ensure total equals group standing
                        const exactShare = totalGroupStanding / memberFieldsData.length;
                        setValue('globalShareAmount', roundToTwoDecimals(exactShare)); // Round to 2 decimal places
                      }
                    }}
                    className="mt-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 whitespace-nowrap"
                    title="Auto-calculate member share to distribute group standing equally among all members"
                  >
                    Auto Calculate
                  </button>
                </div>
                {errors.globalShareAmount && (
                  <p className="mt-1 text-sm text-red-500">{errors.globalShareAmount.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This amount will be applied to all {memberFieldsData.length} members
                </p>
                {memberFieldsData.length > 0 && totalGroupStanding > 0 && (
                  <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
                    Auto-calculated share: ₹{roundToTwoDecimals(totalGroupStanding / memberFieldsData.length).toFixed(2)} per member
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Members Loan Information Only */}
          {memberFieldsData.length > 0 ? (
            <>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Member Loan Data & Family Size</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Enter each member&apos;s current loan amount (if any) and family size for group social calculations.
                </p>
              </div>
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {memberFields.map((field, index) => (
                  <div key={field.fieldId} className="p-4 border rounded-md bg-gray-50 dark:bg-gray-800/30">
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3 text-md">{field.name}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor={`members.${index}.currentLoanAmount`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Current Loan Amount (₹)
                        </label>
                        <Controller
                          name={`members.${index}.currentLoanAmount`}
                          control={control}
                          defaultValue={0}
                          render={({ field: { onChange, onBlur, value, name } }) => (
                            <input
                              type="number"
                              id={name}
                              value={value || ''}
                              onChange={e => onChange(parseFloat(e.target.value) || 0)}
                              onBlur={onBlur}
                              min="0"
                              className="input-field-sm"
                              placeholder="e.g., 5000"
                            />
                          )}
                        />
                        {errors.members?.[index]?.currentLoanAmount && (
                          <p className="mt-1 text-xs text-red-500">{errors.members[index]?.currentLoanAmount?.message}</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor={`members.${index}.familyMembersCount`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Family Size {groupSocialEnabled && <span className="text-red-500">*</span>}
                        </label>
                        <Controller
                          name={`members.${index}.familyMembersCount`}
                          control={control}
                          defaultValue={1}
                          render={({ field: { onChange, onBlur, value, name } }) => (
                            <input
                              type="number"
                              id={name}
                              value={value || 1}
                              onChange={e => onChange(parseInt(e.target.value) || 1)}
                              onBlur={onBlur}
                              min="1"
                              max="20"
                              className="input-field-sm"
                              placeholder="e.g., 4"
                            />
                          )}
                        />
                        {errors.members?.[index]?.familyMembersCount && (
                          <p className="mt-1 text-xs text-red-500">{errors.members[index]?.familyMembersCount?.message}</p>
                        )}
                        {groupSocialEnabled && (
                          <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                            Group Social: ₹{((watch('groupSocialAmountPerFamilyMember') || 0) * (watch(`members.${index}.familyMembersCount`) || 1)).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No members selected yet. Add members in Step 3 to input their financial data.
            </p>
          )}

          {/* Auto-calculated Total Group Standing */}
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="text-lg font-medium text-green-900 dark:text-green-100 mb-2">Auto-Calculated Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Total Share Amount (all members):</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  ₹{totalShareAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Total Loan Amount (all members):</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">₹{totalLoanAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Cash in Hand:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">₹{currentCashInHand.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Balance in Bank:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">₹{currentBalanceInBank.toFixed(2)}</span>
              </div>
              {monthlyContribution > 0 && memberFieldsData.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">
                    Total {collectionFrequency === 'WEEKLY' ? 'Weekly' : 
                           collectionFrequency === 'FORTNIGHTLY' ? 'Fortnightly' :
                           collectionFrequency === 'YEARLY' ? 'Yearly' : 'Monthly'} Collection:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">₹{totalMonthlyCollection.toFixed(2)}</span>
                </div>
              )}
              {interestRate > 0 && totalLoanAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Monthly Interest on Loans ({interestRate}% p.a.):</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">₹{monthlyInterestOnLoans.toFixed(2)}</span>
                </div>
              )}
              <hr className="border-green-200 dark:border-green-700" />
              <div className="flex justify-between text-lg font-semibold">
                <span className="text-green-900 dark:text-green-100">Total Group Standing:</span>
                <span className="text-green-900 dark:text-green-100">₹{totalGroupStanding.toFixed(2)}</span>
              </div>

            </div>
          </div>

          {/* New Auto-Calculated Summary - Show only if GS or LI are enabled */}
          {(watchedGroupSocialEnabled || watchedLoanInsuranceEnabled) && (
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
              <h3 className="text-lg font-medium text-indigo-900 dark:text-indigo-100 mb-3">Auto-Calculated Summary</h3>
              <div className="space-y-3 text-sm">
                {(() => {
                  // Calculate enhanced totals
                  const loanInsurancePercent = Number(watchedLoanInsurancePercent) || 0;
                  const groupSocialPerFamily = Number(watchedGroupSocialAmountPerFamilyMember) || 0;
                  
                  // Calculate late fine (simplified for creation - actual calculation depends on overdue days)
                  const estimatedLateFine = 0; // For creation, this would be 0
                  
                  // Calculate loan insurance amount - current period calculation plus previous balance
                  const calculatedLoanInsuranceAmount = watchedLoanInsuranceEnabled ? 
                    roundToTwoDecimals(totalLoanAmount * (loanInsurancePercent / 100)) : 0;
                  const loanInsurancePreviousBalance = Number(watch('loanInsurancePreviousBalance')) || 0;
                  const totalLoanInsuranceFund = calculatedLoanInsuranceAmount + loanInsurancePreviousBalance;
                  
                  // Calculate group social amount - current period calculation plus previous balance
                  const totalFamilyMembers = memberFieldsData.reduce((sum, member) => {
                    return sum + (member.familyMembersCount || 1);
                  }, 0);
                  const calculatedGroupSocialAmount = watchedGroupSocialEnabled ? 
                    roundToTwoDecimals(totalFamilyMembers * groupSocialPerFamily) : 0;
                  const groupSocialPreviousBalance = Number(watch('groupSocialPreviousBalance')) || 0;
                  const totalGroupSocialFund = calculatedGroupSocialAmount + groupSocialPreviousBalance;
                  
                  // Calculate interest paid on personal loans
                  const interestPaidOnPersonalLoans = interestRate > 0 && totalLoanAmount > 0 ? 
                    roundToTwoDecimals((totalLoanAmount * (interestRate / 100)) / 12) : 0;
                  
                  // Calculate Total Collection as per new formula
                  const totalCollection = roundToTwoDecimals(
                    totalMonthlyCollection + 
                    estimatedLateFine + 
                    interestPaidOnPersonalLoans + 
                    calculatedLoanInsuranceAmount + 
                    calculatedGroupSocialAmount
                  );
                  
                  // Calculate TOTAL Group Standing with new formula
                  // STANDING = [(Previous Month Balance + Total Collection + Interest Income − Expenses) + Remaining Personal Loan Amount] − Group Social Fund − Loan Insurance Fund
                  const previousMonthBalance = currentCashInHand + currentBalanceInBank;
                  const interestIncome = interestPaidOnPersonalLoans; // Same as interest paid
                  const expenses = 0; // For creation, assume no expenses
                  const remainingPersonalLoanAmount = totalLoanAmount;
                  
                  const totalGroupStanding = roundToTwoDecimals(
                    (previousMonthBalance + totalCollection + interestIncome - expenses) + 
                    remainingPersonalLoanAmount - 
                    totalGroupSocialFund - 
                    totalLoanInsuranceFund
                  );
                  
                  return (
                    <>
                      <div className="bg-white dark:bg-indigo-900/30 p-3 rounded border border-indigo-200 dark:border-indigo-700">
                        <h4 className="font-medium text-indigo-800 dark:text-indigo-200 mb-2">Total Collection Breakdown</h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Monthly Compulsory Contribution:</span>
                            <span>₹{totalMonthlyCollection.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Late Fine:</span>
                            <span>₹{estimatedLateFine.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Interest Paid (Personal Loans):</span>
                            <span>₹{interestPaidOnPersonalLoans.toFixed(2)}</span>
                          </div>
                          {watchedLoanInsuranceEnabled && (
                            <div className="flex justify-between">
                              <span>Loan Insurance ({loanInsurancePercent}%):</span>
                              <span>₹{calculatedLoanInsuranceAmount.toFixed(2)}</span>
                            </div>
                          )}
                          {watchedGroupSocialEnabled && (
                            <div className="flex justify-between">
                              <span>Group Social ({totalFamilyMembers} family members):</span>
                              <span>₹{calculatedGroupSocialAmount.toFixed(2)}</span>
                            </div>
                          )}
                          <hr className="border-indigo-200 dark:border-indigo-600" />
                          <div className="flex justify-between font-semibold">
                            <span>Total Collection:</span>
                            <span>₹{totalCollection.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white dark:bg-indigo-900/30 p-3 rounded border border-indigo-200 dark:border-indigo-700">
                        <h4 className="font-medium text-indigo-800 dark:text-indigo-200 mb-2">TOTAL Group Standing</h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Previous Month Balance:</span>
                            <span>₹{previousMonthBalance.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Collection:</span>
                            <span>₹{totalCollection.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Interest Income:</span>
                            <span>₹{interestIncome.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Expenses:</span>
                            <span>-₹{expenses.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Remaining Personal Loan Amount:</span>
                            <span>₹{remainingPersonalLoanAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-red-600 dark:text-red-400">
                            <span>Total Group Social Fund:</span>
                            <span>-₹{totalGroupSocialFund.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-red-600 dark:text-red-400">
                            <span>Total Loan Insurance Fund:</span>
                            <span>-₹{totalLoanInsuranceFund.toFixed(2)}</span>
                          </div>
                          <hr className="border-indigo-200 dark:border-indigo-600" />
                          <div className="flex justify-between font-semibold text-indigo-800 dark:text-indigo-200">
                            <span>TOTAL Group Standing:</span>
                            <span>₹{totalGroupStanding.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white dark:bg-indigo-900/30 p-3 rounded border border-indigo-200 dark:border-indigo-700">
                        <h4 className="font-medium text-indigo-800 dark:text-indigo-200 mb-2">Fund Details</h4>
                        <div className="space-y-1 text-xs">
                          {watchedLoanInsuranceEnabled && (
                            <>
                              <div className="flex justify-between">
                                <span>Previous LI Fund Balance:</span>
                                <span>₹{loanInsurancePreviousBalance.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Current Period LI:</span>
                                <span>₹{calculatedLoanInsuranceAmount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-medium text-yellow-700 dark:text-yellow-300">
                                <span>Total LI Fund:</span>
                                <span>₹{totalLoanInsuranceFund.toFixed(2)}</span>
                              </div>
                              <hr className="border-indigo-200 dark:border-indigo-600" />
                            </>
                          )}
                          {watchedGroupSocialEnabled && (
                            <>
                              <div className="flex justify-between">
                                <span>Previous GS Fund Balance:</span>
                                <span>₹{groupSocialPreviousBalance.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Current Period GS:</span>
                                <span>₹{calculatedGroupSocialAmount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-medium text-green-700 dark:text-green-300">
                                <span>Total Group Social Fund:</span>
                                <span>₹{totalGroupSocialFund.toFixed(2)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }, [watchedCashInHand, watchedBalanceInBank, watchedGlobalShareAmount, watchedMembers, collectionFrequency, watchedInterestRate, watchedMonthlyContribution, watchedGroupSocialEnabled, watchedGroupSocialAmountPerFamilyMember, watchedLoanInsuranceEnabled, watchedLoanInsurancePercent, watchedGroupSocialPreviousBalance, watchedLoanInsurancePreviousBalance, watchedIncludeDataTillCurrentPeriod, control, errors, memberFields, getShareLabel, setValue, watch]); // Dependencies for useMemo

  // Duplicate function removed - using definition above

  const createMembersFromImport = useCallback(async () => {
    if (importedMembers.length === 0) {
      console.warn('No imported members to create');
      return;
    }
    
    // Prevent duplicate submissions
    if (isCreatingMembers) {
      console.warn('Member creation already in progress');
      return;
    }
    
    console.log(`Starting member creation for ${importedMembers.length} members`);
    console.log('Current step at start:', currentStep);
    console.log('Component mounted:', isMountedRef.current);
    
    setIsCreatingMembers(true);
    setMemberImportStatus("Creating members...");
    setMemberImportError(null);

    try {
      const createdMembers: { id: string; name: string }[] = [];
      const errors: string[] = [];
      
      console.log('Processing members for creation...');
      
      // Check if any members already exist by making a quick API call
      const existingMembersCheck = await Promise.all(
        importedMembers.slice(0, 5).map(async (member) => {
          try {
            const response = await fetch('/api/members', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: member.name,
                email: member.email,
                phone: member.phone,
              }),
            });
            return { name: member.name, exists: response.status === 409 };
          } catch {
            return { name: member.name, exists: false };
          }
        })
      );
      
      const existingCount = existingMembersCheck.filter(m => m.exists).length;
      
      if (existingCount > 0) {
        console.log(`Warning: ${existingCount} out of ${existingMembersCheck.length} sample members already exist`);
        
        // Note: Removed the confirmation dialog to hide the popup when members already exist
        // The import will proceed automatically and only create new members
      }
      
      for (const member of importedMembers) {
        // Note: Removed the skip logic for members with same name as current user
        // We want to create all imported members, including those with same name as group leader

        // Note: Removed the check for existing members in displayableMembers list
        // to allow recreating members that already exist

        try {
          console.log(`Creating member: ${member.name}`);
          const response = await fetch('/api/members?allowDuplicates=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: member.name,
              email: member.email,
              phone: member.phone,
            }),
          });

          console.log(`API response for ${member.name}:`, response.status, response.statusText);

          if (response.ok) {
            const newMember = await response.json();
            console.log(`Successfully created member:`, newMember);
            createdMembers.push({ id: newMember.id, name: newMember.name });
          } else {
            console.log(`Failed response headers:`, response.headers);
            console.log(`Failed response status:`, response.status);
            
            let errorData;
            let errorMessage = 'Unknown error';
            
            try {
              const responseText = await response.text();
              console.log(`Raw response text:`, responseText);
              
              if (responseText) {
                try {
                  errorData = JSON.parse(responseText);
                  
                  // Don't treat "already exists" as an error for logging purposes
                  if (response.status === 409 && errorData.error?.includes('already exists')) {
                    console.log(`Member ${member.name} already exists - skipping`);
                  } else {
                    console.error(`Failed to create member ${member.name}:`, errorData);
                  }
                  
                  errorMessage = errorData.error || errorData.message || 'Unknown error';
                } catch (parseError) {
                  console.error(`Failed to parse error response as JSON:`, parseError);
                  errorMessage = responseText || `HTTP ${response.status}: ${response.statusText}`;
                }
              } else {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
              }
            } catch (textError) {
              console.error(`Failed to read response text:`, textError);
              errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            
            errors.push(`${member.name}: ${errorMessage}`);
          }
        } catch (error) {
          console.error(`Failed to create member ${member.name}:`, error);
          errors.push(`${member.name}: Failed to create`);
        }
      }

      console.log(`Created ${createdMembers.length} members, ${errors.length} errors`);

      // Determine what happened and provide appropriate feedback
      const totalProcessed = createdMembers.length + errors.length;
      const allExisting = errors.length === importedMembers.length && errors.length > 0;
      
      console.log(`Total processed: ${totalProcessed}, All existing: ${allExisting}`);

      // Always proceed to step 3, regardless of whether members were created or already existed
      const shouldNavigateToStep3 = true;

      if (createdMembers.length > 0) {
        console.log(`Successfully created ${createdMembers.length} members`);
        console.log('About to update state and navigate...');
        
        // Immediately update the UI state to show success and navigate
        setMemberImportStatus(`Successfully created ${createdMembers.length} member(s).`);
        
        // Add created members to the displayable members immediately
        console.log('Adding members to displayable list...');
        setDisplayableMembers(prev => {
          const updated = [...prev, ...createdMembers];
          console.log('Updated displayable members:', updated.length);
          return updated;
        });

        // Add created members to the form
        console.log('Adding members to form...');
        createdMembers.forEach(member => {
          const importedMember = importedMembers.find(im => im.name === member.name);
          append({
            memberId: member.id,
            name: member.name,
            currentShare: 0,
            currentLoanAmount: importedMember?.loanAmount || 0,
          });
        });
        
        // Clean up import UI immediately
        console.log('Cleaning up import UI...');
        setImportedMembers([]);
        setShowImportedMembers(false);
        setShowMemberImport(false);
        
        // CRITICAL: Navigate to Step 3 immediately - this must happen synchronously
        console.log('Current step before navigation:', currentStep);
        console.log('Component still mounted:', isMountedRef.current);
        
        // Force immediate step change
        setCurrentStep(3);
        
        // Schedule the async member list refresh for later (non-blocking)
        // TEMPORARILY DISABLED TO TEST NAVIGATION ISSUE
        /*
        if (onMemberCreated && isMountedRef.current) {
          console.log('Scheduling member list refresh...');
          setTimeout(async () => {
            try {
              if (isMountedRef.current) {
                console.log('Refreshing members list after successful creation');
                await onMemberCreated();
                console.log('Members list refresh completed');
              } else {
                console.log('Component unmounted, skipping refresh');
              }
            } catch (error) {
              console.error('Error refreshing members list:', error);
            }
          }, 1000); // Increase delay even more
        }
        */
        console.log('Member refresh callback disabled for testing');
      } else if (allExisting) {
        // All members already exist - this is actually OK, we should still proceed
        console.log('All members already exist in the system');
        setMemberImportStatus(`All ${errors.length} members already exist in the system. Proceeding to assign them to the group.`);
        
        // Clean up import UI 
        console.log('Cleaning up import UI for existing members...');
        setImportedMembers([]);
        setShowImportedMembers(false);
        setShowMemberImport(false);
      } else {
        // Mixed results or other cases
        console.log('Mixed results or other case, still proceeding to step 3');
        setMemberImportStatus(`Processed ${totalProcessed} members: ${createdMembers.length} created, ${errors.length} had issues.`);
        
        // Clean up import UI 
        setImportedMembers([]);
        setShowImportedMembers(false);
        setShowMemberImport(false);
      }

      // ALWAYS navigate to Step 3 regardless of creation results
      if (shouldNavigateToStep3) {
        // Force immediate step change
        setCurrentStep(3);
      }

      // Handle errors with appropriate messaging
      if (errors.length > 0) {
        if (allExisting) {
          setMemberImportError(`Note: All ${errors.length} members already exist in the system.`);
        } else {
          setMemberImportError(`Errors encountered: ${errors.join(', ')}`);
        }
      }

    } catch (error) {
      console.error('Error creating members:', error);
      setMemberImportError('Failed to create members. Please try again.');
      setMemberImportStatus(null);
      
      // Don't clear the UI on error so user can retry
      // setImportedMembers([]);
      // setShowImportedMembers(false);
      // setShowMemberImport(false);
    } finally {
      // Always reset the loading state
      setIsCreatingMembers(false);
    }
  }, [importedMembers, isCreatingMembers, displayableMembers, session?.user?.memberId, session?.user?.name, currentStep, isMountedRef, append]);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex justify-between">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div 
              key={index}
              className={`flex flex-col items-center ${index < currentStep ? 'text-primary' : 'text-muted'}`}
            >
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 
                  ${index + 1 < currentStep ? 'bg-primary text-white' : 
                    index + 1 === currentStep ? 'border-2 border-primary text-primary' : 
                    'border-2 border-muted text-muted'}`}
              >
                {index + 1}
              </div>
              <span className="text-xs">
                {index === 0 ? 'Basic Info' : 
                 index === 1 ? 'Import Members' :
                 index === 2 ? 'Select Members' :
                 'Current Financial Data'}
              </span>
            </div>
          ))}
        </div>
        <div className="relative mt-2">
          <div className="absolute top-0 left-0 h-1 bg-border w-full rounded"></div>
          <div 
            className="absolute top-0 left-0 h-1 bg-primary rounded transition-all duration-300" 
            style={{ width: `${(currentStep - 1) / (totalSteps - 1) * 100}%` }}
          ></div>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-6 bg-red-50 text-red-500 rounded-md border border-red-200">
          {error}
        </div>
      )}

      {success ? (
        <div className="p-6 bg-green-50 text-green-700 rounded-md border border-green-200 mb-6">
          <h3 className="text-lg font-medium mb-2">{success.message}</h3>
          {redirectCountdown !== null && (
            <p className="text-sm text-blue-600 mb-2">
              Redirecting to groups page in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}...
            </p>
          )}
          {recordCreationStatus && <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">{recordCreationStatus}</p>}
          {recordCreationError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{recordCreationError}</p>}
          <p className="mb-4">The group ID is:</p>

          <div className="flex items-center mb-4 p-3 bg-white rounded border border-green-200">
            <span className="font-mono text-lg mr-2">{success.groupId}</span>
            <button
              type="button"
              onClick={copyGroupId}
              className="p-2 text-primary hover:text-primary-dark"
              title="Copy to clipboard"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
              </svg>
            </button>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={() => router.push('/groups?refresh=true')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Go to Groups
            </button>
            {isEditing && groupToEdit && (
                <button
                    type="button"
                    onClick={() => deleteGroup(groupToEdit.id)}
                    className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                    Delete Group
                </button>
            )}
          </div>
        </div>
      ) : (
        <form className="space-y-6"> {/* Removed onSubmit from here */}
          {currentStep === 1 && Step1}
          {currentStep === 2 && Step2}
          {currentStep === 3 && Step3}
          {currentStep === 4 && Step4}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4 border-t">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={goToPreviousStep}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                disabled={isLoading}
              >
                Previous
              </button>
            )}
            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={goToNextStep}
                className="ml-auto px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                disabled={isLoading}
              >
                Next
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSubmit(handleFormSubmit as any)}
                  className="ml-auto px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? (isEditing ? 'Updating Group...' : 'Creating Group...') : (isEditing ? 'Update Group' : 'Create Group')}
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </div>
  );
}