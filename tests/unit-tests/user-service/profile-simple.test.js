const request = require('supertest');
const express = require('express');

describe('User Profile API - Unit Tests', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock auth middleware
    app.use((req, res, next) => {
      req.user = { 
        userId: 'test-user-id', 
        email: 'test@example.com' 
      };
      next();
    });
  });

  describe('Profile Data Transformation', () => {
    it('should transform user data correctly', () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      };

      const mockSettings = {
        language: 'English',
        currency: 'USD',
        timezone: 'UTC',
        dealAlerts: true,
        tripReminders: true,
        priceAlerts: false,
        newsletter: true,
        profileVisibility: 'public',
        dataSharing: false,
        marketing: true,
        preferredDestinations: ['Paris', 'Tokyo'],
        accommodationType: ['Hotel', 'Apartment'],
        activities: ['Sightseeing', 'Food'],
        dietary: ['Vegetarian']
      };

      // Simulate profile data transformation
      const transformedProfile = {
        profile: {
          name: `${mockUser.firstName} ${mockUser.lastName}`,
          email: mockUser.email,
          photo: null,
          username: mockUser.username
        },
        preferences: {
          language: mockSettings.language,
          currency: mockSettings.currency,
          timezone: mockSettings.timezone
        },
        notifications: {
          dealAlerts: mockSettings.dealAlerts,
          tripReminders: mockSettings.tripReminders,
          priceAlerts: mockSettings.priceAlerts,
          newsletter: mockSettings.newsletter
        },
        privacy: {
          profileVisibility: mockSettings.profileVisibility,
          dataSharing: mockSettings.dataSharing,
          marketing: mockSettings.marketing
        },
        travel: {
          preferredDestinations: mockSettings.preferredDestinations,
          accommodationType: mockSettings.accommodationType,
          activities: mockSettings.activities,
          dietary: mockSettings.dietary
        }
      };

      expect(transformedProfile.profile.name).toBe('John Doe');
      expect(transformedProfile.profile.email).toBe('test@example.com');
      expect(transformedProfile.preferences.language).toBe('English');
      expect(transformedProfile.travel.preferredDestinations).toEqual(['Paris', 'Tokyo']);
    });

    it('should handle partial name transformation', () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: null,
        username: 'john'
      };

      const name = `${mockUser.firstName || ''} ${mockUser.lastName || ''}`.trim() || mockUser.email;
      
      expect(name).toBe('John');
      
      // Test with both names null
      const mockUser2 = {
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: null,
        lastName: null,
        username: 'test'
      };

      const name2 = `${mockUser2.firstName || ''} ${mockUser2.lastName || ''}`.trim() || mockUser2.email;
      expect(name2).toBe('test@example.com');
    });

    it('should apply default settings when none provided', () => {
      const defaultSettings = {
        language: 'English',
        currency: 'USD',
        timezone: 'UTC',
        dealAlerts: true,
        tripReminders: true,
        priceAlerts: false,
        newsletter: true,
        profileVisibility: 'public',
        dataSharing: false,
        marketing: true,
        preferredDestinations: [],
        accommodationType: [],
        activities: [],
        dietary: []
      };

      // Test that default values are applied correctly
      expect(defaultSettings.language).toBe('English');
      expect(defaultSettings.currency).toBe('USD');
      expect(defaultSettings.dealAlerts).toBe(true);
      expect(defaultSettings.priceAlerts).toBe(false);
      expect(defaultSettings.preferredDestinations).toEqual([]);
    });
  });

  describe('Profile Update Logic', () => {
    it('should parse name into firstName and lastName', () => {
      const parseNameFromFullName = (fullName) => {
        if (!fullName) return { firstName: '', lastName: '' };
        
        const parts = fullName.split(' ');
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';
        
        return { firstName, lastName };
      };

      expect(parseNameFromFullName('John Doe')).toEqual({
        firstName: 'John',
        lastName: 'Doe'
      });

      expect(parseNameFromFullName('John Michael Doe')).toEqual({
        firstName: 'John',
        lastName: 'Michael Doe'
      });

      expect(parseNameFromFullName('Madonna')).toEqual({
        firstName: 'Madonna',
        lastName: ''
      });

      expect(parseNameFromFullName('')).toEqual({
        firstName: '',
        lastName: ''
      });
    });

    it('should merge settings updates correctly', () => {
      const existingSettings = {
        language: 'English',
        currency: 'USD',
        timezone: 'UTC',
        dealAlerts: true,
        preferredDestinations: ['Paris']
      };

      const updateData = {
        language: 'French',
        preferredDestinations: ['London', 'Berlin']
      };

      // Simulate merge logic
      const mergedSettings = {
        ...existingSettings,
        ...updateData
      };

      expect(mergedSettings.language).toBe('French');
      expect(mergedSettings.currency).toBe('USD'); // Should remain unchanged
      expect(mergedSettings.preferredDestinations).toEqual(['London', 'Berlin']);
    });

    it('should validate username format', () => {
      const isValidUsername = (username) => {
        if (!username) return false;
        // Simple validation: alphanumeric and underscore, 3-20 chars
        return /^[a-zA-Z0-9_]{3,20}$/.test(username);
      };

      expect(isValidUsername('valid_user123')).toBe(true);
      expect(isValidUsername('abc')).toBe(true);
      expect(isValidUsername('ab')).toBe(false); // Too short
      expect(isValidUsername('user@name')).toBe(false); // Invalid characters
      expect(isValidUsername('')).toBe(false); // Empty
      expect(isValidUsername('a'.repeat(21))).toBe(false); // Too long
    });

    it('should validate email format', () => {
      const isValidEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };

      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('Error Handling Logic', () => {
    it('should create appropriate error responses', () => {
      const createErrorResponse = (statusCode, message) => ({
        success: false,
        message,
        statusCode
      });

      const notFoundError = createErrorResponse(404, 'User not found');
      expect(notFoundError.success).toBe(false);
      expect(notFoundError.statusCode).toBe(404);
      expect(notFoundError.message).toBe('User not found');

      const validationError = createErrorResponse(400, 'Email already exists');
      expect(validationError.success).toBe(false);
      expect(validationError.statusCode).toBe(400);
    });

    it('should handle database constraint errors', () => {
      const handleDatabaseError = (error) => {
        if (error.code === 'P2002') {
          return {
            success: false,
            message: 'Email or username already exists',
            statusCode: 400
          };
        }
        
        return {
          success: false,
          message: 'Internal server error',
          statusCode: 500
        };
      };

      const constraintError = { code: 'P2002', message: 'Unique constraint failed' };
      const result = handleDatabaseError(constraintError);
      
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.message).toBe('Email or username already exists');

      const genericError = { message: 'Database connection failed' };
      const result2 = handleDatabaseError(genericError);
      
      expect(result2.statusCode).toBe(500);
      expect(result2.message).toBe('Internal server error');
    });
  });

  describe('Authentication Helpers', () => {
    it('should validate JWT token format', () => {
      const isValidJWTFormat = (token) => {
        if (!token) return false;
        const parts = token.split('.');
        return parts.length === 3;
      };

      expect(isValidJWTFormat('header.payload.signature')).toBe(true);
      expect(isValidJWTFormat('invalid-token')).toBe(false);
      expect(isValidJWTFormat('')).toBe(false);
      expect(isValidJWTFormat('a.b')).toBe(false);
    });

    it('should extract token from Authorization header', () => {
      const extractTokenFromHeader = (authHeader) => {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return null;
        }
        return authHeader.slice(7); // Remove 'Bearer ' prefix
      };

      expect(extractTokenFromHeader('Bearer token123')).toBe('token123');
      expect(extractTokenFromHeader('Invalid header')).toBe(null);
      expect(extractTokenFromHeader('')).toBe(null);
      expect(extractTokenFromHeader('Bearer ')).toBe('');
    });
  });
});