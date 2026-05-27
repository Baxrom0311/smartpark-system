/**
 * Tests for the kindergartens API service used by the teacher flow.
 *
 * `fetch` is stubbed so we can run on Node without a backend, and
 * the secure-store + AsyncStorage adapters are mocked the same way
 * the other service tests do it.
 */

jest.mock("expo-secure-store", () => {
  const memory = new Map<string, string>();
  return {
    WHEN_UNLOCKED: "afterFirstUnlockThisDeviceOnly",
    setItemAsync: jest.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => memory.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      memory.delete(key);
    }),
  };
});

jest.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>();
  return {
    setItem: jest.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
    getItem: jest.fn(async (key: string) => memory.get(key) ?? null),
    removeItem: jest.fn(async (key: string) => {
      memory.delete(key);
    }),
  };
});

import { writeTokens, clearTokens } from "@/services/token-storage";
import {
  getKindergarten,
  getKindergartenStats,
  listAllKindergartens,
  listKindergartens,
} from "@/services/kindergartens";
import type { Kindergarten, KindergartenStats } from "@/types";

interface FetchCall {
  url: string;
  init: RequestInit;
}

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeKindergarten(id: string): Kindergarten {
  return {
    id,
    name: `KG ${id}`,
    address: "Test address",
    phone: null,
    teacher_count: 5,
    child_count: 30,
    region_id: "r-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function fakeStats(id: string): KindergartenStats {
  return {
    kindergarten_id: id,
    name: `KG ${id}`,
    total_children: 30,
    risk_green: 20,
    risk_yellow: 7,
    risk_red: 3,
    assessed_children: 30,
  };
}

describe("services/kindergartens", () => {
  let calls: FetchCall[] = [];

  beforeEach(async () => {
    calls = [];
    await clearTokens();
    await writeTokens({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresIn: 900,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("listKindergartens forwards pagination and search params", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockImplementation(async (url, init) => {
        calls.push({ url: String(url), init: (init ?? {}) as RequestInit });
        return makeJsonResponse({
          items: [],
          next_cursor: null,
          has_more: false,
        });
      });

    await listKindergartens({ limit: 10, search: "tashkent" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const sent = calls[0];
    expect(sent).toBeDefined();
    if (!sent) throw new Error("no fetch call");
    expect(sent.url).toContain("/kindergartens?");
    expect(sent.url).toContain("limit=10");
    expect(sent.url).toContain("search=tashkent");
    expect(sent.init.method ?? "GET").toBe("GET");
  });

  it("listAllKindergartens walks the cursor until has_more=false", async () => {
    const sequences = [
      makeJsonResponse({
        items: [fakeKindergarten("a"), fakeKindergarten("b")],
        next_cursor: "cursor-1",
        has_more: true,
      }),
      makeJsonResponse({
        items: [fakeKindergarten("c")],
        next_cursor: null,
        has_more: false,
      }),
    ];
    jest.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      calls.push({ url: String(url), init: (init ?? {}) as RequestInit });
      return sequences.shift() as Response;
    });

    const items = await listAllKindergartens();
    expect(items.map((k) => k.id)).toEqual(["a", "b", "c"]);
    expect(calls).toHaveLength(2);
    const second = calls[1];
    expect(second).toBeDefined();
    if (!second) throw new Error("no second call");
    expect(second.url).toContain("cursor=cursor-1");
  });

  it("getKindergarten hits the singular endpoint", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      calls.push({ url: String(url), init: (init ?? {}) as RequestInit });
      return makeJsonResponse(fakeKindergarten("kg-1"));
    });

    const kg = await getKindergarten("kg-1");
    expect(kg.id).toBe("kg-1");
    const sent = calls[0];
    expect(sent).toBeDefined();
    if (!sent) throw new Error("no fetch call");
    expect(sent.url).toContain("/kindergartens/kg-1");
  });

  it("getKindergartenStats hits the /stats sub-resource", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      calls.push({ url: String(url), init: (init ?? {}) as RequestInit });
      return makeJsonResponse(fakeStats("kg-1"));
    });

    const stats = await getKindergartenStats("kg-1");
    expect(stats.risk_red).toBe(3);
    const sent = calls[0];
    expect(sent).toBeDefined();
    if (!sent) throw new Error("no fetch call");
    expect(sent.url).toContain("/kindergartens/kg-1/stats");
  });
});
