import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ChickenModel } from './chicken-model';
import { InputState, PlayerState } from '../types';
import { 
  PLAYER_HEIGHT, 
  PLAYER_WIDTH, 
  PHYSICS_STEP, 
  MAX_FALL_SPEED
} from '../constants';

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
  
  private physicsBody!: CANNON.Body;
  private state: PlayerState;
  private isOnGround: boolean;
  private jumpCooldown: number;
  private world: CANNON.World;
  
  // Camera settings
  private cameraOffset: THREE.Vector3;
  private cameraHeight: number = 10;
  private cameraDistance: number = 20;
  private cameraSmoothFactor: number = 0.1;
  
  constructor(camera: THREE.PerspectiveCamera, world: CANNON.World) {
    this.world = world;
    this.camera = camera;
    this.object = new THREE.Group();
    this.model = new ChickenModel();
    
    // Add the chicken model to the player object
    this.object.add(this.model.object);
    
    // Initialize player state
    this.state = {
      position: new THREE.Vector3(0, 30, 0), // Start position
      rotation: new THREE.Euler(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      isJumping: false,
      isGrounded: false,
      health: 10,
      speed: 15 // Speed for larger map
    };
    
    // Set up camera offset
    this.cameraOffset = new THREE.Vector3(0, this.cameraHeight, this.cameraDistance);
    
    // Set up physics for the player
    this.setupPhysics();
    
    // Other initializations
    this.isOnGround = false;
    this.jumpCooldown = 0;
    
    console.log("PlayerController initialized");
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
    
    console.log("Physics set up, body position:", this.physicsBody.position);
  }
  
  // Update player based on input
  update(input: InputState, deltaTime: number): void {
    // Calculate movement direction based on WASD keys
    const directionZ = Number(input.backward) - Number(input.forward);
    const directionX = Number(input.right) - Number(input.left);
    
    // Only apply movement if we have input
    if (directionX !== 0 || directionZ !== 0) {
      // Create a movement vector that's aligned with camera view
      const movement = new THREE.Vector3();
      
      // Forward/backward movement should go in the camera's forward/backward direction
      // But we need to keep it on the XZ plane (no Y component)
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(this.camera.quaternion);
      forward.y = 0; // Keep movement on the ground plane
      forward.normalize();
      
      // Right/left movement should go in the camera's right/left direction
      // But we need to keep it on the XZ plane (no Y component)
      const right = new THREE.Vector3(1, 0, 0);
      right.applyQuaternion(this.camera.quaternion);
      right.y = 0; // Keep movement on the ground plane
      right.normalize();
      
      // Combine the directions based on input
      movement.addScaledVector(forward, -directionZ);
      movement.addScaledVector(right, directionX);
      
      // Normalize and apply speed
      if (movement.length() > 0) {
        movement.normalize().multiplyScalar(this.state.speed);
      }
      
      // Apply the calculated velocity to the physics body
      this.physicsBody.velocity.x = movement.x;
      this.physicsBody.velocity.z = movement.z;
    } else {
      // No movement input, stop the player
      this.physicsBody.velocity.x = 0;
      this.physicsBody.velocity.z = 0;
    }
    
    // Handle jumping
    if (this.jumpCooldown > 0) {
      this.jumpCooldown -= deltaTime;
    }
    
    if (input.jump && this.isOnGround && this.jumpCooldown <= 0) {
      this.physicsBody.velocity.y = 24; // Jump force for larger map
      this.isOnGround = false;
      this.state.isJumping = true;
      this.state.isGrounded = false;
      this.jumpCooldown = 0.3; // Jump cooldown
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
    
    // Update the model animation
    const isMoving = Math.abs(this.state.velocity.x) > 0.1 || Math.abs(this.state.velocity.z) > 0.1;
    this.model.animate(performance.now() / 1000, isMoving, this.state.velocity, input);
    
    // Update camera position
    this.updateCamera(deltaTime);
  }
  
  // Update camera to follow the player
  private updateCamera(deltaTime: number): void {
    // Calculate the target camera position (behind the player)
    const targetCameraPos = new THREE.Vector3(
      this.state.position.x,
      this.state.position.y + this.cameraHeight,
      this.state.position.z + this.cameraDistance
    );
    
    // Smoothly move the camera toward the target position
    this.camera.position.lerp(targetCameraPos, this.cameraSmoothFactor);
    
    // Look at the player
    this.camera.lookAt(
      this.state.position.x,
      this.state.position.y + 2, // Look slightly above the chicken
      this.state.position.z
    );
  }
  
  // Get the current player state
  getState(): PlayerState {
    return { ...this.state };
  }
  
  // Set player position
  setPosition(x: number, y: number, z: number): void {
    this.state.position.set(x, y, z);
    this.physicsBody.position.set(x, y, z);
    
    // Update the camera immediately to avoid a jarring jump
    this.camera.position.set(
      x,
      y + this.cameraHeight,
      z + this.cameraDistance
    );
    
    this.camera.lookAt(x, y + 2, z);
    
    console.log("Player position set to:", x, y, z);
  }
} 