import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  type State,
} from "@elizaos/core";
import {
  getLatestResearchPlan,
  saveResearchPlan,
} from "../lib/plan-store";
import { resolveResearchMessageContext } from "../lib/message-context";
import {
  saveResearchState,
  type ResearchStatePhase,
} from "../lib/research-state-store";
import { queueResearchSessionTask } from "../lib/research-task";

export const approveResearchPlanAction: Action = {
  name: "APPROVE_RESEARCH_PLAN",
  similes: ["CONFIRM_RESEARCH_PLAN", "APPROVE_PLAN", "CONFIRM_PLAN"],
  description:
    "Approve the latest research plan in the current room so research can start from an explicit plan.",
  validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const text = message.content.text?.trim().toLowerCase() ?? "";
    return /approve|approved|confirm/.test(text) && /plan/.test(text);
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    const latestPlan = await getLatestResearchPlan(runtime, message.roomId);

    if (!latestPlan) {
      const noPlanText =
        "I could not find a research plan to approve in this session. Create a plan first, then approve it.";

      if (callback) {
        const responseContent: Content = {
          text: noPlanText,
          actions: ["APPROVE_RESEARCH_PLAN"],
          source: message.content.source,
        };

        await callback(responseContent);
      }

      return {
        success: false,
        text: noPlanText,
      };
    }

    const approvedPlan = {
      ...latestPlan,
      approved: true,
    };
    const context = await resolveResearchMessageContext(runtime, message);

    await saveResearchPlan(runtime, message, approvedPlan);
    const queuedTask = await queueResearchSessionTask(runtime, {
      roomId: context.roomId,
      worldId: context.worldId,
      entityId: message.entityId,
      question: approvedPlan.question,
      plan: approvedPlan,
    });
    const statePhase: ResearchStatePhase = queuedTask.alreadyQueued
      ? "researching"
      : "researching";
    await saveResearchState(
      runtime,
      {
        roomId: context.roomId,
        worldId: context.worldId,
        channelId: context.channelId,
        userId: context.userId,
      },
      {
        question: approvedPlan.question,
        phase: statePhase,
        plan: approvedPlan,
        run: {
          taskId: queuedTask.taskId,
          question: approvedPlan.question,
          status: "queued",
          phase: "queued",
          text: queuedTask.alreadyQueued
            ? "A research task is already in progress for this session."
            : "Research task queued.",
          topicCount: approvedPlan.topics.length,
          evidenceCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        session: null,
        progressEntry: {
          role: "planner",
          message: queuedTask.alreadyQueued
            ? "Research task already in progress."
            : "Plan approved. Research queued.",
        },
      }
    );

    logger.info(
      { question: approvedPlan.question, topicCount: approvedPlan.topics.length },
      "Approved research plan"
    );

    if (callback) {
      const responseContent: Content = {
        text: queuedTask.alreadyQueued
          ? "The plan is approved. A research task is already in progress for this session."
          : "The plan is approved. Research is starting in the background now.",
        actions: ["APPROVE_RESEARCH_PLAN"],
        source: message.content.source,
        metadata: {
          research: {
            phase: queuedTask.alreadyQueued ? "queued" : "approved",
            plan: approvedPlan,
            taskId: queuedTask.taskId,
          },
        },
      };

      await callback(responseContent);
    }

    const researchResult = {
      success: true,
      text: queuedTask.alreadyQueued
        ? `Research is already in progress for: ${approvedPlan.question}`
        : `Queued research session for: ${approvedPlan.question}`,
      data: {
        taskId: queuedTask.taskId,
        status: "queued",
      },
    };

    return {
      success: researchResult.success,
      text: `Approved research plan for: ${approvedPlan.question}`,
      data: {
        plan: approvedPlan,
        research: researchResult.data,
      },
    };
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "Approve this research plan.",
        },
      },
      {
        name: "{{name2}}",
        content: {
          text: "The plan is approved. Research is starting in the background now.",
          actions: ["APPROVE_RESEARCH_PLAN"],
        },
      },
    ],
  ],
};
