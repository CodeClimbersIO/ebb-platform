import { LicenseRepo, type LicenseStatus } from '../repos/License.js'
import { getProductConfigByProductId } from '../config/products.js'
import { ApiError } from '../middleware/errorHandler.js'
import { EmailService } from './EmailService.js'
import { NotificationEngine } from './NotificationEngine.js'
import { getNotificationConfig } from '../config/notifications.js'
import type Stripe from 'stripe'

// Shared notification engine instance
const getNotificationEngine = (): NotificationEngine => {
  const config = getNotificationConfig()
  return new NotificationEngine(config)
}

const handleCheckoutSessionCompleted = async (session: Stripe.Checkout.Session): Promise<void> => {
  const customerId = session.customer as string
  const userId = session.client_reference_id || session.metadata?.user_id
  const productId = session.metadata?.product_id
  
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


const handleSubscriptionDeleted = async (subscription: Stripe.Subscription): Promise<void> => {
  const updatedLicense = await LicenseRepo.updateLicenseByStripePaymentId(subscription.id, 'expired')

  if (!updatedLicense) {
    console.warn(`Failed to update license status for deleted subscription ${subscription.id}. Maybe it didn't exist?`)
  } else {
    console.log(`License expired for subscription ${subscription.id}`)
  }
}

const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice): Promise<void> => {
  console.log('Payment failed for invoice:', invoice.id)
  
  // Send email notification if customer email is available
  if (invoice.customer_email) {
    try {
      await EmailService.sendPaymentFailureEmail({
        customerEmail: invoice.customer_email,
        customerName: invoice.customer_name as string | undefined,
        amountDue: invoice.amount_due,
        currency: invoice.currency
      })

      console.log(`Payment failure email sent to ${invoice.customer_email}`)
    } catch (error) {
      console.error('Failed to send payment failure email:', error)
      // Don't throw - we don't want email failures to break webhook processing
    }
  } else {
    console.warn('No customer email found for failed payment, skipping email notification')
  }

  // Send Discord notification using NotificationEngine
  try {
    const notificationEngine = getNotificationEngine()
    
    await notificationEngine.sendNotification({
      type: 'payment_failed',
      user: {
        id: invoice.customer as string || 'unknown',
        email: invoice.customer_email || 'No email available'
      },
      referenceId: `payment_failed_${invoice.id}`,
      data: {
        invoice_id: invoice.id,
        amount_due: invoice.amount_due,
        currency: invoice.currency,
        customer_name: invoice.customer_name,
        formatted_amount: `${invoice.currency.toUpperCase()} $${(invoice.amount_due / 100).toFixed(2)}`
      }
    }, ['discord'])

    console.log(`Discord notification sent for payment failure: ${invoice.id}`)
  } catch (error) {
    console.error('Failed to send Discord notification for payment failure:', error)
    // Don't throw - we don't want Discord failures to break webhook processing
  }
}

export const WebhookService = {
  handleCheckoutSessionCompleted,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
}