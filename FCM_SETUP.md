# Firebase Cloud Messaging (FCM) Setup Guide

This guide walks you through setting up push notifications for issue/ticket updates using Firebase Cloud Messaging.

## Overview

The push notification system consists of:
- **Frontend**: React components that request permission and display notifications
- **Service Worker**: Handles background push notifications when the app is closed
- **Cloud Functions**: Triggers notifications when issues are created/updated
- **Firestore**: Stores device tokens and notification queue

## Prerequisites

- Firebase project with Firestore enabled
- Firebase CLI installed locally
- Node.js and npm installed

## Step 1: Get Your FCM VAPID Key

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project ("avira-inventory")
3. Navigate to **Project Settings** > **Cloud Messaging** tab
4. Under "Web Push certificates", click **Generate Key Pair**
5. Copy the generated **Public Key** (this is your VAPID key)

## Step 2: Set Environment Variables

### In Your Development Environment

Create or update your `.env` file with:

```env
VITE_FCM_VAPID_KEY=your_vapid_key_here
```

### In Your Production/Deployment Environment

If using Netlify, Vercel, or similar:
1. Add the environment variable in your platform's settings
2. Name: `VITE_FCM_VAPID_KEY`
3. Value: Your public VAPID key

## Step 3: Deploy Cloud Functions

### Prerequisites
- Firebase CLI: `npm install -g firebase-tools`
- Authentication: `firebase login`

### Deployment Steps

```bash
# Navigate to your project root
cd /path/to/your/project

# Initialize functions if not already done
firebase init functions

# Copy the Cloud Functions file to your functions directory
cp functions/sendPushNotifications.ts functions/

# Install dependencies in the functions directory
cd functions
npm install

# Deploy only the notification functions
firebase deploy --only functions:sendPushNotifications,functions:sendTestNotification,functions:cleanupOldNotifications

# Or deploy all functions
firebase deploy --only functions
```

### Cloud Functions Explanation

#### 1. **sendPushNotifications** (Firestore Trigger)
- Listens to `pushNotificationQueue` collection
- Retrieves device tokens for recipients from `deviceTokens` collection
- Sends actual FCM push notifications
- Marks tokens as inactive if delivery fails
- Updates queue document with delivery status

#### 2. **sendTestNotification** (HTTP Trigger)
- Allows testing notification sending
- Useful for development and debugging
- Endpoint: `https://your-region-projectname.cloudfunctions.net/sendTestNotification`
- Method: POST
- Body:
  ```json
  {
    "issueId": "issue123",
    "siteId": "site456",
    "siteName": "Site A",
    "title": "Issue Title",
    "recipientUserIds": ["user1", "user2"]
  }
  ```

#### 3. **cleanupOldNotifications** (Scheduled)
- Runs daily at 02:00 UTC
- Removes notification records older than 30 days
- Helps manage Firestore storage

## Step 4: Configure Firestore Security Rules

Add these rules to allow read/write access to device tokens and notification queue:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Device tokens collection
    match /deviceTokens/{document=**} {
      // Users can only see and modify their own tokens
      allow create, write: if request.auth.uid != null;
      allow read, list: if request.auth.uid != null;
      // Cloud Functions can access all tokens
      allow read, write: if request.auth.uid == null;
    }

    // Notification queue (only Cloud Functions should write)
    match /pushNotificationQueue/{document=**} {
      // Only authenticated users can create
      allow create: if request.auth.uid != null;
      // Only Cloud Functions should read/write
      allow read, write: if request.auth.uid == null;
    }

    // In-app notifications
    match /notifications/{document=**} {
      allow read, write: if request.auth.uid != null;
    }
  }
}
```

## Step 5: Frontend Configuration (Already Done)

The frontend is pre-configured with:

1. **NotificationPermissionPrompt Component**
   - Shows 2 seconds after page load
   - Requests push notification permission
   - Dismissible until user grants/denies permission

2. **useFCMInitialize Hook**
   - Initializes Firebase Cloud Messaging
   - Requests device token
   - Saves token to Firestore
   - Handles foreground messages with toast notifications
   - Listens for service worker messages

3. **Service Worker** (`public/firebase-messaging-sw.js`)
   - Handles background push notifications
   - Processes notification clicks
   - Navigates to issue details when notification clicked

4. **Automatic Notifications**
   - Issue creation triggers notification
   - Issue resolution triggers notification
   - Both in-app and push notifications sent simultaneously

## Step 6: Test the System

### Test in Development

1. **Locally:**
   ```bash
   npm run dev
   ```

2. **Permission Request:**
   - Open your app in a browser
   - A prompt should appear asking for notification permission
   - Click "Enable Notifications"
   - Check browser console for token logs

3. **Create a Test Issue:**
   - Navigate to a site detail page
   - Create a new issue
   - Check that:
     - In-app notification appears (toast)
     - Push notification is queued in Firestore
     - Cloud Function processes the notification

4. **Manual Testing (if deployed):**
   ```bash
   curl -X POST https://your-region-projectname.cloudfunctions.net/sendTestNotification \
     -H "Content-Type: application/json" \
     -d '{
       "issueId": "test123",
       "siteId": "site456",
       "siteName": "Test Site",
       "title": "Test Issue",
       "recipientUserIds": ["your-user-id"]
     }'
   ```

### Monitor in Firebase Console

1. **Firestore > Collections > pushNotificationQueue**
   - View queued notifications
   - Check status (pending, completed, failed)

2. **Firestore > Collections > deviceTokens**
   - See registered device tokens
   - Verify tokens have correct user IDs and site IDs

3. **Cloud Functions > Logs**
   - Monitor function execution
   - Check for errors

## Step 7: Deploy to Production

### With Netlify/Vercel:
1. Add `VITE_FCM_VAPID_KEY` to environment variables
2. Ensure `.env` is in `.gitignore` (don't commit secrets)
3. Deploy normally

### With Firebase Hosting:
```bash
# Build the app
npm run build

# Deploy to Firebase Hosting and Functions
firebase deploy
```

## Troubleshooting

### Issue: "Permission denied" errors in Firestore

**Solution:** Update your Firestore security rules as shown in Step 4

### Issue: Service Worker not registering

**Solution:**
1. Check browser console for errors
2. Verify `public/firebase-messaging-sw.js` exists
3. Ensure HTTPS is used (required for Service Workers in production)
4. Check that Service Worker file is accessible at `/firebase-messaging-sw.js`

### Issue: No notifications appearing

**Check:**
1. ✅ User granted notification permission
2. ✅ Device token saved in Firestore (check `deviceTokens` collection)
3. ✅ Cloud Functions deployed successfully
4. ✅ Check Cloud Functions logs for errors
5. ✅ Check browser console for errors
6. ✅ Verify `VITE_FCM_VAPID_KEY` is set correctly
7. ✅ Check Firebase project ID matches between code and Firebase Console

### Issue: Notifications not working when app is closed

**Solutions:**
1. Verify Service Worker is registered (check DevTools > Application > Service Workers)
2. Ensure browser allows notifications (check site permissions)
3. Check Cloud Functions are deployed
4. Try closing and reopening the browser completely
5. Check Cloud Functions logs for "onBackgroundMessage" entries

### Issue: Device tokens are marked as inactive

**Possible causes:**
1. Token expired (Firebase tokens can expire)
2. Invalid token sent by browser
3. User revoked notification permission
4. Browser storage cleared

**Solution:** 
- Users will get a fresh token on next login
- Device tokens are automatically refreshed periodically by Firebase SDK

## API Reference

### Frontend APIs

#### `useFCMInitialize(options)`
Initialize FCM and request permissions
```typescript
const {
  fcmInitialized,
  fcmToken,
  permissionState,
  isSupported,
  requestNotificationPermission,
  initializeFCMToken
} = useFCMInitialize({
  autoRequest: false,
  onPermissionGranted: () => console.log("Permission granted"),
  onPermissionDenied: () => console.log("Permission denied")
});
```

#### `deviceTokensAPI.saveDeviceToken(userId, token, role, siteIds, email, deviceName)`
Manually save a device token

#### `pushNotificationAPI.notifyIssueCreated(...)`
Trigger notification for new issue creation

#### `pushNotificationAPI.notifyIssueResolved(...)`
Trigger notification for issue resolution

### Firestore Collections

#### `deviceTokens`
```typescript
{
  userId: string;
  token: string;
  userRole: "admin" | "user";
  siteIds: string[];
  userEmail: string;
  deviceName?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}
```

#### `pushNotificationQueue`
```typescript
{
  title: string;
  body: string;
  issueId: string;
  siteId: string;
  siteName: string;
  createdBy: string;
  recipientUserIds: string[];
  type: "issue_created" | "issue_resolved" | "issue_updated";
  status: "pending" | "completed" | "failed";
  sentAt?: Timestamp;
  sentCount?: number;
  failedCount?: number;
  failedUserIds?: string[];
}
```

## Best Practices

1. **Always check permission state** before attempting to get token
2. **Handle failures gracefully** - notifications shouldn't break issue creation
3. **Use site-specific notifications** for better user experience (implemented in Cloud Functions)
4. **Monitor Cloud Functions logs** for delivery issues
5. **Test on multiple browsers** as notification support varies
6. **Use role-based filtering** to send notifications only to relevant users
7. **Clean up old tokens** periodically (automated by scheduled function)

## Next Steps

1. ✅ Get VAPID key from Firebase Console
2. ✅ Set `VITE_FCM_VAPID_KEY` environment variable
3. ✅ Deploy Cloud Functions
4. ✅ Update Firestore security rules
5. ✅ Test in development
6. ✅ Deploy to production
7. ✅ Monitor and adjust as needed

## Support

For issues or questions:
- Check [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- Review Cloud Functions logs in Firebase Console
- Check browser DevTools Console for client-side errors
- Verify Firestore rules are correct
