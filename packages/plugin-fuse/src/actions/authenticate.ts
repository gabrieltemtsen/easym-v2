import {
  Action,
  elizaLogger,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from "@elizaos/core";
import {
  getAuthState,
  setAuthState,
  AuthState,
  validateCooperative,
  isValidEmail,
  FSN_HASH,
} from "../environment";

// A minimal credentials parser (you can replace with LLM extraction if needed)
function parseCredentialsFromText(text: string): { email?: string; employeeNumber?: string } {
  const result: { email?: string; employeeNumber?: string } = {};

  // Match email regardless of label
  const emailRegex = /(?:email|mail)?[:\s]*([\w.\-]+@[^\s]+\.[^\s]+)/i;
  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    result.email = emailMatch[1];
  }

  // Match employee number: an alphanumeric word of at least 2 characters,
  // typically after the email or preceded by a label like employeeNumber:
  const empRegex = /(?:employeeNumber\s*[:\-]?\s*)?\b([A-Z]{1,}[0-9]{2,})\b/i;
  const empMatch = text.match(empRegex);
  if (empMatch) {
    result.employeeNumber = empMatch[1].toUpperCase();
  }

  return result;
}



// A helper to call the external authentication API
async function authenticateWithBackend(
  email: string,
  employee_number: string,
  tenant: string
): Promise<{ otp?: string; token?: string }> {
  const apiUrl = "https://api.techfsn.com/api/bot/authenticate-client";
  const body = { email, employee_number, tenant };
  elizaLogger.info("Calling authentication API with body: ", body);
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "fsn-hash": FSN_HASH,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    elizaLogger.error("Error response from API: ", errorData);
    throw new Error(errorData.message || response.statusText);
  }
  elizaLogger.info("API responseBack: ", response);
  return (await response.json()).data || {};
}

export const authenticateAction: Action = {
  name: "AUTHENTICATE_USER",
  description: "Handles user authentication for cooperative services",
  similes: ["LOGIN", "VERIFY_USER", "AUTH", "AUTHENTICATE", "SIGN IN"],
  suppressInitialMessage: true,
  validate: async (_runtime: IAgentRuntime, _message: Memory) => true,
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options,
    callback: HandlerCallback
  ) => {
    const roomId = message.roomId;
    const userInput = message.content.text.trim();
    const authState = await getAuthState(runtime, roomId);
    elizaLogger.info(`Auth state for room ${roomId}: ${authState.status}`);
    
    // 1. Cooperative selection step
    if (authState.status === AuthState.NEED_COOPERATIVE) {
      const coop = validateCooperative(userInput);
      if (coop) {
        await setAuthState(runtime, roomId, {
          ...authState,
          status: AuthState.NEED_CREDENTIALS,
          cooperative: coop,
          originalCoopName: userInput,
        });
        await callback({
          text: `Great! I've recognized your cooperative as "${coop}". Please provide your email and employee number.`,
        });
      } else {
        await callback({
          text: `I couldn't recognize "${coop}" as a valid cooperative. Please try again (e.g., Fusion, CTLS, Octics).`,
        });
      }
      return true;
    }
    
    // 2. Credentials collection step
    if (authState.status === AuthState.NEED_CREDENTIALS) {
      elizaLogger.info(`User input for credentials: ${userInput}`);
      const { email, employeeNumber } = parseCredentialsFromText(userInput);
      elizaLogger.info(`Parsed credentials: email=${email}, employeeNumber=${employeeNumber}`);
      if (!email || !employeeNumber) {
        await callback({
          text: `I need both a valid email and employee number.
Example: "me@example.com FUS12345"`,
        });
        return true;
      }
      if (!isValidEmail(email)) {
        await callback({
          text: `The email "${email}" is not valid. Please provide a valid email.`,
        });
        return true;
      }
      try {
        const tenant = authState.cooperative;
        const data = await authenticateWithBackend(email, employeeNumber, tenant);
        elizaLogger.info(`API response: `, data);
        if (!data.otp || !data.token) {
          throw new Error("Missing OTP or token from API response.");
        }
        await setAuthState(runtime, roomId, {
          ...authState,
          status: AuthState.NEED_OTP,
          credentials: { email, employee_number: employeeNumber },
          otp: data.otp,
          token: data.token,
          otpGeneratedAt: new Date().toISOString(),
        });
        await callback({
          text: `An OTP has been sent to ${email}. Please enter the 6-digit code to continue.`,
        });
      } catch (err: any) {
        elizaLogger.error("Error authenticating credentials:", err);
        await callback({
          text: `Failed to authenticate. Please double-check your details and try again.`,
        });
      }
      return true;
    }
    
    // 3. OTP requested step (handled separately in verifyOTPAction)
    if (authState.status === AuthState.NEED_OTP) {
      await callback({
        text: "Please enter the 6-digit OTP sent to your email.",
      });
      return true;
    }
    
    // 4. Already authenticated
    if (authState.status === AuthState.AUTHENTICATED) {
      await callback({
        text: "You're already authenticated! How can I help you today?",
      });
      return true;
    }
    
    // Fallback: reset the flow
    await setAuthState(runtime, roomId, { status: AuthState.NEED_COOPERATIVE, userId: message.userId });
    await callback({
      text: "Let's start authentication. Which cooperative do you belong to? (e.g., Fusion, CTLS, Octics)",
    });
    return true;
  },
  examples: [
    [
      { user: "{{user1}}", content: { text: "Fusion" } },
      { user: "{{user2}}", content: { text: "Great! I've recognized your cooperative as 'Fusion'. Please provide your email and employee number.", action: "AUTHENTICATE_USER" } }
    ],
    [
      { user: "{{user1}}", content: { text: "me@example.com FUS12345" } },
      { user: "{{user2}}", content: { text: "An OTP has been sent to me@example.com. Please enter the 6-digit code.", action: "AUTHENTICATE_USER" } }
    ]
  ]
};
