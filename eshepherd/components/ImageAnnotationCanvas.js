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
    pointLabels: Object,
    selectedPointLabelId: String,
    pointLabelPersons: Object,
    checkedPeopleByPoint: Object,
    getFaceLabelKey: Function,
    checkedPeopleByBox: Object,
    planningCentrePeople: Array,
    getHouseholdMembers: Function
  },
  emits: [
    'face-box-click',
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
      pointBlinkInterval: null,
      showShiftTooltip: false,
      tooltipX: 0,
      tooltipY: 0
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
    }
  },
  watch: {
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
        } else {
          // Stop blinking
          this.selectedBoxOpacity = 1;
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
      this.$emit('face-box-click', embeddingIndex);
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
        <v-rect v-for="(box, index) in facialAreaBoxes" :key="index" :config="box" @click="handleBoxClick(box.embeddingIndex)"></v-rect>
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
      </v-layer>
    </v-stage>
    <div v-if="showShiftTooltip" :style="{ position: 'absolute', left: tooltipX + 'px', top: tooltipY + 'px', pointerEvents: 'none', zIndex: 1000, backgroundColor: 'rgba(0, 0, 0, 0.8)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', whiteSpace: 'nowrap' }">
      Left Click to Add Name
    </div>
  </div>`
};

