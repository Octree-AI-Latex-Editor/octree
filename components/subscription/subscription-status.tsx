'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Calendar, AlertCircle, CheckCircle, XCircle, Zap } from 'lucide-react';
import { PaywallDialog } from './paywall-dialog';

interface SubscriptionData {
  hasSubscription: boolean;
  subscription: {
    id: string;
    status: string;
    cancel_at_period_end: boolean;
    current_period_end: number;
    current_period_start: number;
    items: Array<{
      id: string;
      price: {
        id: string;
        unit_amount: number;
        currency: string;
        recurring: {
          interval: string;
        };
      };
    }>;
  } | null;
  usage: {
    editCount: number;
    monthlyEditCount: number;
    remainingEdits: number | null;
    remainingMonthlyEdits: number | null;
    isPro: boolean;
    limitReached: boolean;
    monthlyLimitReached: boolean;
    monthlyResetDate: string | null;
    hasUnlimitedEdits: boolean;
  };
}

export function SubscriptionStatus() {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/subscription-status');
      if (response.ok) {
        const data = await response.json();
        setSubscriptionData(data);
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgradeClick = () => {
    setShowPaywall(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription Status
          </CardTitle>
          <CardDescription>Loading subscription information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
            <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscriptionData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription Status
          </CardTitle>
          <CardDescription>Unable to load subscription information</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-600">Please try again later.</p>
        </CardContent>
      </Card>
    );
  }

  const { hasSubscription, subscription, usage } = subscriptionData;

  if (usage.hasUnlimitedEdits && !hasSubscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Unlimited AI Edits
          </CardTitle>
          <CardDescription>
            Your account has been granted unlimited AI edit credits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-700">Status</span>
            <Badge variant="secondary">Unlimited Access</Badge>
          </div>

          <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-neutral-600">
              You can continue using AI-powered edits without any usage limits.
            </p>
            <div className="text-xs text-neutral-500">
              Lifetime edits used:{' '}
              <span className="font-medium text-neutral-700">{usage.editCount}</span>
            </div>
            <div className="text-xs text-neutral-500">
              Monthly edits used:{' '}
              <span className="font-medium text-neutral-700">{usage.monthlyEditCount}</span>
            </div>
            {usage.monthlyResetDate && (
              <p className="text-xs text-neutral-500">
                Monthly usage resets on{' '}
                {new Date(usage.monthlyResetDate).toLocaleDateString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasSubscription && subscription) {
    const isActive = subscription.status === 'active';
    const isCancelling = subscription.cancel_at_period_end;
    const periodEnd = new Date(subscription.current_period_end * 1000);
    const periodStart = new Date(subscription.current_period_start * 1000);
    const hasUnlimitedAccess = usage.hasUnlimitedEdits;

    const price = subscription.items[0]?.price;
    const amount = price ? (price.unit_amount / 100).toFixed(2) : '0.00';
    const currency = price?.currency?.toUpperCase() || 'USD';
    const interval = price?.recurring?.interval || 'month';

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription Status
          </CardTitle>
          <CardDescription>Manage your subscription and billing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-700">Status</span>
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? 'Active' : subscription.status}
            </Badge>
          </div>

          {isCancelling && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-md">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-orange-700">
                Your subscription will end on {periodEnd.toLocaleDateString()}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-neutral-700">Current Plan</label>
              <p className="text-sm text-neutral-500">
                {amount} {currency}/{interval}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700">Billing Period</label>
              <p className="text-sm text-neutral-500">
                {periodStart.toLocaleDateString()} - {periodEnd.toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-700">AI Edits Used</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">
                {hasUnlimitedAccess
                  ? 'Unlimited edits enabled'
                  : (subscription.status === 'active'
                    ? `${usage.monthlyEditCount}/50 monthly edits`
                    : `${usage.editCount} edits`)
                }
              </span>
              {hasUnlimitedAccess ? (
                <Zap className="h-4 w-4 text-blue-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </div>
          </div>

          {subscription.status === 'active' && (
            hasUnlimitedAccess ? (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  Unlimited AI edits have been granted to your account. We'll still track usage,
                  but no limits apply this billing cycle.
                </p>
                {usage.monthlyResetDate && (
                  <p className="text-xs text-blue-600 mt-2">
                    Tracking resets on {new Date(usage.monthlyResetDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-700">Monthly Usage</span>
                  <Badge variant="outline" className="text-xs">
                    {usage.remainingMonthlyEdits} remaining
                  </Badge>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(usage.monthlyEditCount / 50) * 100}%` }}
                  />
                </div>
                {usage.monthlyResetDate && (
                  <p className="text-xs text-blue-600 mt-2">
                    Resets on {new Date(usage.monthlyResetDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            )
          )}

          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/billing">View Billing History</a>
            </Button>
            <Button asChild size="sm">
              <a href="https://buy.stripe.com/6oUdR9fyd8Sd6Cifd46oo00" target="_blank" rel="noopener noreferrer">
                Change Plan
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No subscription - show usage and upgrade options
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription Status
          </CardTitle>
          <CardDescription>You don't have an active subscription</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Usage Summary */}
          <div className="bg-neutral-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-700">Your Usage</span>
              <Badge variant={usage.limitReached ? "destructive" : "secondary"}>
                {usage.editCount}/5 edits used
              </Badge>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2">
              <div 
                className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(usage.editCount / 5) * 100}%` }}
              />
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              {usage.remainingEdits > 0 ? `${usage.remainingEdits} edits remaining` : 'No edits remaining'}
            </p>
          </div>

          <div className="text-sm text-neutral-600">
            {usage.limitReached 
              ? 'You have reached your free edit limit. Upgrade to Pro for 50 edits per month!'
              : 'Upgrade to unlock 50 edits per month and remove daily limitations.'
            }
          </div>

          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-700">Pro Plan Benefits</span>
            </div>
            <ul className="space-y-1 text-xs text-blue-700">
              <li>• 50 AI edits per month (vs 5 per day)</li>
              <li>• Monthly reset instead of daily</li>
              <li>• Advanced LaTeX compilation</li>
              <li>• Priority support</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleUpgradeClick}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {usage.limitReached ? 'Upgrade Now' : 'Subscribe Now'}
            </Button>
            <Button variant="outline" asChild>
              <a href="/pricing">View Plans</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <PaywallDialog
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        editCount={usage.editCount}
        remainingEdits={usage.remainingEdits}
      />
    </>
  );
} 