import nock from 'nock';
import { TestrailClient } from '../src/testrail-client';

const HOST = 'https://test.testrail.io';
const BASE = '/index.php?/api/v2';

function makeClient() {
  return new TestrailClient(HOST, 'user@example.com', 'api-key-123');
}

afterEach(() => nock.cleanAll());

describe('TestrailClient', () => {
  describe('createRun', () => {
    it('posts correct payload and returns run data', async () => {
      nock(HOST)
        .post(`${BASE}/add_run/10`, (body) => body.name === 'My Run')
        .reply(200, { id: 99, name: 'My Run', url: `${HOST}/runs/view/99` });

      const client = makeClient();
      const run = await client.createRun(10, 'My Run');
      expect(run.id).toBe(99);
    });

    it('includes suite_id when provided', async () => {
      nock(HOST)
        .post(`${BASE}/add_run/10`, (body) => body.suite_id === 5)
        .reply(200, { id: 1, name: 'run', url: '' });

      const client = makeClient();
      await client.createRun(10, 'run', { suiteId: 5 });
    });
  });

  describe('addResult', () => {
    it('maps statusId to status_id', async () => {
      nock(HOST)
        .post(`${BASE}/add_result_for_case/99/1001`, (body) => body.status_id === 1)
        .reply(200, { id: 200, test_id: 1001, status_id: 1, comment: 'ok' });

      const client = makeClient();
      const result = await client.addResult(99, 1001, { statusId: 1, comment: 'ok' });
      expect(result.id).toBe(200);
    });
  });

  describe('error handling', () => {
    it('throws a human-readable error on 401', async () => {
      nock(HOST)
        .post(`${BASE}/add_run/10`)
        .reply(401, { error: 'Authentication failed' });

      const client = makeClient();
      await expect(client.createRun(10, 'run')).rejects.toThrow('Authentication failed');
    });

    it('throws on network error', async () => {
      nock(HOST)
        .post(`${BASE}/add_run/10`)
        .replyWithError('ECONNREFUSED');

      const client = makeClient();
      await expect(client.createRun(10, 'run')).rejects.toThrow();
    });
  });
});
