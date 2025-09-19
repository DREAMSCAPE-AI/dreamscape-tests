# DR-59 - Profile User Base Tests

Comprehensive test suite for the basic user profile functionality corresponding to ticket **DR-59 - Profil utilisateur de base**.

## Overview

This test suite validates the enhanced user profile management system introduced in commit `aa9a1bd`, covering all the improvements made to user profiles, settings, authentication, and related functionalities.

## Test Structure

```
tests/DR-59-profile-user/
├── README.md                           # This file
├── unit/                              # Unit tests
│   ├── profile-routes.test.ts         # Profile routes unit tests
│   └── auth-middleware.test.ts        # Enhanced auth middleware tests
├── integration/                       # Integration tests
│   ├── user-settings.test.ts          # UserSettings model integration tests
│   └── user-profile.test.ts           # UserProfile model integration tests
└── e2e/                              # End-to-end tests
    └── profile-workflows.test.ts      # Complete profile workflows E2E tests
```

## Features Covered

### ✅ Enhanced User Profile Management
- **Profile Creation**: Complete profile setup with validation
- **Profile Updates**: Comprehensive profile modification workflows
- **Avatar Upload**: File upload functionality with validation
- **Profile Deletion**: Safe profile removal with cleanup

### ✅ User Settings System (New UserSettings Model)
- **Preferences**: Language, currency, timezone settings
- **Notifications**: Deal alerts, trip reminders, price alerts, newsletter
- **Privacy**: Profile visibility, data sharing, marketing preferences
- **Travel Preferences**: Destinations, accommodation types, activities, dietary restrictions

### ✅ Enhanced Authentication Middleware
- **Token Validation**: Improved JWT validation with security checks
- **Token Blacklisting**: Redis-based token blacklisting system
- **Security**: Protection against token reuse and malicious requests
- **Error Handling**: Comprehensive error responses

### ✅ Database Models and Relationships
- **UserProfile Model**: Enhanced with JSON preferences and avatar support
- **UserSettings Model**: New comprehensive settings model with arrays and defaults
- **Relationships**: Proper foreign keys and cascade operations
- **Constraints**: Unique constraints and data validation

## Test Categories

### 1. Unit Tests (`unit/`)

#### Profile Routes Tests (`profile-routes.test.ts`)
- GET `/api/v1/profile` - Retrieve user profile and settings
- POST `/api/v1/profile/:userId` - Create new user profile
- PUT `/api/v1/profile` - Update profile and settings
- POST `/api/v1/profile/:userId/avatar` - Upload user avatar
- DELETE `/api/v1/profile/:userId` - Delete user profile
- **Validation**: Input validation, error handling, authentication
- **Mocking**: Complete Prisma and Multer mocking

#### Auth Middleware Tests (`auth-middleware.test.ts`)
- Token authentication and validation
- Token blacklisting functionality
- Security edge cases and error handling
- Redis integration for token management
- JWT validation and user lookup

### 2. Integration Tests (`integration/`)

#### UserSettings Tests (`user-settings.test.ts`)
- CRUD operations for user settings
- Default values and constraints
- Array fields handling (destinations, activities, dietary)
- Relationships with User model
- Upsert operations and cascading deletes

#### UserProfile Tests (`user-profile.test.ts`)
- CRUD operations for user profiles
- JSON preferences field handling
- Avatar file path management
- Data integrity and timestamps
- Phone number format validation

### 3. End-to-End Tests (`e2e/`)

#### Profile Workflows Tests (`profile-workflows.test.ts`)
- **Complete Profile Creation**: Full user journey from signup to profile completion
- **Avatar Upload Workflow**: File upload process with validation
- **Profile Update Workflow**: Comprehensive profile modification
- **Settings Management**: Privacy, notifications, and travel preferences
- **Authentication Workflows**: Token management and security
- **Error Handling**: Edge cases and error recovery
- **Concurrent Operations**: Multiple simultaneous profile operations

## Related Commit Analysis

Based on commit `aa9a1bd` analysis, these tests cover:

### Database Schema Changes
- ✅ New `UserSettings` model with comprehensive fields
- ✅ Enhanced `UserProfile` model with JSON preferences
- ✅ Proper relationships and constraints

### API Enhancements
- ✅ Enhanced profile routes with better validation
- ✅ Comprehensive error handling
- ✅ Avatar upload functionality
- ✅ Settings management endpoints

### Security Improvements
- ✅ Token blacklisting system with Redis
- ✅ Enhanced authentication middleware
- ✅ Improved error responses without information leakage

### Data Management
- ✅ Complex nested settings structure
- ✅ Array fields for travel preferences
- ✅ JSON preferences with validation
- ✅ File upload handling

## Running Tests

### Prerequisites
- Node.js 18+
- PostgreSQL test database
- Redis instance
- Jest testing framework
- Playwright for E2E tests

### Commands

```bash
# Run all DR-59 profile tests
npm run test tests/DR-59-profile-user/

# Run specific test categories
npm run test:unit tests/DR-59-profile-user/unit/
npm run test:integration tests/DR-59-profile-user/integration/
npm run test:e2e tests/DR-59-profile-user/e2e/

# Run with coverage
npm run test:coverage tests/DR-59-profile-user/
```

### Environment Variables

```bash
# Test database
TEST_DATABASE_URL="postgresql://test:test@localhost:5432/dreamscape_test"

# API endpoints
API_BASE_URL="http://localhost:3002"

# JWT configuration
JWT_SECRET="test-secret-key"

# Redis configuration
REDIS_URL="redis://localhost:6379"
```

## Test Coverage

### Functionality Coverage
- **Profile Management**: 100% of profile CRUD operations
- **Settings Management**: 100% of user settings functionality
- **Authentication**: 100% of enhanced auth middleware
- **File Upload**: 100% of avatar upload workflows
- **Error Handling**: Comprehensive error scenarios
- **Security**: Token blacklisting and validation

### Code Coverage Targets
- **Unit Tests**: >95% code coverage
- **Integration Tests**: >90% database operations coverage
- **E2E Tests**: >85% user workflow coverage

## Integration with Existing Tests

This test suite complements existing profile tests:

### Existing Tests (Maintained)
- `tests/integration/profile-api.test.js` - Basic API format testing
- `tests/unit-tests/user-service/profile-simple.test.js` - Simple unit tests
- `tests/e2e/web-client/profile-settings.cy.js` - Cypress frontend tests

### Enhanced Coverage
- **DR-59 tests** provide comprehensive backend testing
- **Existing tests** provide frontend and basic API testing
- **Combined coverage** ensures full system validation

## Sub-ticket Coverage

DR-59 may contain sub-tickets covering:
- ✅ Basic profile creation and management
- ✅ User settings and preferences
- ✅ Authentication enhancements
- ✅ Avatar upload functionality
- ✅ Privacy and notification settings
- ✅ Travel preferences management

## Related Documentation

- **Main Ticket**: DR-59 - Profil utilisateur de base
- **Related Commit**: `aa9a1bd` - Amélioration gestion profil
- **Database Schema**: `dreamscape-services/db/prisma/schema.prisma`
- **API Routes**: `dreamscape-services/user/src/routes/profile.ts`
- **Auth Middleware**: `dreamscape-services/user/src/middleware/auth.ts`

## Support

For issues related to:
- **Test Failures**: Check individual test output and API logs
- **Database Issues**: Verify test database connection and schema
- **Authentication Issues**: Validate JWT secret and Redis connection
- **File Upload Issues**: Check upload directory permissions

---

**Branch**: `DR-59-profile-user-tests`
**Repository**: `dreamscape-tests`
**Ticket**: DR-59 - Profil utilisateur de base
**Related Commit**: aa9a1bd - Amélioration gestion profil