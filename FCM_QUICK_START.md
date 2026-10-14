# Push Notification System - Quick Start

## What's Been Implemented

### ✅ Frontend Components
- **NotificationPermissionPrompt** - Requests permission on first load
- **useFCMInitialize Hook** - Manages FCM initialization and token management
- **Service Worker** - Handles background notifications
- **Automatic Triggers** - Issue creation/resolution automatically send notifications

### ✅ Backend APIs
- **deviceTokensAPI** - Manages device token storage and retrieval
- **pushNotificationAPI** - Queues notifications for sending
- **Cloud Functions** - Processes notifications and sends via FCM

### ✅ Firebase Integration
- Service Worker registration in `main.tsx`
- FCM initialization in `src/integrations/firebase/config.ts`
- Device token storage in Firestore collection
- Push notification queue in Firestore collection

## Quick Setup (5 Steps)

### 1. Get VAPID Key
```
Firebase Console → Project Settings → Cloud Messaging → Copy Public Key
```

### 2. Set Environment Variable
```bash
# .env file
VITE_FCM_VAPID_KEY=your_vapid_key_here
```

### 3. Deploy Cloud Functions
```bash
firebase deploy --only functions:sendPushNotifications,functions:sendTestNotification,functions:cleanupOldNotifications
```

### 4. Update Firestore Rules
Copy the security rules from `FCM_SETUP.md` Step 4

### 5. Test It!
- Open your app
- Click "Enable Notifications" when prompted
- Create a new issue
- Verify notifications appear

## File Structure

```
src/
├── components/
│   └── NotificationPermissionPrompt.tsx      # Permission request UI
├── hooks/
│   └── useFCMInitialize.ts                   # FCM initialization hook
├── integrations/firebase/
│   ├── config.ts                             # FCM initialization
│   ├── deviceTokensAPI.ts                    # Device token management
│   └── pushNotificationAPI.ts                # Notification queueing
├── components/
│   ├── AddIssueDialog.tsx                    # Sends notifications on create
│   └── ResolveIssueDialog.tsx                # Sends notifications on resolve
└── main.tsx                                  # Service Worker registration

public/
└── firebase-messaging-sw.js                  # Background notification handler

functions/
└── sendPushNotifications.ts                  # Cloud Functions

FCM_SETUP.md                                  # Complete setup guide
```

## How It Works

### User Flow
1. User opens app → Permission prompt appears
2. User clicks "Enable Notifications" → Browser requests permission
3. Permission granted → FCM token generated and saved to Firestore
4. User creates/resolves issue → Notification queued to Firestore
5. Cloud Function processes queue → Sends FCM to all devices
6. Browser receives notification → Shows in notification center
7. User clicks notification → Navigates to issue details

### Technical Flow
```
User Action (Create/Resolve Issue)
    ↓
AddIssueDialog / ResolveIssueDialog
    ↓
notificationsAPI.create()          (In-app notification)
pushNotificationAPI.notifyIssue*() (Queue notification)
    ↓
pushNotificationQueue (Firestore collection)
    ↓
Cloud Function: sendPushNotifications (Trigger)
    ↓
Get device tokens from deviceTokens collection
    ↓
Send FCM messages to all registered tokens
    ↓
Browser receives notification
    ↓
Service Worker: onBackgroundMessage
    ↓
Show notification in notification center
    ↓
User clicks → navigates to /issues/{issueId}
```

## Environment Variables Required

```env
# Firebase Config (already set)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# NEW: Firebase Cloud Messaging VAPID Key
VITE_FCM_VAPID_KEY=your_vapid_key_here
```

## Testing Checklist

- [ ] VAPID key obtained from Firebase Console
- [ ] Environment variable `VITE_FCM_VAPID_KEY` set
- [ ] Cloud Functions deployed successfully
- [ ] Firestore security rules updated
- [ ] App opens without errors
- [ ] Permission prompt appears (after 2 seconds)
- [ ] Can click "Enable Notifications"
- [ ] Browser requests notification permission
- [ ] Permission granted without errors
- [ ] Device token appears in Firestore `deviceTokens` collection
- [ ] Create a test issue
- [ ] In-app toast notification appears
- [ ] Browser console shows "Notification queued for sending"
- [ ] Notification appears in Firestore `pushNotificationQueue`
- [ ] Cloud Function logs show message processing
- [ ] Push notification appears on device/browser
- [ ] Clicking notification navigates to issue page
- [ ] Close app completely, reopen
- [ ] Create another issue
- [ ] Push notification appears even with app closed

## Key Features

✅ **Background Notifications** - Works when app is closed
✅ **Site-Specific** - Notifications for relevant users
✅ **Automatic** - No manual trigger needed
✅ **Resilient** - Handles token invalidation gracefully
✅ **In-App + Push** - Shows both toast and push notifications
✅ **Click Navigation** - Clicking notification opens issue details
✅ **Role-Based** - Can filter by admin/user roles
✅ **Auto-Cleanup** - Old notifications automatically deleted

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| "Permission denied" errors | Update Firestore security rules (Step 4 in FCM_SETUP.md) |
| Service Worker not registering | Check browser console, ensure HTTPS in production |
| No notifications appearing | Verify VAPID key, check Cloud Functions logs, test manually |
| Notifications not in background | Check Service Worker registration, verify Cloud Functions deployed |
| Device tokens not saving | Check Firestore rules, verify user is authenticated |

## Next Steps

1. **Get VAPID Key** from Firebase Console
2. **Set Environment Variable** in your deployment
3. **Deploy Cloud Functions** using Firebase CLI
4. **Update Firestore Rules** for security
5. **Test in Development** locally
6. **Deploy to Production** and monitor

## Support & Documentation

- **Complete Setup Guide**: See `FCM_SETUP.md`
- **Firebase Docs**: https://firebase.google.com/docs/cloud-messaging
- **Cloud Functions**: See `functions/sendPushNotifications.ts`
- **Hook Reference**: See `src/hooks/useFCMInitialize.ts`

## Important Notes

⚠️ **HTTPS Required** - Service Workers only work on HTTPS (localhost ok for dev)
⚠️ **Permissions** - Users must grant notification permission in browser
⚠️ **Token Expiry** - FCM tokens can expire; refreshed automatically by SDK
⚠️ **Testing** - Test on multiple browsers as notification support varies
