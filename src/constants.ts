import { GameConfig } from './types';

// Default game configuration
export const DEFAULT_GAME_CONFIG: GameConfig = {
  chunkSize: 16,         // Size of each chunk in blocks
  renderDistance: 6,     // How many chunks to render in each direction
  gravity: 9.8,          // Gravity force
  playerJumpForce: 5.0,  // Force applied when jumping
  playerSpeed: 5.0,      // Player movement speed
  playerMaxHealth: 10,   // Maximum player health
  worldSeed: Math.floor(Math.random() * 1000000) // Random seed for world generation
};

// Block sizes
export const BLOCK_SIZE = 1.0;
export const HALF_BLOCK_SIZE = BLOCK_SIZE / 2;

// Physics constants
export const PHYSICS_STEP = 1/60;
export const MAX_FALL_SPEED = 15.0;

// Player constants
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_EYE_HEIGHT = 1.6;
export const PLAYER_CAMERA_HEIGHT = 1.7;

// World generation constants
export const TERRAIN_AMPLITUDE = 20;     // Maximum height variation
export const TERRAIN_SCALE = 0.01;        // Scale of the noise
export const DIRT_DEPTH = 5;              // How deep the dirt layer goes
export const WATER_LEVEL = 8;             // Water level height
export const TREE_DENSITY = 0.005;        // Chance of tree spawning per block

// Colors for different block types
export const BLOCK_COLORS = {
  GRASS_TOP: 0x3bbc3b,
  GRASS_SIDE: 0x8b7834,
  DIRT: 0x8b6914,
  STONE: 0x888888,
  WOOD: 0x6d4c41,
  LEAVES: 0x388e3c,
  WATER: 0x1e88e5,
  SAND: 0xf9a825
}; 