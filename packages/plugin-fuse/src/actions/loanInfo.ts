import {
  Action,
  elizaLogger,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
  generateText,
  ModelClass
} from "@elizaos/core";
import { getAuthState, setAuthState, FSN_HASH, AuthState } from "../environment";

async function determineLoanInfoType(runtime: IAgentRuntime, message: string): Promise<string> {
  const context = `
Determine the loan info type from the user's message.
Categories: STATUS, AMOUNT, PAYMENT, ELIGIBILITY, HISTORY, DETAILS.
User message: "${message}"
  `;
  const loanInfoType = (await generateText({
    runtime,
    context,
    modelClass: ModelClass.SMALL,
    stop: ["\n"]
  })).trim();
  const validTypes = ["STATUS", "AMOUNT", "PAYMENT", "ELIGIBILITY", "HISTORY", "DETAILS"];
  const normalizedType = loanInfoType.toUpperCase();
  return validTypes.includes(normalizedType) ? normalizedType : "DETAILS";
}

async function formatLoanResponse(runtime: IAgentRuntime, loanData: any, infoType: string): Promise<string> {
  if (!loanData || (typeof loanData === "object" && Object.keys(loanData).length === 0)) {
    return "I couldn't find any active loan information. If you believe this is incorrect, please contact support.";
  }
  const context = `
You are a financial assistant helping a cooperative member understand their loan information.
Loan data: ${JSON.stringify(loanData, null, 2)}
User is asking about: ${infoType}
Provide a friendly, concise response under 150 words.
  `;
  const formattedResponse = await generateText({
    runtime,
    context,
    modelClass: ModelClass.LARGE
  });
  return formattedResponse;
}

export const loanInfoAction: Action = {
  name: "LOAN",
  description: "Check loan information for a user, initiating authentication if needed",
  similes: [
    "LOAN_INFO", "LOAN_STATUS", "CHECK_LOAN_INFO", "GET_LOAN_STATUS", "LOAN_BALANCE", "LOAN_DETAILS", "MY_LOAN"
  ],
  suppressInitialMessage: true,
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text.toLowerCase();
    if (/^\d+$/.test(text)) return false;
    const loanKeywords = [
      "loan", "borrow", "credit", "debt", "payment", "balance", "due", "repayment", "interest", "principal"
    ];
    return loanKeywords.some(keyword => text.includes(keyword) || new RegExp(`\\b${keyword}\\b`).test(text));
  },
  handler: async (runtime: IAgentRuntime, message: Memory, _state: State, _options: any, callback: HandlerCallback) => {
    const authState = await getAuthState(runtime, message.roomId);
    if (authState.status !== AuthState.AUTHENTICATED) {
      await callback({
        text: "To check your loan information, I'll need to verify your identity first. Which cooperative do you belong to?"
      });
      elizaLogger.info(`User is not authenticated. Current status: ${authState.status}`);
      await setAuthState(runtime, message.roomId, {
        status: AuthState.NEED_COOPERATIVE,
        userId: message.userId,
        postAuthAction: "AUTHENTICATE_USER"
      });
      return true;
    }
    const loanInfoType = await determineLoanInfoType(runtime, message.content.text);
    const apiUrl = `https://api.techfsn.com/api/bot/client-loan-info?tenant=${authState.cooperative}&employee_number=${authState.credentials.employee_number}`;
    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authState.token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "fsn-hash": FSN_HASH
        }
      });
      if (!response.ok) {
        if (response.status === 401) {
          await callback({
            text: "Your session has expired. Let's re-authenticate. Which cooperative do you belong to?"
          });
          await setAuthState(runtime, message.roomId, {
            status: AuthState.NEED_COOPERATIVE,
            userId: message.userId,
            postAuthAction: "LOAN"
          });
          return true;
        }
        throw new Error(`Failed to fetch loan info: ${response.statusText}`);
      }
      const loanData = await response.json();
      const formattedResponse = await formatLoanResponse(runtime, loanData, loanInfoType);
      await callback({ text: formattedResponse });
      return true;
    } catch (error: any) {
      elizaLogger.error("Error fetching loan information", error);
      await callback({
        text: "I encountered an error while retrieving your loan information. Please try again."
      });
      await setAuthState(runtime, message.roomId, {
        status: AuthState.NEED_COOPERATIVE,
        userId: message.userId,
        postAuthAction: "LOAN",
        lastError: error.message
      });
      return true;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Can you tell me about my loan status?" }
      },
      {
        user: "{{user2}}",
        content: { text: "To check your loan information, I'll need to verify your identity first. Which cooperative do you belong to?", action: "LOAN" }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "What's my current loan balance?" }
      },
      {
        user: "{{user2}}",
        content: { text: "To check your loan balance, I'll need to verify your identity first. Which cooperative do you belong to?", action: "LOAN" }
      }
    ]
  ]
};
