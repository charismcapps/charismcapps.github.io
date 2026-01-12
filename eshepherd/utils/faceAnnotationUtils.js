// Face Annotation Utilities
// Shared utility functions for face labeling and annotation logic

/**
 * Generate a unique key for a face label based on image name and facial area coordinates
 * @param {string} imageName - The name of the image
 * @param {Object} facialArea - Object with x, y, w, h properties
 * @returns {string|null} - The face label key or null if invalid
 */
export function getFaceLabelKey(imageName, facialArea) {
  if (!imageName || !facialArea) return null;
  const x = Math.round(facialArea.x || 0);
  const y = Math.round(facialArea.y || 0);
  const w = Math.round(facialArea.w || 0);
  const h = Math.round(facialArea.h || 0);
  return `${imageName}_${x}_${y}_${w}_${h}`;
}

/**
 * Extract facial area from model embeddings by index
 * @param {Object|string} model - The model object or JSON string
 * @param {number} embeddingIndex - Index of the embedding
 * @returns {Object|null} - The facial area object or null if not found
 */
export function getFacialAreaForIndex(model, embeddingIndex) {
  if (!model) return null;
  try {
    const parsedModel = typeof model === 'string' 
      ? JSON.parse(model) 
      : model;
    
    if (!parsedModel.embeddings || !Array.isArray(parsedModel.embeddings)) {
      return null;
    }
    
    const embedding = parsedModel.embeddings[embeddingIndex];
    return embedding && embedding.facial_area ? embedding.facial_area : null;
  } catch (error) {
    console.error('Error getting facial area:', error);
    return null;
  }
}

/**
 * Get the face label key for the currently selected bounding box
 * @param {Object} selectedFile - The selected file object with name and model
 * @param {number} selectedBoundingBoxIndex - Index of the selected bounding box
 * @returns {string|null} - The face label key or null
 */
export function getCurrentFaceLabelKey(selectedFile, selectedBoundingBoxIndex) {
  if (selectedBoundingBoxIndex === null || !selectedFile) return null;
  const facialArea = getFacialAreaForIndex(selectedFile.model, selectedBoundingBoxIndex);
  if (!facialArea) return null;
  return getFaceLabelKey(selectedFile.name, facialArea);
}

/**
 * Get checked people for a specific bounding box
 * @param {Object} checkedPeopleByBox - Object mapping face label keys to checked people
 * @param {string} faceLabelKey - The face label key
 * @returns {Object} - Object mapping person IDs to checked state
 */
export function getCheckedPeopleForBox(checkedPeopleByBox, faceLabelKey) {
  if (!faceLabelKey) return {};
  return checkedPeopleByBox?.[faceLabelKey] || {};
}

/**
 * Check if a person is checked for a specific point label
 * @param {Object} checkedPeopleByPoint - Object mapping point label IDs to checked people
 * @param {string} pointLabelId - The point label ID
 * @param {string} personId - The person ID
 * @returns {boolean} - True if the person is checked
 */
export function isPersonCheckedForPoint(checkedPeopleByPoint, pointLabelId, personId) {
  if (!pointLabelId || (personId !== 0 && personId !== '0' && !personId)) return false;
  const checkedPeople = checkedPeopleByPoint?.[pointLabelId] || {};
  // Check both string and number versions
  return !!(checkedPeople[personId] || checkedPeople[String(personId)] || checkedPeople[Number(personId)]);
}

/**
 * Check if a person is checked for the current bounding box
 * @param {Object} checkedPeopleByBox - Object mapping face label keys to checked people
 * @param {string} faceLabelKey - The face label key
 * @param {string} personId - The person ID
 * @returns {boolean} - True if the person is checked
 */
export function isPersonChecked(checkedPeopleByBox, faceLabelKey, personId) {
  if (!faceLabelKey || (personId !== 0 && personId !== '0' && !personId)) return false;
  const checkedPeople = getCheckedPeopleForBox(checkedPeopleByBox, faceLabelKey);
  // Check both string and number versions
  return !!(checkedPeople[personId] || checkedPeople[String(personId)] || checkedPeople[Number(personId)]);
}

/**
 * Get the current face label for the selected bounding box
 * @param {Object} selectedFile - The selected file object
 * @param {number} selectedBoundingBoxIndex - Index of the selected bounding box
 * @param {Object} faceLabels - Object mapping face label keys to person objects
 * @returns {Object|null} - The person object or null
 */
export function getCurrentFaceLabel(selectedFile, selectedBoundingBoxIndex, faceLabels) {
  if (selectedBoundingBoxIndex === null || !selectedFile) return null;
  const facialArea = getFacialAreaForIndex(selectedFile.model, selectedBoundingBoxIndex);
  if (!facialArea) return null;
  const key = getFaceLabelKey(selectedFile.name, facialArea);
  return key ? (faceLabels?.[key] || null) : null;
}

/**
 * Get the current point label person
 * @param {string} selectedPointLabelId - The selected point label ID
 * @param {Object} pointLabelPersons - Object mapping point label IDs to person objects
 * @returns {Object|null} - The person object or null
 */
export function getCurrentPointLabel(selectedPointLabelId, pointLabelPersons) {
  if (selectedPointLabelId === null) return null;
  return pointLabelPersons?.[selectedPointLabelId] || null;
}

/**
 * Check if embeddings are stored for the current bounding box
 * @param {Object} selectedFile - The selected file object
 * @param {number} selectedBoundingBoxIndex - Index of the selected bounding box
 * @param {Object} embeddingsStored - Object mapping face label keys to stored state
 * @returns {boolean} - True if embeddings are stored
 */
export function getEmbeddingsStoredState(selectedFile, selectedBoundingBoxIndex, embeddingsStored) {
  if (selectedBoundingBoxIndex === null || !selectedFile) return false;
  const facialArea = getFacialAreaForIndex(selectedFile.model, selectedBoundingBoxIndex);
  if (!facialArea) return false;
  const key = getFaceLabelKey(selectedFile.name, facialArea);
  return key ? (embeddingsStored?.[key] || false) : false;
}

/**
 * Aggregate all checked people from all bounding boxes and point labels
 * @param {Object} checkedPeopleByBox - Object mapping face label keys to checked people
 * @param {Object} checkedPeopleByPoint - Object mapping point label IDs to checked people
 * @returns {string[]} - Array of person IDs
 */
export function getSelectedCheckInPersonIds(checkedPeopleByBox, checkedPeopleByPoint) {
  const allCheckedPeople = {};
  Object.values(checkedPeopleByBox || {}).forEach(checkedPeople => {
    Object.keys(checkedPeople).forEach(personId => {
      // Filter out person id "0" (Unknown) - it should never be added to check-in list
      if (checkedPeople[personId] && personId !== "0" && personId !== 0) {
        allCheckedPeople[personId] = true;
      }
    });
  });
  Object.values(checkedPeopleByPoint || {}).forEach(checkedPeople => {
    Object.keys(checkedPeople).forEach(personId => {
      // Filter out person id "0" (Unknown) - it should never be added to check-in list
      if (checkedPeople[personId] && personId !== "0" && personId !== 0) {
        allCheckedPeople[personId] = true;
      }
    });
  });
  return Object.keys(allCheckedPeople);
}

/**
 * Get household checkbox state for a member
 * @param {Object} checkedPeopleByBox - Object mapping face label keys to checked people
 * @param {string} faceLabelKey - The face label key
 * @param {string} memberId - The member ID
 * @param {Object} householdCheckboxes - Local household checkboxes state (optional)
 * @returns {boolean} - True if the member is checked
 */
export function getHouseholdCheckboxState(checkedPeopleByBox, faceLabelKey, memberId, householdCheckboxes = {}) {
  if (!faceLabelKey || !memberId) return false;
  // Check per-bounding-box list first
  const checkedPeople = getCheckedPeopleForBox(checkedPeopleByBox, faceLabelKey);
  if (checkedPeople.hasOwnProperty(memberId)) {
    return checkedPeople[memberId];
  }
  // Fallback to local state if provided
  return householdCheckboxes[memberId] || false;
}

/**
 * Get point household checkbox state for a member
 * @param {Object} checkedPeopleByPoint - Object mapping point label IDs to checked people
 * @param {string} selectedPointLabelId - The selected point label ID
 * @param {string} memberId - The member ID
 * @param {Object} householdCheckboxes - Local household checkboxes state (optional)
 * @returns {boolean} - True if the member is checked
 */
export function getPointHouseholdCheckboxState(checkedPeopleByPoint, selectedPointLabelId, memberId, householdCheckboxes = {}) {
  if (!selectedPointLabelId || !memberId) return false;
  // Check per-point list first
  const checkedPeople = checkedPeopleByPoint?.[selectedPointLabelId] || {};
  if (checkedPeople.hasOwnProperty(memberId)) {
    return checkedPeople[memberId];
  }
  // Fallback to local state if provided
  return householdCheckboxes[memberId] || false;
}

/**
 * Get selected person checked state
 * @param {Object} selectedFile - The selected file object
 * @param {number} selectedBoundingBoxIndex - Index of the selected bounding box
 * @param {Object} faceLabels - Object mapping face label keys to person objects
 * @param {Object} checkedPeopleByBox - Object mapping face label keys to checked people
 * @param {boolean} selectedPersonChecked - Fallback local state
 * @returns {boolean} - True if the selected person is checked
 */
export function getSelectedPersonCheckedState(selectedFile, selectedBoundingBoxIndex, faceLabels, checkedPeopleByBox, selectedPersonChecked = false) {
  const currentLabel = getCurrentFaceLabel(selectedFile, selectedBoundingBoxIndex, faceLabels);
  if (currentLabel && currentLabel.id) {
    const faceLabelKey = getCurrentFaceLabelKey(selectedFile, selectedBoundingBoxIndex);
    return isPersonChecked(checkedPeopleByBox, faceLabelKey, currentLabel.id);
  }
  // Fallback to local state if no label
  return selectedPersonChecked;
}

/**
 * Get selected point person checked state
 * @param {string} selectedPointLabelId - The selected point label ID
 * @param {Object} pointLabelPersons - Object mapping point label IDs to person objects
 * @param {Object} checkedPeopleByPoint - Object mapping point label IDs to checked people
 * @param {boolean} selectedPersonChecked - Fallback local state
 * @returns {boolean} - True if the selected person is checked
 */
export function getSelectedPointPersonCheckedState(selectedPointLabelId, pointLabelPersons, checkedPeopleByPoint, selectedPersonChecked = false) {
  const currentLabel = getCurrentPointLabel(selectedPointLabelId, pointLabelPersons);
  if (currentLabel && currentLabel.id && selectedPointLabelId) {
    return isPersonCheckedForPoint(checkedPeopleByPoint, selectedPointLabelId, currentLabel.id);
  }
  // Fallback to local state if no label
  return selectedPersonChecked;
}

