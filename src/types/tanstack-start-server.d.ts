// The installed @tanstack/react-start/server ships runtime `getRequest` (via
// @tanstack/start-server-core) but its bundled type declarations don't surface
// it. This augmentation adds the missing signature so server code that reads
// the incoming request type-checks. Runtime behavior is unchanged.
declare module "@tanstack/react-start/server" {
  export function getRequest(): Request;
}
