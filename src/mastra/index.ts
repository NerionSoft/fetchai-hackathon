/**
 * The Mastra instance — wires every agent, the loop workflow, and SQLite storage.
 * Server-only. Importing this constructs the LibSQL store and all agents.
 */
import { Mastra } from "@mastra/core/mastra";

import { mastraAgents, runtimeConfig } from "./agents";
import { storage } from "./storage";
import { classroomWorkflow } from "./workflow";

export const mastra = new Mastra({
  agents: mastraAgents,
  workflows: { "classroom-loop": classroomWorkflow },
  storage,
});

export { runtimeConfig };
