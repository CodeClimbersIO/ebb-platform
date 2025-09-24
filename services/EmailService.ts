interface LoopsEmailPayload {
  transactionalId: string
  email: string
  dataVariables: Record<string, any>
}

interface PaymentFailureEmailData {
  customerEmail: string
  customerName?: string
  amountDue: number
  currency: string
}

interface FriendRequestEmailData {
  toEmail: string
  fromEmail: string
  requestId: string
  existingUser?: boolean
}

const sendLoopsEmail = async (payload: LoopsEmailPayload): Promise<void> => {
  try {
    const loopsApiKey = process.env.LOOPS_API_KEY
    if (!loopsApiKey) {
      console.error('LOOPS_API_KEY not configured, skipping email send')
      return
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
    console.log('Email sent successfully via Loops:', result)
    
  } catch (error) {
    console.error('Failed to send email:', error)
    // Don't throw here - we don't want email failures to prevent other operations
  }
}

// const sendPaymentFailureEmail = async (data: PaymentFailureEmailData): Promise<void> => {
//   const payload: LoopsEmailPayload = {
//     transactionalId: 'YOUR_PAYMENT_FAILURE_TEMPLATE_ID', // Replace with your Loops template ID
//     email: data.customerEmail,
//     dataVariables: {
//       customer_email: data.customerEmail,
//       customer_name: data.customerName || '',
//       formatted_amount: `${data.currency.toUpperCase()} $${(data.amountDue / 100).toFixed(2)}`
//     }
//   }

//   await sendLoopsEmail(payload)
// }

const sendFriendRequestEmail = async (data: FriendRequestEmailData): Promise<void> => {
  const payload: LoopsEmailPayload = {
    transactionalId: data.existingUser ? 'cmc3u8e020700z00iason0m0f' : 'cmc6k356p2tf0zq0jg9y0atvr',
    email: data.toEmail,
    dataVariables: {
      to_email: data.toEmail,
      from_email: data.fromEmail,
      request_id: data.requestId
    }
  }

  await sendLoopsEmail(payload)
}

export const EmailService = {
  sendFriendRequestEmail,
  sendLoopsEmail
}