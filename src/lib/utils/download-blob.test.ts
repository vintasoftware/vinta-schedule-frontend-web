import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBlob, slugifyFilename } from './download-blob';

describe('slugifyFilename', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyFilename('Team Sync Meeting')).toBe('team-sync-meeting');
  });

  it('strips diacritics', () => {
    expect(slugifyFilename('Café Réunion')).toBe('cafe-reunion');
  });

  it('collapses runs of separators and trims hyphens', () => {
    expect(slugifyFilename('  Hello -- World!!  ')).toBe('hello-world');
  });

  it('falls back when the slug is empty', () => {
    expect(slugifyFilename('!!!', 'event-42')).toBe('event-42');
    expect(slugifyFilename('')).toBe('download');
  });
});

describe('downloadBlob', () => {
  const createObjectURL = vi.fn(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('creates an object URL and clicks an anchor with the download attribute', () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    const blob = new Blob(['BEGIN:VCALENDAR'], { type: 'text/calendar' });
    downloadBlob(blob, 'team-sync.ics');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('team-sync.ics');
    expect(anchor.getAttribute('href')).toBe('blob:mock-url');
    // Anchor is removed after the click.
    expect(document.body.contains(anchor)).toBe(false);

    clickSpy.mockRestore();
  });

  it('revokes the object URL on the next tick', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlob(new Blob(['x']), 'x.ics');
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
