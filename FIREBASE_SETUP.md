# Firebase Firestore Setup Guide

## Fixing "Failed to save at categories database" Error

If you're seeing errors when trying to save categories, follow these steps:

### 1. Check Firebase Console Access

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your **avira-inventory** project
3. Make sure you can see the Firestore section

### 2. Create Firestore Database

If you haven't created a Firestore Database yet:

1. In Firebase Console, go to **Firestore Database**
2. Click **Create Database**
3. Choose **Start in production mode** (we'll update rules next)
4. Select location (us-central1 is fine)
5. Click **Create**

### 3. Create Required Collections

After creating Firestore, create these collections:

#### Collection 1: `categories`
1. Click **Start Collection**
2. Collection ID: `categories`
3. Click **Next**
4. Click **Save** (no need to add first document)

#### Collection 2: `inventory_items`
1. Click **Start Collection**
2. Collection ID: `inventory_items`
3. Click **Next**
4. Click **Save**

#### Collection 3: `inventory_transactions`
1. Click **Start Collection**
2. Collection ID: `inventory_transactions`
3. Click **Next**
4. Click **Save**

### 4. Set Firestore Security Rules

⚠️ **Important**: Your app will fail to save without proper security rules.

1. Go to **Firestore Database** → **Rules** tab
2. Replace the rules with this (for development/testing):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all read and write access for development
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click **Publish**

**⚠️ Warning**: This allows anyone to read/write. For production, use proper authentication rules.

### 5. Check Environment Variables

Make sure your `.env.local` file (or environment settings) has:

```
VITE_FIREBASE_API_KEY=AIzaSyDmUJHxOffiaPyHDMlmH9uh5Vum-ITcbok
VITE_FIREBASE_AUTH_DOMAIN=avira-inventory.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=avira-inventory
```

These are already in `src/integrations/firebase/config.ts`, so you should be good.

### 6. Test the Connection

Try these in your browser's console:

```javascript
// Check if Firebase is initialized
console.log(firebase.apps);

// Try fetching categories
const response = await fetch('...');
```

## Common Error Messages and Fixes

### ❌ "Permission denied"
**Cause**: Security rules aren't set up properly
**Fix**: Follow step 4 above to set correct rules

### ❌ "Firestore is not initialized"
**Cause**: Firebase config is wrong
**Fix**: Verify your Firebase credentials in `src/integrations/firebase/config.ts`

### ❌ "Collection not found"
**Cause**: Collections weren't created
**Fix**: Follow step 3 to create `categories`, `inventory_items`, and `inventory_transactions` collections

### ❌ "Network error" or "Failed to connect"
**Cause**: Firebase project is inactive or network issue
**Fix**: 
- Check your internet connection
- Verify Firebase project is active in console
- Try refreshing the page

## Production Security Rules

When you're ready for production, use these rules instead:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Require authentication for all operations
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Or with more granular control
    match /categories/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /inventory_items/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /inventory_transactions/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Database Schema Reference

### Categories Collection
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "created_at": "timestamp"
}
```

### Inventory Items Collection
```json
{
  "name": "string (optional)",
  "serial_number": "string (required)",
  "barcode": "string (optional)",
  "category_id": "string (reference to categories)",
  "status": "in | out",
  "created_at": "timestamp"
}
```

### Inventory Transactions Collection
```json
{
  "item_id": "string (reference to inventory_items)",
  "type": "addition | removal",
  "recipient_name": "string (optional)",
  "notes": "string (optional)",
  "created_at": "timestamp"
}
```

## Testing Your Setup

1. Go to the **Categories** page
2. Click **Add Category**
3. Enter a name (e.g., "Test Category")
4. Click **Create**
5. You should see a success toast notification

If you see an error instead:
- Check browser console for error details
- Follow the error messages to fix the issue
- Most common issue is missing/wrong security rules

## Need Help?

Check the browser's **Console** (F12 or right-click → Inspect → Console) for detailed error messages. Screenshot the error and you'll know exactly what's wrong:

- **"Permission denied"** → Update security rules
- **"Firestore is not initialized"** → Check Firebase credentials
- **"[collection name] (create)"** → Collection doesn't exist in Firestore

---

Once you complete these steps, your app should save categories without any issues!
