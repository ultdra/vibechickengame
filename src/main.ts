import { GameScene } from './scenes/game-scene';
import { DEFAULT_GAME_CONFIG } from './constants';

class Game {
  private gameScene: GameScene;
  private animationFrameId: number | null = null;
  
  constructor() {
    // Create the main game scene
    this.gameScene = new GameScene(DEFAULT_GAME_CONFIG);
    
    // Start the game loop
    this.gameLoop();
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  private gameLoop(): void {
    // Update game state
    this.gameScene.update();
    
    // Request next frame
    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }
  
  private setupEventListeners(): void {
    // Add any global event listeners here
    window.addEventListener('unload', this.cleanup.bind(this));
  }
  
  private cleanup(): void {
    // Cancel animation frame if it exists
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    // Clean up any resources
    // (In a larger game, you'd implement proper cleanup for resources)
  }
}

// Initialize the game when the DOM is fully loaded
window.addEventListener('DOMContentLoaded', () => {
  new Game();
}); 