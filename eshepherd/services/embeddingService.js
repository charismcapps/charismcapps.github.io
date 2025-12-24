// Embedding service for face recognition
import { database } from '../config/firebase.js';
import { decodeEmbeddingFromBase64 } from '../utils/embeddingUtils.js';

export const embeddingService = {
  /**
   * Load all embeddings from Firebase and create EmbeddingIndex
   */
  async loadAllStoredEmbeddings(ClientVectorSearchModule, forceReload = false, currentIndex = null) {
    if (currentIndex !== null && !forceReload) {
      // Already loaded
      return currentIndex;
    }
    
    try {
      // Dynamically import client-vector-search from esm.sh if not provided
      let VectorSearchModule = ClientVectorSearchModule;
      if (!VectorSearchModule) {
        VectorSearchModule = await import('https://esm.run/client-vector-search');
      }
      
      const { EmbeddingIndex } = VectorSearchModule;
      
      if (!EmbeddingIndex) {
        console.error('EmbeddingIndex not found in client-vector-search module');
        return null;
      }
      
      const embeddingsRef = database.ref('eshepherd/embeddings');
      const snapshot = await embeddingsRef.once('value');
      const allEmbeddings = snapshot.val();
      
      if (!allEmbeddings) {
        // Create empty index
        return new EmbeddingIndex([]);
      }
      
      // Process all embeddings: {personId: {index: base64String}}
      const indexObjects = [];
      for (const personId in allEmbeddings) {
        const personEmbeddings = allEmbeddings[personId];
        
        for (const index in personEmbeddings) {
          const base64Embedding = personEmbeddings[index];
          const embeddingArray = decodeEmbeddingFromBase64(base64Embedding);
          
          if (embeddingArray && Array.isArray(embeddingArray)) {
            indexObjects.push({
              id: `${personId}_${index}`,
              personId: personId,
              embedding: embeddingArray
            });
          }
        }
      }
      
      // Create EmbeddingIndex
      const embeddingIndex = new EmbeddingIndex(indexObjects);
      
      console.log(`Loaded all stored embeddings: ${indexObjects.length} embeddings from ${Object.keys(allEmbeddings).length} people`);
      return embeddingIndex;
    } catch (error) {
      console.error('Error loading all stored embeddings:', error);
      return null;
    }
  },

  /**
   * Search for top K matches in embedding index
   */
  async searchEmbeddings(embeddingIndex, queryEmbedding, topK = 5) {
    if (!embeddingIndex || !queryEmbedding) {
      return [];
    }
    
    try {
      const results = await embeddingIndex.search(queryEmbedding, { topK });
      return results || [];
    } catch (error) {
      console.error('Error searching embeddings:', error);
      return [];
    }
  },

  /**
   * Get embeddings count for a person
   */
  async getEmbeddingsCount(personId) {
    if (!personId) return 0;
    
    try {
      const embeddingsRef = database.ref(`eshepherd/embeddings/${personId}`);
      const snapshot = await embeddingsRef.once('value');
      const embeddings = snapshot.val();
      return embeddings ? Object.keys(embeddings).length : 0;
    } catch (error) {
      console.error('Error fetching embeddings count:', error);
      return 0;
    }
  },

  /**
   * Check if embedding exists in database
   */
  async checkEmbeddingInDB(personId, currentEmbeddingData) {
    if (!personId || !currentEmbeddingData) {
      return { exists: false, count: 0 };
    }
    
    try {
      const embeddingsRef = database.ref(`eshepherd/embeddings/${personId}`);
      const snapshot = await embeddingsRef.once('value');
      const embeddings = snapshot.val();
      
      const count = embeddings ? Object.keys(embeddings).length : 0;
      
      if (!embeddings || count === 0) {
        return { exists: false, count: 0 };
      }
      
      // currentEmbeddingData is already a base64 string, use it directly
      // Check if current embedding exists in DB
      const embeddingValues = Object.values(embeddings);
      const exists = embeddingValues.some(storedEmbedding => storedEmbedding === currentEmbeddingData);
      
      return { exists, count };
    } catch (error) {
      console.error('Error checking embedding in DB:', error);
      return { exists: false, count: 0 };
    }
  },

  /**
   * Find best match for a query embedding
   * @param {Object} embeddingIndex - The EmbeddingIndex instance
   * @param {Array} queryEmbedding - The query embedding array
   * @param {number} similarityThreshold - Minimum similarity threshold (default: 0.80)
   * @returns {Object|null} - Match object with personId, similarity, and embedding, or null if no match
   */
  async findBestMatch(embeddingIndex, queryEmbedding, similarityThreshold = 0.80) {
    if (!queryEmbedding) {
      console.error('findBestMatch: queryEmbedding is null or undefined');
      return null;
    }
    
    if (!Array.isArray(queryEmbedding)) {
      console.error('findBestMatch: queryEmbedding is not an array. Type:', typeof queryEmbedding, 'Value:', queryEmbedding);
      return null;
    }
    
    if (queryEmbedding.length === 0) {
      console.error('findBestMatch: queryEmbedding is an empty array');
      return null;
    }
    
    if (!embeddingIndex) {
      console.error('findBestMatch: embeddingIndex is null. Has it been initialized?');
      return null;
    }
    
    try {
      // Search for top match
      const results = await embeddingIndex.search(queryEmbedding, { topK: 1 });
      
      if (results && results.length > 0) {
        const bestResult = results[0];
        
        // Check if similarity is above threshold
        // client-vector-search returns similarity scores (typically 0-1 for cosine similarity)
        // The result might have similarity, score, or distance (inverted)
        let similarity = bestResult.similarity || bestResult.score || 0;
        
        // If distance is provided instead, convert to similarity (assuming cosine distance)
        if (bestResult.distance !== undefined && similarity === 0) {
          similarity = 1 - bestResult.distance; // Convert distance to similarity
        }
        
        // Extract personId from the result
        let personId = null;
        
        // Try different ways to get personId
        if (bestResult.personId) {
          personId = bestResult.personId;
        } else if (bestResult.id) {
          // Extract from id format: "personId_index"
          personId = bestResult.id.split('_')[0];
        } else if (bestResult.object && bestResult.object.personId) {
          personId = bestResult.object.personId;
        } else if (bestResult.item && bestResult.item.personId) {
          personId = bestResult.item.personId;
        }
        
        console.log('Extracted personId:', personId, 'similarity:', similarity);
        
        if (similarity >= similarityThreshold && personId) {
          return {
            personId: personId,
            similarity: similarity,
            embedding: bestResult.embedding || bestResult.object?.embedding || bestResult.item?.embedding
          };
        } else {
          console.log(`Match below threshold: similarity=${similarity}, threshold=${similarityThreshold}, personId=${personId}`);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding best match:', error);
      return null;
    }
  },

  /**
   * Store embedding in database
   */
  async storeEmbedding(personId, embeddingData) {
    if (!personId || !embeddingData) {
      return { success: false, error: 'Missing personId or embeddingData' };
    }
    
    try {
      // Get reference to embeddings for this person
      const embeddingsRef = database.ref(`eshepherd/embeddings/${personId}`);
      
      // Get current embeddings to find next index
      const snapshot = await embeddingsRef.once('value');
      const embeddings = snapshot.val() || {};
      
      // Find next available index
      const existingIndices = Object.keys(embeddings).map(k => parseInt(k)).filter(n => !isNaN(n));
      const nextIndex = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 0;
      
      // Store the embedding (already base64)
      await database.ref(`eshepherd/embeddings/${personId}/${nextIndex}`).set(embeddingData);
      
      const newCount = Object.keys(embeddings).length + 1;
      return { success: true, index: nextIndex, count: newCount, error: null };
    } catch (error) {
      console.error('Error storing embedding:', error);
      return { success: false, error: error.message };
    }
  }
};

