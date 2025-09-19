import { PrismaClient } from '@prisma/client';
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Test database instance
let prisma: PrismaClient;

describe('UserSettings Integration Tests', () => {
  let testUserId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/dreamscape_test',
        },
      },
    });

    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        username: `testuser-${Date.now()}`,
        firstName: 'Test',
        lastName: 'User',
        password: 'hashedpassword',
      },
    });
    testUserId = testUser.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.userSettings.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.userProfile.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.delete({
      where: { id: testUserId },
    });
  });

  describe('UserSettings CRUD Operations', () => {
    it('should create user settings with default values', async () => {
      const userSettings = await prisma.userSettings.create({
        data: {
          userId: testUserId,
          language: 'English',
          currency: 'USD',
          timezone: 'UTC',
        },
      });

      expect(userSettings).toBeDefined();
      expect(userSettings.userId).toBe(testUserId);
      expect(userSettings.language).toBe('English');
      expect(userSettings.currency).toBe('USD');
      expect(userSettings.timezone).toBe('UTC');

      // Test default values
      expect(userSettings.dealAlerts).toBe(true);
      expect(userSettings.tripReminders).toBe(true);
      expect(userSettings.priceAlerts).toBe(true);
      expect(userSettings.newsletter).toBe(false);
      expect(userSettings.profileVisibility).toBe('public');
      expect(userSettings.dataSharing).toBe(false);
      expect(userSettings.marketing).toBe(true);
      expect(userSettings.preferredDestinations).toEqual([]);
      expect(userSettings.accommodationType).toEqual([]);
      expect(userSettings.activities).toEqual([]);
      expect(userSettings.dietary).toEqual([]);
    });

    it('should create user settings with custom values', async () => {
      const customSettings = {
        userId: testUserId,
        language: 'French',
        currency: 'EUR',
        timezone: 'Europe/Paris',
        dealAlerts: false,
        tripReminders: false,
        priceAlerts: false,
        newsletter: true,
        profileVisibility: 'private',
        dataSharing: true,
        marketing: false,
        preferredDestinations: ['Paris', 'London', 'Tokyo'],
        accommodationType: ['hotel', 'apartment'],
        activities: ['sightseeing', 'museums'],
        dietary: ['vegetarian', 'gluten-free'],
      };

      const userSettings = await prisma.userSettings.create({
        data: customSettings,
      });

      expect(userSettings.language).toBe('French');
      expect(userSettings.currency).toBe('EUR');
      expect(userSettings.timezone).toBe('Europe/Paris');
      expect(userSettings.dealAlerts).toBe(false);
      expect(userSettings.tripReminders).toBe(false);
      expect(userSettings.priceAlerts).toBe(false);
      expect(userSettings.newsletter).toBe(true);
      expect(userSettings.profileVisibility).toBe('private');
      expect(userSettings.dataSharing).toBe(true);
      expect(userSettings.marketing).toBe(false);
      expect(userSettings.preferredDestinations).toEqual(['Paris', 'London', 'Tokyo']);
      expect(userSettings.accommodationType).toEqual(['hotel', 'apartment']);
      expect(userSettings.activities).toEqual(['sightseeing', 'museums']);
      expect(userSettings.dietary).toEqual(['vegetarian', 'gluten-free']);
    });

    it('should update user settings', async () => {
      // Create initial settings
      const initialSettings = await prisma.userSettings.create({
        data: {
          userId: testUserId,
          language: 'English',
          currency: 'USD',
          timezone: 'UTC',
        },
      });

      // Update settings
      const updatedSettings = await prisma.userSettings.update({
        where: { userId: testUserId },
        data: {
          language: 'Spanish',
          currency: 'EUR',
          dealAlerts: false,
          preferredDestinations: ['Madrid', 'Barcelona'],
        },
      });

      expect(updatedSettings.language).toBe('Spanish');
      expect(updatedSettings.currency).toBe('EUR');
      expect(updatedSettings.dealAlerts).toBe(false);
      expect(updatedSettings.preferredDestinations).toEqual(['Madrid', 'Barcelona']);

      // Unchanged values should remain
      expect(updatedSettings.timezone).toBe('UTC');
      expect(updatedSettings.tripReminders).toBe(true);
    });

    it('should upsert user settings (create when not exists)', async () => {
      const upsertedSettings = await prisma.userSettings.upsert({
        where: { userId: testUserId },
        create: {
          userId: testUserId,
          language: 'German',
          currency: 'EUR',
          timezone: 'Europe/Berlin',
        },
        update: {
          language: 'German',
        },
      });

      expect(upsertedSettings.language).toBe('German');
      expect(upsertedSettings.currency).toBe('EUR');
      expect(upsertedSettings.timezone).toBe('Europe/Berlin');
    });

    it('should upsert user settings (update when exists)', async () => {
      // Create initial settings
      await prisma.userSettings.create({
        data: {
          userId: testUserId,
          language: 'English',
          currency: 'USD',
          timezone: 'UTC',
        },
      });

      // Upsert should update
      const upsertedSettings = await prisma.userSettings.upsert({
        where: { userId: testUserId },
        create: {
          userId: testUserId,
          language: 'German',
          currency: 'EUR',
          timezone: 'Europe/Berlin',
        },
        update: {
          language: 'Italian',
          currency: 'EUR',
        },
      });

      expect(upsertedSettings.language).toBe('Italian');
      expect(upsertedSettings.currency).toBe('EUR');
      expect(upsertedSettings.timezone).toBe('UTC'); // Should remain unchanged
    });

    it('should delete user settings', async () => {
      // Create settings
      await prisma.userSettings.create({
        data: {
          userId: testUserId,
          language: 'English',
          currency: 'USD',
          timezone: 'UTC',
        },
      });

      // Delete settings
      await prisma.userSettings.delete({
        where: { userId: testUserId },
      });

      // Verify deletion
      const deletedSettings = await prisma.userSettings.findUnique({
        where: { userId: testUserId },
      });

      expect(deletedSettings).toBeNull();
    });
  });

  describe('UserSettings Constraints and Validations', () => {
    it('should enforce unique constraint on userId', async () => {
      // Create first settings
      await prisma.userSettings.create({
        data: {
          userId: testUserId,
          language: 'English',
          currency: 'USD',
          timezone: 'UTC',
        },
      });

      // Attempt to create duplicate should fail
      await expect(
        prisma.userSettings.create({
          data: {
            userId: testUserId,
            language: 'French',
            currency: 'EUR',
            timezone: 'Europe/Paris',
          },
        })
      ).rejects.toThrow();
    });

    it('should handle foreign key constraint for userId', async () => {
      const nonExistentUserId = 'non-existent-user-id';

      await expect(
        prisma.userSettings.create({
          data: {
            userId: nonExistentUserId,
            language: 'English',
            currency: 'USD',
            timezone: 'UTC',
          },
        })
      ).rejects.toThrow();
    });

    it('should handle array fields correctly', async () => {
      const userSettings = await prisma.userSettings.create({
        data: {
          userId: testUserId,
          language: 'English',
          currency: 'USD',
          timezone: 'UTC',
          preferredDestinations: ['New York', 'Los Angeles', 'Chicago'],
          accommodationType: ['hotel', 'apartment', 'hostel'],
          activities: ['sightseeing', 'museums', 'restaurants', 'nightlife'],
          dietary: ['vegetarian', 'vegan', 'gluten-free'],
        },
      });

      expect(Array.isArray(userSettings.preferredDestinations)).toBe(true);
      expect(userSettings.preferredDestinations).toHaveLength(3);
      expect(userSettings.accommodationType).toContain('hotel');
      expect(userSettings.activities).toContain('museums');
      expect(userSettings.dietary).toContain('vegetarian');
    });
  });

  describe('UserSettings Relationships', () => {
    it('should retrieve user settings with user relationship', async () => {
      // Create settings
      await prisma.userSettings.create({
        data: {
          userId: testUserId,
          language: 'English',
          currency: 'USD',
          timezone: 'UTC',
        },
      });

      // Retrieve with user relationship
      const settingsWithUser = await prisma.userSettings.findUnique({
        where: { userId: testUserId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      expect(settingsWithUser).toBeDefined();
      expect(settingsWithUser?.user).toBeDefined();
      expect(settingsWithUser?.user.email).toContain('@example.com');
      expect(settingsWithUser?.user.firstName).toBe('Test');
      expect(settingsWithUser?.user.lastName).toBe('User');
    });

    it('should cascade delete when user is deleted', async () => {
      // Create settings
      await prisma.userSettings.create({
        data: {
          userId: testUserId,
          language: 'English',
          currency: 'USD',
          timezone: 'UTC',
        },
      });

      // Delete user (this should cascade to settings)
      await prisma.user.delete({
        where: { id: testUserId },
      });

      // Verify settings are also deleted
      const orphanedSettings = await prisma.userSettings.findUnique({
        where: { userId: testUserId },
      });

      expect(orphanedSettings).toBeNull();

      // Prevent cleanup from running since we manually deleted the user
      testUserId = '';
    });
  });

  describe('UserSettings Query Operations', () => {
    beforeEach(async () => {
      // Create multiple test users with settings for query tests
      const users = await Promise.all([
        prisma.user.create({
          data: {
            email: `query-test-1-${Date.now()}@example.com`,
            username: `queryuser1-${Date.now()}`,
            firstName: 'Query',
            lastName: 'User1',
            password: 'hashedpassword',
          },
        }),
        prisma.user.create({
          data: {
            email: `query-test-2-${Date.now()}@example.com`,
            username: `queryuser2-${Date.now()}`,
            firstName: 'Query',
            lastName: 'User2',
            password: 'hashedpassword',
          },
        }),
      ]);

      await Promise.all([
        prisma.userSettings.create({
          data: {
            userId: users[0].id,
            language: 'English',
            currency: 'USD',
            timezone: 'UTC',
            profileVisibility: 'public',
          },
        }),
        prisma.userSettings.create({
          data: {
            userId: users[1].id,
            language: 'French',
            currency: 'EUR',
            timezone: 'Europe/Paris',
            profileVisibility: 'private',
          },
        }),
      ]);
    });

    it('should find settings by language', async () => {
      const englishSettings = await prisma.userSettings.findMany({
        where: {
          language: 'English',
        },
      });

      expect(englishSettings.length).toBeGreaterThan(0);
      expect(englishSettings.every(s => s.language === 'English')).toBe(true);
    });

    it('should find settings by currency', async () => {
      const eurSettings = await prisma.userSettings.findMany({
        where: {
          currency: 'EUR',
        },
      });

      expect(eurSettings.length).toBeGreaterThan(0);
      expect(eurSettings.every(s => s.currency === 'EUR')).toBe(true);
    });

    it('should find settings by profile visibility', async () => {
      const publicSettings = await prisma.userSettings.findMany({
        where: {
          profileVisibility: 'public',
        },
      });

      const privateSettings = await prisma.userSettings.findMany({
        where: {
          profileVisibility: 'private',
        },
      });

      expect(publicSettings.length).toBeGreaterThan(0);
      expect(privateSettings.length).toBeGreaterThan(0);
      expect(publicSettings.every(s => s.profileVisibility === 'public')).toBe(true);
      expect(privateSettings.every(s => s.profileVisibility === 'private')).toBe(true);
    });
  });
});