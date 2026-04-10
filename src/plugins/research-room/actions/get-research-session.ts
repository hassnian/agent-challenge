import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
} from "@elizaos/core";
import { resolveStoredResearchSession } from "../lib/session-reference";

export const getResearchSessionAction: Action = {
  name: "GET_RESEARCH_SESSION",
  similes: ["OPEN_RESEARCH_SESSION", "VIEW_RESEARCH_SESSION", "REOPEN_RESEARCH_SESSION"],
  description: "Open a saved research session from this room, defaulting to the latest session when none is specified.",
  validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const text = message.content.text?.trim().toLowerCase() ?? "";
    return (
      /open|reopen|view|show|get|read/.test(text) &&
      /session|memo|report|dossier/.test(text)
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
    const session = await resolveStoredResearchSession(
      runtime,
      message.roomId,
      message.content.text ?? ""
    );

    if (!session) {
      const notFoundText =
        "I could not find a saved research session to open in this room.";

      if (callback) {
        const responseContent: Content = {
          text: notFoundText,
          actions: ["GET_RESEARCH_SESSION"],
          source: message.content.source,
        };

        await callback(responseContent);
      }

      return {
        success: false,
        text: notFoundText,
      };
    }

    const text = [
      "## Saved Session",
      `- Session ID: ${session.id}`,
      `- Completed: ${new Date(session.data.completedAt).toISOString()}`,
      `- Topics: ${session.data.topicResults.length}`,
      `- Evidence Cards: ${session.data.evidence.length}`,
      "",
      session.markdown,
    ].join("\n");

    if (callback) {
      const responseContent: Content = {
        text,
        actions: ["GET_RESEARCH_SESSION"],
        source: message.content.source,
      };

      await callback(responseContent);
    }

    return {
      success: true,
      text: `Opened saved research session: ${session.data.question}`,
      data: {
        session,
      },
    };
  },
};
