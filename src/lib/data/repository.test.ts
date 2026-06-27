import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRepository } from "./repository";
import { LocalStorageTaskRepository } from "./LocalStorageTaskRepository";
import { SupabaseTaskRepository } from "./SupabaseTaskRepository";

/**
 * Backend selection: the app uses Supabase when its env vars are present and
 * falls back to localStorage otherwise, so local dev and the test suite run
 * with no backend. (See docs/specs/supabase-backend.md — env-based selection.)
 */

const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const ANON_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

let savedUrl: string | undefined;
let savedAnon: string | undefined;

beforeEach(() => {
  savedUrl = process.env[URL_KEY];
  savedAnon = process.env[ANON_KEY];
  delete process.env[URL_KEY];
  delete process.env[ANON_KEY];
});

afterEach(() => {
  if (savedUrl === undefined) delete process.env[URL_KEY];
  else process.env[URL_KEY] = savedUrl;
  if (savedAnon === undefined) delete process.env[ANON_KEY];
  else process.env[ANON_KEY] = savedAnon;
});

describe("createRepository — backend selection", () => {
  it("uses Supabase when both env vars are present", () => {
    process.env[URL_KEY] = "https://example.supabase.co";
    process.env[ANON_KEY] = "anon-key";
    expect(createRepository()).toBeInstanceOf(SupabaseTaskRepository);
  });

  it("falls back to localStorage when the env vars are absent", () => {
    expect(createRepository()).toBeInstanceOf(LocalStorageTaskRepository);
  });

  it("falls back to localStorage when only one env var is present", () => {
    process.env[URL_KEY] = "https://example.supabase.co";
    expect(createRepository()).toBeInstanceOf(LocalStorageTaskRepository);
  });
});
