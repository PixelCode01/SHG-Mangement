import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/app/lib/prisma';

// Schema for validating individual member data in the import array
const memberImportSchema = z.object({
  Name: z.string().min(1, 'Member name is required'),
  Email: z.string().email('Invalid email address').optional().nullable(),
  Phone: z.string().optional().nullable(),
  Address: z.string().optional().nullable(),
  LoanAmount: z.number().positive('Loan amount must be positive').optional().nullable(),
});

// Schema for the overall import request body
const importRequestSchema = z.object({
  members: z.array(memberImportSchema).min(1, 'At least one member is required for import'),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();

    // Validate the incoming request body
    const validationResult = importRequestSchema.safeParse(json);
    if (!validationResult.success) {
      console.error('Import Validation Errors:', validationResult.error.errors); // Log detailed errors server-side
      return NextResponse.json(
        {
          error: 'Invalid input data. Please check the file content and format.',
          // Include detailed errors in the response for easier debugging
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { members } = validationResult.data;

    // Prepare data for Prisma's createMany
    const membersToCreate = members.map(member => ({
      name: member.Name,
      email: member.Email || null, // Ensure null if empty/undefined
      phone: member.Phone || null,
      address: member.Address || null,
      currentLoanAmount: member.LoanAmount || null, // Store the current loan amount
    }));

    // Use createMany for bulk insertion
    // Note: createMany with MongoDB doesn't automatically skip duplicates based on @unique constraints in the schema before Prisma 5.x
    // We'll rely on the database potentially throwing an error for duplicates (like email) or accept them if the schema allows.
    // For more robust duplicate handling, you might need to query existing emails first.
    const result = await prisma.member.createMany({
      data: membersToCreate,
      // skipDuplicates: true, // Removed: This option is not supported in the current setup
    });

    return NextResponse.json({ count: result.count }, { status: 201 });

  } catch (error) {
    console.error('Error importing members:', error);
    const typedError = error as Error & { code?: string; meta?: { target?: string[] } };

    // Handle potential Prisma errors (e.g., unique constraint if skipDuplicates wasn't effective or used)
    if (typedError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Import failed due to duplicate entries (e.g., email). Please check your file.', details: typedError.meta?.target },
        { status: 409 } // Conflict
      );
    }

    return NextResponse.json(
      { error: 'Failed to import members', details: typedError.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
