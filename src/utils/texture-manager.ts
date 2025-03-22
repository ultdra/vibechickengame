import * as THREE from 'three';
import { BlockType } from '../types';
import { BLOCK_COLORS } from '../constants';

// Texture cache to prevent loading the same textures multiple times
const textureCache = new Map<string, THREE.Texture>();
const materialCache = new Map<BlockType, THREE.Material[]>();

// Function to create a texture with a specific color and optional noise pattern
function createColorTexture(color: number, addNoise = true): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;

  // Fill the canvas with the base color
  context.fillStyle = '#' + color.toString(16).padStart(6, '0');
  context.fillRect(0, 0, size, size);

  // Add noise for texture variation
  if (addNoise) {
    context.fillStyle = '#000000';
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const noiseValue = Math.random() * 0.1;
        if (noiseValue > 0.08) {
          context.globalAlpha = noiseValue;
          context.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  // Create a grid pattern for the block edges
  context.globalAlpha = 0.1;
  context.strokeStyle = '#000000';
  context.lineWidth = 1;
  context.strokeRect(0, 0, size, size);
  context.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearFilter;
  
  return texture;
}

// Function to create pixelated textures for different block types
export function createBlockMaterials(blockType: BlockType): THREE.Material[] {
  // Check if we already have cached materials for this block type
  if (materialCache.has(blockType)) {
    return materialCache.get(blockType)!;
  }
  
  let materials: THREE.Material[] = [];
  
  switch (blockType) {
    case BlockType.GRASS:
      // Use the same GRASS color for all faces, but darken for the sides
      const grassColor = BLOCK_COLORS.GRASS;
      // Top face (grass top)
      const grassTopTexture = createColorTexture(grassColor);
      
      // Side faces (grass side) - darken the color by 20%
      const darkenFactor = 0.8; // 80% of the original brightness
      const r = (grassColor >> 16) & 0xFF;
      const g = (grassColor >> 8) & 0xFF;
      const b = grassColor & 0xFF;
      const grassSideColor = (Math.floor(r * darkenFactor) << 16) | 
                             (Math.floor(g * darkenFactor) << 8) | 
                             Math.floor(b * darkenFactor);
      const grassSideTexture = createColorTexture(grassSideColor);
      
      // Bottom face (dirt)
      const dirtTexture = createColorTexture(BLOCK_COLORS.DIRT);
      
      materials = [
        new THREE.MeshLambertMaterial({ map: grassSideTexture }), // Right
        new THREE.MeshLambertMaterial({ map: grassSideTexture }), // Left
        new THREE.MeshLambertMaterial({ map: grassTopTexture }),  // Top
        new THREE.MeshLambertMaterial({ map: dirtTexture }),      // Bottom
        new THREE.MeshLambertMaterial({ map: grassSideTexture }), // Front
        new THREE.MeshLambertMaterial({ map: grassSideTexture })  // Back
      ];
      break;
      
    case BlockType.DIRT:
      const dirtTex = createColorTexture(BLOCK_COLORS.DIRT);
      const dirtMaterial = new THREE.MeshLambertMaterial({ map: dirtTex });
      materials = Array(6).fill(dirtMaterial);
      break;
      
    case BlockType.STONE:
      const stoneTex = createColorTexture(BLOCK_COLORS.STONE);
      const stoneMaterial = new THREE.MeshLambertMaterial({ map: stoneTex });
      materials = Array(6).fill(stoneMaterial);
      break;
      
    case BlockType.WOOD:
      const woodTex = createColorTexture(BLOCK_COLORS.WOOD, false);
      const woodMaterial = new THREE.MeshLambertMaterial({ map: woodTex });
      materials = Array(6).fill(woodMaterial);
      break;
      
    case BlockType.LEAVES:
      const leavesTex = createColorTexture(BLOCK_COLORS.LEAVES);
      const leavesMaterial = new THREE.MeshLambertMaterial({ 
        map: leavesTex,
        transparent: true,
        alphaTest: 0.5
      });
      materials = Array(6).fill(leavesMaterial);
      break;
      
    case BlockType.WATER:
      const waterTex = createColorTexture(BLOCK_COLORS.WATER);
      const waterMaterial = new THREE.MeshLambertMaterial({ 
        map: waterTex,
        transparent: true,
        opacity: 0.7
      });
      materials = Array(6).fill(waterMaterial);
      break;
      
    case BlockType.SAND:
      const sandTex = createColorTexture(BLOCK_COLORS.SAND);
      const sandMaterial = new THREE.MeshLambertMaterial({ map: sandTex });
      materials = Array(6).fill(sandMaterial);
      break;
      
    default:
      // Default material (shouldn't normally be used)
      const defaultMaterial = new THREE.MeshLambertMaterial({ color: 0xff00ff });
      materials = Array(6).fill(defaultMaterial);
  }
  
  // Cache the materials for future use
  materialCache.set(blockType, materials);
  
  return materials;
}

// Function to preload all block materials
export function preloadBlockMaterials(): Promise<void> {
  return new Promise((resolve) => {
    // Create materials for all block types
    Object.values(BlockType)
      .filter(value => typeof value === 'number')
      .forEach(blockType => {
        if (blockType !== BlockType.AIR) {
          createBlockMaterials(blockType as BlockType);
        }
      });
    
    resolve();
  });
}

// Function to clean up and dispose textures
export function disposeTextures(): void {
  textureCache.forEach(texture => {
    texture.dispose();
  });
  textureCache.clear();
  
  materialCache.forEach(materials => {
    materials.forEach(material => {
      if (material instanceof THREE.MeshLambertMaterial && material.map) {
        material.map.dispose();
        material.dispose();
      }
    });
  });
  materialCache.clear();
} 