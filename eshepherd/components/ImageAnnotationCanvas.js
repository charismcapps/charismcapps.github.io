// ImageAnnotationCanvas Component - Konva-based image annotation with face detection
export const ImageAnnotationCanvas = {
  name: 'ImageAnnotationCanvas',
  props: {
    imageSrc: String,
    annotations: Array,
    selectedFile: Object,
    showFaces: Boolean,
    faceLabels: Object,
    selectedBoundingBoxIndex: Number,
    selectedOverlapBox: Object,
    pointLabels: Object,
    selectedPointLabelId: String,
    pointLabelPersons: Object,
    checkedPeopleByPoint: Object,
    getFaceLabelKey: Function,
    checkedPeopleByBox: Object,
    planningCentrePeople: Array,
    getHouseholdMembers: Function,
    currentFolderFiles: Array,
    fetchModelData: Function
  },
  emits: [
    'face-box-click',
    'point-label-click',
    'point-label-create',
    'loading-change',
    'overlap-face-box-click',
    'overlap-box-deselected'
  ],
  data() {
    return {
      stageConfig: { width: 800, height: 600 },
      imageConfig: { image: null, x: 0, y: 0, width: 800, height: 600 },
      isLoading: false,
      containerWidth: 0,
      containerHeight: 0,
      selectedBoxOpacity: 1,
      selectedPointOpacity: 1,
      blinkInterval: null,
      pointBlinkInterval: null,
      showShiftTooltip: false,
      tooltipX: 0,
      tooltipY: 0,
      // Field of view configuration
      fovConfig: {
        width: 7.75,  // degrees
        height: 4.5  // degrees
      },
      // Time threshold for overlap detection (in seconds)
      overlapTimeThreshold: 15,  // seconds
      // Track which files we've already requested model data for
      requestedModelFiles: new Set(),
      // Map to store overlap box data for click handlers
      overlapBoxClickHandlers: new Map()
    };
  },
  computed: {
    facialAreaBoxes() {
      // Return empty array if showFaces is false
      if (!this.showFaces) {
        return [];
      }
      
      if (!this.selectedFile || !this.selectedFile.model || !this.imageConfig.image) {
        return [];
      }
      
      try {
        const model = typeof this.selectedFile.model === 'string' 
          ? JSON.parse(this.selectedFile.model) 
          : this.selectedFile.model;
        
        if (!model.embeddings || !Array.isArray(model.embeddings)) {
          return [];
        }
        
        const img = this.imageConfig.image;
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        const displayWidth = this.imageConfig.width;
        const displayHeight = this.imageConfig.height;
        
        // Calculate scale factors
        const scaleX = displayWidth / naturalWidth;
        const scaleY = displayHeight / naturalHeight;
        
        const embeddingsWithFaces = model.embeddings
          .map((embedding, idx) => ({ embedding, index: idx }))
          .filter(({ embedding }) => {
            // Filter out embeddings without facial_area
            if (!embedding.facial_area) {
              return false;
            }
            // Exclude bounding boxes that are approximately the same size as the entire image
            // Use a threshold of 10 pixels
            const area = embedding.facial_area;
            const areaWidth = area.w || 0;
            const areaHeight = area.h || 0;
            const widthDiff = Math.abs(areaWidth - naturalWidth);
            const heightDiff = Math.abs(areaHeight - naturalHeight);
            if (widthDiff <= 1 && heightDiff <= 1) {
              return false; // Exclude this box - it covers the entire image (within 1px threshold)
            }
            return true;
          });
        
        return embeddingsWithFaces.map(({ embedding, index }) => {
          const area = embedding.facial_area;
          const x = (area.x || 0) * scaleX;
          const y = (area.y || 0) * scaleY;
          const width = (area.w || 0) * scaleX;
          const height = (area.h || 0) * scaleY;
          
          const isSelected = this.selectedBoundingBoxIndex === index;
          
          // Check if this face has a label using the new key format
          let hasLabel = false;
          if (this.selectedFile && this.getFaceLabelKey && this.faceLabels) {
            const key = this.getFaceLabelKey(this.selectedFile.name, area);
            hasLabel = key ? !!this.faceLabels[key] : false;
          }
          
          // Color logic: Amber for unlabelled, Soft Green for labelled
          // Selected boxes blink with color based on label status
          let strokeColor = '#FFD700'; // Amber - Not Labelled (default)
          let strokeWidth = 2;
          let opacity = 1;
          
          if (isSelected) {
            // Selected box: use green if labelled, amber if not labelled
            strokeColor = hasLabel ? '#10B981' : '#FFD700'; // Soft Green if labelled, Amber if not
            strokeWidth = 4; // Thicker for visibility
            opacity = this.selectedBoxOpacity; // Blinking opacity
          } else if (hasLabel) {
            strokeColor = '#10B981'; // Soft Green - Labelled
            strokeWidth = 2;
            opacity = 1;
          } else {
            strokeColor = '#FFD700'; // Amber - Not Labelled
            strokeWidth = 2;
            opacity = 1;
          }
          
          return {
            x: x,
            y: y,
            width: width,
            height: height,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: 'transparent',
            opacity: opacity,
            embeddingIndex: index
          };
        });
      } catch (error) {
        console.error('Error parsing facial areas from model:', error);
        return [];
      }
    },
    nameLabels() {
      // Return empty array if showFaces is false
      if (!this.showFaces || !this.selectedFile || !this.selectedFile.model) {
        return [];
      }
      
      try {
        const model = typeof this.selectedFile.model === 'string' 
          ? JSON.parse(this.selectedFile.model) 
          : this.selectedFile.model;
        
        if (!model.embeddings || !Array.isArray(model.embeddings) || !this.imageConfig.image) {
          return [];
        }
        
        // Get image dimensions and scale factors
        const img = this.imageConfig.image;
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        const displayWidth = this.imageConfig.width;
        const displayHeight = this.imageConfig.height;
        
        const scaleX = displayWidth / naturalWidth;
        const scaleY = displayHeight / naturalHeight;
        
        // Filter embeddings that have facial_area
        const embeddingsWithFaces = model.embeddings
          .map((embedding, index) => ({ embedding, index }))
          .filter(({ embedding }) => embedding.facial_area);
        
        const allLabels = [];
        
        embeddingsWithFaces.forEach(({ embedding, index }) => {
          const area = embedding.facial_area;
          const x = (area.x || 0) * scaleX;
          const y = (area.y || 0) * scaleY;
          const width = (area.w || 0) * scaleX;
          const height = (area.h || 0) * scaleY;
          
          // Get the face label key for this bounding box
          let key = null;
          if (this.selectedFile && this.getFaceLabelKey) {
            key = this.getFaceLabelKey(this.selectedFile.name, area);
          }
          
          if (!key) return;
          
          // Get the identified person from faceLabels (for vector-matched faces)
          const identifiedPerson = this.faceLabels && this.faceLabels[key] ? this.faceLabels[key] : null;
          
          // Get checked people for this bounding box
          const checkedPeople = this.checkedPeopleByBox && this.checkedPeopleByBox[key] ? this.checkedPeopleByBox[key] : {};
          const checkedPersonIds = Object.keys(checkedPeople).filter(personId => checkedPeople[personId]);
          
          // If there's an identified person, include them even if not explicitly checked
          if (identifiedPerson && identifiedPerson.id && !checkedPersonIds.includes(identifiedPerson.id)) {
            checkedPersonIds.push(identifiedPerson.id);
          }
          
          if (checkedPersonIds.length === 0) return; // No checked people, don't show label
          
          // Get person objects for all checked people
          const checkedPersons = checkedPersonIds
            .map(personId => {
              if (!this.planningCentrePeople) return null;
              return this.planningCentrePeople.find(p => p.id === personId);
            })
            .filter(p => p !== null);
          
          if (checkedPersons.length === 0) return;
          
          // Separate selected person from household members
          let selectedPerson = null;
          let householdMembers = [];
          
          if (identifiedPerson) {
            // Use identified person as selected person
            selectedPerson = identifiedPerson;
            // Get household members from checked people (excluding selected person)
            householdMembers = checkedPersons.filter(p => p.id !== identifiedPerson.id);
          } else {
            // No identified person, use first checked person as selected
            selectedPerson = checkedPersons[0];
            householdMembers = checkedPersons.slice(1);
          }
          
          if (!selectedPerson || !selectedPerson.name) return;
          
          // Build text lines: selected person on first line, each household member on separate lines
          const fontSize = 12;
          const padding = 4;
          const lineHeight = fontSize + 2; // Line height with spacing
          
          const texts = [];
          texts.push({
            x: padding,
            y: padding,
            text: selectedPerson.name,
            fontSize: fontSize,
            fontFamily: 'Arial',
            fill: '#D3D3D3', // Light grey
            align: 'left'
          });
          
          // Add each household member on a separate line
          householdMembers.forEach((member, index) => {
            if (member && member.name) {
              texts.push({
                x: padding,
                y: padding + (index + 1) * lineHeight,
                text: member.name,
                fontSize: fontSize,
                fontFamily: 'Arial',
                fill: '#D3D3D3', // Light grey
                align: 'left'
              });
            }
          });
          
          // Calculate dimensions for background
          const allNames = [selectedPerson.name, ...householdMembers.map(p => p.name).filter(name => name)];
          const maxTextWidth = Math.max(...allNames.map(name => name.length * fontSize * 0.6));
          const textHeight = texts.length * lineHeight + padding;
          const textWidth = maxTextWidth;
          
          // Center the group horizontally below the box
          const groupX = x + (width - textWidth) / 2 - padding; // Center horizontally
          const groupY = y + height + 2; // 2px below the box
          
          allLabels.push({
            groupX: groupX,
            groupY: groupY,
            bgRect: {
              x: 0,
              y: 0,
              width: textWidth + padding * 2,
              height: textHeight,
              fill: 'rgba(0, 0, 0, 0.5)', // Semi-transparent black background
              cornerRadius: 2
            },
            texts: texts
          });
        });
        
        return allLabels;
      } catch (error) {
        console.error('Error creating name labels:', error);
        return [];
      }
    },
    pointLabelGroups() {
      if (!this.selectedFile || !this.pointLabels || !this.imageConfig.image) {
        return [];
      }
      
      const imageName = this.selectedFile.name;
      const points = this.pointLabels[imageName] || [];
      
      if (points.length === 0) {
        return [];
      }
      
      const img = this.imageConfig.image;
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      const displayWidth = this.imageConfig.width;
      const displayHeight = this.imageConfig.height;
      
      const scaleX = displayWidth / naturalWidth;
      const scaleY = displayHeight / naturalHeight;
      
      return points.map(point => {
        const x = point.naturalX * scaleX;
        const y = point.naturalY * scaleY;
        const isSelected = this.selectedPointLabelId === point.id;
        
        // Check if this point has a person selected
        const hasPerson = this.pointLabelPersons && this.pointLabelPersons[point.id] ? true : false;
        
        // Marker size and offset
        const fontSize = isSelected ? 24 : 16;
        const offsetX = isSelected ? 12 : 8;
        const offsetY = isSelected ? 12 : 8;
        
        // Bounding box around the marker (larger clickable area)
        const boxSize = isSelected ? 40 : 32; // Larger box when selected
        const boxX = x - boxSize / 2;
        const boxY = y - boxSize / 2;
        // Color logic: 
        // - Selected + no person: Blinking Yellow (#FFD700)
        // - Selected + has person: Blinking Green (#10B981)
        // - Not selected + has person: Solid Green (#10B981)
        // - Not selected + no person: Should not exist (point should be deleted)
        const boxColor = hasPerson ? '#10B981' : '#FFD700'; // Green if person selected, Yellow if not
        // Opacity: Blinking when selected, solid when not selected
        const boxOpacity = isSelected ? this.selectedPointOpacity : 1;
        
        return {
          id: point.id,
          boundingBox: {
            x: boxX,
            y: boxY,
            width: boxSize,
            height: boxSize,
            fill: 'transparent',
            stroke: boxColor,
            strokeWidth: isSelected ? 3 : 2,
            opacity: boxOpacity
          },
          marker: {
            x: x,
            y: y,
            text: '◉', // &#9678; character
            fontSize: fontSize,
            fontFamily: 'Arial',
            fill: boxColor,
            align: 'center',
            verticalAlign: 'middle',
            offsetX: offsetX,
            offsetY: offsetY,
            opacity: boxOpacity,
            listening: false // Marker itself doesn't need to be clickable, the box handles it
          }
        };
      });
    },
    pointNameLabels() {
      if (!this.selectedFile || !this.pointLabels || !this.pointLabelPersons || !this.imageConfig.image) {
        return [];
      }
      
      const imageName = this.selectedFile.name;
      const points = this.pointLabels[imageName] || [];
      
      if (points.length === 0) {
        return [];
      }
      
      const img = this.imageConfig.image;
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      const displayWidth = this.imageConfig.width;
      const displayHeight = this.imageConfig.height;
      
      const scaleX = displayWidth / naturalWidth;
      const scaleY = displayHeight / naturalHeight;
      
      const allLabels = [];
      
      points.forEach(point => {
        // Get the identified person for this point label
        const identifiedPerson = this.pointLabelPersons[point.id] || null;
        
        if (!identifiedPerson) return; // No person selected, don't show label
        
        // Get checked people for this point label
        const checkedPeople = this.checkedPeopleByPoint && this.checkedPeopleByPoint[point.id] ? this.checkedPeopleByPoint[point.id] : {};
        const checkedPersonIds = Object.keys(checkedPeople).filter(personId => checkedPeople[personId]);
        
        // If there's an identified person, include them even if not explicitly checked
        if (identifiedPerson && identifiedPerson.id && !checkedPersonIds.includes(identifiedPerson.id)) {
          checkedPersonIds.push(identifiedPerson.id);
        }
        
        if (checkedPersonIds.length === 0) return; // No checked people, don't show label
        
        // Get person objects for all checked people
        const checkedPersons = checkedPersonIds
          .map(personId => {
            if (!this.planningCentrePeople) return null;
            return this.planningCentrePeople.find(p => p.id === personId);
          })
          .filter(p => p !== null);
        
        if (checkedPersons.length === 0) return;
        
        // Separate selected person from household members
        let selectedPerson = identifiedPerson;
        let householdMembers = checkedPersons.filter(p => p.id !== identifiedPerson.id);
        
        if (!selectedPerson || !selectedPerson.name) return;
        
        // Calculate position
        const x = point.naturalX * scaleX;
        const y = point.naturalY * scaleY;
        const boxSize = 32; // Default box size for positioning
        
        // Build text lines: selected person on first line, each household member on separate lines
        const fontSize = 12;
        const padding = 4;
        const lineHeight = fontSize + 2; // Line height with spacing
        
        const texts = [];
        texts.push({
          x: padding,
          y: padding,
          text: selectedPerson.name,
          fontSize: fontSize,
          fontFamily: 'Arial',
          fill: '#D3D3D3', // Light grey
          align: 'left'
        });
        
        // Add each household member on a separate line
        householdMembers.forEach((member, index) => {
          if (member && member.name) {
            texts.push({
              x: padding,
              y: padding + (index + 1) * lineHeight,
              text: member.name,
              fontSize: fontSize,
              fontFamily: 'Arial',
              fill: '#D3D3D3', // Light grey
              align: 'left'
            });
          }
        });
        
        // Calculate dimensions for background
        const allNames = [selectedPerson.name, ...householdMembers.map(p => p.name).filter(name => name)];
        const maxTextWidth = Math.max(...allNames.map(name => name.length * fontSize * 0.6));
        const textHeight = texts.length * lineHeight + padding;
        const textWidth = maxTextWidth;
        
        // Center the group horizontally below the point marker
        const groupX = x - textWidth / 2 - padding; // Center horizontally
        const groupY = y + boxSize / 2 + 2; // 2px below the marker
        
        allLabels.push({
          groupX: groupX,
          groupY: groupY,
          bgRect: {
            x: 0,
            y: 0,
            width: textWidth + padding * 2,
            height: textHeight,
            fill: 'rgba(0, 0, 0, 0.5)', // Semi-transparent black background
            cornerRadius: 2
          },
          texts: texts
        });
      });
      
      return allLabels;
    },
    panTiltZoom() {
      // Extract pan, tilt, zoom from filename
      if (!this.selectedFile || !this.selectedFile.name) {
        return null;
      }
      
      const filename = this.selectedFile.name.toLowerCase();
      
      // Check if it's a JPG file
      if (!filename.endsWith('.jpg') && !filename.endsWith('.jpeg')) {
        return null;
      }
      
      // Pattern to match: panXX.X_tiltXX.X_zoomXX.X (taking first occurrence)
      // Handles negative numbers like pan-34.4
      const panMatch = filename.match(/_pan(-?\d+\.?\d*)/);
      const tiltMatch = filename.match(/_tilt(-?\d+\.?\d*)/);
      const zoomMatch = filename.match(/_zoom(-?\d+\.?\d*)/);
      
      if (panMatch && tiltMatch && zoomMatch) {
        return {
          pan: parseFloat(panMatch[1]),
          tilt: parseFloat(tiltMatch[1]),
          zoom: parseFloat(zoomMatch[1])
        };
      }
      
      return null;
    },
    panTiltZoomConfig() {
      if (!this.panTiltZoom || !this.imageConfig.image) {
        return null;
      }
      
      const { pan, tilt, zoom } = this.panTiltZoom;
      const text = `Pan: ${pan.toFixed(1)}° Tilt: ${tilt.toFixed(1)}° Zoom: ${zoom.toFixed(1)}`;
      
      // Position in bottom left corner with some padding
      const padding = 10;
      const fontSize = 14;
      const fontFamily = 'Arial';
      
      // Create a temporary canvas to measure text width
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = `${fontSize}px ${fontFamily}`;
      const textWidth = ctx.measureText(text).width;
      const textHeight = fontSize;
      
      const textPadding = 6;
      const bgWidth = textWidth + textPadding * 2;
      const bgHeight = textHeight + textPadding * 2;
      
      const groupX = padding;
      const groupY = this.stageConfig.height - bgHeight - padding;
      
      return {
        groupX: groupX,
        groupY: groupY,
        bgRect: {
          x: 0,
          y: 0,
          width: bgWidth,
          height: bgHeight,
          fill: 'rgba(0, 0, 0, 0.5)',
          cornerRadius: 4
        },
        text: {
          x: textPadding,
          y: textPadding,
          text: text,
          fontSize: fontSize,
          fontFamily: fontFamily,
          fill: 'white',
          align: 'left',
          verticalAlign: 'top'
        }
      };
    },
    // Compute overlap boxes for the current image
    overlapBoxes() {
      if (!this.selectedFile || !this.panTiltZoom || !this.currentFolderFiles || !this.imageConfig.image) {
        return [];
      }
      
      const currentPanTilt = this.panTiltZoom;
      const currentBounds = this.calculateFovBounds(currentPanTilt.pan, currentPanTilt.tilt);
      const overlaps = [];
      
      // Get current image timestamp
      const currentTimestamp = this.extractTimestampFromFilename(this.selectedFile.name);
      
      // Log FOV coordinates for all images in the folder
      const allFovBounds = [];
      for (const file of this.currentFolderFiles) {
        const panTilt = this.extractPanTiltFromFilename(file.name);
        if (panTilt) {
          const bounds = this.calculateFovBounds(panTilt.pan, panTilt.tilt);
          allFovBounds.push({
            filename: file.name,
            pan: panTilt.pan,
            tilt: panTilt.tilt,
            xMin: bounds.xMin,
            xMax: bounds.xMax,
            yMin: bounds.yMin,
            yMax: bounds.yMax
          });
        }
      }
      
      // Log all FOV coordinates
      console.log('All Images Field of View Coordinates:', allFovBounds);
      
      // Iterate through all files to find overlaps
      for (const file of this.currentFolderFiles) {
        // Skip the current file
        if (file.name === this.selectedFile.name) {
          continue;
        }
        
        // Extract pan/tilt from filename
        const otherPanTilt = this.extractPanTiltFromFilename(file.name);
        if (!otherPanTilt) {
          continue; // Skip files without pan/tilt
        }
        
        // Extract timestamp from filename
        const otherTimestamp = this.extractTimestampFromFilename(file.name);
        
        // Check if images are within time threshold
        if (!this.areWithinTimeThreshold(currentTimestamp, otherTimestamp)) {
          continue; // Skip if images are more than threshold seconds apart
        }
        
        // Calculate FOV bounds for this image
        const otherBounds = this.calculateFovBounds(otherPanTilt.pan, otherPanTilt.tilt);
        
        // Check if they overlap
        if (this.checkFovOverlap(currentBounds, otherBounds)) {
          // Calculate intersection region
          const intersection = this.calculateIntersection(currentBounds, otherBounds);
          if (intersection) {
            // Convert to pixel coordinates
            const pixelCoords = this.degreesToPixels(intersection, currentPanTilt);
            if (pixelCoords && pixelCoords.width > 0 && pixelCoords.height > 0) {
              overlaps.push({
                x: pixelCoords.x,
                y: pixelCoords.y,
                width: pixelCoords.width,
                height: pixelCoords.height,
                stroke: '#808080', // Grey color
                strokeWidth: 2,
                fill: 'rgba(128, 128, 128, 0.2)', // Semi-transparent grey fill
                opacity: 0.7,
                listening: false, // Don't capture mouse events - allow clicks to pass through
                sourceFile: file, // Store reference to source file
                sourcePanTilt: otherPanTilt,
                sourceBounds: otherBounds,
                intersection: intersection // Store intersection in FOV coordinates
              });
            }
          }
        }
      }
      
      return overlaps;
    },
    // Get all bounding boxes (current + overlapping) with metadata for filtering
    allBoundingBoxesWithMetadata() {
      if (!this.showFaces || !this.selectedFile || !this.imageConfig.image) {
        return { currentBoxes: [], overlapBoxes: [] };
      }
      
      const img = this.imageConfig.image;
      const currentNaturalWidth = img.naturalWidth;
      const currentNaturalHeight = img.naturalHeight;
      const currentDisplayWidth = this.imageConfig.width;
      const currentDisplayHeight = this.imageConfig.height;
      
      // Get current image boxes with confidence and area
      const currentBoxes = [];
      if (this.selectedFile && this.selectedFile.model) {
        try {
          const model = typeof this.selectedFile.model === 'string' 
            ? JSON.parse(this.selectedFile.model) 
            : this.selectedFile.model;
          
          if (model.embeddings && Array.isArray(model.embeddings)) {
            const scaleX = currentDisplayWidth / currentNaturalWidth;
            const scaleY = currentDisplayHeight / currentNaturalHeight;
            
            model.embeddings.forEach((embedding, index) => {
              if (!embedding.facial_area) return;
              const area = embedding.facial_area;
              const areaWidth = area.w || 0;
              const areaHeight = area.h || 0;
              const widthDiff = Math.abs(areaWidth - currentNaturalWidth);
              const heightDiff = Math.abs(areaHeight - currentNaturalHeight);
              if (widthDiff <= 1 && heightDiff <= 1) return;
              
              const x = (area.x || 0) * scaleX;
              const y = (area.y || 0) * scaleY;
              const width = (area.w || 0) * scaleX;
              const height = (area.h || 0) * scaleY;
              
              currentBoxes.push({
                x: x,
                y: y,
                width: width,
                height: height,
                faceConfidence: embedding.face_confidence || 0,
                area: width * height,
                isCurrentImage: true,
                embeddingIndex: index,
                facialArea: area,
                sourceFile: this.selectedFile,
                sourceImage: this.selectedFile.name
              });
            });
          }
        } catch (error) {
          console.error('Error processing current image boxes:', error);
        }
      }
      
      // Get overlapping image boxes
      const overlapBoxes = this.overlapBoxes;
      const allOverlapBoxes = [];
      
      if (overlapBoxes.length > 0) {
        const currentPanTilt = this.panTiltZoom;
        const currentBounds = this.calculateFovBounds(currentPanTilt.pan, currentPanTilt.tilt);
        
        for (const overlapBox of overlapBoxes) {
          if (!overlapBox.sourceFile || !overlapBox.sourcePanTilt) {
            continue;
          }
          
          const otherFile = overlapBox.sourceFile;
          const otherPanTilt = overlapBox.sourcePanTilt;
          const otherBounds = overlapBox.sourceBounds;
          const intersection = overlapBox.intersection;
          
          // Get model data for the overlapping image
          if (!otherFile.model) {
            if (!this.requestedModelFiles.has(otherFile.name)) {
              this.requestedModelFiles.add(otherFile.name);
              if (this.fetchModelData && otherFile.model_url) {
                setTimeout(() => {
                  this.fetchModelData(otherFile);
                }, 0);
              }
            }
            continue;
          }
          
          try {
            const otherModel = typeof otherFile.model === 'string' 
              ? JSON.parse(otherFile.model) 
              : otherFile.model;
            
            if (!otherModel.embeddings || !Array.isArray(otherModel.embeddings)) {
              continue;
            }
            
            const otherNaturalWidth = currentNaturalWidth;
            const otherNaturalHeight = currentNaturalHeight;
            const otherDisplayWidth = currentDisplayWidth;
            const otherDisplayHeight = currentDisplayHeight;
            const otherScaleX = otherDisplayWidth / otherNaturalWidth;
            const otherScaleY = otherDisplayHeight / otherNaturalHeight;
            
            const embeddingsWithFaces = otherModel.embeddings
              .map((embedding, idx) => ({ embedding, index: idx }))
              .filter(({ embedding }) => {
                if (!embedding.facial_area) return false;
                const area = embedding.facial_area;
                const areaWidth = area.w || 0;
                const areaHeight = area.h || 0;
                const widthDiff = Math.abs(areaWidth - otherNaturalWidth);
                const heightDiff = Math.abs(areaHeight - otherNaturalHeight);
                if (widthDiff <= 1 && heightDiff <= 1) return false;
                return true;
              });
            
            const pixelsPerDegreeX_other = otherDisplayWidth / this.fovConfig.width;
            const pixelsPerDegreeY_other = otherDisplayHeight / this.fovConfig.height;
            
            const otherIntersectionXMinPx = (intersection.xMin - otherBounds.xMin) * pixelsPerDegreeX_other;
            const otherIntersectionXMaxPx = (intersection.xMax - otherBounds.xMin) * pixelsPerDegreeX_other;
            const otherIntersectionYMinPx = (intersection.yMin - otherBounds.yMin) * pixelsPerDegreeY_other;
            const otherIntersectionYMaxPx = (intersection.yMax - otherBounds.yMin) * pixelsPerDegreeY_other;
            
            const otherIntersectionXMin = otherDisplayWidth - otherIntersectionXMaxPx;
            const otherIntersectionXMax = otherDisplayWidth - otherIntersectionXMinPx;
            const otherIntersectionYMin = otherIntersectionYMinPx;
            const otherIntersectionYMax = otherIntersectionYMaxPx;
            
            const greyBoxX = overlapBox.x;
            const greyBoxY = overlapBox.y;
            const greyBoxWidth = overlapBox.width;
            const greyBoxHeight = overlapBox.height;
            
            const otherIntersectionWidth = otherIntersectionXMax - otherIntersectionXMin;
            const otherIntersectionHeight = otherIntersectionYMax - otherIntersectionYMin;
            const scaleX = greyBoxWidth / otherIntersectionWidth;
            const scaleY = greyBoxHeight / otherIntersectionHeight;
            
            for (const { embedding, index } of embeddingsWithFaces) {
              const area = embedding.facial_area;
              
              const otherBoxX = (area.x || 0) * otherScaleX;
              const otherBoxY = (area.y || 0) * otherScaleY;
              const otherBoxWidth = (area.w || 0) * otherScaleX;
              const otherBoxHeight = (area.h || 0) * otherScaleY;
              
              const otherBoxXMin = otherBoxX;
              const otherBoxXMax = otherBoxX + otherBoxWidth;
              const otherBoxYMin = otherBoxY;
              const otherBoxYMax = otherBoxY + otherBoxHeight;
              
              if (otherBoxXMin < otherIntersectionXMin || otherBoxXMax > otherIntersectionXMax ||
                  otherBoxYMin < otherIntersectionYMin || otherBoxYMax > otherIntersectionYMax) {
                continue;
              }
              
              const relativeX = otherBoxXMin - otherIntersectionXMin;
              const relativeY = otherBoxYMin - otherIntersectionYMin;
              
              const mappedX = greyBoxX + relativeX * scaleX;
              const mappedY = greyBoxY + relativeY * scaleY;
              const mappedWidth = otherBoxWidth * scaleX;
              const mappedHeight = otherBoxHeight * scaleY;
              
              const faceConfidence = embedding.face_confidence || 0;
              
              allOverlapBoxes.push({
                x: mappedX,
                y: mappedY,
                width: mappedWidth,
                height: mappedHeight,
                faceConfidence: faceConfidence,
                area: mappedWidth * mappedHeight,
                isCurrentImage: false,
                sourceFile: otherFile,
                sourceImage: otherFile.name,
                embeddingIndex: index,
                facialArea: area
              });
            }
          } catch (error) {
            console.error('Error processing overlapping bounding boxes:', error);
          }
        }
      }
      
      return { currentBoxes, overlapBoxes: allOverlapBoxes };
    },
    // Get bounding boxes from overlapping images, transformed to grey box coordinates
    overlappingImageBoundingBoxes() {
      if (!this.showFaces || !this.selectedFile || !this.imageConfig.image) {
        return [];
      }
      
      const { currentBoxes, overlapBoxes } = this.allBoundingBoxesWithMetadata;
      
      // Combine all boxes for filtering
      const allBoxes = [...currentBoxes, ...overlapBoxes];
      
      // Filter overlapping boxes (>50% overlap) - keep only best (highest confidence, then largest)
      const filteredBoxes = [];
      for (let i = 0; i < allBoxes.length; i++) {
        const box1 = allBoxes[i];
        let shouldInclude = true;
        
        for (let j = 0; j < allBoxes.length; j++) {
          if (i === j) continue;
          
          const box2 = allBoxes[j];
          const overlap = this.calculateBoundingBoxOverlap(box1, box2);
          
          if (overlap > 0.5) {
            // Overlap > 50%, compare confidence and size
            if (box2.faceConfidence > box1.faceConfidence) {
              shouldInclude = false;
              break;
            } else if (box2.faceConfidence === box1.faceConfidence && box2.area > box1.area) {
              shouldInclude = false;
              break;
            }
          }
        }
        
        if (shouldInclude && !box1.isCurrentImage) {
          // Only include overlap boxes (current image boxes are handled by facialAreaBoxes)
          let hasLabel = false;
          if (this.getFaceLabelKey && this.faceLabels) {
            const key = this.getFaceLabelKey(box1.sourceImage, box1.facialArea);
            hasLabel = key ? !!this.faceLabels[key] : false;
          }
          
          // Check if this is the selected overlap box
          const isSelected = this.selectedOverlapBox && 
                            this.selectedOverlapBox.sourceFile === box1.sourceFile &&
                            this.selectedOverlapBox.embeddingIndex === box1.embeddingIndex;
          
          // Create a unique ID for this box to use in click handler
          const boxId = `overlap-${box1.sourceImage}-${box1.embeddingIndex}`;
          
          // Determine opacity - use blinking opacity if selected, otherwise default
          let boxOpacity = 0.6;
          if (isSelected) {
            boxOpacity = this.selectedBoxOpacity; // Use blinking opacity
          }
          
          filteredBoxes.push({
            x: box1.x,
            y: box1.y,
            width: box1.width,
            height: box1.height,
            stroke: hasLabel ? '#10B981' : '#FFD700',
            strokeWidth: isSelected ? 4 : 2,
            fill: 'transparent',
            opacity: boxOpacity,
            listening: true,
            hitStrokeWidth: 10, // Make the stroke area clickable even with transparent fill
            perfectDrawEnabled: false, // Improve click detection
            boxId: boxId, // Store ID for click handler lookup
            sourceFile: box1.sourceFile,
            sourceImage: box1.sourceImage,
            embeddingIndex: box1.embeddingIndex,
            facialArea: box1.facialArea
          });
          
          // Store box data for click handler lookup
          if (!this.overlapBoxClickHandlers) {
            this.overlapBoxClickHandlers = new Map();
          }
          this.overlapBoxClickHandlers.set(boxId, box1);
        }
      }
      
      // Check if selected overlap box was filtered out - if so, deselect it
      if (this.selectedOverlapBox) {
        const isStillVisible = filteredBoxes.some(box => 
          box.sourceFile === this.selectedOverlapBox.sourceFile &&
          box.embeddingIndex === this.selectedOverlapBox.embeddingIndex
        );
        if (!isStillVisible) {
          // Selected box was filtered out, clear selection
          this.$nextTick(() => {
            this.$emit('overlap-box-deselected');
          });
        }
      }
      
      return filteredBoxes;
    },
    // Get filtered current image boxes (excluding those filtered out by overlap)
    filteredFacialAreaBoxes() {
      if (!this.showFaces || !this.selectedFile || !this.imageConfig.image) {
        return [];
      }
      
      const { currentBoxes, overlapBoxes } = this.allBoundingBoxesWithMetadata;
      const allBoxes = [...currentBoxes, ...overlapBoxes];
      
      // Get original facialAreaBoxes for styling
      const originalBoxes = this.facialAreaBoxes;
      const originalBoxMap = new Map();
      originalBoxes.forEach(box => {
        originalBoxMap.set(box.embeddingIndex, box);
      });
      
      // Filter current image boxes
      const filteredCurrentBoxes = [];
      const includedIndices = new Set();
      
      for (let i = 0; i < currentBoxes.length; i++) {
        const box1 = currentBoxes[i];
        let shouldInclude = true;
        
        for (let j = 0; j < allBoxes.length; j++) {
          if (i === j && allBoxes[j].isCurrentImage) continue;
          
          const box2 = allBoxes[j];
          const overlap = this.calculateBoundingBoxOverlap(box1, box2);
          
          if (overlap > 0.5) {
            if (box2.faceConfidence > box1.faceConfidence) {
              shouldInclude = false;
              break;
            } else if (box2.faceConfidence === box1.faceConfidence && box2.area > box1.area) {
              shouldInclude = false;
              break;
            }
          }
        }
        
        if (shouldInclude) {
          // Use original box styling
          const originalBox = originalBoxMap.get(box1.embeddingIndex);
          if (originalBox) {
            filteredCurrentBoxes.push(originalBox);
            includedIndices.add(box1.embeddingIndex);
          }
        }
      }
      
      // Check if selected current image box was filtered out - if so, deselect it
      if (this.selectedBoundingBoxIndex !== null && !includedIndices.has(this.selectedBoundingBoxIndex)) {
        // Selected box was filtered out, clear selection
        this.$nextTick(() => {
          this.$emit('face-box-deselected');
        });
      }
      
      return filteredCurrentBoxes;
    },
    // Get name labels for overlapping image bounding boxes
    overlappingImageNameLabels() {
      if (!this.showFaces || !this.selectedFile || !this.imageConfig.image) {
        return [];
      }
      
      const overlappingBoxes = this.overlappingImageBoundingBoxes;
      if (overlappingBoxes.length === 0) {
        return [];
      }
      
      const img = this.imageConfig.image;
      const displayWidth = this.imageConfig.width;
      const displayHeight = this.imageConfig.height;
      
      const allLabels = [];
      
      for (const box of overlappingBoxes) {
        if (!box.sourceFile || !box.facialArea) {
          continue;
        }
        
        // Get the face label key for this bounding box
        let key = null;
        if (this.getFaceLabelKey) {
          key = this.getFaceLabelKey(box.sourceImage, box.facialArea);
        }
        
        if (!key) continue;
        
        // Get the identified person from faceLabels
        const identifiedPerson = this.faceLabels && this.faceLabels[key] ? this.faceLabels[key] : null;
        
        // Get checked people for this bounding box
        const checkedPeople = this.checkedPeopleByBox && this.checkedPeopleByBox[key] ? this.checkedPeopleByBox[key] : {};
        const checkedPersonIds = Object.keys(checkedPeople).filter(personId => checkedPeople[personId]);
        
        // If there's an identified person, include them even if not explicitly checked
        if (identifiedPerson && identifiedPerson.id && !checkedPersonIds.includes(identifiedPerson.id)) {
          checkedPersonIds.push(identifiedPerson.id);
        }
        
        if (checkedPersonIds.length === 0) continue; // No checked people, don't show label
        
        // Get person objects for all checked people
        const checkedPersons = checkedPersonIds
          .map(personId => {
            if (!this.planningCentrePeople) return null;
            return this.planningCentrePeople.find(p => p.id === personId);
          })
          .filter(p => p !== null);
        
        if (checkedPersons.length === 0) continue;
        
        // Separate selected person from household members
        let selectedPerson = null;
        let householdMembers = [];
        
        if (identifiedPerson) {
          selectedPerson = identifiedPerson;
          householdMembers = checkedPersons.filter(p => p.id !== identifiedPerson.id);
        } else {
          selectedPerson = checkedPersons[0];
          householdMembers = checkedPersons.slice(1);
        }
        
        if (!selectedPerson || !selectedPerson.name) return;
        
        // Build text lines
        const fontSize = 12;
        const padding = 4;
        const lineHeight = fontSize + 2;
        
        const texts = [];
        texts.push({
          x: padding,
          y: padding,
          text: selectedPerson.name,
          fontSize: fontSize,
          fontFamily: 'Arial',
          fill: '#D3D3D3',
          align: 'left'
        });
        
        householdMembers.forEach((member, index) => {
          if (member && member.name) {
            texts.push({
              x: padding,
              y: padding + (index + 1) * lineHeight,
              text: member.name,
              fontSize: fontSize,
              fontFamily: 'Arial',
              fill: '#D3D3D3',
              align: 'left'
            });
          }
        });
        
        // Calculate dimensions for background
        const allNames = [selectedPerson.name, ...householdMembers.map(p => p.name).filter(name => name)];
        const maxTextWidth = Math.max(...allNames.map(name => name.length * fontSize * 0.6));
        const textHeight = texts.length * lineHeight + padding;
        const textWidth = maxTextWidth;
        
        // Center the group horizontally below the box
        const groupX = box.x + (box.width - textWidth) / 2 - padding;
        const groupY = box.y + box.height + 2;
        
        allLabels.push({
          groupX: groupX,
          groupY: groupY,
          bgRect: {
            x: 0,
            y: 0,
            width: textWidth + padding * 2,
            height: textHeight,
            fill: 'rgba(0, 0, 0, 0.5)',
            cornerRadius: 2
          },
          texts: texts
        });
      }
      
      return allLabels;
    }
  },
  watch: {
    selectedFile: {
      handler() {
        // Clear click handlers map when switching images
        if (this.overlapBoxClickHandlers) {
          this.overlapBoxClickHandlers.clear();
        }
      }
    },
    selectedBoundingBoxIndex: {
      handler(newVal) {
        // Start/stop blinking animation when selection changes
        if (this.blinkInterval) {
          clearInterval(this.blinkInterval);
          this.blinkInterval = null;
        }
        
        if (newVal !== null) {
          // Start blinking animation
          this.selectedBoxOpacity = 1;
          this.blinkInterval = setInterval(() => {
            this.selectedBoxOpacity = this.selectedBoxOpacity === 1 ? 0.3 : 1;
            // Force update to trigger recomputation of facialAreaBoxes
            this.$forceUpdate();
          }, 500); // Blink every 500ms
        } else if (!this.selectedOverlapBox) {
          // Stop blinking only if no overlap box is selected
          this.selectedBoxOpacity = 1;
        }
      },
      immediate: false
    },
    selectedOverlapBox: {
      handler(newVal, oldVal) {
        // Start/stop blinking animation when overlap box selection changes
        // Always clear interval first
        if (this.blinkInterval) {
          clearInterval(this.blinkInterval);
          this.blinkInterval = null;
        }
        
        if (newVal !== null && newVal !== undefined) {
          // Start blinking animation for overlap box
          this.selectedBoxOpacity = 1;
          this.blinkInterval = setInterval(() => {
            this.selectedBoxOpacity = this.selectedBoxOpacity === 1 ? 0.3 : 1;
            // Force update to trigger recomputation of overlappingImageBoundingBoxes
            this.$forceUpdate();
          }, 500); // Blink every 500ms
        } else {
          // Overlap box was deselected - stop blinking if no regular box is selected
          if (!this.selectedBoundingBoxIndex) {
            this.selectedBoxOpacity = 1;
          }
        }
      },
      immediate: false
    },
    selectedPointLabelId: {
      handler(newVal) {
        // Start/stop blinking animation when point label selection changes
        if (this.pointBlinkInterval) {
          clearInterval(this.pointBlinkInterval);
          this.pointBlinkInterval = null;
        }
        
        if (newVal !== null) {
          // Start blinking animation
          this.selectedPointOpacity = 1;
          this.pointBlinkInterval = setInterval(() => {
            this.selectedPointOpacity = this.selectedPointOpacity === 1 ? 0.3 : 1;
            // Force update to trigger recomputation of pointLabelMarkers
            this.$forceUpdate();
          }, 500); // Blink every 500ms
        } else {
          // Stop blinking
          this.selectedPointOpacity = 1;
        }
      },
      immediate: false
    },
    imageSrc: {
      handler(newSrc) {
        if (!newSrc) return;
        this.loadImage(newSrc);
      },
      immediate: true
    },
    selectedFile: {
      handler(newFile, oldFile) {
        // Clear requested model files when switching files to avoid stale state
        if (newFile !== oldFile) {
          this.requestedModelFiles.clear();
        }
        // Recalculate boxes when file changes
        this.$nextTick(() => {
          // Force update by accessing the computed property
          this.$forceUpdate();
        });
      },
      deep: true
    },
    'selectedFile.model': {
      handler() {
        // Recalculate boxes when model data is loaded
        this.$nextTick(() => {
          this.$forceUpdate();
        });
      }
    },
    imageConfig: {
      handler() {
        // Recalculate boxes when image dimensions change
        this.$nextTick(() => {
          this.$forceUpdate();
        });
      },
      deep: true
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.updateDimensions();
    });
    window.addEventListener('resize', this.updateDimensions);
    // Listen for Shift key release to hide tooltip
    window.addEventListener('keyup', this.handleKeyUp);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.updateDimensions);
    window.removeEventListener('keyup', this.handleKeyUp);
    // Clean up blinking intervals
    if (this.blinkInterval) {
      clearInterval(this.blinkInterval);
      this.blinkInterval = null;
    }
    if (this.pointBlinkInterval) {
      clearInterval(this.pointBlinkInterval);
      this.pointBlinkInterval = null;
    }
  },
  methods: {
    handleBoxClick(embeddingIndex) {
      // Clear overlap box selection when clicking a regular box
      if (this.selectedOverlapBox) {
        this.$emit('overlap-box-deselected');
      }
      this.$emit('face-box-click', embeddingIndex);
    },
    handleOverlapBoxClick(box, event) {
      console.log('handleOverlapBoxClick called!', box, event);
      
      // Stop event propagation to prevent interfering with other clicks
      if (event) {
        // Stop Konva event propagation
        if (event.cancelBubble !== undefined) {
          event.cancelBubble = true;
        }
        // Stop native event propagation
        if (event.evt) {
          event.evt.stopPropagation();
          event.evt.preventDefault();
        }
      }
      
      // Toggle selection - if clicking the same box, deselect it
      const isSameBox = this.selectedOverlapBox && 
                        this.selectedOverlapBox.sourceFile === box.sourceFile &&
                        this.selectedOverlapBox.embeddingIndex === box.embeddingIndex;
      
      if (isSameBox) {
        // Deselect the overlap box - emit event to parent to clear it
        this.$emit('overlap-box-deselected');
      } else {
        // Set selected overlap box to allow setting person while staying on current image
        const overlapBoxData = {
          sourceFile: box.sourceFile,
          embeddingIndex: box.embeddingIndex,
          facialArea: box.facialArea,
          sourceImage: box.sourceImage
        };
        // Emit event for parent component to set it
        this.$emit('overlap-face-box-click', overlapBoxData);
      }
    },
    // Handle overlap box click from template
    handleOverlapBoxClickFromTemplate(boxId, event) {
      console.log('handleOverlapBoxClickFromTemplate called with boxId:', boxId, 'event:', event);
      if (this.overlapBoxClickHandlers && this.overlapBoxClickHandlers.has(boxId)) {
        const box = this.overlapBoxClickHandlers.get(boxId);
        this.handleOverlapBoxClick(box, event);
      } else {
        console.error('Box not found in handlers map:', boxId);
      }
    },
    handleStageMouseMove(event) {
      // Check if Shift key is pressed
      if (event.evt.shiftKey) {
        const stage = event.target.getStage();
        const pointerPos = stage.getPointerPosition();
        
        // Calculate tooltip position relative to the container
        this.tooltipX = pointerPos.x + 10; // Offset to the right of cursor
        this.tooltipY = pointerPos.y - 20; // Offset above cursor
        this.showShiftTooltip = true;
      } else {
        this.showShiftTooltip = false;
      }
    },
    handleStageMouseLeave(event) {
      this.showShiftTooltip = false;
    },
    handleKeyUp(event) {
      // Hide tooltip when Shift is released
      if (event.key === 'Shift') {
        this.showShiftTooltip = false;
      }
    },
    handleStageClick(event) {
      // Check if Shift key is pressed and left mouse button
      if (event.evt.shiftKey && event.evt.button === 0) {
        // Get the stage position
        const stage = event.target.getStage();
        const pointerPos = stage.getPointerPosition();
        
        // Get image dimensions and scale factors
        if (!this.imageConfig.image) return;
        
        const img = this.imageConfig.image;
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        const displayWidth = this.imageConfig.width;
        const displayHeight = this.imageConfig.height;
        
        const scaleX = naturalWidth / displayWidth;
        const scaleY = naturalHeight / displayHeight;
        
        // Convert display coordinates to natural image coordinates
        const naturalX = pointerPos.x * scaleX;
        const naturalY = pointerPos.y * scaleY;
        
        // Emit event to parent to create point label
        this.$emit('point-label-create', {
          x: pointerPos.x,
          y: pointerPos.y,
          naturalX: naturalX,
          naturalY: naturalY
        });
      }
    },
    handlePointLabelClick(pointId) {
      this.$emit('point-label-click', pointId);
    },
    updateDimensions() {
      // Use window.Utils to ensure it's available
      const Utils = window.Utils;
      if (!Utils || typeof Utils.updateImageDimensions !== 'function') {
        console.error('Utils.updateImageDimensions not available');
        return;
      }
      
      const dimensions = Utils.updateImageDimensions(this.imageConfig.image);
      if (dimensions) {
        // Update container dimensions for reference
        const containerDims = Utils.getContainerDimensions();
        if (containerDims) {
          this.containerWidth = containerDims.width;
          this.containerHeight = containerDims.height;
        }
        
        // Update stage and image config
        this.stageConfig = { width: dimensions.width, height: dimensions.height };
        this.imageConfig = { 
          ...this.imageConfig, 
          width: dimensions.width, 
          height: dimensions.height 
        };
        
        // Force update to recalculate facial area boxes with new dimensions
        this.$nextTick(() => {
          this.$forceUpdate();
        });
      }
    },
    loadImage(imageSrc) {
      this.isLoading = true;
      this.$emit('loading-change', true);
      console.log('Loading image from URL:', imageSrc);
      
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Enable CORS for signed URLs
      img.onload = () => {
        console.log('Image loaded successfully, dimensions:', img.naturalWidth, 'x', img.naturalHeight);
        this.imageConfig.image = img;
        this.isLoading = false;
        this.$emit('loading-change', false);
        
        // Log field of view coordinates if pan/tilt is available
        if (this.panTiltZoom) {
          const filename = this.selectedFile ? this.selectedFile.name : 'Unknown';
          const fovBounds = this.calculateFovBounds(this.panTiltZoom.pan, this.panTiltZoom.tilt);
          console.log('Field of View Coordinates:', {
            filename: filename,
            pan: this.panTiltZoom.pan,
            tilt: this.panTiltZoom.tilt,
            fovWidth: this.fovConfig.width,
            fovHeight: this.fovConfig.height,
            xMin: fovBounds.xMin,
            xMax: fovBounds.xMax,
            yMin: fovBounds.yMin,
            yMax: fovBounds.yMax,
            xRange: `${fovBounds.xMin} to ${fovBounds.xMax}`,
            yRange: `${fovBounds.yMin} to ${fovBounds.yMax}`
          });
        }
        
        // Recalculate dimensions after image loads with proper sizing
        this.$nextTick(() => {
          this.updateDimensions();
        });
      };
      img.onerror = (error) => {
        console.error('Error loading image:', error);
        this.isLoading = false;
        this.$emit('loading-change', false);
      };
      img.src = imageSrc; // Use the signed URL directly
    },
    // Extract pan/tilt from a filename
    extractPanTiltFromFilename(filename) {
      if (!filename) return null;
      
      const lowerFilename = filename.toLowerCase();
      
      // Check if it's a JPG file
      if (!lowerFilename.endsWith('.jpg') && !lowerFilename.endsWith('.jpeg')) {
        return null;
      }
      
      // Pattern to match: panXX.X_tiltXX.X (handles negative numbers)
      const panMatch = lowerFilename.match(/_pan(-?\d+\.?\d*)/);
      const tiltMatch = lowerFilename.match(/_tilt(-?\d+\.?\d*)/);
      
      if (panMatch && tiltMatch) {
        return {
          pan: parseFloat(panMatch[1]),
          tilt: parseFloat(tiltMatch[1])
        };
      }
      
      return null;
    },
    // Extract timestamp from filename (hex timestamp in first part before underscore)
    extractTimestampFromFilename(filename) {
      if (!filename) return null;
      
      try {
        const parts = filename.split('_');
        if (parts.length === 0 || !parts[0]) return null;
        
        const hexTimestamp = parts[0];
        const unixTimestamp = parseInt(hexTimestamp, 16);
        
        if (isNaN(unixTimestamp)) return null;
        
        return unixTimestamp; // Return as unix timestamp in seconds
      } catch (error) {
        console.error('Error parsing timestamp from filename:', error);
        return null;
      }
    },
    // Check if two timestamps are within the time threshold
    areWithinTimeThreshold(timestamp1, timestamp2) {
      if (!timestamp1 || !timestamp2) return true; // If timestamp unavailable, allow overlap
      
      const timeDiff = Math.abs(timestamp1 - timestamp2);
      return timeDiff <= this.overlapTimeThreshold;
    },
    // Calculate bounding box overlap percentage (IoU - Intersection over Union)
    calculateBoundingBoxOverlap(box1, box2) {
      const x1Min = box1.x;
      const x1Max = box1.x + box1.width;
      const y1Min = box1.y;
      const y1Max = box1.y + box1.height;
      
      const x2Min = box2.x;
      const x2Max = box2.x + box2.width;
      const y2Min = box2.y;
      const y2Max = box2.y + box2.height;
      
      // Calculate intersection
      const xMin = Math.max(x1Min, x2Min);
      const xMax = Math.min(x1Max, x2Max);
      const yMin = Math.max(y1Min, y2Min);
      const yMax = Math.min(y1Max, y2Max);
      
      if (xMin >= xMax || yMin >= yMax) {
        return 0; // No intersection
      }
      
      const intersectionArea = (xMax - xMin) * (yMax - yMin);
      const box1Area = box1.width * box1.height;
      const box2Area = box2.width * box2.height;
      const unionArea = box1Area + box2Area - intersectionArea;
      
      if (unionArea === 0) return 0;
      
      // Return IoU (intersection over union)
      return intersectionArea / unionArea;
    },
    // Calculate field of view bounds for an image
    // Note: CCTV is upside down - left is positive, right is negative; up is negative, down is positive
    calculateFovBounds(pan, tilt) {
      const halfWidth = this.fovConfig.width / 2;
      const halfHeight = this.fovConfig.height / 2;
      
      // For inverted coordinate system:
      // Left (positive) to Right (negative): xMin should be more right (more negative), xMax should be more left (more positive)
      // Up (negative) to Down (positive): yMin should be more up (more negative), yMax should be more down (more positive)
      return {
        xMin: pan - halfWidth,  // More right (more negative)
        xMax: pan + halfWidth,  // More left (more positive)
        yMin: tilt - halfHeight, // More up (more negative)
        yMax: tilt + halfHeight  // More down (more positive)
      };
    },
    // Check if two FOV bounds overlap
    checkFovOverlap(bounds1, bounds2) {
      return !(
        bounds1.xMax < bounds2.xMin ||
        bounds1.xMin > bounds2.xMax ||
        bounds1.yMax < bounds2.yMin ||
        bounds1.yMin > bounds2.yMax
      );
    },
    // Calculate intersection region between two FOV bounds
    calculateIntersection(bounds1, bounds2) {
      const xMin = Math.max(bounds1.xMin, bounds2.xMin);
      const xMax = Math.min(bounds1.xMax, bounds2.xMax);
      const yMin = Math.max(bounds1.yMin, bounds2.yMin);
      const yMax = Math.min(bounds1.yMax, bounds2.yMax);
      
      if (xMin >= xMax || yMin >= yMax) {
        return null; // No intersection
      }
      
      return {
        xMin,
        xMax,
        yMin,
        yMax
      };
    },
    // Convert degree coordinates to pixel coordinates on the current image
    // Note: CCTV is upside down - left is positive, right is negative; up is negative, down is positive
    degreesToPixels(degBounds, currentPanTilt) {
      if (!this.imageConfig.image || !currentPanTilt) {
        return null;
      }
      
      const displayWidth = this.imageConfig.width;
      const displayHeight = this.imageConfig.height;
      
      // Current image FOV bounds
      const currentBounds = this.calculateFovBounds(currentPanTilt.pan, currentPanTilt.tilt);
      
      // Calculate scale factors (pixels per degree)
      const pixelsPerDegreeX = displayWidth / this.fovConfig.width;
      const pixelsPerDegreeY = displayHeight / this.fovConfig.height;
      
      // Convert intersection bounds to pixel coordinates relative to current image
      // Since left (positive) maps to right side of image and right (negative) maps to left side:
      // xMin (more right/negative) maps to left side of image, xMax (more left/positive) maps to right side
      const xMinPx = (degBounds.xMin - currentBounds.xMin) * pixelsPerDegreeX;
      const xMaxPx = (degBounds.xMax - currentBounds.xMin) * pixelsPerDegreeX;
      
      // For Y: smaller tilt (more negative) means image moves up, so it should map to top of image
      // yMin (more up/negative) maps to top of image, yMax (more down/positive) maps to bottom
      const yMinPx = (degBounds.yMin - currentBounds.yMin) * pixelsPerDegreeY;
      const yMaxPx = (degBounds.yMax - currentBounds.yMin) * pixelsPerDegreeY;
      
      // Invert X: left (positive pan) should be on right side of image
      // So we flip: xMinPx (left side in degrees) becomes right side in pixels
      const invertedXMin = displayWidth - xMaxPx;
      const invertedXMax = displayWidth - xMinPx;
      
      // For Y: smaller tilt (more negative) = upper part of image, so no inversion needed
      // yMinPx (more up/negative) already maps to top, yMaxPx (more down/positive) maps to bottom
      const invertedYMin = yMinPx;
      const invertedYMax = yMaxPx;
      
      // Clamp to image bounds
      const clampedXMin = Math.max(0, invertedXMin);
      const clampedXMax = Math.min(displayWidth, invertedXMax);
      const clampedYMin = Math.max(0, invertedYMin);
      const clampedYMax = Math.min(displayHeight, invertedYMax);
      
      // Calculate width and height from clamped coordinates
      const width = clampedXMax - clampedXMin;
      const height = clampedYMax - clampedYMin;
      
      // Only return if there's a valid overlap area
      if (width <= 0 || height <= 0) {
        return null;
      }
      
      return {
        x: clampedXMin,
        y: clampedYMin,
        width: width,
        height: height
      };
    }
  },
  template: `<div class="w-full h-full flex items-center justify-center relative">
    <div v-if="isLoading" class="loading-container">
      <div class="spinner"></div>
      <p>Loading image...</p>
    </div>
    <v-stage v-else :config="stageConfig" @mousedown="handleStageClick" @mousemove="handleStageMouseMove" @mouseleave="handleStageMouseLeave">
      <v-layer>
        <v-image :config="imageConfig"></v-image>
        <v-rect v-for="(box, index) in filteredFacialAreaBoxes" :key="index" :config="box" @click="handleBoxClick(box.embeddingIndex)"></v-rect>
        <v-group v-for="(label, index) in nameLabels" :key="'name-' + index" :config="{ x: label.groupX, y: label.groupY }">
          <v-rect :config="label.bgRect"></v-rect>
          <v-text v-for="(textItem, textIndex) in label.texts" :key="'text-' + textIndex" :config="textItem"></v-text>
        </v-group>
        <v-rect v-for="(box, index) in annotations" :key="'annotation-' + index" :config="box"></v-rect>
        <v-rect v-for="(pointGroup, index) in pointLabelGroups" :key="'point-box-' + index" :config="pointGroup.boundingBox" @click="handlePointLabelClick(pointGroup.id)"></v-rect>
        <v-text v-for="(pointGroup, index) in pointLabelGroups" :key="'point-marker-' + index" :config="pointGroup.marker"></v-text>
        <v-group v-for="(label, index) in pointNameLabels" :key="'point-name-' + index" :config="{ x: label.groupX, y: label.groupY }">
          <v-rect :config="label.bgRect"></v-rect>
          <v-text v-for="(textItem, textIndex) in label.texts" :key="'point-text-' + textIndex" :config="textItem"></v-text>
        </v-group>
        <v-group v-if="panTiltZoomConfig" :config="{ x: panTiltZoomConfig.groupX, y: panTiltZoomConfig.groupY }">
          <v-rect :config="panTiltZoomConfig.bgRect"></v-rect>
          <v-text :config="panTiltZoomConfig.text"></v-text>
        </v-group>
        <v-rect v-for="(overlapBox, index) in overlapBoxes" :key="'overlap-' + index" :config="overlapBox"></v-rect>
        <v-rect v-for="(box, index) in overlappingImageBoundingBoxes" :key="'overlap-bbox-' + index" :config="box" @click="handleOverlapBoxClickFromTemplate(box.boxId, $event)"></v-rect>
        <v-group v-for="(label, index) in overlappingImageNameLabels" :key="'overlap-name-' + index" :config="{ x: label.groupX, y: label.groupY }">
          <v-rect :config="label.bgRect"></v-rect>
          <v-text v-for="(textItem, textIndex) in label.texts" :key="'overlap-text-' + textIndex" :config="textItem"></v-text>
        </v-group>
      </v-layer>
    </v-stage>
    <div v-if="showShiftTooltip" :style="{ position: 'absolute', left: tooltipX + 'px', top: tooltipY + 'px', pointerEvents: 'none', zIndex: 1000, backgroundColor: 'rgba(0, 0, 0, 0.8)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', whiteSpace: 'nowrap' }">
      Left Click to Add Name
    </div>
  </div>`
};

