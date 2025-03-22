import * as THREE from 'three';
import { ChunkData, BlockType } from '../types';
import { createBlockMaterials } from './texture-manager';
import { BLOCK_SIZE } from '../constants';

// Direction offsets for neighboring blocks
const NEIGHBOR_OFFSETS = [
  [1, 0, 0],  // Right
  [-1, 0, 0], // Left
  [0, 1, 0],  // Top
  [0, -1, 0], // Bottom
  [0, 0, 1],  // Front
  [0, 0, -1]  // Back
];

export class ChunkRenderer {
  private scene: THREE.Scene;
  private chunkSize: number;
  private chunks: Map<string, ChunkData>;
  
  constructor(scene: THREE.Scene, chunkSize: number) {
    this.scene = scene;
    this.chunkSize = chunkSize;
    this.chunks = new Map<string, ChunkData>();
  }
  
  // Get a chunk key from coordinates
  private getChunkKey(x: number, z: number): string {
    return `${x},${z}`;
  }
  
  // Add a chunk to the renderer
  addChunk(chunk: ChunkData): void {
    const key = this.getChunkKey(chunk.position.x, chunk.position.y);
    this.chunks.set(key, chunk);
    
    // Mark the chunk as dirty so it gets rendered
    chunk.isDirty = true;
  }
  
  // Remove a chunk from the renderer
  removeChunk(x: number, z: number): void {
    const key = this.getChunkKey(x, z);
    const chunk = this.chunks.get(key);
    
    if (chunk && chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      
      // Remove materials, but we don't dispose them here since they're shared
      if (chunk.mesh.material instanceof Array) {
        chunk.mesh.material.length = 0;
      }
    }
    
    this.chunks.delete(key);
  }
  
  // Get a block from world coordinates
  getBlock(x: number, y: number, z: number): BlockType {
    // Calculate chunk coordinates
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);
    
    // Get local coordinates within the chunk
    const localX = ((x % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const localY = ((y % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const localZ = ((z % this.chunkSize) + this.chunkSize) % this.chunkSize;
    
    // Get the chunk
    const key = this.getChunkKey(chunkX, chunkZ);
    const chunk = this.chunks.get(key);
    
    if (!chunk) {
      return BlockType.AIR; // If the chunk doesn't exist, return air
    }
    
    // Get the block index within the chunk data
    const index = (localY * this.chunkSize * this.chunkSize) + (localZ * this.chunkSize) + localX;
    
    // Return the block type at this index
    return chunk.blocks[index] as BlockType;
  }
  
  // Update all chunks that are marked as dirty
  updateChunks(): void {
    this.chunks.forEach((chunk) => {
      if (chunk.isDirty) {
        this.renderChunk(chunk);
        chunk.isDirty = false;
      }
    });
  }
  
  // Generate a mesh for a chunk
  private renderChunk(chunk: ChunkData): void {
    // Remove existing mesh if it exists
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
    }
    
    // Create geometry buffers
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const materialIndices: number[] = [];
    
    // Keeps track of which block types are used in this chunk
    const usedBlockTypes = new Set<BlockType>();
    
    // Iterate through all blocks in the chunk
    for (let y = 0; y < this.chunkSize; y++) {
      for (let z = 0; z < this.chunkSize; z++) {
        for (let x = 0; x < this.chunkSize; x++) {
          const index = (y * this.chunkSize * this.chunkSize) + (z * this.chunkSize) + x;
          const blockType = chunk.blocks[index] as BlockType;
          
          // Skip air blocks (they're not rendered)
          if (blockType === BlockType.AIR) {
            continue;
          }
          
          // Calculate world coordinates
          const worldX = chunk.position.x * this.chunkSize + x;
          const worldY = y;
          const worldZ = chunk.position.y * this.chunkSize + z;
          
          // Add faces for each visible side of the block
          for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
            const [nx, ny, nz] = NEIGHBOR_OFFSETS[faceIndex];
            
            // Check if the neighboring block is transparent or out of bounds
            const neighborX = x + nx;
            const neighborY = y + ny;
            const neighborZ = z + nz;
            
            // If the neighbor is within this chunk
            if (
              neighborX >= 0 && neighborX < this.chunkSize &&
              neighborY >= 0 && neighborY < this.chunkSize &&
              neighborZ >= 0 && neighborZ < this.chunkSize
            ) {
              const neighborIndex = (neighborY * this.chunkSize * this.chunkSize) + (neighborZ * this.chunkSize) + neighborX;
              const neighborBlockType = chunk.blocks[neighborIndex] as BlockType;
              
              // Skip this face if the neighbor is solid
              if (neighborBlockType !== BlockType.AIR && 
                  neighborBlockType !== BlockType.WATER && 
                  neighborBlockType !== BlockType.LEAVES) {
                continue;
              }
            }
            
            // Add this block type to the used types
            usedBlockTypes.add(blockType);
            
            // Vertex positions for this face (a quad)
            const faceVertices = this.getFaceVertices(x, y, z, faceIndex);
            const vertexOffset = positions.length / 3;
            
            // Add vertices
            for (let i = 0; i < faceVertices.length; i += 3) {
              positions.push(faceVertices[i], faceVertices[i + 1], faceVertices[i + 2]);
            }
            
            // Add face normals
            const faceNormal = NEIGHBOR_OFFSETS[faceIndex];
            for (let i = 0; i < 4; i++) {
              normals.push(faceNormal[0], faceNormal[1], faceNormal[2]);
            }
            
            // Add texture coordinates
            uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
            
            // Add indices for two triangles forming the quad
            indices.push(
              vertexOffset, vertexOffset + 1, vertexOffset + 2,
              vertexOffset, vertexOffset + 2, vertexOffset + 3
            );
            
            // Store the material index for this face
            const materialIndex = faceIndex;
            materialIndices.push(materialIndex, materialIndex);
          }
        }
      }
    }
    
    // If there are no faces to render, don't create a mesh
    if (indices.length === 0) {
      return;
    }
    
    // Create buffers for geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    
    // Get materials for this chunk
    const blockTypes = Array.from(usedBlockTypes);
    const materials: THREE.Material[] = [];
    
    // Add materials for each block type
    for (const blockType of blockTypes) {
      const blockMaterials = createBlockMaterials(blockType);
      materials.push(...blockMaterials);
    }
    
    // Create mesh with the geometry and materials
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.position.set(
      chunk.position.x * this.chunkSize * BLOCK_SIZE,
      0,
      chunk.position.y * this.chunkSize * BLOCK_SIZE
    );
    
    // Add the mesh to the scene
    this.scene.add(mesh);
    
    // Store the mesh in the chunk
    chunk.mesh = mesh;
  }
  
  // Generate vertices for a face
  private getFaceVertices(x: number, y: number, z: number, faceIndex: number): number[] {
    // Scale by block size
    const x1 = x * BLOCK_SIZE;
    const y1 = y * BLOCK_SIZE;
    const z1 = z * BLOCK_SIZE;
    const x2 = (x + 1) * BLOCK_SIZE;
    const y2 = (y + 1) * BLOCK_SIZE;
    const z2 = (z + 1) * BLOCK_SIZE;
    
    // Define vertices for each face (right, left, top, bottom, front, back)
    const faceVertices = [
      // Right face (x+)
      [x2, y1, z1, x2, y1, z2, x2, y2, z2, x2, y2, z1],
      // Left face (x-)
      [x1, y1, z2, x1, y1, z1, x1, y2, z1, x1, y2, z2],
      // Top face (y+)
      [x1, y2, z1, x2, y2, z1, x2, y2, z2, x1, y2, z2],
      // Bottom face (y-)
      [x1, y1, z2, x2, y1, z2, x2, y1, z1, x1, y1, z1],
      // Front face (z+)
      [x1, y1, z2, x1, y2, z2, x2, y2, z2, x2, y1, z2],
      // Back face (z-)
      [x2, y1, z1, x2, y2, z1, x1, y2, z1, x1, y1, z1]
    ];
    
    return faceVertices[faceIndex];
  }
} 