import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
} from "@elizaos/core";
import { listResearchSessions } from "../lib/session-store";

const truncate = (value: string, maxLength: number): string => {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
};

export const listResearchSessionsAction: Action = {
  name: "LIST_RESEARCH_SESSIONS",
  similes: ["RESEARCH_HISTORY", "LIST_SAVED_RESEARCH", "SHOW_RESEARCH_HISTORY"],
  description: "List saved research sessions in the current room so the user can reopen or continue them.",
  validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const text = message.content.text?.trim().toLowerCase() ?? "";
    return (
      /history|saved|past|previous|recent|list|show/.test(text) &&
      /research|session|memo|report|dossier/.test(text)
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
    const sessions = await listResearchSessions(runtime, message.roomId, 10);
    const text =
      sessions.length > 0
        ? [
            "## Saved Research Sessions",
            ...sessions.flatMap((session, index) => [
              `${index + 1}. **${session.data.question}**`,
              `   - Session ID: ${session.id}`,
              `   - Completed: ${new Date(session.data.completedAt).toISOString()}`,
              `   - Topics: ${session.data.topicResults.length}`,
              `   - Evidence Cards: ${session.data.evidence.length}`,
              `   - Summary: ${truncate(session.data.summary, 180)}`,
            ]),
          ].join("\n")
        : "I could not find any saved research sessions in this room yet.";

    if (callback) {
      const responseContent: Content = {
        text,
        actions: ["LIST_RESEARCH_SESSIONS"],
        source: message.content.source,
      };

      await callback(responseContent);
    }

    return {
      success: true,
      text,
      data: {
        sessions,
      },
    };
  },
};
