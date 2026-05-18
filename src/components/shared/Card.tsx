import * as React from 'react';
import { cn } from '@/lib/utils';

type CardVariant = 'default' | 'elevated' | 'flush';

export function Card({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  const base = 'rounded-xl border border-border';
  const style =
    variant === 'elevated'
      ? 'surface-glass shadow-card-hover'
      : variant === 'flush'
        ? 'bg-surface'
        : 'surface-glass';
  return <div className={cn(base, style, className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-border px-4 py-3',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  icon,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { icon?: React.ReactNode }) {
  return (
    <h3
      className={cn(
        'flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-text-dim',
        className,
      )}
      {...props}>
      {icon && <span className="text-text-muted">{icon}</span>}
      {children}
    </h3>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}
