import * as THREE from 'three';

export interface Player {
  id: number;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  velocity: THREE.Vector3;
  score: number;
  color: string;
  isJumping?: boolean;
  verticalVelocity?: number;
}

export interface FoodItem {
  id: number;
  position: THREE.Vector3;
  type: 'cube' | 'sphere' | 'triangle';
  consumed: boolean;
  color: string;
}

const gravity = -18; // units/sec^2
const jumpVelocity = 8; // initial jump velocity

export function updateBuffetPlayers(
  players: Player[],
  foodItems: FoodItem[],
  delta: number
): { players: Player[]; foodItems: FoodItem[] } {
  const updatedPlayers = players.map(p => ({
    ...p,
    velocity: new THREE.Vector3(p.velocity.x, p.velocity.y, p.velocity.z),
    position: new THREE.Vector3(p.position.x, p.position.y, p.position.z),
    quaternion: new THREE.Quaternion(p.quaternion.x, p.quaternion.y, p.quaternion.z, p.quaternion.w),
    isJumping: p.isJumping,
    verticalVelocity: p.verticalVelocity ?? 0
  }));
  const updatedFoodItems = foodItems.map(f => ({ ...f, position: f.position.clone() }));
  let scoresChanged = false;
  updatedPlayers.forEach(player => {
    // AI movement logic - move toward nearest food
    const availableFoodItems = updatedFoodItems.filter(food => !food.consumed);
    if (availableFoodItems.length === 0) {
      player.velocity.set(0, 0, 0);
      return;
    }
    // Find nearest food in 3D (not just XZ)
    let nearestFood: FoodItem | null = null;
    let nearestDistanceSq = Infinity;
    for (const food of availableFoodItems) {
      const distanceSq = player.position.distanceToSquared(food.position);
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearestFood = food;
      }
    }
    if (!nearestFood) {
      player.velocity.set(0, 0, 0);
      return;
    }
    // Calculate direction to food in 3D
    const direction = new THREE.Vector3().subVectors(nearestFood.position, player.position);
    if (direction.lengthSq() > 0.0001) {
      direction.normalize();
      const speed = 2 + Math.random() * 1;
      player.velocity.x = direction.x * speed;
      player.velocity.y = 0; // Only move horizontally, vertical handled by jump
      player.velocity.z = direction.z * speed;
    } else {
      player.velocity.x = 0;
      player.velocity.z = 0;
    }
    // Look at food
    if (direction.lengthSq() > 0.0001) {
      const lookAtTarget = new THREE.Vector3().copy(player.position).add(direction);
      lookAtTarget.y = player.position.y;
      const targetQuaternion = new THREE.Quaternion();
      const lookAtMatrix = new THREE.Matrix4().lookAt(player.position, lookAtTarget, new THREE.Vector3(0, 1, 0));
      targetQuaternion.setFromRotationMatrix(lookAtMatrix);
      player.quaternion.slerp(targetQuaternion, 0.1);
    }
    // --- JUMP LOGIC ---
    // If food is above player and within 2 units horizontally, jump if not already jumping
    const horizontalDist = Math.sqrt(
      Math.pow(nearestFood.position.x - player.position.x, 2) +
      Math.pow(nearestFood.position.z - player.position.z, 2)
    );
    if (!player.isJumping && nearestFood.position.y > player.position.y + 0.5 && horizontalDist < 2) {
      player.isJumping = true;
      player.verticalVelocity = jumpVelocity;
    }
    // Gravity and jump update
    if (player.isJumping) {
      player.verticalVelocity = (player.verticalVelocity ?? 0) + gravity * delta;
      player.position.y += player.verticalVelocity * delta;
      if (player.position.y <= 0.75) {
        player.position.y = 0.75;
        player.isJumping = false;
        player.verticalVelocity = 0;
      }
    } else {
      player.position.y = 0.75;
      player.verticalVelocity = 0;
    }
    // Update position (XZ)
    player.position.x += player.velocity.x * delta;
    player.position.z += player.velocity.z * delta;
    // Check for food consumption
    if (nearestFood && player.position.distanceToSquared(nearestFood.position) < 1.2 * 1.2) {
      const foodToConsume = updatedFoodItems.find(f => f.id === nearestFood!.id);
      if (foodToConsume && !foodToConsume.consumed) {
        foodToConsume.consumed = true;
        player.score += 1;
        scoresChanged = true;
      }
    }
  });
  return { players: updatedPlayers, foodItems: updatedFoodItems };
} 