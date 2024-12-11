import { describe, it, expect, beforeEach, vi } from "vitest";
import { Octokit } from "@octokit/rest";
import { getGitHubReposFromConfig } from "./github";
import { GitHubConfig } from "./schemas/v2";
import { AppContext, GitRepository } from "./types";
import { logger } from "./github";
import path from "path";

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn(() => ({
    paginate: vi.fn(),
    repos: {
      listForOrg: vi.fn(),
      listForUser: vi.fn(),
      listForAuthenticatedUser: vi.fn(),
      get: vi.fn(),
      listTags: vi.fn(),
      listBranches: vi.fn(),
    },
  })),
}));

vi.mock("./logger.js", () => ({
  createLogger: () => ({
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("./utils.js", () => ({
  excludeArchivedRepos: vi.fn((repos) => repos),
  excludeForkedRepos: vi.fn((repos) => repos),
  excludeReposByName: vi.fn((repos) => repos),
  getTokenFromConfig: vi.fn(() => "mocked-token"),
  marshalBool: vi.fn((value) => value),
  measure: vi.fn(async (fn) => {
    const data = await fn();
    return { durationMs: 100, data };
  }),
}));

const mockGitHubConfig: GitHubConfig = {
  token: "mocked-token",
  orgs: ["mock-org"],
  repos: ["mock-user/mock-repo"],
  users: ["mock-user"],
  exclude: {
    forks: true,
    archived: true,
    repos: ["excluded-repo"],
  },
  revisions: {
    branches: ["main", "dev"],
    tags: ["v1.*", "v2.*"],
  },
};

const mockAppContext: AppContext = {
  reposPath: "/mock/path",
};

describe("getGitHubReposFromConfig", () => {
  let octokitInstance: any;

  beforeEach(() => {
    octokitInstance = new Octokit();
    vi.clearAllMocks();
  });

  it("should fetch repositories for orgs, repos, and users", async () => {
    octokitInstance.paginate.mockResolvedValueOnce([{ name: "mock-repo", full_name: "mock-org/mock-repo", fork: false, private: false, html_url: "", clone_url: "https://github.com/mock-org/mock-repo.git" }]);
    octokitInstance.paginate.mockResolvedValueOnce([{ name: "mock-repo", full_name: "mock-user/mock-repo", fork: false, private: false, html_url: "", clone_url: "https://github.com/mock-user/mock-repo.git" }]);
    octokitInstance.repos.get.mockResolvedValueOnce({ data: { name: "mock-repo", full_name: "mock-user/mock-repo", fork: false, private: false, html_url: "", clone_url: "https://github.com/mock-user/mock-repo.git" } });

    const signal = new AbortSignal();
    const repos = await getGitHubReposFromConfig(mockGitHubConfig, signal, mockAppContext);

    expect(repos).toHaveLength(2);
  });

  it("should exclude forks and archived repositories", async () => {
    octokitInstance.paginate.mockResolvedValueOnce([{ name: "mock-fork", full_name: "mock-org/mock-fork", fork: true, private: false, html_url: "", clone_url: "https://github.com/mock-org/mock-fork.git" }]);
    octokitInstance.paginate.mockResolvedValueOnce([{ name: "mock-archived", full_name: "mock-user/mock-archived", fork: false, private: false, archived: true, html_url: "", clone_url: "https://github.com/mock-user/mock-archived.git" }]);

    const signal = new AbortSignal();
    const repos = await getGitHubReposFromConfig(mockGitHubConfig, signal, mockAppContext);

    expect(repos).toHaveLength(0);
  });

  it("should include branches and tags based on revisions", async () => {
    octokitInstance.paginate.mockResolvedValueOnce([{ name: "mock-repo", full_name: "mock-org/mock-repo", fork: false, private: false, html_url: "", clone_url: "https://github.com/mock-org/mock-repo.git" }]);
    octokitInstance.repos.listBranches.mockResolvedValueOnce([{ name: "main" }, { name: "dev" }]);
    octokitInstance.repos.listTags.mockResolvedValueOnce([{ name: "v1.0" }, { name: "v2.0" }]);

    const signal = new AbortSignal();
    const repos = await getGitHubReposFromConfig(mockGitHubConfig, signal, mockAppContext);

    expect(repos[0].branches).toEqual(["main", "dev"]);
    expect(repos[0].tags).toEqual(["v1.0", "v2.0"]);
  });
});
