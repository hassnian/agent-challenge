import {
  type IAgentRuntime,
  logger,
  type Project,
  type ProjectAgent,
} from "@elizaos/core";
import { character } from "./character";
import researchRoomPlugin from "./plugins/research-room";

export const projectAgent: ProjectAgent = {
  character,
  plugins: [researchRoomPlugin],
  init: async (_runtime: IAgentRuntime) => {
    logger.info("Initializing project agent");
  },
};

const project: Project = {
  agents: [projectAgent],
};

export default project;
