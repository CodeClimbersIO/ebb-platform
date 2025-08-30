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

// Sandbox/Test mode product configurations
export const SANDBOX_PRODUCT_CONFIGS: Record<string, ProductConfig> = {
  'monthly_subscription': {
    id: 'prod_SxoURnahKiKlhm', // Replace with your actual sandbox monthly product ID
    name: 'Ebb Pro Monthly Subscription (Test)',
    licenseType: 'subscription',
    billingType: 'recurring'
  },
  'annual_subscription': {
    id: 'prod_SxoT12GtQeAlIE', // Replace with your actual sandbox annual product ID
    name: 'Ebb Pro Annual Subscription (Test)',
    licenseType: 'subscription',
    billingType: 'recurring'
  }
}

export const getProductConfig = (licenseType: string, sandbox = false): ProductConfig | null => {
  const configs = sandbox ? SANDBOX_PRODUCT_CONFIGS : PRODUCT_CONFIGS
  return configs[licenseType] || null
}

export const getProductConfigByProductId = (productId: string, sandbox = false): ProductConfig | null => {
  const configs = sandbox ? SANDBOX_PRODUCT_CONFIGS : PRODUCT_CONFIGS
  return Object.values(configs).find(config => config.id === productId) || null
}

export const isValidProductId = (licenseType: string, sandbox = false): boolean => {
  const configs = sandbox ? SANDBOX_PRODUCT_CONFIGS : PRODUCT_CONFIGS
  return licenseType in configs
}

export const getValidProductIds = (sandbox = false): string[] => {
  const configs = sandbox ? SANDBOX_PRODUCT_CONFIGS : PRODUCT_CONFIGS
  return Object.keys(configs)
}