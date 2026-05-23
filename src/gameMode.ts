import type { AppConfig, CurrentMode, GameModeDefinition } from './types';

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export class GameModeManager {
  private readonly currentMode: string | null;
  private readonly defaultMode: string;
  private readonly schedules;
  private readonly modes;

  constructor(config: AppConfig) {
    this.currentMode = config.current_mode && config.game_modes.modes[config.current_mode] ? config.current_mode : null;
    this.defaultMode = config.game_modes.default || 'wander';
    this.schedules = config.game_modes.schedules || [];
    this.modes = config.game_modes.modes || {};
  }

  getCurrentMode(): CurrentMode {
    const now = new Date();
    return this.getCurrentModeAt(now.getHours(), now.getMinutes());
  }

  getCurrentModeAt(hours: number, minutes: number): CurrentMode {
    if (this.currentMode) {
      return { name: this.currentMode, config: this.getModeConfig(this.currentMode) };
    }

    const currentMinutes = hours * 60 + minutes;

    for (const schedule of this.schedules) {
      const startMinutes = timeToMinutes(schedule.start_time);
      const endMinutes = timeToMinutes(schedule.end_time);

      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return { name: schedule.mode, config: this.getModeConfig(schedule.mode) };
      }
    }

    return { name: this.defaultMode, config: this.getModeConfig(this.defaultMode) };
  }

  getModeConfig(modeName: string): GameModeDefinition {
    return this.modes[modeName] || { name: modeName, description: '' };
  }
}
