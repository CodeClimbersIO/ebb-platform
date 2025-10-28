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
    // if we have a free trial license, we need to update it to end now
    const existingTrialLicense = await LicenseRepo.getFreeTrialLicenseByUserId(userId)
    console.log('Existing trial license:', existingTrialLicense)
    if (existingTrialLicense) {
      console.log('Updating existing trial license')
      await LicenseRepo.updateLicense(existingTrialLicense.id, {
        status: 'active',
        license_type: productConfig.licenseType,
        stripe_payment_id: session.subscription as string,
        expiration_date: undefined,
        updated_at: new Date()
      })
      return
    }

    console.log('Checking for existing subscription license')
    const existingSubscriptionLicense = await LicenseRepo.getExistingSubscriptionLicenseByUserId(userId)
    console.log('Existing subscription license:', existingSubscriptionLicense)
    if (existingSubscriptionLicense) {
      console.log('Updating existing subscription license')
      await LicenseRepo.updateLicense(existingSubscriptionLicense.id, {
        status: 'active',
        stripe_payment_id: session.subscription as string,
        expiration_date: undefined,
        updated_at: new Date()
      })
      console.log('Existing subscription license updated')
      return
    }
    console.log('Creating new subscription license')
    await LicenseRepo.createLicense({
      user_id: userId,
      status: 'active',
      license_type: productConfig.licenseType,
      purchase_date: new Date(),
      stripe_customer_id: customerId,
      stripe_payment_id: session.subscription as string,
      expiration_date: undefined,
    })
    console.log(`License created for user ${userId} with checkout session ${session.id}`)

    // Send Discord notification for successful checkout
    try {
      const notificationEngine = getNotificationEngine()

      await notificationEngine.sendNotification({
        type: 'checkout_completed',
        user: {
          id: userId,
          email: session.customer_details?.email || session.customer_email || 'N/A'
        },
        referenceId: `checkout_completed_${session.id}`,
        data: {
          session_id: session.id,
          customer_id: customerId,
          subscription_id: session.subscription,
          product_id: productId,
          license_type: productConfig.licenseType,
          amount_total: session.amount_total,
          currency: session.currency
        }
      }, ['discord'])

      console.log(`Discord notification sent for successful checkout: ${session.id}`)
    } catch (error) {
      console.error('Failed to send Discord notification for checkout completion:', error)
      // Don't throw - we don't want Discord failures to break webhook processing
    }
  }
}


const handleSubscriptionUpdated = async (subscription: Stripe.Subscription): Promise<void> => {
  console.log('subscription', subscription)

  // Get license info
  const license = await LicenseRepo.getLicenseByCustomerId(subscription.customer as string)

  if (!license) {
    console.warn(`No license found for customer ${subscription.customer}`)
    return
  }

  // Check if subscription was just marked for cancellation
  if (subscription.cancel_at_period_end && subscription.cancel_at) {
    console.log(`Subscription ${subscription.id} marked for cancellation at period end`)

    // Set expiration date to when subscription will cancel
    const expirationDate = new Date(subscription.cancel_at * 1000)
    await LicenseRepo.updateLicense(license.id, {
      expiration_date: expirationDate,
      updated_at: new Date()
    })

    console.log(`Expiration date set to ${expirationDate.toISOString()} for license ${license.id}`)

    // Send Discord notification for cancellation request
    try {
      const notificationEngine = getNotificationEngine()

      await notificationEngine.sendNotification({
        type: 'subscription_cancelled',
        user: {
          id: license.user_id || 'unknown',
          email: 'N/A' // Email not available in subscription object
        },
        referenceId: `subscription_cancel_requested_${subscription.id}`,
        data: {
          subscription_id: subscription.id,
          customer_id: subscription.customer,
          license_id: license.id,
          cancel_at: subscription.cancel_at,
          cancel_at_period_end: subscription.cancel_at_period_end,
          expiration_date: expirationDate,
          status: subscription.status,
          message: 'User requested cancellation - will expire at period end'
        }
      }, ['discord'])

      console.log(`Discord notification sent for subscription cancellation request: ${subscription.id}`)
    } catch (error) {
      console.error('Failed to send Discord notification for cancellation request:', error)
      // Don't throw - we don't want Discord failures to break webhook processing
    }
  } else {
    // Subscription was reactivated or updated - remove expiration date if it exists
    if (license.expiration_date) {
      console.log(`Subscription ${subscription.id} reactivated - removing expiration date`)

      await LicenseRepo.updateLicense(license.id, {
        expiration_date: undefined,
        status: 'active',
        updated_at: new Date()
      })

      console.log(`Expiration date removed for license ${license.id}`)
    }
  }
}

const handleSubscriptionDeleted = async (subscription: Stripe.Subscription): Promise<void> => {
  console.log('subscription', subscription)
  const updatedLicense = await LicenseRepo.updateLicenseByCustomerId(subscription.customer as string, 'expired')

  if (!updatedLicense) {
    console.warn(`Failed to update license status for deleted subscription ${subscription.id}. Maybe it didn't exist?`)
  } else {
    console.log(`License expired for subscription ${subscription.id}`)

    // Send Discord notification for subscription cancellation
    try {
      
      const notificationEngine = getNotificationEngine()

      await notificationEngine.sendNotification({
        type: 'subscription_expired',
        user: {
          id: updatedLicense.user_id || 'unknown',
          email: 'N/A' // Email not available in subscription object
        },
        referenceId: `subscription_expired_${subscription.id}`,
        data: {
          subscription_id: subscription.id,
          customer_id: subscription.customer,
          license_id: updatedLicense.id,
          expired_at: new Date(),
          status: subscription.status
        }
      }, ['discord'])

      console.log(`Discord notification sent for subscription cancellation: ${subscription.id}`)
    } catch (error) {
      console.error('Failed to send Discord notification for subscription cancellation:', error)
      // Don't throw - we don't want Discord failures to break webhook processing
    }
  }
}

const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice): Promise<void> => {
  console.log('Payment failed for invoice:', invoice.id)
  
  // Send email notification if customer email is available
  // if (invoice.customer_email) {
  //   try {
  //     await EmailService.sendPaymentFailureEmail({
  //       customerEmail: invoice.customer_email,
  //       customerName: invoice.customer_name as string | undefined,
  //       amountDue: invoice.amount_due,
  //       currency: invoice.currency
  //     })

  //     console.log(`Payment failure email sent to ${invoice.customer_email}`)
  //   } catch (error) {
  //     console.error('Failed to send payment failure email:', error)
  //     // Don't throw - we don't want email failures to break webhook processing
  //   }
  // } else {
  //   console.warn('No customer email found for failed payment, skipping email notification')
  // }

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
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
}