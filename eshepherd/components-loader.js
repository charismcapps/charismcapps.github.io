// Load all component modules and register them
import { ControlSidePanel } from './components/ControlSidePanel.js';
import { ImageAnnotationPanel } from './components/ImageAnnotationPanel.js';
import { CheckInOverlay } from './components/CheckInOverlay.js';

// Expose components globally for registration in index.html
window.Components = {
  ControlSidePanel,
  ImageAnnotationPanel,
  CheckInOverlay
};

