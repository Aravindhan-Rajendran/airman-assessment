const memory = new Map<string, { value: string; expiresAt: number }>();

export const cacheService = {
  async get(key: string): Promise<string | null> {
    const entry = memory.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      memory.delete(key);
      return null;
    }
    return entry.value;
  },

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    memory.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  async del(key: string): Promise<void> {
    memory.delete(key);
  },
};
