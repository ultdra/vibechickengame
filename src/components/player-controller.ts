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
    
    // Create a camera holder for smoother camera movement
    this.cameraHolder = new THREE.Group();
    this.cameraHolder.position.set(0, PLAYER_HEIGHT * 0.8, 0);
    this.object.add(this.cameraHolder);
    this.cameraHolder.add(camera);
    
    // Position the camera slightly behind and above the player
    camera.position.set(0, 0.5, 2);
    camera.lookAt(0, 0, -10);
    
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
    // Update camera rotation based on mouse movement
    if (input.isPointerLocked) {
      // Rotate horizontally (around y-axis)
      this.object.rotation.y -= input.mouseDeltaX * 0.002;
      
      // Rotate camera vertically (around x-axis), with limits
      const verticalRotation = this.cameraHolder.rotation.x + input.mouseDeltaY * 0.002;
      this.cameraHolder.rotation.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, verticalRotation));
    }
    
    // Get forward and right directions based on camera orientation
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.object.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.object.quaternion);
    
    // Reset velocity before applying new forces
    const velocity = new THREE.Vector3();
    
    // Apply movement based on input
    if (input.forward) {
      velocity.add(forward.multiplyScalar(this.state.speed));
    }
    if (input.backward) {
      velocity.add(forward.multiplyScalar(-this.state.speed));
    }
    if (input.left) {
      velocity.add(right.multiplyScalar(-this.state.speed));
    }
    if (input.right) {
      velocity.add(right.multiplyScalar(this.state.speed));
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
      this.physicsBody.velocity.y = 6; // Jump force
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