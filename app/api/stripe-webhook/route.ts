import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_PROD_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        
        if (subscription.customer) {
          const customer = await stripe.customers.retrieve(subscription.customer as string);
          
          if (customer && !customer.deleted) {
            const customerData = customer as Stripe.Customer;
            
            console.log(`Processing subscription ${subscription.id} for customer ${customerData.id}`);
            
            // Find user by email or metadata
            let user = null;
            
            // Try email first
            if (customerData.email) {
              const { data: userData } = await supabase.auth.admin.listUsers();
              user = userData.users.find(u => u.email === customerData.email);
              console.log(`Found user by email ${customerData.email}:`, user?.id);
            }
            
            // Try user_id metadata
            if (!user && customerData.metadata?.user_id) {
              const { data: userData } = await supabase.auth.admin.getUserById(
                customerData.metadata.user_id
              );
              user = userData.user;
              console.log(`Found user by user_id metadata:`, user?.id);
            }
            
            // Try supabase_user_id metadata
            if (!user && customerData.metadata?.supabase_user_id) {
              const { data: userData } = await supabase.auth.admin.getUserById(
                customerData.metadata.supabase_user_id
              );
              user = userData.user;
              console.log(`Found user by supabase_user_id metadata:`, user?.id);
            }
            
            if (user) {
              try {
                const result = await supabase.rpc('update_user_subscription_status', {
                  p_user_id: user.id,
                  p_stripe_customer_id: customerData.id,
                  p_stripe_subscription_id: subscription.id,
                  p_subscription_status: subscription.status,
                  p_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                  p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                  p_cancel_at_period_end: subscription.cancel_at_period_end
                });
                
                console.log(`Updated subscription status for user ${user.id}: ${subscription.status}`, result);
              } catch (error) {
                console.error('Error updating subscription status:', error);
              }
            } else {
              console.error(`No user found for customer ${customerData.id} with email ${customerData.email}`);
            }
          }
        }
        break;
        
      case 'customer.subscription.trial_will_end':
        console.log('Trial will end event received');
        break;
        
      case 'invoice.payment_succeeded':
        console.log('Payment succeeded event received');
        break;
        
      case 'invoice.payment_failed':
        console.log('Payment failed event received');
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
