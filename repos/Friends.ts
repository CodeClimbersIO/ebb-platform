import { getDb } from '../config/database'
import type { FriendWithDetails } from '../types/friends'

const db = getDb()

export interface FriendRequest {
  id: string;
  from_user_id: string;
  to_email: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  message?: string;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Friend {
  id: string;
  user_id_1: string;
  user_id_2: string;
  friend_request_id?: string;
  status: 'active' | 'blocked';
  created_at: Date;
  updated_at: Date;
}

export interface FriendRequestWithUser extends FriendRequest {
  from_user_email?: string;
  from_user_name?: string;
  to_user_id?: string;
  to_user_name?: string;
}
export interface FriendRequestUser { id: string; email: string }

const friendRequestTableName = 'friend_request'
const friendTableName = 'friend'

const createFriendRequest = async (fromUserId: string, toEmail: string, message?: string): Promise<FriendRequest> => {
  const [friendRequest] = await db(friendRequestTableName)
    .insert({
      from_user_id: fromUserId,
      to_email: toEmail.toLowerCase(),
      message,
      status: 'pending'
    })
    .returning('*')
  
  return friendRequest
}

const getFriendRequestById = async (id: string): Promise<FriendRequest | null> => {
  const friendRequest = await db(friendRequestTableName)
    .where({ id })
    .first()
  
  return friendRequest || null
}

const updateFriendRequestStatus = async (id: string, status: FriendRequest['status']): Promise<FriendRequest> => {
  const [friendRequest] = await db(friendRequestTableName)
    .where({ id })
    .update({ status, updated_at: new Date() })
    .returning('*')
  
  return friendRequest
}

const getPendingFriendRequestsSent = async (userId: string): Promise<FriendRequestWithUser[]> => {
  const requests = await db(friendRequestTableName)
    .select('friend_request.*', 'auth_users.email as to_auth_user_email')
    .leftJoin('auth.users as auth_users', 'friend_request.to_email', 'auth_users.email')
    .where('friend_request.from_user_id', userId)
    .where('friend_request.status', 'pending')
    .orderBy('friend_request.created_at', 'desc')
  
  return requests
}

const getPendingFriendRequestsReceived = async (userEmail: string): Promise<FriendRequestWithUser[]> => {
  const requests = await db(friendRequestTableName)
    .select('friend_request.*', 'auth_users.email as from_auth_user_email')
    .leftJoin('auth.users as auth_users', 'friend_request.from_user_id', 'auth_users.id')
    .where('friend_request.to_email', userEmail.toLowerCase())
    .where('friend_request.status', 'pending')
    .orderBy('friend_request.created_at', 'desc')
  
  return requests
}

const createFriendship = async (userId1: string, userId2: string, friendRequestId?: string): Promise<Friend> => {
  // Ensure user_id_1 < user_id_2 for the constraint
  const [smallerId, largerId] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1]
  
  const [friendship] = await db(friendTableName)
    .insert({
      user_id_1: smallerId,
      user_id_2: largerId,
      friend_request_id: friendRequestId,
      status: 'active'
    })
    .returning('*')
  
  return friendship
}

const getFriendships = async (userId: string): Promise<Friend[]> => {
  const friendships = await db(friendTableName)
    .where(function() {
      this.where('user_id_1', userId).orWhere('user_id_2', userId)
    })
    .where('status', 'active')
    .orderBy('created_at', 'desc')
  
  return friendships
}

const getFriendsWithDetails = async (userId: string, date?: string): Promise<FriendWithDetails[]> => {
  let queryDate = date || new Date().toISOString().split('T')[0]
    // Use WITH statement to get friends with their activity data
    const query = `
      WITH my_friends as (
        SELECT 
          "friend"."id", 
          "friend"."created_at", 
          "friend"."updated_at", 
          CASE WHEN friend.user_id_1 = ? 
            THEN friend.user_id_2 ELSE friend.user_id_1 
          END as friend_id, 
          CASE WHEN friend.user_id_1 = ? 
            THEN u2.email ELSE u1.email 
          END as friend_email 
        FROM "friend" 
        LEFT JOIN "auth"."users" as "u1" on "friend"."user_id_1" = "u1"."id"
        LEFT JOIN "auth"."users" as "u2" on "friend"."user_id_2" = "u2"."id"
        WHERE (
          "user_id_1" = ? AND "status" = 'active' 
          OR (
            "user_id_2" = ? AND "status" = 'active'
          )
        )
      ) 
      SELECT 
        mf.*, 
        COALESCE(adr.total_duration_minutes, 0) as creating_time
      FROM my_friends mf
      LEFT JOIN activity_day_rollup adr ON adr.user_id = mf.friend_id AND adr.date = ?
    `
    
    return db.raw(query, [userId, userId, userId, userId, queryDate]).then(result => result.rows)
  
}

const checkFriendshipExists = async (userId1: string, userId2: string): Promise<boolean> => {
  const [smallerId, largerId] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1]
  
  const friendship = await db(friendTableName)
    .where('user_id_1', smallerId)
    .where('user_id_2', largerId)
    .where('status', 'active')
    .first()
  
  return !!friendship
}

const checkFriendRequestExists = async (fromUserId: string, toEmail: string): Promise<boolean> => {
  const request = await db(friendRequestTableName)
    .where('from_user_id', fromUserId)
    .where('to_email', toEmail.toLowerCase())
    .where('status', 'pending')
    .first()
  
  return !!request
}

const getUserByAuthId = async (authId: string): Promise<FriendRequestUser | null> => {
  const user = await db('auth.users')
    .select('id', 'email')
    .where('id', authId)
    .first()  
  
  return user || null
}

const getUserByEmail = async (email: string): Promise<FriendRequestUser | null> => {
  const user = await db('auth.users')
    .select('id', 'email')
    .where('email', email)
    .first()  
  
  return user || null
}

export const FriendsRepo = {
  createFriendRequest,
  checkFriendRequestExists,
  checkFriendshipExists,
  getFriendRequestById,
  updateFriendRequestStatus,
  createFriendship,
  getPendingFriendRequestsSent,
  getPendingFriendRequestsReceived,
  getFriendsWithDetails,
  getUserByAuthId,
  getUserByEmail
}   