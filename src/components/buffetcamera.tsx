import { useThree, useFrame } from '@react-three/fiber';
import { useEffect } from 'react';

interface BuffetCameraProps {
  position?: [number, number, number];
  lookAt?: [number, number, number];
}

export function BuffetCamera({ position = [0, 30, 0], lookAt = [0, 0, 0] }: BuffetCameraProps) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(...position);
    camera.lookAt(...lookAt);
    console.log('[BuffetCamera] Initialized - Position:', camera.position.toArray().join(','), 'LookAt:', lookAt.join(','));
  }, [camera, position, lookAt]);

  useFrame(() => {
    // Keep camera fixed, but log for debugging if needed
    // console.log('[BuffetCamera Frame] Position:', camera.position.toArray().map(n=>n.toFixed(2)).join(','), 'World Y:', camera.matrixWorld.elements[13].toFixed(2));
  });

  return null;
} 