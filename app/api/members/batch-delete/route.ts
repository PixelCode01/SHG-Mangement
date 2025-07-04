import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma'; // Corrected: Use named import
import { z } from 'zod';

// Define the expected request body schema
const batchDeleteSchema = z.object({
  memberIds: z.array(z.string().min(1, { message: "Member ID cannot be empty" })).min(1, { message: "At least one member ID must be provided" }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = batchDeleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validation.error.format() }, { status: 400 });
    }

    const { memberIds } = validation.data;

    // Perform the batch deletion
    // Note: Consider implications of deleting members, e.g., related records.
    // Prisma's default behavior for relations might need to be configured (e.g., cascading deletes or explicit cleanup).
    // For now, we'll directly delete the members.

    // First, check if any of these members are leaders of groups.
    // Instead of blocking deletion, we'll skip leaders and delete the rest.
    const groupsLedByMembers = await prisma.group.findMany({
      where: {
        leaderId: {
          in: memberIds,
        },
      },
      select: {
        name: true,
        leaderId: true,
        leader: {
          select: {
            name: true
          }
        }
      }
    });

    // Separate leaders from non-leaders
    const leaderIds = new Set(groupsLedByMembers.map(g => g.leaderId).filter(id => id !== null) as string[]);
    const nonLeaderIds = memberIds.filter(id => !leaderIds.has(id));
    
    let deleteResult = { count: 0 };
    let skippedLeaders: Array<{ id: string; name: string; groupName: string }> = [];
    
    // Get leader information for the response
    if (leaderIds.size > 0) {
      skippedLeaders = groupsLedByMembers
        .filter(g => g.leaderId && g.leader)
        .map(g => ({
          id: g.leaderId as string,
          name: g.leader?.name || '',
          groupName: g.name
        }));
    }
    
    // Proceed with deletion of non-leaders only
    if (nonLeaderIds.length > 0) {
      // Use a transaction to handle cascading deletions
      await prisma.$transaction(async (tx) => {
        // Delete related records first
        await tx.groupMemberPeriodicRecord.deleteMany({
          where: {
            memberId: {
              in: nonLeaderIds,
            },
          },
        });

        // Delete loan payments first
        await tx.loanPayment.deleteMany({
          where: {
            loan: {
              memberId: {
                in: nonLeaderIds,
              },
            },
          },
        });

        // Delete loans
        await tx.loan.deleteMany({
          where: {
            memberId: {
              in: nonLeaderIds,
            },
          },
        });

        // Delete memberships
        await tx.memberGroupMembership.deleteMany({
          where: {
            memberId: {
              in: nonLeaderIds,
            },
          },
        });

        // Finally delete the members
        deleteResult = await tx.member.deleteMany({
          where: {
            id: {
              in: nonLeaderIds,
            },
          },
        });
      });
    }

    // Prepare response message
    const responseData: {
      deletedCount: number;
      skippedLeaders: Array<{ name: string; groupName: string }>;
      totalRequested: number;
      message?: string;
      error?: string;
    } = {
      deletedCount: deleteResult.count,
      skippedLeaders: skippedLeaders,
      totalRequested: memberIds.length
    };

    if (skippedLeaders.length > 0) {
      const leaderMessages = skippedLeaders.map(leader => 
        `${leader.name} (leader of "${leader.groupName}")`
      ).join(', ');
      
      if (deleteResult.count > 0) {
        // Some deleted, some skipped
        responseData.message = `${deleteResult.count} member(s) deleted successfully. Skipped ${skippedLeaders.length} leader(s): ${leaderMessages}`;
      } else {
        // All were leaders, none deleted
        responseData.message = `No members deleted. All selected members are group leaders: ${leaderMessages}`;
        responseData.error = `Cannot delete group leaders. Please change the group leader first.`;
        return NextResponse.json(responseData, { status: 409 });
      }
    } else {
      // All deleted successfully
      responseData.message = `${deleteResult.count} member(s) deleted successfully.`;
    }

    if (deleteResult.count === 0 && skippedLeaders.length === 0) {
      return NextResponse.json({ error: 'No members found with the provided IDs or they were already deleted.' }, { status: 404 });
    }

    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    console.error('Error during batch member deletion:', error);
    if (error instanceof z.ZodError) { // Should be caught by safeParse, but as a fallback
      return NextResponse.json({ error: 'Invalid request body', details: error.format() }, { status: 400 });
    }
    // Check for Prisma-specific errors if needed, e.g., P2025 (Record to delete does not exist)
    // For a generic error:
    return NextResponse.json({ error: 'Failed to delete members due to an unexpected error.' }, { status: 500 });
  }
}
