#!/usr/bin/env node

import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeTestReportArtifacts } from "./generate-test-report.mjs";
import { parseJUnitCases } from "./parse-junit-cases.mjs";
import { positiveInteger, runProcess } from "./test-timing-lib.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "../../../..");

function parseArguments(arguments_) {
  const separator = arguments_.indexOf("--");
  const options = {
    workingDirectory: path.join(REPOSITORY_ROOT, "windows/tauri"),
    warnMs: 1000,
    maxMs: 15000,
    suiteTimeoutMs: 600000,
    report: path.join(REPOSITORY_ROOT, ".artifacts/test-stability/windows-frontend.json"),
    testArguments: separator >= 0 ? arguments_.slice(separator + 1) : [],
    isolateFiles: false,
  };
  const limit = separator >= 0 ? separator : arguments_.length;
  for (let index = 0; index < limit; index += 1) {
    const argument = arguments_[index];
    if (argument === "--working-directory") options.workingDirectory = path.resolve(arguments_[++index]);
    else if (argument === "--warn-ms") options.warnMs = positiveInteger(arguments_[++index], "--warn-ms");
    else if (argument === "--max-ms") options.maxMs = positiveInteger(arguments_[++index], "--max-ms");
    else if (argument === "--suite-timeout-ms") {
      options.suiteTimeoutMs = positiveInteger(arguments_[++index], "--suite-timeout-ms");
    } else if (argument === "--isolate-files") options.isolateFiles = true;
    else if (argument === "--report") options.report = path.resolve(arguments_[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.warnMs >= options.maxMs) throw new Error("--warn-ms must be lower than --max-ms.");
  return options;
}

export { parseJUnitCases } from "./parse-junit-cases.mjs";

function writeReport(options, result, tests) {
  const report = {
    schemaVersion: 1,
    runner: "bun",
    warnMs: options.warnMs,
    maxMs: options.maxMs,
    suiteTimeoutMs: options.suiteTimeoutMs,
    processDurationMs: Math.round(result.durationMs),
    ...(options.isolateFiles ? { isolation: "file-process" } : {}),
    tests,
  };
  writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
  writeTestReportArtifacts(options.report);
}

function isolatedTestFiles(options) {
  if (options.testArguments.some((argument) => argument.startsWith("-"))) {
    throw new Error("Isolated Bun tests accept file/directory paths, not runner flags.");
  }
  const files = new Set();
  const visit = (target) => {
    if (statSync(target).isFile()) {
      if (/\.test\.[cm]?[jt]sx?$/.test(target)) files.add(target);
      return;
    }
    for (const entry of readdirSync(target, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      visit(path.join(target, entry.name));
    }
  };
  for (const target of options.testArguments.length ? options.testArguments : ["src"]) {
    visit(path.resolve(options.workingDirectory, target));
  }
  if (!files.size) throw new Error("The isolated Bun runner found no test files.");
  return [...files].sort();
}

export async function run(options, { runProcessImpl = runProcess, now = () => performance.now() } = {}) {
  mkdirSync(path.dirname(options.report), { recursive: true });
  const junitPath = options.report.replace(/\.json$/i, ".junit.xml");
  rmSync(junitPath, { force: true });
  if (options.isolateFiles) {
    const tests = [];
    const started = now();
    let failed = false;
    let timedOut = false;
    try {
      for (const file of isolatedTestFiles(options)) {
        const remaining = options.suiteTimeoutMs - (now() - started);
        if (remaining <= 0) { timedOut = true; break; }
        rmSync(junitPath, { force: true });
        const fileTimeout = Math.min(remaining, options.maxMs * 4);
        const result = await runProcessImpl({
          command: "bun",
          args: ["test", file, "--timeout", String(options.maxMs), "--reporter=junit", `--reporter-outfile=${junitPath}`],
          cwd: options.workingDirectory,
          timeoutMs: fileTimeout,
          streamStdout: true,
          streamStderr: true,
        });
        let cases = [];
        try { cases = parseJUnitCases(readFileSync(junitPath, "utf8")); }
        catch { /* Missing output is recorded as a failure below. */ }
        tests.push(...cases.map((test) => ({ ...test, target: path.relative(options.workingDirectory, file) })));
        failed ||= result.code !== 0 || result.timedOut || cases.length === 0;
        if (result.timedOut || cases.length === 0) {
          tests.push({ name: file, status: result.timedOut ? "timeout" : "error", durationMs: Math.round(result.durationMs), details: result.timedOut ? `File process exceeded ${fileTimeout}ms.` : "No readable individual test results." });
        }
        if (result.timedOut && now() - started >= options.suiteTimeoutMs) { timedOut = true; break; }
      }
    } finally { rmSync(junitPath, { force: true }); }
    if (timedOut) tests.push({ name: "Bun isolated suite timeout", status: "timeout", durationMs: options.suiteTimeoutMs, details: "The shared suite deadline expired." });
    writeReport(options, { durationMs: now() - started }, tests);
    console.log(`Recorded ${tests.length} isolated Bun test duration(s) in ${options.report}`);
    if (timedOut || failed || tests.some((test) => test.status === "failed" || test.durationMs >= options.maxMs)) throw new Error("Isolated Bun tests failed or exceeded their local budget.");
    return;
  }
  const arguments_ = [
    "test",
    ...options.testArguments,
    "--timeout",
    String(options.maxMs),
    "--reporter=junit",
    `--reporter-outfile=${junitPath}`,
  ];
  const result = await runProcessImpl({
    command: "bun",
    args: arguments_,
    cwd: options.workingDirectory,
    timeoutMs: options.suiteTimeoutMs,
    streamStdout: true,
    streamStderr: true,
  });
  let tests = [];
  try {
    tests = parseJUnitCases(readFileSync(junitPath, "utf8"));
  } catch (error) {
    if (!result.timedOut) {
      throw new Error(`Bun did not produce a readable JUnit report: ${error.message}`);
    }
  }
  if (result.timedOut) {
    tests.push({
      name: "Bun test suite timeout",
      suite: "Bun test runner",
      status: "timeout",
      durationMs: options.suiteTimeoutMs,
      details: `Bun test suite exceeded the shared ${options.suiteTimeoutMs}ms deadline.`,
    });
  }
  writeReport(options, result, tests);
  console.log(`Recorded ${tests.length} Bun test duration(s) in ${options.report}`);
  for (const test of tests
    .filter((value) => value.durationMs >= options.warnMs)
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, 10)) {
    console.log(`SLOW ${test.durationMs}ms ${test.name}`);
  }
  if (result.timedOut) throw new Error(`Bun test suite exceeded ${options.suiteTimeoutMs}ms.`);
  if (tests.length === 0) throw new Error("The Bun runner did not report any individual test durations.");
  if (result.code !== 0) throw new Error(`Bun test command exited with code ${result.code}.`);
  const overBudget = tests.filter((test) => test.durationMs >= options.maxMs || test.status === "failed");
  if (overBudget.length > 0) throw new Error(`${overBudget.length} Bun test(s) failed or exceeded the local budget.`);
}

async function main() {
  try {
    await run(parseArguments(process.argv.slice(2)));
  } catch (error) {
    console.error(`Bun test timing failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) await main();
