import { FriendsRepo, type FriendRequest, type Friend, type FriendRequestWithUser } from '../repos/Friends.js'
import { ApiError } from '../middleware/errorHandler.js'
import type { Request } from 'express'

interface InviteFriendRequest {
  to_email: string;
  message?: string;
}

interface AcceptRejectFriendRequest {
  action: 'accept' | 'reject';
}

const sendFriendRequestEmail = async (toEmail: string, fromUserEmail: string, message?: string): Promise<void> => {
  try {
    // Using Supabase's built-in email functionality
    // Note: This requires Supabase Auth to be properly configured with email templates
    
    const emailData = {
      to: [toEmail],
      subject: `Friend request from ${fromUserEmail}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You have a new friend request!</h2>
          <p><strong>${fromUserEmail}</strong> would like to be your friend.</p>
          ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
          <p>Log in to your account to accept or decline this request.</p>
          <div style="margin-top: 20px; text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
               style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              View Friend Request
            </a>
          </div>
        </div>
      `
    }

    // Note: Supabase doesn't have a direct email sending API in the client library
    // You might need to use a service like SendGrid, Resend, or implement this as a database function
    // For now, we'll log the email that would be sent
    console.log('Friend request email would be sent:', emailData)
    
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

  try {
    const userToInvite = await FriendsRepo.getUserByEmail(to_email)
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
      await sendFriendRequestEmail(to_email, fromUserEmail, message)
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

    // Update the friend request status
    const updatedFriendRequest = await FriendsRepo.updateFriendRequestStatus(
      requestId,
      action === 'accept' ? 'accepted' : 'rejected'
    )

    let friendship: Friend | undefined

    // If accepted, create a friendship
    if (action === 'accept') {
      const fromUser = await FriendsRepo.getUserByEmail(friendRequest.from_user_id)
      if (!fromUser) {
        throw new ApiError('User who sent the request not found', 404)
      }

      friendship = await FriendsRepo.createFriendship(fromUser.id, userId, friendRequest.id)
    }

    return { friendRequest: updatedFriendRequest, friendship }
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

  try {
    return FriendsRepo.getFriendsWithDetails(userId)
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