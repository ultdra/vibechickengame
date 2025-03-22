import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Stats from 'stats.js';
import { PlayerController } from '../components/player-controller';
import { InputManager } from '../utils/input-manager';
import { TerrainGenerator } from '../utils/terrain-generator';
import { ChunkRenderer } from '../utils/chunk-renderer';
import { GameState, GameConfig, InputState } from '../types';
import { PHYSICS_STEP, BLOCK_SIZE } from '../constants';
import { preloadBlockMaterials } from '../utils/texture-manager';

export class GameScene {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private physicsWorld: CANNON.World;
  private player: PlayerController;
  private inputManager: InputManager;
  private terrainGenerator: TerrainGenerator;
  private chunkRenderer: ChunkRenderer;
  private gameContainerElement: HTMLElement;
  private gameState: GameState;
  private config: GameConfig;
  private stats: Stats;
  private clock: THREE.Clock;
  private lastPhysicsUpdate: number;
  
  constructor(config: GameConfig) {
    this.config = config;
    this.gameState = GameState.PLAYING; // Start in playing state immediately
    
    // Get DOM elements
    this.gameContainerElement = document.getElementById('game-container')!;
    
    // Initialize stats for performance monitoring
    this.stats = new Stats();
    this.stats.showPanel(0);
    document.body.appendChild(this.stats.dom);
    
    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.gameContainerElement.appendChild(this.renderer.domElement);
    
    // Initialize scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.01);
    
    // Initialize camera
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    
    // Initialize physics
    this.physicsWorld = new CANNON.World({
      gravity: new CANNON.Vec3(0, -config.gravity, 0)
    });
    
    // Initialize terrain generator and chunk renderer
    this.terrainGenerator = new TerrainGenerator(config.worldSeed, config.chunkSize);
    this.chunkRenderer = new ChunkRenderer(this.scene, config.chunkSize);
    
    // Input manager
    this.inputManager = new InputManager(this.gameContainerElement);
    
    // Initialize player
    this.player = new PlayerController(this.camera, this.physicsWorld);
    this.scene.add(this.player.object);
    
    // Initialize lighting
    this.setupLighting();
    
    // Initialize ground physics
    this.setupGroundPhysics();
    
    // Clock for time tracking
    this.clock = new THREE.Clock();
    this.lastPhysicsUpdate = 0;
    this.clock.start(); // Start the clock immediately
    
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    // Hide loading screen if it exists
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
    
    // Initialize the game immediately
    this.initializeGame();
  }
  
  // Set up lights in the scene
  private setupLighting(): void {
    // Directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(100, 100, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    this.scene.add(sunLight);
    
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x555555);
    this.scene.add(ambientLight);
  }
  
  // Set up ground physics
  private setupGroundPhysics(): void {
    // Ground material for the physics world
    const groundMaterial = new CANNON.Material('groundMaterial');
    
    // Contact material between player and ground
    const playerMaterial = new CANNON.Material('playerMaterial');
    const playerGroundContact = new CANNON.ContactMaterial(
      groundMaterial,
      playerMaterial,
      {
        friction: 0.5,
        restitution: 0.3
      }
    );
    this.physicsWorld.addContactMaterial(playerGroundContact);
  }
  
  // Handle window resize
  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  // Initialize the game without loading screen
  private async initializeGame(): Promise<void> {
    // Preload block materials in the background
    preloadBlockMaterials();
    
    // Generate initial chunks around player immediately
    this.generateInitialChunks();
    
    // Set up terrain physics
    this.setupTerrainPhysics();
  }
  
  // Generate initial chunks around the player - made synchronous
  private generateInitialChunks(): void {
    const renderDistance = this.config.renderDistance;
    const playerChunkX = Math.floor(this.player.getState().position.x / (this.config.chunkSize * BLOCK_SIZE));
    const playerChunkZ = Math.floor(this.player.getState().position.z / (this.config.chunkSize * BLOCK_SIZE));
    
    // Find highest point for player spawn
    let highestY = 0;
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        const worldX = playerChunkX * this.config.chunkSize + x + this.config.chunkSize / 2;
        const worldZ = playerChunkZ * this.config.chunkSize + z + this.config.chunkSize / 2;
        const height = this.getHeightAt(worldX, worldZ);
        if (height > highestY) {
          highestY = height;
        }
      }
    }
    
    // Set player position to the highest point plus some offset
    this.player.setPosition(
      playerChunkX * this.config.chunkSize * BLOCK_SIZE + this.config.chunkSize * BLOCK_SIZE / 2,
      (highestY + 2) * BLOCK_SIZE,
      playerChunkZ * this.config.chunkSize * BLOCK_SIZE + this.config.chunkSize * BLOCK_SIZE / 2
    );
    
    // Generate chunks around player
    for (let x = -renderDistance; x <= renderDistance; x++) {
      for (let z = -renderDistance; z <= renderDistance; z++) {
        const chunkX = playerChunkX + x;
        const chunkZ = playerChunkZ + z;
        
        // Generate and add the chunk
        const chunk = this.terrainGenerator.generateChunk(chunkX, chunkZ);
        this.chunkRenderer.addChunk(chunk);
      }
    }
    
    // Update all chunks
    this.chunkRenderer.updateChunks();
  }
  
  // Set up physics bodies for terrain
  private async setupTerrainPhysics(): Promise<void> {
    // Create a ground plane for the physics world
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({
      mass: 0, // Static body
      material: new CANNON.Material('groundMaterial')
    });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); // Rotate to be flat
    groundBody.position.set(0, -0.5, 0); // Set slightly below lowest terrain
    this.physicsWorld.addBody(groundBody);
  }
  
  // Get height at a specific world position
  private getHeightAt(x: number, z: number): number {
    // This is a simple proxy to the terrain generator
    // In a full implementation, you'd have a more sophisticated system
    const chunk = this.terrainGenerator.generateChunk(
      Math.floor(x / this.config.chunkSize),
      Math.floor(z / this.config.chunkSize)
    );
    
    // Find the height in the chunk data
    const localX = ((x % this.config.chunkSize) + this.config.chunkSize) % this.config.chunkSize;
    const localZ = ((z % this.config.chunkSize) + this.config.chunkSize) % this.config.chunkSize;
    
    let height = 0;
    for (let y = this.config.chunkSize - 1; y >= 0; y--) {
      const index = (y * this.config.chunkSize * this.config.chunkSize) + (localZ * this.config.chunkSize) + localX;
      if (chunk.blocks[index] !== 0) { // not air
        height = y;
        break;
      }
    }
    
    return height;
  }
  
  // Game update loop
  update(): void {
    this.stats.begin();
    
    // Skip updates if the game is not playing
    if (this.gameState !== GameState.PLAYING) {
      this.stats.end();
      return;
    }
    
    // Get deltaTime
    const deltaTime = this.clock.getDelta();
    const elapsedTime = this.clock.elapsedTime;
    
    // Get user input
    const input: InputState = this.inputManager.getInputState();
    
    // Update player
    this.player.update(input, deltaTime);
    
    // Update physics at a fixed rate
    this.lastPhysicsUpdate += deltaTime;
    while (this.lastPhysicsUpdate >= PHYSICS_STEP) {
      this.physicsWorld.step(PHYSICS_STEP);
      this.lastPhysicsUpdate -= PHYSICS_STEP;
    }
    
    // Update terrain around player
    this.updateTerrain();
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
    
    this.stats.end();
  }
  
  // Update terrain chunks around the player
  private updateTerrain(): void {
    const playerPos = this.player.getState().position;
    const renderDistance = this.config.renderDistance;
    const chunkSize = this.config.chunkSize;
    
    // Calculate player's chunk coordinates
    const playerChunkX = Math.floor(playerPos.x / (chunkSize * BLOCK_SIZE));
    const playerChunkZ = Math.floor(playerPos.z / (chunkSize * BLOCK_SIZE));
    
    // Loop through all chunks that should be visible
    for (let x = -renderDistance; x <= renderDistance; x++) {
      for (let z = -renderDistance; z <= renderDistance; z++) {
        const chunkX = playerChunkX + x;
        const chunkZ = playerChunkZ + z;
        
        // Check if this chunk already exists
        const chunkKey = `${chunkX},${chunkZ}`;
        
        // Check if the chunk needs to be generated
        if (!this.chunkExists(chunkX, chunkZ)) {
          const chunk = this.terrainGenerator.generateChunk(chunkX, chunkZ);
          this.chunkRenderer.addChunk(chunk);
        }
      }
    }
    
    // Update all chunks that need updating
    this.chunkRenderer.updateChunks();
  }
  
  // Check if a chunk exists
  private chunkExists(x: number, z: number): boolean {
    // This is a simplified check - in a full implementation,
    // you'd check against an actual list of loaded chunks
    return true; // Assume it exists for now - the chunk renderer will handle it
  }
} 