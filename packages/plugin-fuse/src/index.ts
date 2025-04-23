import type { Plugin } from "@elizaos/core";
import { authenticateAction } from "./actions/authenticate";
import { resetAction } from "./actions/reset";
import { loanInfoAction } from "./actions/loanInfo";
import { verifyOTPAction } from "./actions/verifyOTP";
import { cooperativesProvider } from "./providers/cooperatives";
import { authStatusProvider } from "./providers/authStatus";

export * as actions from "./actions";
export * as providers from "./providers";

export const fusePlugin: Plugin = {
  name: "fuse-plugin",
  description: "Fuse Cooperative Management plugin for Fuse App",
  actions: [
    authenticateAction,
    resetAction,
    loanInfoAction,
    verifyOTPAction
  ],
  providers: [cooperativesProvider, authStatusProvider]
};

export default fusePlugin;
