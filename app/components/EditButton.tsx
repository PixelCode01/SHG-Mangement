'use client';

import Link from 'next/link';

interface EditButtonProps {
  groupId?: string;
  href?: string;
}

export default function EditButton({ groupId, href }: EditButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    // Prevent event from bubbling up to parent elements
    e.stopPropagation();
  };

  const linkHref = href || (groupId ? `/groups/${groupId}/edit` : '#');

  return (
    <Link
      href={linkHref}
      className="p-1 text-muted hover:text-primary transition-colors rounded-full"
      title="Edit group"
      onClick={handleClick}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </Link>
  );
} 