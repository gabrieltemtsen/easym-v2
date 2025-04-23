import {
    Action,
    elizaLogger,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State
  } from "@elizaos/core";
  import { resetAuthState } from "../environment";
  
  export const resetAction: Action = {
    name: "RESET_AUTH",
    description: "Reset authentication state and start fresh",
    similes: ["RESTART", "START_OVER", "RESET", "CLEAR", "REFRESH"],
    suppressInitialMessage: true,
    validate: async (runtime: IAgentRuntime, message: Memory) => {
      const text = message.content.text.toLowerCase();
      const resetKeywords = ["reset", "restart", "start over", "clear", "begin again", "start fresh", "start new", "new session"];
      return resetKeywords.some(keyword => text.includes(keyword) || new RegExp(`\\b${keyword}\\b`).test(text));
    },
    handler: async (runtime: IAgentRuntime, message: Memory, _state: State, _options, callback: HandlerCallback) => {
      await resetAuthState(runtime, message.roomId);
      await callback({
        text: "I've reset our conversation. Let's start fresh! If you need help with your cooperative account, just let me know."
      });
      return true;
    },
    examples: [
      [
        {
          user: "{{user1}}",
          content: { text: "Reset our conversation" }
        },
        {
          user: "{{user2}}",
          content: { text: "I've reset our conversation. Let's start fresh!", action: "RESET_AUTH" }
        }
      ]
    ]
  };
  