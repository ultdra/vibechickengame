import * as THREE from 'three';

// Game state types
export enum GameState {
  MAIN_MENU,
  PLAYING,
  PAUSED,
  GAME_OVER
}

// Block types for our voxel world
export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  WOOD = 4,
  LEAVES = 5,
  WATER = 6,
  SAND = 7
}

// Direction enum for movement
export enum Direction {
  FORWARD,
  BACKWARD,
  LEFT,
  RIGHT,
  UP,
  DOWN
}

// Player state
export interface PlayerState {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  velocity: THREE.Vector3;
  isJumping: boolean;
  isGrounded: boolean;
  health: number;
  speed: number;
}

// Chunk data for terrain
export interface ChunkData {
  position: THREE.Vector2;
  blocks: Uint8Array;
  isDirty: boolean;
  mesh?: THREE.Mesh;
}

// Game configuration
export interface GameConfig {
  chunkSize: number;
  renderDistance: number;
  gravity: number;
  playerJumpForce: number;
  playerSpeed: number;
  playerMaxHealth: number;
  worldSeed: number;
}

// Input state
export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  action: boolean;
  peck: boolean;
  mouseX: number;
  mouseY: number;
  mouseDeltaX: number;
  mouseDeltaY: number;
  isPointerLocked: boolean;
} 