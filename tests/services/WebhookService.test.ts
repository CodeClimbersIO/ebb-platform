import { beforeEach, describe, expect, test, mock } from 'bun:test'
import { WebhookService } from '../../services/WebhookService.js'
import { LicenseRepo } from '../../repos/License.js'
import type Stripe from 'stripe'

mock.module('../../repos/License.js', () => ({
  LicenseRepo: {
    createLicense: mock(() => Promise.resolve({ id: 'license-123' })),
    updateLicenseByStripePaymentId: mock(() => Promise.resolve({ id: 'license-123' })),
    getFreeTrialLicenseByUserId: mock(() => Promise.resolve(null)),
    updateLicense: mock(() => Promise.resolve({ id: 'trial-license-456' }))
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

    test('should expire existing free trial license when user upgrades to paid subscription', async () => {
      // Mock that user has an existing free trial license
      const existingTrialLicense = { id: 'trial-license-456', status: 'active' };
      (LicenseRepo.getFreeTrialLicenseByUserId as any).mockResolvedValue(existingTrialLicense)

      await WebhookService.handleCheckoutSessionCompleted(defaultMockSession)

      // Should check for existing trial license
      expect(LicenseRepo.getFreeTrialLicenseByUserId).toHaveBeenCalledWith('9a4f2bc8-3cac-4345-81a1-78da85dd1dc6')
      
      // Should expire the trial license
      expect(LicenseRepo.updateLicense).toHaveBeenCalledWith('trial-license-456', {
        status: 'expired',
        expiration_date: expect.any(Date),
        updated_at: expect.any(Date)
      })
      
      // Should still create the new subscription license
      expect(LicenseRepo.createLicense).toHaveBeenCalledWith({
        user_id: '9a4f2bc8-3cac-4345-81a1-78da85dd1dc6',
        status: 'active',
        license_type: 'subscription',
        purchase_date: expect.any(Date),
        stripe_customer_id: 'cus_Sxs0V3mlJjxzg7',
        stripe_payment_id: 'sub_1S1wGyAuvxsld26UyyEWlujr'
      })
    })

    test('should not call updateLicense when user has no existing free trial license', async () => {
      // Clear the mock call history from previous tests
      (LicenseRepo.updateLicense as any).mockClear()
      
      // Create a fresh mock session object for this test
      const mockSession = {
        id: 'cs_test_different_session',
        object: 'checkout.session',
        customer: 'cus_DifferentCustomer',
        client_reference_id: 'different-user-id',
        created: 1756589200,
        mode: 'subscription',
        status: 'complete',
        payment_status: 'paid',
        subscription: 'sub_DifferentSubscription',
        metadata: {
          user_id: 'different-user-id',
          product_id: 'prod_SxoT12GtQeAlIE'
        },
        success_url: 'https://ebb.cool/license/callback?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://ebb.cool/license/callback'
      } as unknown as Stripe.Checkout.Session

      // Mock that user has no existing free trial license
      (LicenseRepo.getFreeTrialLicenseByUserId as any).mockResolvedValue(null)

      await WebhookService.handleCheckoutSessionCompleted(mockSession)

      // Should check for existing trial license
      expect(LicenseRepo.getFreeTrialLicenseByUserId).toHaveBeenCalledWith('different-user-id')
      
      // Should NOT expire any trial license
      expect(LicenseRepo.updateLicense).not.toHaveBeenCalled()
      
      // Should still create the new subscription license
      expect(LicenseRepo.createLicense).toHaveBeenCalledWith({
        user_id: 'different-user-id',
        status: 'active',
        license_type: 'subscription',
        purchase_date: expect.any(Date),
        stripe_customer_id: 'cus_DifferentCustomer',
        stripe_payment_id: 'sub_DifferentSubscription'
      })
    })
  })
})