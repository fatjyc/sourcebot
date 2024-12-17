import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cloneRepository, fetchRepository } from './git';
import { simpleGit, SimpleGitProgressEvent } from 'simple-git';
import { existsSync } from 'fs';
import { GitRepository } from './types';

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    clone: vi.fn(),
    cwd: vi.fn(() => ({
      addConfig: vi.fn(),
    })),
    fetch: vi.fn(),
  })),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

describe('git module', () => {
  let mockRepo: GitRepository;
  let mockOnProgress: (event: SimpleGitProgressEvent) => void;
  let gitMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepo = {
      id: 'test-repo',
      path: '/fake/path',
      cloneUrl: 'https://fakeurl.com/repo.git',
      gitConfigMetadata: { 'user.name': 'testuser' },
    };

    mockOnProgress = vi.fn();

    gitMock = simpleGit();
  });

  describe('cloneRepository', () => {
    it('should skip cloning if the repository path already exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);

      await cloneRepository(mockRepo, mockOnProgress);

      expect(existsSync).toHaveBeenCalledWith(mockRepo.path);
      expect(gitMock.clone).not.toHaveBeenCalled();
    });

    it('should clone the repository if the path does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await cloneRepository(mockRepo, mockOnProgress);

      expect(existsSync).toHaveBeenCalledWith(mockRepo.path);
      expect(gitMock.clone).toHaveBeenCalledWith(
        mockRepo.cloneUrl,
        mockRepo.path,
        expect.arrayContaining(['--bare', '--config', 'user.name=testuser'])
      );
      expect(gitMock.cwd).toHaveBeenCalledWith({ path: mockRepo.path });
      expect(gitMock.cwd().addConfig).toHaveBeenCalledWith(
        'remote.origin.fetch',
        '+refs/heads/*:refs/heads/*'
      );
    });
  });

  describe('fetchRepository', () => {
    it('should fetch the repository', async () => {
      await fetchRepository(mockRepo, mockOnProgress);

      expect(gitMock.cwd).toHaveBeenCalledWith({ path: mockRepo.path });
      expect(gitMock.fetch).toHaveBeenCalledWith('origin', [
        '--prune',
        '--progress',
      ]);
    });
  });
});
