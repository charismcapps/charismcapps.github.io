// Utility functions for resizing and dimension calculations

/**
 * Setup resizer for directory pane
 */
export function setupResizer() {
  const resizer = document.getElementById('resizer');
  const directoryPane = document.getElementById('directoryPane');
  const mainContent = document.querySelector('.main-content');

  // Check if elements exist before adding event listeners
  if (!resizer || !directoryPane || !mainContent) {
    console.log('Some DOM elements not found, skipping resizer setup');
    return;
  }

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = directoryPane.offsetWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    const newWidth = startWidth + deltaX;
    const minWidth = 200;
    const maxWidth = mainContent.offsetWidth * 0.7; // Max 70% of content width

    if (newWidth >= minWidth && newWidth <= maxWidth) {
      directoryPane.style.width = `${newWidth}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    }
  });

  // Prevent text selection during resize
  resizer.addEventListener('selectstart', (e) => {
    e.preventDefault();
  });
}

/**
 * Get container dimensions for image pane
 * @param {string} selector - CSS selector for the container (default: '.image-pane')
 * @returns {{width: number, height: number} | null}
 */
export function getContainerDimensions(selector = '.image-pane') {
  const container = document.querySelector(selector);
  if (!container) {
    console.log('Container not found:', selector);
    return null;
  }
  
  return {
    width: container.clientWidth,
    height: container.clientHeight
  };
}

/**
 * Calculate optimal stage and image dimensions based on container and image size
 * @param {number} containerWidth - Container width in pixels
 * @param {number} containerHeight - Container height in pixels
 * @param {HTMLImageElement | null} image - Image element (optional)
 * @param {number} padding - Padding around image (default: 20)
 * @param {number} defaultWidth - Default width when no image (default: 800)
 * @param {number} defaultHeight - Default height when no image (default: 600)
 * @returns {{width: number, height: number}}
 */
export function calculateOptimalSize(containerWidth, containerHeight, image = null, padding = 20, defaultWidth = 800, defaultHeight = 600) {
  const availableWidth = Math.max(400, containerWidth - padding);
  const availableHeight = Math.max(300, containerHeight - padding);
  
  // If we have an image loaded, use its natural dimensions
  if (image && image.naturalWidth && image.naturalHeight) {
    const imageAspectRatio = image.naturalWidth / image.naturalHeight;
    const containerAspectRatio = availableWidth / availableHeight;
    
    let width, height;
    
    if (containerAspectRatio > imageAspectRatio) {
      // Container is wider than image - fit to height
      height = availableHeight;
      width = height * imageAspectRatio;
    } else {
      // Container is taller than image - fit to width
      width = availableWidth;
      height = width / imageAspectRatio;
    }
    
    // Ensure we don't exceed container bounds
    if (width > availableWidth) {
      width = availableWidth;
      height = width / imageAspectRatio;
    }
    if (height > availableHeight) {
      height = availableHeight;
      width = height * imageAspectRatio;
    }
    
    return {
      width: Math.floor(width),
      height: Math.floor(height)
    };
  } else {
    // Default size when no image is loaded
    return {
      width: Math.min(defaultWidth, availableWidth),
      height: Math.min(defaultHeight, availableHeight)
    };
  }
}

/**
 * Update dimensions for image annotation component
 * This function combines getting container dimensions and calculating optimal size
 * @param {HTMLImageElement | null} image - Image element (optional)
 * @param {string} containerSelector - CSS selector for container (default: '.image-pane')
 * @returns {{width: number, height: number} | null} - Calculated dimensions or null if container not found
 */
export function updateImageDimensions(image = null, containerSelector = '.image-pane') {
  const containerDims = getContainerDimensions(containerSelector);
  if (!containerDims) {
    return null;
  }
  
  return calculateOptimalSize(containerDims.width, containerDims.height, image);
}

