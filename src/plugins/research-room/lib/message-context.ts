import type { IAgentRuntime, Memory } from "@elizaos/core";

export const resolveResearchMessageContext = async (
  runtime: IAgentRuntime,
  message: Memory
) => {
  const room = await runtime.getRoom(message.roomId);

  return {
    room,
    roomId: message.roomId,
    worldId: message.worldId ?? room?.worldId ?? message.roomId,
    channelId: room?.channelId ?? message.roomId,
    userId: message.entityId ?? null,
  };
};
