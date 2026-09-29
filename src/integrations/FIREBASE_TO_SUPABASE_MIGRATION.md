# Firebase to Supabase Migration Guide

This guide shows you how to migrate from Firebase Firestore to Supabase PostgreSQL.

## Overview

Your project now has two setups:

1. **Firebase Firestore** - in `src/integrations/firebase/`
   - `config.ts` - Firebase initialization
   - `firestore.ts` - Firestore database operations

2. **Supabase PostgreSQL** - in `src/integrations/supabase/`
   - `client.ts` - Supabase client initialization
   - `types.ts` - Auto-generated TypeScript types
   - `queries.ts` - Database operations (NEW - replaces Firebase)

## Side-by-Side Comparison

### Get All Categories

**Firebase:**
```typescript
import { categoriesAPI } from '@/integrations/firebase/firestore';

const categories = await categoriesAPI.getAll();
```

**Supabase (Recommended):**
```typescript
import { categoriesAPI } from '@/integrations/supabase/queries';

const categories = await categoriesAPI.getAll();
```

### Get Items by Category

**Firebase:**
```typescript
const items = await inventoryItemsAPI.getByCategory(categoryId);
```

**Supabase:**
```typescript
import { inventoryItemsAPI } from '@/integrations/supabase/queries';

const items = await inventoryItemsAPI.getByCategory(categoryId);
```

### Create a New Inventory Item

**Firebase:**
```typescript
const itemId = await inventoryItemsAPI.create({
  name: 'Item Name',
  serial_number: 'SN123',
  category_id: 'cat1',
  status: 'in'
});
```

**Supabase:**
```typescript
const item = await inventoryItemsAPI.create({
  name: 'Item Name',
  serial_number: 'SN123',
  category_id: 'cat1',
  status: 'in'
});
// Note: Supabase returns the full created item, not just the ID
```

### Update an Item

**Firebase:**
```typescript
await inventoryItemsAPI.update(itemId, {
  status: 'out'
});
```

**Supabase:**
```typescript
await inventoryItemsAPI.update(itemId, {
  status: 'out'
});
```

### Delete an Item

**Firebase:**
```typescript
await inventoryItemsAPI.delete(itemId);
```

**Supabase:**
```typescript
await inventoryItemsAPI.delete(itemId);
```

## Key Differences

| Feature | Firebase | Supabase |
|---------|----------|----------|
| **Database Type** | NoSQL (Document) | SQL (PostgreSQL) |
| **Create Response** | Returns document ID | Returns full record |
| **Error Handling** | Throws exceptions | Returns error object |
| **Timestamps** | Manual management | Auto-generated |
| **Type Safety** | Manual types | Auto-generated from schema |
| **Scalability** | Limited free tier | Generous free tier |
| **Cost** | Usage-based | Usage-based |

## Migration Steps

### Option 1: Use Supabase Only (Recommended)

1. **Remove Firebase imports** from your components/pages
2. **Import from Supabase** instead:
   ```typescript
   import { categoriesAPI, inventoryItemsAPI, inventoryTransactionsAPI } 
     from '@/integrations/supabase/queries';
   ```
3. **Keep the same API** - The function signatures are identical

### Option 2: Keep Both (For A/B Testing)

If you want to keep Firebase for testing:

```typescript
// Use Firebase
import { categoriesAPI as firebaseCategories } 
  from '@/integrations/firebase/firestore';

// Use Supabase
import { categoriesAPI as supabaseCategories } 
  from '@/integrations/supabase/queries';

const firebaseData = await firebaseCategories.getAll();
const supabaseData = await supabaseCategories.getAll();
```

### Option 3: Remove Firebase Completely

When you're ready to remove Firebase:

```bash
npm uninstall firebase
```

Then delete these files:
- `src/integrations/firebase/` directory

## Environment Variables

Make sure your Supabase environment variables are set:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-key
```

Check `.env.local` or your environment settings.

## Example: Updating a Component

### Before (Firebase):
```typescript
import { inventoryItemsAPI } from '@/integrations/firebase/firestore';

export function ItemList() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    inventoryItemsAPI.getAll().then(setItems);
  }, []);

  return <>{/* render items */}</>;
}
```

### After (Supabase):
```typescript
import { inventoryItemsAPI } from '@/integrations/supabase/queries';

export function ItemList() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    inventoryItemsAPI.getAll().then(setItems);
  }, []);

  return <>{/* render items */}</>;
}
```

**The component code is identical!** Just change the import.

## Real-Time Features

**Firebase:**
```typescript
// Real-time listener
const unsubscribe = onSnapshot(query(...), (snapshot) => {
  // Handle updates
});
```

**Supabase:**
```typescript
// Real-time subscription
const subscription = supabase
  .from('items')
  .on('*', payload => {
    // Handle updates
  })
  .subscribe();
```

## Next Steps

1. **Choose your approach** (Supabase-only is recommended)
2. **Update your imports** in existing components
3. **Test your application** thoroughly
4. **Remove Firebase** if no longer needed
5. **Delete migration guide** once migration is complete

## Support

- Supabase Docs: https://supabase.com/docs
- Firebase Docs: https://firebase.google.com/docs

Both APIs provide the same functionality for your inventory management system!
