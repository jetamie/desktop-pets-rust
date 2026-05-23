import './style.css';
import { renderConfigPanel } from './configPanel';
import { DesktopPet } from './desktopPet';
import { tauriApi } from './tauriApi';

window.addEventListener('DOMContentLoaded', () => {
  const view = new URLSearchParams(window.location.search).get('view');
  if (view === 'config') {
    void renderConfigPanel(tauriApi);
    return;
  }

  const pet = new DesktopPet(tauriApi);
  void pet.init();
});
