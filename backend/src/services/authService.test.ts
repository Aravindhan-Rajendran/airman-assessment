import { hashPassword, verifyPassword, signAccessToken } from './authService';

describe('authService', () => {
  describe('hashPassword', () => {
    it('returns a hash different from plain password', async () => {
      const password = 'SecurePass123!';
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(32);
    });

    it('produces different hashes for same password (salt)', async () => {
      const password = 'SamePassword';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
      expect(await verifyPassword(hash1, password)).toBe(true);
      expect(await verifyPassword(hash2, password)).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for correct password', async () => {
      const password = 'Test123!';
      const hash = await hashPassword(password);
      expect(await verifyPassword(hash, password)).toBe(true);
    });

    it('returns false for wrong password', async () => {
      const hash = await hashPassword('CorrectPass');
      expect(await verifyPassword(hash, 'WrongPass')).toBe(false);
    });
  });

  describe('signAccessToken', () => {
    it('returns a JWT string with payload', () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'STUDENT' as const,
        tenantId: 'tenant-1',
        approved: true,
      };
      const token = signAccessToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });
});
