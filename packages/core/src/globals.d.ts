// Minimal web-platform globals available in browsers, Web Workers and Node.js >= 18.
// Declared here so the core package does not depend on DOM or Node type libraries.
declare const performance: { now(): number };
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare class URLSearchParams {
  constructor(init?: string);
  [Symbol.iterator](): IterableIterator<[string, string]>;
}
