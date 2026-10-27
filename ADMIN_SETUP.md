# Admin Setup Guide

This guide is for initial setup only and should be kept confidential.

## Initial Admin Account Setup

To set up the admin account for the first time, use the browser console:

1. Open your browser's Developer Tools (Press `F12`)
2. Go to the **Console** tab
3. Copy and paste the following command:

```javascript
import { setupAdmin } from '@/utils/setupAdmin'
await setupAdmin('umair@aviratechnologies.com', '123456', 'Umair')
```

This will create:
- **Email**: umair@aviratechnologies.com
- **Password**: 123456
- **Name**: Umair
- **Role**: Admin

## Login

After setup is complete, go to the login page and sign in with the credentials above.

## Post-Setup Security

⚠️ **IMPORTANT**: After initial setup:

1. **Change the default password** immediately
   - Go to Settings → Profile Settings
   - Change the password to something secure

2. **Do not share credentials** with unauthorized users

3. **Use the Settings page** to manage other users:
   - Add new users with unique emails
   - Set passwords for new users
   - Disable users if needed

## Troubleshooting

### Check Admin Status
```javascript
import { diagnosisCheckAdmin } from '@/utils/diagnostic'
await diagnosisCheckAdmin()
```

### Reset Admin Password
```javascript
import { resetAdminPassword } from '@/utils/diagnostic'
await resetAdminPassword('newpassword')
```

### Clean Up Firestore (if needed)
```javascript
import { cleanupAdminFromFirestore } from '@/utils/diagnostic'
await cleanupAdminFromFirestore()
```

---

**Note**: This setup guide should be stored securely and not shared publicly. The setup commands are only available in the console for security reasons.
