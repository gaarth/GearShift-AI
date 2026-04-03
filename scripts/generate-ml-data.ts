// scripts/generate-ml-data.ts
// Generates synthetic ML training data for logistic regression
// Run with: npx tsx scripts/generate-ml-data.ts

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

interface TrainingRow {
  temperature: number;
  vibration: number;
  load: number;
  failed: 0 | 1;
}

function gaussianRandom(mean: number, std: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * std + mean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function generateTrainingData(count: number): TrainingRow[] {
  const data: TrainingRow[] = [];

  for (let i = 0; i < count; i++) {
    // 60% healthy, 40% failed to create balanced-enough dataset
    const isFailed = Math.random() < 0.4;

    let temperature: number;
    let vibration: number;
    let load: number;

    if (isFailed) {
      // Failed machines: higher sensor readings
      temperature = clamp(gaussianRandom(95, 15), 60, 150);
      vibration = clamp(gaussianRandom(7.5, 2), 3, 15);
      load = clamp(gaussianRandom(82, 12), 50, 100);
    } else {
      // Healthy machines: lower sensor readings
      temperature = clamp(gaussianRandom(55, 12), 20, 90);
      vibration = clamp(gaussianRandom(2.5, 1.5), 0, 6);
      load = clamp(gaussianRandom(45, 15), 10, 75);
    }

    // Add noise: some healthy machines have high readings, some failed have lower
    // This creates realistic overlap in the dataset
    const noiseFlip = Math.random() < 0.08; // 8% noise rate
    const failed: 0 | 1 = noiseFlip ? (isFailed ? 0 : 1) : (isFailed ? 1 : 0);

    data.push({
      temperature: Math.round(temperature * 10) / 10,
      vibration: Math.round(vibration * 100) / 100,
      load: Math.round(load * 10) / 10,
      failed,
    });
  }

  return data;
}

// Generate 2500 training rows
const trainingData = generateTrainingData(2500);

// Ensure data directory exists
const dataDir = resolve(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

// Write JSON
const jsonPath = resolve(dataDir, 'training-data.json');
writeFileSync(jsonPath, JSON.stringify(trainingData, null, 2));

// Stats
const failedCount = trainingData.filter(r => r.failed === 1).length;
const healthyCount = trainingData.filter(r => r.failed === 0).length;

console.log('🧠 Synthetic ML Training Data Generated');
console.log(`  📊 Total rows: ${trainingData.length}`);
console.log(`  ✅ Healthy: ${healthyCount} (${((healthyCount / trainingData.length) * 100).toFixed(1)}%)`);
console.log(`  ❌ Failed: ${failedCount} (${((failedCount / trainingData.length) * 100).toFixed(1)}%)`);
console.log(`  📁 Saved to: ${jsonPath}`);
