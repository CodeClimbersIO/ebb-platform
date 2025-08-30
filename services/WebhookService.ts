import { LicenseRepo, type LicenseStatus } from '../repos/License.js'
import { getProductConfigByProductId } from '../config/products.js'
import { ApiError } from '../middleware/errorHandler.js'
import type Stripe from 'stripe'

const handleCheckoutSessionCompleted = async (session: Stripe.Checkout.Session): Promise<void> => {
  const customerId = session.customer as string
  const userId = session.client_reference_id || session.metadata?.user_id
  const productId = session.metadata?.product_id

  console.log('handleCheckoutSessionCompleted', session)
  console.log('session', JSON.stringify(session, null, 2))
  console.log('customerId', customerId)
  console.log('userId', userId)
  console.log('productId', productId)
  
  if (!userId) {
    console.error('Webhook Error: No user ID found in checkout session.')
    throw new ApiError('No user ID found in session', 422)
  }

  if (!productId) {
    console.error('Webhook Error: No product ID found in session metadata.')
    throw new ApiError('No product ID found in session', 422)
  }

  const productConfig = getProductConfigByProductId(productId)
  if (!productConfig) {
    console.error(`Webhook Error: Unknown product ID: ${productId}`)
    throw new ApiError(`Unknown product ID: ${productId}`, 422)
  }

  // Only create license for subscription mode (one-time payments handled elsewhere)
  if (session.mode === 'subscription') {
    await LicenseRepo.createLicense({
      user_id: userId,
      status: 'active',
      license_type: productConfig.licenseType,
      purchase_date: new Date(),
      stripe_customer_id: customerId,
      stripe_payment_id: session.subscription as string,
    })

    console.log(`License created for user ${userId} with checkout session ${session.id}`)
  }
}

const handleSubscriptionUpdated = async (subscription: Stripe.Subscription): Promise<void> => {
  const customerId = subscription.customer as string
  let userId: string | null | undefined = subscription.metadata?.user_id

  if (!userId) {
    console.warn(`No user_id found in subscription metadata for subscription ${subscription.id}`)
    throw new ApiError('No user ID found for subscription', 422)
  }

  const firstItem = subscription.items.data[0]
  if (!firstItem || !firstItem.price?.product) {
    console.error('Webhook Error: No product found in subscription items.')
    throw new ApiError('No product found in subscription', 422)
  }

  const productId = typeof firstItem.price.product === 'string' 
    ? firstItem.price.product 
    : firstItem.price.product.id

  const productConfig = getProductConfigByProductId(productId)
  if (!productConfig) {
    console.error(`Webhook Error: Unknown product ID in subscription: ${productId}`)
    throw new ApiError(`Unknown product ID in subscription: ${productId}`, 422)
  }

  const status = subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : 'expired'

  await LicenseRepo.updateLicenseByStripePaymentId(subscription.id, status as LicenseStatus)

  console.log(`License updated for user ${userId} with subscription ${subscription.id}, status: ${status}`)
}

const handleSubscriptionDeleted = async (subscription: Stripe.Subscription): Promise<void> => {
  const updatedLicense = await LicenseRepo.updateLicenseByStripePaymentId(subscription.id, 'expired')

  if (!updatedLicense) {
    console.warn(`Failed to update license status for deleted subscription ${subscription.id}. Maybe it didn't exist?`)
  } else {
    console.log(`License expired for subscription ${subscription.id}`)
  }
}

export const WebhookService = {
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
}