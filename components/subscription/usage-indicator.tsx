'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, Info } from 'lucide-react';
import { PaywallDialog } from './paywall-dialog';
import { FREE_DAILY_EDIT_LIMIT, PRO_MONTHLY_EDIT_LIMIT } from '@/data/constants';

interface UsageIndicatorProps {
  className?: string;
}

interface UsageData {
  editCount: number;
  monthlyEditCount: number;
  remainingEdits: number | null;
  remainingMonthlyEdits: number | null;
  isPro: boolean;
  limitReached: boolean;
  monthlyLimitReached: boolean;
  monthlyResetDate: string | null;
  hasUnlimitedEdits: boolean;
}

export function UsageIndicator({ className }: UsageIndicatorProps) {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    fetchUsageData();
    const handleUsageUpdate = () => {
      fetchUsageData();
    };
    window.addEventListener('usage-update', handleUsageUpdate);
    return () => {
      window.removeEventListener('usage-update', handleUsageUpdate);
    };
  }, []);

  const fetchUsageData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/subscription-status');
      if (response.ok) {
        const data = await response.json();
        setUsageData(data.usage);
      }
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgradeClick = () => {
    setShowPaywall(true);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-4 w-16 animate-pulse rounded bg-neutral-200" />
      </div>
    );
  }

  if (!usageData) {
    return null;
  }

  if (usageData.hasUnlimitedEdits) {
    return null;
  }

  // Don't show for pro users who haven't hit monthly limit
  if (usageData.isPro && !usageData.monthlyLimitReached) {
    return null;
  }

  const {
    editCount,
    monthlyEditCount,
    remainingEdits,
    remainingMonthlyEdits,
    limitReached,
    monthlyLimitReached,
  } = usageData;

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-1">
          <Info className="h-4 w-4 text-neutral-500" />
          <span className="text-xs text-neutral-600">
            {usageData.isPro
              ? monthlyLimitReached
                ? 'Monthly limit reached'
                : `${remainingMonthlyEdits} monthly edits left`
              : limitReached
                ? 'No free edits left'
                : `${remainingEdits} free edits left`}
          </span>
        </div>

        <Badge
          variant={
            limitReached || monthlyLimitReached ? 'destructive' : 'secondary'
          }
          className="text-xs"
        >
          {usageData.isPro ? `${monthlyEditCount}/${PRO_MONTHLY_EDIT_LIMIT}` : `${editCount}/${FREE_DAILY_EDIT_LIMIT}`}
        </Badge>

        {(limitReached || monthlyLimitReached) && (
          <Button
            size="sm"
            onClick={handleUpgradeClick}
            className="h-6 bg-blue-600 px-2 text-xs text-white hover:bg-blue-700"
          >
            {usageData.isPro ? 'Upgrade Plan' : 'Upgrade'}
          </Button>
        )}
      </div>

      <PaywallDialog
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        editCount={usageData.isPro ? monthlyEditCount : editCount}
        remainingEdits={
          (usageData.isPro ? remainingMonthlyEdits : remainingEdits) ?? 0
        }
        isMonthly={usageData.isPro}
      />
    </>
  );
}
