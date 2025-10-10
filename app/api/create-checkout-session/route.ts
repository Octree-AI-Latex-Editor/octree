import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getBaseUrl } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_PROD_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to subscribe.' },
        { status: 401 }
      );
    }

    const { priceId } = await request.json();
    
    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();

    // Check if customer already exists
    let customer: Stripe.Customer | null = null;
    
    // Try to find existing customer by email
    const existingCustomers = await stripe.customers.list({
      email: user.email!,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      // Create new customer with user metadata
      customer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          supabase_user_id: user.id,
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customer.id,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/projects?success=true`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: {
        supabase_user_id: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Error creating checkout session' },
      { status: 500 }
    );
  }
}
