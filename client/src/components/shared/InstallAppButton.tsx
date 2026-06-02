import { Download, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function InstallAppButton() {
  const { canInstall, isInstalled, showIOSInstructions, install } = usePWAInstall();

  if (isInstalled) return null;

  return (
    <>
      {canInstall && (
        <Button variant="outline" size="sm" onClick={install} className="no-print">
          <Download className="h-4 w-4" />
          <span className="hidden xs:inline sm:inline">Install App</span>
        </Button>
      )}
      {showIOSInstructions && !canInstall && (
        <div className="no-print flex items-center gap-1.5 text-xs text-muted-foreground max-w-[140px] sm:max-w-none">
          <Share className="h-3.5 w-3.5 shrink-0 hidden sm:block" />
          <span className="hidden sm:inline">
            On iPhone: tap the Share button then Add to Home Screen
          </span>
          <span className="sm:hidden">Share → Add to Home Screen</span>
        </div>
      )}
    </>
  );
}
