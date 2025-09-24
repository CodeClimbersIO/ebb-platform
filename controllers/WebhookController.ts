import { Router } from 'express'
import type { Request, Response } from 'express'
import { StripeService } from '../services/StripeService.js'
import { WebhookService } from '../services/WebhookService.js'
import { asyncHandler, ApiError } from '../middleware/errorHandler.js'
import type Stripe from 'stripe'

const router = Router()

const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['stripe-signature'] as string

  if (!signature) {
    throw new ApiError('No signature header received', 400)
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!endpointSecret) {
    throw new ApiError('Stripe webhook secret not configured', 500)
  }

  let event: Stripe.Event
  try {
    const stripe = StripeService.getStripeClient()
    event = await stripe.webhooks.constructEventAsync(
      req.body,
      signature,
      endpointSecret
    )
  } catch (err) {
    console.error(`Webhook signature verification failed: ${(err as Error).message}`)
    throw new ApiError(`Webhook signature verification failed: ${(err as Error).message}`, 400)
  }

  try {

    // what events occur during the subscription lifecycle for someone purchasing a subscription (annual or monthly)
    // 1. customer.subscription.created
    // 2. invoice.payment_failed
    // 3. customer.subscription.deleted

    // can a user cancel their own subscription through stripe or does it have to be done by the admin?

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log('checkout.session.completed', session)
        await WebhookService.handleCheckoutSessionCompleted(session)
        break
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.log('invoice.payment_failed', invoice.id)
        await WebhookService.handleInvoicePaymentFailed(invoice)
        break
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await WebhookService.handleSubscriptionDeleted(subscription)
        break
      }
    }

    res.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError('Webhook processing failed', 400)
  }
}

// Note: This endpoint should NOT use authentication middleware since it's called by Stripe
router.post('/stripe', asyncHandler(handleStripeWebhook))

export const WebhookController = {
  router,
  handleStripeWebhook
}