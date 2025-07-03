import { db } from '../config/database'
import type { GeoLocationData } from '../services/GeoLocationService';

export type OnlineStatus = 'online' | 'offline' | 'active' | 'flowing';

export interface UserProfile {
  id: number;
  user_id: string;
  online_status: OnlineStatus;
  latitude: number; // rounded to nearest integer (within 111km accuracy)
  longitude: number; // rounded to nearest integer (within 111km accuracy)
  created_at: Date;
  updated_at: Date;
}

export interface StatusCount {
  online_status: string;
  count: number;
}

export interface Location {
  latitude: number;
  longitude: number;
  online_status: OnlineStatus;
}

const tableName = 'user_profile'


const getUserStatusCounts = async (): Promise<StatusCount[]> => {
  try {
    const result = await db(tableName)
      .select('online_status')
      .count('* as count')
      .groupBy('online_status')

    return result.map(row => ({
      online_status: row.online_status as string,
      count: parseInt(row.count as string)
    }))
  } catch (error) {
    console.error('Error fetching user status counts:', error)
    throw new Error('Failed to fetch user status counts')
  }
}

const saveUserLocation = async (userId: string, userLocation: GeoLocationData): Promise<void> => {
  if (!userLocation.location.latitude || !userLocation.location.longitude) {
    throw new Error('Latitude or longitude is null')
  }

  await db(tableName).update({
    latitude: Math.round(userLocation.location.latitude),
    longitude: Math.round(userLocation.location.longitude),
    online_status: 'online'
  }).where('id', userId)
}

const getUserLocations = async () => {
  const result = await db(tableName).select<Location[]>('latitude', 'longitude', 'online_status')
  return result
}

const getUserProfile = async (userId: string) => {
  const [result] = await db(tableName).select<UserProfile[]>('*').where('id', userId)
  return result
}

export const UserProfileRepo = {
  getUserStatusCounts,
  saveUserLocation,
  getUserLocations,
  getUserProfile
}
