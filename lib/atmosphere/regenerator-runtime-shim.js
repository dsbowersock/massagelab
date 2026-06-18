// @generative-music/web-library imports regenerator-runtime/runtime.js as a
// side effect, but its ESM bundle uses @babel/runtime/regenerator directly.
// This shim keeps Turbopack resolution explicit without adding global runtime
// behavior that the package does not need in this build.
