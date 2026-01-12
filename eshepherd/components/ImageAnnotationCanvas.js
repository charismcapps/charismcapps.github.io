// ImageAnnotationCanvas Component - Konva-based image annotation with face detection
export const ImageAnnotationCanvas = {
  name: 'ImageAnnotationCanvas',
  props: {
    imageSrc: String,
    annotations: Array,
    selectedFile: Object,
    showFaces: Boolean,
    faceLabels: Object,
    selectedKeyBox: Object, // Unified selection: { clusterId, sourceFile, embeddingIndex, facialArea, sourceImage, isKeyBoxFromCurrentImage }
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
    'cluster-box-click', // Unified event for cluster key box selection
    'cluster-box-deselected', // Unified event for cluster deselection
    'point-label-click',
    'point-label-create',
    'loading-change'
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
      blinkKey: 0, // Key to force vue-konva to re-render boxes when blinking
      localSelectedClusterId: null, // Track selected cluster locally until prop updates
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
      // Map to store cluster box data for click handlers
      clusterBoxClickHandlers: new Map()
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
          // Normalize keys to handle both string and number IDs
          const checkedPersonIds = [];
          Object.keys(checkedPeople).forEach(personId => {
            if (checkedPeople[personId]) {
              checkedPersonIds.push(personId);
            }
          });
          
          // Check if Unknown Person (id 0) is checked - handle both string "0" and number 0
          const isUnknownPersonChecked = checkedPeople['0'] === true || checkedPeople[0] === true;
          const isUnknownPerson = identifiedPerson && (identifiedPerson.id === 0 || identifiedPerson.id === '0');
          
          // If there's an identified person, include them even if not explicitly checked
          // Exception: Unknown Person (id 0) must be explicitly checked to show
          if (identifiedPerson && identifiedPerson.id !== undefined && identifiedPerson.id !== null) {
            const idStr = String(identifiedPerson.id);
            if (!checkedPersonIds.includes(idStr) && !isUnknownPerson) {
              checkedPersonIds.push(idStr);
            }
          }
          
          if (checkedPersonIds.length === 0 && !isUnknownPersonChecked) return; // No checked people, don't show label
          
          // Get person objects for all checked people
          const checkedPersons = [];
          
          // Handle Unknown Person specially
          if (isUnknownPersonChecked && isUnknownPerson) {
            checkedPersons.push(identifiedPerson);
          }
          
          // Handle regular people
          checkedPersonIds.forEach(personId => {
            // Skip "0" if we already added Unknown Person
            if (personId === '0' || personId === 0) {
              if (!isUnknownPersonChecked || !isUnknownPerson) {
                return; // Skip if Unknown Person not checked or not identified
              }
              return; // Already added above
            }
            
            if (this.planningCentrePeople) {
              const person = this.planningCentrePeople.find(p => String(p.id) === String(personId));
              if (person) {
                checkedPersons.push(person);
              }
            }
          });
          
          if (checkedPersons.length === 0) return;
          
          // Separate selected person from household members
          let selectedPerson = null;
          let householdMembers = [];
          
          if (identifiedPerson) {
            // Use identified person as selected person
            selectedPerson = identifiedPerson;
            // Get household members from checked people (excluding selected person)
            householdMembers = checkedPersons.filter(p => p && p.id !== undefined && String(p.id) !== String(identifiedPerson.id));
          } else {
            // No identified person, use first checked person as selected
            selectedPerson = checkedPersons[0];
            householdMembers = checkedPersons.slice(1).filter(p => p && p.id !== undefined);
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
        // Normalize keys to handle both string and number IDs
        const checkedPersonIds = [];
        Object.keys(checkedPeople).forEach(personId => {
          if (checkedPeople[personId]) {
            checkedPersonIds.push(personId);
          }
        });
        
        // Check if Unknown Person (id 0) is checked - handle both string "0" and number 0
        const isUnknownPersonChecked = checkedPeople['0'] === true || checkedPeople[0] === true;
        const isUnknownPerson = identifiedPerson && (identifiedPerson.id === 0 || identifiedPerson.id === '0');
        
        // If there's an identified person, include them even if not explicitly checked
        // Exception: Unknown Person (id 0) must be explicitly checked to show
        if (identifiedPerson && identifiedPerson.id !== undefined && identifiedPerson.id !== null) {
          const idStr = String(identifiedPerson.id);
          if (!checkedPersonIds.includes(idStr) && !isUnknownPerson) {
            checkedPersonIds.push(idStr);
          }
        }
        
        if (checkedPersonIds.length === 0 && !isUnknownPersonChecked) return; // No checked people, don't show label
        
        // Get person objects for all checked people
        const checkedPersons = [];
        
        // Handle Unknown Person specially
        if (isUnknownPersonChecked && isUnknownPerson) {
          checkedPersons.push(identifiedPerson);
        }
        
        // Handle regular people
        checkedPersonIds.forEach(personId => {
          // Skip "0" if we already added Unknown Person
          if (personId === '0' || personId === 0) {
            if (!isUnknownPersonChecked || !isUnknownPerson) {
              return; // Skip if Unknown Person not checked or not identified
            }
            return; // Already added above
          }
          
          if (this.planningCentrePeople) {
            const person = this.planningCentrePeople.find(p => String(p.id) === String(personId));
            if (person) {
              checkedPersons.push(person);
            }
          }
        });
        
        if (checkedPersons.length === 0) return;
        
        // Separate selected person from household members
        let selectedPerson = identifiedPerson;
        let householdMembers = checkedPersons.filter(p => p && p.id !== undefined && String(p.id) !== String(identifiedPerson.id));
        
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
    // Get name labels for all point labels (current image AND overlapping images)
    allPointNameLabels() {
      if (!this.selectedFile || !this.pointLabels || !this.pointLabelPersons || !this.imageConfig.image) {
        return [];
      }
      
      const allLabels = [];
      
      // 1. Get current image point name labels
      const currentImageLabels = this.pointNameLabels;
      allLabels.push(...currentImageLabels);
      
      // 2. Get overlapping image point name labels (transform coordinates)
      const overlapBoxes = this.overlapBoxes;
      if (overlapBoxes.length > 0 && this.pointLabels && this.pointLabelPersons) {
        const img = this.imageConfig.image;
        const currentNaturalWidth = img.naturalWidth;
        const currentNaturalHeight = img.naturalHeight;
        const currentDisplayWidth = this.imageConfig.width;
        const currentDisplayHeight = this.imageConfig.height;
        
        overlapBoxes.forEach(overlapBox => {
          if (!overlapBox.sourceFile || !overlapBox.sourcePanTilt) {
            return;
          }
          
          const otherFile = overlapBox.sourceFile;
          const otherPanTilt = overlapBox.sourcePanTilt;
          const otherBounds = overlapBox.sourceBounds;
          const intersection = overlapBox.intersection;
          
          // Get point labels for this overlapping image
          const otherImageName = otherFile.name;
          const otherPoints = this.pointLabels[otherImageName] || [];
          
          if (otherPoints.length === 0) {
            return;
          }
          
          // Transform coordinates similar to allPointLabelGroups
          const otherNaturalWidth = currentNaturalWidth;
          const otherNaturalHeight = currentNaturalHeight;
          const otherDisplayWidth = currentDisplayWidth;
          const otherDisplayHeight = currentDisplayHeight;
          const otherScaleX = otherDisplayWidth / otherNaturalWidth;
          const otherScaleY = otherDisplayHeight / otherNaturalHeight;
          
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
          
          otherPoints.forEach(point => {
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
            let householdMembers = checkedPersons.filter(p => p && p.id !== undefined && String(p.id) !== String(identifiedPerson.id));
            
            if (!selectedPerson || !selectedPerson.name) return;
            
            // Transform point coordinates from other image to current image
            const otherPointX = point.naturalX * otherScaleX;
            const otherPointY = point.naturalY * otherScaleY;
            
            // Check if point is within intersection region
            if (otherPointX < otherIntersectionXMin || otherPointX > otherIntersectionXMax ||
                otherPointY < otherIntersectionYMin || otherPointY > otherIntersectionYMax) {
              return; // Point is outside intersection, skip
            }
            
            // Map to grey box coordinates
            const relativeX = otherPointX - otherIntersectionXMin;
            const relativeY = otherPointY - otherIntersectionYMin;
            
            const mappedX = greyBoxX + relativeX * scaleX;
            const mappedY = greyBoxY + relativeY * scaleY;
            
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
            const groupX = mappedX - textWidth / 2 - padding; // Center horizontally
            const groupY = mappedY + boxSize / 2 + 2; // 2px below the marker
            
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
        });
      }
      
      return allLabels;
    },
    // Get point labels for current image AND overlapping images
    allPointLabelGroups() {
      if (!this.selectedFile || !this.pointLabels || !this.imageConfig.image) {
        return [];
      }
      
      const allPointGroups = [];
      
      // 1. Get current image point labels
      const currentImageGroups = this.pointLabelGroups;
      allPointGroups.push(...currentImageGroups);
      
      // 2. Get overlapping image point labels (transform coordinates)
      const overlapBoxes = this.overlapBoxes;
      if (overlapBoxes.length > 0 && this.pointLabels) {
        const img = this.imageConfig.image;
        const currentNaturalWidth = img.naturalWidth;
        const currentNaturalHeight = img.naturalHeight;
        const currentDisplayWidth = this.imageConfig.width;
        const currentDisplayHeight = this.imageConfig.height;
        
        overlapBoxes.forEach(overlapBox => {
          if (!overlapBox.sourceFile || !overlapBox.sourcePanTilt) {
            return;
          }
          
          const otherFile = overlapBox.sourceFile;
          const otherPanTilt = overlapBox.sourcePanTilt;
          const otherBounds = overlapBox.sourceBounds;
          const intersection = overlapBox.intersection;
          
          // Get point labels for this overlapping image
          const otherImageName = otherFile.name;
          const otherPoints = this.pointLabels[otherImageName] || [];
          
          if (otherPoints.length === 0) {
            return;
          }
          
          // Transform coordinates similar to bounding boxes
          const otherNaturalWidth = currentNaturalWidth;
          const otherNaturalHeight = currentNaturalHeight;
          const otherDisplayWidth = currentDisplayWidth;
          const otherDisplayHeight = currentDisplayHeight;
          const otherScaleX = otherDisplayWidth / otherNaturalWidth;
          const otherScaleY = otherDisplayHeight / otherNaturalHeight;
          
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
          
          otherPoints.forEach(point => {
            // Transform point coordinates from other image to current image
            const otherPointX = point.naturalX * otherScaleX;
            const otherPointY = point.naturalY * otherScaleY;
            
            // Check if point is within intersection region
            if (otherPointX < otherIntersectionXMin || otherPointX > otherIntersectionXMax ||
                otherPointY < otherIntersectionYMin || otherPointY > otherIntersectionYMax) {
              return; // Point is outside intersection, skip
            }
            
            // Map to grey box coordinates
            const relativeX = otherPointX - otherIntersectionXMin;
            const relativeY = otherPointY - otherIntersectionYMin;
            
            const mappedX = greyBoxX + relativeX * scaleX;
            const mappedY = greyBoxY + relativeY * scaleY;
            
            const isSelected = this.selectedPointLabelId === point.id;
            
            // Check if this point has a person selected
            const hasPerson = this.pointLabelPersons && this.pointLabelPersons[point.id] ? true : false;
            
            // Marker size and offset
            const fontSize = isSelected ? 24 : 16;
            const offsetX = isSelected ? 12 : 8;
            const offsetY = isSelected ? 12 : 8;
            
            // Bounding box around the marker
            const boxSize = isSelected ? 40 : 32;
            const boxX = mappedX - boxSize / 2;
            const boxY = mappedY - boxSize / 2;
            
            const boxColor = hasPerson ? '#10B981' : '#FFD700';
            const boxOpacity = isSelected ? this.selectedPointOpacity : 1;
            
            allPointGroups.push({
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
                x: mappedX,
                y: mappedY,
                text: '◉',
                fontSize: fontSize,
                fontFamily: 'Arial',
                fill: boxColor,
                align: 'center',
                verticalAlign: 'middle',
                offsetX: offsetX,
                offsetY: offsetY,
                opacity: boxOpacity,
                listening: false
              }
            });
          });
        });
      }
      
      return allPointGroups;
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
    // Cluster bounding boxes from different images
    boundingBoxClusters() {
      if (!this.showFaces || !this.selectedFile || !this.imageConfig.image) {
        return [];
      }
      
      const { currentBoxes, overlapBoxes } = this.allBoundingBoxesWithMetadata;
      const allBoxes = [...currentBoxes, ...overlapBoxes];
      
      if (allBoxes.length === 0) {
        return [];
      }
      
      const clusters = this.clusterBoundingBoxes(allBoxes);
      
      // For each cluster, select the key box (highest confidence, then largest area)
      return clusters.map((cluster, index) => {
        // Select key box: highest confidence, then largest area
        const keyBox = cluster.reduce((best, box) => {
          if (box.faceConfidence > best.faceConfidence) return box;
          if (box.faceConfidence === best.faceConfidence && box.area > best.area) return box;
          return best;
        });
        
        const keyBoxIndex = cluster.indexOf(keyBox);
        const isKeyBoxFromCurrentImage = keyBox.isCurrentImage;
        const clusterId = `cluster-${index}-${keyBox.sourceImage}-${keyBox.embeddingIndex}`;
        
        return {
          clusterId,
          boxes: cluster,
          keyBox,
          keyBoxIndex,
          isKeyBoxFromCurrentImage,
          // Key box metadata for easy access
          x: keyBox.x,
          y: keyBox.y,
          width: keyBox.width,
          height: keyBox.height,
          faceConfidence: keyBox.faceConfidence,
          area: keyBox.area,
          embeddingIndex: keyBox.embeddingIndex,
          facialArea: keyBox.facialArea,
          sourceFile: keyBox.sourceFile,
          sourceImage: keyBox.sourceImage
        };
      });
    },
    // Get renderable boxes for all clusters (unified rendering)
    clusteredBoundingBoxes() {
      if (!this.showFaces || !this.selectedFile || !this.imageConfig.image) {
        return [];
      }
      
      const clusters = this.boundingBoxClusters;
      if (clusters.length === 0) {
        return [];
      }
      
      // Get original facialAreaBoxes for styling reference
      const originalBoxes = this.facialAreaBoxes;
      const originalBoxMap = new Map();
      originalBoxes.forEach(box => {
        originalBoxMap.set(box.embeddingIndex, box);
      });
      
      const renderableBoxes = [];
      
      clusters.forEach(cluster => {
        const keyBox = cluster.keyBox;
        
        // Check if key box has a label
        let hasLabel = false;
        if (this.getFaceLabelKey && this.faceLabels) {
          const key = this.getFaceLabelKey(keyBox.sourceImage, keyBox.facialArea);
          hasLabel = key ? !!this.faceLabels[key] : false;
        }
        
        // Check if this cluster's key box is selected (unified selection)
        // Use localSelectedClusterId as fallback if prop hasn't updated yet
        const selectedClusterId = this.selectedKeyBox?.clusterId || this.localSelectedClusterId;
        const isSelected = selectedClusterId === cluster.clusterId;
        
        // Determine opacity - use blinking opacity if selected
        let boxOpacity = 1;
        if (isSelected) {
          boxOpacity = this.selectedBoxOpacity;
        }
        
        // Use styling from facialAreaBoxes if it's a current image box
        let strokeColor = hasLabel ? '#10B981' : '#FFD700';
        // Always use thick border (4) when selected, thin (2) when not selected
        let strokeWidth = isSelected ? 4 : 2;
        
        if (cluster.isKeyBoxFromCurrentImage) {
          // Use original box styling if available, but override strokeWidth for selected boxes
          const originalBox = originalBoxMap.get(keyBox.embeddingIndex);
          if (originalBox) {
            strokeColor = originalBox.stroke || strokeColor;
            // Ensure selected boxes always have thick border
            strokeWidth = isSelected ? 4 : (originalBox.strokeWidth || 2);
          }
        }
        
        const clusterId = cluster.clusterId;
        // Create a new object each time to ensure vue-konva detects changes
        const boxConfig = {
          x: keyBox.x,
          y: keyBox.y,
          width: keyBox.width,
          height: keyBox.height,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          fill: 'rgba(0,0,0,0.01)', // Very slight fill to ensure clickability
          opacity: boxOpacity,
          listening: true,
          hitStrokeWidth: 20, // Increase hit area for easier clicking
          perfectDrawEnabled: false,
          draggable: false, // Ensure boxes are not draggable
          // Metadata for click handler
          clusterId: clusterId,
          isKeyBoxFromCurrentImage: cluster.isKeyBoxFromCurrentImage,
          keyBoxEmbeddingIndex: keyBox.embeddingIndex,
          keyBoxSourceFile: keyBox.sourceFile,
          keyBoxSourceImage: keyBox.sourceImage,
          keyBoxFacialArea: keyBox.facialArea,
          // For backward compatibility
          embeddingIndex: keyBox.embeddingIndex,
          sourceFile: keyBox.sourceFile,
          sourceImage: keyBox.sourceImage,
          facialArea: keyBox.facialArea,
          // Add onClick handler directly in config
          onClick: (event) => {
            this.handleClusterBoxClick(clusterId, event);
          }
        };
        renderableBoxes.push(boxConfig);
        
        // Store box data for click handler lookup
        if (!this.clusterBoxClickHandlers) {
          this.clusterBoxClickHandlers = new Map();
        }
        this.clusterBoxClickHandlers.set(cluster.clusterId, {
          clusterId: cluster.clusterId,
          sourceFile: keyBox.sourceFile,
          embeddingIndex: keyBox.embeddingIndex,
          facialArea: keyBox.facialArea,
          sourceImage: keyBox.sourceImage,
          isKeyBoxFromCurrentImage: cluster.isKeyBoxFromCurrentImage
        });
      });
      
      // Check if selected cluster was filtered out - if so, deselect it
      if (this.selectedKeyBox) {
        const isStillVisible = renderableBoxes.some(box => 
          box.clusterId === this.selectedKeyBox.clusterId
        );
        if (!isStillVisible) {
          this.$nextTick(() => {
            this.$emit('cluster-box-deselected');
          });
        }
      }
      
      return renderableBoxes;
    },
    // Get name labels for clustered bounding boxes
    clusteredNameLabels() {
      if (!this.showFaces || !this.selectedFile || !this.imageConfig.image) {
        return [];
      }
      
      const clusters = this.boundingBoxClusters;
      if (clusters.length === 0) {
        return [];
      }
      
      const img = this.imageConfig.image;
      const displayWidth = this.imageConfig.width;
      const displayHeight = this.imageConfig.height;
      
      const allLabels = [];
      
      clusters.forEach(cluster => {
        const keyBox = cluster.keyBox;
        
        if (!keyBox.sourceFile || !keyBox.facialArea) {
          return;
        }
        
        // Get the face label key for this bounding box
        let key = null;
        if (this.getFaceLabelKey) {
          key = this.getFaceLabelKey(keyBox.sourceImage, keyBox.facialArea);
        }
        
        if (!key) return;
        
        // Get the identified person from faceLabels
        const identifiedPerson = this.faceLabels && this.faceLabels[key] ? this.faceLabels[key] : null;
        
        // Get checked people for this bounding box
        const checkedPeople = this.checkedPeopleByBox && this.checkedPeopleByBox[key] ? this.checkedPeopleByBox[key] : {};
        // Normalize keys to handle both string and number IDs
        const checkedPersonIds = [];
        Object.keys(checkedPeople).forEach(personId => {
          if (checkedPeople[personId]) {
            checkedPersonIds.push(personId);
          }
        });
        
        // Check if Unknown Person (id 0) is checked - handle both string "0" and number 0
        const isUnknownPersonChecked = checkedPeople['0'] === true || checkedPeople[0] === true;
        const isUnknownPerson = identifiedPerson && (identifiedPerson.id === 0 || identifiedPerson.id === '0');
        
        // If there's an identified person, include them even if not explicitly checked
        // Exception: Unknown Person (id 0) must be explicitly checked to show
        if (identifiedPerson && identifiedPerson.id !== undefined && identifiedPerson.id !== null) {
          const idStr = String(identifiedPerson.id);
          if (!checkedPersonIds.includes(idStr) && !isUnknownPerson) {
            checkedPersonIds.push(idStr);
          }
        }
        
        if (checkedPersonIds.length === 0 && !isUnknownPersonChecked) return; // No checked people, don't show label
        
        // Get person objects for all checked people
        const checkedPersons = [];
        
        // Handle Unknown Person specially
        if (isUnknownPersonChecked && isUnknownPerson) {
          checkedPersons.push(identifiedPerson);
        }
        
        // Handle regular people
        checkedPersonIds.forEach(personId => {
          // Skip "0" if we already added Unknown Person
          if (personId === '0' || personId === 0) {
            if (!isUnknownPersonChecked || !isUnknownPerson) {
              return; // Skip if Unknown Person not checked or not identified
            }
            return; // Already added above
          }
          
          if (this.planningCentrePeople) {
            const person = this.planningCentrePeople.find(p => String(p.id) === String(personId));
            if (person) {
              checkedPersons.push(person);
            }
          }
        });
        
        if (checkedPersons.length === 0) return;
        
        // Separate selected person from household members
        let selectedPerson = null;
        let householdMembers = [];
        
        if (identifiedPerson) {
          // Use identified person as selected person
          selectedPerson = identifiedPerson;
          // Get household members from checked people (excluding selected person)
          householdMembers = checkedPersons.filter(p => p && p.id !== undefined && String(p.id) !== String(identifiedPerson.id));
        } else {
          // No identified person, use first checked person as selected
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
        const groupX = keyBox.x + (keyBox.width - textWidth) / 2 - padding;
        const groupY = keyBox.y + keyBox.height + 2;
        
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
      });
      
      return allLabels;
    },
    // Get bounding boxes from overlapping images, transformed to grey box coordinates
  },
  watch: {
    selectedKeyBox: {
      handler(newVal, oldVal) {
        // Always clear blinking interval first (same pattern as point labels)
        if (this.blinkInterval) {
          clearInterval(this.blinkInterval);
          this.blinkInterval = null;
        }
        
        if (newVal !== null) {
          // Start blinking animation
          this.localSelectedClusterId = newVal.clusterId;
          this.selectedBoxOpacity = 1;
          this.blinkInterval = setInterval(() => {
            this.selectedBoxOpacity = this.selectedBoxOpacity === 1 ? 0.3 : 1;
            this.blinkKey = this.blinkKey + 1;
            this.$forceUpdate();
          }, 500);
        } else {
          // Stop blinking
          this.localSelectedClusterId = null;
          this.selectedBoxOpacity = 1;
        }
      },
      immediate: false,
      deep: false
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
        // Clear cluster box click handlers when switching files
        if (this.clusterBoxClickHandlers) {
          this.clusterBoxClickHandlers.clear();
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
    // Unified handler for cluster box clicks
    handleClusterBoxClick(clusterId, event) {
      // Stop event propagation to prevent interfering with other clicks
      if (event) {
        if (event.cancelBubble !== undefined) {
          event.cancelBubble = true;
        }
        if (event.evt) {
          event.evt.stopPropagation();
          event.evt.preventDefault();
        }
      }
      
      // Look up box data from Map
      if (!this.clusterBoxClickHandlers || !this.clusterBoxClickHandlers.has(clusterId)) {
        return;
      }
      
      const clusterBox = this.clusterBoxClickHandlers.get(clusterId);
      
      // Unified selection: check if clicking the same cluster
      const selectedClusterId = this.selectedKeyBox?.clusterId || this.localSelectedClusterId;
      const isSameCluster = selectedClusterId === clusterId;
      
      if (isSameCluster) {
        // Deselect - stop blinking and emit event to parent
        this.handleDeselection();
        this.$emit('cluster-box-deselected');
      } else {
        // Select this cluster's key box
        const keyBoxData = {
          clusterId: clusterBox.clusterId,
          sourceFile: clusterBox.sourceFile,
          embeddingIndex: clusterBox.embeddingIndex,
          facialArea: clusterBox.facialArea,
          sourceImage: clusterBox.sourceImage,
          isKeyBoxFromCurrentImage: clusterBox.isKeyBoxFromCurrentImage
        };
        // Emit unified event for parent component
        // The watcher will handle starting the blinking animation when selectedKeyBox prop updates
        this.$emit('cluster-box-click', keyBoxData);
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
      // Don't allow point label creation when in selection mode
      if (this.selectedKeyBox) {
        return;
      }
      
      // Check if Shift key is pressed
      const evt = event.evt || event;
      if (evt && evt.shiftKey) {
        // Get the stage position
        const stage = event.target ? event.target.getStage() : event.getStage();
        if (!stage) return;
        
        const pointerPos = stage.getPointerPosition();
        if (!pointerPos) return;
        
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
    handleDeselection() {
      // Clear local selection state (watcher handles interval clearing automatically)
      this.localSelectedClusterId = null;
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
    // Check if two boxes overlap >50% in BOTH width AND height
    // PRECONDITION: Both boxes must be in the same coordinate system (current image coordinates)
    // This is guaranteed by allBoundingBoxesWithMetadata() which transforms overlapping boxes
    checkBoxOverlap(box1, box2) {
      // Calculate intersection
      const x1Min = box1.x;
      const x1Max = box1.x + box1.width;
      const y1Min = box1.y;
      const y1Max = box1.y + box1.height;
      
      const x2Min = box2.x;
      const x2Max = box2.x + box2.width;
      const y2Min = box2.y;
      const y2Max = box2.y + box2.height;
      
      const xMin = Math.max(x1Min, x2Min);
      const xMax = Math.min(x1Max, x2Max);
      const yMin = Math.max(y1Min, y2Min);
      const yMax = Math.min(y1Max, y2Max);
      
      if (xMin >= xMax || yMin >= yMax) {
        return false; // No intersection
      }
      
      const intersectionWidth = xMax - xMin;
      const intersectionHeight = yMax - yMin;
      
      // Check if >50% overlap in width
      const widthOverlap = intersectionWidth / Math.min(box1.width, box2.width) > 0.5;
      
      // Check if >50% overlap in height
      const heightOverlap = intersectionHeight / Math.min(box1.height, box2.height) > 0.5;
      
      return widthOverlap && heightOverlap;
    },
    // Cluster bounding boxes from different images
    // PRECONDITION: All boxes are in the same coordinate system (current image coordinates)
    clusterBoundingBoxes(boxes) {
      if (!boxes || boxes.length === 0) {
        return [];
      }
      
      const clusters = [];
      const clusteredBoxes = new Set(); // Boxes already in clusters
      
      // For each box in boxes
      for (const box of boxes) {
        // Skip if already in a cluster
        if (clusteredBoxes.has(box)) continue;
        
        // Create a new cluster with this box
        const currentCluster = [box];
        clusteredBoxes.add(box);
        
        // Processing stack for DFS
        const processingStack = [box];
        
        // While processing stack is not empty
        while (processingStack.length > 0) {
          // Pop a box from the stack - this is the box to process
          const boxToProcess = processingStack.pop();
          
          // Iterate through every other box not in the list of boxes already in clusters
          for (const candidateBox of boxes) {
            // Skip if already in a cluster
            if (clusteredBoxes.has(candidateBox)) continue;
            
            // Check that current cluster does not have a box that shares the same source image as the candidate box
            const hasSameSourceImage = currentCluster.some(
              clusterBox => clusterBox.sourceImage === candidateBox.sourceImage
            );
            if (hasSameSourceImage) continue; // Skip this candidate
            
            // Check that the candidate and the box to process overlaps with checkBoxOverlap
            if (this.checkBoxOverlap(boxToProcess, candidateBox)) {
              // If it overlaps, add this box to the cluster
              currentCluster.push(candidateBox);
              // Add this box to the list of boxes already in clusters
              clusteredBoxes.add(candidateBox);
              // Add this box to processing stack
              processingStack.push(candidateBox);
            }
          }
        }
        
        // Add the completed cluster to clusters list
        clusters.push(currentCluster);
      }
      
      return clusters;
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
        <v-rect v-for="(box, index) in clusteredBoundingBoxes" :key="'cluster-box-' + index + '-' + blinkKey" :config="box"></v-rect>
        <v-group v-for="(label, index) in clusteredNameLabels" :key="'cluster-name-' + index" :config="{ x: label.groupX, y: label.groupY }">
          <v-rect :config="label.bgRect"></v-rect>
          <v-text v-for="(textItem, textIndex) in label.texts" :key="'text-' + textIndex" :config="textItem"></v-text>
        </v-group>
        <v-rect v-for="(box, index) in annotations" :key="'annotation-' + index" :config="box"></v-rect>
        <v-rect v-for="(pointGroup, index) in allPointLabelGroups" :key="'point-box-' + index" :config="pointGroup.boundingBox" @click="handlePointLabelClick(pointGroup.id)"></v-rect>
        <v-text v-for="(pointGroup, index) in allPointLabelGroups" :key="'point-marker-' + index" :config="pointGroup.marker"></v-text>
        <v-group v-for="(label, index) in allPointNameLabels" :key="'point-name-' + index" :config="{ x: label.groupX, y: label.groupY }">
          <v-rect :config="label.bgRect"></v-rect>
          <v-text v-for="(textItem, textIndex) in label.texts" :key="'point-text-' + textIndex" :config="textItem"></v-text>
        </v-group>
        <v-group v-if="panTiltZoomConfig" :config="{ x: panTiltZoomConfig.groupX, y: panTiltZoomConfig.groupY }">
          <v-rect :config="panTiltZoomConfig.bgRect"></v-rect>
          <v-text :config="panTiltZoomConfig.text"></v-text>
        </v-group>
        <v-rect v-for="(overlapBox, index) in overlapBoxes" :key="'overlap-' + index" :config="overlapBox"></v-rect>
      </v-layer>
    </v-stage>
    <div v-if="showShiftTooltip" :style="{ position: 'absolute', left: tooltipX + 'px', top: tooltipY + 'px', pointerEvents: 'none', zIndex: 1000, backgroundColor: 'rgba(0, 0, 0, 0.8)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', whiteSpace: 'nowrap' }">
      Left Click to Add Name
    </div>
  </div>`
};

