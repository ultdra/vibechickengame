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

// Game world constants
export const BLOCK_SIZE = 6.0;
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
export const TERRAIN_AMPLITUDE = 3;     // Reduced from 20 to 3 for fewer height levels
export const TERRAIN_SCALE = 0.005;     // Reduced from 0.01 to create larger flat areas
export const TERRAIN_THRESHOLD_1 = 0.3; // Threshold for first level elevation
export const TERRAIN_THRESHOLD_2 = 0.6; // Threshold for second level elevation
export const TERRAIN_THRESHOLD_3 = 0.8; // Threshold for third level elevation
export const DIRT_DEPTH = 3;            // How deep the dirt layer goes
export const WATER_LEVEL = 1;           // Lower water level for mostly flat terrain
export const TREE_DENSITY = 0.003;      // Reduced tree density for cleaner landscape

// Colors for different block types
export const BLOCK_COLORS = {
  GRASS: 0x4caf50,
  DIRT: 0x795548,
  STONE: 0x9e9e9e,
  WOOD: 0x8d6e63,
  LEAVES: 0x2e7d32,
  WATER: 0x1e88e5,
  SAND: 0xf9a825
}; 