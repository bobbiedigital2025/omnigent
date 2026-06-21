import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './app';

describe('Omnigent API Endpoints', () => {
  it('should return 200 OK for /health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'OK',
      service: 'Omnigent Server'
    });
  });
});
