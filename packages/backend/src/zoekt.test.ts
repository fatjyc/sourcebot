import { describe, it, expect, vi, beforeEach } from "vitest";
import { exec } from "child_process";
import { indexGitRepository, indexLocalRepository, ALWAYS_EXCLUDED_DIRS } from "./zoekt";
import { GitRepository, LocalRepository, Settings, AppContext } from "./types";

// Mocking exec from child_process
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

describe("indexGitRepository", () => {
  const mockExec = vi.mocked(exec);

  const repo: GitRepository = {
    path: "/path/to/repo",
    branches: ["branch1", "branch2"],
    tags: ["tag1"],
  };

  const settings: Settings = {
    maxFileSize: 1024,
  };

  const ctx: AppContext = {
    indexPath: "/path/to/index",
  };

  beforeEach(() => {
    mockExec.mockReset();
  });

  it("should execute the correct command", async () => {
    mockExec.mockImplementation((cmd, callback) => {
      callback(null, "stdout", "stderr");
    });

    await indexGitRepository(repo, settings, ctx);

    const expectedCommand = `zoekt-git-index -allow_missing_branches -index ${ctx.indexPath} -file_limit ${settings.maxFileSize} -branches HEAD,branch1,branch2,tag1 ${repo.path}`;
    expect(mockExec).toHaveBeenCalledWith(expectedCommand, expect.any(Function));
  });

  it("should resolve with stdout and stderr on success", async () => {
    mockExec.mockImplementation((cmd, callback) => {
      callback(null, "stdout", "stderr");
    });

    const result = await indexGitRepository(repo, settings, ctx);

    expect(result).toEqual({ stdout: "stdout", stderr: "stderr" });
  });

  it("should reject with error on failure", async () => {
    const error = new Error("exec error");
    mockExec.mockImplementation((cmd, callback) => {
      callback(error, "", "");
    });

    await expect(indexGitRepository(repo, settings, ctx)).rejects.toThrow("exec error");
  });
});

describe("indexLocalRepository", () => {
  const mockExec = vi.mocked(exec);

  const repo: LocalRepository = {
    path: "/path/to/local/repo",
    excludedPaths: ["node_modules"],
  };

  const settings: Settings = {
    maxFileSize: 2048,
  };

  const ctx: AppContext = {
    indexPath: "/path/to/local/index",
  };

  beforeEach(() => {
    mockExec.mockReset();
  });

  it("should execute the correct command", async () => {
    mockExec.mockImplementation((cmd, options, callback) => {
      callback(null, "stdout", "stderr");
    });

    await indexLocalRepository(repo, settings, ctx);

    const expectedCommand = `zoekt-index -index ${ctx.indexPath} -file_limit ${settings.maxFileSize} -ignore_dirs ${ALWAYS_EXCLUDED_DIRS.join(',')},node_modules ${repo.path}`;
    expect(mockExec).toHaveBeenCalledWith(expectedCommand, expect.any(Object), expect.any(Function));
  });

  it("should resolve with stdout and stderr on success", async () => {
    mockExec.mockImplementation((cmd, options, callback) => {
      callback(null, "stdout", "stderr");
    });

    const result = await indexLocalRepository(repo, settings, ctx);

    expect(result).toEqual({ stdout: "stdout", stderr: "stderr" });
  });

  it("should reject with error on failure", async () => {
    const error = new Error("exec error");
    mockExec.mockImplementation((cmd, options, callback) => {
      callback(error, "", "");
    });

    await expect(indexLocalRepository(repo, settings, ctx)).rejects.toThrow("exec error");
  });

  it("should handle AbortSignal if provided", async () => {
    const abortSignal = new AbortSignal();
    mockExec.mockImplementation((cmd, options, callback) => {
      callback(null, "stdout", "stderr");
    });

    await indexLocalRepository(repo, settings, ctx, abortSignal);

    expect(mockExec).toHaveBeenCalledWith(expect.any(String), { signal: abortSignal }, expect.any(Function));
  });
});
