import type { IAgentRuntime, Memory } from "@elizaos/core";
import { createResearchPlan, type ResearchPlanData } from "./plan";

const RESEARCH_PLANS_TABLE = "research_plans";

type PlanMemoryMetadata = {
  plan?: ResearchPlanData;
};

const getPlanFromMemory = (memory: Memory): ResearchPlanData | null => {
  const metadata = memory.content.metadata as PlanMemoryMetadata | undefined;
  return metadata?.plan ?? null;
};

export const getLatestResearchPlan = async (
  runtime: IAgentRuntime,
  roomId: Memory["roomId"]
): Promise<ResearchPlanData | null> => {
  const plans = await runtime.getMemories({
    roomId,
    tableName: RESEARCH_PLANS_TABLE,
    count: 1,
  });

  const latest = plans.at(0);
  return latest ? getPlanFromMemory(latest) : null;
};

export const saveResearchPlan = async (
  runtime: IAgentRuntime,
  message: Memory,
  plan: ResearchPlanData
): Promise<void> => {
  const rendered = createResearchPlan(plan);

  await runtime.createMemory(
    {
      agentId: runtime.agentId,
      entityId: runtime.agentId,
      roomId: message.roomId,
      worldId: message.worldId,
      content: {
        text: rendered.markdown,
        metadata: {
          plan,
        },
      },
    },
    RESEARCH_PLANS_TABLE
  );
};
