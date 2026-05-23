import { describe, expect, it } from 'vitest';
import { GameModeManager, timeToMinutes } from './gameMode';
import type { AppConfig } from './types';

const config: AppConfig = {
  current_pet: 'totoro-v2',
  interval_seconds: 20,
  display_duration_seconds: 3,
  move_speed: 5,
  idle_timeout_seconds: 5,
  pet_size: 200,
  bottom_margin: 50,
  animation_interval_ms: 300,
  game_modes: {
    default: 'wander',
    schedules: [
      { mode: 'edge', start_time: '08:00', end_time: '18:00' },
      { mode: 'timeline', start_time: '18:00', end_time: '22:00' },
    ],
    modes: {
      wander: { name: '闲逛模式', description: '宠物在屏幕上随机移动' },
      edge: { name: '边路模式', description: '宠物沿着屏幕边缘移动', config: { path: 'right->bottom' } },
      timeline: { name: '时间轴模式', description: '宠物根据实时时间移动' },
    },
  },
  greetings: { morning: [], noon: [], afternoon: [], evening: [], night: [] },
};

describe('timeToMinutes', () => {
  it('converts HH:mm strings to minutes', () => {
    expect(timeToMinutes('08:30')).toBe(510);
  });
});

describe('GameModeManager', () => {
  it('uses scheduled mode when current time is in range', () => {
    const manager = new GameModeManager(config);

    expect(manager.getCurrentModeAt(9, 0).name).toBe('edge');
    expect(manager.getCurrentModeAt(19, 0).name).toBe('timeline');
  });

  it('falls back to default mode outside schedules', () => {
    const manager = new GameModeManager(config);

    expect(manager.getCurrentModeAt(23, 0).name).toBe('wander');
  });


  it('uses current mode override before schedules', () => {
    const manager = new GameModeManager({ ...config, current_mode: 'wander' });

    expect(manager.getCurrentModeAt(9, 0).name).toBe('wander');
  });

  it('ignores invalid current mode override', () => {
    const manager = new GameModeManager({ ...config, current_mode: 'missing' });

    expect(manager.getCurrentModeAt(9, 0).name).toBe('edge');
  });
});
