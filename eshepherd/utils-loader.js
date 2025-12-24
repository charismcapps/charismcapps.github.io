// Load all utility modules and expose them as Utils object
import * as embeddingUtils from './utils/embeddingUtils.js';
import * as sessionUtils from './utils/sessionUtils.js';
import * as faceAnnotationUtils from './utils/faceAnnotationUtils.js';
import * as faceRecognitionUtils from './utils/faceRecognition.js';
import { setupResizer } from './utils/resizer.js';
import { firebaseConfig, auth, database } from './config/firebase.js';
import { authService } from './services/authService.js';
import { fileService } from './services/fileService.js';
import { planningCenterService } from './services/planningCenterService.js';
import { embeddingService } from './services/embeddingService.js';

// Expose Firebase objects globally for use in index.html
// Firebase is initialized in config/firebase.js
window.firebaseAuth = auth;
window.firebaseDatabase = database;

// Expose services globally
window.Services = {
  auth: authService,
  file: fileService,
  planningCenter: planningCenterService,
  embedding: embeddingService
};

// Create Utils object with all utility functions
window.Utils = {
  // Embedding utilities
  decodeEmbeddingFromBase64: embeddingUtils.decodeEmbeddingFromBase64,
  encodeEmbeddingToBase64: embeddingUtils.encodeEmbeddingToBase64,
  
  // Session utilities
  getSessionValidityRange: sessionUtils.getSessionValidityRange,
  isSessionValid: sessionUtils.isSessionValid,
  formatLocalDateTimeNoTz: sessionUtils.formatLocalDateTimeNoTz,
  getLocalTimeZoneName: sessionUtils.getLocalTimeZoneName,
  getSessionValidTimeRangeString: sessionUtils.getSessionValidTimeRangeString,
  getSessionInvalidMessage: sessionUtils.getSessionInvalidMessage,
  
  // Face annotation utilities
  getFaceLabelKey: faceAnnotationUtils.getFaceLabelKey,
  getFacialAreaForIndex: faceAnnotationUtils.getFacialAreaForIndex,
  getCurrentFaceLabelKey: faceAnnotationUtils.getCurrentFaceLabelKey,
  getCheckedPeopleForBox: faceAnnotationUtils.getCheckedPeopleForBox,
  isPersonChecked: faceAnnotationUtils.isPersonChecked,
  isPersonCheckedForPoint: faceAnnotationUtils.isPersonCheckedForPoint,
  getCurrentFaceLabel: faceAnnotationUtils.getCurrentFaceLabel,
  getCurrentPointLabel: faceAnnotationUtils.getCurrentPointLabel,
  getEmbeddingsStoredState: faceAnnotationUtils.getEmbeddingsStoredState,
  getSelectedCheckInPersonIds: faceAnnotationUtils.getSelectedCheckInPersonIds,
  getHouseholdCheckboxState: faceAnnotationUtils.getHouseholdCheckboxState,
  getPointHouseholdCheckboxState: faceAnnotationUtils.getPointHouseholdCheckboxState,
  getSelectedPersonCheckedState: faceAnnotationUtils.getSelectedPersonCheckedState,
  getSelectedPointPersonCheckedState: faceAnnotationUtils.getSelectedPointPersonCheckedState,
  
  // Face recognition utilities
  matchFacesInImage: faceRecognitionUtils.matchFacesInImage,
  applyFaceMatches: faceRecognitionUtils.applyFaceMatches,
  
  // Resizer utility
  setupResizer: setupResizer
};

