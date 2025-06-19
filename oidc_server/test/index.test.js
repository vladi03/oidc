const request = require('supertest');
const assert = require('assert');

process.env.OIDC_ISSUER = 'http://example.com';
process.env.FIREBASE_API_KEY = 'test';

const { oidc } = require('..');

describe('OIDC Cloud Function', function() {
  it('responds with discovery document', function(done) {
    request(oidc)
      .get('/.well-known/openid-configuration')
      .expect(200)
      .expect(res => {
        assert.strictEqual(res.body.issuer, 'http://example.com');
      })
      .end(done);
  });
});
