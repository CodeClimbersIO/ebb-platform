import { getDb } from "../config/database";

export type LicenseType = 'perpetual' | 'subscription' | 'free_trial';
export type LicenseStatus = 'active' | 'expired';

export interface License {
  id: string;
  user_id: string;
  license_type: LicenseType;
  status?: LicenseStatus;
  purchase_date: Date;
  expiration_date?: Date | null;
  stripe_customer_id?: string;
  stripe_payment_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateLicenseData {
  user_id: string;
  license_type: LicenseType;
  status?: LicenseStatus;
  expiration_date?: Date | null;
  purchase_date?: Date;
  stripe_customer_id?: string;
  stripe_payment_id?: string;
}

export interface UpsertLicenseData {
  user_id: string;
  license_type: LicenseType;
  status: LicenseStatus;
  purchase_date: Date;
  expiration_date?: Date | null;
  stripe_customer_id?: string;
  stripe_payment_id?: string;
}

const db = getDb()

const tableName = 'license'

const getActiveLicenseByUserId = async (userId: string): Promise<License | null> => {
  const result = await db(tableName)
    .where({ user_id: userId, status: 'active' })
    .where(function() {
      this.whereNull('expiration_date')
        .orWhere('expiration_date', '>', new Date())
    })
    .orderBy([
      { column: 'expiration_date', order: 'desc', nulls: 'first' },
      { column: 'created_at', order: 'desc' }
    ])
    .first('*')
  
  return result || null
}

const getFreeTrialLicenseByUserId = async (userId: string): Promise<License | null> => {
  const result = await db(tableName)
    .where({ user_id: userId, license_type: 'free_trial' })
    .first('*')
  
  return result || null
}

const getExistingSubscriptionLicenseByUserId = async (userId: string): Promise<License | null> => {
  const result = await db(tableName)
    .where({ user_id: userId, license_type: 'subscription' })
    .first('*')

  return result || null
}

const getLicenseByUserId = async (userId: string): Promise<License | null> => {
  const result = await db(tableName)
    .where({ user_id: userId })
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

const updateLicense = async (licenseId: string, updates: Partial<License>): Promise<License | null> => {
  const [license] = await db(tableName)
    .where({ id: licenseId })
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



const getLicenseByCustomerId = async (customerId: string): Promise<License | null> => {
  const result = await db(tableName)
    .where({ stripe_customer_id: customerId })
    .first('*')

  return result || null
}

const updateLicenseByCustomerId = async (customerId: string, status: LicenseStatus): Promise<License | null> => {
  const [license] = await db(tableName)
    .where({ stripe_customer_id: customerId })
    .update({
      status,
      updated_at: new Date()
    })
    .returning('*')

  return license || null
}

export const LicenseRepo = {
  getLicenseByCustomerId,
  getActiveLicenseByUserId,
  getFreeTrialLicenseByUserId,
  getExistingSubscriptionLicenseByUserId,
  getLicenseByUserId,
  createLicense,
  updateLicense,
  deleteLicense,
  updateLicenseByCustomerId,
}