import type { IAgentRuntime, Task, TaskWorker } from "@elizaos/core";
import { logger } from "@elizaos/core";
import { type ResearchPlanData } from "../lib/plan";
import { getLatestResearchRun, saveResearchRunRecord } from "../lib/research-run-store";
import { executeResearchSession } from "../lib/research-executor";
import {
  type ResearchRunPhase,
  type ResearchRunStatus,
} from "../lib/research-run-store";
import { saveResearchState } from "../lib/research-state-store";
import { isFallbackOnlyResearchSessionData } from "../lib/session";
import { RESEARCH_SESSION_TASK_NAME } from "../lib/research-task";

const TASK_STATUS_PENDING = 1;
const TASK_STATUS_IN_PROGRESS = 2;
const TASK_STATUS_COMPLETED = 3;
const TASK_STATUS_FAILED = 4;
const EXECUTION_GUARD_WINDOW_MS = 30 * 60 * 1000;

type ResearchTaskMetadata = {
  question?: string;
  plan?: ResearchPlanData;
  phase?: ResearchRunPhase;
  status?: ResearchRunStatus;
  evidenceCount?: number;
  topicCount?: number;
  currentTopicIndex?: number;
  completedTopicCount?: number;
  queuedAt?: number;
  updatedAt?: number;
};

const toTimestamp = (value: number | bigint | undefined): number | null => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  return null;
};

const isFreshTimestamp = (value: number | null, now: number): boolean => {
  return value !== null && now - value < EXECUTION_GUARD_WINDOW_MS;
};

const saveRunState = async (
  runtime: IAgentRuntime,
  task: Task,
  plan: ResearchPlanData | null,
  state: {
    question: string;
    status: ResearchRunStatus;
    phase: ResearchRunPhase;
    text: string;
    evidenceCount: number;
    topicCount: number;
    currentTopicIndex?: number;
    completedTopicCount?: number;
    error?: string;
  }
): Promise<void> => {
  const timestamp = Date.now();
  const taskCreatedAt =
    typeof task.metadata?.queuedAt === "number" ? task.metadata.queuedAt : timestamp;
  const currentTopicIndex = state.currentTopicIndex ?? 0;
  const completedTopicCount = state.completedTopicCount ?? 0;

  if (task.id) {
    await runtime.updateTask(task.id, {
      status:
        state.status === "queued"
          ? TASK_STATUS_PENDING
          : state.status === "running"
          ? TASK_STATUS_IN_PROGRESS
          : state.status === "completed"
          ? TASK_STATUS_COMPLETED
          : TASK_STATUS_FAILED,
      metadata: {
        ...task.metadata,
        phase: state.phase,
        status: state.status,
        evidenceCount: state.evidenceCount,
        topicCount: state.topicCount,
        currentTopicIndex,
        completedTopicCount,
        updatedAt: timestamp,
        error: state.error,
        },
    });
  }

  if (state.status === "completed" || state.status === "failed") {
    await saveResearchRunRecord(
      runtime,
      {
        roomId: task.roomId ?? runtime.agentId,
        worldId: task.worldId ?? runtime.agentId,
      },
      {
        taskId: task.id ?? null,
        question: state.question,
        status: state.status,
        phase: state.phase,
        text: state.text,
        topicCount: state.topicCount,
        evidenceCount: state.evidenceCount,
        currentTopicIndex,
        completedTopicCount,
        createdAt: taskCreatedAt,
        updatedAt: timestamp,
        error: state.error,
      }
    );
  }

  const room = task.roomId ? await runtime.getRoom(task.roomId) : null;
  await saveResearchState(
    runtime,
    {
      roomId: task.roomId ?? runtime.agentId,
      worldId: task.worldId ?? runtime.agentId,
      channelId: room?.channelId ?? task.roomId ?? runtime.agentId,
      userId:
        typeof task.entityId === "string"
          ? task.entityId
          : typeof task.metadata?.userId === "string"
            ? task.metadata.userId
            : null,
    },
    {
      question: state.question,
      phase:
        state.status === "completed"
          ? "synthesizing"
          : state.phase === "challenging"
            ? "critiquing"
            : state.phase === "synthesizing"
              ? "synthesizing"
              : "researching",
      plan,
      run: {
        taskId: task.id ?? null,
        question: state.question,
        status: state.status,
        phase: state.phase,
        text: state.text,
        topicCount: state.topicCount,
        evidenceCount: state.evidenceCount,
        currentTopicIndex,
        completedTopicCount,
        createdAt: taskCreatedAt,
        updatedAt: timestamp,
        error: state.error,
      },
      progressEntry:
        state.status === "completed"
          ? {
              role: "synthesizer",
              message: "Research completed and final memo saved.",
              timestamp,
            }
          : state.status === "failed"
            ? {
                role: "synthesizer",
                message: state.text,
                timestamp,
              }
            : {
                role:
                  state.phase === "challenging"
                    ? "skeptic"
                    : state.phase === "synthesizing"
                      ? "synthesizer"
                      : "searcher",
                message: state.text,
                timestamp,
              },
    }
  );
};

export const researchSessionTaskWorker: TaskWorker = {
  name: RESEARCH_SESSION_TASK_NAME,
  execute: async (runtime: IAgentRuntime, options, task: Task) => {
    const metadata = options as ResearchTaskMetadata;
    const roomId = task.roomId ?? runtime.agentId;
    const worldId = task.worldId ?? runtime.agentId;
    const taskId = task.id ?? null;
    const question =
      typeof metadata.question === "string" && metadata.question.trim().length > 0
        ? metadata.question.trim()
        : "What should I research next?";
    const plan = metadata.plan;

    if (!plan) {
      await saveRunState(runtime, task, plan ?? null, {
        question,
        status: "failed",
        phase: "failed",
        text: "Research task failed because no approved plan snapshot was attached.",
        evidenceCount: 0,
        topicCount: 0,
        error: "MISSING_PLAN",
      });
      throw new Error("Research task is missing plan metadata");
    }

    const now = Date.now();
    const currentTask = taskId ? await runtime.getTask(taskId) : task;
    const currentMetadata = currentTask?.metadata as ResearchTaskMetadata | undefined;
    const currentTaskUpdatedAt = toTimestamp(currentTask?.updatedAt);
    const latestRun = await getLatestResearchRun(runtime, roomId);

    if (currentTask?.status === TASK_STATUS_COMPLETED || currentTask?.status === TASK_STATUS_FAILED) {
      logger.warn(
        {
          taskId,
          question,
          taskStatus: currentTask.status,
        },
        "Skipping research task execution because the task is already terminal"
      );
      return undefined;
    }

    if (
      taskId &&
      latestRun?.taskId === taskId &&
      (latestRun.status === "completed" || latestRun.status === "failed")
    ) {
      logger.warn(
        {
          taskId,
          question,
          runStatus: latestRun.status,
        },
        "Skipping duplicate research task execution because the latest run is already terminal"
      );
      return undefined;
    }

    if (
      taskId &&
      latestRun?.taskId === taskId &&
      latestRun.status === "running" &&
      isFreshTimestamp(latestRun.updatedAt, now)
    ) {
      logger.warn(
        {
          taskId,
          question,
          runStatus: latestRun.status,
          runUpdatedAt: latestRun.updatedAt,
        },
        "Skipping duplicate research task execution because the same task is already running"
      );
      return undefined;
    }

    if (
      typeof currentMetadata?.status === "string" &&
      currentMetadata.status === "running" &&
      isFreshTimestamp(currentTaskUpdatedAt, now)
    ) {
      logger.warn(
        {
          taskId,
          question,
          taskStatus: currentMetadata.status,
          taskUpdatedAt: currentTaskUpdatedAt,
        },
        "Skipping duplicate research task execution because task metadata shows a fresh running execution"
      );
      return undefined;
    }

    await saveRunState(runtime, task, plan, {
      question,
      status: "running",
      phase: "searching",
      text: "Research task started.",
      evidenceCount: 0,
      topicCount: plan.topics.length,
      currentTopicIndex: 0,
      completedTopicCount: 0,
    });
    await saveResearchRunRecord(
      runtime,
      {
        roomId,
        worldId,
      },
      {
        taskId,
        question,
        status: "running",
        phase: "searching",
        text: "Research task started.",
        topicCount: plan.topics.length,
        evidenceCount: 0,
        currentTopicIndex: 0,
        completedTopicCount: 0,
        createdAt: now,
        updatedAt: now,
      }
    );

    try {
      const session = await executeResearchSession({
        runtime,
        roomId,
        worldId,
        question,
        plan,
        onProgress: async (progress) => {
          if (progress.phase === "done") {
            return;
          }

          await saveRunState(runtime, task, plan, {
            question,
            status: "running",
            phase: progress.phase,
            text: progress.text,
            evidenceCount: progress.evidenceCount,
            topicCount: progress.topicCount,
            currentTopicIndex: progress.currentTopicIndex,
            completedTopicCount: progress.completedTopicCount,
          });
        },
      });
      const degraded = isFallbackOnlyResearchSessionData(session.data);

      await saveRunState(runtime, task, plan, {
        question,
        status: "completed",
        phase: "done",
        text: degraded
          ? "Research task completed with fallback-only output; no usable live evidence was captured."
          : "Research task completed and the session was saved.",
        evidenceCount: session.data.evidence.length,
        topicCount: session.data.topicResults.length,
      });
      const room = task.roomId ? await runtime.getRoom(task.roomId) : null;
      await saveResearchState(
        runtime,
        {
          roomId: task.roomId ?? runtime.agentId,
          worldId: task.worldId ?? runtime.agentId,
          channelId: room?.channelId ?? task.roomId ?? runtime.agentId,
          userId:
            typeof task.entityId === "string"
              ? task.entityId
              : typeof task.metadata?.userId === "string"
                ? task.metadata.userId
                : null,
        },
        {
          question,
          phase: "complete",
          plan,
          session: session.data,
        }
      );
    } catch (error) {
      await saveRunState(runtime, task, plan, {
        question,
        status: "failed",
        phase: "failed",
        text: "Research task failed before the final memo could be completed.",
        evidenceCount: 0,
        topicCount: plan.topics.length,
        error: error instanceof Error ? error.message : String(error),
      });

      logger.error(
        {
          taskId: task.id,
          question,
          error: error instanceof Error ? error.message : String(error),
        },
        "Research task worker failed"
      );

      throw error;
    }

    return undefined;
  },
};
