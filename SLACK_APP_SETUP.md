# Slack App Setup Guide

## Creating the Slack App from Manifest

### Step 1: Create App from Manifest

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Select **"From an app manifest"**
4. Choose your development workspace
5. Copy the contents of `slack-app-manifest.json` and paste it into the JSON tab
6. **Important**: Update the URLs in the manifest:
   - Replace `https://your-domain.com` with your actual domain
   - For development, you can use `http://localhost:8001`
   - For production, use your production domain (must be HTTPS)

### Step 2: Configure Environment Variables

After creating the app, you'll need to gather the following credentials:

#### From "Basic Information" page:
```bash
SLACK_CLIENT_ID=your_client_id_here
SLACK_CLIENT_SECRET=your_client_secret_here
```

#### From "App-Level Tokens" (if using Socket Mode):
```bash
SLACK_APP_TOKEN=xapp-your-app-token-here
```

#### From "OAuth & Permissions" page:
```bash
# This will be generated after first installation
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
```

#### Event Subscriptions:
```bash
# From "Event Subscriptions" page
SLACK_SIGNING_SECRET=your_signing_secret_here
```

#### Custom for encryption:
```bash
# Generate a random 32-character string
SLACK_ENCRYPTION_KEY=your-32-character-encryption-key
```

### Step 3: Complete App Configuration

#### A. OAuth & Permissions
- Redirect URLs should already be set from manifest
- Scopes should already be configured from manifest
- After first installation, copy the Bot User OAuth Token

#### B. Event Subscriptions
- Request URL: `https://your-domain.com/api/slack/events`
- The manifest already configures the required events:
  - `app_mention` - When someone mentions the bot
  - `message.im` - Direct messages to the bot

#### C. App Home
- Configured automatically from manifest
- Users can message the bot directly

### Step 4: Install App to Workspace

1. Go to "Install App" in the sidebar
2. Click "Install to Workspace"
3. Review permissions and click "Allow"
4. Copy the Bot User OAuth Token to your environment variables

## Environment Variables Setup

Add these to your `.env` file:

```bash
# Slack Integration
SLACK_CLIENT_ID=123456789.123456789
SLACK_CLIENT_SECRET=abcdef123456789abcdef123456789abc
SLACK_REDIRECT_URI=https://your-domain.com/api/slack/callback
SLACK_SIGNING_SECRET=abcdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef
SLACK_ENCRYPTION_KEY=your-32-character-encryption-key-here

# Optional: For development
API_BASE_URL=https://your-domain.com
```

## Production Deployment Checklist

### 1. Update Manifest for Production

Create a new `slack-app-manifest-production.json`:

```json
{
  "display_information": {
    "name": "Ebb Focus Assistant",
    "description": "Automatically manage your Slack status and notifications during focus sessions with Ebb",
    "background_color": "#2c3e50"
  },
  "oauth_config": {
    "redirect_urls": [
      "https://your-production-domain.com/api/slack/callback"
    ],
    "scopes": {
      "user": [
        "users.profile:write",
        "dnd:read", 
        "dnd:write"
      ],
      "bot": [
        "app_mentions:read",
        "channels:history",
        "chat:write",
        "im:history",
        "im:read",
        "im:write",
        "users:read"
      ]
    }
  },
  "settings": {
    "event_subscriptions": {
      "request_url": "https://your-production-domain.com/api/slack/events",
      "bot_events": [
        "app_mention",
        "message.im"
      ]
    },
    "org_deploy_enabled": true,
    "socket_mode_enabled": false,
    "token_rotation_enabled": true
  }
}
```

### 2. Production Environment Variables

```bash
# Production Slack App Credentials
SLACK_CLIENT_ID=production_client_id
SLACK_CLIENT_SECRET=production_client_secret
SLACK_REDIRECT_URI=https://your-production-domain.com/api/slack/callback
SLACK_SIGNING_SECRET=production_signing_secret
SLACK_ENCRYPTION_KEY=production-32-character-encryption-key

# Production API Base URL
API_BASE_URL=https://your-production-domain.com
```

### 3. SSL/HTTPS Requirements

Slack requires HTTPS for all production apps:
- Redirect URLs must use HTTPS
- Event subscription URLs must use HTTPS
- OAuth flow will fail without valid SSL certificate

### 4. App Distribution (Optional)

If you want to distribute your app publicly:

1. Go to "Manage Distribution" 
2. Complete the app directory checklist:
   - Add app icon and screenshots
   - Complete app description
   - Add privacy policy URL
   - Add support email
3. Submit for review

## Testing the Integration

### 1. Test OAuth Flow
```bash
curl -X GET "https://your-domain.com/api/slack/auth" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Test Event Webhook
Slack will automatically test your event endpoint when you save the configuration.

### 3. Test Bot Responses
1. Install the app to your workspace
2. Send a direct message to the bot
3. Mention the bot in a channel
4. Verify responses appear in your application logs

## Common Issues and Solutions

### Issue: Event endpoint returning 404
**Solution**: Ensure your server is running and the route is properly registered

### Issue: OAuth redirect fails
**Solution**: Check that redirect URLs match exactly (including trailing slashes)

### Issue: Bot doesn't respond to messages
**Solution**: Verify bot token is correct and app is installed to workspace

### Issue: Status updates fail
**Solution**: Ensure user has granted `users.profile:write` permission

### Issue: Encryption errors
**Solution**: Generate a proper 32-character encryption key

## Manifest Customization Options

### App Icons and Branding
Add to `display_information`:
```json
{
  "display_information": {
    "name": "Ebb Focus Assistant",
    "description": "...",
    "background_color": "#2c3e50",
    "long_description": "...",
    "icon_url": "https://your-domain.com/slack-app-icon.png"
  }
}
```

### Additional Scopes
Add to `oauth_config.scopes.bot` if needed:
```json
{
  "oauth_config": {
    "scopes": {
      "bot": [
        "app_mentions:read",
        "chat:write",
        "im:write",
        "im:history",
        "users:read",
        "channels:read",     // To read channel info
        "groups:read",       // To read private channel info
        "usergroups:read"    // To read user groups
      ]
    }
  }
}
```

### Interactive Components
Enable buttons and interactive elements:
```json
{
  "settings": {
    "interactivity": {
      "is_enabled": true,
      "request_url": "https://your-domain.com/api/slack/interactive"
    }
  }
}
```

## Slack App Store Submission (Optional)

If you want to publish to the Slack App Directory:

1. **App Directory Listing**:
   - Complete all app information
   - Add high-quality screenshots
   - Write compelling description
   - Add proper app icon (512x512px)

2. **Review Process**:
   - Slack reviews for functionality, security, and guidelines compliance
   - Process typically takes 1-2 weeks
   - May require iterations based on feedback

3. **Required Pages**:
   - Privacy Policy
   - Terms of Service
   - Support documentation

This manifest-based approach makes it much easier to:
- Set up development and production versions
- Version control your app configuration
- Share setup instructions with team members
- Quickly recreate the app if needed