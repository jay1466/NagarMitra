import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

let model = null;

const CATEGORY_MAP = {
  potholes: ['pothole', 'hole', 'road', 'street', 'asphalt', 'damage', 'crack', 'surface'],
  sanitation: ['toilet', 'bathroom', 'sewer', 'drain', 'garbage', 'trash', 'litter', 'dirt', 'waste', 'bin', 'dump', 'manhole'],
  'waste management': ['garbage', 'trash', 'litter', 'waste', 'dumpster', 'bin', 'plastic', 'recycling', 'can'],
  'water supply': ['water', 'pipe', 'leak', 'puddle', 'flood', 'tap', 'sink', 'hose', 'mud'],
  'electricity & lighting': ['pole', 'wire', 'cable', 'electricity', 'light', 'lamp', 'bulb', 'street light', 'power', 'traffic light'],
  miscellaneous: []
};

function mapLabelsToCategory(labels) {
  for (const label of labels) {
    const lowerLabel = label.toLowerCase();
    for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
      if (category === 'miscellaneous') continue;
      if (keywords.some(kw => lowerLabel.includes(kw))) {
        return category;
      }
    }
  }
  return 'miscellaneous';
}

export async function loadModel() {
  if (!model) {
    console.log('Loading MobileNet model...');
    model = await mobilenet.load({ version: 2, alpha: 1.0 });
    console.log('MobileNet model loaded.');
  }
  return model;
}

function decodeImage(buffer) {
  try {
    const rawImageData = jpeg.decode(buffer, { useTArray: true });
    const numPixels = rawImageData.width * rawImageData.height;
    const values = new Int32Array(numPixels * 3);
    for (let i = 0; i < numPixels; i++) {
      values[i * 3 + 0] = rawImageData.data[i * 4 + 0];
      values[i * 3 + 1] = rawImageData.data[i * 4 + 1];
      values[i * 3 + 2] = rawImageData.data[i * 4 + 2];
    }
    return tf.tensor3d(values, [rawImageData.height, rawImageData.width, 3], 'int32');
  } catch (e) {
    try {
      const png = PNG.sync.read(buffer);
      const numPixels = png.width * png.height;
      const values = new Int32Array(numPixels * 3);
      for (let i = 0; i < numPixels; i++) {
        values[i * 3 + 0] = png.data[i * 4 + 0];
        values[i * 3 + 1] = png.data[i * 4 + 1];
        values[i * 3 + 2] = png.data[i * 4 + 2];
      }
      return tf.tensor3d(values, [png.height, png.width, 3], 'int32');
    } catch (err) {
      throw new Error("Unsupported image format");
    }
  }
}

export async function classifyImage(buffer) {
  try {
    const loadedModel = await loadModel();
    const tensor = decodeImage(buffer);
    const predictions = await loadedModel.classify(tensor);
    tensor.dispose();

    if (predictions && predictions.length > 0) {
      const topPrediction = predictions[0];
      const labels = topPrediction.className.split(',').map(s => s.trim());
      const category = mapLabelsToCategory(labels);
      
      return {
        category,
        confidence: topPrediction.probability,
        labels
      };
    }
  } catch (error) {
    console.error('Image classification error:', error);
  }
  
  return {
    category: 'miscellaneous',
    confidence: 1.0,
    labels: []
  };
}
