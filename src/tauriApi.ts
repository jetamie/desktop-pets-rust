import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { AppConfig, DesktopPetApi, EditableConfig, PetConfig } from './types';

export const tauriApi: DesktopPetApi = {
  getConfig: () => invoke<AppConfig>('get_config'),
  getEditableConfig: () => invoke<EditableConfig>('get_editable_config'),
  saveConfig: (config: EditableConfig) => invoke<AppConfig>('save_config', { config }),
  onConfigChanged: async (callback: (config: AppConfig) => void) => {
    const unlisten = await listen<AppConfig>('config-changed', (event) => callback(event.payload));
    return unlisten;
  },
  getPetConfig: (petName: string) => invoke<PetConfig>('get_pet_config', { petName }),
  getPetAssetsPath: () => invoke<string>('get_pet_assets_path'),
  quitApp: () => invoke<void>('quit_app'),
  setWindowPosition: (x: number, y: number) => invoke<void>('set_window_position', { x, y }),
  convertFileSrc: (path: string) => convertFileSrc(path),
};
