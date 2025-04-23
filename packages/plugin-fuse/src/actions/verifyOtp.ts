import {
    Action,
    elizaLogger,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State
  } from "@elizaos/core";
  import { getAuthState, setAuthState, FSN_HASH, AuthState } from "../environment";
  
  export const verifyOTPAction: Action = {
    name: "VERIFY_OTP",
    description: "Verifies the OTP code sent to the user's email during authentication",
    similes: ["CHECK_OTP", "ENTER_OTP", "VERIFY_CODE", "CONFIRM_OTP", "VALIDATE_OTP"],
    suppressInitialMessage: true,
    validate: async (runtime: IAgentRuntime, message: Memory) => {
      const text = message.content.text.trim();
      if (!/^\d+$/.test(text)) return false;
      elizaLogger.info(`Numeric input detected for OTP: "${text}"`);
      try {
        const authState = await getAuthState(runtime, message.roomId);
        if (authState.status !== AuthState.NEED_OTP) {
          return false;
        }
        return true;
      } catch (error: any) {
        elizaLogger.error("Error in OTP validator:", error);
        return false;
      }
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: State, _options, callback: HandlerCallback) => {
      try {
        elizaLogger.info("Handling OTP verification...");
        const authState = await getAuthState(runtime, message.roomId);
        const enteredOTP = message.content.text.trim();
        elizaLogger.info(`Verifying OTP: entered=${enteredOTP}, expected=${authState.otp}`);
        if (authState.status !== AuthState.NEED_OTP) {
          return false;
        }
        if (enteredOTP === authState.otp) {
          await setAuthState(runtime, message.roomId, {
            ...authState,
            status: AuthState.AUTHENTICATED,
            verifiedAt: new Date().toISOString(),
            postAuthAction: "LOAN",
          });
          if (authState.postAuthAction === "LOAN") {
            await callback({ text: "You've been successfully authenticated! I'll now check your loan information." });
          } else {
            await callback({ text: "Authentication successful! You're now logged in. How can I help you today?" });
          }
          return true;
        } else {
          await callback({
            text: "The verification code you provided doesn't match. Please check your email and try again."
          });
          return true;
        }
      } catch (error: any) {
        elizaLogger.error("Error in OTP verification handler:", error);
        await callback({
          text: "I encountered an error verifying your code. Please try entering it again."
        });
        return true;
      }
    },
    examples: [
      [
        {
          user: "{{user1}}",
          content: { text: "123456" }
        },
        {
          user: "{{user2}}",
          content: { text: "Authentication successful! You're now logged in. How can I help you today?", action: "VERIFY_OTP" }
        }
      ]
    ]
  };
  