'use client'; // Make this a client component

import Link from 'next/link';
import { Member, Group } from '@prisma/client'; // Keep type imports
import { useState, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import FileProcessingAnimation from '../components/FileProcessingAnimation';

type MemberWithRelations = Member & {
  memberships: {
    group: Pick<Group, 'id' | 'name' | 'groupId'>;
  }[];
  ledGroups: Pick<Group, 'id' | 'name' | 'groupId'>[];
};

// Define the expected structure of a row from the import file
interface MemberImportRow {
  Name: string;
  Email?: string | undefined;
  Phone?: string | undefined;
  'Phone Number'?: string | undefined;
  Address?: string | undefined;
  LoanAmount?: number | undefined;
  'Loan Amount'?: string | undefined; // Support for CSV/Excel column naming
}

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<MemberWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null); // State for delete errors
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set()); // State for selected members

  // State for import functionality
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // --- Selection Handlers ---
  const handleSelectMember = (memberId: string, isSelected: boolean) => {
    setSelectedMemberIds(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (isSelected) {
        newSelected.add(memberId);
      } else {
        newSelected.delete(memberId);
      }
      return newSelected;
    });
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedMemberIds(new Set(members.map(m => m.id)));
    } else {
      setSelectedMemberIds(new Set());
    }
  };

  const isAllSelected = members.length > 0 && selectedMemberIds.size === members.length;
  // --- End Selection Handlers ---

  // --- Delete Member Handler ---
  const handleDelete = async (memberId: string, memberName: string) => {
    setDeleteError(null); // Clear previous delete errors
    if (!confirm(`Are you sure you want to delete the member "${memberName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete member');
      }

      // Remove the member from the local state to update the UI
      setMembers(currentMembers => currentMembers.filter(member => member.id !== memberId));
      // Optionally show a success message or clear status
      setImportStatus(`Member "${memberName}" deleted successfully.`); // Reuse import status for general messages
      setImportError(null); // Clear import error if delete is successful

    } catch (err: unknown) {
      console.error('Delete Error:', err);
      setDeleteError(`Failed to delete member "${memberName}": ${(err as Error).message}`);
      setImportStatus(null); // Clear status on error
    }
  };
  // --- End Delete Member Handler ---

  // --- Batch Delete Handler ---
  const handleBatchDelete = async () => {
    setDeleteError(null);
    setImportStatus(null);
    const memberIdsToDelete = Array.from(selectedMemberIds);
    if (memberIdsToDelete.length === 0) {
      setDeleteError("No members selected for deletion.");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${memberIdsToDelete.length} selected member(s)? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/members/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds: memberIdsToDelete }),
      });

      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        if (response.status === 409) {
          // Conflict case - all selected members were leaders
          setDeleteError(errorResult.error || 'Cannot delete selected members');
          setImportStatus(null);
          return;
        } else {
          throw new Error(errorResult.error || `Server error: ${response.status}`);
        }
      }

      const result = await response.json();

      if (response.ok) {
        // Success case - some or all members deleted
        const deletedIds = memberIdsToDelete.filter(id => 
          !result.skippedLeaders?.some((leader: { id: string }) => leader.id === id)
        );
        
        // Remove only successfully deleted members from local state
        setMembers(currentMembers => 
          currentMembers.filter(member => !deletedIds.includes(member.id))
        );
        
        // Update selection to remove deleted members but keep skipped leaders selected
        setSelectedMemberIds(prevSelected => {
          const newSelected = new Set(prevSelected);
          deletedIds.forEach(id => newSelected.delete(id));
          return newSelected;
        });
        
        // Handle mixed results (some deleted, some skipped)
        if (result.skippedLeaders && result.skippedLeaders.length > 0 && result.deletedCount > 0) {
          // Show success message for deleted members
          setImportStatus(`${result.deletedCount} member(s) deleted successfully.`);
          // Show error message for skipped leaders
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const leaderNames = result.skippedLeaders.map((leader: any) => leader.name).join(', ');
          setDeleteError(`Cannot delete group leaders: ${leaderNames}. Please change the group leader first.`);
        } else {
          // All deleted successfully
          setImportStatus(result.message);
          setDeleteError(null);
        }
      }

    } catch (err: unknown) {
      console.error('Batch Delete Error:', err);
      setDeleteError(`Failed to delete members: ${(err as Error).message}`);
      setImportStatus(null);
    } finally {
      setIsLoading(false);
    }
  };
  // --- End Batch Delete Handler ---

  // Fetch initial members data
  useEffect(() => {
    const fetchMembers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetching data client-side now
        const response = await fetch('/api/members');
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('You need to be logged in to view members. Please log in and try again.');
          }
          throw new Error(`Failed to fetch members (${response.status})`);
        }
        const data = await response.json();
        setMembers(data as MemberWithRelations[]);
      } catch (err: unknown) {
        console.error('Error fetching members:', err);
        setError((err as Error).message || 'Failed to load members. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, []);

  // Configure PDF.js worker dynamically
  useEffect(() => {
    const setupWorker = async () => {
      try {
        // Dynamically import pdfjs-dist
        const pdfjs = await import('pdfjs-dist');
        
        // Set up the worker with different fallback options
        if (typeof window !== 'undefined') {
          // Try multiple worker sources
          const workerSources = [
            '/pdf.worker.mjs',
            `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
            `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
          ];
          
          for (const workerSrc of workerSources) {
            try {
              pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
              console.log(`PDF.js worker configured with: ${workerSrc}`);
              break;
            } catch (workerError) {
              console.warn(`Failed to set worker source ${workerSrc}:`, workerError);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load PDF.js worker:", err);
      }
    };
    setupWorker();
  }, []);

  // --- PDF Parsing Functions ---
  const extractTextFromPDF = async (file: File): Promise<string[]> => {
    try {
      console.log('📄 Starting PDF extraction for:', file.name, 'Size:', file.size, 'bytes');
      
      // Dynamically import getDocument
      const { getDocument } = await import('pdfjs-dist');
      
      // Create array buffer from file for better compatibility
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      console.log('🔍 Loading PDF document...');
      const loadingTask = getDocument({
        data: uint8Array,
        standardFontDataUrl: `https://unpkg.com/pdfjs-dist@5.2.133/standard_fonts/`,
        cMapUrl: `https://unpkg.com/pdfjs-dist@5.2.133/cmaps/`,
        cMapPacked: true
      });
      
      const pdf = await loadingTask.promise;
      console.log(`📊 PDF loaded successfully. Pages: ${pdf.numPages}`);
      
      const textArray: string[] = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        console.log(`📖 Processing page ${i}/${pdf.numPages}`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items?.map(item => {
          if ('str' in item) {
            return item.str || '';
          }
          return '';
        }).join(' ') || '';
        
        if (pageText.trim()) {
          textArray.push(pageText);
          console.log(`✅ Page ${i} extracted: ${pageText.length} characters`);
        } else {
          console.log(`⚠️ Page ${i} appears to be empty`);
        }
      }
      
      console.log(`🎯 PDF extraction complete. Total pages with text: ${textArray.length}`);
      return textArray;
      
    } catch (pdfError) {
      console.error("❌ PDF.js extraction failed:", pdfError);
      console.log("🔄 Attempting fallback extraction method...");
      
      try {
        // Try fallback method using server-side pdf-parse
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/pdf-parse', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`Fallback API failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.pages) {
          console.log("✅ Fallback extraction successful!");
          return result.pages;
        } else {
          throw new Error(result.error || 'Fallback extraction failed');
        }
        
      } catch (fallbackError) {
        console.error("❌ Fallback extraction also failed:", fallbackError);
        
        // Provide more specific error messages
        if (pdfError instanceof Error) {
          if (pdfError.message.includes('Invalid PDF structure')) {
            throw new Error("The PDF file appears to be corrupted or has an invalid structure.");
          } else if (pdfError.message.includes('password')) {
            throw new Error("The PDF file is password-protected. Please provide an unprotected version.");
          } else if (pdfError.message.includes('worker')) {
            throw new Error("PDF processing failed due to worker configuration. Please refresh the page and try again.");
          }
        }
        
        throw new Error("Could not read the PDF file with any available method. Please check if the file is a valid PDF and try again.");
      }
    }
  };

  const parsePDFDataToMembers = (textArray: string[]): MemberImportRow[] => {
    console.log("Starting PDF parsing. Number of pages extracted:", textArray.length);
    console.log("Raw text from PDF pages:", textArray);
    const members: MemberImportRow[] = [];
    
    // Enhanced regex patterns for different table structures
    // Pattern 1: Standard table format with columns (ID/SL Name Amount)
    const tableRowRegex = /\s*(?:(?:\d+)|(?:[A-Za-z]+))\s+([A-Za-z][A-Za-z\s.\'-]+[A-Za-z])\s+(\d[\d,.]*)(?:\s+([^\s]+)?)?(?:\s+([^\s]+)?)?/g;
    
    // Pattern 2: For PDF tables with clear column structure (usually exported from spreadsheets)
    const structuredTableRegex = /\b([A-Za-z][A-Za-z\s.\'-]+[A-Za-z])\s*,?\s*(\d[\d,.]*)\s*(?:,?\s*([^,\n\d+@[^,\n\s]+))?\s*(?:,?\s*(\+?\d[\d\s-]+))?/g;
    
    // Pattern 3: Looser pattern for less structured tables - attempt to find name-amount pairs
    const looseTableRegex = /([A-Za-z][A-Za-z\s.\'-]+[A-Za-z])\s*[:=-]?\s*(?:Rs\.?|₹|INR|$)?\s*(\d[\d,.]*)/gi;
    
    // Pattern 4: For handling special format where names and amounts may be on separate lines
    // First collect all names and numeric values, then pair them
    const separatedLinesHandler = (text: string): MemberImportRow[] => {
      console.log("🔄 separatedLinesHandler called with text length:", text.length);
      const separatedMembers: MemberImportRow[] = [];
      
      // Look for the structure: NAME section followed by LOAN section
      const nameHeaderMatch = /^NAME\s*$/im.exec(text);
      const loanHeaderMatch = /^LOAN\s*$/im.exec(text);
      
      console.log("🔍 NAME header match:", nameHeaderMatch ? `found at ${nameHeaderMatch.index}` : "not found");
      console.log("🔍 LOAN header match:", loanHeaderMatch ? `found at ${loanHeaderMatch.index}` : "not found");
      
      if (!nameHeaderMatch || !loanHeaderMatch) {
        console.log('❌ Could not find NAME and LOAN headers for separated lines format');
        // Let's try a more flexible search
        const flexibleNameMatch = /NAME/i.exec(text);
        const flexibleLoanMatch = /LOAN/i.exec(text);
        console.log("🔍 Flexible NAME search:", flexibleNameMatch ? `found at ${flexibleNameMatch.index}` : "not found");
        console.log("🔍 Flexible LOAN search:", flexibleLoanMatch ? `found at ${flexibleLoanMatch.index}` : "not found");
        
        // Try even more flexible approach if exact match fails
        if (flexibleNameMatch && flexibleLoanMatch) {
          console.log("📝 Using flexible header matching");
          return handleFlexibleSeparatedFormat(text);
        }
        
        return []; // Can't find the headers we need
      }
      
      console.log(`Found NAME header at position ${nameHeaderMatch.index} and LOAN header at position ${loanHeaderMatch.index}`);
      
      // Split text into sections
      const lines = text?.split(/\r?\n/) || [];
      
      // Find the line numbers for headers
      let nameHeaderLine = -1;
      let loanHeaderLine = -1;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim() || '';
        if (line === 'NAME') {
          nameHeaderLine = i;
        } else if (line === 'LOAN') {
          loanHeaderLine = i;
        }
      }
      
      if (nameHeaderLine === -1 || loanHeaderLine === -1) {
        console.log('Could not find NAME and LOAN header lines');
        return [];
      }
      
      console.log(`NAME header on line ${nameHeaderLine + 1}, LOAN header on line ${loanHeaderLine + 1}`);
      
      // Extract names (between NAME header and LOAN header)
      const names: string[] = [];
      for (let i = nameHeaderLine + 1; i < loanHeaderLine; i++) {
        const line = lines[i]?.trim() || '';
        if (line.length > 0 && /^[A-Z][A-Z\s\.]+$/.test(line)) {
          names.push(line);
          console.log(`Extracted name: "${line}"`);
        }
      }
      
      // Extract amounts (after LOAN header)
      const amounts: number[] = [];
      for (let i = loanHeaderLine + 1; i < lines.length; i++) {
        const line = lines[i]?.trim() || '';
        // Stop if we hit another section header or names again
        if (/^[A-Z][A-Z\s\.]+$/.test(line) && line.length > 10) {
          break;
        }
        
        if (/^\d+$/.test(line)) {
          const amount = parseInt(line);
          if (amount >= 0) { // Allow 0 amounts
            amounts.push(amount);
            console.log(`Extracted amount: ${amount}`);
          }
        }
      }
      
      console.log(`Found ${names.length} names and ${amounts.length} amounts`);
      
      // Pair names with amounts
      const count = Math.min(names.length, amounts.length);
      for (let i = 0; i < count; i++) {
        const name = names[i];
        const amount = amounts[i];
        if (name && amount !== undefined) {
          separatedMembers.push({
            Name: name,
            LoanAmount: amount,
            Email: undefined,
            Phone: undefined,
            Address: undefined
          });
          console.log(`Paired: "${name}" -> ${amount}`);
        }
      }
      
      return separatedMembers;
    };

    // Pattern 5: For handling irregularly spaced names and amounts on the same line
    const irregularSpacingHandler = (text: string): MemberImportRow[] => {
      const irregularMembers: MemberImportRow[] = [];
      
      // Check for NAME and LOAN header pattern
      const headerMatch = /NAME\s+LOAN/i.exec(text);
      if (!headerMatch) {
        return []; // Header pattern not found
      }
      
      console.log("Found NAME LOAN header pattern - processing with irregularSpacingHandler");
      
      // Split by lines to process each row
      const lines = text.split(/\r?\n/);
      let headerLineIndex = -1;
      
      // Find the header line
      lines.forEach((line, index) => {
        if (/NAME\s+LOAN/i.test(line)) {
          headerLineIndex = index;
        }
      });
      
      if (headerLineIndex < 0) {
        return []; // Couldn't find the header line
      }
      
      // Process data lines (after header)
      for (let i = headerLineIndex + 1; i < lines.length; i++) {
        const line = lines[i]?.trim() || '';
        if (!line) continue; // Skip empty lines
        
        // Match a name followed by a number with irregular spacing between
        // This pattern looks for uppercase names followed by digits
        const irregularPattern = /([A-Z][A-Z\s\.\-\']+[A-Z])\s+(\d[\d,\.]*)/;
        const match = irregularPattern.exec(line);
        
        if (match?.[1] && match[2]) {
          const name = match[1].trim();
          let loanAmount = 0;
          
          try {
            // Clean and parse the loan amount
            const amountStr = match[2].replace(/[,\s]/g, '');
            loanAmount = parseFloat(amountStr);
            
            if (name.length > 3 && !isNaN(loanAmount) && loanAmount > 0) {
              console.log(`Irregular format - Found name: "${name}", amount: ${loanAmount}`);
              irregularMembers.push({
                Name: name,
                LoanAmount: loanAmount,
                Email: undefined,
                Phone: undefined,
                Address: undefined
              });
            }
          } catch {
            console.log(`Failed to parse amount in line: ${line}`);
          }
        } 
        // Try alternative pattern where amounts might be numeric only without currency symbols
        else {
          // First find the name part (uppercase letters with spaces)
          const namePattern = /([A-Z][A-Z\s\.\-\']+[A-Z])/;
          const nameMatch = namePattern.exec(line);
          
          if (nameMatch) {
            const name = nameMatch[0].trim();
            // Look for any numbers after the name
            const amountPattern = /\s+(\d[\d,\.]*)\s*$/;
            const amountMatch = amountPattern.exec(line.substring(nameMatch.index + name.length));
            
            if (amountMatch?.[1]) {
              try {
                const amountStr = amountMatch[1].replace(/[,\s]/g, '');
                const loanAmount = parseFloat(amountStr);
                
                if (name.length > 3 && !isNaN(loanAmount) && loanAmount > 0) {
                  console.log(`Irregular format (alternative) - Found name: "${name}", amount: ${loanAmount}`);
                  irregularMembers.push({
                    Name: name,
                    LoanAmount: loanAmount,
                    Email: undefined,
                    Phone: undefined,
                    Address: undefined
                  });
                }
              } catch {
                console.log(`Failed to parse amount in line: ${line}`);
              }
            }
          }
        }
      }
      
      console.log(`Irregular spacing handler found ${irregularMembers.length} members`);
      return irregularMembers;
    };

    let patternsMatched = 0;
    let namesExtracted = 0;
    let loanAmountsExtracted = 0;
    let emailsExtracted = 0;
    let phonesExtracted = 0;

    // Store potential header row to detect column order
    let potentialHeaders = '';
    let headerFound = false;
    
    // Try to detect column headers to understand the table structure
    const detectHeaders = (text: string): string[] | null => {
      // Case insensitive search for common header patterns
      const headerPatterns = [
        /name.*(?:loan|amount)/i,
        /(?:sl\.?|serial).*name.*amount/i,
        /member.*details?.*amount/i
      ];
      
      for (const pattern of headerPatterns) {
        if (pattern.test(text)) {
          // Found a header row, extract it
          return text.split(/\s+/).filter(word => word.trim().length > 0);
        }
      }
      return null;
    };

    textArray.forEach((pageText, pageIndex) => {
      console.log(`Processing Page ${pageIndex + 1} Text (first 500 chars):`, pageText.substring(0, 500));
      
      // Try to detect headers if we haven't found them yet
      if (!headerFound) {
        const headers = detectHeaders(pageText.substring(0, 500));
        if (headers) {
          headerFound = true;
          potentialHeaders = headers.join(' ').toLowerCase();
          console.log("Detected header structure:", potentialHeaders);
        }
      }
      
      // First try handling the special formats when we detect NAME and LOAN headers
      if (pageText.includes("NAME") && pageText.includes("LOAN")) {
        console.log("🔍 Found NAME and LOAN headers in page text");
        console.log("📝 Page text sample:", pageText.substring(0, 200));
        
        // First try separated lines format (names in one section, amounts in another)
        const separatedMembers = separatedLinesHandler(pageText);
        console.log(`🧪 separatedLinesHandler returned ${separatedMembers.length} members`);
        
        if (separatedMembers.length > 0) {
          console.log(`Pattern 4 - Extracted ${separatedMembers.length} members from separate lines format`);
          members.push(...separatedMembers);
          namesExtracted += separatedMembers.length;
          loanAmountsExtracted += separatedMembers.length;
        } else {
          console.log("⚠️ separatedLinesHandler found no members, trying irregular spacing format");
          
          // If separated lines didn't work, try irregular spacing format
          const irregularMembers = irregularSpacingHandler(pageText);
          console.log(`🧪 irregularSpacingHandler returned ${irregularMembers.length} members`);
          
          if (irregularMembers.length > 0) {
            console.log(`Pattern 5 - Extracted ${irregularMembers.length} members from irregular spacing format`);
            members.push(...irregularMembers);
            namesExtracted += irregularMembers.length;
            loanAmountsExtracted += irregularMembers.length;
          } else {
            console.log("⚠️ No members found with special format handlers");
          }
        }
      } else {
        console.log("❌ NAME and/or LOAN headers not found in page text");
        console.log("📝 Page text sample:", pageText.substring(0, 200));
      }
      
      // Function to clean and extract numeric amount from string
      const extractAmount = (amountStr: string): number => {
        const cleanedAmount = amountStr.replace(/[,\s]/g, '');
        const numericAmount = parseFloat(cleanedAmount);
        return isNaN(numericAmount) ? 0 : numericAmount;
      };

      // If special format didn't work, try the standard patterns
      
      // Try the first pattern (most structured)
      let matches = 0;
      let match;
      while ((match = tableRowRegex.exec(pageText)) !== null) {
        patternsMatched++;
        matches++;
        
        const name = match[1] ? match[1].trim() : '';
        const loanAmount = match[2] ? extractAmount(match[2]) : 0;
        const email = match[3]?.includes('@') ? match[3].trim() : undefined;
        const phone = match[4] && /\d/.test(match[4]) ? match[4].trim() : undefined;
        
        if (name && name.length > 1 && loanAmount > 0) {
          namesExtracted++;
          loanAmountsExtracted++;
          if (email) emailsExtracted++;
          if (phone) phonesExtracted++;
          
          members.push({
            Name: name,
            LoanAmount: loanAmount,
            Email: email,
            Phone: phone,
            Address: undefined,
          });
          console.log(`Pattern 1 - Extracted: Name="${name}", Loan=${loanAmount}`);
        }
      }

      // If first pattern didn't match much, try the second pattern
      if (matches < 2) {
        while ((match = structuredTableRegex.exec(pageText)) !== null) {
          patternsMatched++;
          
          const name = match[1] ? match[1].trim() : '';
          const loanAmount = match[2] ? extractAmount(match[2]) : 0;
          const email = match[3] ? match[3].trim() : undefined;
          const phone = match[4] ? match[4].trim() : undefined;
          
          if (name && name.length > 1 && loanAmount > 0) {
            namesExtracted++;
            loanAmountsExtracted++;
            if (email) emailsExtracted++;
            if (phone) phonesExtracted++;
            
            members.push({
              Name: name,
              LoanAmount: loanAmount,
              Email: email,
              Phone: phone,
              Address: undefined,
            });
            console.log(`Pattern 2 - Extracted: Name="${name}", Loan=${loanAmount}`);
          }
        }
      }
      
      // If we still don't have many matches, try the looser pattern as a fallback
      if (members.length < 2) {
        while ((match = looseTableRegex.exec(pageText)) !== null) {
          patternsMatched++;
          
          const name = match[1] ? match[1].trim() : '';
          const loanAmount = match[2] ? extractAmount(match[2]) : 0;
          
          // Looser pattern only gets name and amount
          if (name && name.length > 1 && loanAmount > 0) {
            namesExtracted++;
            loanAmountsExtracted++;
            
            members.push({
              Name: name,
              LoanAmount: loanAmount,
              Email: undefined,
              Phone: undefined,
              Address: undefined,
            });
            console.log(`Pattern 3 - Extracted: Name="${name}", Loan=${loanAmount}`);
          }
        }
      }
    });

    console.log(`PDF Parsing Finished. Patterns matched: ${patternsMatched}, Names extracted: ${namesExtracted}, Loan amounts: ${loanAmountsExtracted}, Emails: ${emailsExtracted}, Phones: ${phonesExtracted}`);

    // Remove potential duplicates based on the extracted Name
    const uniqueMembersMap = new Map<string, MemberImportRow>();
    members.forEach(m => {
        const lowerCaseName = m.Name.toLowerCase();
        if (!uniqueMembersMap.has(lowerCaseName)) {
            uniqueMembersMap.set(lowerCaseName, m);
        } else {
            const existing = uniqueMembersMap.get(lowerCaseName);
            if (!existing) return;
            // If the new entry has values that the existing one doesn't, merge them
            if (m.LoanAmount && !existing.LoanAmount) {
                existing.LoanAmount = m.LoanAmount;
            }
            if (m.Email && !existing.Email) {
                existing.Email = m.Email;
            }
            if (m.Phone && !existing.Phone) {
                existing.Phone = m.Phone;
            }
            console.log(`Duplicate name found and merged: "${m.Name}"`);
        }
    });
    const uniqueMembers = Array.from(uniqueMembersMap.values());
    console.log(`Unique members count after deduplication: ${uniqueMembers.length}`);

    // Log if still no members found after parsing attempt
    if (uniqueMembers.length === 0 && textArray.some((text: string) => text.trim().length > 0)) {
        console.warn("PDF Parsing: No member names could be extracted. Review the PDF structure and the parsing logic/regex. Extracted text sample (first 500 chars):", textArray.join('\n').substring(0, 500));
    }

    return uniqueMembers;
  };
  // --- End PDF Parsing Functions ---

  // --- File Processing States ---
  const [processingStage, setProcessingStage] = useState<number>(0);
  const [isProcessingAnimation, setIsProcessingAnimation] = useState<boolean>(false);
  
  // --- File Import Handler ---
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    // Debug animation state before processing
    console.log(`🔄 Animation state before import: isProcessingAnimation=${isProcessingAnimation}, stage=${processingStage}`);
    
    const file = event.target.files?.[0];
    if (!file) {
      setImportError("No file selected.");
      setImportStatus(null);
      return;
    }

    const fileType = file.type;
    console.log(`📂 File uploaded: "${file.name}" (${file.size} bytes) with type: "${fileType}"`);
    
    // PDF files sometimes have incorrect MIME types, check extension as well
    const isPDF = fileType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isCSV = fileType === 'text/csv' || file.name.toLowerCase().endsWith('.csv');
    
    if (!isPDF && !isCSV) {
      setImportError("Invalid file type. Please upload a CSV or PDF file.");
      setImportStatus(null);
      event.target.value = ''; // Reset file input
      return;
    }

    // First reset all states
    setImportError(null);
    setImportStatus("Processing file...");
    setIsImporting(true);
    
    // Explicitly reset animation state first to ensure clean start
    setIsProcessingAnimation(false);
    setProcessingStage(0);
    
    // Add a small delay to ensure reset completes
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Now start the animation
    console.log("🚀 Starting import animation");
    setIsProcessingAnimation(true);
    
    // Add a small delay to ensure state is updated and component has time to render
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      let importedMembers: MemberImportRow[] = [];
      
      // Stage 1: Loading document - Common for all file types
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate loading time

      if (fileType === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
        console.log("📊 Processing CSV file");
        // Stage 2: Analyzing CSV structure
        setProcessingStage(1);
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Stage 3: Extracting data
        setProcessingStage(2);
        await new Promise<void>((resolve, reject) => {
          Papa.parse<MemberImportRow>(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: header => header.trim(),
            complete: (results) => {
              if (results.errors.length > 0) {
                console.error('CSV Parsing Errors:', results.errors);
                const errorSample = results.errors.slice(0, 3).map(e => `Row ${e.row}: ${e.message}`).join('; ');
                reject(new Error(`CSV parsing errors occurred. Example: ${errorSample}`));
                return;
              }
              if (!results.meta.fields?.includes('Name')) {
                 reject(new Error("CSV file must contain a 'Name' column."));
                 return;
              }
              importedMembers = results.data.filter(row => row.Name);
              resolve();
            },
            error: (error) => reject(error),
          });
        });
        
        // Stage 4: Validating data format
        setProcessingStage(3);
        await new Promise(resolve => setTimeout(resolve, 600));
        
      } else if (fileType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        console.log("🔍 Processing PDF file");
        // Stage 1: Loading document
        const textArray = await extractTextFromPDF(file);
        
        // Stage 2: Analyzing text structure
        setProcessingStage(1);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Stage 3: Extracting member data
        setProcessingStage(2);
        importedMembers = parsePDFDataToMembers(textArray);
        
        // Stage 4: Validating data format
        setProcessingStage(3);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      // Stage 5: Preparing results (common for all file types)
      setProcessingStage(4);
      await new Promise(resolve => setTimeout(resolve, 800));

      // Complete processing animation
      console.log("Setting isProcessingAnimation to FALSE");
      setIsProcessingAnimation(false);
      
      // Handle case when no members were found
      if (importedMembers.length === 0) {
        setImportError("No valid member data found in the file. Please check the file format and content.");
        setImportStatus(null);
        setIsImporting(false);
        event.target.value = '';
        return;
      }

      // --- Data Cleaning Step --- 
      const cleanedMembers = importedMembers.map(member => {
        // Handle loan amount from various formats
        let loanAmount: number | null = null;
        
        // Check if we have a numeric LoanAmount from PDF parsing
        if (typeof member.LoanAmount === 'number' && !isNaN(member.LoanAmount)) {
          loanAmount = member.LoanAmount;
        } 
        // Try to extract from 'Loan Amount' string format (from CSV/Excel)
        else if (member['Loan Amount']) {
          const cleaned = member['Loan Amount'].replace(/[^\d.]/g, '');
          const parsed = parseFloat(cleaned);
          loanAmount = !isNaN(parsed) ? parsed : null;
        }
        
        return {
          ...member,
          // Ensure empty string emails become null to satisfy the API schema
          Email: member.Email?.trim() === '' ? null : member.Email?.trim() || null,
          // Also trim other optional fields or set to null if empty
          Phone: member.Phone?.trim() === '' ? null : member.Phone?.trim() || null,
          Address: member.Address?.trim() === '' ? null : member.Address?.trim() || null,
          // Add the loan amount
          LoanAmount: loanAmount,
        };
      });
      // --- End Data Cleaning Step ---
      
      // Double check that the animation is turned off before proceeding to API call
      if (isProcessingAnimation) {
        console.log("Animation still running - turning off before API call");
        setIsProcessingAnimation(false);
      }

      // Send CLEANED data to the backend API
      setImportStatus(`Importing ${cleanedMembers.length} members...`);
      const response = await fetch('/api/members/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Use the cleaned data
        body: JSON.stringify({ members: cleanedMembers }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Include details from the API response in the error message
        const errorDetails = result.details ? JSON.stringify(result.details) : '';
        throw new Error(`${result.error || 'Failed to import members'}${errorDetails ? `: ${errorDetails}` : ''}`);
      }

      setImportStatus(`Successfully imported ${result.count || 0} members.`);
      setImportError(null);
      router.refresh();
      const updatedResponse = await fetch('/api/members');
      const updatedData = await updatedResponse.json();
      setMembers(updatedData as MemberWithRelations[]);

    } catch (error: unknown) {
      console.error("❌ Import Error:", error);
      
      // Provide user-friendly error messages based on error type
      let userMessage = "Import failed: ";
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('worker') || errorMsg.includes('pdf.js')) {
          userMessage += "PDF processing failed. This might be due to browser compatibility or PDF format issues. Please try refreshing the page and upload again.";
        } else if (errorMsg.includes('corrupted') || errorMsg.includes('invalid pdf')) {
          userMessage += "The PDF file appears to be corrupted or has an invalid format. Please try a different PDF file.";
        } else if (errorMsg.includes('password')) {
          userMessage += "The PDF file is password-protected. Please provide an unprotected version.";
        } else if (errorMsg.includes('no valid member')) {
          userMessage += "No member data was found in the file. Please ensure the file contains member names and loan amounts in the expected format.";
        } else if (errorMsg.includes('csv parsing')) {
          userMessage += "There was an error parsing the CSV file. Please check the file format and try again.";
        } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
          userMessage += "Network error occurred. Please check your connection and try again.";
        } else {
          userMessage += error.message || "An unexpected error occurred. Please try again.";
        }
      } else {
        userMessage += "An unexpected error occurred. Please try again.";
      }
      
      setImportError(userMessage);
      setImportStatus(null);
      
      // Make sure animation is always turned off on error
      console.log("🛑 Setting isProcessingAnimation to FALSE (error case)");
      setIsProcessingAnimation(false);
      setProcessingStage(0);
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };
  // --- End File Import Handler ---

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex justify-center items-center mb-4">
          <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p className="text-muted text-xl">Loading members...</p>
      </div>
    );
  }

  if (error) {
     return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 dark:bg-red-900/20 p-8 rounded-lg border border-red-200 dark:border-red-700/50 text-center shadow-xl">
          <div className="flex justify-center items-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-red-700 dark:text-red-300 font-semibold text-2xl">Oops! Something went wrong.</p>
          <p className="text-red-600 dark:text-red-400 mt-2 text-base">Error loading members: {error}</p>
           <button
            onClick={() => window.location.reload()} 
            className="btn-secondary mt-6 text-sm bg-red-100 dark:bg-red-700/50 dark:hover:bg-red-600/50 dark:text-red-300 dark:border-red-500/50"
          >
            Retry Loading
          </button>
        </div>
      </div>
     );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-6 mb-10 pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Members</h1>
          <p className="text-sm text-muted mt-1">
            Manage all members in your organization.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full sm:w-auto">
          <div className="flex flex-col items-start w-full sm:w-auto">
            <label htmlFor="memberImport" className="block text-sm font-medium text-muted mb-1">
              Import Members (CSV/PDF)
            </label>
            <input
              type="file"
              id="memberImport"
              accept=".csv,application/pdf"
              onChange={handleFileChange}
              className="input-field file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed w-full"
              disabled={isImporting}
            />
            {importStatus && <p className="mt-1 text-sm text-green-600 dark:text-green-400">{importStatus}</p>}
            {importError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{importError}</p>}
            
            {/* Animation component - rendered with a key to force re-render */}
            <div className="mt-3 mb-3 w-full border-2 border-blue-100 p-1 rounded-md">
              {isProcessingAnimation ? (
                <>
                  {/* Adding key to force re-renders when animation starts */}
                  <FileProcessingAnimation 
                    key={`processing-animation-${Date.now()}`}
                    isProcessing={isProcessingAnimation} 
                    currentStage={processingStage} 
                  />
                  <p className="text-xs text-center text-primary mt-1">
                    Processing file...
                  </p>
                </>
              ) : (
                <div className="p-2 text-sm text-gray-400">File processing animation will appear here</div>
              )}
            </div>
            {/* Simple processing indicator as fallback (should not be needed now) */}
            <p className="mt-1 text-xs text-muted">CSV/PDF columns: Name, Email?, Phone?, Address?</p>
          </div>

          <Link
            href="/members/create"
            className="btn-primary mt-2 sm:mt-0 self-start sm:self-center w-full sm:w-auto justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Member
          </Link>
        </div>
      </div>

      {/* Display Delete Error */}
      {deleteError && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 p-4 rounded-md border border-red-200 dark:border-red-700/50">
          <p className="text-red-600 dark:text-red-400">{deleteError}</p>
        </div>
      )}

      {/* Batch Action Button */} 
      {selectedMemberIds.size > 0 && (
        <div className="mb-4 flex justify-start">
          <button
            onClick={handleBatchDelete}
            className="btn-secondary bg-red-600 hover:bg-red-700 text-white dark:bg-red-500 dark:hover:bg-red-600 dark:border-red-500 dark:hover:border-red-600 disabled:opacity-50"
            disabled={isLoading || isImporting} 
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Selected ({selectedMemberIds.size})
          </button>
        </div>
      )}

      {members.length === 0 && !isLoading ? (
        <div className="card p-12 text-center">
          <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto mb-5 ring-4 ring-primary/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No members found</h2>
          <p className="text-muted mb-6">Add your first member or import a list to get started.</p>
          <Link href="/members/create" className="btn-primary">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Your First Member
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/5 dark:bg-muted/10">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      aria-label="Select all members"
                    />
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Email</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Phone</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Groups</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Leads</th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {members.map((member) => (
                  <tr key={member.id} className={`hover:bg-hover transition-colors ${selectedMemberIds.has(member.id) ? 'bg-primary/10' : ''}`}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedMemberIds.has(member.id)}
                        onChange={(e) => handleSelectMember(member.id, e.target.checked)}
                        aria-labelledby={`member-name-${member.id}`}
                      />
                    </td>
                    <td id={`member-name-${member.id}`} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      <Link
                        href={`/members/${member.id}`}
                        className="text-primary hover:text-primary-dark transition-colors"
                      >
                        {member.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {member.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {member.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      <div className="flex flex-wrap gap-1">
                        {(member.memberships?.length || 0) > 0 ? (
                          member.memberships.map((membership) => (
                            <Link
                              key={membership.group.id}
                              href={`/groups/${membership.group.id}`}
                              className="badge-secondary"
                              title={membership.group.groupId}
                            >
                              {membership.group.name}
                            </Link>
                          ))
                        ) : (
                          <span className="text-xs text-muted italic">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      <div className="flex flex-wrap gap-1">
                        {(member.ledGroups?.length || 0) > 0 ? (
                          member.ledGroups.map((group) => (
                            <Link
                              key={group.id}
                              href={`/groups/${group.id}`}
                              className="badge-success"
                              title={group.groupId}
                            >
                              {group.name}
                            </Link>
                          ))
                        ) : (
                          <span className="text-xs text-muted italic">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-1">
                        <Link
                          href={`/members/${member.id}/edit`}
                          className="btn-icon"
                          title="Edit member"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <Link
                          href={`/members/${member.id}`}
                          className="btn-icon"
                          title="View member"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDelete(member.id, member.name)}
                          className="btn-icon text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
                          title="Delete member"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Flexible handler for separated format when exact header matching fails
const handleFlexibleSeparatedFormat = (text: string): MemberImportRow[] => {
  console.log("🔧 Using flexible separated format handler");
  const flexibleMembers: MemberImportRow[] = [];
  
  const lines = text.split(/\r?\n/);
  console.log(`📝 Processing ${lines.length} lines`);
  
  // Find which lines contain NAME and LOAN
  let nameLineIndex = -1;
  let loanLineIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    if (line === 'NAME') {
      nameLineIndex = i;
      console.log(`📍 Found NAME header at line ${i + 1}`);
    } else if (line === 'LOAN') {
      loanLineIndex = i;
      console.log(`📍 Found LOAN header at line ${i + 1}`);
    }
  }
  
  if (nameLineIndex === -1 || loanLineIndex === -1) {
    console.log('❌ Could not find NAME and LOAN header lines');
    return [];
  }
  
  // Extract names (between NAME and LOAN headers)
  const names: string[] = [];
  for (let i = nameLineIndex + 1; i < loanLineIndex; i++) {
    const line = lines[i]?.trim() || '';
    if (line.length > 0) {
      names.push(line);
      console.log(`📛 Extracted name: "${line}"`);
    }
  }
  
  // Extract amounts (after LOAN header)
  const amounts: number[] = [];
  for (let i = loanLineIndex + 1; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    
    // Stop if we hit another section with names (like additional members)
    if (/^[A-Z][A-Z\s\.]+$/.test(line) && line.length > 10) {
      console.log(`🛑 Stopping at line "${line}" - looks like more names`);
      break;
    }
    
    if (/^\d+$/.test(line)) {
      const amount = parseInt(line);
      if (amount >= 0) {
        amounts.push(amount);
        console.log(`💰 Extracted amount: ${amount}`);
      }
    }
  }
  
  console.log(`🔢 Found ${names.length} names and ${amounts.length} amounts`);
  
  // Pair names with amounts
  const count = Math.min(names.length, amounts.length);
  for (let i = 0; i < count; i++) {
    const name = names[i];
    const amount = amounts[i];
    if (name && amount !== undefined) {
      flexibleMembers.push({
        Name: name,
        LoanAmount: amount,
        Email: undefined,
        Phone: undefined,
        Address: undefined
      });
      console.log(`✅ Paired: "${name}" -> ${amount}`);
    }
  }
  
  return flexibleMembers;
};