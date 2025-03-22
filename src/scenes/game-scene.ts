import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Stats from 'stats.js';
import { PlayerController } from '../components/player-controller';
import { InputManager } from '../utils/input-manager';
import { TerrainGenerator } from '../utils/terrain-generator';
import { ChunkRenderer } from '../utils/chunk-renderer';
import { GameState, GameConfig, InputState } from '../types';
import { PHYSICS_STEP, BLOCK_SIZE, BLOCK_COLORS } from '../constants';
import { preloadBlockMaterials } from '../utils/texture-manager';

// Add SimplexNoise class for terrain generation
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

// Extend TerrainGenerator to include getNoise method
declare module '../utils/terrain-generator' {
  interface TerrainGenerator {
    getNoise(): SimplexNoise;
  }
}

// Add getNoise method to TerrainGenerator prototype
TerrainGenerator.prototype.getNoise = function() {
  // Return a new SimplexNoise with a seed
  return new SimplexNoise(Math.floor(Math.random() * 1000000));
};

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
    
    // Remove specific object - find by searching directly after everything is loaded
    setTimeout(() => {
      // Final cleanup to remove any debug objects
      this.cleanupTestObjects();
      
      // AGGRESSIVE APPROACH: Look through all scene children and remove any suspect objects
      const toRemove = [];
      for (let i = 0; i < this.scene.children.length; i++) {
        const object = this.scene.children[i];
        
        // Remove any white box geometry directly
        if (object instanceof THREE.Mesh) {
          // Check if it's a cube/box and large
          const isBox = object.geometry instanceof THREE.BoxGeometry ||
                       (object.geometry.type && object.geometry.type.includes('Box'));
          
          const isLarge = isBox && object.scale.x > 5; 
          
          // Check if it's white or very light colored
          let isWhite = false;
          
          if (object.material) {
            if (object.material instanceof THREE.MeshBasicMaterial && object.material.color) {
              const color = object.material.color.getHex();
              isWhite = color > 0xf0f0f0;
            }
          }
          
          // Force remove any large, white box
          if ((isLarge || isWhite) && object.name !== "groundPlane") {
            console.log("Found suspect object to remove:", object);
            toRemove.push(object);
          }
        }
      }
      
      // Remove all found objects
      for (const obj of toRemove) {
        this.scene.remove(obj);
      }
      
      // Remove any HTML overlays or debug text
      const skyTextElements = document.querySelectorAll('.debug-text, .text-overlay');
      skyTextElements.forEach(element => {
        console.log("Removing HTML text overlay:", element);
        element.remove();
      });
      
      // Try to find any DOM elements with "Sky" text content
      document.querySelectorAll('div, span, p').forEach(el => {
        if (el.textContent && el.textContent.includes('Sky')) {
          console.log("Removing 'Sky' text element:", el);
          el.remove();
        }
      });
      
      // Force a scene update
      this.renderer.render(this.scene, this.camera);
    }, 100); // Short delay to ensure everything is loaded first
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
    
    // Remove the plane and create a cube-based environment
    this.createCubeEnvironment(groundMaterial);
    
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
  
  // Create a cube-based environment
  private createCubeEnvironment(groundMaterial: CANNON.Material): void {
    // Create a cube geometry to reuse
    const cubeSize = BLOCK_SIZE;
    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    
    // Create different materials for variety
    const materials = {
      grass: new THREE.MeshLambertMaterial({ color: BLOCK_COLORS.GRASS, flatShading: true }),
      dirt: new THREE.MeshLambertMaterial({ color: BLOCK_COLORS.DIRT, flatShading: true }),
      stone: new THREE.MeshLambertMaterial({ color: BLOCK_COLORS.STONE, flatShading: true }),
      sand: new THREE.MeshLambertMaterial({ color: BLOCK_COLORS.SAND, flatShading: true }),
      water: new THREE.MeshLambertMaterial({ 
        color: BLOCK_COLORS.WATER, 
        transparent: true, 
        opacity: 0.8,
        flatShading: true
      })
    };
    
    // Define the area size for the cube environment
    const areaSize = 30; // Size of the area (30x30 blocks)
    const centerOffset = Math.floor(areaSize / 2);
    
    // Use SimplexNoise for terrain height variation
    const noise = this.terrainGenerator.getNoise();
    
    // Store cube bodies to avoid creating multiple physics objects at the same position
    const cubePhysicsBodies: Record<string, boolean> = {};
    
    // Create a base layer of cubes and add variations
    for (let x = -centerOffset; x < centerOffset; x++) {
      for (let z = -centerOffset; z < centerOffset; z++) {
        // Generate noise-based height (between 0 and 5)
        const nx = x * 0.1;
        const nz = z * 0.1;
        const height = Math.floor(noise.noise(nx, nz) * 3 + 2); 
        
        // Create the terrain columns with different materials
        for (let y = 0; y < height; y++) {
          let material: THREE.Material;
          
          // Determine material based on height
          if (y === height - 1) {
            material = materials.grass; // Top layer is grass
          } else if (y > height - 3) {
            material = materials.dirt; // Next few layers are dirt
          } else {
            material = materials.stone; // Base is stone
          }
          
          // Create a cube at this position
          const cube = new THREE.Mesh(cubeGeometry, material);
          cube.position.set(x * cubeSize, y * cubeSize, z * cubeSize);
          cube.castShadow = true;
          cube.receiveShadow = true;
          this.scene.add(cube);
          
          // Create physics body for this cube (only for top block)
          if (y === height - 1) {
            const posKey = `${x},${y},${z}`;
            if (!cubePhysicsBodies[posKey]) {
              const cubeShape = new CANNON.Box(new CANNON.Vec3(
                cubeSize * 0.5, 
                cubeSize * 0.5, 
                cubeSize * 0.5
              ));
              
              const cubeBody = new CANNON.Body({
                mass: 0, // Static body
                material: groundMaterial,
                shape: cubeShape
              });
              
              cubeBody.position.set(
                x * cubeSize, 
                y * cubeSize, 
                z * cubeSize
              );
              
              this.physicsWorld.addBody(cubeBody);
              cubePhysicsBodies[posKey] = true;
            }
          }
        }
        
        // Randomly add water in low areas
        if (height < 2 && Math.random() < 0.5) {
          const waterCube = new THREE.Mesh(cubeGeometry, materials.water);
          waterCube.position.set(x * cubeSize, height * cubeSize, z * cubeSize);
          this.scene.add(waterCube);
        }
        
        // Randomly add small hills or variations
        if (Math.random() < 0.05) { // 5% chance
          const extraHeight = Math.floor(Math.random() * 3) + 1;
          for (let y = height; y < height + extraHeight; y++) {
            // Add an extra block
            const material = y === height + extraHeight - 1 ? materials.grass : materials.dirt;
            const hillCube = new THREE.Mesh(cubeGeometry, material);
            hillCube.position.set(x * cubeSize, y * cubeSize, z * cubeSize);
            hillCube.castShadow = true;
            hillCube.receiveShadow = true;
            this.scene.add(hillCube);
            
            // Add physics for the top hill block
            if (y === height + extraHeight - 1) {
              const posKey = `${x},${y},${z}`;
              if (!cubePhysicsBodies[posKey]) {
                const cubeShape = new CANNON.Box(new CANNON.Vec3(
                  cubeSize * 0.5, 
                  cubeSize * 0.5, 
                  cubeSize * 0.5
                ));
                
                const cubeBody = new CANNON.Body({
                  mass: 0, // Static body
                  material: groundMaterial,
                  shape: cubeShape
                });
                
                cubeBody.position.set(
                  x * cubeSize, 
                  y * cubeSize, 
                  z * cubeSize
                );
                
                this.physicsWorld.addBody(cubeBody);
                cubePhysicsBodies[posKey] = true;
              }
            }
          }
        }
      }
    }
    
    // Create a larger base underneath to catch falls
    const baseSize = areaSize * 2;
    const baseGeometry = new THREE.BoxGeometry(baseSize * cubeSize, cubeSize, baseSize * cubeSize);
    const baseMaterial = new THREE.MeshLambertMaterial({ color: BLOCK_COLORS.STONE });
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.position.set(0, -cubeSize, 0);
    baseMesh.receiveShadow = true;
    this.scene.add(baseMesh);
    
    // Add physics for the base
    const baseShape = new CANNON.Box(new CANNON.Vec3(
      baseSize * cubeSize * 0.5, 
      cubeSize * 0.5, 
      baseSize * cubeSize * 0.5
    ));
    
    const baseBody = new CANNON.Body({
      mass: 0,
      material: groundMaterial,
      shape: baseShape
    });
    
    baseBody.position.set(0, -cubeSize, 0);
    this.physicsWorld.addBody(baseBody);
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
    
    // Remove any test objects or debug elements
    this.cleanupTestObjects();
  }
  
  // Clean up any test objects or debug elements
  private cleanupTestObjects(): void {
    // Create a list to hold objects that should be removed
    const objectsToRemove: THREE.Object3D[] = [];
    
    // Traverse the scene and find any test objects
    this.scene.traverse((object) => {
      // Look for any white cubes, sprites, or test objects
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        // Check for sprites (often used for debug text/labels)
        if (object instanceof THREE.Sprite) {
          console.log("Found sprite object (potential debug label):", object);
          objectsToRemove.push(object);
        }
        
        // Check for text geometries
        if (object.geometry && 
            (object.geometry.type === 'TextGeometry' || 
             object.geometry.type === 'TextBufferGeometry')) {
          console.log("Found text geometry:", object);
          objectsToRemove.push(object);
        }
        
        // Check for debug meshes (cubes, spheres, etc.)
        const geometry = object.geometry;
        
        // Check if it's a white material
        if (object.material) {
          const material = object.material as THREE.Material;
          
          // Check if it has a white or very light color
          if (material instanceof THREE.MeshBasicMaterial && 
              material.color && 
              (material.color.getHex() === 0xffffff || material.color.getHex() > 0xf0f0f0)) {
            console.log("Found white material object:", object);
            objectsToRemove.push(object);
          }
          
          // Check for wireframe materials (often used for debugging)
          if ((material as any).wireframe === true) {
            console.log("Found wireframe object (likely debug):", object);
            objectsToRemove.push(object);
          }
        }
        
        // Check for box geometries that are likely debug objects
        if (geometry instanceof THREE.BoxGeometry || 
            geometry instanceof THREE.BufferGeometry) {
          // Check if it's a large cube (the white box we see)
          if (geometry instanceof THREE.BoxGeometry && 
              geometry.parameters.width >= 10 && 
              geometry.parameters.height >= 10 && 
              geometry.parameters.depth >= 10) {
            console.log("Found large box geometry:", object);
            objectsToRemove.push(object);
          }
        }
        
        // Also check for any objects with debug-related names
        if (object.name.includes('test') || 
            object.name.includes('debug') || 
            object.name.includes('cube') ||
            object.name.includes('sprite') ||
            object.name.includes('text')) {
          console.log("Found object with debug name:", object.name);
          objectsToRemove.push(object);
        }
      }
    });
    
    // Remove all identified objects
    for (const object of objectsToRemove) {
      console.log(`Removing debug object: ${object.name || 'unnamed'}`);
      this.scene.remove(object);
      
      // Dispose of geometry and materials to free memory
      if (object instanceof THREE.Mesh) {
        if (object.geometry) object.geometry.dispose();
        
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    }
    
    // Additional search for any "Sky" text label
    this.scene.traverse((object) => {
      if (object.type === 'Group') {
        object.children.forEach(child => {
          if (child instanceof THREE.Sprite || child instanceof THREE.Mesh) {
            if (child.name.includes('text') || child.name.includes('label') || 
                child.name.includes('debug') || child.name.includes('sprite')) {
              console.log("Removing label/text object:", child);
              object.remove(child);
            }
          }
        });
      }
    });
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
  private setupTerrainPhysics(): Promise<void> {
    return Promise.resolve(); // We don't need this anymore since we're using cube terrain
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