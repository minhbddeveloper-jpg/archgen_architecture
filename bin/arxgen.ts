#!/usr/bin/env node

import { main } from "../src/main.js";

main(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`arxgen failed: ${message}`);
  process.exitCode = 1;
});
