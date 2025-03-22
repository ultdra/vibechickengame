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
  
  constructor(camera: THREE.PerspectiveCamera, world: CANNON.World) {
    this.world = world;
    this.camera = camera;
    this.object = new THREE.Group();
    this.model = new ChickenModel();
    
    // Create a camera holder for third-person view
    this.cameraHolder = new THREE.Group();
    this.cameraHolder.position.set(0, PLAYER_HEIGHT * 0.8, 0);
    this.object.add(this.cameraHolder);
    this.cameraHolder.add(camera);
    
    // Position the camera in third-person view (similar to Marvel screenshot)
    camera.position.set(0, 2, 6); // Lower and further back for third-person view
    camera.lookAt(0, 0, -3);
    
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
  
  // Update player based on input
  update(input: InputState, deltaTime: number): void {
    // Handle camera rotation with mouse (horizontal only)
    if (input.isPointerLocked) {
      // Only rotate the camera holder horizontally (around y-axis)
      this.cameraHolder.rotation.y -= input.mouseDeltaX * 0.002;
    }
    
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
    
    // Third-person camera following, like in the Marvel game screenshot
    // Define camera follow parameters
    const cameraDistance = 5; // Distance behind character
    const cameraHeight = 2;   // Height above character
    const lookAheadDistance = 3; // Look ahead of the character
    
    // Create a smooth follow effect
    const idealOffset = new THREE.Vector3();
    idealOffset.set(
      -Math.sin(this.object.rotation.y) * cameraDistance,
      cameraHeight,
      -Math.cos(this.object.rotation.y) * cameraDistance
    );
    
    // Add player position to get world space position
    idealOffset.add(this.state.position);
    
    // Smoothly interpolate camera position
    const lerpFactor = 0.1; // Lower = smoother, higher = more responsive
    this.camera.position.lerp(idealOffset, lerpFactor);
    
    // Calculate look target (slightly in front of the player)
    const lookTarget = new THREE.Vector3();
    lookTarget.set(
      this.state.position.x + Math.sin(this.object.rotation.y) * lookAheadDistance,
      this.state.position.y + 1, // Look at character's head level
      this.state.position.z + Math.cos(this.object.rotation.y) * lookAheadDistance
    );
    
    // Point the camera at the target
    this.camera.lookAt(lookTarget);
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