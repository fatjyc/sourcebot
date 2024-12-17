import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getGitLabReposFromConfig } from './gitlab';
import { GitLabConfig } from './schemas/v2';
import { AppContext, GitRepository } from './types';
import { Gitlab } from '@gitbeaker/rest';

vi.mock('@gitbeaker/rest', () => ({
  Gitlab: vi.fn(() => ({
    Projects: {
      all: vi.fn(),
      show: vi.fn(),
    },
    Groups: {
      allProjects: vi.fn(),
    },
    Users: {
      allProjects: vi.fn(),
    },
    Branches: {
      all: vi.fn(),
    },
    Tags: {
      all: vi.fn(),
    },
  })),
}));

const mockGitlab = vi.mocked(new Gitlab());

describe('getGitLabReposFromConfig', () => {
  const mockContext: AppContext = {
    configPath: '/path/to/config',
    reposPath: '/path/to/repos',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all projects when config.all is true and not on GitLab cloud', async () => {
    const config: GitLabConfig = {
      all: true,
      url: 'https://gitlab.example.com',
    };

    mockGitlab.Projects.all.mockResolvedValueOnce([
      { path_with_namespace: 'group/project1', http_url_to_repo: 'http://repo1.git', archived: false, star_count: 10, forks_count: 5, web_url: 'http://web1', visibility: 'public' },
    ]);

    const repos = await getGitLabReposFromConfig(config, mockContext);

    expect(mockGitlab.Projects.all).toHaveBeenCalled();
    expect(repos).toHaveLength(1);
    expect(repos[0].name).toBe('group/project1');
  });

  it('should fetch projects by group', async () => {
    const config: GitLabConfig = {
      groups: ['my-group'],
    };

    mockGitlab.Groups.allProjects.mockResolvedValueOnce([
      { path_with_namespace: 'group/project2', http_url_to_repo: 'http://repo2.git', archived: false, star_count: 15, forks_count: 3, web_url: 'http://web2', visibility: 'private' },
    ]);

    const repos = await getGitLabReposFromConfig(config, mockContext);

    expect(mockGitlab.Groups.allProjects).toHaveBeenCalledWith('my-group', expect.objectContaining({ includeSubgroups: true }));
    expect(repos).toHaveLength(1);
    expect(repos[0].name).toBe('group/project2');
  });

  it('should fetch projects by user', async () => {
    const config: GitLabConfig = {
      users: ['my-user'],
    };

    mockGitlab.Users.allProjects.mockResolvedValueOnce([
      { path_with_namespace: 'user/project3', http_url_to_repo: 'http://repo3.git', archived: false, star_count: 20, forks_count: 8, web_url: 'http://web3', visibility: 'internal' },
    ]);

    const repos = await getGitLabReposFromConfig(config, mockContext);

    expect(mockGitlab.Users.allProjects).toHaveBeenCalledWith('my-user', expect.objectContaining({ perPage: 100 }));
    expect(repos).toHaveLength(1);
    expect(repos[0].name).toBe('user/project3');
  });

  it('should fetch specific projects', async () => {
    const config: GitLabConfig = {
      projects: ['specific/project'],
    };

    mockGitlab.Projects.show.mockResolvedValueOnce(
      { path_with_namespace: 'specific/project', http_url_to_repo: 'http://repo4.git', archived: false, star_count: 30, forks_count: 10, web_url: 'http://web4', visibility: 'public' }
    );

    const repos = await getGitLabReposFromConfig(config, mockContext);

    expect(mockGitlab.Projects.show).toHaveBeenCalledWith('specific/project');
    expect(repos).toHaveLength(1);
    expect(repos[0].name).toBe('specific/project');
  });

  it('should exclude forked and archived repos', async () => {
    const config: GitLabConfig = {
      all: true,
      exclude: {
        forks: true,
        archived: true,
      },
      url: 'https://gitlab.example.com',
    };

    mockGitlab.Projects.all.mockResolvedValueOnce([
      { path_with_namespace: 'group/project5', http_url_to_repo: 'http://repo5.git', archived: true, forked_from_project: {}, star_count: 5, forks_count: 2, web_url: 'http://web5', visibility: 'public' },
      { path_with_namespace: 'group/project6', http_url_to_repo: 'http://repo6.git', archived: false, star_count: 15, forks_count: 5, web_url: 'http://web6', visibility: 'public' },
    ]);

    const repos = await getGitLabReposFromConfig(config, mockContext);

    expect(repos).toHaveLength(1);
    expect(repos[0].name).toBe('group/project6');
  });

  it('should fetch branches and tags based on config', async () => {
    const config: GitLabConfig = {
      projects: ['specific/project'],
      revisions: {
        branches: ['main', 'dev'],
        tags: ['v1.*'],
      },
    };

    mockGitlab.Projects.show.mockResolvedValueOnce(
      { path_with_namespace: 'specific/project', http_url_to_repo: 'http://repo7.git', archived: false, star_count: 25, forks_count: 7, web_url: 'http://web7', visibility: 'public' }
    );

    mockGitlab.Branches.all.mockResolvedValueOnce([{ name: 'main' }, { name: 'dev' }, { name: 'feature' }]);
    mockGitlab.Tags.all.mockResolvedValueOnce([{ name: 'v1.0' }, { name: 'v1.1' }, { name: 'v2.0' }]);

    const repos = await getGitLabReposFromConfig(config, mockContext);

    expect(repos[0].branches).toEqual(['main', 'dev']);
    expect(repos[0].tags).toEqual(['v1.0', 'v1.1']);
  });
});
