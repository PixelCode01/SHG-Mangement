import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client'; // Added import for Prisma namespace

// Zod schema for validating the update request body for a GroupPeriodicRecord
const updateGroupPeriodicRecordSchema = z.object({
  meetingDate: z.string().datetime().optional(),
  recordSequenceNumber: z.number().int().positive().optional().nullable(),
  totalCollectionThisPeriod: z.number().optional().nullable(),
  standingAtStartOfPeriod: z.number().optional().nullable(),
  cashInBankAtEndOfPeriod: z.number().optional().nullable(),
  cashInHandAtEndOfPeriod: z.number().optional().nullable(),
  expensesThisPeriod: z.number().optional().nullable(),
  totalGroupStandingAtEndOfPeriod: z.number().optional().nullable(),
  interestEarnedThisPeriod: z.number().optional().nullable(),
  newContributionsThisPeriod: z.number().optional().nullable(),
  loanProcessingFeesCollectedThisPeriod: z.number().optional().nullable(),
  lateFinesCollectedThisPeriod: z.number().optional().nullable(),
  newMembersJoinedThisPeriod: z.number().int().optional().nullable(),
  sharePerMemberThisPeriod: z.number().nonnegative().optional().nullable(),
  memberRecords: z.array(z.object({
    id: z.string().optional(),
    memberId: z.string(),
    memberName: z.string().optional(),
    compulsoryContribution: z.number().optional().nullable(),
    loanRepaymentPrincipal: z.number().optional().nullable(),
    lateFinePaid: z.number().optional().nullable(),
  })).optional(),
});

// GET /api/groups/{groupId}/periodic-records/{recordId}
export async function GET(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string; recordId: string }> }
) {
  const params = await paramsPromise;
  const { id: groupId, recordId } = params;
  if (!groupId || !recordId) {
    return NextResponse.json({ error: 'Group ID and Record ID are required' }, { status: 400 });
  }

  try {
    const record = await prisma.groupPeriodicRecord.findUnique({ // Corrected: groupPeriodicRecord
      where: {
        id: recordId,
        groupId: groupId,
      },
      include: {
        memberRecords: {
          include: {
            member: {
              include: {
                loans: {
                  where: {
                    groupId: groupId,
                    status: 'ACTIVE' // Only active loans
                  }
                },
                memberships: {
                  where: {
                    groupId: groupId
                  }
                }
              }
            }, // Include member details, active loans, and membership data
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Periodic record not found' }, { status: 404 });
    }

    // Process the record to include calculated loan balances and member names
    const processedRecord = {
      ...record,
      memberRecords: record.memberRecords.map(memberRecord => {
        // Get the initial loan amount from the membership data for this group
        const membership = memberRecord.member?.memberships?.find(m => m.groupId === groupId);
        const memberLoanAmount = membership?.currentLoanAmount || 0;

        return {
          ...memberRecord,
          memberName: memberRecord.member?.name || memberRecord.memberId,
          memberCurrentLoanBalance: memberLoanAmount
        };
      })
    };

    return NextResponse.json(processedRecord, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch periodic record:", error);
    return NextResponse.json({ error: 'Failed to fetch periodic record' }, { status: 500 });
  }
}

// PUT /api/groups/{groupId}/periodic-records/{recordId}
export async function PUT(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string; recordId: string }> }
) {
  const params = await paramsPromise;
  const { id: groupId, recordId: existingRecordId } = params;
  if (!groupId || !existingRecordId) {
    return NextResponse.json({ error: 'Group ID and Record ID are required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const validation = updateGroupPeriodicRecordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input data', details: validation.error.errors }, { status: 400 });
    }

    const { memberRecords: memberRecordsData, ...validatedData } = validation.data;
    
    // Create properly typed update data
    const updateData: Record<string, unknown> = {};
    Object.keys(validatedData).forEach(key => {
      if (validatedData[key as keyof typeof validatedData] !== undefined) {
        if (key === 'meetingDate' && validatedData.meetingDate) {
          updateData.meetingDate = new Date(validatedData.meetingDate);
        } else {
          updateData[key] = validatedData[key as keyof typeof validatedData];
        }
      }
    });

    const existingRecord = await prisma.groupPeriodicRecord.findUnique({ // Corrected: groupPeriodicRecord
      where: { id: existingRecordId, groupId: groupId },
    });

    if (!existingRecord) {
      return NextResponse.json({ error: 'Periodic record not found' }, { status: 404 });
    }

    const updatedRecord = await prisma.$transaction(async (tx) => {
      const mainRecord = await tx.groupPeriodicRecord.update({ // Corrected: groupPeriodicRecord
        where: { id: existingRecordId },
        data: updateData,
      });

      if (memberRecordsData && Array.isArray(memberRecordsData)) {
        for (const mr of memberRecordsData) {
          // Upsert logic for member records: update if id exists, create if not (and has memberId)
          if (mr.id) { 
            await tx.groupMemberPeriodicRecord.update({ // Corrected: groupMemberPeriodicRecord
              where: { id: mr.id, groupPeriodicRecordId: existingRecordId }, // Ensure it belongs to this periodic record
              data: {
                compulsoryContribution: mr.compulsoryContribution !== undefined ? mr.compulsoryContribution : null,
                loanRepaymentPrincipal: mr.loanRepaymentPrincipal !== undefined ? mr.loanRepaymentPrincipal : null,
                lateFinePaid: mr.lateFinePaid !== undefined ? mr.lateFinePaid : null,
              },
            });
          } else if (mr.memberId) { // Create new if no id but memberId is present
            await tx.groupMemberPeriodicRecord.create({ // Corrected: groupMemberPeriodicRecord
              data: {
                groupPeriodicRecordId: existingRecordId,
                memberId: mr.memberId,
                compulsoryContribution: mr.compulsoryContribution !== undefined ? mr.compulsoryContribution : null,
                loanRepaymentPrincipal: mr.loanRepaymentPrincipal !== undefined ? mr.loanRepaymentPrincipal : null,
                lateFinePaid: mr.lateFinePaid !== undefined ? mr.lateFinePaid : null,
              },
            });
          }
        }
      }
      return mainRecord;
    });

    const resultWithRelations = await prisma.groupPeriodicRecord.findUnique({ // Corrected: groupPeriodicRecord
      where: { id: updatedRecord.id },
      include: {
        memberRecords: {
          include: {
            member: true,
          },
        },
      },
    });

    return NextResponse.json(resultWithRelations, { status: 200 });
  } catch (error) { // Changed error type
    const typedError = error as Error & { code?: string };
    console.error("Failed to update periodic record:", typedError);
    if (typedError.code === 'P2002') {
      return NextResponse.json({ error: 'A periodic record with this meeting date already exists for this group.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update periodic record' }, { status: 500 });
  }
}

// DELETE /api/groups/{groupId}/periodic-records/{recordId}
export async function DELETE(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string; recordId: string }> }
) {
  try {
    const params = await paramsPromise;
    const groupId = params.id;
    const recordId = params.recordId;

    // Check if any LoanPayment records are linked to this GroupPeriodicRecord
    const conflictingLoanPayments = await prisma.loanPayment.findMany({
      where: {
        paidInRecordId: recordId,
      },
    });

    if (conflictingLoanPayments.length > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete this periodic record because it is linked to one or more loan payments. Please reassign or delete those loan payments first.",
        },
        { status: 409 } // 409 Conflict
      );
    }

    // Start a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Set issuedInRecordId to null for any loans linked to this periodic record
      await tx.loan.updateMany({
        where: {
          issuedInRecordId: recordId,
          groupId: groupId,
        },
        data: {
          issuedInRecordId: null,
        },
      });

      // Delete related GroupMemberPeriodicRecord entries
      await tx.groupMemberPeriodicRecord.deleteMany({
        where: {
          groupPeriodicRecordId: recordId,
        },
      });

      // Delete the GroupPeriodicRecord itself
      await tx.groupPeriodicRecord.delete({
        where: {
          id: recordId,
          groupId: groupId,
        },
      });
    });

    return NextResponse.json(
      { message: "Periodic record deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    const typedError = error as Error;
    console.error("Error deleting periodic record:", typedError);
    if (typedError instanceof Prisma.PrismaClientKnownRequestError) {
      if (typedError.code === "P2025") {
        return NextResponse.json(
          { error: "Periodic record not found" },
          { status: 404 }
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to delete periodic record" },
      { status: 500 }
    );
  }
}
