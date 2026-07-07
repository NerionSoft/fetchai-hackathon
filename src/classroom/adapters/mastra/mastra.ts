/**
 * The Mastra instance — wires every agent and the (in-memory) storage. Importing
 * this constructs the LibSQL store and registers all agents. Server-only.
 *
 * Orchestration lives in the application use case now (not a Mastra workflow), so
 * this instance carries agents + storage only.
 */
import { Mastra } from "@mastra/core/mastra";

import { mastraAgents, runtimeConfig } from "./agents";
import { storage } from "./storage";

export const mastra = new Mastra({
  agents: mastraAgents,
  storage,
});

export { mastraAgents, runtimeConfig };
