// Import necessary types
import { InputState } from '../types';

export class InputManager {
  private keys: { [key: string]: boolean } = {};
  private mouseDeltaX: number = 0;
  private mouseDeltaY: number = 0;
  private mouseX: number = 0;
  private mouseY: number = 0;
  private isPointerLocked: boolean = false;
  private wheelDelta: number = 0;
  
  constructor(private element: HTMLElement) {
    // Set up keyboard event listeners
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
    
    // Set up mouse event listeners for camera control
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('wheel', this.handleMouseWheel.bind(this));
    
    // Handle pointer lock for camera rotation
    this.element.addEventListener('click', this.requestPointerLock.bind(this));
    document.addEventListener('pointerlockchange', this.handlePointerLockChange.bind(this));
  }
  
  private handleKeyDown(event: KeyboardEvent): void {
    this.keys[event.code] = true;
  }
  
  private handleKeyUp(event: KeyboardEvent): void {
    this.keys[event.code] = false;
  }
  
  private handleMouseMove(event: MouseEvent): void {
    // Store absolute mouse position
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;
    
    if (this.isPointerLocked) {
      this.mouseDeltaX = event.movementX;
      this.mouseDeltaY = event.movementY;
    }
  }
  
  private handleMouseWheel(event: WheelEvent): void {
    // Normalize the wheel delta across browsers
    const delta = Math.sign(event.deltaY);
    this.wheelDelta = delta;
    
    // Prevent page scrolling when zooming
    if (this.isPointerLocked) {
      event.preventDefault();
    }
  }
  
  private requestPointerLock(): void {
    this.element.requestPointerLock();
  }
  
  private handlePointerLockChange(): void {
    this.isPointerLocked = document.pointerLockElement === this.element;
  }
  
  // Get the current input state
  getInput(): InputState {
    const input: InputState = {
      forward: this.keys['KeyW'] || this.keys['ArrowUp'] || false,
      backward: this.keys['KeyS'] || this.keys['ArrowDown'] || false,
      left: this.keys['KeyA'] || this.keys['ArrowLeft'] || false,
      right: this.keys['KeyD'] || this.keys['ArrowRight'] || false,
      jump: this.keys['Space'] || false,
      action: this.keys['KeyE'] || this.keys['Enter'] || false,
      peck: this.keys['KeyF'] || this.keys['Mouse0'] || false,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      mouseDeltaX: this.mouseDeltaX,
      mouseDeltaY: this.mouseDeltaY,
      isPointerLocked: this.isPointerLocked,
      wheelDelta: this.wheelDelta
    };
    
    // Reset mouse deltas after reading
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.wheelDelta = 0;
    
    return input;
  }
  
  // Clean up event listeners
  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));
    document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    document.removeEventListener('wheel', this.handleMouseWheel.bind(this));
    this.element.removeEventListener('click', this.requestPointerLock.bind(this));
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange.bind(this));
  }
} 