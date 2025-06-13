export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'
export type FriendStatus = 'active' | 'blocked'

export interface FriendRequest {
  id: string
  from_user_id: string
  to_email: string
  status: FriendRequestStatus
  created_at: Date
  updated_at: Date
}

export interface Friend {
  id: string
  user_id_1: string
  user_id_2: string
  status: FriendStatus
  created_at: Date
  updated_at: Date
}

export interface FriendRequestWithUser extends FriendRequest {
  from_user_email?: string
  to_user_email?: string
}

export interface FriendWithDetails {
  id: string
  friend_id: string
  friend_email: string
  created_at: Date
  updated_at: Date
} 