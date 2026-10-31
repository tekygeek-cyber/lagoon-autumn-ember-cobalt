import { Activity } from "lucide-react";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-fg">
        <Activity className="size-5" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-wide">Groww Connect</span>
        {compact ? null : <span className="block text-xs text-muted">Nifty 100 desk</span>}
      </span>
    </div>
  );
}
