import type { IAgentRuntime, Memory, Task } from "@elizaos/core";
import type { ResearchPlanData } from "./plan";

const TASK_STATUS_PENDING = 1;
const TASK_STATUS_IN_PROGRESS = 2;

export const RESEARCH_SESSION_TASK_NAME = "RUN_RESEARCH_SESSION_WORKER";

export const RESEARCH_SESSION_TASK_TAGS = ["queue", "research-session"];

const isTaskActive = (task: Task): boolean => {
  return task.status === TASK_STATUS_PENDING || task.status === TASK_STATUS_IN_PROGRESS;
};

export const getActiveResearchTask = async (
  runtime: IAgentRuntime,
  roomId: Memory["roomId"]
): Promise<Task | null> => {
  const tasks = await runtime.getTasks({
    roomId,
    tags: RESEARCH_SESSION_TASK_TAGS,
    agentIds: [runtime.agentId],
  });

  return tasks.find(isTaskActive) ?? null;
};

export const queueResearchSessionTask = async (
  runtime: IAgentRuntime,
  params: {
    roomId: Memory["roomId"];
    worldId: Memory["worldId"];
    entityId: Memory["entityId"];
    question: string;
    plan: ResearchPlanData;
  }
): Promise<{ taskId: string; alreadyQueued: boolean }> => {
  const existingTask = await getActiveResearchTask(runtime, params.roomId);
  if (existingTask?.id) {
    return {
      taskId: existingTask.id,
      alreadyQueued: true,
    };
  }

  const taskId = await runtime.createTask({
    name: RESEARCH_SESSION_TASK_NAME,
    description: `Research session for: ${params.question}`,
    roomId: params.roomId,
    worldId: params.worldId,
    entityId: params.entityId,
    tags: RESEARCH_SESSION_TASK_TAGS,
    metadata: {
      question: params.question,
      plan: params.plan,
      userId: params.entityId,
      status: "queued",
      phase: "queued",
      topicCount: params.plan.topics.length,
      evidenceCount: 0,
      queuedAt: Date.now(),
    },
    status: TASK_STATUS_PENDING,
  });

  return {
    taskId,
    alreadyQueued: false,
  };
};
