import type { IAgentRuntime, Plugin } from "@elizaos/core";
import { approveResearchPlanAction } from "./actions/approve-research-plan";
import { createResearchPlanAction } from "./actions/create-research-plan";
import { exportResearchSessionAction } from "./actions/export-research-session";
import { followUpResearchSessionAction } from "./actions/follow-up-research-session";
import { getResearchSessionAction } from "./actions/get-research-session";
import { getResearchSessionStatusAction } from "./actions/get-research-session-status";
import { listResearchSessionsAction } from "./actions/list-research-sessions";
import { runResearchSessionAction } from "./actions/run-research-session";
import { updateResearchPlanAction } from "./actions/update-research-plan";
import { researchSessionTaskWorker } from "./workers/research-session-worker";

export const researchRoomPlugin: Plugin = {
  name: "research-room",
  description: "Research-room plugin.",
  actions: [
    createResearchPlanAction,
    updateResearchPlanAction,
    approveResearchPlanAction,
    runResearchSessionAction,
    getResearchSessionStatusAction,
    listResearchSessionsAction,
    getResearchSessionAction,
    followUpResearchSessionAction,
    exportResearchSessionAction,
  ],
  providers: [],
  evaluators: [],
  init: async (_config: Record<string, string>, runtime: IAgentRuntime) => {
    runtime.registerTaskWorker(researchSessionTaskWorker);
  },
};

export default researchRoomPlugin;
