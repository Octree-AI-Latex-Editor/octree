'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Lock, CheckCircle } from 'lucide-react';
import { FREE_DAILY_EDIT_LIMIT, PRO_MONTHLY_EDIT_LIMIT } from '@/data/constants';

interface PaywallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editCount: number;
  remainingEdits: number;
  isMonthly?: boolean;
}

export function PaywallDialog({
  isOpen,
  onClose,
  editCount,
  remainingEdits,
  isMonthly = false,
}: PaywallDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      window.open('https://buy.stripe.com/6oUdR9fyd8Sd6Cifd46oo00', '_blank');
      onClose();
    } catch (error) {
      console.error('Error redirecting to checkout:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    `${PRO_MONTHLY_EDIT_LIMIT} AI-powered edits per month`,
    'Advanced LaTeX compilation',
    'Priority support',
    'Early access to new features',
    'Export to multiple formats',
  ];

  const limitType = isMonthly ? 'Monthly' : 'Daily';
  const maxEdits = isMonthly ? PRO_MONTHLY_EDIT_LIMIT : FREE_DAILY_EDIT_LIMIT;
  const limitText = isMonthly
    ? `You've used ${editCount} out of ${PRO_MONTHLY_EDIT_LIMIT} monthly AI edits. Upgrade to Pro for more!`
    : `You've used ${editCount} out of ${FREE_DAILY_EDIT_LIMIT} daily AI edits. Upgrade to Pro for ${PRO_MONTHLY_EDIT_LIMIT} edits per month!`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <Lock className="h-6 w-6 text-amber-500" />
            <DialogTitle className="text-xl">
              {limitType} Limit Reached
            </DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {limitText}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="rounded-lg bg-neutral-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-700">
                Your Usage
              </span>
              <Badge variant="secondary">
                {editCount}/{maxEdits} edits used
              </Badge>
            </div>
            <div className="h-2 w-full rounded-full bg-neutral-200">
              <div
                className="h-2 rounded-full bg-amber-500 transition-all duration-300"
                style={{ width: `${(editCount / maxEdits) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {remainingEdits > 0
                ? `${remainingEdits} edits remaining`
                : 'No edits remaining'}
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-neutral-900">
              Pro Features
            </h3>
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 text-sm text-neutral-700"
                >
                  <CheckCircle className="h-4 w-4 flex-shrink-0 text-blue-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleSubscribe}
              disabled={isLoading}
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
              size="lg"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  Redirecting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  {isMonthly ? 'Upgrade Plan' : 'Upgrade to Pro'}
                </div>
              )}
            </Button>

            <Button variant="outline" onClick={onClose} className="w-full">
              Maybe Later
            </Button>
          </div>

          <p className="text-center text-xs text-neutral-500">
            {isMonthly
              ? 'You can continue using the editor, but AI-powered edits require a plan upgrade.'
              : 'You can continue using the editor, but AI-powered edits require a Pro subscription.'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
