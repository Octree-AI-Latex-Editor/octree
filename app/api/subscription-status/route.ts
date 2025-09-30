import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';
import { hasUnlimitedEdits } from '@/lib/paywall';

const stripe = new Stripe(process.env.STRIPE_PROD_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const hasUnlimitedUser = hasUnlimitedEdits(user.email);

    // Get current usage from database
    const { data: usageData, error: usageError } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', user.id)
      .single();

    let finalUsageData = usageData;

    // If no usage record exists, create one
    if (usageError && usageError.code === 'PGRST116') {
      console.log('Creating new user_usage record for user:', user.id);
      const { data: newUsageData, error: createError } = await supabase
        .from('user_usage')
        .insert({
          user_id: user.id,
          edit_count: 0,
          monthly_edit_count: 0,
          monthly_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
          is_pro: hasUnlimitedUser,
          subscription_status: hasUnlimitedUser ? 'unlimited' : 'inactive'
        })
        .select('*')
        .single();
      
      if (createError) {
        console.error('Error creating user_usage record:', createError);
        return NextResponse.json(
          { error: 'Failed to create usage record' },
          { status: 500 }
        );
      }
      finalUsageData = newUsageData;
    } else if (usageError) {
      console.error('Error fetching usage data:', usageError);
      return NextResponse.json(
        { error: 'Failed to fetch usage data' },
        { status: 500 }
      );
    }

    // Check if monthly reset is needed
    if (finalUsageData && finalUsageData.monthly_reset_date) {
      const resetDate = new Date(finalUsageData.monthly_reset_date);
      const currentDate = new Date();
      if (currentDate >= resetDate) {
        const { error: resetError } = await supabase
          .from('user_usage')
          .update({
            monthly_edit_count: 0,
            monthly_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          })
          .eq('user_id', user.id);
        if (!resetError) {
          finalUsageData.monthly_edit_count = 0;
        }
      }
    }

    if (hasUnlimitedUser && finalUsageData) {
      const hasPaidStatus = ['active', 'trialing'].includes(
        finalUsageData.subscription_status ?? ''
      );
      const needsUnlimitedUpdate =
        !finalUsageData.is_pro ||
        (!hasPaidStatus && finalUsageData.subscription_status !== 'unlimited');

      if (needsUnlimitedUpdate) {
        const { data: updatedUnlimitedData, error: unlimitedUpdateError } = await supabase
          .from('user_usage')
          .update({
            is_pro: true,
            subscription_status: hasPaidStatus
              ? finalUsageData.subscription_status
              : 'unlimited'
          })
          .eq('user_id', user.id)
          .select('*')
          .single();

        if (!unlimitedUpdateError && updatedUnlimitedData) {
          finalUsageData = updatedUnlimitedData;
        }
      }
    }

    // Try to find Stripe customer by email first
    let customer = null;
    try {
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });
      customer = customers.data[0];
    } catch (error) {
      console.error('Error fetching customer by email:', error);
    }

    // If not found by email, try by metadata
    if (!customer) {
      try {
        const customers = await stripe.customers.list({
          limit: 100,
        });
        customer = customers.data.find(c => 
          c.metadata?.user_id === user.id || 
          c.metadata?.supabase_user_id === user.id
        );
      } catch (error) {
        console.error('Error fetching customer by metadata:', error);
      }
    }

    if (!customer) {
      const editCount = finalUsageData?.edit_count || 0;
      const monthlyEditCount = finalUsageData?.monthly_edit_count || 0;
      const baseRemainingEdits = Math.max(0, 5 - editCount);

      return NextResponse.json({
        hasSubscription: false,
        subscription: null,
        usage: {
          editCount,
          monthlyEditCount,
          remainingEdits: hasUnlimitedUser ? null : baseRemainingEdits,
          remainingMonthlyEdits: hasUnlimitedUser ? null : 0,
          isPro: hasUnlimitedUser ? true : (finalUsageData?.is_pro || false),
          limitReached: hasUnlimitedUser ? false : baseRemainingEdits <= 0,
          monthlyLimitReached: false,
          monthlyResetDate: finalUsageData?.monthly_reset_date || null,
          hasUnlimitedEdits: hasUnlimitedUser
        }
      });
    }

    // Get subscriptions for this customer
    // Only consider active or trialing subscriptions so cancelled users can resubscribe
    let subscription: Stripe.Subscription | null = null;

    const activeSubs = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });
    subscription = activeSubs.data[0] || null;

    if (!subscription) {
      const trialSubs = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'trialing',
        limit: 1,
      });
      subscription = trialSubs.data[0] || null;
    }

    if (!subscription) {
      const editCount = finalUsageData?.edit_count || 0;
      const monthlyEditCount = finalUsageData?.monthly_edit_count || 0;
      const baseRemainingEdits = Math.max(0, 5 - editCount);

      return NextResponse.json({
        hasSubscription: false,
        subscription: null,
        usage: {
          editCount,
          monthlyEditCount,
          remainingEdits: hasUnlimitedUser ? null : baseRemainingEdits,
          remainingMonthlyEdits: hasUnlimitedUser ? null : 0,
          isPro: hasUnlimitedUser ? true : (finalUsageData?.is_pro || false),
          limitReached: hasUnlimitedUser ? false : baseRemainingEdits <= 0,
          monthlyLimitReached: false,
          monthlyResetDate: finalUsageData?.monthly_reset_date || null,
          hasUnlimitedEdits: hasUnlimitedUser
        }
      });
    }

    // Update database with latest subscription info
    try {
      await supabase.rpc('update_user_subscription_status', {
        p_user_id: user.id,
        p_stripe_customer_id: customer.id,
        p_stripe_subscription_id: subscription.id,
        p_subscription_status: subscription.status,
        p_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        p_cancel_at_period_end: subscription.cancel_at_period_end
      });
    } catch (error) {
      console.error('Error updating subscription status in database:', error);
    }

    const editCount = finalUsageData?.edit_count || 0;
    const monthlyEditCount = finalUsageData?.monthly_edit_count || 0;
    const isActive = subscription.status === 'active';
    const baseRemainingEdits = isActive
      ? Math.max(0, 50 - monthlyEditCount)
      : Math.max(0, 5 - editCount);

    return NextResponse.json({
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_end: subscription.current_period_end,
        current_period_start: subscription.current_period_start,
        items: subscription.items.data.map(item => ({
          id: item.id,
          price: {
            id: item.price.id,
            unit_amount: item.price.unit_amount,
            currency: item.price.currency,
            recurring: item.price.recurring,
          },
        })),
      },
      usage: {
        editCount,
        monthlyEditCount,
        remainingEdits: hasUnlimitedUser ? null : baseRemainingEdits,
        remainingMonthlyEdits: hasUnlimitedUser
          ? null
          : (isActive ? baseRemainingEdits : 0),
        isPro: (subscription.status === 'active') || hasUnlimitedUser,
        limitReached: hasUnlimitedUser
          ? false
          : (isActive
            ? monthlyEditCount >= 50
            : editCount >= 5),
        monthlyLimitReached: hasUnlimitedUser
          ? false
          : (isActive ? monthlyEditCount >= 50 : false),
        monthlyResetDate: finalUsageData?.monthly_reset_date || null,
        hasUnlimitedEdits: hasUnlimitedUser
      }
    });

  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
}
