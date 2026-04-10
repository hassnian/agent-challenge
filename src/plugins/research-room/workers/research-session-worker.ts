import type { IAgentRuntime, Task, TaskWorker } from "@elizaos/core";
import { logger } from "@elizaos/core";
import { type ResearchPlanData } from "../lib/plan";
import { executeResearchSession } from "../lib/research-executor";
import {
  saveResearchRunRecord,
  type ResearchRunPhase,
  type ResearchRunStatus,
} from "../lib/research-run-store";
import { saveResearchState } from "../lib/research-state-store";
import { RESEARCH_SESSION_TASK_NAME } from "../lib/research-task";

const TASK_STATUS_PENDING = 1;
const TASK_STATUS_IN_PROGRESS = 2;
const TASK_STATUS_COMPLETED = 3;
const TASK_STATUS_FAILED = 4;

type ResearchTaskMetadata = {
  question?: string;
  plan?: ResearchPlanData;
  phase?: ResearchRunPhase;
  status?: ResearchRunStatus;
  evidenceCount?: number;
  topicCount?: number;
  queuedAt?: number;
  updatedAt?: number;
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
    error?: string;
  }
): Promise<void> => {
  const timestamp = Date.now();
  const taskCreatedAt =
    typeof task.metadata?.queuedAt === "number" ? task.metadata.queuedAt : timestamp;

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

    await saveRunState(runtime, task, plan, {
      question,
      status: "running",
      phase: "searching",
      text: "Research task started.",
      evidenceCount: 0,
      topicCount: plan.topics.length,
    });

    try {
      const session = await executeResearchSession({
        runtime,
        roomId: task.roomId ?? runtime.agentId,
        worldId: task.worldId ?? runtime.agentId,
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
          });
        },
      });

      await saveRunState(runtime, task, plan, {
        question,
        status: "completed",
        phase: "done",
        text: "Research task completed and the session was saved.",
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
