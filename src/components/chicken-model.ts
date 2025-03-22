import * as THREE from 'three';
import { BLOCK_SIZE } from '../constants';

// Colors for the chicken parts
const COLORS = {
  BODY: 0xffffff,      // White for body
  BEAK: 0xffa500,      // Orange for beak
  COMB: 0xff0000,      // Red for comb/wattle
  LEGS: 0xffa500,      // Orange for legs
  EYE: 0x000000,       // Black for eyes
  WING: 0xf0f0f0       // Light gray for wings
};

export class ChickenModel {
  readonly object: THREE.Group;
  private modelContainer: THREE.Group;
  private body: THREE.Group;
  private head: THREE.Group;
  private leftWing: THREE.Mesh;
  private rightWing: THREE.Mesh;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  
  constructor() {
    this.object = new THREE.Group();
    
    // Create a container for the entire chicken model
    this.modelContainer = new THREE.Group();
    
    // Initialize chicken parts
    this.body = this.createBody();
    this.head = this.createHead();
    this.leftWing = this.createWing();
    this.rightWing = this.createWing();
    this.leftLeg = this.createLeg();
    this.rightLeg = this.createLeg();
    
    // Position the parts relative to the body
    // The head is at front (front = -z in our model direction)
    this.head.position.set(0, 0.4 * BLOCK_SIZE, -0.4 * BLOCK_SIZE);
    this.leftWing.position.set(-0.3 * BLOCK_SIZE, 0, 0);
    this.rightWing.position.set(0.3 * BLOCK_SIZE, 0, 0);
    this.leftLeg.position.set(-0.2 * BLOCK_SIZE, -0.3 * BLOCK_SIZE, 0);
    this.rightLeg.position.set(0.2 * BLOCK_SIZE, -0.3 * BLOCK_SIZE, 0);
    
    // Mirror the right wing
    this.rightWing.scale.x = -1;
    
    // Add all parts to the body
    this.body.add(this.head);
    this.body.add(this.leftWing);
    this.body.add(this.rightWing);
    this.body.add(this.leftLeg);
    this.body.add(this.rightLeg);
    
    // Add the body to the model container
    this.modelContainer.add(this.body);
    
    // Add the model container to the object
    this.object.add(this.modelContainer);
    
    // Scale down the entire chicken to make it smaller in relation to the cubes
    this.object.scale.set(0.4, 0.4, 0.4);
    
    // Position model to have feet touch the ground
    // Adjust y offset to ensure chicken properly touches the ground
    this.object.position.set(0, BLOCK_SIZE * 0.5, 0);
    
    // Default model orientation (facing forward/up, the -z direction)
    this.modelContainer.rotation.y = 0;
  }
  
  // Create the chicken body
  private createBody(): THREE.Group {
    const body = new THREE.Group();
    
    // Main body cube
    const bodyGeometry = new THREE.BoxGeometry(BLOCK_SIZE * 0.8, BLOCK_SIZE * 0.7, BLOCK_SIZE);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: COLORS.BODY });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    
    // Tail feathers (small cube at the back)
    const tailGeometry = new THREE.BoxGeometry(BLOCK_SIZE * 0.4, BLOCK_SIZE * 0.3, BLOCK_SIZE * 0.2);
    const tailMaterial = new THREE.MeshLambertMaterial({ color: COLORS.BODY });
    const tailMesh = new THREE.Mesh(tailGeometry, tailMaterial);
    tailMesh.position.set(0, BLOCK_SIZE * 0.1, BLOCK_SIZE * 0.5);
    tailMesh.rotation.x = Math.PI / 6; // Tilt up slightly
    
    body.add(bodyMesh);
    body.add(tailMesh);
    
    return body;
  }
  
  // Create the chicken head
  private createHead(): THREE.Group {
    const head = new THREE.Group();
    
    // Head cube
    const headGeometry = new THREE.BoxGeometry(BLOCK_SIZE * 0.6, BLOCK_SIZE * 0.6, BLOCK_SIZE * 0.6);
    const headMaterial = new THREE.MeshLambertMaterial({ color: COLORS.BODY });
    const headMesh = new THREE.Mesh(headGeometry, headMaterial);
    
    // Beak (small cube in front)
    const beakGeometry = new THREE.BoxGeometry(BLOCK_SIZE * 0.2, BLOCK_SIZE * 0.1, BLOCK_SIZE * 0.3);
    const beakMaterial = new THREE.MeshLambertMaterial({ color: COLORS.BEAK });
    const beakMesh = new THREE.Mesh(beakGeometry, beakMaterial);
    beakMesh.position.set(0, -0.1 * BLOCK_SIZE, -0.4 * BLOCK_SIZE);
    
    // Comb (on top of head)
    const combGeometry = new THREE.BoxGeometry(BLOCK_SIZE * 0.1, BLOCK_SIZE * 0.2, BLOCK_SIZE * 0.3);
    const combMaterial = new THREE.MeshLambertMaterial({ color: COLORS.COMB });
    const combMesh = new THREE.Mesh(combGeometry, combMaterial);
    combMesh.position.set(0, 0.4 * BLOCK_SIZE, 0);
    
    // Wattle (under beak)
    const wattleGeometry = new THREE.BoxGeometry(BLOCK_SIZE * 0.1, BLOCK_SIZE * 0.15, BLOCK_SIZE * 0.1);
    const wattleMaterial = new THREE.MeshLambertMaterial({ color: COLORS.COMB });
    const wattleMesh = new THREE.Mesh(wattleGeometry, wattleMaterial);
    wattleMesh.position.set(0, -0.35 * BLOCK_SIZE, -0.3 * BLOCK_SIZE);
    
    // Eyes (small cubes on sides of head)
    const eyeGeometry = new THREE.BoxGeometry(BLOCK_SIZE * 0.1, BLOCK_SIZE * 0.1, BLOCK_SIZE * 0.1);
    const eyeMaterial = new THREE.MeshLambertMaterial({ color: COLORS.EYE });
    
    const leftEyeMesh = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEyeMesh.position.set(-0.25 * BLOCK_SIZE, 0.1 * BLOCK_SIZE, -0.3 * BLOCK_SIZE);
    
    const rightEyeMesh = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEyeMesh.position.set(0.25 * BLOCK_SIZE, 0.1 * BLOCK_SIZE, -0.3 * BLOCK_SIZE);
    
    head.add(headMesh);
    head.add(beakMesh);
    head.add(combMesh);
    head.add(wattleMesh);
    head.add(leftEyeMesh);
    head.add(rightEyeMesh);
    
    return head;
  }
  
  // Create a chicken wing
  private createWing(): THREE.Mesh {
    const wingGeometry = new THREE.BoxGeometry(BLOCK_SIZE * 0.2, BLOCK_SIZE * 0.4, BLOCK_SIZE * 0.7);
    const wingMaterial = new THREE.MeshLambertMaterial({ color: COLORS.WING });
    const wingMesh = new THREE.Mesh(wingGeometry, wingMaterial);
    
    return wingMesh;
  }
  
  // Create a chicken leg
  private createLeg(): THREE.Group {
    const leg = new THREE.Group();
    
    // Upper leg (thin cube)
    const upperLegGeometry = new THREE.BoxGeometry(BLOCK_SIZE * 0.1, BLOCK_SIZE * 0.3, BLOCK_SIZE * 0.1);
    const legMaterial = new THREE.MeshLambertMaterial({ color: COLORS.LEGS });
    const upperLegMesh = new THREE.Mesh(upperLegGeometry, legMaterial);
    
    // Foot (wider cube at bottom)
    const footGeometry = new THREE.BoxGeometry(BLOCK_SIZE * 0.2, BLOCK_SIZE * 0.05, BLOCK_SIZE * 0.3);
    const footMaterial = new THREE.MeshLambertMaterial({ color: COLORS.LEGS });
    const footMesh = new THREE.Mesh(footGeometry, footMaterial);
    
    // Position the foot to point forward (-z direction) instead of backward
    footMesh.position.set(0, -0.15 * BLOCK_SIZE, -0.1 * BLOCK_SIZE);
    
    leg.add(upperLegMesh);
    leg.add(footMesh);
    
    return leg;
  }
  
  // Animate the chicken for walking
  animate(time: number, isMoving: boolean, velocity: THREE.Vector3, inputState: any): void {
    // Handle pecking animation
    if (inputState.peck) {
      // Peck animation - move the head forward and down
      this.head.rotation.x = Math.PI / 4; // Tilt head down
      this.head.position.z = -0.5 * BLOCK_SIZE; // Move head forward
    } else {
      // Reset head position when not pecking
      this.head.rotation.x = 0;
      this.head.position.z = -0.4 * BLOCK_SIZE; // Original position
    }

    if (isMoving) {
        // Use input state directly instead of relying on velocity for direction
        const { forward, backward, left, right } = inputState;
        
        // Set rotation based on key pressed, prioritizing WASD directions
        if (forward && !backward && !left && !right) {
            // W key - Forward/Up
            this.modelContainer.rotation.y = 0;
        } 
        else if (right && !left && !forward && !backward) {
            // D key - Right (fix inverted direction)
            this.modelContainer.rotation.y = Math.PI * 1.5;
        }
        else if (backward && !forward && !left && !right) {
            // S key - Backward/Down
            this.modelContainer.rotation.y = Math.PI;
        }
        else if (left && !right && !forward && !backward) {
            // A key - Left (fix inverted direction)
            this.modelContainer.rotation.y = Math.PI * 0.5;
        }
        // Handle diagonal movement with fixed directions
        else if (forward && right) {
            this.modelContainer.rotation.y = Math.PI * 1.75; // Up-Right
        }
        else if (right && backward) {
            this.modelContainer.rotation.y = Math.PI * 1.25; // Down-Right
        }
        else if (backward && left) {
            this.modelContainer.rotation.y = Math.PI * 0.75; // Down-Left
        }
        else if (left && forward) {
            this.modelContainer.rotation.y = Math.PI * 0.25; // Up-Left
        }
        
        // Animate legs with proper speed based on velocity magnitude
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        const legSpeed = Math.min(speed * 15, 15); // Cap the leg speed
        const legAmplitude = 0.3;
        this.leftLeg.rotation.x = Math.sin(time * legSpeed) * legAmplitude;
        this.rightLeg.rotation.x = Math.sin(time * legSpeed + Math.PI) * legAmplitude;
        
        // Add slight body bob during movement
        this.body.position.y = Math.sin(time * legSpeed * 2) * 0.05 * BLOCK_SIZE;
    } else {
        // Idle animation
        const idleSpeed = 2;
        const idleAmplitude = 0.1;
        this.body.position.y = Math.sin(time * idleSpeed) * idleAmplitude * BLOCK_SIZE;
        this.leftWing.rotation.z = Math.sin(time * idleSpeed) * idleAmplitude;
        this.rightWing.rotation.z = -Math.sin(time * idleSpeed) * idleAmplitude;
    }
  }
} 