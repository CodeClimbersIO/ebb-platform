# Error Handling Guide

This project now implements comprehensive error handling to ensure the server remains stable and provides meaningful error responses.

## Key Improvements

### 1. Graceful Error Handling
- **Fixed Express error middleware signature** - Now properly includes the `next` parameter
- **Global error handlers** - Prevent server crashes from uncaught exceptions and unhandled promise rejections
- **Async error wrapper** - Automatically catches errors in async route handlers

### 2. Error Handling Components

#### `asyncHandler` Utility
Wraps async route handlers to automatically catch errors and pass them to Express error middleware:

```typescript
import { asyncHandler } from '../middleware/errorHandler.js'

router.get('/route', asyncHandler(async (req, res) => {
  // Any errors thrown here will be automatically caught
  const data = await someAsyncOperation()
  res.json({ data })
}))
```

#### `ApiError` Class
Custom error class for structured API errors:

```typescript
import { ApiError } from '../middleware/errorHandler.js'

// Throw a structured error with custom status code
throw new ApiError('User not found', 404)
```

#### Global Error Handlers
- **`uncaughtException`** - Logs critical errors but keeps server running
- **`unhandledRejection`** - Logs unhandled promise rejections
- **Express error middleware** - Handles all application errors with proper JSON responses

### 3. Error Response Format

All errors now return consistent JSON responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional details (development only)",
  "stack": "Stack trace (development only)"
}
```

### 4. Testing Error Handling

A test endpoint is available at `/api/users/test-error` to verify error handling:

- `GET /api/users/test-error?type=api` - Tests ApiError with 400 status
- `GET /api/users/test-error?type=generic` - Tests generic Error
- `GET /api/users/test-error?type=async` - Tests async operation failures
- `GET /api/users/test-error` - Shows usage instructions

### 5. Best Practices

1. **Use `asyncHandler`** for all async route handlers
2. **Throw `ApiError`** for business logic errors with appropriate status codes
3. **Let generic errors bubble up** - they'll be handled by the global error middleware
4. **Don't use try-catch in controllers** when using `asyncHandler` - it's redundant
5. **Log errors appropriately** - sensitive information is filtered in production

### 6. Migration Guide

To update existing controllers:

1. Import `asyncHandler` and `ApiError`:
   ```typescript
   import { asyncHandler, ApiError } from '../middleware/errorHandler.js'
   ```

2. Wrap async route handlers:
   ```typescript
   // Before
   router.get('/route', myHandler)
   
   // After
   router.get('/route', asyncHandler(myHandler))
   ```

3. Remove try-catch blocks and use ApiError for business logic errors:
   ```typescript
   // Before
   const handler = async (req, res) => {
     try {
       const data = await service.getData()
       res.json({ data })
     } catch (error) {
       res.status(500).json({ error: 'Failed to get data' })
     }
   }
   
   // After
   const handler = async (req, res) => {
     const data = await service.getData() // Errors automatically caught
     res.json({ data })
   }
   ```

This error handling system ensures your server remains stable and provides consistent, meaningful error responses to clients. 