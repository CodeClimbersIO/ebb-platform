import { beforeEach, describe, expect, test, mock } from 'bun:test'
import { WebhookService } from '../../services/WebhookService.js'
import { LicenseRepo } from '../../repos/License.js'
import type Stripe from 'stripe'

mock.module('../../repos/License.js', () => ({
  LicenseRepo: {
    createLicense: mock(() => Promise.resolve({ id: 'license-123' })),
    updateLicenseByStripePaymentId: mock(() => Promise.resolve({ id: 'license-123' }))
  }
}))

let defaultMockSession = {
  id: 'cs_test_b17yWHosFRVEk62aEegAVsREUlB415PcJqoS1B2ZNEGnVMgVm0Bfpnyz1C',
  object: 'checkout.session',
  customer: 'cus_Sxs0V3mlJjxzg7',
  client_reference_id: '9a4f2bc8-3cac-4345-81a1-78da85dd1dc6',
  created: 1756589109,
  mode: 'subscription',
  status: 'complete',
  payment_status: 'paid',
  subscription: 'sub_1S1wGyAuvxsld26UyyEWlujr',
  metadata: {
    user_id: '9a4f2bc8-3cac-4345-81a1-78da85dd1dc6',
    product_id: 'prod_SxoT12GtQeAlIE'
  },
  success_url: 'https://ebb.cool/license/callback?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://ebb.cool/license/callback'
} as unknown as Stripe.Checkout.Session

describe('WebhookService', () => {
  beforeEach(() => {
    mock.restore()
    process.env.STRIPE_SANDBOX = 'true'
  })

  describe('handleCheckoutSessionCompleted', () => {
    test('should create license for valid checkout session with metadata', async () => {

      await WebhookService.handleCheckoutSessionCompleted(defaultMockSession)

      expect(LicenseRepo.createLicense).toHaveBeenCalledWith({
        user_id: '9a4f2bc8-3cac-4345-81a1-78da85dd1dc6',
        status: 'active',
        license_type: 'subscription',
        purchase_date: expect.any(Date),
        stripe_customer_id: 'cus_Sxs0V3mlJjxzg7',
        stripe_payment_id: 'sub_1S1wGyAuvxsld26UyyEWlujr'
      })
    })

    test('should throw error when no user ID found', async () => {
      const mockSession = {
        ...defaultMockSession,
        client_reference_id: null,
        metadata: {
          ...defaultMockSession.metadata,
          user_id: undefined as any
        }
      }
      await expect(WebhookService.handleCheckoutSessionCompleted(mockSession))
        .rejects.toThrow('No user ID found in session')
    })

    test('should throw error when no product ID found in metadata', async () => {
      const mockSession = {
        ...defaultMockSession,
        metadata: {
          ...defaultMockSession.metadata,
          product_id: undefined as any
        }
      }
      await expect(WebhookService.handleCheckoutSessionCompleted(mockSession))
        .rejects.toThrow('No product ID found in session')
    })
    
    test('should throw error for unknown product ID', async () => {
      const mockSession = {
        ...defaultMockSession,
        metadata: {
          ...defaultMockSession.metadata,
          product_id: 'prod_UNKNOWN'
        }
      }
      await expect(WebhookService.handleCheckoutSessionCompleted(mockSession))
        .rejects.toThrow('Unknown product ID: prod_UNKNOWN')
    })
  })
})