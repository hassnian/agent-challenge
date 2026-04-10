import type { IAgentRuntime, Memory } from "@elizaos/core";

const RESEARCH_RUNS_TABLE = "research_runs";

export type ResearchRunPhase =
  | "queued"
  | "searching"
  | "challenging"
  | "synthesizing"
  | "done"
  | "failed";

export type ResearchRunStatus = "queued" | "running" | "completed" | "failed";

export type ResearchRunRecord = {
  taskId: string | null;
  question: string;
  status: ResearchRunStatus;
  phase: ResearchRunPhase;
  text: string;
  topicCount: number;
  evidenceCount: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
};

type RunMemoryMetadata = {
  run?: ResearchRunRecord;
};

const getRunFromMemory = (memory: Memory): ResearchRunRecord | null => {
  const metadata = memory.content.metadata as RunMemoryMetadata | undefined;
  return metadata?.run ?? null;
};

export const getLatestResearchRun = async (
  runtime: IAgentRuntime,
  roomId: Memory["roomId"]
): Promise<ResearchRunRecord | null> => {
  const runs = await runtime.getMemories({
    roomId,
    tableName: RESEARCH_RUNS_TABLE,
    count: 1,
  });

  const latest = runs.at(0);
  return latest ? getRunFromMemory(latest) : null;
};

export const saveResearchRunRecord = async (
  runtime: IAgentRuntime,
  context: {
    roomId: Memory["roomId"];
    worldId: Memory["worldId"];
  },
  run: ResearchRunRecord
): Promise<void> => {
  await runtime.createMemory(
    {
      agentId: runtime.agentId,
      entityId: runtime.agentId,
      roomId: context.roomId,
      worldId: context.worldId,
      content: {
        text: run.text,
        metadata: {
          run,
        },
      },
    },
    RESEARCH_RUNS_TABLE
  );
};
