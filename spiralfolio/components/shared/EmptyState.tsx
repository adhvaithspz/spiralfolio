import * as React from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/40 px-6 py-10 text-center',
        className
      )}>
      <div className="text-sm font-medium text-text">{title}</div>
      {description && <div className="mt-1 max-w-md text-[12px] text-text-muted">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
