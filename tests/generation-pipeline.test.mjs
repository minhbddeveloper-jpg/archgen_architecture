import test from "node:test";
import assert from "node:assert/strict";
import { GenerationPipeline } from "../dist/src/core/application/generationPipeline.js";

const config = {
  projectName: "pipeline-test",
  language: "typescript",
  framework: "express",
  architecture: "clean"
};

test("generation pipeline orders features by dependencies", async () => {
  const pipeline = new GenerationPipeline([
    {
      name: "api",
      dependsOn: ["setup"],
      generate: () => [{ path: "api.txt", content: "api" }]
    },
    {
      name: "setup",
      capabilities: ["setup"],
      generate: () => [{ path: "setup.txt", content: "setup" }]
    }
  ]);

  const files = await pipeline.run(config, "app", false, { requiredCapabilities: ["setup"] });

  assert.deepEqual(files.map((file) => file.path), ["setup.txt", "api.txt"]);
});

test("generation pipeline validates duplicate, unknown, and circular feature dependencies", async () => {
  assert.throws(() => new GenerationPipeline([
    { name: "setup", generate: () => [] },
    { name: "setup", generate: () => [] }
  ]), /Duplicate generation feature/);

  assert.throws(() => new GenerationPipeline([
    { name: "api", dependsOn: ["missing"], generate: () => [] }
  ]), /depends on unknown feature/);

  assert.throws(() => new GenerationPipeline([
    { name: "a", dependsOn: ["b"], generate: () => [] },
    { name: "b", dependsOn: ["a"], generate: () => [] }
  ]), /Circular generation feature dependency/);

  const pipeline = new GenerationPipeline([{ name: "setup", generate: () => [] }]);
  await assert.rejects(() => pipeline.run(config, "app", false, { only: ["missing"] }), /Unknown generation feature/);
});
