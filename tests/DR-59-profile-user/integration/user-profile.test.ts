import { PrismaClient } from '@prisma/client';
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Test database instance
let prisma: PrismaClient;

describe('UserProfile Integration Tests', () => {
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
    await prisma.userProfile.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.userSettings.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.delete({
      where: { id: testUserId },
    });
  });

  describe('UserProfile CRUD Operations', () => {
    it('should create user profile with required fields', async () => {
      const profileData = {
        userId: testUserId,
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        dateOfBirth: new Date('1990-01-01'),
      };

      const userProfile = await prisma.userProfile.create({
        data: profileData,
      });

      expect(userProfile).toBeDefined();
      expect(userProfile.userId).toBe(testUserId);
      expect(userProfile.firstName).toBe('John');
      expect(userProfile.lastName).toBe('Doe');
      expect(userProfile.phone).toBe('+1234567890');
      expect(userProfile.dateOfBirth).toEqual(new Date('1990-01-01'));
      expect(userProfile.avatar).toBeNull();
      expect(userProfile.preferences).toBeNull();
    });

    it('should create user profile with all optional fields', async () => {
      const profileData = {
        userId: testUserId,
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+0987654321',
        dateOfBirth: new Date('1985-06-15'),
        avatar: '/uploads/avatars/jane-smith.jpg',
        preferences: {
          theme: 'dark',
          notifications: true,
          language: 'en',
          timezone: 'America/New_York',
        },
      };

      const userProfile = await prisma.userProfile.create({
        data: profileData,
      });

      expect(userProfile.avatar).toBe('/uploads/avatars/jane-smith.jpg');
      expect(userProfile.preferences).toEqual({
        theme: 'dark',
        notifications: true,
        language: 'en',
        timezone: 'America/New_York',
      });
    });

    it('should update user profile', async () => {
      // Create initial profile
      const initialProfile = await prisma.userProfile.create({
        data: {
          userId: testUserId,
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          dateOfBirth: new Date('1990-01-01'),
        },
      });

      // Update profile
      const updatedProfile = await prisma.userProfile.update({
        where: { userId: testUserId },
        data: {
          firstName: 'Jonathan',
          phone: '+1111111111',
          avatar: '/uploads/avatars/jonathan-doe.jpg',
          preferences: {
            theme: 'light',
            notifications: false,
          },
        },
      });

      expect(updatedProfile.firstName).toBe('Jonathan');
      expect(updatedProfile.phone).toBe('+1111111111');
      expect(updatedProfile.avatar).toBe('/uploads/avatars/jonathan-doe.jpg');
      expect(updatedProfile.preferences).toEqual({
        theme: 'light',
        notifications: false,
      });

      // Unchanged values should remain
      expect(updatedProfile.lastName).toBe('Doe');
      expect(updatedProfile.dateOfBirth).toEqual(new Date('1990-01-01'));
    });

    it('should upsert user profile (create when not exists)', async () => {
      const profileData = {
        userId: testUserId,
        firstName: 'Alice',
        lastName: 'Johnson',
        phone: '+5555555555',
        dateOfBirth: new Date('1995-03-20'),
      };

      const upsertedProfile = await prisma.userProfile.upsert({
        where: { userId: testUserId },
        create: profileData,
        update: {
          firstName: 'Alicia',
        },
      });

      expect(upsertedProfile.firstName).toBe('Alice');
      expect(upsertedProfile.lastName).toBe('Johnson');
      expect(upsertedProfile.phone).toBe('+5555555555');
    });

    it('should upsert user profile (update when exists)', async () => {
      // Create initial profile
      await prisma.userProfile.create({
        data: {
          userId: testUserId,
          firstName: 'Bob',
          lastName: 'Wilson',
          phone: '+7777777777',
          dateOfBirth: new Date('1988-12-10'),
        },
      });

      // Upsert should update
      const upsertedProfile = await prisma.userProfile.upsert({
        where: { userId: testUserId },
        create: {
          userId: testUserId,
          firstName: 'Robert',
          lastName: 'Williams',
          phone: '+8888888888',
          dateOfBirth: new Date('1990-01-01'),
        },
        update: {
          firstName: 'Bobby',
          phone: '+9999999999',
        },
      });

      expect(upsertedProfile.firstName).toBe('Bobby');
      expect(upsertedProfile.phone).toBe('+9999999999');
      expect(upsertedProfile.lastName).toBe('Wilson'); // Should remain unchanged
      expect(upsertedProfile.dateOfBirth).toEqual(new Date('1988-12-10')); // Should remain unchanged
    });

    it('should delete user profile', async () => {
      // Create profile
      await prisma.userProfile.create({
        data: {
          userId: testUserId,
          firstName: 'Charlie',
          lastName: 'Brown',
          phone: '+3333333333',
          dateOfBirth: new Date('1992-08-25'),
        },
      });

      // Delete profile
      await prisma.userProfile.delete({
        where: { userId: testUserId },
      });

      // Verify deletion
      const deletedProfile = await prisma.userProfile.findUnique({
        where: { userId: testUserId },
      });

      expect(deletedProfile).toBeNull();
    });
  });

  describe('UserProfile Constraints and Validations', () => {
    it('should enforce unique constraint on userId', async () => {
      // Create first profile
      await prisma.userProfile.create({
        data: {
          userId: testUserId,
          firstName: 'First',
          lastName: 'Profile',
          phone: '+1111111111',
          dateOfBirth: new Date('1990-01-01'),
        },
      });

      // Attempt to create duplicate should fail
      await expect(
        prisma.userProfile.create({
          data: {
            userId: testUserId,
            firstName: 'Second',
            lastName: 'Profile',
            phone: '+2222222222',
            dateOfBirth: new Date('1991-01-01'),
          },
        })
      ).rejects.toThrow();
    });

    it('should handle foreign key constraint for userId', async () => {
      const nonExistentUserId = 'non-existent-user-id';

      await expect(
        prisma.userProfile.create({
          data: {
            userId: nonExistentUserId,
            firstName: 'Invalid',
            lastName: 'User',
            phone: '+0000000000',
            dateOfBirth: new Date('1990-01-01'),
          },
        })
      ).rejects.toThrow();
    });

    it('should handle JSON preferences field correctly', async () => {
      const complexPreferences = {
        theme: 'dark',
        notifications: {
          email: true,
          push: false,
          sms: true,
        },
        privacy: {
          profileVisible: false,
          showEmail: false,
        },
        customSettings: {
          autoSave: true,
          language: 'en-US',
          timezone: 'UTC',
          dateFormat: 'YYYY-MM-DD',
        },
      };

      const userProfile = await prisma.userProfile.create({
        data: {
          userId: testUserId,
          firstName: 'Json',
          lastName: 'Test',
          phone: '+1234567890',
          dateOfBirth: new Date('1990-01-01'),
          preferences: complexPreferences,
        },
      });

      expect(userProfile.preferences).toEqual(complexPreferences);
      expect(typeof userProfile.preferences).toBe('object');
    });

    it('should handle null values for optional fields', async () => {
      const userProfile = await prisma.userProfile.create({
        data: {
          userId: testUserId,
          firstName: 'Minimal',
          lastName: 'Profile',
          phone: '+1234567890',
          dateOfBirth: new Date('1990-01-01'),
          avatar: null,
          preferences: null,
        },
      });

      expect(userProfile.avatar).toBeNull();
      expect(userProfile.preferences).toBeNull();
    });
  });

  describe('UserProfile Relationships', () => {
    it('should retrieve user profile with user relationship', async () => {
      // Create profile
      await prisma.userProfile.create({
        data: {
          userId: testUserId,
          firstName: 'Related',
          lastName: 'User',
          phone: '+1234567890',
          dateOfBirth: new Date('1990-01-01'),
        },
      });

      // Retrieve with user relationship
      const profileWithUser = await prisma.userProfile.findUnique({
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

      expect(profileWithUser).toBeDefined();
      expect(profileWithUser?.user).toBeDefined();
      expect(profileWithUser?.user.email).toContain('@example.com');
      expect(profileWithUser?.user.firstName).toBe('Test');
      expect(profileWithUser?.user.lastName).toBe('User');
    });

    it('should cascade delete when user is deleted', async () => {
      // Create profile
      await prisma.userProfile.create({
        data: {
          userId: testUserId,
          firstName: 'Cascade',
          lastName: 'Delete',
          phone: '+1234567890',
          dateOfBirth: new Date('1990-01-01'),
        },
      });

      // Delete user (this should cascade to profile)
      await prisma.user.delete({
        where: { id: testUserId },
      });

      // Verify profile is also deleted
      const orphanedProfile = await prisma.userProfile.findUnique({
        where: { userId: testUserId },
      });

      expect(orphanedProfile).toBeNull();

      // Prevent cleanup from running since we manually deleted the user
      testUserId = '';
    });

    it('should work with user settings in combined queries', async () => {
      // Create profile
      await prisma.userProfile.create({
        data: {
          userId: testUserId,
          firstName: 'Combined',
          lastName: 'Query',
          phone: '+1234567890',
          dateOfBirth: new Date('1990-01-01'),
        },
      });

      // Create settings
      await prisma.userSettings.create({
        data: {
          userId: testUserId,
          language: 'English',
          currency: 'USD',
          timezone: 'UTC',
        },
      });

      // Retrieve user with both profile and settings
      const userWithBoth = await prisma.user.findUnique({
        where: { id: testUserId },
        include: {
          profile: true,
          settings: true,
        },
      });

      expect(userWithBoth).toBeDefined();
      expect(userWithBoth?.profile).toBeDefined();
      expect(userWithBoth?.settings).toBeDefined();
      expect(userWithBoth?.profile?.firstName).toBe('Combined');
      expect(userWithBoth?.settings?.language).toBe('English');
    });
  });

  describe('UserProfile Query Operations', () => {
    beforeEach(async () => {
      // Create multiple test users with profiles for query tests
      const users = await Promise.all([
        prisma.user.create({
          data: {
            email: `query-profile-1-${Date.now()}@example.com`,
            username: `queryprofile1-${Date.now()}`,
            firstName: 'Query',
            lastName: 'Profile1',
            password: 'hashedpassword',
          },
        }),
        prisma.user.create({
          data: {
            email: `query-profile-2-${Date.now()}@example.com`,
            username: `queryprofile2-${Date.now()}`,
            firstName: 'Query',
            lastName: 'Profile2',
            password: 'hashedpassword',
          },
        }),
      ]);

      await Promise.all([
        prisma.userProfile.create({
          data: {
            userId: users[0].id,
            firstName: 'John',
            lastName: 'Smith',
            phone: '+1111111111',
            dateOfBirth: new Date('1990-01-01'),
            avatar: '/uploads/avatars/john.jpg',
          },
        }),
        prisma.userProfile.create({
          data: {
            userId: users[1].id,
            firstName: 'Jane',
            lastName: 'Doe',
            phone: '+2222222222',
            dateOfBirth: new Date('1985-05-15'),
            avatar: null,
          },
        }),
      ]);
    });

    it('should find profiles by first name', async () => {
      const johnProfiles = await prisma.userProfile.findMany({
        where: {
          firstName: 'John',
        },
      });

      expect(johnProfiles.length).toBeGreaterThan(0);
      expect(johnProfiles.every(p => p.firstName === 'John')).toBe(true);
    });

    it('should find profiles with avatars', async () => {
      const profilesWithAvatars = await prisma.userProfile.findMany({
        where: {
          avatar: {
            not: null,
          },
        },
      });

      expect(profilesWithAvatars.length).toBeGreaterThan(0);
      expect(profilesWithAvatars.every(p => p.avatar !== null)).toBe(true);
    });

    it('should find profiles without avatars', async () => {
      const profilesWithoutAvatars = await prisma.userProfile.findMany({
        where: {
          avatar: null,
        },
      });

      expect(profilesWithoutAvatars.length).toBeGreaterThan(0);
      expect(profilesWithoutAvatars.every(p => p.avatar === null)).toBe(true);
    });

    it('should find profiles by date of birth range', async () => {
      const profilesAfter1988 = await prisma.userProfile.findMany({
        where: {
          dateOfBirth: {
            gte: new Date('1988-01-01'),
          },
        },
      });

      expect(profilesAfter1988.length).toBeGreaterThan(0);
      expect(profilesAfter1988.every(p => p.dateOfBirth >= new Date('1988-01-01'))).toBe(true);
    });

    it('should search profiles by partial name match', async () => {
      const partialNameProfiles = await prisma.userProfile.findMany({
        where: {
          OR: [
            {
              firstName: {
                contains: 'J',
                mode: 'insensitive',
              },
            },
            {
              lastName: {
                contains: 'D',
                mode: 'insensitive',
              },
            },
          ],
        },
      });

      expect(partialNameProfiles.length).toBeGreaterThan(0);
    });
  });

  describe('UserProfile Data Integrity', () => {
    it('should maintain data integrity when updating timestamps', async () => {
      const initialProfile = await prisma.userProfile.create({
        data: {
          userId: testUserId,
          firstName: 'Timestamp',
          lastName: 'Test',
          phone: '+1234567890',
          dateOfBirth: new Date('1990-01-01'),
        },
      });

      const initialCreatedAt = initialProfile.createdAt;
      const initialUpdatedAt = initialProfile.updatedAt;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      const updatedProfile = await prisma.userProfile.update({
        where: { userId: testUserId },
        data: {
          firstName: 'Updated',
        },
      });

      expect(updatedProfile.createdAt).toEqual(initialCreatedAt);
      expect(updatedProfile.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('should handle phone number format variations', async () => {
      const phoneFormats = [
        '+1234567890',
        '+1 (234) 567-8901',
        '+33 1 23 45 67 89',
        '(555) 123-4567',
        '555-123-4567',
        '555.123.4567',
      ];

      for (let i = 0; i < phoneFormats.length; i++) {
        const phoneFormat = phoneFormats[i];

        // Create a separate user for each phone format test
        const testUser = await prisma.user.create({
          data: {
            email: `phone-test-${i}-${Date.now()}@example.com`,
            username: `phonetest${i}-${Date.now()}`,
            firstName: 'Phone',
            lastName: `Test${i}`,
            password: 'hashedpassword',
          },
        });

        const profile = await prisma.userProfile.create({
          data: {
            userId: testUser.id,
            firstName: 'Phone',
            lastName: 'Format',
            phone: phoneFormat,
            dateOfBirth: new Date('1990-01-01'),
          },
        });

        expect(profile.phone).toBe(phoneFormat);

        // Clean up
        await prisma.userProfile.delete({ where: { userId: testUser.id } });
        await prisma.user.delete({ where: { id: testUser.id } });
      }
    });
  });
});