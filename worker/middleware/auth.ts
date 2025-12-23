import { verifyFirebaseAuth, getFirebaseToken } from '@hono/firebase-auth';
import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../../worker-configuration';

type Variables = {
  db: any;
  currencyService: any;
};

// Hash function to create short cache keys
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = (c, next) => {
  const firebaseProjectId = c.env.FIREBASE_PROJECT_ID;
  const kvNamespace = c.env.PUBLIC_JWK_CACHE_KV;
  const cacheKey = c.env.PUBLIC_JWK_CACHE_KEY;
  
  // Создаем wrapper для KV чтобы работать с @hono/firebase-auth
  const keyStore = {
    get: async (key: string) => {
      const hashedKey = await hashKey(key);
      return await kvNamespace.get(`${cacheKey}:${hashedKey}`);
    },
    put: async (key: string, value: string) => {
      const hashedKey = await hashKey(key);
      await kvNamespace.put(`${cacheKey}:${hashedKey}`, value);
    },
  };
  
  return verifyFirebaseAuth({
    projectId: firebaseProjectId,
    keyStore: keyStore as any,
  })(c, next);
};

// Optional auth middleware (doesn't throw if no token)
export const optionalAuthMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  try {
    await authMiddleware(c, next);
  } catch (error) {
    // Continue without auth
    await next();
  }
};

// Get user ID from context
export function getUserId(c: Context): string {
  // Use the official getFirebaseToken helper from @hono/firebase-auth
  const idToken = getFirebaseToken(c);
  
  if (!idToken?.uid) {
    throw new Error('Unauthorized');
  }
  return idToken.uid;
}
