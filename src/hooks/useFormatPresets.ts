import { useCallback, useEffect, useMemo, useState } from 'react';
import { localStorage as storage } from '../utils/storage';

export interface FormatPreset {
  id: string;
  name: string;
  prompt: string;
  isCustom?: boolean;
}

interface StoredPreset {
  id: string;
  name: string;
  prompt: string;
}

const createPresetId = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return `custom-${window.crypto.randomUUID()}`;
  }
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
};

const toStoredPresets = (presets: FormatPreset[]): StoredPreset[] =>
  presets.map(({ id, name, prompt }) => ({ id, name, prompt }));

const fromStoredPresets = (presets: StoredPreset[]): FormatPreset[] =>
  presets.map((preset) => ({ ...preset, isCustom: true }));

export function useFormatPresets(basePresets: FormatPreset[] = []) {
  const [customPresets, setCustomPresets] = useState<FormatPreset[]>([]);

  useEffect(() => {
    const stored = storage.getSummaryPromptPresets();
    if (stored.length > 0) {
      setCustomPresets(fromStoredPresets(stored));
    }
  }, []);

  const persistCustomPresets = useCallback((presets: FormatPreset[]) => {
    storage.saveSummaryPromptPresets(toStoredPresets(presets));
  }, []);

  const addCustomPreset = useCallback((name: string, prompt: string): FormatPreset => {
    const trimmedName = name.trim();
    const trimmedPrompt = prompt.trim();
    if (!trimmedName || !trimmedPrompt) {
      throw new Error('プリセット名とプロンプトを入力してください');
    }
    const created: FormatPreset = { id: createPresetId(), name: trimmedName, prompt: trimmedPrompt, isCustom: true };
    setCustomPresets((prev) => {
      const next = [...prev, created];
      persistCustomPresets(next);
      return next;
    });
    return created;
  }, [persistCustomPresets]);

  const removeCustomPreset = useCallback((id: string) => {
    setCustomPresets((prev) => {
      const next = prev.filter((preset) => preset.id !== id);
      persistCustomPresets(next);
      return next;
    });
  }, [persistCustomPresets]);

  const updateCustomPreset = useCallback((id: string, updates: { name?: string; prompt?: string }): FormatPreset => {
    let updatedPreset: FormatPreset | null = null;
    setCustomPresets((prev) => {
      const index = prev.findIndex((preset) => preset.id === id);
      if (index === -1) {
        updatedPreset = null;
        return prev;
      }
      const next = [...prev];
      const current = next[index];
      const updated: FormatPreset = {
        ...current,
        name: updates.name !== undefined ? updates.name.trim() : current.name,
        prompt: updates.prompt !== undefined ? updates.prompt.trim() : current.prompt
      };
      if (!updated.name || !updated.prompt) {
        throw new Error('プリセット名とプロンプトは必須です');
      }
      next[index] = updated;
      updatedPreset = updated;
      persistCustomPresets(next);
      return next;
    });
    if (!updatedPreset) {
      throw new Error('指定したプリセットが見つかりませんでした');
    }
    return updatedPreset;
  }, [persistCustomPresets]);

  const presets = useMemo(() => {
    const base = Array.isArray(basePresets) ? basePresets : [];
    return [...base, ...customPresets];
  }, [basePresets, customPresets]);

  return {
    presets,
    customPresets,
    addCustomPreset,
    removeCustomPreset,
    updateCustomPreset,
  };
}
