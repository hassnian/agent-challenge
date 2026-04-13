import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  type State,
} from "@elizaos/core";
import { buildFollowUpPlanPrompt, parsePlanResponse } from "../lib/planner";
import { generateStructuredText } from "../lib/structured-model";
import { createDefaultResearchPlan, createResearchPlan } from "../lib/plan";
import { resolveResearchMessageContext } from "../lib/message-context";
import { queueResearchSessionTask } from "../lib/research-task";
import { resolveStoredResearchSession } from "../lib/session-reference";
import { saveResearchPlan } from "../lib/plan-store";
import { saveResearchState } from "../lib/research-state-store";

const extractFollowUpInstruction = (text: string): string => {
  const trimmed = text.trim();
  const withoutLead = trimmed.replace(
    /^(please\s+)?(?:follow\s*up|continue|go\s+deeper|dig\s+deeper|revisit|build\s+on|expand\s+on|investigate\s+more)\s*(?:on\s*)?/i,
    ""
  );

  return withoutLead
    .replace(/\b(?:latest|recent)\s+(?:research\s+)?(?:session|memo|report|dossier)\b/gi, "")
    .replace(/\b(?:research\s+)?(?:session|memo|report|dossier)\s*#?\s*[0-9a-f-]+\b/gi, "")
    .replace(/^[:\-\s]+|[:\-\s]+$/g, "")
    .trim();
};

export const followUpResearchSessionAction: Action = {
  name: "FOLLOW_UP_RESEARCH_SESSION",
  similes: ["CONTINUE_RESEARCH_SESSION", "DEEPEN_RESEARCH_SESSION", "FOLLOW_UP_ON_RESEARCH"],
  description: "Create a follow-up research plan from a saved session and queue the next background research run.",
  validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const text = message.content.text?.trim().toLowerCase() ?? "";
    return (
      /follow\s*up|continue|go deeper|dig deeper|revisit|build on|expand/.test(text) &&
      /session|memo|report|dossier|research/.test(text)
    );
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    const sourceSession = await resolveStoredResearchSession(
      runtime,
      message.roomId,
      message.content.text ?? ""
    );

    if (!sourceSession) {
      const notFoundText =
        "I could not find a saved research session to continue from in this room.";

      if (callback) {
        const responseContent: Content = {
          text: notFoundText,
          actions: ["FOLLOW_UP_RESEARCH_SESSION"],
          source: message.content.source,
        };

        await callback(responseContent);
      }

      return {
        success: false,
        text: notFoundText,
      };
    }

    const instruction =
      extractFollowUpInstruction(message.content.text ?? "") ||
      (sourceSession.data.openQuestions[0] ??
        "Investigate the strongest unresolved questions and weakest-supported claims from this session.");
    const fallbackQuestion = `Follow up on \"${sourceSession.data.question}\": ${instruction}`;
    let plan = createDefaultResearchPlan(fallbackQuestion);

    try {
      const plannerText = await generateStructuredText(
        runtime,
        ModelType.TEXT_LARGE,
        buildFollowUpPlanPrompt(sourceSession.data, instruction),
        {
          temperature: 0.3,
          maxTokens: 2400,
        }
      );

      if (plannerText) {
        const parsedPlan = parsePlanResponse(fallbackQuestion, plannerText);
        if (parsedPlan) {
          plan = parsedPlan;
        } else {
          logger.warn(
            { question: sourceSession.data.question, sourceSessionId: sourceSession.id },
            "Follow-up planner returned non-JSON or invalid JSON"
          );
        }
      } else {
        logger.warn(
          { question: sourceSession.data.question, sourceSessionId: sourceSession.id },
          "Follow-up planner returned no usable text response"
        );
      }
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          question: sourceSession.data.question,
          sourceSessionId: sourceSession.id,
        },
        "Falling back to default follow-up research plan"
      );
    }

    const approvedPlan = {
      ...plan,
      approved: true,
    };
    const context = await resolveResearchMessageContext(runtime, message);

    const queuedTask = await queueResearchSessionTask(runtime, {
      roomId: context.roomId,
      worldId: context.worldId,
      entityId: message.entityId,
      question: approvedPlan.question,
      plan: approvedPlan,
    });

    if (!queuedTask.alreadyQueued) {
      await saveResearchPlan(runtime, message, approvedPlan);
    }
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
        phase: "researching",
        plan: approvedPlan,
        run: {
          taskId: queuedTask.taskId,
          question: approvedPlan.question,
          status: "queued",
          phase: "queued",
          text: queuedTask.alreadyQueued
            ? "A follow-up research task is already in progress."
            : "Follow-up research task queued.",
          topicCount: approvedPlan.topics.length,
          evidenceCount: 0,
          currentTopicIndex: 0,
          completedTopicCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        session: null,
        progressEntry: {
          role: "planner",
          message: queuedTask.alreadyQueued
            ? "Follow-up research task already in progress."
            : "Follow-up research queued.",
        },
      }
    );

    const renderedPlan = createResearchPlan(approvedPlan);
    const responseText = queuedTask.alreadyQueued
      ? "A research task is already in progress for this session."
      : "Follow-up research is queued and will continue in the background.";

    if (callback) {
      const responseContent: Content = {
        text: [responseText, "", renderedPlan.markdown].join("\n"),
        actions: ["FOLLOW_UP_RESEARCH_SESSION"],
        source: message.content.source,
        metadata: {
          research: {
            phase: queuedTask.alreadyQueued ? "queued" : "approved",
            taskId: queuedTask.taskId,
            sourceSessionId: sourceSession.id,
          },
        },
      };

      await callback(responseContent);
    }

    return {
      success: true,
      text: queuedTask.alreadyQueued
        ? `Research is already in progress for: ${approvedPlan.question}`
        : `Queued follow-up research session for: ${approvedPlan.question}`,
      data: {
        taskId: queuedTask.taskId,
        status: "queued",
        question: approvedPlan.question,
        sourceSessionId: sourceSession.id,
        plan: approvedPlan,
      },
    };
  },
};
