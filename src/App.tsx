import './App.css';
import RaceSimulation from './components/RaceSimulation'; // Restore old import
// import { Canvas } from '@react-three/fiber'; // No longer needed here
// import { OrbitControls, Box } from '@react-three/drei'; // No longer needed here
// import * as THREE from 'three'; // No longer needed here

// function MinimalTestScene() { ... } // Remove minimal scene

function App() {
  return (
    <RaceSimulation />
  );
}

export default App;
