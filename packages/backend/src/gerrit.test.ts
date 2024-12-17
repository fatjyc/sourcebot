import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getGerritReposFromConfig } from './gerrit';
import fetch from 'cross-fetch';
import path from 'path';
import { GerritConfig } from './schemas/v2.js';
import { AppContext, GitRepository } from './types.js';

vi.mock('cross-fetch', () => ({
  default: vi.fn(),
}));

vi.mock('./logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
  }),
}));

vi.mock('./utils.js', () => ({
  measure: vi.fn(async (fn: Function) => ({ durationMs: 100, data: await fn() })),
  marshalBool: (value: boolean) => value.toString(),
  excludeReposByName: (repos: GitRepository[], names: string[]) => repos.filter(repo => !names.includes(repo.name)),
  includeReposByName: (repos: GitRepository[], names: string[]) => repos.filter(repo => names.includes(repo.name)),
}));

describe('getGerritReposFromConfig', () => {
  const mockFetch = vi.mocked(fetch);
  const mockProjectsResponse = {
    'project-one': {
      id: 'project-one',
      web_links: [{ name: 'gitiles', url: 'https://example.com/project-one' }],
    },
    'project-two': {
      id: 'project-two',
      state: 'ACTIVE',
    },
    'All-Projects': {
      id: 'All-Projects',
    },
    'All-Users': {
      id: 'All-Users',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and return repositories from the Gerrit config', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => ")]}'\n" + JSON.stringify(mockProjectsResponse),
    } as Response);

    const config: GerritConfig = {
      url: 'https://gerrit.example.com',
    };

    const ctx: AppContext = {
      reposPath: '/repos',
    };

    const repos = await getGerritReposFromConfig(config, ctx);

    expect(repos).toEqual([
      {
        vcs: 'git',
        codeHost: 'gerrit',
        name: 'project-one',
        id: 'gerrit.example.com/project-one',
        cloneUrl: 'https://gerrit.example.com/project-one',
        path: path.resolve('/repos/gerrit.example.com/project-one.git'),
        isStale: false,
        isFork: false,
        isArchived: false,
        gitConfigMetadata: {
          'zoekt.web-url-type': 'gitiles',
          'zoekt.web-url': 'https://example.com/project-one',
          'zoekt.name': 'gerrit.example.com/project-one',
          'zoekt.archived': 'false',
          'zoekt.fork': 'false',
          'zoekt.public': 'true',
        },
        branches: [],
        tags: [],
      },
      {
        vcs: 'git',
        codeHost: 'gerrit',
        name: 'project-two',
        id: 'gerrit.example.com/project-two',
        cloneUrl: 'https://gerrit.example.com/project-two',
        path: path.resolve('/repos/gerrit.example.com/project-two.git'),
        isStale: false,
        isFork: false,
        isArchived: false,
        gitConfigMetadata: {
          'zoekt.web-url-type': 'gitiles',
          'zoekt.web-url': 'https://www.gerritcodereview.com/',
          'zoekt.name': 'gerrit.example.com/project-two',
          'zoekt.archived': 'false',
          'zoekt.fork': 'false',
          'zoekt.public': 'true',
        },
        branches: [],
        tags: [],
      },
    ]);
  });

  it('should apply include and exclude filters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => ")]}'\n" + JSON.stringify(mockProjectsResponse),
    } as Response);

    const config: GerritConfig = {
      url: 'https://gerrit.example.com',
      projects: ['project-one'],
      exclude: {
        projects: ['project-two'],
      },
    };

    const ctx: AppContext = {
      reposPath: '/repos',
    };

    const repos = await getGerritReposFromConfig(config, ctx);

    expect(repos).toEqual([
      {
        vcs: 'git',
        codeHost: 'gerrit',
        name: 'project-one',
        id: 'gerrit.example.com/project-one',
        cloneUrl: 'https://gerrit.example.com/project-one',
        path: path.resolve('/repos/gerrit.example.com/project-one.git'),
        isStale: false,
        isFork: false,
        isArchived: false,
        gitConfigMetadata: {
          'zoekt.web-url-type': 'gitiles',
          'zoekt.web-url': 'https://example.com/project-one',
          'zoekt.name': 'gerrit.example.com/project-one',
          'zoekt.archived': 'false',
          'zoekt.fork': 'false',
          'zoekt.public': 'true',
        },
        branches: [],
        tags: [],
      },
    ]);
  });

  it('should throw an error if the fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    } as Response);

    const config: GerritConfig = {
      url: 'https://gerrit.example.com',
    };

    const ctx: AppContext = {
      reposPath: '/repos',
    };

    await expect(getGerritReposFromConfig(config, ctx)).rejects.toThrow('Failed to fetch projects from Gerrit: Not Found');
  });
});
