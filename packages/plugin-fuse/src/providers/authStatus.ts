import { Provider, elizaLogger } from "@elizaos/core";
import { getAuthState, maskEmail } from "../environment";

export const authStatusProvider: Provider = {
  get: async (runtime, message, _state) => {
    try {
      const memories = await runtime.databaseAdapter.getMemories({
        roomId: message.roomId,
        tableName: "auth_state",
        agentId: runtime.agentId,
        count: 1,
        unique: true
      });
      if (memories.length === 0) {
        return "User is not authenticated.";
      }
      const authState = memories[0].content as any;
      let statusMsg = `# Authentication Status\nCurrent status: ${authState.status}\n`;
      if (authState.cooperative) {
        statusMsg += `Cooperative: ${authState.originalCoopName} (${authState.cooperative})\n`;
      }
      if (authState.credentials) {
        statusMsg += `Email: ${maskEmail(authState.credentials.email)}\n`;
        statusMsg += `Employee #: ${authState.credentials.employee_number}\n`;
      }
      if (authState.verifiedAt) {
        statusMsg += `Verified at: ${authState.verifiedAt}\n`;
      }
      return statusMsg;
    } catch (err: any) {
      elizaLogger.error("Error getting auth status:", err);
      return "Error retrieving authentication status.";
    }
  }
};
