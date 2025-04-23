import { Provider } from "@elizaos/core";
import { COOPERATIVE_MAP } from "../environment";

export const cooperativesProvider: Provider = {
  get: async (_runtime, _message, _state) => {
    const cooperativesList = Object.keys(COOPERATIVE_MAP)
      .map(name => `- ${name}`)
      .join("\n");
    return `
# Available Cooperatives
The following cooperatives are supported:
${cooperativesList}

You can validate cooperative names using the provided utility functions.
    `;
  }
};
