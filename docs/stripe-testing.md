# Stripe API Testing Guide

This guide helps you test Stripe integrations with real Stripe responses instead of mocked data. Essential for testing webhooks, subscription lifecycle events, and payment flows.

## Quick Setup

### 1. Install Stripe CLI
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Other platforms: https://stripe.com/docs/stripe-cli#install
```

### 2. Login to Stripe Account
```bash
stripe login
```

### 3. Forward Webhooks to Local Server
```bash
# Forward all events to your local webhook endpoint
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Testing Webhook Events

### Manual Testing
1) stand up a local server
2) run the stripe forwarding agent to forward stripe events to your local server
3) Test the following scenarios
  1) new user
    a) free trial acceptance - validate when they have the free trial they get pro feature access
    b) upgrade to pro - validate upgrade works and have access to pro and notification in discord
  2) user cancels subscription - validate discord notification and loss of access
  3) existing "expired" license upgrade - validate discord notification and pro access

### Trigger Specific Events
```bash
# Subscription deleted after max retries or user manually cancels
stripe trigger customer.subscription.deleted

# Payment failure (sends email notification)
# Note: CLI generates test data automatically, but you can specify customer details
stripe trigger invoice.payment_failed --add customer:email=test@example.com --add customer:name="Test Customer"

# To see available fixtures for any event:
stripe trigger invoice.payment_failed --help
```
