// scripts/train-ml-model.ts
// Phase 2: Train logistic regression on synthetic data and extract coefficients
// Run with: npx tsx scripts/train-ml-model.ts

import fs from 'fs';
import path from 'path';

interface TrainingRow {
  temperature: number;
  vibration: number;
  load: number;
  failed: 0 | 1;
}

// ─── Load training data ───
const dataPath = path.join(process.cwd(), 'data', 'training-data.json');
const rawData = fs.readFileSync(dataPath, 'utf-8');
const data: TrainingRow[] = JSON.parse(rawData);

console.log(`Loaded ${data.length} training samples`);
console.log(`Positive (failed=1): ${data.filter(d => d.failed === 1).length}`);
console.log(`Negative (failed=0): ${data.filter(d => d.failed === 0).length}`);

// ─── Sigmoid function ───
function sigmoid(x: number): number {
  // Clamp to prevent overflow
  const clamped = Math.max(-500, Math.min(500, x));
  return 1 / (1 + Math.exp(-clamped));
}

// ─── Gradient Descent Logistic Regression ───
// Coefficients: [intercept, temperature, vibration, load]
let coefficients = [0, 0, 0, 0]; // Starting from zeros
const learningRate = 0.001;
const epochs = 1000;
const n = data.length;

console.log('\n─── Training Logistic Regression ───');
console.log(`Learning rate: ${learningRate}, Epochs: ${epochs}\n`);

for (let epoch = 0; epoch < epochs; epoch++) {
  // Compute gradients
  const gradients = [0, 0, 0, 0];
  let totalLoss = 0;

  for (const row of data) {
    const z = coefficients[0] 
      + coefficients[1] * row.temperature 
      + coefficients[2] * row.vibration 
      + coefficients[3] * row.load;
    
    const prediction = sigmoid(z);
    const error = prediction - row.failed;

    // Cross-entropy loss
    if (row.failed === 1) {
      totalLoss -= Math.log(Math.max(prediction, 1e-15));
    } else {
      totalLoss -= Math.log(Math.max(1 - prediction, 1e-15));
    }

    // Accumulate gradients
    gradients[0] += error;                    // intercept
    gradients[1] += error * row.temperature;  // temperature
    gradients[2] += error * row.vibration;    // vibration
    gradients[3] += error * row.load;         // load
  }

  // Update coefficients (gradient descent)
  for (let j = 0; j < 4; j++) {
    coefficients[j] -= learningRate * (gradients[j] / n);
  }

  // Log progress every 100 epochs
  if (epoch % 100 === 0 || epoch === epochs - 1) {
    const avgLoss = totalLoss / n;
    console.log(`Epoch ${epoch.toString().padStart(4)}: Loss = ${avgLoss.toFixed(6)}, Coefficients = [${coefficients.map(c => c.toFixed(6)).join(', ')}]`);
  }
}

// ─── Evaluate accuracy ───
let correct = 0;
let truePositives = 0;
let falsePositives = 0;
let trueNegatives = 0;
let falseNegatives = 0;

for (const row of data) {
  const z = coefficients[0] 
    + coefficients[1] * row.temperature 
    + coefficients[2] * row.vibration 
    + coefficients[3] * row.load;
  
  const prediction = sigmoid(z);
  const predicted = prediction >= 0.5 ? 1 : 0;
  
  if (predicted === row.failed) correct++;
  if (predicted === 1 && row.failed === 1) truePositives++;
  if (predicted === 1 && row.failed === 0) falsePositives++;
  if (predicted === 0 && row.failed === 0) trueNegatives++;
  if (predicted === 0 && row.failed === 1) falseNegatives++;
}

const accuracy = correct / n;
const precision = truePositives / (truePositives + falsePositives) || 0;
const recall = truePositives / (truePositives + falseNegatives) || 0;
const f1 = 2 * (precision * recall) / (precision + recall) || 0;

console.log('\n─── Model Evaluation ───');
console.log(`Accuracy:  ${(accuracy * 100).toFixed(2)}%`);
console.log(`Precision: ${(precision * 100).toFixed(2)}%`);
console.log(`Recall:    ${(recall * 100).toFixed(2)}%`);
console.log(`F1 Score:  ${(f1 * 100).toFixed(2)}%`);

console.log('\n─── Trained Coefficients ───');
console.log(`intercept:   ${coefficients[0].toFixed(6)}`);
console.log(`temperature: ${coefficients[1].toFixed(6)}`);
console.log(`vibration:   ${coefficients[2].toFixed(6)}`);
console.log(`load:        ${coefficients[3].toFixed(6)}`);

// ─── Test with sample inputs ───
console.log('\n─── Sample Predictions ───');
const testCases = [
  { temperature: 50, vibration: 2, load: 40, label: 'Healthy machine' },
  { temperature: 75, vibration: 5, load: 65, label: 'Warning state' },
  { temperature: 90, vibration: 7, load: 80, label: 'Critical state' },
  { temperature: 100, vibration: 9, load: 90, label: 'Near-failure' },
];

for (const test of testCases) {
  const z = coefficients[0] 
    + coefficients[1] * test.temperature 
    + coefficients[2] * test.vibration 
    + coefficients[3] * test.load;
  const risk = sigmoid(z);
  console.log(`${test.label.padEnd(20)} → Risk: ${(risk * 100).toFixed(1)}% (temp=${test.temperature}°C, vib=${test.vibration}mm/s, load=${test.load}%)`);
}

// ─── Output code snippet ───
console.log('\n─── Copy these coefficients to ml-model.ts ───');
console.log(`const COEFFICIENTS = {`);
console.log(`  intercept: ${coefficients[0].toFixed(6)},`);
console.log(`  temperature: ${coefficients[1].toFixed(6)},`);
console.log(`  vibration: ${coefficients[2].toFixed(6)},`);
console.log(`  load: ${coefficients[3].toFixed(6)},`);
console.log(`};`);
