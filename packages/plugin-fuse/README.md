# Fuse Plugin

This plugin implements cooperative authentication and loan management for Eliza OS.

## Structure

- **src/index.ts**: Main plugin entry point.
- **src/environment.ts**: Constants, helper functions, and authentication state management.
- **src/types.ts**: Type definitions (e.g. AuthState).
- **src/actions/**: Actions for authentication (cooperative selection, credentials, OTP verification, reset).
- **src/providers/**: Providers for the list of cooperatives and authentication status.

## Build

Run `npm run build` to compile the plugin.