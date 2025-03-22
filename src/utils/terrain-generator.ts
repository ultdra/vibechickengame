import * as THREE from 'three';
import { BlockType, ChunkData } from '../types';
import { 
  TERRAIN_AMPLITUDE, 
  TERRAIN_SCALE, 
  DIRT_DEPTH, 
  WATER_LEVEL,
  TREE_DENSITY
} from '../constants';

// Simple noise implementation for terrain generation
class SimplexNoise {
  private grad3: number[][];
  private p: number[];
  private perm: number[];
  private simplex: number[][];

  constructor(seed = 0) {
    this.grad3 = [
      [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];

    // Use the provided seed to initialize the random number generator
    const r = {
      random: () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      }
    };

    const l256 = 256;
    
    this.p = [];
    for (let i = 0; i < l256; i++) {
      this.p[i] = Math.floor(r.random() * 256);
    }

    this.perm = new Array(512);
    this.simplex = [
      [0, 1, 2, 3], [0, 1, 3, 2], [0, 0, 0, 0], [0, 2, 3, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [1, 2, 3, 0],
      [0, 2, 1, 3], [0, 0, 0, 0], [0, 3, 1, 2], [0, 3, 2, 1], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [1, 3, 2, 0],
      [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
      [1, 2, 0, 3], [0, 0, 0, 0], [1, 3, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [2, 3, 0, 1], [2, 3, 1, 0],
      [1, 0, 2, 3], [1, 0, 3, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 3, 1], [0, 0, 0, 0], [2, 1, 3, 0],
      [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
      [2, 0, 1, 3], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [3, 0, 1, 2], [3, 0, 2, 1], [0, 0, 0, 0], [3, 1, 2, 0],
      [2, 1, 0, 3], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [3, 1, 0, 2], [0, 0, 0, 0], [3, 2, 0, 1], [3, 2, 1, 0]
    ];

    // Initialize permutation tables
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
    }
  }

  private dot(g: number[], x: number, y: number): number {
    return g[0] * x + g[1] * y;
  }

  // 2D simplex noise
  noise(xin: number, yin: number): number {
    let n0, n1, n2; // Noise contributions from the three corners
    
    // Skew the input space to determine which simplex cell we're in
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const s = (xin + yin) * F2; // Hairy factor for 2D
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const t = (i + j) * G2;
    const X0 = i - t; // Unskew the cell origin back to (x,y) space
    const Y0 = j - t;
    const x0 = xin - X0; // The x,y distances from the cell origin
    const y0 = yin - Y0;
    
    // For the 2D case, the simplex shape is an equilateral triangle.
    // Determine which simplex we are in.
    let i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else { // lower triangle, XY order: (0,0)->(1,0)->(1,1)
      i1 = 0;
      j1 = 1;
    } // upper triangle, YX order: (0,0)->(0,1)->(1,1)
    
    // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
    // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
    // c = (3-sqrt(3))/6
    const x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2; // Offsets for last corner in (x,y) unskewed coords
    const y2 = y0 - 1.0 + 2.0 * G2;
    
    // Work out the hashed gradient indices of the three simplex corners
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.perm[ii + this.perm[jj]] % 12;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;
    
    // Calculate the contribution from the three corners
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) {
      n0 = 0.0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0); // (x,y) of grad3 used for 2D gradient
    }
    
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) {
      n1 = 0.0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1);
    }
    
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) {
      n2 = 0.0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2);
    }
    
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 70.0 * (n0 + n1 + n2);
  }
}

export class TerrainGenerator {
  private noise: SimplexNoise;
  private chunkSize: number;
  private seed: number;
  
  constructor(seed: number, chunkSize: number) {
    this.seed = seed;
    this.noise = new SimplexNoise(seed);
    this.chunkSize = chunkSize;
  }
  
  private getHeightAt(x: number, z: number): number {
    // Use multiple octaves of noise to create more interesting terrain
    const scale1 = TERRAIN_SCALE;
    const scale2 = TERRAIN_SCALE * 2;
    const scale3 = TERRAIN_SCALE * 4;
    
    // Get noise values at different scales
    const noise1 = this.noise.noise(x * scale1, z * scale1);
    const noise2 = this.noise.noise(x * scale2, z * scale2) * 0.5;
    const noise3 = this.noise.noise(x * scale3, z * scale3) * 0.25;
    
    // Combine noise values and scale to get the final height
    const combinedNoise = (noise1 + noise2 + noise3) * 0.6;
    return Math.floor((combinedNoise + 1) * 0.5 * TERRAIN_AMPLITUDE);
  }
  
  private shouldGenerateTree(x: number, z: number): boolean {
    // Use a different seed for tree generation
    const treeSeed = (this.seed + 1) % 2147483647;
    const treeNoise = new SimplexNoise(treeSeed);
    
    // Use noise to decide if a tree should be generated at this position
    const noiseValue = treeNoise.noise(x * 0.1, z * 0.1);
    return noiseValue > 1 - TREE_DENSITY * 2;
  }
  
  // Generate blocks for a specific chunk
  generateChunk(chunkX: number, chunkZ: number): ChunkData {
    const blocks = new Uint8Array(this.chunkSize * this.chunkSize * this.chunkSize);
    
    // Calculate world coordinates for this chunk
    const worldX = chunkX * this.chunkSize;
    const worldZ = chunkZ * this.chunkSize;
    
    // Generate the terrain for this chunk
    for (let x = 0; x < this.chunkSize; x++) {
      for (let z = 0; z < this.chunkSize; z++) {
        const worldPosX = worldX + x;
        const worldPosZ = worldZ + z;
        
        // Get the height of the terrain at this position
        const height = this.getHeightAt(worldPosX, worldPosZ);
        
        // Generate blocks up to the height
        for (let y = 0; y < this.chunkSize; y++) {
          const worldPosY = y;
          const index = (y * this.chunkSize * this.chunkSize) + (z * this.chunkSize) + x;
          
          // Skip if out of bounds
          if (index < 0 || index >= blocks.length) {
            continue;
          }
          
          // Generate different types of blocks based on height
          if (worldPosY > height) {
            // Air above the terrain
            blocks[index] = BlockType.AIR;
          } else if (worldPosY === height) {
            // Top layer - grass or sand near water
            if (height <= WATER_LEVEL + 1) {
              blocks[index] = BlockType.SAND;
            } else {
              blocks[index] = BlockType.GRASS;
            }
          } else if (worldPosY >= height - DIRT_DEPTH) {
            // Dirt layer
            blocks[index] = BlockType.DIRT;
          } else {
            // Stone below dirt
            blocks[index] = BlockType.STONE;
          }
          
          // Generate water at and below water level
          if (worldPosY <= WATER_LEVEL && blocks[index] === BlockType.AIR) {
            blocks[index] = BlockType.WATER;
          }
        }
        
        // Generate trees on grass blocks
        if (x > 1 && x < this.chunkSize - 2 && z > 1 && z < this.chunkSize - 2) {
          const worldPosY = this.getHeightAt(worldPosX, worldPosZ);
          
          // Only generate trees on grass blocks above water level
          if (worldPosY > WATER_LEVEL + 1 && this.shouldGenerateTree(worldPosX, worldPosZ)) {
            // Generate tree trunk
            for (let y = worldPosY + 1; y < worldPosY + 5; y++) {
              if (y < this.chunkSize) {
                const trunkIndex = (y * this.chunkSize * this.chunkSize) + (z * this.chunkSize) + x;
                blocks[trunkIndex] = BlockType.WOOD;
              }
            }
            
            // Generate tree leaves
            for (let lx = -2; lx <= 2; lx++) {
              for (let lz = -2; lz <= 2; lz++) {
                for (let ly = 3; ly <= 6; ly++) {
                  // Skip corners to make a more rounded shape
                  if ((Math.abs(lx) === 2 && Math.abs(lz) === 2) || ly === 6) {
                    continue;
                  }
                  
                  const leafX = x + lx;
                  const leafY = worldPosY + ly;
                  const leafZ = z + lz;
                  
                  // Check if within chunk bounds
                  if (leafX >= 0 && leafX < this.chunkSize && 
                      leafY >= 0 && leafY < this.chunkSize && 
                      leafZ >= 0 && leafZ < this.chunkSize) {
                    const leafIndex = (leafY * this.chunkSize * this.chunkSize) + (leafZ * this.chunkSize) + leafX;
                    // Only place leaves where there's air
                    if (blocks[leafIndex] === BlockType.AIR) {
                      blocks[leafIndex] = BlockType.LEAVES;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return {
      position: new THREE.Vector2(chunkX, chunkZ),
      blocks,
      isDirty: true
    };
  }
} 