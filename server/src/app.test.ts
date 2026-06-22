import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from './app';

const mockModelResponse = [
  {
    modelId: 'sample/agent-model',
    author: 'sample-author',
    tags: ['agent', 'assistant'],
    pipeline_tag: 'text-generation',
    downloads: 1000,
    cardData: {}
  }
];

describe('Omnigent API Endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 200 OK for /health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'OK',
      service: 'Omnigent Server'
    });
  });

  it('should list Hugging Face models for a query', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockModelResponse
    }));

    const res = await request(app).get('/api/agents/huggingface?q=agent');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.models)).toBe(true);
    expect(res.body.models[0]).toMatchObject({ id: 'sample/agent-model' });
  });

  it('should return 400 when downloading without modelId', async () => {
    const res = await request(app)
      .post('/api/agents/huggingface/download')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'modelId is required' });
  });

  it('should attempt to download a Hugging Face model manifest', async () => {
    const fetchMock = vi.fn()
      // first call: model metadata
      .mockResolvedValueOnce({ ok: true, json: async () => ({ modelId: 'sample/agent-model', author: 'sample-author', tags: ['agent'], pipeline_tag: 'text-generation', downloads: 1000, cardData: { title: 'Sample Agent' } }) })
      // second call: README.md
      .mockResolvedValueOnce({ ok: true, text: async () => '# Sample Agent' })
      // third call: config.json
      .mockResolvedValueOnce({ ok: false });

    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/api/agents/huggingface/download')
      .send({ modelId: 'sample/agent-model' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.result).toHaveProperty('modelId', 'sample/agent-model');
    expect(res.body.result.files).toContain('manifest.json');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('should not expose x-powered-by and should set secure helmet headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
  });

  it('should include CORS header for an allowed origin', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('should reject over-sized JSON payloads', async () => {
    const largeString = 'x'.repeat(11000);
    const res = await request(app)
      .post('/api/users/export')
      .send({ id: 'usr_101', payload: largeString });

    expect([413, 431]).toContain(res.status);
  });

  it('should return 500 when Hugging Face list API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));
    const res = await request(app).get('/api/agents/huggingface?q=agent');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to list Hugging Face models');
  });

  it('should return 500 when Hugging Face download fails due to missing model metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    const res = await request(app)
      .post('/api/agents/huggingface/download')
      .send({ modelId: 'missing/model' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to download Hugging Face model');
  });
});
