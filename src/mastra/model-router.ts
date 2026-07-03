/**
 * Maps a resolved provider + profile subtlety to a concrete model the Mastra
 * Agent can use: a Model Router "provider/model" string for real providers, or
 * the deterministic mock model instance.
 */
import type { Provider } from "@/classroom/schemas";
import type { RealProvider } from "@/classroom/roster";
import { modelString } from "./config";
import { createMockModel, type MockLanguageModel } from "./mock/mock-model";

/** Either a Model Router magic string or a mock model instance. */
export type ResolvedModel = string | MockLanguageModel;

let sharedMock: MockLanguageModel | undefined;

export function resolveModel(provider: Provider, subtle: boolean): ResolvedModel {
  if (provider === "mock") {
    sharedMock ??= createMockModel();
    return sharedMock;
  }
  return modelString(provider as RealProvider, subtle);
}

export function isMockProvider(provider: Provider): boolean {
  return provider === "mock";
}
