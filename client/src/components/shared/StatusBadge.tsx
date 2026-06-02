import { cn, getStatusColor, getStatusLabel } from '@/lib/utils';

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white', getStatusColor(status), className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
      {getStatusLabel(status)}
    </span>
  );
}
