import type { IAgentRuntime, Memory } from "@elizaos/core";
import {
  getLatestStoredResearchSession,
  getStoredResearchSessionById,
  listResearchSessions,
  type StoredResearchSession,
} from "./session-store";

const extractSessionIndex = (text: string): number | null => {
  const match = text.match(/\b(?:session|memo|report|dossier)\s*#?\s*(\d{1,2})\b/i);
  if (!match) {
    return null;
  }

  const index = Number.parseInt(match[1] ?? "", 10);
  return Number.isInteger(index) && index > 0 ? index : null;
};

const extractSessionId = (text: string): string | null => {
  const match = text.match(
    /\b(?:session\s+id|session|memo|report|dossier)\s*[:#]?\s*([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[0-9a-f]{8,})\b/i
  );
  return match?.[1]?.trim() ?? null;
};

export const resolveStoredResearchSession = async (
  runtime: IAgentRuntime,
  roomId: Memory["roomId"],
  text: string
): Promise<StoredResearchSession | null> => {
  const trimmed = text.trim();
  const explicitId = extractSessionId(trimmed);
  if (explicitId) {
    return getStoredResearchSessionById(runtime, roomId, explicitId);
  }

  const explicitIndex = extractSessionIndex(trimmed);
  if (explicitIndex) {
    const sessions = await listResearchSessions(runtime, roomId, Math.max(explicitIndex, 10));
    return sessions.at(explicitIndex - 1) ?? null;
  }

  return getLatestStoredResearchSession(runtime, roomId);
};
