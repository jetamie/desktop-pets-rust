export interface AppConfig {
  current_pet: string;
  current_mode?: string | null;
  interval_seconds: number;
  display_duration_seconds: number;
  move_speed: number;
  idle_timeout_seconds: number;
  pet_size: number;
  bottom_margin: number;
  animation_interval_ms: number;
  game_modes: GameModesConfig;
  greetings: GreetingsConfig;
}

export interface EditableConfig {
  current_pet: string;
  interval_seconds: number;
  move_speed: number;
  pet_size: number;
  current_mode?: string | null;
  game_modes: GameModesConfig;
}

export interface GameModesConfig {
  default: string;
  schedules: GameModeSchedule[];
  modes: Record<string, GameModeDefinition>;
}

export interface GameModeSchedule {
  mode: string;
  start_time: string;
  end_time: string;
}

export interface GameModeDefinition {
  name: string;
  description: string;
  config?: Record<string, unknown>;
}

export interface CurrentMode {
  name: string;
  config: GameModeDefinition;
}

export interface GreetingsConfig {
  morning: string[];
  noon: string[];
  afternoon: string[];
  evening: string[];
  night: string[];
}

export interface PetConfig {
  name: string;
  size: number;
  frames: Record<string, string[]>;
}

export interface DesktopPetApi {
  getConfig(): Promise<AppConfig>;
  getEditableConfig(): Promise<EditableConfig>;
  saveConfig(config: EditableConfig): Promise<AppConfig>;
  onConfigChanged(callback: (config: AppConfig) => void): Promise<() => void>;
  getPetConfig(petName: string): Promise<PetConfig>;
  getPetAssetsPath(): Promise<string>;
  quitApp(): Promise<void>;
  setWindowPosition(x: number, y: number): Promise<void>;
  convertFileSrc(path: string): string;
}
