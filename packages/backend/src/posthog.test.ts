import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captureEvent, posthog } from './posthog';
import { PostHog } from 'posthog-node';
import { SOURCEBOT_TELEMETRY_DISABLED, POSTHOG_PAPIK, SOURCEBOT_INSTALL_ID, SOURCEBOT_VERSION } from './environment';
import { PosthogEventMap } from './posthogEvents';

vi.mock('posthog-node', () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: vi.fn(),
    shutdown: vi.fn(),
  })),
}));

vi.mock('./environment', () => ({
  POSTHOG_HOST: 'https://app.posthog.com',
  POSTHOG_PAPIK: 'test-api-key',
  SOURCEBOT_INSTALL_ID: 'test-install-id',
  SOURCEBOT_TELEMETRY_DISABLED: false,
  SOURCEBOT_VERSION: '1.0.0',
}));

describe('captureEvent', () => {
  const mockPostHogInstance = vi.mocked(new PostHog('test-api-key', { host: 'https://app.posthog.com' }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not capture event if telemetry is disabled', () => {
    vi.mocked(SOURCEBOT_TELEMETRY_DISABLED).value = true;

    captureEvent('test_event', { prop1: 'value1' });

    expect(mockPostHogInstance.capture).not.toHaveBeenCalled();
  });

  it('should capture event with correct properties when telemetry is enabled', () => {
    vi.mocked(SOURCEBOT_TELEMETRY_DISABLED).value = false;

    captureEvent('test_event', { prop1: 'value1' });

    expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
      distinctId: 'test-install-id',
      event: 'test_event',
      properties: {
        prop1: 'value1',
        sourcebot_version: '1.0.0',
      },
    });
  });

  it('should not throw error if posthog is undefined', () => {
    vi.mocked(POSTHOG_PAPIK).value = undefined;

    expect(() => captureEvent('test_event', { prop1: 'value1' })).not.toThrow();
  });
});
