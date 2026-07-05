// src/app/core/constants/note-colors.ts
// Shared note-color palette — mapped onto the app's existing --rm-* theme
// tokens rather than arbitrary hex, so note swatches never introduce a new color.

export type NoteHue = 'none' | 'yellow' | 'pink' | 'blue' | 'green' | 'purple';

export const HUES: Record<NoteHue, { bar: string }> = {
  none: { bar: 'var(--rm-border)' },
  yellow: { bar: 'var(--rm-warning)' },
  pink: { bar: 'var(--rm-danger)' },
  blue: { bar: 'var(--rm-purple)' },
  green: { bar: 'var(--rm-success)' },
  purple: { bar: 'var(--rm-info)' },
};

export const HUE_KEYS: NoteHue[] = ['none', 'yellow', 'pink', 'blue', 'green', 'purple'];
