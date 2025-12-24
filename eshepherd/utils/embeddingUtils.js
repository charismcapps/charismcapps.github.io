// Utility functions for embedding operations

/**
 * Decode base64 embedding to Float32Array (numpy float32 array equivalent)
 * Python encoding: np.array(embedding, dtype=np.float32).tobytes() -> base64.b64encode().decode('utf-8')
 */
export function decodeEmbeddingFromBase64(base64String) {
  if (!base64String || typeof base64String !== 'string') {
    return null;
  }
  
  try {
    // Decode base64 to get the binary bytes (same as Python base64.b64decode)
    const binaryString = atob(base64String);
    
    // Convert binary string to Uint8Array
    // This represents the raw bytes from numpy array.tobytes()
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Check if length is valid for Float32Array (must be multiple of 4 bytes)
    // Each float32 is 4 bytes
    if (bytes.length % 4 !== 0) {
      console.error('Invalid embedding length:', bytes.length, 'must be multiple of 4 bytes for Float32Array');
      return null;
    }
    
    if (bytes.length === 0) {
      console.error('Empty embedding data');
      return null;
    }
    
    // Convert bytes to Float32Array
    // Float32Array automatically handles byte order (little-endian by default, same as numpy)
    // This recreates the numpy float32 array from the binary bytes
    const float32Array = new Float32Array(bytes.buffer);
    
    // Convert to regular JavaScript array for compatibility with vector search library
    const result = Array.from(float32Array);
    
    // Validate the result
    if (result.length === 0) {
      console.error('Decoded embedding array is empty');
      return null;
    }
    
    // Verify all values are valid numbers (should be float32 values)
    if (!result.every(v => typeof v === 'number' && !isNaN(v) && isFinite(v))) {
      console.error('Decoded embedding contains invalid numbers');
      return null;
    }
    
    return result;
  } catch (error) {
    console.error('Error decoding base64 embedding to Float32Array:', error.message, 'base64 preview:', base64String.substring(0, 50));
    return null;
  }
}

/**
 * Encode embedding to base64 string
 */
export function encodeEmbeddingToBase64(embedding) {
  // Convert embedding array to base64 string
  if (Array.isArray(embedding)) {
    // Convert array to JSON string, then to base64
    const jsonString = JSON.stringify(embedding);
    return btoa(jsonString);
  } else if (typeof embedding === 'string') {
    // Already a string, encode to base64
    return btoa(embedding);
  }
  // If it's already base64 or other format, return as is
  return embedding;
}

