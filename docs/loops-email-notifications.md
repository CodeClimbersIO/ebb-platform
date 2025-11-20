# Loops Email Notifications - Implementation Notes

This document outlines key considerations and requirements for implementing batch email notifications through the Loops email provider.

## 1. Unsubscribe Behavior

### Expected Behavior

Most email service providers (including Loops) typically handle unsubscribe management automatically at the API level. When a contact unsubscribes:

- **Automatic suppression**: Loops should prevent emails from being sent to unsubscribed contacts, even if your application attempts to send to them
- **API response**: Loops will either return a success response without sending (soft fail) or return an error/warning indicating the contact is suppressed
- **No action required**: Your application doesn't need to filter unsubscribed users before calling the API

### Verification Required

**Action Item**: Verify Loops' exact behavior by checking their documentation for:

- Suppression list functionality
- What happens when sending to unsubscribed contacts
- API response codes/format for suppressed sends
- Whether suppression is automatic or requires configuration

### Template Configuration

For marketing/broadcast emails (like weekly reports):

- Ensure Loops templates include unsubscribe links (typically handled automatically)
- Verify unsubscribe links point to Loops' hosted unsubscribe page
- Confirm Loops manages the unsubscribe flow and updates contact preferences

### Optional: Sync Unsubscribe Status

Consider periodically syncing Loops' unsubscribe list to your database:

- Query Loops API for unsubscribed contacts
- Update local `email_preferences` table (if implemented)
- Use for analytics/reporting purposes

**Note**: Transactional emails (like friend requests) typically do not include unsubscribe functionality as they are user-triggered actions.

---

## 2. Batch Send Interval Configuration

### Current Implementation

The `NotificationEngine.sendBatchNotifications()` method uses a **hardcoded 100ms delay** between individual sends:

**Location**: `services/NotificationEngine.ts:200`

```typescript
// Add small delay to avoid overwhelming notification services
await new Promise((resolve) => setTimeout(resolve, 100));
```

### Weekly Report Consideration

For weekly report emails sent to many users, you may want to:

- **Increase the delay** (e.g., 500ms or 1000ms) to avoid rate limiting
- **Reduce load** on Loops API during batch processing
- **Spread out sends** over a longer time period

### Implementation Options

**Option A: Add to NotificationConfig** (Recommended)

```typescript
// config/notifications.ts
export const notificationConfig: NotificationConfig = {
  // ... existing config
  batchDelays: {
    weekly_report: 500, // 500ms for weekly reports
    paid_user: 100, // 100ms for paid user notifications
    new_user: 100, // 100ms for new user notifications
    // Defaults to 100ms if not specified
  },
};
```

---

## 3. Requirements for Batch Notifications via Loops

### Current Implementation Status

The infrastructure for batch notifications is **mostly complete** but needs minor modifications to support `weekly_report` type.

### What's Already Working ✅

1. **LoopsNotificationProvider** (`services/providers/LoopsNotificationProvider.ts`)

   - Implements `NotificationProvider` interface
   - Handles `weekly_report` notification type
   - Formats payloads for Loops API
   - Error handling and logging

2. **Batch Processing Infrastructure**

   - `processNotificationsWithIdempotency()` - Generic batch processing with idempotency
   - `NotificationEngine.sendBatchNotifications()` - Loops through users, sends individually
   - `UserNotificationsRepo` - Tracks sent notifications per user per channel

3. **Configuration**
   - Loops API key via `LOOPS_API_KEY` environment variable
   - Template IDs configurable via environment variables
   - Email channel enabled automatically when API key is present

### What Needs to Be Added 🔧

#### 1. Update Type Constraints

**File**: `services/JobProcessors.ts:73-76`

Current:

```typescript
export const processNotificationsWithIdempotency = async <T extends PaidUserRecord | NewUserRecord | InactiveUserRecord>(
  users: T[],
  notificationType: 'paid_user' | 'new_user' | 'inactive_user',
  // ...
```

Needs:

- Add `weekly_report` to the `notificationType` union
- Add appropriate user record type for weekly report recipients

#### 2. Add to NotificationEngine Switch Statement

**File**: `services/NotificationEngine.ts:182-195`

Current:

```typescript
switch (notificationType) {
  case "paid_user":
    results = await this.sendPaidUserNotifications(
      user as PaidUserRecord,
      channels
    );
    break;
  case "new_user":
    results = await this.sendNewUserNotifications(
      user as NewUserRecord,
      channels
    );
    break;
  case "inactive_user":
    results = await this.sendInactiveUserNotifications(
      user as InactiveUserRecord,
      channels
    );
    break;
  default:
    console.warn(`⚠️  Unknown notification type: ${notificationType}`);
}
```

Needs:

- Add `case 'weekly_report'` with appropriate handler method
- Create `sendWeeklyReportNotifications()` method in NotificationEngine

#### 3. Create Database Query for Recipients

**File**: New method in `repos/UserMonitoring.ts` (or similar)

```typescript
async getWeeklyReportRecipients(): Promise<WeeklyReportRecipient[]> {
  // Query users who should receive weekly reports
  // Consider:
  // - Active users only?
  // - Paid users only?
  // - Users who haven't opted out?
  // - Minimum activity threshold?
}
```

#### 4. Update Weekly Email Job Processor

**File**: `services/JobProcessors.ts:362-417`

Current implementation sends to a single "system" user. Needs to:

- Fetch list of recipient users from database
- Call `processNotificationsWithIdempotency()` with user list
- Pass `'weekly_report'` as notification type
- Include personalized data per user (if applicable)

Example:

```typescript
export const processWeeklyEmailReminder = async (
  job: Job<WeeklyEmailReminderJobData>
): Promise<JobResult> => {
  try {
    console.log("📧 Processing weekly email reminder job...");

    // Fetch all users who should receive weekly reports
    const recipients = await UserMonitoringRepo.getWeeklyReportRecipients();
    console.log(`📊 Found ${recipients.length} weekly report recipients`);

    // Use batch processing with idempotency
    const results = await processNotificationsWithIdempotency(
      recipients,
      "weekly_report",
      (user) =>
        `weekly_report_${user.id}_${new Date().toISOString().split("T")[0]}`,
      "📧"
    );

    console.log(
      `✅ Weekly report completed - ${results.newNotifications} emails sent`
    );

    return {
      success: true,
      message: `Weekly report sent to ${results.newNotifications} users`,
      data: results,
      processedAt: new Date(),
    };
  } catch (error) {
    console.error("❌ Error processing weekly email reminder:", error);
    return {
      success: false,
      message: `Failed to process weekly email reminder: ${error}`,
      processedAt: new Date(),
    };
  }
};
```

### Benefits of Batch Approach

✅ **Idempotency**: Won't send duplicate emails if job runs twice
✅ **Per-user tracking**: Records in `user_notifications` table
✅ **Personalization**: Each user can receive customized data
✅ **Error resilience**: Individual failures don't stop the entire batch
✅ **Rate limiting**: Built-in delays prevent overwhelming Loops API
✅ **Auditability**: Full history of who received what and when

### Testing Considerations

1. **Test with small batches first** - Use a limited user set for initial testing
2. **Monitor Loops rate limits** - Check their API documentation for request limits
3. **Verify idempotency** - Ensure duplicate job runs don't send duplicate emails
4. **Check unsubscribe flow** - Manually test unsubscribe and verify suppression
5. **Validate template data** - Ensure all template variables are populated correctly

---

## Summary Checklist

### Before Implementing Weekly Report Emails:

- [ ] Verify Loops' unsubscribe behavior in their documentation
- [ ] Decide on batch send interval (100ms vs 500ms vs configurable)
- [ ] Create database query for weekly report recipients
- [ ] Add `weekly_report` to type constraints in `processNotificationsWithIdempotency`
- [ ] Add `sendWeeklyReportNotifications()` method to NotificationEngine
- [ ] Update `processWeeklyEmailReminder` to use batch processing
- [ ] Configure `LOOPS_TEMPLATE_WEEKLY_REPORT` environment variable
- [ ] Create/design weekly report email template in Loops dashboard
- [ ] Test with small user batch first
- [ ] Monitor Loops API usage and adjust delays if needed
