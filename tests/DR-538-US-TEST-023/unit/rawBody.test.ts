/**
 * rawBody.test.ts — DR-538-US-TEST-023
 *
 * Unit tests for rawBodyMiddleware.
 * Uses a mock EventEmitter request to simulate data/end events without supertest.
 */

import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';
import { rawBodyMiddleware } from '../../../../dreamscape-services/payment/src/middleware/rawBody';

function makeReq(url: string): Request & { rawBody?: string } {
  const req = new EventEmitter() as any;
  req.originalUrl = url;
  req.setEncoding = jest.fn();
  return req;
}

describe('rawBodyMiddleware', () => {
  it('captures raw body chunks and calls next on end for /webhook URL', () => {
    const req = makeReq('/api/v1/payment/webhook');
    const next: NextFunction = jest.fn();

    rawBodyMiddleware(req, {} as Response, next);

    req.emit('data', 'chunk-one');
    req.emit('data', '-chunk-two');
    req.emit('end');

    expect(req.setEncoding).toHaveBeenCalledWith('utf8');
    expect(req.rawBody).toBe('chunk-one-chunk-two');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next immediately for non-webhook URLs', () => {
    const req = makeReq('/api/v1/payment/create-intent');
    const next: NextFunction = jest.fn();

    rawBodyMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.setEncoding).not.toHaveBeenCalled();
    expect(req.rawBody).toBeUndefined();
  });

  it('sets empty string rawBody when no data chunks arrive', () => {
    const req = makeReq('/api/v1/payment/webhook');
    const next: NextFunction = jest.fn();

    rawBodyMiddleware(req, {} as Response, next);
    req.emit('end');

    expect(req.rawBody).toBe('');
    expect(next).toHaveBeenCalled();
  });
});
