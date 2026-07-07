/**
 * FactCheckReport — the fact-checker-agent's verdict over a deliverable. A wrong
 * answer key is BLOCKING. Pure Zod contract (v4).
 */
import { z } from "zod";

export const FactCheckClaimSchema = z.object({
  claim: z.string().describe("The verified claim, quoted."),
  verdict: z.enum(["correct", "dubious", "incorrect"]),
  explanation: z.string(),
  suggested_correction: z.string().optional(),
  source_location: z
    .string()
    .describe("Where in the deliverable (lesson / assessment item / exercise answer key)."),
});
export type FactCheckClaim = z.infer<typeof FactCheckClaimSchema>;

export const FactCheckReportSchema = z.object({
  target: z
    .enum(["lesson", "evaluations", "exercises", "sheet"])
    .describe("Which deliverable was verified."),
  claims: z.array(FactCheckClaimSchema),
  blocking: z
    .boolean()
    .describe("true if at least one 'incorrect' claim remains (a wrong answer key = blocking)."),
  summary: z.string(),
});
export type FactCheckReport = z.infer<typeof FactCheckReportSchema>;
