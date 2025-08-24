import type { LicenseType } from '../repos/License.js'

export interface ProductConfig {
  id: string
  name: string
  licenseType: LicenseType
  billingType: 'one_time' | 'recurring'
  expirationMonths?: number // For perpetual licenses, how long they last
}

// Product configuration mapping Stripe product IDs to license types
export const PRODUCT_CONFIGS: Record<string, ProductConfig> = {
  'monthly_subscription': {
    id: 'prod_SuYkFqTzEpW78s',
    name: 'Ebb Pro Monthly Subscription',
    licenseType: 'subscription',
    billingType: 'recurring'
  },
  'annual_subscription': {
    id: 'prod_SuYlSMSfhzbVi6',
    name: 'Ebb Pro Annual Subscription',
    licenseType: 'subscription',
    billingType: 'recurring'
  },
  // Add perpetual license product if you have one
  // 'prod_PerpetualLicense': {
  //   id: 'prod_PerpetualLicense',
  //   name: 'Ebb Pro Perpetual License',
  //   licenseType: 'perpetual',
  //   billingType: 'one_time',
  //   expirationMonths: 12
  // }
}

export const getProductConfig = (productId: string): ProductConfig | null => {
  return PRODUCT_CONFIGS[productId] || null
}

export const isValidProductId = (productId: string): boolean => {
  return productId in PRODUCT_CONFIGS
}

export const getValidProductIds = (): string[] => {
  return Object.keys(PRODUCT_CONFIGS)
}