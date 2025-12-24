// Face Recognition Utilities
// Functions for matching faces in images using embeddings

import { decodeEmbeddingFromBase64 } from './embeddingUtils.js';
import { getFaceLabelKey } from './faceAnnotationUtils.js';

/**
 * Match all faces in an image with stored embeddings
 * @param {Object} file - File object with name and model
 * @param {Object} context - Context object containing:
 *   - peopleRetrievalStatus: String - Status of people retrieval
 *   - planningCentrePeople: Array - Array of person records
 *   - faceMatchCache: Object - Cache for face matches
 *   - faceScanningStatus: Object - Status of face scanning per image
 *   - faceScanCount: Object - Count of faces scanned per image
 *   - embeddingIndex: Object - EmbeddingIndex instance
 *   - similarityThreshold: Number - Similarity threshold for matching
 *   - loadAllStoredEmbeddings: Function - Function to load embeddings
 *   - updateState: Function - Function to update Vue state (receives updates object)
 * @returns {Promise<Object>} - Matches object: {embeddingIndex: {personId, similarity, person}}
 */
export async function matchFacesInImage(file, context) {
  if (!file || !file.model || !file.name) {
    return {};
  }
  
  const {
    peopleRetrievalStatus,
    planningCentrePeople,
    faceMatchCache,
    faceScanningStatus,
    faceScanCount,
    embeddingIndex,
    similarityThreshold,
    loadAllStoredEmbeddings,
    updateState
  } = context;
  
  // Only scan faces when planningCentrePeople data is fully loaded
  if (peopleRetrievalStatus !== 'completed' || !planningCentrePeople || planningCentrePeople.length === 0) {
    console.log('Skipping face scan: planningCentrePeople not loaded yet');
    return {};
  }
  
  const imageKey = file.name;
  
  // Check cache first
  if (faceMatchCache[imageKey]) {
    // Get face count from model if not cached
    let faceCount = faceScanCount[imageKey];
    if (!faceCount) {
      try {
        const model = typeof file.model === 'string' 
          ? JSON.parse(file.model) 
          : file.model;
        if (model.embeddings && Array.isArray(model.embeddings)) {
          faceCount = model.embeddings.filter(e => e && e.embedding && e.facial_area).length;
        }
      } catch (e) {
        faceCount = Object.keys(faceMatchCache[imageKey]).length;
      }
    }
    
    // Update state with cached results
    updateState({
      faceScanningStatus: { ...faceScanningStatus, [imageKey]: 'scanned' },
      faceScanCount: { ...faceScanCount, [imageKey]: faceCount }
    });
    
    return faceMatchCache[imageKey];
  }
  
  try {
    // Set scanning status
    updateState({
      faceScanningStatus: { ...faceScanningStatus, [imageKey]: 'scanning' }
    });
    
    const model = typeof file.model === 'string' 
      ? JSON.parse(file.model) 
      : file.model;
    
    if (!model.embeddings || !Array.isArray(model.embeddings)) {
      updateState({
        faceScanningStatus: { ...faceScanningStatus, [imageKey]: 'scanned' }
      });
      return {};
    }
    
    // Load all stored embeddings if not already loaded
    let currentEmbeddingIndex = embeddingIndex;
    if (!currentEmbeddingIndex && loadAllStoredEmbeddings) {
      currentEmbeddingIndex = await loadAllStoredEmbeddings();
    }
    
    if (!currentEmbeddingIndex) {
      updateState({
        faceScanningStatus: { ...faceScanningStatus, [imageKey]: 'scanned' }
      });
      return {};
    }
    
    // Get person records for matching
    const matches = {};
    let faceCount = 0;
    
    // Match each face embedding
    for (let i = 0; i < model.embeddings.length; i++) {
      const embedding = model.embeddings[i];
      
      if (embedding && embedding.embedding && embedding.facial_area) {
        faceCount++;
        
        // Decode embedding if it's base64 encoded
        let embeddingArray = embedding.embedding;
        if (typeof embeddingArray === 'string') {
          // Try to decode from base64
          embeddingArray = decodeEmbeddingFromBase64(embeddingArray);
          if (!embeddingArray) {
            console.warn(`Face ${i}: Could not decode embedding from base64`);
            continue;
          }
        }
        
        // Use Services.embedding.findBestMatch if available, otherwise import it
        let bestMatch = null;
        if (typeof window !== 'undefined' && window.Services && window.Services.embedding && window.Services.embedding.findBestMatch) {
          bestMatch = await window.Services.embedding.findBestMatch(
            currentEmbeddingIndex,
            embeddingArray,
            similarityThreshold
          );
        } else {
          // Fallback: import and use directly
          const { embeddingService } = await import('../services/embeddingService.js');
          bestMatch = await embeddingService.findBestMatch(
            currentEmbeddingIndex,
            embeddingArray,
            similarityThreshold
          );
        }
        
        if (bestMatch) {
          console.log('Found match:', bestMatch);
          // Find person record from planningCentrePeople
          const person = planningCentrePeople.find(p => p.id === bestMatch.personId);
          
          if (person) {
            matches[i] = {
              personId: bestMatch.personId,
              similarity: bestMatch.similarity,
              person: person
            };
            console.log(`Matched face ${i} to person ${person.name} (ID: ${person.id}, similarity: ${bestMatch.similarity})`);
          } else {
            console.warn(`Person with ID ${bestMatch.personId} not found in planningCentrePeople`);
          }
        } else {
          console.log(`No match found for face ${i} (below threshold or no match)`);
        }
      }
    }
    
    // Update state with results
    updateState({
      faceScanCount: { ...faceScanCount, [imageKey]: faceCount },
      faceMatchCache: { ...faceMatchCache, [imageKey]: matches },
      faceScanningStatus: { ...faceScanningStatus, [imageKey]: 'scanned' }
    });
    
    return matches;
  } catch (error) {
    console.error('Error matching faces in image:', error);
    // Set status to scanned even on error
    updateState({
      faceScanningStatus: { ...faceScanningStatus, [imageKey]: 'scanned' }
    });
    return {};
  }
}

/**
 * Apply face matches to face labels
 * @param {Object} file - File object with name and model
 * @param {Object} matches - Matches object: {embeddingIndex: {personId, similarity, person}}
 * @param {Object} context - Context object containing:
 *   - faceLabels: Object - Current face labels
 *   - currentSessionLabels: Object - Current session labels
 *   - setPersonCheckedForBox: Function - Function to set person checked state
 *   - updateState: Function - Function to update Vue state (receives updates object)
 * @returns {void}
 */
export function applyFaceMatches(file, matches, context) {
  if (!file || !matches || Object.keys(matches).length === 0) {
    return;
  }
  
  const {
    faceLabels,
    currentSessionLabels,
    setPersonCheckedForBox,
    updateState
  } = context;
  
  try {
    const model = typeof file.model === 'string' 
      ? JSON.parse(file.model) 
      : file.model;
    
    if (!model.embeddings || !Array.isArray(model.embeddings)) {
      return;
    }
    
    const updatedFaceLabels = { ...faceLabels };
    const updatedCurrentSessionLabels = { ...currentSessionLabels };
    
    // Apply each match
    for (const embeddingIndexStr in matches) {
      const embeddingIndex = parseInt(embeddingIndexStr);
      const match = matches[embeddingIndex];
      
      if (match && match.person && model.embeddings[embeddingIndex]) {
        const embedding = model.embeddings[embeddingIndex];
        const facialArea = embedding.facial_area;
        
        if (facialArea) {
          const key = getFaceLabelKey(file.name, facialArea);
          
          if (key) {
            // Only set the label if it hasn't been manually set by the user
            // This prevents overwriting manual selections when applying cached matches
            if (!updatedFaceLabels[key]) {
              // Set the label
              updatedFaceLabels[key] = match.person;
              updatedCurrentSessionLabels[key] = match.person;
              
              // Mark person as checked for this bounding box (same as manual selection)
              if (match.person.id && setPersonCheckedForBox) {
                setPersonCheckedForBox(key, match.person.id, true);
              }
              
              console.log(`Matched face ${embeddingIndex} to ${match.person.name} (similarity: ${match.similarity.toFixed(3)})`);
            } else {
              console.log(`Skipping match for face ${embeddingIndex}: manual selection already exists`);
            }
          }
        }
      }
    }
    
    // Update state
    updateState({
      faceLabels: updatedFaceLabels,
      currentSessionLabels: updatedCurrentSessionLabels
    });
  } catch (error) {
    console.error('Error applying face matches:', error);
  }
}

