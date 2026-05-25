import type { AppConfig, DesktopPetApi, EditableConfig, GameModeSchedule } from './types';

const PET_OPTIONS = ['cat', 'totoro', 'totoro-v2', 'coal-balls'];
const DEFAULT_PET = 'coal-balls';

function toEditableConfig(config: AppConfig): EditableConfig {
  return {
    current_pet: PET_OPTIONS.includes(config.current_pet) ? config.current_pet : DEFAULT_PET,
    interval_seconds: config.interval_seconds,
    move_speed: config.move_speed,
    pet_size: config.pet_size,
    current_mode: config.current_mode ?? null,
    game_modes: config.game_modes,
  };
}

function createNumberInput(value: number, min: number, max: number, step: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = String(min);
  input.max = String(max);
  input.step = step;
  input.value = String(value);
  return input;
}

function createPetSelect(value: string): HTMLSelectElement {
  const select = document.createElement('select');
  const selectedPet = PET_OPTIONS.includes(value) ? value : DEFAULT_PET;
  for (const pet of PET_OPTIONS) {
    const option = document.createElement('option');
    option.value = pet;
    option.textContent = pet;
    option.selected = pet === selectedPet;
    select.appendChild(option);
  }
  return select;
}

function createModeSelect(modes: string[], value: string): HTMLSelectElement {
  const select = document.createElement('select');
  for (const mode of modes) {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = mode;
    option.selected = mode === value;
    select.appendChild(option);
  }
  return select;
}

function createScheduleRow(
  schedule: GameModeSchedule,
  modes: string[],
  onRemove: () => void,
): { element: HTMLElement; getValue: () => GameModeSchedule } {
  const row = document.createElement('div');
  row.className = 'schedule-row';

  const mode = createModeSelect(modes, schedule.mode || modes[0] || 'wander');
  const startTime = document.createElement('input');
  startTime.type = 'time';
  startTime.value = schedule.start_time || '08:00';

  const endTime = document.createElement('input');
  endTime.type = 'time';
  endTime.value = schedule.end_time || '18:00';

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'secondary-button';
  removeButton.textContent = '删除';
  removeButton.addEventListener('click', onRemove);

  row.append(mode, startTime, endTime, removeButton);

  return {
    element: row,
    getValue: () => ({ mode: mode.value, start_time: startTime.value, end_time: endTime.value }),
  };
}

export async function renderConfigPanel(api: DesktopPetApi): Promise<void> {
  document.body.className = 'config-view';
  document.body.textContent = '';

  const panel = document.createElement('main');
  panel.className = 'config-panel';

  const title = document.createElement('h1');
  title.textContent = '桌宠配置';

  const form = document.createElement('form');
  form.className = 'config-form';

  const status = document.createElement('div');
  status.className = 'config-status';

  panel.append(title, form, status);
  document.body.appendChild(panel);

  let config: EditableConfig;
  try {
    config = await api.getEditableConfig();
  } catch (error) {
    status.className = 'config-status error';
    status.textContent = error instanceof Error ? error.message : String(error);
    return;
  }

  let scheduleRows: Array<{ element: HTMLElement; getValue: () => GameModeSchedule }> = [];

  const renderForm = () => {
    form.textContent = '';
    scheduleRows = [];
    const modes = Object.keys(config.game_modes.modes);

    const currentPet = createPetSelect(config.current_pet);
    const intervalSeconds = createNumberInput(config.interval_seconds, 1, 3600, '1');
    const moveSpeed = createNumberInput(config.move_speed, 0.1, 50, '0.1');
    const petSize = createNumberInput(config.pet_size, 32, 512, '1');

    const currentMode = document.createElement('select');
    const autoOption = document.createElement('option');
    autoOption.value = '';
    autoOption.textContent = '自动（按调度）';
    autoOption.selected = !config.current_mode;
    currentMode.appendChild(autoOption);
    for (const mode of modes) {
      const option = document.createElement('option');
      option.value = mode;
      option.textContent = mode;
      option.selected = config.current_mode === mode;
      currentMode.appendChild(option);
    }

    const fields: Array<[string, HTMLElement]> = [
      ['当前宠物', currentPet],
      ['问候间隔（秒）', intervalSeconds],
      ['移动速度', moveSpeed],
      ['宠物尺寸', petSize],
      ['当前模式', currentMode],
    ];

    for (const [labelText, control] of fields) {
      const label = document.createElement('label');
      label.className = 'config-field';
      const span = document.createElement('span');
      span.textContent = labelText;
      label.append(span, control);
      form.appendChild(label);
    }

    const schedulesTitle = document.createElement('h2');
    schedulesTitle.textContent = '调度规则';
    form.appendChild(schedulesTitle);

    const scheduleList = document.createElement('div');
    scheduleList.className = 'schedule-list';
    form.appendChild(scheduleList);

    const addScheduleRow = (schedule: GameModeSchedule) => {
      const row = createScheduleRow(schedule, modes, () => {
        row.element.remove();
        scheduleRows = scheduleRows.filter((item) => item !== row);
      });
      scheduleRows.push(row);
      scheduleList.appendChild(row.element);
    };

    for (const schedule of config.game_modes.schedules) {
      addScheduleRow(schedule);
    }

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'secondary-button';
    addButton.textContent = '新增调度';
    addButton.addEventListener('click', () => {
      addScheduleRow({ mode: modes[0] || config.game_modes.default, start_time: '08:00', end_time: '18:00' });
    });

    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.className = 'primary-button';
    saveButton.textContent = '保存并应用';

    const actions = document.createElement('div');
    actions.className = 'config-actions';
    actions.append(addButton, saveButton);
    form.appendChild(actions);

    form.onsubmit = async (event) => {
      event.preventDefault();
      status.className = 'config-status';
      status.textContent = '保存中...';

      try {
        const saved = await api.saveConfig({
          current_pet: currentPet.value,
          interval_seconds: Number(intervalSeconds.value),
          move_speed: Number(moveSpeed.value),
          pet_size: Number(petSize.value),
          current_mode: currentMode.value || null,
          game_modes: {
            ...config.game_modes,
            schedules: scheduleRows.map((row) => row.getValue()),
          },
        });
        config = toEditableConfig(saved);
        status.className = 'config-status success';
        status.textContent = '已保存并应用';
        renderForm();
      } catch (error) {
        status.className = 'config-status error';
        status.textContent = error instanceof Error ? error.message : String(error);
      }
    };
  };

  renderForm();

  void api.onConfigChanged((nextConfig) => {
    config = toEditableConfig(nextConfig);
    renderForm();
  }).catch(() => undefined);
}
