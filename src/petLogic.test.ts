import { describe, expect, it } from 'vitest';
import { calculateTimePosition, getTimePeriodAt, nextEdgeTarget } from './petLogic';

describe('getTimePeriodAt', () => {
  it('matches the original greeting periods', () => {
    expect(getTimePeriodAt(4, 59)).toBe('night');
    expect(getTimePeriodAt(9, 0)).toBe('morning');
    expect(getTimePeriodAt(12, 0)).toBe('noon');
    expect(getTimePeriodAt(15, 0)).toBe('afternoon');
    expect(getTimePeriodAt(19, 0)).toBe('evening');
    expect(getTimePeriodAt(22, 0)).toBe('night');
  });
});

describe('calculateTimePosition', () => {
  it('places pet on the right before work start', () => {
    expect(calculateTimePosition({ hour: 7, minute: 30, screenWidth: 1000, petSize: 200, startTime: '08:00', endTime: '18:00' })).toBe(780);
  });

  it('places pet halfway across at schedule midpoint', () => {
    expect(calculateTimePosition({ hour: 13, minute: 0, screenWidth: 1000, petSize: 200, startTime: '08:00', endTime: '18:00' })).toBe(390);
  });

  it('places pet at the left after work end', () => {
    expect(calculateTimePosition({ hour: 19, minute: 0, screenWidth: 1000, petSize: 200, startTime: '08:00', endTime: '18:00' })).toBe(0);
  });
});

describe('nextEdgeTarget', () => {
  it('uses the right-bottom corner as the first edge target', () => {
    const target = nextEdgeTarget('right', 2048, 1152, 200, 50);

    expect(target).toEqual({ x: 1848, y: 902, rotation: 0 });
  });

  it('returns targets and rotations for edge path segments', () => {
    expect(nextEdgeTarget('right', 1000, 800, 200, 50)).toEqual({ x: 800, y: 550, rotation: 0 });
    expect(nextEdgeTarget('bottom', 1000, 800, 200, 50)).toEqual({ x: 0, y: 550, rotation: 0 });
    expect(nextEdgeTarget('left', 1000, 800, 200, 50)).toEqual({ x: 0, y: 0, rotation: 90 });
    expect(nextEdgeTarget('top', 1000, 800, 200, 50)).toEqual({ x: 800, y: 0, rotation: 180 });
    expect(nextEdgeTarget('top_to_right', 1000, 800, 200, 50)).toEqual({ x: 800, y: 550, rotation: 270 });
  });
});
