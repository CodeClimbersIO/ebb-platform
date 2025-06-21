import { FriendsRepo, type FriendRequest, type Friend, type FriendRequestWithUser } from '../repos/Friends.js'
import { ApiError } from '../middleware/errorHandler.js'
import { db } from '../config/database.js'
import type { Request } from 'express'

interface InviteFriendRequest {
  to_email: string;
  message?: string;
}

interface AcceptRejectFriendRequest {
  action: 'accept' | 'reject';
}

const sendFriendRequestEmail = async (toEmail: string, fromUserEmail: string, friendRequestId: string, existingUser: boolean = false): Promise<void> => {
  try {
    const loopsApiKey = process.env.LOOPS_API_KEY
    if (!loopsApiKey) {
      console.error('LOOPS_API_KEY not configured, skipping email send')
      return
    }

    const payload = {
      transactionalId: existingUser ? 'cmc3u8e020700z00iason0m0f' : 'cmc6k356p2tf0zq0jg9y0atvr', // Your friend request template ID
      email: toEmail,
      dataVariables: {
        to_email: toEmail,
        from_email: fromUserEmail,
        request_id: friendRequestId
      }
    }

    const response = await fetch('https://app.loops.so/api/v1/transactional', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${loopsApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to send email via Loops:', response.status, errorText)
      return
    }

    const result = await response.json()
    console.log('Friend request email sent successfully via Loops:', result)
    
  } catch (error) {
    console.error('Failed to send friend request email:', error)
    // Don't throw here - we don't want email failures to prevent friend request creation
  }
}

const inviteFriend = async (req: Request): Promise<FriendRequest> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const { to_email, message } = req.body as InviteFriendRequest
  const fromUserId = req.user.id
  const fromUserEmail = req.user.email

  if (!to_email || typeof to_email !== 'string') {
    throw new ApiError('Valid email address is required', 400)
  }

  if (to_email.toLowerCase() === fromUserEmail?.toLowerCase()) {
    throw new ApiError('You cannot send a friend request to yourself', 400)
  }

  const requestExists = await FriendsRepo.checkFriendRequestExists(fromUserId, to_email)
  if (requestExists) {
    throw new ApiError('Friend request already sent to this email', 400)
  }

  let userToInvite;
  try {
    userToInvite = await FriendsRepo.getUserByEmail(to_email)
    if (userToInvite) {
      const friendshipExists = await FriendsRepo.checkFriendshipExists(fromUserId, userToInvite.id)
      if (friendshipExists) {
        throw new ApiError('You are already friends with this user', 400)
      }
    }
  } catch (error) {
    // User might not exist yet, which is fine - they can still receive an invite
  }

  try {
    const friendRequest = await FriendsRepo.createFriendRequest(fromUserId, to_email, message)

    if (fromUserEmail) {
      
      await sendFriendRequestEmail(to_email, fromUserEmail, friendRequest.id, Boolean(userToInvite))
    } 
    
    
    return friendRequest
  } catch (error) {
    console.error('Service error creating friend request:', error)
    throw new ApiError('Failed to send friend request', 500)
  }
}

const respondToFriendRequest = async (req: Request): Promise<{ friendRequest: FriendRequest; friendship?: Friend }> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const { requestId } = req.params
  const { action } = req.body as AcceptRejectFriendRequest
  const userId = req.user.id
  const userEmail = req.user.email

  if (!requestId) {
    throw new ApiError('Friend request ID is required', 400)
  }

  if (!action || !['accept', 'reject'].includes(action)) {
    throw new ApiError('Action must be either "accept" or "reject"', 400)
  }

  try {
    // Get the friend request
    const friendRequest = await FriendsRepo.getFriendRequestById(requestId)
    if (!friendRequest) {
      throw new ApiError('Friend request not found', 404)
    }

    // Check if the user is authorized to respond to this request
    if (friendRequest.to_email.toLowerCase() !== userEmail?.toLowerCase()) {
      throw new ApiError('You are not authorized to respond to this friend request', 403)
    }

    // Check if the request is still pending
    if (friendRequest.status !== 'pending') {
      throw new ApiError('This friend request has already been responded to', 400)
    }

    // Use a transaction to ensure atomicity
    const result = await db.transaction(async (trx) => {
      // Update the friend request status
      const updatedFriendRequest = await trx('friend_request')
        .where({ id: requestId })
        .update({ 
          status: action === 'accept' ? 'accepted' : 'rejected',
          updated_at: new Date()
        })
        .returning('*')
        .then(rows => rows[0])

      let friendship: Friend | undefined

      // If accepted, create a friendship
      if (action === 'accept') {
        const fromUser = await trx('auth.users')
          .select('id', 'email')
          .where('id', friendRequest.from_user_id)
          .first()

        if (!fromUser) {
          throw new ApiError('User who sent the request not found', 404)
        }

        // Ensure user_id_1 < user_id_2 for the constraint
        const [smallerId, largerId] = fromUser.id < userId ? [fromUser.id, userId] : [userId, fromUser.id]

        friendship = await trx('friend')
          .insert({
            user_id_1: smallerId,
            user_id_2: largerId,
            friend_request_id: requestId,
            status: 'active'
          })
          .returning('*')
          .then(rows => rows[0])
      }

      return { friendRequest: updatedFriendRequest, friendship }
    })

    return result
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    console.error('Service error responding to friend request:', error)
    throw new ApiError('Failed to respond to friend request', 500)
  }
}

const getPendingRequestsSent = async (req: Request): Promise<FriendRequestWithUser[]> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const userId = req.user.id

  try {
    return FriendsRepo.getPendingFriendRequestsSent(userId)
  } catch (error) {
    console.error('Service error fetching sent friend requests:', error)
    throw new ApiError('Failed to fetch sent friend requests', 500)
  }
}

const getPendingRequestsReceived = async (req: Request): Promise<FriendRequestWithUser[]> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const userEmail = req.user.email
  if (!userEmail) {
    throw new ApiError('User email is required', 400)
  }

  try {
    return FriendsRepo.getPendingFriendRequestsReceived(userEmail)
  } catch (error) {
    console.error('Service error fetching received friend requests:', error)
    throw new ApiError('Failed to fetch received friend requests', 500)
  }
}

const getFriends = async (req: Request): Promise<any[]> => {
  if (!req.user) {
    throw new ApiError('User authentication required', 401)
  }

  const userId = req.user.id
  const date = req.query.date as string

  try {
    return FriendsRepo.getFriendsWithDetails(userId, date)
  } catch (error) {
    console.error('Service error fetching friends:', error)
    throw new ApiError('Failed to fetch friends', 500)
  }
}

export const FriendsService = {
  inviteFriend,
  respondToFriendRequest,
  getPendingRequestsSent,
  getPendingRequestsReceived,
  getFriends
} 