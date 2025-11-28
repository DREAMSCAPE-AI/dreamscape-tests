import { test, expect, request, APIRequestContext } from '@playwright/test';
import { faker } from '@faker-js/faker';

interface TestUser {
  id: string;
  email: string;
  username: string;
  password: string;
  token: string;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  avatar?: string;
  preferences?: object;
}

interface UserSettings {
  language: string;
  currency: string;
  timezone: string;
  dealAlerts: boolean;
  tripReminders: boolean;
  priceAlerts: boolean;
  newsletter: boolean;
  profileVisibility: string;
  dataSharing: boolean;
  marketing: boolean;
  preferredDestinations: string[];
  accommodationType: string[];
  activities: string[];
  dietary: string[];
}

describe('Profile Management E2E Workflows', () => {
  let apiContext: APIRequestContext;
  let testUser: TestUser;
  let authHeaders: { Authorization: string };

  const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: BASE_URL,
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.beforeEach(async () => {
    // Create a test user and authenticate
    const userData = {
      email: faker.internet.email(),
      username: faker.internet.userName(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      password: 'TestPassword123!',
    };

    // Register user
    const registerResponse = await apiContext.post('/api/v1/auth/register', {
      data: userData,
    });
    expect(registerResponse.ok()).toBeTruthy();

    // Login to get token
    const loginResponse = await apiContext.post('/api/v1/auth/login', {
      data: {
        email: userData.email,
        password: userData.password,
      },
    });
    expect(loginResponse.ok()).toBeTruthy();

    const loginData = await loginResponse.json();
    testUser = {
      id: loginData.user.id,
      email: userData.email,
      username: userData.username,
      password: userData.password,
      token: loginData.token,
    };

    authHeaders = {
      Authorization: `Bearer ${testUser.token}`,
    };
  });

  test.afterEach(async () => {
    // Cleanup: Delete test user and associated data
    if (testUser?.id) {
      await apiContext.delete(`/api/v1/users/${testUser.id}`, {
        headers: authHeaders,
      });
    }
  });

  test('Complete Profile Creation Workflow', async () => {
    // Step 1: Get initial empty profile
    const initialProfileResponse = await apiContext.get('/api/v1/profile', {
      headers: authHeaders,
    });
    expect(initialProfileResponse.status()).toBe(200);

    const initialProfile = await initialProfileResponse.json();
    expect(initialProfile.profile).toBeNull();
    expect(initialProfile.settings).toBeDefined();

    // Step 2: Create user profile
    const profileData: UserProfile = {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      phone: faker.phone.number('+1##########'),
      dateOfBirth: '1990-05-15',
      preferences: {
        theme: 'dark',
        notifications: true,
        language: 'en',
      },
    };

    const createProfileResponse = await apiContext.post(`/api/v1/profile/${testUser.id}`, {
      headers: authHeaders,
      data: profileData,
    });
    expect(createProfileResponse.status()).toBe(201);

    const createdProfile = await createProfileResponse.json();
    expect(createdProfile.firstName).toBe(profileData.firstName);
    expect(createdProfile.lastName).toBe(profileData.lastName);
    expect(createdProfile.phone).toBe(profileData.phone);
    expect(createdProfile.preferences).toEqual(profileData.preferences);

    // Step 3: Update user settings
    const settingsData: Partial<UserSettings> = {
      language: 'French',
      currency: 'EUR',
      timezone: 'Europe/Paris',
      dealAlerts: false,
      tripReminders: true,
      priceAlerts: true,
      newsletter: true,
      profileVisibility: 'private',
      dataSharing: false,
      marketing: false,
      preferredDestinations: ['Paris', 'London', 'Tokyo'],
      accommodationType: ['hotel', 'apartment'],
      activities: ['sightseeing', 'museums'],
      dietary: ['vegetarian'],
    };

    const updateSettingsResponse = await apiContext.put('/api/v1/profile', {
      headers: authHeaders,
      data: {
        preferences: {
          language: settingsData.language,
          currency: settingsData.currency,
          timezone: settingsData.timezone,
        },
        notifications: {
          dealAlerts: settingsData.dealAlerts,
          tripReminders: settingsData.tripReminders,
          priceAlerts: settingsData.priceAlerts,
          newsletter: settingsData.newsletter,
        },
        privacy: {
          profileVisibility: settingsData.profileVisibility,
          dataSharing: settingsData.dataSharing,
          marketing: settingsData.marketing,
        },
        travel: {
          preferredDestinations: settingsData.preferredDestinations,
          accommodationType: settingsData.accommodationType,
          activities: settingsData.activities,
          dietary: settingsData.dietary,
        },
      },
    });
    expect(updateSettingsResponse.status()).toBe(200);

    // Step 4: Verify complete profile
    const finalProfileResponse = await apiContext.get('/api/v1/profile', {
      headers: authHeaders,
    });
    expect(finalProfileResponse.status()).toBe(200);

    const finalProfile = await finalProfileResponse.json();
    expect(finalProfile.profile).toBeDefined();
    expect(finalProfile.settings).toBeDefined();
    expect(finalProfile.profile.firstName).toBe(profileData.firstName);
    expect(finalProfile.settings.language).toBe(settingsData.language);
    expect(finalProfile.settings.preferredDestinations).toEqual(settingsData.preferredDestinations);
  });

  test('Avatar Upload Workflow', async () => {
    // Step 1: Create basic profile first
    const profileData = {
      firstName: 'Avatar',
      lastName: 'Test',
      phone: '+1234567890',
      dateOfBirth: '1990-01-01',
    };

    await apiContext.post(`/api/v1/profile/${testUser.id}`, {
      headers: authHeaders,
      data: profileData,
    });

    // Step 2: Upload avatar (simulate file upload)
    const avatarData = {
      filename: 'test-avatar.jpg',
      originalname: 'avatar.jpg',
      mimetype: 'image/jpeg',
      size: 1024 * 100, // 100KB
    };

    const uploadResponse = await apiContext.post(`/api/v1/profile/${testUser.id}/avatar`, {
      headers: authHeaders,
      data: avatarData,
    });
    expect(uploadResponse.status()).toBe(200);

    const uploadResult = await uploadResponse.json();
    expect(uploadResult.avatar).toContain('test-avatar.jpg');

    // Step 3: Verify avatar in profile
    const profileResponse = await apiContext.get('/api/v1/profile', {
      headers: authHeaders,
    });
    const profile = await profileResponse.json();
    expect(profile.profile.avatar).toContain('test-avatar.jpg');
  });

  test('Profile Update Workflow', async () => {
    // Step 1: Create initial profile
    const initialData = {
      firstName: 'Initial',
      lastName: 'User',
      phone: '+1111111111',
      dateOfBirth: '1990-01-01',
    };

    await apiContext.post(`/api/v1/profile/${testUser.id}`, {
      headers: authHeaders,
      data: initialData,
    });

    // Step 2: Update profile information
    const updateData = {
      profile: {
        name: 'Updated User Name',
        email: 'updated@example.com',
        photo: '/uploads/avatars/updated-avatar.jpg',
      },
      preferences: {
        language: 'Spanish',
        currency: 'EUR',
        timezone: 'Europe/Madrid',
      },
      notifications: {
        dealAlerts: false,
        tripReminders: false,
        priceAlerts: true,
        newsletter: true,
      },
      privacy: {
        profileVisibility: 'friends',
        dataSharing: true,
        marketing: false,
      },
      travel: {
        preferredDestinations: ['Madrid', 'Barcelona', 'Valencia'],
        accommodationType: ['hotel', 'hostel'],
        activities: ['flamenco', 'museums', 'beaches'],
        dietary: ['mediterranean'],
      },
    };

    const updateResponse = await apiContext.put('/api/v1/profile', {
      headers: authHeaders,
      data: updateData,
    });
    expect(updateResponse.status()).toBe(200);

    // Step 3: Verify updates
    const updatedProfileResponse = await apiContext.get('/api/v1/profile', {
      headers: authHeaders,
    });
    const updatedProfile = await updatedProfileResponse.json();

    expect(updatedProfile.settings.language).toBe('Spanish');
    expect(updatedProfile.settings.currency).toBe('EUR');
    expect(updatedProfile.settings.dealAlerts).toBe(false);
    expect(updatedProfile.settings.preferredDestinations).toEqual(['Madrid', 'Barcelona', 'Valencia']);
  });

  test('Profile Deletion Workflow', async () => {
    // Step 1: Create profile and settings
    await apiContext.post(`/api/v1/profile/${testUser.id}`, {
      headers: authHeaders,
      data: {
        firstName: 'Delete',
        lastName: 'Me',
        phone: '+9999999999',
        dateOfBirth: '1990-01-01',
      },
    });

    // Verify profile exists
    const profileResponse = await apiContext.get('/api/v1/profile', {
      headers: authHeaders,
    });
    expect(profileResponse.status()).toBe(200);
    const profile = await profileResponse.json();
    expect(profile.profile).toBeDefined();

    // Step 2: Delete profile
    const deleteResponse = await apiContext.delete(`/api/v1/profile/${testUser.id}`, {
      headers: authHeaders,
    });
    expect(deleteResponse.status()).toBe(200);

    // Step 3: Verify profile is deleted
    const deletedProfileResponse = await apiContext.get('/api/v1/profile', {
      headers: authHeaders,
    });
    expect(deletedProfileResponse.status()).toBe(200);
    const deletedProfile = await deletedProfileResponse.json();
    expect(deletedProfile.profile).toBeNull();
  });

  test('Authentication Token Workflow', async () => {
    // Step 1: Create profile with valid token
    const profileData = {
      firstName: 'Auth',
      lastName: 'Test',
      phone: '+1234567890',
      dateOfBirth: '1990-01-01',
    };

    const createResponse = await apiContext.post(`/api/v1/profile/${testUser.id}`, {
      headers: authHeaders,
      data: profileData,
    });
    expect(createResponse.status()).toBe(201);

    // Step 2: Try to access with invalid token
    const invalidHeaders = { Authorization: 'Bearer invalid-token' };

    const invalidResponse = await apiContext.get('/api/v1/profile', {
      headers: invalidHeaders,
    });
    expect(invalidResponse.status()).toBe(401);

    // Step 3: Try to access without token
    const noTokenResponse = await apiContext.get('/api/v1/profile');
    expect(noTokenResponse.status()).toBe(401);

    // Step 4: Logout (blacklist token)
    const logoutResponse = await apiContext.post('/api/v1/auth/logout', {
      headers: authHeaders,
    });
    expect(logoutResponse.status()).toBe(200);

    // Step 5: Try to access with blacklisted token
    const blacklistedResponse = await apiContext.get('/api/v1/profile', {
      headers: authHeaders,
    });
    expect(blacklistedResponse.status()).toBe(401);

    // Re-login for cleanup
    const loginResponse = await apiContext.post('/api/v1/auth/login', {
      data: {
        email: testUser.email,
        password: testUser.password,
      },
    });
    const loginData = await loginResponse.json();
    authHeaders.Authorization = `Bearer ${loginData.token}`;
  });

  test('Error Handling Workflow', async () => {
    // Test 1: Create profile with invalid data
    const invalidProfileData = {
      firstName: '', // Empty required field
      lastName: 'Test',
      phone: 'invalid-phone-format',
      dateOfBirth: 'invalid-date',
    };

    const invalidCreateResponse = await apiContext.post(`/api/v1/profile/${testUser.id}`, {
      headers: authHeaders,
      data: invalidProfileData,
    });
    expect(invalidCreateResponse.status()).toBe(400);

    // Test 2: Try to create profile for non-existent user
    const nonExistentUserResponse = await apiContext.post('/api/v1/profile/non-existent-user-id', {
      headers: authHeaders,
      data: {
        firstName: 'Test',
        lastName: 'User',
        phone: '+1234567890',
        dateOfBirth: '1990-01-01',
      },
    });
    expect(nonExistentUserResponse.status()).toBe(403);

    // Test 3: Try to update non-existent profile
    const updateNonExistentResponse = await apiContext.put('/api/v1/profile', {
      headers: authHeaders,
      data: {
        profile: { name: 'Updated Name' },
      },
    });
    expect(updateNonExistentResponse.status()).toBe(404);

    // Test 4: Try to delete non-existent profile
    const deleteNonExistentResponse = await apiContext.delete(`/api/v1/profile/${testUser.id}`, {
      headers: authHeaders,
    });
    expect(deleteNonExistentResponse.status()).toBe(404);

    // Test 5: Upload avatar without profile
    const uploadNoProfileResponse = await apiContext.post(`/api/v1/profile/${testUser.id}/avatar`, {
      headers: authHeaders,
      data: {
        filename: 'test.jpg',
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      },
    });
    expect(uploadNoProfileResponse.status()).toBe(404);
  });

  test('Concurrent Profile Operations Workflow', async () => {
    // Create initial profile
    const profileData = {
      firstName: 'Concurrent',
      lastName: 'Test',
      phone: '+1234567890',
      dateOfBirth: '1990-01-01',
    };

    await apiContext.post(`/api/v1/profile/${testUser.id}`, {
      headers: authHeaders,
      data: profileData,
    });

    // Perform multiple concurrent operations
    const operations = [
      apiContext.put('/api/v1/profile', {
        headers: authHeaders,
        data: {
          profile: { name: 'Updated Name 1' },
          preferences: { language: 'French' },
        },
      }),
      apiContext.put('/api/v1/profile', {
        headers: authHeaders,
        data: {
          profile: { name: 'Updated Name 2' },
          preferences: { currency: 'EUR' },
        },
      }),
      apiContext.get('/api/v1/profile', { headers: authHeaders }),
      apiContext.post(`/api/v1/profile/${testUser.id}/avatar`, {
        headers: authHeaders,
        data: {
          filename: 'concurrent-avatar.jpg',
          originalname: 'avatar.jpg',
          mimetype: 'image/jpeg',
        },
      }),
    ];

    const results = await Promise.allSettled(operations);

    // At least one operation should succeed
    const successfulOperations = results.filter(
      result => result.status === 'fulfilled' &&
      (result.value as any).status() >= 200 &&
      (result.value as any).status() < 300
    );
    expect(successfulOperations.length).toBeGreaterThan(0);

    // Verify final state is consistent
    const finalProfileResponse = await apiContext.get('/api/v1/profile', {
      headers: authHeaders,
    });
    expect(finalProfileResponse.status()).toBe(200);
    const finalProfile = await finalProfileResponse.json();
    expect(finalProfile.profile).toBeDefined();
  });

  test('Profile Privacy Settings Workflow', async () => {
    // Step 1: Create profile with public visibility
    await apiContext.post(`/api/v1/profile/${testUser.id}`, {
      headers: authHeaders,
      data: {
        firstName: 'Privacy',
        lastName: 'Test',
        phone: '+1234567890',
        dateOfBirth: '1990-01-01',
      },
    });

    // Step 2: Set privacy to private
    await apiContext.put('/api/v1/profile', {
      headers: authHeaders,
      data: {
        privacy: {
          profileVisibility: 'private',
          dataSharing: false,
          marketing: false,
        },
      },
    });

    // Step 3: Verify privacy settings
    const profileResponse = await apiContext.get('/api/v1/profile', {
      headers: authHeaders,
    });
    const profile = await profileResponse.json();
    expect(profile.settings.profileVisibility).toBe('private');
    expect(profile.settings.dataSharing).toBe(false);
    expect(profile.settings.marketing).toBe(false);

    // Step 4: Update to friends only
    await apiContext.put('/api/v1/profile', {
      headers: authHeaders,
      data: {
        privacy: {
          profileVisibility: 'friends',
          dataSharing: true,
          marketing: true,
        },
      },
    });

    // Step 5: Verify updated privacy settings
    const updatedResponse = await apiContext.get('/api/v1/profile', {
      headers: authHeaders,
    });
    const updatedProfile = await updatedResponse.json();
    expect(updatedProfile.settings.profileVisibility).toBe('friends');
    expect(updatedProfile.settings.dataSharing).toBe(true);
    expect(updatedProfile.settings.marketing).toBe(true);
  });
});