import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authMiddleware, canAccessGroup, canEditGroup, canViewMemberIds } from '@/app/lib/auth';
import { validateGroupForAPI } from '@/app/lib/late-fine-validation';

// Type definitions for better type safety
interface MembershipWithMember {
  member: {
    id: string;
    name: string;
    currentLoanAmount?: number;
    loans?: Array<{ currentBalance: number }>;
  };
  joinedAt: Date;
  currentLoanAmount?: number;
  initialInterest?: number;
}

interface GroupWithMemberships {
  id: string;
  name: string;
  memberships: MembershipWithMember[];
  cashInHand?: number;
  balanceInBank?: number;
  monthlyContribution?: number;
  interestRate?: number;
  [key: string]: unknown;
}

// Schema for validating group update data
const updateGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').optional(),
  address: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  organization: z.string().optional().nullable(), // Changed from enum to string
  leaderId: z.string().min(1, 'Leader ID is required').optional(),
  memberCount: z.number().int().positive().optional().nullable(),
  dateOfStarting: z.string().datetime({ message: "Invalid date format" }).optional().nullable(), // Expect ISO 8601 string
  description: z.string().optional().nullable(),
  bankAccountNumber: z.string()
    .refine((val) => !val || /^\d+$/.test(val), 'Bank account number must contain only numeric digits')
    .optional().nullable(),
  bankName: z.string().optional().nullable(),
  collectionFrequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY", "YEARLY"]).optional().nullable(), // Added collection frequency
  isLateFineEnabled: z.boolean().optional(), // Added late fine toggle option
  lateFineRule: z.object({
    ruleType: z.enum(["DAILY_FIXED", "DAILY_PERCENTAGE", "TIER_BASED"]),
    dailyAmount: z.number().optional(),
    dailyPercentage: z.number().optional(),
    tierRules: z.array(z.object({
      startDay: z.number().int().min(1),
      endDay: z.number().int().min(1),
      amount: z.number().nonnegative(),
      isPercentage: z.boolean()
    })).optional()
  }).optional(),
  // Note: Member list updates are handled by separate endpoints (/api/groups/[id]/members)
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  try {
    // Check authentication first
    const authResult = await authMiddleware(request);
    
    // If the result is a NextResponse, it means auth failed
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { session } = authResult;
    
    // If we reach here, the user is authenticated
    const userId = session.user.id;
    
    // Check if user has access to this group
    const hasAccess = await canAccessGroup(userId, id);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have permission to access this group' },
        { status: 403 }
      );
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        leader: {
          select: { id: true, name: true, email: true } // Include leader details
        },
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: {
                    groupId: id,
                    status: 'ACTIVE' // Only active loans
                  }
                }
              }
            }
          },
          orderBy: {
            member: {
              name: 'asc' // Order members alphabetically by name
            }
          }
        },
        groupPeriodicRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Get the latest periodic record for total group standing
        },
        lateFineRules: {
          include: {
            tierRules: true // Include tier-based rules
          },
          orderBy: { createdAt: 'desc' },
          take: 1 // Get the latest late fine rule
        }
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Get user's permissions for the UI
    const canEdit = await canEditGroup(userId, id);
    const canViewIds = await canViewMemberIds(userId, id);

    // Calculate current share amount per member (total group standing / number of members)
    const latestRecord = group.groupPeriodicRecords?.[0];
    const totalGroupStanding = latestRecord?.totalGroupStandingAtEndOfPeriod || 0;
    const numberOfMembers = group.memberships.length || 1; // Avoid division by zero
    const currentShareAmountPerMember = totalGroupStanding / numberOfMembers;

    // Format the response to be more frontend-friendly
    const typedGroup = group as GroupWithMemberships;
    
    console.log('🔍 [GROUP API] Debug - Raw memberships data:');
    typedGroup.memberships.forEach((m, index) => {
      console.log(`Member ${index}:`, {
        memberName: m.member.name,
        memberLoans: m.member.loans,
        memberLoansCount: m.member.loans?.length || 0,
        loansDetails: JSON.stringify(m.member.loans),
        currentLoanAmount: m.currentLoanAmount || 0
      });
    });
    
    const formattedGroup = {
      ...group,
      members: typedGroup.memberships.map((m: MembershipWithMember) => {
        // Filter for active loans in the calculation instead of the query
        const activeLoans = m.member.loans?.filter((loan: any) => loan.status === 'ACTIVE') || [];
        const activeLoansBalance = activeLoans.reduce((total: number, loan: any) => total + (loan.currentBalance || 0), 0);
        
        console.log(`🔢 [GROUP API] Calculating balance for ${m.member.name}:`, {
          allLoans: m.member.loans?.length || 0,
          activeLoans: activeLoans.length,
          activeLoansBalance: activeLoansBalance,
          membershipLoanAmount: m.currentLoanAmount || 0,
          memberDirectLoanAmount: m.member.currentLoanAmount || 0,
          loansData: JSON.stringify(m.member.loans)
        });
        
        // Include both imported loan data (from membership) and new loans (from loans table)
        const membershipLoanAmount = m.currentLoanAmount || m.member.currentLoanAmount || 0;
        const totalLoanBalance = membershipLoanAmount + activeLoansBalance;
        
        return {
          id: m.member.id, // Original ID
          memberId: m.member.id, // Duplicate for frontend compatibility
          name: m.member.name,
          joinedAt: m.joinedAt,
          currentShareAmount: currentShareAmountPerMember, // Calculated current share
          currentLoanAmount: totalLoanBalance,
          initialInterest: m.initialInterest || 0,
          // Include both imported loans (membership) and new loans (loans table) for repayment
          currentLoanBalance: totalLoanBalance,
        };
      }),
      // Include financial data for periodic record initialization
      cashInHand: typedGroup.cashInHand || 0,
      balanceInBank: typedGroup.balanceInBank || 0,
      monthlyContribution: typedGroup.monthlyContribution || 0,
      interestRate: typedGroup.interestRate || 0,
      // Keep membership count for add-member functionality
      membershipCount: group.memberships.length,
      currentShareAmountPerMember: currentShareAmountPerMember,
      // Include late fine rules
      lateFineRules: group.lateFineRules,
      memberships: undefined, // Remove the original memberships array
      userPermissions: {
        canEdit,
        canViewMemberIds: canViewIds
      }
    };

    return NextResponse.json(formattedGroup);
  } catch (error) {
    console.error(`Error fetching group ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch group' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  try {
    // Check authentication first
    const authResult = await authMiddleware(request);
    
    // If the result is a NextResponse, it means auth failed
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { session } = authResult;
    
    // If we reach here, the user is authenticated
    const userId = session.user.id;
    
    // Check if user has edit permission for this group
    const hasEditAccess = await canEditGroup(userId, id);
    
    if (!hasEditAccess) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this group' },
        { status: 403 }
      );
    }

    const json = await request.json();
    console.log('🔍 [API DEBUG] Received group update payload:', JSON.stringify(json, null, 2));

    // Validate input data
    const validationResult = updateGroupSchema.safeParse(json);
    if (!validationResult.success) {
      console.error('🔍 [API DEBUG] Validation failed:', validationResult.error.errors);
      return NextResponse.json(
        { error: 'Invalid input data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    let dataToUpdate = validationResult.data;
    
    // Validate and fix late fine rules to prevent missing tier rules issue
    const lateFineValidation = validateGroupForAPI(dataToUpdate);
    if (!lateFineValidation.isValid) {
      console.warn('🔧 Late fine auto-fixes applied during group update:', lateFineValidation.errors);
    }
    
    // Use the validated and potentially fixed data
    dataToUpdate = lateFineValidation.fixedData;

    // If leaderId is being updated, validate the new leader exists
    if (dataToUpdate.leaderId) {
      const leaderExists = await prisma.member.findUnique({
        where: { id: dataToUpdate.leaderId },
        select: { id: true }
      });
      if (!leaderExists) {
        return NextResponse.json(
          { error: 'Selected new leader does not exist' },
          { status: 400 }
        );
      }
      // Also ensure the new leader is actually a member of the group
      const isMember = await prisma.memberGroupMembership.findUnique({
        where: {
          memberId_groupId: {
            memberId: dataToUpdate.leaderId,
            groupId: id
          }
        }
      });
      if (!isMember) {
        return NextResponse.json(
          { error: 'Cannot assign a non-member as the leader.' },
          { status: 400 }
        );
      }
    }

    // Get current group data to check if leadership is changing
    const currentGroup = await prisma.group.findUnique({
      where: { id },
      select: {
        leaderId: true
      }
    });
    
    // Check if a leadership change is requested
    const isLeadershipChange = dataToUpdate.leaderId && currentGroup?.leaderId !== dataToUpdate.leaderId;
    const leaderId = dataToUpdate.leaderId;
    
    // Remove leaderId from dataToUpdate if leadership change requires approval
    const updatedDataToSave = { ...dataToUpdate };
    
    if (isLeadershipChange && session.user.role !== 'ADMIN') {
      // For non-admin users, leadership changes require approval
      delete updatedDataToSave.leaderId; // Don't update the leaderId directly
    }
    
    // Perform the update in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create properly typed update data
      const updateData: Record<string, unknown> = {};
      Object.keys(updatedDataToSave).forEach(key => {
        const value = updatedDataToSave[key as keyof typeof updatedDataToSave];
        if (value !== undefined) {
          // Skip fields that need special handling
          if (key === 'leaderId' || key === 'lateFineRule' || key === 'isLateFineEnabled') {
            return; // Skip these fields - they're handled separately
          }
          
          if (key === 'dateOfStarting' && typeof value === 'string') {
            updateData.dateOfStarting = new Date(value);
          } else if (key === 'collectionFrequency' && value === null) {
            // Skip null collection frequency
          } else {
            updateData[key] = value;
          }
        }
      });

      // Update the group with other changes
      const updatedGroup = await tx.group.update({
        where: { id },
        data: updateData,
      });
      
      // Handle late fine rule update if isLateFineEnabled field is provided
      if ('isLateFineEnabled' in dataToUpdate) {
        // First check if the group already has a late fine rule
        const existingRule = await tx.lateFineRule.findFirst({
          where: { groupId: id },
          orderBy: { createdAt: 'desc' },
        });

        // Check if we have details from the lateFineRule field
        const lateFineRule = json.lateFineRule;
        
        if (existingRule) {
          if (dataToUpdate.isLateFineEnabled) {
            // Update the existing rule with complete configuration
            const ruleUpdateData = { 
              isEnabled: true,
              // Use values from lateFineRule if provided, otherwise keep existing values
              ruleType: lateFineRule?.ruleType || existingRule.ruleType,
              dailyAmount: lateFineRule?.dailyAmount !== undefined ? lateFineRule.dailyAmount : existingRule.dailyAmount,
              dailyPercentage: lateFineRule?.dailyPercentage !== undefined ? lateFineRule.dailyPercentage : existingRule.dailyPercentage,
            };
            
            // Update the rule
            await tx.lateFineRule.update({
              where: { id: existingRule.id },
              data: ruleUpdateData,
            });
            
            // Handle tier rules for TIER_BASED rule type
            if (lateFineRule?.ruleType === 'TIER_BASED' && lateFineRule.tierRules) {
              // First delete existing tier rules
              await tx.lateFineRuleTier.deleteMany({
                where: { lateFineRuleId: existingRule.id }
              });
              
              // Then create new tier rules
              for (const tier of lateFineRule.tierRules) {
                await tx.lateFineRuleTier.create({
                  data: {
                    lateFineRuleId: existingRule.id,
                    startDay: tier.startDay,
                    endDay: tier.endDay,
                    amount: tier.amount,
                    isPercentage: tier.isPercentage
                  }
                });
              }
            }
          } else {
            // Just disable the rule
            await tx.lateFineRule.update({
              where: { id: existingRule.id },
              data: { isEnabled: false },
            });
          }
        } else if (dataToUpdate.isLateFineEnabled) {
          // Create a new late fine rule
          const newRule = await tx.lateFineRule.create({
            data: {
              groupId: id,
              isEnabled: true,
              ruleType: lateFineRule?.ruleType || 'DAILY_FIXED', // Default rule type
              dailyAmount: lateFineRule?.dailyAmount !== undefined ? lateFineRule.dailyAmount : 10, // Default amount (₹10 per day)
              dailyPercentage: lateFineRule?.dailyPercentage !== undefined ? lateFineRule.dailyPercentage : null,
            }
          });
          
          // Handle tier rules for a new TIER_BASED rule
          if (lateFineRule?.ruleType === 'TIER_BASED' && lateFineRule.tierRules && lateFineRule.tierRules.length > 0) {
            // Create tier rules for the new rule
            for (const tier of lateFineRule.tierRules) {
              await tx.lateFineRuleTier.create({
                data: {
                  lateFineRuleId: newRule.id,
                  startDay: tier.startDay,
                  endDay: tier.endDay,
                  amount: tier.amount,
                  isPercentage: tier.isPercentage
                }
              });
            }
          }
        }
      }
      
      // Handle leadership change
      if (isLeadershipChange && leaderId) {
        if (session.user.role === 'ADMIN') {
          // Admin can directly change leadership without approval
          await tx.group.update({
            where: { id },
            data: { 
              leader: {
                connect: { id: leaderId }
              }
            }
          });
          console.log('Admin changed leadership directly');
        } else {
          // Mark any existing pending leadership invitations for this group as superseded
          await tx.pendingLeadership.updateMany({
            where: {
              groupId: id,
              status: 'PENDING',
            },
            data: {
              status: 'SUPERSEDED',
            },
          });
          
          // Create a new pending leadership invitation
          if (leaderId) {
            await tx.pendingLeadership.create({
              data: {
                groupId: id,
                memberId: leaderId,
                initiatedByUserId: session.user.id,
                status: 'PENDING',
              },
            });
          }
        }
      }
      
      return updatedGroup;
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error updating group ${id}:`, error);
    const typedError = error as Error & { code?: string };
    if (typedError.code === 'P2025') { // Prisma error code for record not found
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to update group', details: typedError.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  try {
    // Check authentication first
    const authResult = await authMiddleware(request);
    
    // If the result is a NextResponse, it means auth failed
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { session } = authResult;
    
    // For group deletion, we allow both ADMIN roles and GROUP_LEADER roles to delete groups
    // But group leaders can only delete groups they actually lead
    if (session.user.role === "ADMIN") {
      // Admins can delete any group
    } else if (session.user.role === "GROUP_LEADER") {
      // Group leaders can only delete groups they lead
      const group = await prisma.group.findUnique({
        where: { id },
        select: { leaderId: true }
      });
      
      if (!group) {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      }
      
      if (group.leaderId !== session.user.memberId) {
        return NextResponse.json(
          { error: 'Group leaders can only delete groups they lead' },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Only administrators and group leaders can delete groups' },
        { status: 403 }
      );
    }

    // Use a transaction to delete the group and all its related records
    await prisma.$transaction(async (tx) => {
      // 1. Delete related GroupPeriodicRecords first
      // Need to get all periodic record IDs for this group to delete their member records
      const periodicRecords = await tx.groupPeriodicRecord.findMany({
        where: { groupId: id },
        select: { id: true },
      });
      const periodicRecordIds = periodicRecords.map(pr => pr.id);

      if (periodicRecordIds.length > 0) {
        // Delete GroupMemberPeriodicRecords associated with the GroupPeriodicRecords
        await tx.groupMemberPeriodicRecord.deleteMany({
          where: { groupPeriodicRecordId: { in: periodicRecordIds } },
        });
      }

      // Now delete the GroupPeriodicRecords themselves
      await tx.groupPeriodicRecord.deleteMany({
        where: { groupId: id },
      });

      // 2. Delete related BankTransactions (if your schema links them directly to group)
      // Assuming BankTransaction has a direct groupId field
      await tx.bankTransaction.deleteMany({
        where: { groupId: id }, // Adjust if the relation is different
      });

      // 3. Delete related Loans and their LoanPayments (if your schema links them directly to group)
      // Assuming Loan has a direct groupId field and LoanPayment links to Loan
      const loans = await tx.loan.findMany({
        where: { groupId: id }, // Adjust if the relation is different
        select: { id: true },
      });
      const loanIds = loans.map(l => l.id);

      if (loanIds.length > 0) {
        await tx.loanPayment.deleteMany({
          where: { loanId: { in: loanIds } },
        });
      }
      await tx.loan.deleteMany({
        where: { groupId: id }, // Adjust if the relation is different
      });

      // 4. Delete NextGenMember records for members of this group
      const groupMemberIds = await tx.memberGroupMembership.findMany({
        where: { groupId: id },
        select: { memberId: true },
      });
      const memberIds = groupMemberIds.map(gm => gm.memberId);

      if (memberIds.length > 0) {
        await tx.nextGenMember.deleteMany({
          where: { primaryMemberId: { in: memberIds } },
        });
      }

      // 5. Delete related MemberGroupMemberships
      await tx.memberGroupMembership.deleteMany({
        where: { groupId: id },
      });

      // 6. Finally, delete the group itself
      await tx.group.delete({
        where: { id },
      });
    });

    return new NextResponse(null, { status: 204 }); // No Content

  } catch (error) {
    console.error(`Error deleting group ${id}:`, error);
    const typedError = error as Error & { code?: string };
    // Check for specific Prisma error for related records not found (e.g., if already deleted)
    if (typedError.code === 'P2025') { 
      // This can happen if, for example, a bank transaction was expected but none existed.
      // Or if the group itself was already deleted in a concurrent request.
      // For a DELETE operation, this might not be a critical failure if the end state (group gone) is achieved.
      // However, if it means some dependent records were missed, it could be an issue.
      // For now, we'll return a 500 but log it carefully.
      console.warn(`Prisma P2025 error during group deletion ${id}: ${typedError.message}. This might indicate some related records were not found or the group was already deleted.`);
      return NextResponse.json(
        { error: 'Failed to delete group due to missing related records or concurrent deletion.', details: typedError.message },
        { status: 500 } // Or 404 if group itself was the P2025 target
      );
    }
    return NextResponse.json(
      { error: 'Failed to delete group', details: typedError.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}