import { describe, expect, test } from "bun:test";
import { createRequestGeneration } from "./request-generation";

function createDeferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("request generation", () => {
  test("rejects a slower result after a newer request completes", async () => {
    const generation = createRequestGeneration();
    const slow = createDeferred<string>();
    const fast = createDeferred<string>();
    const accepted: string[] = [];

    const run = async (request: Promise<string>) => {
      const requestGeneration = generation.begin();
      const result = await request;
      if (generation.isCurrent(requestGeneration)) accepted.push(result);
    };

    const slowRequest = run(slow.promise);
    const fastRequest = run(fast.promise);

    try {
    fast.resolve("fast");
    await fastRequest;
    expect(accepted).toEqual(["fast"]);

    slow.resolve("slow");
    await slowRequest;
    expect(accepted).toEqual(["fast"]);
    } finally {
      fast.resolve("fast");
      slow.resolve("slow");
      await Promise.all([fastRequest, slowRequest]);
    }
  });
});

test("a newer selection invalidates earlier diff requests", () => {
  const requests = createRequestGeneration();
  const first = requests.begin();
  const second = requests.begin();
  expect(requests.isCurrent(first)).toBe(false);
  expect(requests.isCurrent(second)).toBe(true);
});

test("workspace or repository ownership changes reject otherwise current diffs", () => {
  let workspace = "first";
  let repository = "repo-a";
  const requests = createRequestGeneration(() => workspace === "first" && repository === "repo-a");
  const request = requests.begin();
  workspace = "second";
  expect(requests.isCurrent(request)).toBe(false);
  workspace = "first";
  repository = "repo-b";
  expect(requests.isCurrent(request)).toBe(false);
  // Cleanup invalidates the ticket even if its original workspace reopens.
  requests.begin();
  repository = "repo-a";
  expect(requests.isCurrent(request)).toBe(false);
});
