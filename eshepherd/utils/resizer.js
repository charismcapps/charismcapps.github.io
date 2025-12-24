// Utility function to setup resizer for directory pane

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

