import Stripe from 'stripe'
import { ApiError } from '../middleware/errorHandler.js'
import { getProductConfig } from '../config/products.js'

let stripeClient: Stripe | null = null

const getStripeClient = (): Stripe => {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new ApiError('Stripe secret key not configured', 500)
    }
    
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2025-07-30.basil'
    })
  }
  return stripeClient
}

export interface CreateCheckoutSessionParams {
  userId: string
  userEmail?: string
  productId: string
}

const createCheckoutSession = async (params: CreateCheckoutSessionParams): Promise<string> => {
  const stripe = getStripeClient()
  
  const { userId, userEmail, productId } = params
  
  // Validate product ID and get configuration
  const productConfig = getProductConfig(productId)
  if (!productConfig) {
    throw new ApiError(`Invalid product ID: ${productId}`, 400)
  }

  // For products that use existing Stripe products, we need to fetch the default price
  // This approach gives you maximum flexibility to manage pricing in Stripe Dashboard
  const product = await stripe.products.retrieve(productId, {
    expand: ['default_price']
  })

  if (!product.default_price) {
    throw new ApiError(`Product ${productId} has no default price configured`, 422)
  }

  const priceId = typeof product.default_price === 'string' 
    ? product.default_price 
    : product.default_price.id

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'link'],
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    mode: 'subscription',
    success_url: 'https://ebb.cool/license/callback?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://ebb.cool/license/callback',
    client_reference_id: userId,
    customer_creation: 'always',
    ...(userEmail ? { customer_email: userEmail } : {}),
    allow_promotion_codes: true,
    metadata: {
      user_id: userId,
      product_id: productId
    }
  })

  if (!session.url) {
    throw new ApiError('Failed to create checkout session', 500)
  }

  return session.url
}

export const StripeService = {
  createCheckoutSession,
  getStripeClient
}