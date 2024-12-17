import { describe, it, expect, beforeEach, vi } from "vitest";
import { existsSync, statSync, watch, FSWatcher } from "fs";
import path from "path";
import { getLocalRepoFromConfig, initLocalRepoFileWatchers, fileWatchers, abortControllers } from "./local";
import { LocalConfig } from "./schemas/v2.js";
import { AppContext, LocalRepository } from "./types.js";

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  watch: vi.fn(),
}));

vi.mock("./utils.js", () => ({
  resolvePathRelativeToConfig: vi.fn((p, c) => path.resolve(c, p)),
}));

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
};

vi.mock("./logger.js", () => ({
  createLogger: vi.fn(() => mockLogger),
}));

describe("getLocalRepoFromConfig", () => {
  const ctx: AppContext = {
    configPath: "/config",
    otherContextProps: "example",
  } as any; // Replace with actual properties if available

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should resolve and validate a valid directory path", () => {
    const config: LocalConfig = {
      path: "repo",
      exclude: { paths: [] },
      watch: true,
    };

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);

    const repo = getLocalRepoFromConfig(config, ctx);

    expect(repo).toEqual({
      vcs: "local",
      name: "repo",
      id: path.resolve(ctx.configPath, "repo"),
      path: path.resolve(ctx.configPath, "repo"),
      isStale: false,
      excludedPaths: [],
      watch: true,
    });
  });

  it("should throw an error if the path does not exist", () => {
    const config: LocalConfig = {
      path: "nonexistent",
    };

    vi.mocked(existsSync).mockReturnValue(false);

    expect(() => getLocalRepoFromConfig(config, ctx)).toThrow(
      "The local repository path '/config/nonexistent' referenced in /config does not exist"
    );
  });

  it("should throw an error if the path is not a directory", () => {
    const config: LocalConfig = {
      path: "file",
    };

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => false } as any);

    expect(() => getLocalRepoFromConfig(config, ctx)).toThrow(
      "The local repository path '/config/file' referenced in /config is not a directory"
    );
  });
});

describe("initLocalRepoFileWatchers", () => {
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fileWatchers.clear();
    abortControllers.clear();
  });

  it("should initialize file watchers for valid repositories", async () => {
    const repos: LocalRepository[] = [
      {
        vcs: "local",
        name: "repo1",
        id: "/path/repo1",
        path: "/path/repo1",
        isStale: false,
        excludedPaths: [],
        watch: true,
      },
    ];

    const mockWatcher = { close: vi.fn() } as unknown as FSWatcher;
    vi.mocked(watch).mockReturnValue(mockWatcher);

    initLocalRepoFileWatchers(repos, mockOnUpdate);

    expect(fileWatchers.size).toBe(1);
    expect(fileWatchers.get("/path/repo1")).toBe(mockWatcher);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Watching local repository /path/repo1 for changes..."
    );
  });

  it("should not initialize watchers for stale or unwatched repositories", () => {
    const repos: LocalRepository[] = [
      {
        vcs: "local",
        name: "repo1",
        id: "/path/repo1",
        path: "/path/repo1",
        isStale: true,
        excludedPaths: [],
        watch: true,
      },
      {
        vcs: "local",
        name: "repo2",
        id: "/path/repo2",
        path: "/path/repo2",
        isStale: false,
        excludedPaths: [],
        watch: false,
      },
    ];

    initLocalRepoFileWatchers(repos, mockOnUpdate);

    expect(fileWatchers.size).toBe(0);
  });

  it("should handle abort signals correctly", async () => {
    const repos: LocalRepository[] = [
      {
        vcs: "local",
        name: "repo1",
        id: "/path/repo1",
        path: "/path/repo1",
        isStale: false,
        excludedPaths: [],
        watch: true,
      },
    ];

    const mockWatcher = { close: vi.fn() } as unknown as FSWatcher;
    vi.mocked(watch).mockImplementation((_, cb) => {
      cb();
      return mockWatcher;
    });

    initLocalRepoFileWatchers(repos, mockOnUpdate);

    expect(abortControllers.size).toBe(1);
    const controller = abortControllers.get("/path/repo1");
    expect(controller).toBeDefined();

    await mockOnUpdate.mock.calls[0][1](); // Simulate abort signal

    expect(mockOnUpdate).toHaveBeenCalledWith(repos[0], controller?.signal);
  });
});
