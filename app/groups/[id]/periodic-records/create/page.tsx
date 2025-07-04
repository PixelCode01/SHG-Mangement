// /home/pixel/SHG/app/groups/[id]/periodic-records/create/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PeriodicRecordForm, { PeriodicRecordFormValues } from '@/app/components/PeriodicRecordForm';
import type { CollectionFrequency } from '@prisma/client'; // Corrected import

// Define interfaces for Group and Member (simplified for this form)
interface MemberForForm {
  id: string;
  name: string;
  currentLoanBalance?: number; // For total group standing calculation
}
interface GroupForForm {
  id: string;
  name: string;
  collectionFrequency: CollectionFrequency;
  members: MemberForForm[]; // Changed from memberships to members
  // Financial data for periodic record initialization
  cashInHand?: number;
  balanceInBank?: number;
  monthlyContribution?: number;
  interestRate?: number;
}

interface LatestRecordData {
    totalGroupStandingAtEndOfPeriod?: number | null;
    recordSequenceNumber?: number | null;
    meetingDate?: Date | string | null;
}

export default function CreatePeriodicRecordPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupForForm | null>(null);
  const [latestRecord, setLatestRecord] = useState<LatestRecordData | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!groupId) return;

    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch group details
        const groupRes = await fetch(`/api/groups/${groupId}`);
        if (!groupRes.ok) {
          const errData = await groupRes.json();
          throw new Error(errData.error || 'Failed to fetch group details');
        }
        const groupData: GroupForForm = await groupRes.json();
        console.log("Fetched group data:", groupData);
        
        // Ensure we have the members with their loan balances
        if (!groupData.members?.some(m => m.currentLoanBalance !== undefined)) {
          console.warn('Group data missing member loan balances. This will affect interest calculations.');
        }
        
        setGroup(groupData);

        // Fetch the latest periodic record for this group to prefill some data
        const latestRecordRes = await fetch(`/api/groups/${groupId}/periodic-records?latest=true`);
        if (latestRecordRes.ok) {
          const latestRecordData = await latestRecordRes.json();
          setLatestRecord(latestRecordData);
        } else {
          // It's okay if there's no latest record (e.g., first record)
          console.warn('Could not fetch latest record, or no records exist yet.');
          setLatestRecord(undefined);
        }

      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred while fetching initial data.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [groupId]);

  // useMemo hooks must be called before any early returns to maintain hook order
  const membersForForm = useMemo(() => 
    group ? group.members.map(m => ({ id: m.id, name: m.name })) : [], 
    [group]
  );

  // Calculate total group standing for initialization
  const groupInitData = useMemo(() => {
    if (!group) return null;
    
    const totalCash = (group.cashInHand || 0) + (group.balanceInBank || 0);
    
    // Calculate total loan amount using currentLoanBalance from API
    const totalLoanAmount = group.members.reduce((sum, member) => {
      return sum + (member.currentLoanBalance || 0);
    }, 0);
    
    const totalGroupStanding = totalCash + totalLoanAmount;

    // Prepare group initialization data for first periodic records
    return {
      totalGroupStanding,
      cashInBank: group.balanceInBank || 0,
      cashInHand: group.cashInHand || 0,
      monthlyContribution: group.monthlyContribution || 0,
      interestRate: group.interestRate || 0,
      collectionFrequency: group.collectionFrequency,
      members: group.members, // Pass members with their loan balances for interest calculation
    };
  }, [group]);

  const onSubmit = async (data: PeriodicRecordFormValues) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        meetingDate: data.meetingDate.toISOString(), // Ensure date is ISO string
        // Ensure numeric fields that might be empty strings are converted to null or number
        recordSequenceNumber: data.recordSequenceNumber ? Number(data.recordSequenceNumber) : null,
        standingAtStartOfPeriod: data.standingAtStartOfPeriod ? Number(data.standingAtStartOfPeriod) : 0,
        cashInBankAtEndOfPeriod: data.cashInBankAtEndOfPeriod ? Number(data.cashInBankAtEndOfPeriod) : 0,
        cashInHandAtEndOfPeriod: data.cashInHandAtEndOfPeriod ? Number(data.cashInHandAtEndOfPeriod) : 0,
        expensesThisPeriod: data.expensesThisPeriod ? Number(data.expensesThisPeriod) : 0,
        loanProcessingFeesCollectedThisPeriod: data.loanProcessingFeesCollectedThisPeriod ? Number(data.loanProcessingFeesCollectedThisPeriod) : 0,
        newMembersJoinedThisPeriod: data.newMembersJoinedThisPeriod ? Number(data.newMembersJoinedThisPeriod) : 0,
        memberRecords: data.memberRecords.map(mr => ({
          ...mr,
          compulsoryContribution: mr.compulsoryContribution ? Number(mr.compulsoryContribution) : 0,
          loanRepaymentPrincipal: mr.loanRepaymentPrincipal ? Number(mr.loanRepaymentPrincipal) : 0,
          lateFinePaid: mr.lateFinePaid ? Number(mr.lateFinePaid) : 0,
        })),
        // Calculated fields are already handled by the form's useEffect
      };

      const response = await fetch(`/api/groups/${groupId}/periodic-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create periodic record');
      }
      router.push(`/groups/${groupId}/periodic-records`);
      router.refresh(); // Ensure the list page is updated
    } catch (err: unknown) {
      console.error("Submission error:", err);
      if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError("An unknown error occurred during submission.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="container mx-auto p-4">Loading group details...</div>;
  if (error) return <div className="container mx-auto p-4 text-red-500">Error loading initial data: {error}</div>;
  if (!group) return <div className="container mx-auto p-4">Group not found.</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <Link href={`/groups/${groupId}/periodic-records`} className="text-blue-600 hover:underline">&larr; Back to Records List</Link>
      </div>
      
      {submitError && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">Error: {submitError}</p>}
      
      <PeriodicRecordForm
        groupId={groupId}
        groupName={group.name}
        groupFrequency={group.collectionFrequency}
        members={membersForForm}
        onSubmit={onSubmit}
        onCancel={() => router.push(`/groups/${groupId}/periodic-records`)}
        isLoading={isSubmitting}
        latestRecord={latestRecord ? {
          totalGroupStandingAtEndOfPeriod: latestRecord.totalGroupStandingAtEndOfPeriod ?? null,
          recordSequenceNumber: latestRecord.recordSequenceNumber ?? null,
          meetingDate: latestRecord.meetingDate ?? null,
          cashInBankAtEndOfPeriod: null,
          cashInHandAtEndOfPeriod: null
        } : {
          totalGroupStandingAtEndOfPeriod: null,
          recordSequenceNumber: null,
          meetingDate: null,
          cashInBankAtEndOfPeriod: null,
          cashInHandAtEndOfPeriod: null
        }}
        groupInitData={groupInitData || {
          totalGroupStanding: 0,
          cashInBank: 0,
          cashInHand: 0,
          monthlyContribution: 0,
          interestRate: 0,
          collectionFrequency: group.collectionFrequency,
          members: []
        }}
      />
    </div>
  );
}
