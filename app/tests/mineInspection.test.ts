import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MINES } from '../src/data/mines';

// The development store publishes its browser-only verification handle at import time.
vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
const { useDrishti } = await import('../src/store/useDrishti');
afterAll(() => vi.unstubAllGlobals());
const point = { gx: 190, gz: 200, lon: 80.13, lat: 21.79, y: 72 };

describe('inspecting terrain around a selected mine', () => {
  beforeEach(() => useDrishti.setState({ selectedMine: null, selectedCell: null, view: 'RELIEF', transitioning: false }));

  it.each(MINES)('keeps $name as the camera pivot when a spot is inspected', mine => {
    useDrishti.getState().selectMine(mine.id);
    useDrishti.getState().selectCell(point);
    expect(useDrishti.getState().selectedMine).toBe(mine.id);
    expect(useDrishti.getState().selectedCell).toEqual(point);
    expect(useDrishti.getState().transitioning).toBe(false);
  });

  it('clears the old inspected spot when another mine is selected', () => {
    useDrishti.getState().selectMine('balaghat');
    useDrishti.getState().selectCell(point);
    useDrishti.getState().selectMine('kandri');
    expect(useDrishti.getState().selectedMine).toBe('kandri');
    expect(useDrishti.getState().selectedCell).toBeNull();
  });

  it('keeps the current mine when just the inspected spot is cleared', () => {
    useDrishti.getState().selectMine('balaghat');
    useDrishti.getState().selectCell(point);
    useDrishti.getState().selectCell(null);
    expect(useDrishti.getState().selectedMine).toBe('balaghat');
    expect(useDrishti.getState().selectedCell).toBeNull();
  });
});
