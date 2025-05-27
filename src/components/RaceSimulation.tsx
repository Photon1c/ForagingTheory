import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, KeyboardControls, useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { BuffetCamera } from './buffetcamera';
import { updateBuffetPlayers } from './buffetplayers';
import React, { useCallback } from 'react';

// Types for our simulation
interface Player {
  id: number;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  velocity: THREE.Vector3;
  score: number;
  color: string;
  isJumping?: boolean;
  verticalVelocity?: number;
}

interface FoodItem {
  id: number;
  position: THREE.Vector3;
  type: 'cube' | 'sphere' | 'triangle';
  consumed: boolean;
  color: string;
}

// Player component
const PlayerMesh: React.FC<{ player: Player }> = ({ player }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(player.position);
      meshRef.current.quaternion.copy(player.quaternion);
    }
  });

  return (
    <mesh ref={meshRef} position={player.position} scale={[0.5, 0.5, 0.5]}>
      <coneGeometry args={[0.5, 1.5, 8]} />
      <meshStandardMaterial color={player.color} />
    </mesh>
  );
};

// Food item component
const FoodItemMesh: React.FC<{ item: FoodItem }> = ({ item }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const position = item.position.clone();

  if (item.consumed) return null;

  return (
    <mesh ref={meshRef} position={position} scale={[0.5, 0.5, 0.5]}>
      {item.type === 'cube' && <boxGeometry args={[0.8, 0.8, 0.8]} />}
      {item.type === 'sphere' && <sphereGeometry args={[0.5, 16, 16]} />}
      {item.type === 'triangle' && <tetrahedronGeometry args={[0.6]} />}
      <meshStandardMaterial color={item.color} />
    </mesh>
  );
};

// Keyboard controls map
const keyboardMap = [
  { name: 'moveForward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'moveBackward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'moveLeft', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'moveRight', keys: ['ArrowRight', 'KeyD'] },
];

// CameraController for WASD/arrow key movement
const moveSpeed = 0.5;
const keyMap: { [key: string]: [number, number, number] } = {
  ArrowUp:    [0, 0, -1],
  ArrowDown:  [0, 0, 1],
  ArrowLeft:  [-1, 0, 0],
  ArrowRight: [1, 0, 0],
  KeyW:       [0, 0, -1],
  KeyS:       [0, 0, 1],
  KeyA:       [-1, 0, 0],
  KeyD:       [1, 0, 0],
};

// Referee movement logic (WASD/arrow keys)
function RefereeMover({ refereeRef }: { refereeRef: React.MutableRefObject<THREE.Object3D | null> }) {
  const keys = useRef<{[key: string]: boolean}>({});
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
  useFrame(() => {
    let move = [0, 0, 0];
    for (const code in keyMap) {
      if (keys.current[code]) {
        move = [
          move[0] + keyMap[code][0],
          move[1] + keyMap[code][1],
          move[2] + keyMap[code][2],
        ];
      }
    }
    if (refereeRef.current) {
      if (move[0] !== 0 || move[1] !== 0 || move[2] !== 0) {
        const dir = new THREE.Vector3(move[0], move[1], move[2]).normalize().multiplyScalar(moveSpeed);
        refereeRef.current.position.add(dir);
      }
    }
  });
  return null;
}

// --- Add a constant for map boundaries ---
const MAP_SIZE = 8; // Map is from -MAP_SIZE to +MAP_SIZE in x and z

// --- Update Player AI logic to respect boundaries ---
// (We will pass MAP_SIZE to updateBuffetPlayers and clamp positions after update)

const INSTRUCTIONS = `\n[Base Template] This is a foundational project for foraging theory experiments. Advanced concepts and features are in development.\n\n🍽️ Welcome to Buffet Race! 🍽️\n\nThis simulation is inspired by foraging theory and natural systems.\n\nApplications & Concepts:\n\n- 🦉 Foraging Theory: Study how agents (players) search for and consume resources (food) in a shared environment.\n- 🧑‍🤝‍🧑 Producer-Scrounger Models: Explore how some agents find food while others exploit their discoveries.\n- 🦆 Ideal Free Distribution: See how agents distribute themselves among food patches to maximize intake.\n- 🌳 Marginal Value Theorem: Understand when agents should leave a depleted patch for a richer one.\n- 🏗️ Asset Modeling: Use this as a base for 3D asset or crowd simulation.\n- 🌱 Natural Systems: Model animal, human, or robot foraging, resource competition, and more!\n\nControls:\n- Press 'Start' to begin the race.\n- Use the parameters bar to set player and food count.\n- Press 'i' to toggle these instructions.\n- Watch the scorecard for live results!\n\nHave fun exploring! 🚀`;

// --- Main component ---
const RaceSimulation: React.FC = () => {
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [foodAmount, setFoodAmount] = useState<number>(100);
  const [scores, setScores] = useState<number[]>([]);
  const [isSimulationRunning, setIsSimulationRunning] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(60); // Initial time: 60 seconds
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [showTitle, setShowTitle] = useState<boolean>(true);
  const timerRef = useRef<number | null>(null);
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);
  const refereeRef = useRef<THREE.Object3D>(null);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);

  const gameDuration = 60; // seconds

  // Hide the title after 15 seconds
  useEffect(() => {
    if (showTitle) {
      const t = setTimeout(() => setShowTitle(false), 15000);
      return () => clearTimeout(t);
    }
  }, [showTitle]);

  useEffect(() => {
    if (isSimulationRunning && !isGameOver) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current!);
            setIsGameOver(true);
            setIsSimulationRunning(false);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isSimulationRunning, isGameOver]);

  // --- Pass foodAmount to Simulation and reset on start ---
  const startSimulation = () => {
    setScores(Array(playerCount).fill(0));
    setTimeLeft(gameDuration);
    setIsGameOver(false);
    setIsSimulationRunning(true);
  };

  const handlePlayAgain = () => {
    startSimulation();
  };

  // Callback for Simulation to notify when food runs out
  const handleFoodDepleted = () => {
    setIsGameOver(true);
    setIsSimulationRunning(false);
  };

  // Keyboard handler for instructions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'i' || e.key === 'I') {
        setShowInstructions((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="w-full h-screen bg-gray-900 text-white relative overflow-hidden flex flex-col" style={{ margin: 0, padding: 0 }}>
      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
          <div className="bg-white text-gray-900 rounded-lg shadow-2xl p-8 max-w-lg w-full relative animate-fade-in">
            <button onClick={() => setShowInstructions(false)} className="absolute top-2 right-2 text-2xl text-gray-500 hover:text-gray-800">×</button>
            <h2 className="text-2xl font-bold mb-4 text-center">🍽️ Buffet Race Instructions 🍽️</h2>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">{INSTRUCTIONS}</pre>
          </div>
        </div>
      )}
      {/* Fixed parameters bar at the top, only before race starts */}
      {!isSimulationRunning && !isGameOver && (
        <div className="w-full flex flex-row items-center px-2 bg-white z-10">
          <label htmlFor="playerCount" className="text-xs mr-1 whitespace-nowrap text-gray-800">Players:</label>
          <input
            id="playerCount"
            type="number"
            min="1"
            max="8"
            value={playerCount}
            onChange={(e) => setPlayerCount(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
            className="px-1 py-0.5 rounded bg-gray-100 text-gray-900 border border-gray-400 w-10 text-center text-xs"
            style={{ height: 28 }}
          />
          <label htmlFor="foodAmount" className="text-xs ml-2 mr-1 whitespace-nowrap text-gray-800">Food:</label>
          <input
            id="foodAmount"
            type="number"
            min="1"
            max="500"
            value={foodAmount}
            onChange={(e) => setFoodAmount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
            className="px-1 py-0.5 rounded bg-gray-100 text-gray-900 border border-gray-400 w-12 text-center text-xs"
            style={{ height: 28 }}
          />
          <button
            onClick={startSimulation}
            className="ml-2 rounded bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors border border-blue-700"
            style={{ height: 28, padding: '0 14px', minWidth: 0, lineHeight: 1.1 }}
          >
            Start
          </button>
          <span className="text-xs font-bold tracking-widest text-gray-800 select-none ml-4" style={{ transition: 'opacity 0.7s' }}>Buffet Race!</span>
        </div>
      )}
      {/* Top horizontal scoreboard bar with player scores, timer, and right-aligned label */}
      {(isSimulationRunning || isGameOver) && (
        <div className="w-full flex flex-row items-center px-2 py-1" style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb', fontSize: 13, minHeight: 28, position: 'relative' }}>
          <div className="flex-1 flex flex-row items-center justify-center gap-x-4">
            {scores.map((score, index) => {
              const colorEmojis = ['🔵', '🟢', '🟣', '🟡', '🟠', '🟤', '🔴', '⚫'];
              return (
                <span key={index} className="flex items-center gap-x-1">
                  <span>{colorEmojis[index % colorEmojis.length]}</span>
                  <span className="font-bold">P{index + 1}:</span>
                  <span className="font-mono">{score}</span>
                </span>
              );
            })}
            <span className="flex items-center gap-x-1 font-mono">
              <span>⏱</span>
              <span>{String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}</span>
            </span>
          </div>
          <div className="absolute right-2 top-1 flex items-center" style={{ fontSize: 13, fontWeight: 600, color: '#1976d2', whiteSpace: 'nowrap' }}>
            Foraging Algorithms: Buffet Race experiment
          </div>
        </div>
      )}
      {/* Full-width, full-height canvas below scoreboard */}
      <div className="w-full flex-1 flex items-center justify-center relative" style={{ height: 'calc(100vh - 28px)', minHeight: 0 }}>
        {(isSimulationRunning || isGameOver) && (
          <>
            <Canvas style={{ width: '100%', height: '100%', display: 'block' }} camera={{ position: [12, 10, 12], up: [0, 1, 0], fov: 60, near: 0.1, far: 1000 }}>
              <ambientLight intensity={0.5} />
              <OrbitControls target={[0, 0.5, 0]} enablePan={false} enableZoom={true} />
              <Simulation playerCount={playerCount} setScores={setScores} isGameOver={isGameOver} isSimulationRunning={isSimulationRunning} foodAmount={foodAmount} mapSize={MAP_SIZE} onFoodDepleted={handleFoodDepleted} />
            </Canvas>
            {/* Blinking instructions prompt at bottom center */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
              <span className="text-xs font-semibold text-white bg-black bg-opacity-70 px-4 py-2 rounded animate-blink">Press <b>I</b> for instructions</span>
            </div>
            {/* Game Over Overlay */}
            {isGameOver && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 z-20">
                <h1 className="text-4xl font-bold mb-4">Race Over!</h1>
                <button
                  onClick={handlePlayAgain}
                  className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-lg text-xl font-semibold transition-colors"
                >
                  Play Again?
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// --- Update Simulation to accept foodAmount and mapSize, and clamp player positions ---
const Simulation: React.FC<{ 
  playerCount: number, 
  setScores: React.Dispatch<React.SetStateAction<number[]>>,
  isGameOver: boolean,
  isSimulationRunning: boolean,
  foodAmount: number,
  mapSize: number,
  onFoodDepleted: () => void
}> = ({ playerCount, setScores, isGameOver, isSimulationRunning, foodAmount, mapSize, onFoodDepleted }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const gravity = -18; // units/sec^2
  const jumpVelocity = 8; // initial jump velocity

  // Initialize simulation
  useEffect(() => {
    // Create players
    const newPlayers: Player[] = [];
    const playerColors = [
      '#FF5733', '#33FF57', '#3357FF', '#F3FF33', 
      '#FF33F3', '#33FFF3', '#F333FF', '#FFA533'
    ];
    for (let i = 0; i < playerCount; i++) {
      const angle = (i / playerCount) * Math.PI * 2;
      const radius = mapSize * 0.75;
      newPlayers.push({
        id: i,
        position: new THREE.Vector3(
          Math.cos(angle) * radius,
          0.5,
          Math.sin(angle) * radius
        ),
        quaternion: new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          -angle
        ),
        velocity: new THREE.Vector3(0, 0, 0),
        score: 0,
        color: playerColors[i % playerColors.length],
        isJumping: false,
        verticalVelocity: 0,
      });
    }
    setPlayers(newPlayers);
    // Create food items in 3D space (on ground)
    const newFoodItems: FoodItem[] = [];
    const foodTypes: ('cube' | 'sphere' | 'triangle')[] = ['cube', 'sphere', 'triangle'];
    const foodColors = ['#FF9999', '#99FF99', '#9999FF', '#FFFF99', '#FF99FF', '#99FFFF'];
    for (let i = 0; i < foodAmount; i++) {
      // Clamp spawn to inside the ground plane (avoid edges)
      const min = -mapSize + 0.5;
      const max = mapSize - 0.5;
      newFoodItems.push({
        id: i,
        position: new THREE.Vector3(
          Math.random() * (max - min) + min, // x: min to max
          0.5,
          Math.random() * (max - min) + min // z: min to max
        ),
        type: foodTypes[Math.floor(Math.random() * foodTypes.length)],
        consumed: false,
        color: foodColors[Math.floor(Math.random() * foodColors.length)]
      });
    }
    setFoodItems(newFoodItems);
  }, [playerCount, foodAmount, mapSize]);

  // Game loop
  useFrame((_, delta) => {
    if (players.length === 0 || foodItems.length === 0) return;
    let updatedPlayers = players;
    let updatedFoodItems = foodItems;
    if (isSimulationRunning && !isGameOver) {
      // Only update positions and food if the game is running
      const result = updateBuffetPlayers(players, foodItems, delta);
      updatedPlayers = result.players;
      updatedFoodItems = result.foodItems;
      // Clamp player positions to map boundaries
      updatedPlayers = updatedPlayers.map(p => {
        p.position.x = Math.max(-mapSize, Math.min(mapSize, p.position.x));
        p.position.z = Math.max(-mapSize, Math.min(mapSize, p.position.z));
        return p;
      });
      setPlayers(updatedPlayers);
      setFoodItems(updatedFoodItems);
      // If all food is consumed, trigger game over
      if (updatedFoodItems.every(item => item.consumed)) {
        onFoodDepleted();
      }
    }
    // Always update scores for the overlay
    setScores(updatedPlayers.map(p => p.score));
  });

  return (
    <>
      {/* Environment */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 10]} intensity={1} />
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[mapSize * 2, mapSize * 2]} />
        <meshStandardMaterial color="#444466" />
      </mesh>
      {/* Optional: Add a thick base for visual effect */}
      <mesh position={[0, -2, 0]}>
        <boxGeometry args={[mapSize * 2, 3, mapSize * 2]} />
        <meshStandardMaterial color="#222233" />
      </mesh>
      {/* Players */}
      {players.map(player => (
        <PlayerMesh key={player.id} player={player} />
      ))}
      {/* Food Items */}
      {foodItems.map(item => (
        !item.consumed && <FoodItemMesh key={item.id} item={item} />
      ))}
    </>
  );
};

export default RaceSimulation;
