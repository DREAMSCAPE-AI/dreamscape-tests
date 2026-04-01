import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler, ApiError } from '../../../../dreamscape-services/user/src/middleware/errorHandler';

describe('errorHandler middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis() as jest.Mock;
    statusMock = jest.fn().mockReturnValue({ json: jsonMock }) as jest.Mock;
    mockRes = { status: statusMock, json: jsonMock };
    mockReq = { url: '/api/v1/users/test', method: 'GET', originalUrl: '/api/v1/users/test' };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('errorHandler', () => {
    it('should return 500 by default when no statusCode is set', () => {
      const err: ApiError = new Error('Something went wrong');

      errorHandler(err, mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(statusMock).toHaveBeenCalledWith(500);
      const jsonCall = (statusMock as jest.Mock).mock.results[0].value.json;
      expect(jsonCall).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Something went wrong',
            status: 500,
          }),
        })
      );
    });

    it('should use the statusCode from the error when provided', () => {
      const err: ApiError = new Error('Not Found');
      err.statusCode = 404;

      errorHandler(err, mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should handle 400 Bad Request', () => {
      const err: ApiError = new Error('Bad Request');
      err.statusCode = 400;

      errorHandler(err, mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(statusMock).toHaveBeenCalledWith(400);
      const jsonCall = (statusMock as jest.Mock).mock.results[0].value.json;
      expect(jsonCall).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ status: 400, message: 'Bad Request' }),
        })
      );
    });

    it('should handle 401 Unauthorized', () => {
      const err: ApiError = new Error('Unauthorized');
      err.statusCode = 401;

      errorHandler(err, mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should handle 403 Forbidden', () => {
      const err: ApiError = new Error('Forbidden');
      err.statusCode = 403;

      errorHandler(err, mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should use default message when err.message is empty', () => {
      const err: ApiError = new Error('');
      err.statusCode = 500;

      errorHandler(err, mockReq as Request, mockRes as Response, mockNext as NextFunction);

      const jsonCall = (statusMock as jest.Mock).mock.results[0].value.json;
      expect(jsonCall).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: 'Internal Server Error' }),
        })
      );
    });

    it('should include timestamp and path in the response', () => {
      const err: ApiError = new Error('Error');

      errorHandler(err, mockReq as Request, mockRes as Response, mockNext as NextFunction);

      const jsonCall = (statusMock as jest.Mock).mock.results[0].value.json;
      const callArg = jsonCall.mock.calls[0][0] as any;
      expect(callArg.error.timestamp).toBeDefined();
      expect(callArg.error.path).toBe('/api/v1/users/test');
    });

    it('should include path from req.url', () => {
      mockReq.url = '/api/v1/users/profile';
      const err: ApiError = new Error('Error');

      errorHandler(err, mockReq as Request, mockRes as Response, mockNext as NextFunction);

      const jsonCall = (statusMock as jest.Mock).mock.results[0].value.json;
      const callArg = jsonCall.mock.calls[0][0] as any;
      expect(callArg.error.path).toBe('/api/v1/users/profile');
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 with route not found message', () => {
      mockReq.originalUrl = '/api/v1/unknown';

      notFoundHandler(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      const jsonCall = (statusMock as jest.Mock).mock.results[0].value.json;
      expect(jsonCall).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Route /api/v1/unknown not found',
            status: 404,
          }),
        })
      );
    });

    it('should include timestamp and path for 404', () => {
      mockReq.originalUrl = '/api/v1/missing';

      notFoundHandler(mockReq as Request, mockRes as Response);

      const jsonCall = (statusMock as jest.Mock).mock.results[0].value.json;
      const callArg = jsonCall.mock.calls[0][0] as any;
      expect(callArg.error.timestamp).toBeDefined();
      expect(callArg.error.path).toBe('/api/v1/missing');
    });
  });
});
