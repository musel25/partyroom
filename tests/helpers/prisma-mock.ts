import { vi } from "vitest";

/**
 * Stubs out @/lib/db so tests don't touch a real database. Every
 * method defaults to resolving with undefined so `.catch(() => {})`
 * chains in app code don't crash on `undefined.catch`.
 */
export function mockPrisma() {
  const ok = () => vi.fn().mockResolvedValue(undefined);

  const db = {
    room: {
      create: ok(),
      findUnique: ok(),
      update: ok(),
      updateMany: ok(),
    },
    queueItem: {
      create: ok(),
      delete: ok(),
    },
    message: {
      create: ok(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: ok(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    roomParticipant: {
      create: ok(),
      findFirst: ok(),
      update: ok(),
      updateMany: ok(),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: ok(),
    },
    friendship: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: ok(),
      upsert: ok(),
      update: ok(),
      delete: ok(),
    },
    playHistory: {
      create: ok(),
      findFirst: ok(),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  vi.doMock("@/lib/db", () => ({ db }));
  return db;
}
