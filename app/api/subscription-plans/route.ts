import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_PROD_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function GET() {
  try {
    // Fetch all active prices from Stripe
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
      type: 'recurring',
    });

    // Transform the data to a more frontend-friendly format
    const plans = prices.data.map((price) => {
      const product = price.product as Stripe.Product;
      return {
        id: price.id,
        name: product.name,
        description: product.description,
        price: price.unit_amount ? price.unit_amount / 100 : 0, // Convert from cents to dollars
        currency: price.currency,
        interval: price.recurring?.interval,
        features: product.metadata.features
      };
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return NextResponse.json(
      { error: 'Error fetching subscription plans' },
      { status: 500 }
    );
  }
}
