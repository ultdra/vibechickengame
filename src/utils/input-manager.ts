import { InputState } from '../types';

export class InputManager {
  private inputState: InputState;
  private domElement: HTMLElement;
  private isPointerLocked: boolean;
  private previousMouseX: number;
  private previousMouseY: number;
  
  constructor(domElement: HTMLElement) {
    this.domElement = domElement;
    this.isPointerLocked = false;
    this.previousMouseX = 0;
    this.previousMouseY = 0;
    
    // Initialize input state
    this.inputState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      action: false,
      mouseX: 0,
      mouseY: 0,
      mouseDeltaX: 0,
      mouseDeltaY: 0,
      isPointerLocked: false
    };
    
    // Bind event listeners
    this.bindEventListeners();
  }
  
  // Get the current input state
  getInputState(): InputState {
    const result = { ...this.inputState };
    
    // Reset mouse deltas after reading them
    this.inputState.mouseDeltaX = 0;
    this.inputState.mouseDeltaY = 0;
    
    return result;
  }
  
  // Enable pointer lock
  requestPointerLock(): void {
    if (!this.isPointerLocked) {
      this.domElement.requestPointerLock();
    }
  }
  
  // Bind all event listeners
  private bindEventListeners(): void {
    // Keyboard events
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    
    // Mouse events
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // Pointer lock events
    document.addEventListener('pointerlockchange', this.handlePointerLockChange.bind(this));
    document.addEventListener('pointerlockerror', this.handlePointerLockError.bind(this));
    
    // Click handler for requesting pointer lock
    this.domElement.addEventListener('click', () => this.requestPointerLock());
  }
  
  // Handle pointer lock change
  private handlePointerLockChange(): void {
    this.isPointerLocked = document.pointerLockElement === this.domElement;
    this.inputState.isPointerLocked = this.isPointerLocked;
  }
  
  // Handle pointer lock error
  private handlePointerLockError(): void {
    console.error('Error attempting to lock pointer');
    this.isPointerLocked = false;
    this.inputState.isPointerLocked = false;
  }
  
  // Handle key down events
  private handleKeyDown(event: KeyboardEvent): void {
    this.updateInputStateFromKey(event.code, true);
  }
  
  // Handle key up events
  private handleKeyUp(event: KeyboardEvent): void {
    this.updateInputStateFromKey(event.code, false);
  }
  
  // Update input state based on key code
  private updateInputStateFromKey(code: string, isDown: boolean): void {
    switch (code) {
      case 'KeyW':
        this.inputState.forward = isDown;
        break;
      case 'KeyS':
        this.inputState.backward = isDown;
        break;
      case 'KeyA':
        this.inputState.left = isDown;
        break;
      case 'KeyD':
        this.inputState.right = isDown;
        break;
      case 'Space':
        this.inputState.jump = isDown;
        break;
      case 'KeyE':
        this.inputState.action = isDown;
        break;
    }
  }
  
  // Handle mouse movement
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isPointerLocked) {
      return;
    }
    
    // Store the mouse position
    this.inputState.mouseX = event.clientX;
    this.inputState.mouseY = event.clientY;
    
    // Calculate deltas for camera movement
    this.inputState.mouseDeltaX += event.movementX || 0;
    this.inputState.mouseDeltaY += event.movementY || 0;
  }
  
  // Handle mouse down events
  private handleMouseDown(event: MouseEvent): void {
    if (!this.isPointerLocked) {
      return;
    }
    
    // Handle different mouse buttons
    switch (event.button) {
      case 0: // Left mouse button
        this.inputState.action = true;
        break;
      case 2: // Right mouse button
        // Could be used for different actions
        break;
    }
  }
  
  // Handle mouse up events
  private handleMouseUp(event: MouseEvent): void {
    if (!this.isPointerLocked) {
      return;
    }
    
    // Handle different mouse buttons
    switch (event.button) {
      case 0: // Left mouse button
        this.inputState.action = false;
        break;
      case 2: // Right mouse button
        // Could be used for different actions
        break;
    }
  }
  
  // Clean up by removing event listeners
  dispose(): void {
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('keyup', this.handleKeyUp.bind(this));
    document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    document.removeEventListener('mousedown', this.handleMouseDown.bind(this));
    document.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange.bind(this));
    document.removeEventListener('pointerlockerror', this.handlePointerLockError.bind(this));
    this.domElement.removeEventListener('click', () => this.requestPointerLock());
  }
} 