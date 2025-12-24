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

