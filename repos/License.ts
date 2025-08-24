import { getDb } from "../config/database";

export type LicenseType = 'perpetual' | 'subscription' | 'free_trial';
export type LicenseStatus = 'active' | 'expired';

export interface License {
  id: string;
  user_id: string;
  license_type: LicenseType;
  status?: LicenseStatus;
  purchase_date: Date;
  expiration_date: Date;
  stripe_customer_id?: string;
  stripe_payment_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateLicenseData {
  user_id: string;
  license_type: LicenseType;
  status?: LicenseStatus;
  expiration_date: Date;
  purchase_date?: Date;
  stripe_customer_id?: string;
  stripe_payment_id?: string;
}

export interface UpsertLicenseData {
  user_id: string;
  license_type: LicenseType;
  status: LicenseStatus;
  purchase_date: Date;
  expiration_date: Date;
  stripe_customer_id?: string;
  stripe_payment_id?: string;
}

const db = getDb()

const tableName = 'license'

const getLicenseByUserId = async (userId: string): Promise<License | null> => {
  const result = await db(tableName)
    .where({ user_id: userId })
    .first('*')
  
  return result || null
}

const getLicensesByUserId = async (userId: string): Promise<License[]> => {
  const result = await db(tableName)
    .where({ user_id: userId })
    .select('*')
  
  return result || []
}

const getActiveLicenseByUserId = async (userId: string): Promise<License | null> => {
  const result = await db(tableName)
    .where({ user_id: userId, status: 'active' })
    .first('*')
  
  return result || null
}

const createLicense = async (data: CreateLicenseData): Promise<License> => {
  const [license] = await db(tableName)
    .insert({
      user_id: data.user_id,
      license_type: data.license_type,
      status: data.status || 'active',
      purchase_date: data.purchase_date || new Date(),
      expiration_date: data.expiration_date,
      stripe_customer_id: data.stripe_customer_id,
      stripe_payment_id: data.stripe_payment_id,
    })
    .returning('*')
  
  return license
}

const updateLicense = async (userId: string, updates: Partial<License>): Promise<License | null> => {
  const [license] = await db(tableName)
    .where({ user_id: userId })
    .update({
      ...updates,
      updated_at: new Date()
    })
    .returning('*')
  
  return license || null
}

const deleteLicense = async (userId: string): Promise<boolean> => {
  const deletedCount = await db(tableName)
    .where({ user_id: userId })
    .delete()
  
  return deletedCount > 0
}

const upsertLicense = async (data: UpsertLicenseData): Promise<License> => {
  const existingLicense = await getLicenseByUserId(data.user_id)
  
  if (existingLicense) {
    const [updated] = await db(tableName)
      .where({ user_id: data.user_id })
      .update({
        license_type: data.license_type,
        status: data.status,
        purchase_date: data.purchase_date,
        expiration_date: data.expiration_date,
        stripe_customer_id: data.stripe_customer_id,
        stripe_payment_id: data.stripe_payment_id,
        updated_at: new Date()
      })
      .returning('*')
    
    return updated
  } else {
    return await createLicense({
      user_id: data.user_id,
      license_type: data.license_type,
      status: data.status,
      purchase_date: data.purchase_date,
      expiration_date: data.expiration_date,
      stripe_customer_id: data.stripe_customer_id,
      stripe_payment_id: data.stripe_payment_id,
    })
  }
}

const updateLicenseByStripePaymentId = async (stripePaymentId: string, status: LicenseStatus): Promise<License | null> => {
  const [license] = await db(tableName)
    .where({ stripe_payment_id: stripePaymentId })
    .update({
      status,
      updated_at: new Date()
    })
    .returning('*')
  
  return license || null
}

export const LicenseRepo = {
  getLicensesByUserId,
  getActiveLicenseByUserId,
  createLicense,
  updateLicense,
  deleteLicense,
  upsertLicense,
  updateLicenseByStripePaymentId,
}