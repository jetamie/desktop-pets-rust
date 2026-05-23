import { GameModeManager } from './gameMode';
import { calculateTimePosition, getTimePeriodAt, nextEdgeTarget } from './petLogic';
import type { AppConfig, DesktopPetApi, PetConfig } from './types';

export class DesktopPet {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly petContainer: HTMLElement;
  private readonly greetingBubble: HTMLElement;
  private readonly contextMenu: HTMLElement;
  private config!: AppConfig;
  private petConfig!: PetConfig;
  private petAssetsPath = '';
  private gameModeManager!: GameModeManager;
  private currentPet = '';
  private frames: Record<string, HTMLImageElement[]> = {};
  private currentState = 'idle';
  private currentFrame = 0;
  private isMoving = false;
  private moveTargetX = 0;
  private moveTargetY = 0;
  private rotation = 0;
  private flipHorizontal = false;
  private moveSpeed = 3;
  private idleTimer: number | undefined;
  private greetingTimer: number | undefined;
  private greetingHideTimer: number | undefined;
  private hourJumpTimer: number | undefined;
  private petSize = 64;
  private petX = 0;
  private petY = 0;
  private bottomMargin = 20;
  private animationInterval = 150;
  private greetingInterval = 30_000;
  private greetingDuration = 5_000;
  private lastAnimationTime = 0;
  private lastPositionUpdate = 0;
  private currentEdgeIndex = 0;
  private jumpedThisHour = false;

  constructor(private readonly api: DesktopPetApi, documentRef: Document = document) {
    this.canvas = documentRef.getElementById('pet-canvas') as HTMLCanvasElement;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('2D canvas context is unavailable');

    this.context = context;
    this.petContainer = documentRef.getElementById('pet-container') as HTMLElement;
    this.greetingBubble = documentRef.getElementById('greeting-bubble') as HTMLElement;
    this.contextMenu = documentRef.getElementById('context-menu') as HTMLElement;

    this.petContainer.addEventListener('click', (event) => this.onPetClick(event));
    this.petContainer.addEventListener('contextmenu', (event) => this.onRightClick(event));
    documentRef.addEventListener('click', () => this.hideContextMenu());
    documentRef.getElementById('menu-jump')?.addEventListener('click', () => {
      this.doJump();
      this.hideContextMenu();
    });
    documentRef.getElementById('menu-move')?.addEventListener('click', () => {
      this.autoMove();
      this.hideContextMenu();
    });
  }

  async init(): Promise<void> {
    this.config = await this.api.getConfig();
    this.petAssetsPath = await this.api.getPetAssetsPath();
    await this.applyConfig(this.config);

    await this.api.onConfigChanged((config) => {
      void this.applyConfig(config);
    });

    this.startAnimation();
    this.startHourJumpTimer();
  }

  private async applyConfig(config: AppConfig): Promise<void> {
    const nextPet = config.current_pet || 'totoro-v2';
    const shouldReloadPet = this.currentPet !== nextPet || Object.keys(this.frames).length === 0;
    if (shouldReloadPet) {
      const petConfig = await this.api.getPetConfig(nextPet);
      const frames = await this.loadFramesForPet(nextPet, petConfig);
      this.currentPet = nextPet;
      this.petConfig = petConfig;
      this.frames = frames;
      this.currentFrame = 0;
    }

    this.config = config;
    this.petSize = config.pet_size || 64;
    this.moveSpeed = config.move_speed || 3;
    this.bottomMargin = config.bottom_margin || 20;
    this.animationInterval = config.animation_interval_ms || 150;
    this.greetingInterval = (config.interval_seconds || 30) * 1000;
    this.greetingDuration = (config.display_duration_seconds || 5) * 1000;
    this.gameModeManager = new GameModeManager(config);

    this.canvas.width = this.petSize;
    this.canvas.height = this.petSize;
    this.rotation = 0;
    this.flipHorizontal = false;
    this.isMoving = false;
    this.currentState = 'idle';
    this.petY = screen.height - this.petSize - this.bottomMargin;

    const currentMode = this.gameModeManager.getCurrentMode().name;
    if (currentMode === 'timeline') {
      this.petX = this.calculateCurrentTimePosition();
    } else if (currentMode === 'edge') {
      const modeConfig = this.gameModeManager.getModeConfig('edge');
      const path = typeof modeConfig.config?.path === 'string' ? modeConfig.config.path : 'right->bottom->left->top->right';
      const firstSegment = path.split('->')[0];
      const target = nextEdgeTarget(firstSegment, screen.width, screen.height, this.petSize, this.bottomMargin);
      this.petX = target.x;
      this.petY = target.y;
      this.rotation = target.rotation;
      this.currentEdgeIndex = 1;
    } else {
      this.petX = Math.min(Math.max(this.petX || screen.width - this.petSize - 20, 0), screen.width - this.petSize);
      this.petY = Math.min(Math.max(this.petY, 0), screen.height - this.petSize - this.bottomMargin);
    }

    await this.api.setWindowPosition(this.petX, this.petY);
    this.startIdleTimer();
    this.startGreetingTimer();
    this.draw();
  }

  private async loadFramesForPet(petName: string, petConfig: PetConfig): Promise<Record<string, HTMLImageElement[]>> {
    const frames: Record<string, HTMLImageElement[]> = {};
    for (const [state, frameFiles] of Object.entries(petConfig.frames || {})) {
      frames[state] = [];
      for (const frameFile of frameFiles) {
        const image = new Image();
        const imagePath = `${this.petAssetsPath}/${petName}/${frameFile}`;
        image.src = this.api.convertFileSrc(imagePath);
        const loaded = await new Promise<boolean>((resolve) => {
          image.onload = () => resolve(true);
          image.onerror = () => resolve(false);
        });
        if (loaded) frames[state].push(image);
      }
    }
    return frames;
  }

  private startAnimation(): void {
    this.lastAnimationTime = performance.now();
    this.lastPositionUpdate = this.lastAnimationTime;
    this.animate();
  }

  private animate(): void {
    const now = performance.now();
    if (now - this.lastAnimationTime >= this.animationInterval) {
      this.updateFrame();
      this.lastAnimationTime = now;
    }
    requestAnimationFrame(() => this.animate());
  }

  private updateFrame(): void {
    const stateFrames = this.frames[this.currentState] || this.frames.idle || [];
    if (stateFrames.length > 0) {
      this.currentFrame = (this.currentFrame + 1) % stateFrames.length;
      this.draw();
    }

    if (this.isMoving) {
      if (this.gameModeManager.getCurrentMode().name === 'timeline') {
        this.moveTargetX = this.calculateCurrentTimePosition();
      }
      void this.moveTowardsTarget();
    }
  }

  private draw(): void {
    const stateFrames = this.frames[this.currentState] || this.frames.idle || [];
    this.context.clearRect(0, 0, this.petSize, this.petSize);

    if (stateFrames.length === 0) {
      this.context.fillStyle = 'rgba(255, 165, 0, 0.5)';
      this.context.fillRect(0, 0, this.petSize, this.petSize);
      return;
    }

    const currentImage = stateFrames[this.currentFrame];
    if (!currentImage?.complete) return;

    if (this.rotation !== 0 || this.flipHorizontal) {
      this.context.save();
      this.context.translate(this.petSize / 2, this.petSize / 2);
      if (this.flipHorizontal) this.context.scale(-1, 1);
      if (this.rotation !== 0) this.context.rotate((this.rotation * Math.PI) / 180);
      this.context.drawImage(currentImage, -this.petSize / 2, -this.petSize / 2, this.petSize, this.petSize);
      this.context.restore();
    } else {
      this.context.drawImage(currentImage, 0, 0, this.petSize, this.petSize);
    }
  }

  private onPetClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.doJump();
  }

  private onRightClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.showContextMenu(event.clientX, event.clientY);
  }

  private showContextMenu(x: number, y: number): void {
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    this.contextMenu.style.display = 'block';
  }

  private hideContextMenu(): void {
    this.contextMenu.style.display = 'none';
  }

  private doJump(): void {
    if (this.currentState === 'jump') return;
    const currentMode = this.gameModeManager.getCurrentMode().name;
    if (currentMode === 'edge') return;

    this.currentState = 'jump';
    this.currentFrame = 0;
    this.isMoving = false;

    if (currentMode === 'timeline') {
      this.moveTargetX = this.calculateCurrentTimePosition();
      this.moveTargetY = screen.height - this.petSize - this.bottomMargin;
    } else {
      const targetX = Math.random() * (screen.width - this.petSize);
      const targetY = Math.random() * (screen.height - this.petSize - this.bottomMargin);
      this.setHorizontalDirection(targetX - this.petX);
      this.moveTargetX = targetX;
      this.moveTargetY = targetY;
    }

    window.setTimeout(() => {
      this.currentState = this.frames.walk?.length ? 'walk' : 'idle';
      this.isMoving = this.currentState === 'walk';
    }, 500);
  }

  private async moveTowardsTarget(): Promise<void> {
    const dx = this.moveTargetX - this.petX;
    const dy = this.moveTargetY - this.petY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < this.moveSpeed) {
      this.petX = this.moveTargetX;
      this.petY = this.moveTargetY;
      await this.api.setWindowPosition(this.petX, this.petY);
      const currentMode = this.gameModeManager.getCurrentMode().name;

      if (currentMode === 'timeline') {
        this.moveTargetX = this.calculateCurrentTimePosition();
        this.isMoving = true;
        this.currentState = 'walk';
      } else if (currentMode === 'edge' && this.currentState !== 'jump') {
        this.edgeModeMove();
      } else {
        this.isMoving = false;
        this.currentState = 'idle';
      }
      return;
    }

    this.petX += (dx / distance) * this.moveSpeed;
    this.petY += (dy / distance) * this.moveSpeed;

    const now = performance.now();
    if (now - this.lastPositionUpdate >= 16) {
      await this.api.setWindowPosition(this.petX, this.petY);
      this.lastPositionUpdate = now;
    }
    this.updateBubblePosition();
  }

  private startIdleTimer(): void {
    if (this.idleTimer) window.clearInterval(this.idleTimer);
    this.idleTimer = window.setInterval(() => this.autoMove(), this.config.idle_timeout_seconds * 1000);
  }

  private autoMove(): void {
    if (this.isMoving || this.currentState === 'jump') return;
    const currentMode = this.gameModeManager.getCurrentMode();

    if (currentMode.name === 'timeline') {
      this.timeModeMove();
    } else if (currentMode.name === 'edge') {
      this.edgeModeMove();
    } else {
      this.wanderModeMove();
    }
  }

  private wanderModeMove(): void {
    this.currentState = 'walk';
    this.isMoving = true;
    const targetX = Math.random() * (screen.width - this.petSize);
    const targetY = Math.random() * (screen.height - this.petSize - this.bottomMargin);
    this.setHorizontalDirection(targetX - this.petX);
    this.moveTargetX = targetX;
    this.moveTargetY = targetY;
  }

  private timeModeMove(): void {
    const targetX = this.calculateCurrentTimePosition();
    this.rotation = targetX - this.petX > 10 ? 180 : 0;
    this.currentState = 'walk';
    this.isMoving = true;
    this.moveTargetX = targetX;
    this.moveTargetY = screen.height - this.petSize - this.bottomMargin;
  }

  private edgeModeMove(): void {
    const modeConfig = this.gameModeManager.getModeConfig('edge');
    const path = typeof modeConfig.config?.path === 'string' ? modeConfig.config.path : 'right->bottom->left->top->right';
    const pathSegments = path.split('->');
    const target = nextEdgeTarget(pathSegments[this.currentEdgeIndex], screen.width, screen.height, this.petSize, this.bottomMargin);

    this.currentState = 'walk';
    this.isMoving = true;
    this.rotation = target.rotation;
    this.moveTargetX = target.x;
    this.moveTargetY = target.y;
    this.currentEdgeIndex = (this.currentEdgeIndex + 1) % pathSegments.length;
  }

  private calculateCurrentTimePosition(): number {
    const schedule = this.config.game_modes.schedules.find((item) => item.mode === 'timeline');
    const now = new Date();
    return calculateTimePosition({
      hour: now.getHours(),
      minute: now.getMinutes(),
      screenWidth: screen.width,
      petSize: this.petSize,
      startTime: schedule?.start_time || '08:00',
      endTime: schedule?.end_time || '18:00',
    });
  }

  private setHorizontalDirection(dx: number): void {
    if (dx > 10) this.flipHorizontal = true;
    if (dx < -10) this.flipHorizontal = false;
  }

  private startGreetingTimer(): void {
    if (this.greetingTimer) window.clearInterval(this.greetingTimer);
    this.greetingTimer = window.setInterval(() => this.showRandomGreeting(), this.greetingInterval);
  }

  private startHourJumpTimer(): void {
    if (this.hourJumpTimer) window.clearInterval(this.hourJumpTimer);
    this.hourJumpTimer = window.setInterval(() => this.checkHourJump(), 1000);
  }

  private checkHourJump(): void {
    const now = new Date();
    if (now.getMinutes() === 0 && now.getSeconds() < 5 && !this.jumpedThisHour) {
      this.doJump();
      this.jumpedThisHour = true;
    } else if (now.getMinutes() !== 0) {
      this.jumpedThisHour = false;
    }
  }

  private showRandomGreeting(): void {
    const now = new Date();
    const period = getTimePeriodAt(now.getHours(), now.getMinutes());
    const greetings = this.config.greetings[period] || this.config.greetings.morning || [];
    if (greetings.length === 0) return;

    this.greetingBubble.textContent = greetings[Math.floor(Math.random() * greetings.length)];
    this.greetingBubble.style.display = 'block';
    this.updateBubblePosition();

    if (this.greetingHideTimer) window.clearTimeout(this.greetingHideTimer);
    this.greetingHideTimer = window.setTimeout(() => {
      this.greetingBubble.style.display = 'none';
    }, this.greetingDuration);
  }

  private updateBubblePosition(): void {
    const scale = this.petSize / 150;
    this.greetingBubble.style.fontSize = `${12 * scale}px`;
    this.greetingBubble.style.padding = `${6 * scale}px ${10 * scale}px`;
    this.greetingBubble.style.borderRadius = `${6 * scale}px`;
    this.greetingBubble.style.maxWidth = `${150 * scale}px`;
    this.greetingBubble.style.left = `${this.petSize / 2 - 75 * scale}px`;
    this.greetingBubble.style.top = `${5 * scale}px`;
    this.greetingBubble.style.setProperty('--arrow-size', `${6 * scale}px`);
  }
}
