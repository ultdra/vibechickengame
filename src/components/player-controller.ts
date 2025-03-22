import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ChickenModel } from './chicken-model';
import { InputState, PlayerState } from '../types';
import { PLAYER_HEIGHT, PLAYER_WIDTH, PHYSICS_STEP, MAX_FALL_SPEED } from '../constants';

// Type for collision event
interface CollideEvent {
  type: string;
  body: CANNON.Body;
  contact: CANNON.ContactEquation;
}

export class PlayerController {
  readonly object: THREE.Group;
  readonly camera: THREE.PerspectiveCamera;
  readonly model: ChickenModel;
  
  private physicsBody!: CANNON.Body; // Using definite assignment assertion
  private cameraHolder: THREE.Group;
  private state: PlayerState;
  private isOnGround: boolean;
  private jumpCooldown: number;
  private world: CANNON.World;
  private dustParticles: THREE.Points | null = null;
  private dustGeometry: THREE.BufferGeometry | null = null;
  private dustMaterial: THREE.PointsMaterial | null = null;
  private particleCount: number = 50;
  private particlePositions: Float32Array | null = null;
  private particleOpacities: Float32Array | null = null;
  private particleSizes: Float32Array | null = null;
  private dustClock: THREE.Clock;
  
  constructor(camera: THREE.PerspectiveCamera, world: CANNON.World) {
    this.world = world;
    this.camera = camera;
    this.object = new THREE.Group();
    this.model = new ChickenModel();
    this.dustClock = new THREE.Clock();
    
    // Create a camera holder for fixed 45-degree angle view
    this.cameraHolder = new THREE.Group();
    this.cameraHolder.position.set(0, PLAYER_HEIGHT * 0.8, 0);
    this.object.add(this.cameraHolder);
    this.cameraHolder.add(camera);
    
    // Position the camera at a 45-degree angle above and behind the player
    // instead of slightly behind and above
    camera.position.set(0, 5, 8);
    camera.lookAt(0, 0, -2);
    
    // Add the chicken model to the player object
    this.object.add(this.model.object);
    
    // Initialize player state
    this.state = {
      position: new THREE.Vector3(0, 10, 0), // Start position (y is up in the air)
      rotation: new THREE.Euler(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      isJumping: false,
      isGrounded: false,
      health: 10,
      speed: 5
    };
    
    // Set up physics for the player
    this.setupPhysics();
    
    // Set up dust particles
    this.setupDustParticles();
    
    // Other initializations
    this.isOnGround = false;
    this.jumpCooldown = 0;
  }
  
  // Set up the physics body for the player
  private setupPhysics(): void {
    // Create a physics shape for the player (use a cylinder for better movement)
    const shape = new CANNON.Cylinder(
      PLAYER_WIDTH / 2,
      PLAYER_WIDTH / 2,
      PLAYER_HEIGHT,
      8
    );
    
    // Create the physics body
    this.physicsBody = new CANNON.Body({
      mass: 5,
      material: new CANNON.Material('playerMaterial'),
      fixedRotation: true, // Prevent the player from tipping over
      linearDamping: 0.4, // Add some damping to prevent sliding
      shape: shape
    });
    
    // Set initial position
    this.physicsBody.position.set(
      this.state.position.x,
      this.state.position.y,
      this.state.position.z
    );
    
    // Add the body to the physics world
    this.world.addBody(this.physicsBody);
    
    // Set up ground contact detection
    this.physicsBody.addEventListener('collide', (event: CollideEvent) => {
      // Check if the collision is with the ground
      const contact = event.contact;
      
      // If the collision normal is pointing up, we're on the ground
      if (contact.ni.y > 0.5) {
        this.isOnGround = true;
        this.state.isGrounded = true;
        this.state.isJumping = false;
      }
    });
  }
  
  // Set up dust particles
  private setupDustParticles(): void {
    // Create particle geometry
    this.dustGeometry = new THREE.BufferGeometry();
    
    // Create particle positions, opacities, and sizes
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleOpacities = new Float32Array(this.particleCount);
    this.particleSizes = new Float32Array(this.particleCount);
    
    // Initialize particle positions and opacities
    for (let i = 0; i < this.particleCount; i++) {
      this.particlePositions[i * 3] = 0;     // x
      this.particlePositions[i * 3 + 1] = 0; // y
      this.particlePositions[i * 3 + 2] = 0; // z
      this.particleOpacities[i] = 0;         // opacity (0 = invisible)
      this.particleSizes[i] = Math.random() * 0.5 + 0.1; // random size
    }
    
    // Set attributes
    this.dustGeometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.dustGeometry.setAttribute('opacity', new THREE.BufferAttribute(this.particleOpacities, 1));
    this.dustGeometry.setAttribute('size', new THREE.BufferAttribute(this.particleSizes, 1));
    
    // Create particle material
    this.dustMaterial = new THREE.PointsMaterial({
      color: 0xCCCCCC,
      size: 0.2,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    
    // Set particle vertex shader to use opacity attribute
    this.dustMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        `attribute float opacity;
        attribute float size;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;`
      );
      
      shader.vertexShader = shader.vertexShader.replace(
        'gl_PointSize = size;',
        'gl_PointSize = size * 10.0;'
      );
      
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        `varying float vOpacity;
        void main() {`
      );
      
      shader.fragmentShader = shader.fragmentShader.replace(
        'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
        'gl_FragColor = vec4( outgoingLight, diffuseColor.a * vOpacity );'
      );
    };
    
    // Create particle system
    this.dustParticles = new THREE.Points(this.dustGeometry, this.dustMaterial);
    this.dustParticles.frustumCulled = false; // Ensure particles are always rendered
    
    // Add to scene
    this.object.add(this.dustParticles);
  }
  
  // Update dust particles
  private updateDustParticles(isMoving: boolean, velocity: THREE.Vector3): void {
    if (!this.dustGeometry || !this.particlePositions || !this.particleOpacities || !this.isOnGround) return;
    
    const deltaTime = this.dustClock.getDelta();
    const positions = this.dustGeometry.attributes.position.array as Float32Array;
    const opacities = this.dustGeometry.attributes.opacity.array as Float32Array;
    
    // Update each particle
    for (let i = 0; i < this.particleCount; i++) {
      // If moving and on ground, spawn new particles
      if (isMoving && this.isOnGround && Math.random() < 0.1) {
        // Position at player's feet, with some random offset
        const offsetX = (Math.random() - 0.5) * 0.5;
        const offsetZ = (Math.random() - 0.5) * 0.5;
        
        positions[i * 3] = offsetX;  // x
        positions[i * 3 + 1] = 0.05; // y - slightly above ground
        positions[i * 3 + 2] = offsetZ;  // z
        
        // Make the particle visible
        opacities[i] = 0.8;
      }
      
      // Fade out existing particles
      if (opacities[i] > 0) {
        // Move particles outward and upward
        positions[i * 3] += (Math.random() - 0.5) * 0.1;     // x drift
        positions[i * 3 + 1] += Math.random() * 0.05;        // y rise
        positions[i * 3 + 2] += (Math.random() - 0.5) * 0.1; // z drift
        
        // Fade out
        opacities[i] -= deltaTime * 2;
        if (opacities[i] < 0) opacities[i] = 0;
      }
    }
    
    // Update attributes
    this.dustGeometry.attributes.position.needsUpdate = true;
    this.dustGeometry.attributes.opacity.needsUpdate = true;
  }
  
  // Update player based on input
  update(input: InputState, deltaTime: number): void {
    // Get forward and right directions based on model orientation
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.object.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.object.quaternion);
    
    // Reset velocity before applying new forces
    const velocity = new THREE.Vector3();
    
    // Apply movement based on input and rotate the player accordingly
    if (input.forward) {
      velocity.add(forward.multiplyScalar(this.state.speed));
      this.object.rotation.y = 0; // Face forward
    }
    if (input.backward) {
      velocity.add(forward.multiplyScalar(-this.state.speed));
      this.object.rotation.y = Math.PI; // Face backward
    }
    if (input.left) {
      velocity.add(right.multiplyScalar(-this.state.speed));
      this.object.rotation.y = Math.PI * 0.5; // Face left
    }
    if (input.right) {
      velocity.add(right.multiplyScalar(this.state.speed));
      this.object.rotation.y = Math.PI * 1.5; // Face right
    }
    
    // Handle diagonal movement
    if (input.forward && input.right) {
      this.object.rotation.y = Math.PI * 1.75; // Up-Right
    } else if (input.right && input.backward) {
      this.object.rotation.y = Math.PI * 1.25; // Down-Right
    } else if (input.backward && input.left) {
      this.object.rotation.y = Math.PI * 0.75; // Down-Left
    } else if (input.left && input.forward) {
      this.object.rotation.y = Math.PI * 0.25; // Up-Left
    }
    
    // Normalize the velocity and scale it by speed
    if (velocity.length() > 0) {
      velocity.normalize().multiplyScalar(this.state.speed);
    }
    
    // Set the horizontal velocity in the physics body
    this.physicsBody.velocity.x = velocity.x;
    this.physicsBody.velocity.z = velocity.z;
    
    // Handle jumping
    if (this.jumpCooldown > 0) {
      this.jumpCooldown -= deltaTime;
    }
    
    if (input.jump && this.isOnGround && this.jumpCooldown <= 0) {
      this.physicsBody.velocity.y = 8; // Increased jump force
      this.isOnGround = false;
      this.state.isJumping = true;
      this.state.isGrounded = false;
      this.jumpCooldown = 0.3; // Set jump cooldown to prevent multiple jumps
    }
    
    // Update player state from physics
    this.state.position.set(
      this.physicsBody.position.x,
      this.physicsBody.position.y,
      this.physicsBody.position.z
    );
    
    this.state.velocity.set(
      this.physicsBody.velocity.x,
      this.physicsBody.velocity.y,
      this.physicsBody.velocity.z
    );
    
    // Cap fall speed
    if (this.state.velocity.y < -MAX_FALL_SPEED) {
      this.physicsBody.velocity.y = -MAX_FALL_SPEED;
    }
    
    // Update mesh position
    this.object.position.copy(this.state.position);
    
    // Update the model
    const isMoving = Math.abs(velocity.x) > 0.1 || Math.abs(velocity.z) > 0.1;
    this.model.animate(performance.now() / 1000, isMoving, this.state.velocity, input);
    
    // Calculate camera position relative to player direction
    // This ensures the camera stays behind the player as they move
    const offsetDistance = 3; // Distance behind player
    const cameraHeight = 2.5;  // Height above player
    
    // Calculate camera position based on player rotation
    const cameraOffset = new THREE.Vector3(
      -Math.sin(this.object.rotation.y) * offsetDistance,
      cameraHeight,
      -Math.cos(this.object.rotation.y) * offsetDistance
    );
    
    // Set camera position relative to player
    this.camera.position.copy(this.state.position).add(cameraOffset);
    
    // Look at player position plus a small forward offset (slightly ahead of the player)
    const lookAtPosition = this.state.position.clone();
    lookAtPosition.y += 1; // Look at head level
    this.camera.lookAt(lookAtPosition);
    
    // Update dust particles
    this.updateDustParticles(isMoving, velocity);
  }
  
  // Get the current player state
  getState(): PlayerState {
    return { ...this.state };
  }
  
  // Set player position
  setPosition(x: number, y: number, z: number): void {
    this.state.position.set(x, y, z);
    this.physicsBody.position.set(x, y, z);
  }
} 