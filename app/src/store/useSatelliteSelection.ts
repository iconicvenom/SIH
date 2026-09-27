import { create } from 'zustand';
import type { SpacecraftId } from '../data/spacecraft';

export const useSatelliteSelection = create<{
  selected: SpacecraftId;
  select: (id: SpacecraftId) => void;
}>(set => ({ selected: 'sentinel-2b', select: selected => set({ selected }) }));
