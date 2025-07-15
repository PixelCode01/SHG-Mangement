import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/app/lib/prisma';
import { authMiddleware, getUserAccessibleGroups, setUserGroupPermission } from '@/app/lib/auth';
import { ensureCollectionSchedule } from '@/app/lib/collection-schedule-validator';
import { validateGroupForAPI } from '@/app/lib/late-fine-validation';

// Add type for group structure
type GroupWithRelations = {
  id: string;
  groupId: string;
  name: string;
  createdAt: Date;
  leader?: { id: string; name: string } | null;
  memberships: { memberId?: string }[];
  [key: string]: unknown; // For other properties
};

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
  ruleType: z.enum(["DAILY_FIXED", "DAILY_PERCENTAGE", "TIER_BASED"]).optional(),
  dailyAmount: z.number().nonnegative().optional(),
  dailyPercentage: z.number().nonnegative().max(100).optional(),
  tierRules: z.array(lateFineRuleTierSchema).optional(),
}).optional();

// Schema for validating group creation data
const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
  address: z.string().min(1, 'Address is required'),
  registrationNumber: z.string().min(1, 'Registration number is required'),
  organization: z.string().optional(), // Changed from enum to optional string
  leaderId: z.string().min(1, 'Leader ID is required'),
  memberCount: z.number().int().positive().optional(),
  dateOfStarting: z.string().datetime({ message: "Invalid date format" }).optional(),
  description: z.string().optional(),
  collectionFrequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY", "YEARLY"]).default('MONTHLY'),
  // Collection day validation - required based on frequency
  collectionDayOfMonth: z.number().int().min(1).max(31).optional(),
  collectionDayOfWeek: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]).optional(),
  collectionWeekOfMonth: z.number().int().min(1).max(4).optional(),
  bankAccountNumber: z.string()
    .refine((val) => !val || /^\d+$/.test(val), 'Bank account number must contain only numeric digits or be empty')
    .optional(),
  bankName: z.string().optional(),
  cashInHand: z.number().nonnegative().optional(),
  balanceInBank: z.number().nonnegative().optional(),
  monthlyContribution: z.number().nonnegative().optional(),
  interestRate: z.number().nonnegative().max(100, 'Interest rate cannot exceed 100%').optional(),
  lateFineRule: lateFineRuleSchema,
  
  // Loan Insurance Settings
  loanInsuranceEnabled: z.boolean().optional(),
  loanInsurancePercent: z.number().nonnegative().max(100, 'Loan insurance rate cannot exceed 100%').optional(),
  loanInsuranceBalance: z.number().nonnegative().optional(),
  
  // Group Social Settings
  groupSocialEnabled: z.boolean().optional(),
  groupSocialAmountPerFamilyMember: z.number().nonnegative().optional(),
  groupSocialBalance: z.number().nonnegative().optional(),
  
  // Period Tracking Settings
  includeDataTillCurrentPeriod: z.boolean().optional(),
  currentPeriodMonth: z.number().int().min(1).max(12).optional(),
  currentPeriodYear: z.number().int().optional(),
  
  members: z.array(z.object({
    memberId: z.string().min(1),
    currentShareAmount: z.number().nonnegative().optional(),
    currentLoanAmount: z.number().nonnegative().optional(),
    initialInterest: z.number().nonnegative().optional(),
    familyMembersCount: z.number().int().positive().optional(),
  })).min(1, 'At least one member (including the leader) is required'),
}).refine((data) => {
  // Custom validation to ensure collection day is set based on frequency
  if (data.collectionFrequency === 'MONTHLY' || data.collectionFrequency === 'YEARLY') {
    if (!data.collectionDayOfMonth) {
      return false;
    }
  }
  if (data.collectionFrequency === 'WEEKLY' || data.collectionFrequency === 'FORTNIGHTLY') {
    if (!data.collectionDayOfWeek) {
      return false;
    }
    if (data.collectionFrequency === 'FORTNIGHTLY' && !data.collectionWeekOfMonth) {
      return false;
    }
  }
  return true;
}, {
  message: "Collection day is required: Monthly/Yearly needs 'day of month', Weekly/Fortnightly needs 'day of week'",
  path: ["collectionDayOfMonth"]
});

// Define the inferred type
type CreateGroupInputType = z.infer<typeof createGroupSchema>;

export async function GET(request: NextRequest) {
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
    
    console.log(`[Groups API] Fetching groups for user: ${userId}, role: ${session.user.role}`);
    
    // For admin users, we show all groups
    // For GROUP_LEADER users, we only show groups they lead
    // For MEMBER users, we only show groups they belong to
    let groups: GroupWithRelations[] = [];
    
    if (session.user.role === 'ADMIN') {
      // Admin sees all groups
      groups = await prisma.group.findMany({
        include: {
          leader: { select: { id: true, name: true } },
          memberships: { select: { memberId: true } },
        },
        orderBy: { name: 'asc' },
      });
    } else if (session.user.role === 'GROUP_LEADER') {
      // Group leader only sees groups they lead
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          member: {
            select: {
              ledGroups: {
                include: {
                  leader: { select: { id: true, name: true } },
                  memberships: { select: { memberId: true } },
                }
              }
            }
          }
        }
      });
      
      // Handle case where GROUP_LEADER doesn't have a member record
      groups = user?.member?.ledGroups || [];
    } else {
      // Regular members see groups they belong to
      const accessibleGroups = await getUserAccessibleGroups(userId) as GroupWithRelations[];
      
      // Additionally, check if they have any pending leadership invitations
      // to see groups they're invited to lead even if not a member yet
      if (session.user.role === 'MEMBER' && session.user.memberId) {
        const pendingLeaderships = await prisma.pendingLeadership.findMany({
          where: {
            memberId: session.user.memberId,
            status: 'PENDING',
          },
          select: {
            group: {
              include: {
                leader: { select: { id: true, name: true } },
                memberships: { select: { memberId: true } },
              },
            },
          },
        });
        
        // Add the groups with pending leadership to the accessible groups
        const pendingGroups = pendingLeaderships.map(pl => pl.group as GroupWithRelations);
        
        // Filter out duplicates if a group appears in both lists
        const groupIds = new Set(accessibleGroups.map((g: GroupWithRelations) => g.id));
        for (const group of pendingGroups) {
          if (!groupIds.has(group.id)) {
            accessibleGroups.push(group);
          }
        }
      }
      
      groups = accessibleGroups;
    }

    const formattedGroups = groups.map((group: GroupWithRelations) => ({
      id: group.id,
      groupId: group.groupId,
      name: group.name,
      createdAt: group.createdAt,
      leaderName: group.leader?.name ?? 'N/A',
      memberCount: group.memberships.length,
    }));

    console.log(`[Groups API] Returning ${formattedGroups.length} groups for user ${userId}`);
    
    return NextResponse.json(formattedGroups);
  } catch (error) {
    const typedError = error as Error & { status?: number };
    console.error('Error fetching groups:', {
      error: typedError.message,
      stack: typedError.stack,
      timestamp: new Date().toISOString()
    });
    
    if (typedError.status === 401) {
      // If it's an unauthorized response from the authMiddleware
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch groups', details: typedError.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication first
    const authResult = await authMiddleware(request);
    
    // If the result is a NextResponse, it means auth failed
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { session } = authResult;
    
    // Validate that the session user ID is a valid MongoDB ObjectID format
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(session.user.id)) {
      console.error(`[ERROR] Invalid user ID format: "${session.user.id}" - not a valid MongoDB ObjectID`);
      return NextResponse.json({
        error: 'Invalid session detected',
        details: `Your browser has stale authentication data. User ID "${session.user.id}" is not valid.`,
        solution: 'Please clear your browser cookies and log in again with a valid account.',
        validAccounts: [
          'leader@test.com (password: leader123)',
          'testleader@example.com (password: testleader123)'
        ]
      }, { status: 401 });
    }

    // Verify the session user actually exists in the database
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, role: true }
    });
    
    if (!userExists) {
      console.error(`[ERROR] User ${session.user.id} from session does not exist in database`);
      return NextResponse.json({
        error: 'Session user not found in database',
        details: 'Your session references a user that no longer exists.',
        solution: 'Please log out and log in again with a valid account.',
        validAccounts: [
          'leader@test.com (password: leader123)',
          'testleader@example.com (password: testleader123)'
        ]
      }, { status: 401 });
    }
    
    console.log(`[DEBUG] Valid user authenticated: ${userExists.email} (${userExists.id})`);
    
    // For creating groups, we allow users with ADMIN or GROUP_LEADER role
    if (session.user.role !== "ADMIN" && session.user.role !== "GROUP_LEADER") {
      return NextResponse.json(
        { error: 'You do not have permission to create groups' },
        { status: 403 }
      );
    }
    
    // We'll handle member linking later in the transaction when we know which leader was selected
    let userMemberId = session.user.memberId;
    
    const json = await request.json();

    // Validate input data
    const validationResult = createGroupSchema.safeParse(json);
    if (!validationResult.success) {
      console.error('Group validation failed:', validationResult.error.format());
      console.error('Input data:', JSON.stringify(json, null, 2));
      return NextResponse.json(
        { error: 'Invalid input data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    let validatedData: CreateGroupInputType = validationResult.data;
    
    // Validate and fix late fine rules to prevent missing tier rules issue
    const lateFineValidation = validateGroupForAPI(validatedData);
    if (!lateFineValidation.isValid) {
      console.warn('🔧 Late fine auto-fixes applied:', lateFineValidation.errors);
    }
    
    // Use the validated and potentially fixed data
    validatedData = lateFineValidation.fixedData;
    
    // Ensure collection schedule is properly set (apply defaults if needed)
    try {
      validatedData = ensureCollectionSchedule(validatedData);
    } catch (scheduleError) {
      return NextResponse.json(
        { error: 'Collection schedule validation failed', details: (scheduleError as Error).message },
        { status: 400 }
      );
    }

    const {
      name,
      address,
      registrationNumber,
      organization,
      leaderId,
      memberCount,
      dateOfStarting,
      description,
      collectionFrequency,
      collectionDayOfMonth,
      collectionDayOfWeek,
      collectionWeekOfMonth,
      bankAccountNumber,
      bankName,
      cashInHand,
      balanceInBank, 
      monthlyContribution,
      interestRate,
      lateFineRule,
      loanInsuranceEnabled,
      loanInsurancePercent,
      loanInsuranceBalance,
      groupSocialEnabled,
      groupSocialAmountPerFamilyMember,
      groupSocialBalance,
      includeDataTillCurrentPeriod,
      currentPeriodMonth,
      currentPeriodYear,
      members: membersData
    } = validatedData;

    const leaderExists = await prisma.member.findUnique({
      where: { id: leaderId },
      select: { id: true }
    });
    if (!leaderExists) {
      return NextResponse.json(
        { error: 'Selected leader does not exist' },
        { status: 400 }
      );
    }

    // Since we will link the user to the selected leader member,
    // we don't need to validate that the user has an existing memberId
    // We just need to ensure the selected leader exists and is in the members list
    const leaderInData = membersData.find(m => m.memberId === leaderId);
    if (!leaderInData) {
      return NextResponse.json(
        { error: 'Leader must be included in the members list' },
        { status: 400 }
      );
    }

    const memberIds = membersData.map(m => m.memberId);
    
    const existingMembers = await prisma.member.findMany({
        where: { id: { in: memberIds } },
        select: { id: true }
    });
    if (existingMembers.length !== memberIds.length) {
        const foundIds = new Set(existingMembers.map(m => m.id));
        const missingIds = memberIds.filter(id => !foundIds.has(id));
        return NextResponse.json(
            { error: `Invalid member IDs provided: ${missingIds.join(', ')}` },
            { status: 400 }
        );
    }

    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const groupId = await prisma.$transaction(async (tx) => {
        const lastGroup = await tx.group.findFirst({
            where: { groupId: { startsWith: `GRP-${yearMonth}-` } },
            orderBy: { createdAt: 'desc' },
            select: { groupId: true }
        });
        let sequentialNumber = 1;
        if (lastGroup?.groupId) {
            try {
                const groupIdParts = lastGroup.groupId.split('-');
                if (groupIdParts.length >= 3 && groupIdParts[2]) {
                    const lastNumber = parseInt(groupIdParts[2]);
                    if (!isNaN(lastNumber)) sequentialNumber = lastNumber + 1;
                }
            } catch (e) {
                console.error("Error parsing last group ID sequence:", e);
            }
        }
        return `GRP-${yearMonth}-${String(sequentialNumber).padStart(3, '0')}`;
    });

    const result = await prisma.$transaction(async (tx) => {
      // If the user doesn't have a memberId or selected a different leader than their current linked member,
      // we need to link the user to the selected leader member
      const actualGroupLeaderId = leaderId; // Use the selected leader
      
      // Check if the user needs to be linked to the selected leader
      if (!userMemberId || userMemberId !== leaderId) {
        // Link the current user to the selected leader member
        await tx.user.update({
          where: { id: session.user.id },
          data: { memberId: leaderId }
        });
        console.log(`Linked user ${session.user.id} to member ${leaderId}`);
        userMemberId = leaderId; // Update for the rest of the transaction
      }
      
      // Create properly typed group data
      const groupData: Record<string, unknown> = {
        groupId,
        name,
        address,
        registrationNumber,
        leaderId: actualGroupLeaderId, // Set to the selected leader
        memberCount: memberCount ?? membersData.length,
        dateOfStarting: dateOfStarting ? new Date(dateOfStarting) : new Date(),
        collectionFrequency,
        collectionDayOfMonth,
        collectionDayOfWeek,
        collectionWeekOfMonth,
        cashInHand,
        balanceInBank,
        monthlyContribution,
        // Loan Insurance Settings
        loanInsuranceEnabled: loanInsuranceEnabled ?? false,
        loanInsurancePercent,
        loanInsuranceBalance: loanInsuranceBalance ?? 0,
        // Group Social Settings
        groupSocialEnabled: groupSocialEnabled ?? false,
        groupSocialAmountPerFamilyMember,
        groupSocialBalance: groupSocialBalance ?? 0,
        // Period Tracking Settings
        includeDataTillCurrentPeriod: includeDataTillCurrentPeriod ?? false,
        currentPeriodMonth,
        currentPeriodYear,
      };

      // Add optional fields only if they have values
      if (organization !== undefined) groupData.organization = organization;
      if (description !== undefined) groupData.description = description;
      if (bankAccountNumber !== undefined) groupData.bankAccountNumber = bankAccountNumber;
      if (bankName !== undefined) groupData.bankName = bankName;
      if (interestRate !== undefined) groupData.interestRate = interestRate;

      const group = await tx.group.create({
        data: groupData as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Complex nested Prisma types require type assertion
      });

      // Create late fine rule if enabled
      if (lateFineRule?.isEnabled) {
        const newRule = await tx.lateFineRule.create({
          data: {
            groupId: group.id,
            isEnabled: true,
            ruleType: lateFineRule.ruleType || 'DAILY_FIXED', // Default rule type
            dailyAmount: lateFineRule.dailyAmount !== undefined ? lateFineRule.dailyAmount : (lateFineRule.ruleType === 'DAILY_FIXED' ? 10 : null), // Default amount (₹10 per day) only for DAILY_FIXED
            dailyPercentage: lateFineRule.dailyPercentage !== undefined ? lateFineRule.dailyPercentage : null,
          }
        });
        
        // Handle tier rules for TIER_BASED rule
        if (lateFineRule.ruleType === 'TIER_BASED' && lateFineRule.tierRules && lateFineRule.tierRules.length > 0) {
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

      // Use createMany for better performance with large batches
      if (membersData.length > 0) {
        await tx.memberGroupMembership.createMany({
          data: membersData.map(memberInfo => ({
            groupId: group.id,
            memberId: memberInfo.memberId,
            currentShareAmount: memberInfo.currentShareAmount !== undefined ? memberInfo.currentShareAmount : null,
            currentLoanAmount: memberInfo.currentLoanAmount !== undefined ? memberInfo.currentLoanAmount : null,
            initialInterest: memberInfo.initialInterest !== undefined ? memberInfo.initialInterest : null,
          })),
        });
        
        // Update family members count for each member if provided
        for (const memberInfo of membersData) {
          if (memberInfo.familyMembersCount !== undefined) {
            await tx.member.update({
              where: { id: memberInfo.memberId },
              data: { familyMembersCount: memberInfo.familyMembersCount }
            });
          }
        }
      }

      // Since we've automatically linked the user to the selected leader member,
      // no pending leadership invitation is needed - the user IS the selected leader now
      // Remove the pending leadership creation logic

      return group;
    }, {
      timeout: 30000, // 30 seconds timeout for large groups
    });

    // Add permissions for the current user to manage this group using the helper function
    if (session.user.id) {
      try {
        const permissionSet = await setUserGroupPermission(session.user.id, result.id, true);
        if (!permissionSet) {
          console.warn(`Warning: Could not set permissions for user ${session.user.id} on group ${result.id}. User may need to log in again.`);
        }
      } catch (permError) {
        console.error("Error adding group permissions:", permError);
        // We don't return an error here as the group was created successfully
      }
    }
    
    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    const typedError = error as Error & { code?: string; meta?: { target?: string[] } };
    console.error('Error creating group and memberships:', typedError);
    if (typedError.code === 'P2002' && typedError.meta?.target?.includes('groupId')) {
        return NextResponse.json(
            { error: 'Failed to generate unique group ID due to conflict. Please try again.' },
            { status: 500 }
        );
    }
    return NextResponse.json(
      { error: 'Failed to create group', details: typedError.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
