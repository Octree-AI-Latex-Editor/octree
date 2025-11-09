'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/navbar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, CreditCard, Loader2 } from 'lucide-react';
import { User } from '@supabase/supabase-js';

interface BillingSummary {
  totalPaid: number;
  invoiceCount: number;
  nextBilling: number | null;
}

interface Invoice {
  id: string;
  date: number;
  amount: number;
  status: string;
  description: string;
  currency: string;
}

interface PaymentMethod {
  id: string;
  type: string;
  card: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
}

export default function BillingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [billingData, setBillingData] = useState<{
    billingSummary: BillingSummary;
    invoices: Invoice[];
    paymentMethods: PaymentMethod[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserAndBillingData = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push('/auth/login');
          return;
        }

        setUser(session.user);

        const response = await fetch('/api/billing');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch billing data');
        }

        setBillingData(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserAndBillingData();
  }, [router]);

  const userName = user?.user_metadata?.name ?? user?.email ?? null;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatAmount = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getCardBrandIcon = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa':
        return 'V';
      case 'mastercard':
        return 'M';
      case 'amex':
        return 'A';
      case 'discover':
        return 'D';
      default:
        return '•';
    }
  };

  if (isLoading) {
    return (
      <>
        <Navbar userName={userName} />
        <main className="container mx-auto px-4 py-8">
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar userName={userName} />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-red-600">Error: {error}</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar userName={userName} />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">Billing</h1>
          <p className="text-sm text-neutral-500">
            View your billing activity and payment methods
          </p>
        </div>

        <div className="space-y-6">
          {/* Billing Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Billing Summary
              </CardTitle>
              <CardDescription>
                Overview of your billing activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm font-medium text-neutral-700">
                    Total Paid
                  </p>
                  <p className="text-2xl font-bold text-neutral-900">
                    {formatAmount(billingData?.billingSummary.totalPaid || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-700">
                    Invoices
                  </p>
                  <p className="text-2xl font-bold text-neutral-900">
                    {billingData?.billingSummary.invoiceCount || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-700">
                    Next Billing
                  </p>
                  <p className="text-2xl font-bold text-neutral-900">
                    {billingData?.billingSummary.nextBilling
                      ? formatDate(billingData.billingSummary.nextBilling)
                      : 'No active subscription'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice History
              </CardTitle>
              <CardDescription>Your recent invoices</CardDescription>
            </CardHeader>
            <CardContent>
              {billingData?.invoices && billingData.invoices.length > 0 ? (
                <div className="space-y-4">
                  {billingData.invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <p className="font-medium text-neutral-900">
                            {invoice.description}
                          </p>
                          <p className="text-sm text-neutral-500">
                            {formatDate(invoice.date)}
                          </p>
                          <p className="text-xs text-neutral-400">
                            Status: {invoice.status}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-medium text-neutral-900">
                          {formatAmount(invoice.amount, invoice.currency)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-neutral-500">
                  No invoices found
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Methods
              </CardTitle>
              <CardDescription>Your saved payment methods</CardDescription>
            </CardHeader>
            <CardContent>
              {billingData?.paymentMethods &&
              billingData.paymentMethods.length > 0 ? (
                <div className="space-y-4">
                  {billingData.paymentMethods.map((pm) => (
                    <div
                      key={pm.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                          <span className="font-medium text-blue-600">
                            {pm.card ? getCardBrandIcon(pm.card.brand) : '•'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">
                            {pm.card
                              ? `${pm.card.brand} ending in ${pm.card.last4}`
                              : 'Payment method'}
                          </p>
                          {pm.card && (
                            <p className="text-sm text-neutral-500">
                              Expires {pm.card.expMonth}/{pm.card.expYear}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Update
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-neutral-500">
                  No payment methods found
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
