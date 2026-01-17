// ImageAnnotationPanel Component
export const ImageAnnotationPanel = {
  name: 'ImageAnnotationPanel',
  props: {
    user: Object,
    loading: Boolean,
    error: String,
    selectedImage: String,
    selectedFile: Object,
    imageLoading: Boolean,
    currentFolderFiles: Array,
    currentFileIndex: Number,
    hasPrevImage: Boolean,
    hasNextImage: Boolean,
    selectedKeyBox: Object,
    annotations: Array,
    showFaces: Boolean,
    showOverlapBoxes: Boolean,
    faceLabels: Object,
    pointLabels: Object,
    selectedPointLabelId: String,
    pointLabelPersons: Object,
    checkedPeopleByPoint: Object,
    checkedPeopleByBox: Object,
    planningCentrePeople: Array,
    ensureUrlValid: Function,
    fetchModelData: Function
  },
  data() {
    return {
      touchStartX: null,
      touchStartY: null,
      isSwipe: false
    };
  },
  computed: {
    getImageTimestamp() {
      if (!this.selectedFile || !this.selectedFile.name) return null;
      
      try {
        // Extract the first part before the underscore (hex timestamp)
        const parts = this.selectedFile.name.split('_');
        if (parts.length === 0 || !parts[0]) return null;
        
        const hexTimestamp = parts[0];
        
        // Convert hex to decimal (unix timestamp)
        const unixTimestamp = parseInt(hexTimestamp, 16);
        
        if (isNaN(unixTimestamp)) return null;
        
        // Convert unix timestamp to Date object
        const date = new Date(unixTimestamp * 1000); // Convert seconds to milliseconds
        
        // Format the date/time
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      } catch (error) {
        console.error('Error parsing timestamp from filename:', error);
        return null;
      }
    }
  },
  methods: {
    getFaceLabelKey(imageName, facialArea) {
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getFaceLabelKey(imageName, facialArea);
      }
      return null;
    },
    getHouseholdMembers(person) {
      if (typeof window !== 'undefined' && window.Services && window.Services.planningCenter) {
        return window.Services.planningCenter.getHouseholdMembers(person, this.planningCentrePeople);
      }
      return [];
    },
    async goPrevImage() {
      if (this.currentFileIndex > 0) {
        const newIndex = this.currentFileIndex - 1;
        const nextFile = this.currentFolderFiles[newIndex];
        if (nextFile) {
          // Emit file change event
          this.$emit('file-change', nextFile);
          this.$emit('file-index-change', newIndex);
          
          // Get valid URL
          if (this.ensureUrlValid) {
            const validUrl = await this.ensureUrlValid(nextFile);
            this.$emit('image-change', validUrl);
            if (!validUrl) {
              console.error('Failed to get valid URL for file:', nextFile.name);
            }
          }
          
          // Fetch model data if model_url exists
          if (nextFile.model_url && this.fetchModelData) {
            this.fetchModelData(nextFile);
          }
          
          // Clear selection
          this.$emit('clear-selection');
        }
      }
    },
    async goNextImage() {
      if (this.currentFileIndex >= 0 && this.currentFileIndex < this.currentFolderFiles.length - 1) {
        const newIndex = this.currentFileIndex + 1;
        const nextFile = this.currentFolderFiles[newIndex];
        if (nextFile) {
          // Emit file change event
          this.$emit('file-change', nextFile);
          this.$emit('file-index-change', newIndex);
          
          // Get valid URL
          if (this.ensureUrlValid) {
            const validUrl = await this.ensureUrlValid(nextFile);
            this.$emit('image-change', validUrl);
            if (!validUrl) {
              console.error('Failed to get valid URL for file:', nextFile.name);
            }
          }
          
          // Fetch model data if model_url exists
          if (nextFile.model_url && this.fetchModelData) {
            this.fetchModelData(nextFile);
          }
          
          // Clear selection
          this.$emit('clear-selection');
        }
      }
    },
    handleTouchStart(event) {
      // Only handle touches when user is logged in, not loading, and an image is selected
      if (!this.user || this.loading || !this.selectedImage) return;
      
      // Get the first touch point
      const touch = event.touches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.isSwipe = false; // Reset swipe flag
    },
    handleTouchEnd(event) {
      // Only handle if we have a start position
      if (this.touchStartX === null || this.touchStartY === null) return;
      if (!this.user || this.loading || !this.selectedImage) {
        this.touchStartX = null;
        this.touchStartY = null;
        return;
      }
      
      // Get the end touch point
      const touch = event.changedTouches[0];
      const touchEndX = touch.clientX;
      const touchEndY = touch.clientY;
      
      // Calculate the difference
      const deltaX = touchEndX - this.touchStartX;
      const deltaY = touchEndY - this.touchStartY;
      
      // Minimum swipe distance (in pixels)
      const minSwipeDistance = 50;
      
      // Check if it's a horizontal swipe (more horizontal than vertical)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        // Prevent default to avoid any unwanted behavior
        event.preventDefault();
        this.isSwipe = true;
        
        // Hide banner on swipe
        this.$emit('banner-visibility-change', false);
        
        if (deltaX > 0) {
          // Swipe right - go to previous image
          if (this.hasPrevImage) {
            this.goPrevImage();
          }
        } else {
          // Swipe left - go to next image
          if (this.hasNextImage) {
            this.goNextImage();
          }
        }
      } else {
        // It's a tap (not a swipe) - toggle banner
        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
          // Very small movement, treat as tap
          this.$emit('banner-visibility-change', null); // null means toggle
        }
      }
      
      // Reset touch positions
      this.touchStartX = null;
      this.touchStartY = null;
    },
    onUpdateAnnotations(newAnnotations) {
      this.$emit('update-annotations', newAnnotations);
    }
  },
  emits: [
    'sign-in',
    'prev-image',
    'next-image',
    'touch-start',
    'touch-end',
    'update-annotations',
    'loading-change',
    'face-box-click',
    'point-label-click',
    'point-label-create',
    'file-change',
    'image-change',
    'file-index-change',
    'clear-selection',
    'banner-visibility-change'
  ],
  template: `
    <div class="image-pane bg-gray-50 relative">
      <slot></slot>
      <!-- Sign-in UI -->
      <div v-if="!user && !loading" class="flex items-center justify-center h-full bg-gray-50">
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900 mb-4">eShepherd</h1>
          <p class="text-gray-600 mb-6">Sign in to view your images</p>
          <button @click="$emit('sign-in')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Sign in with Google
          </button>
          <div v-if="error" class="mt-4 text-red-600">{{ error }}</div>
        </div>
      </div>

      <!-- Loading UI -->
      <div v-if="loading" class="flex items-center justify-center h-full bg-gray-50">
        <div class="text-center">
          <div class="spinner mx-auto mb-4"></div>
          <p class="text-gray-600">Loading...</p>
        </div>
      </div>

      <!-- Image Display UI -->
      <div v-if="user && !loading">
        <div class="w-full border-b border-gray-200 bg-gray-50 px-2 py-1 flex items-center justify-center gap-1">
          <button
            :disabled="!hasPrevImage"
            @click="goPrevImage"
            class="inline-flex items-center gap-1 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 shadow px-1.5 py-0.5 text-[11px]"
          >
            <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.03 15.53a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 1 1 1.06 1.06L8.56 10l3.47 3.47a.75.75 0 0 1 0 1.06Z" clip-rule="evenodd"/></svg>
            Prev
          </button>
          <button
            :disabled="!hasNextImage"
            @click="goNextImage"
            class="inline-flex items-center gap-1 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 shadow px-1.5 py-0.5 text-[11px]"
          >
            Next
            <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.97 4.47a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06L11.44 10 7.97 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>
          </button>
          <span class="text-xs text-gray-500 ml-2">Use ← → arrow keys<span v-if="selectedBoundingBoxIndex !== null">, Tab for next box, ESC to deselect</span></span>
        </div>
        <div class="flex-1 w-full flex flex-col items-center justify-center bg-gray-50 relative" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
          <div class="flex-1 w-full flex items-center justify-center relative">
            <image-annotation-canvas 
              v-if="selectedImage" 
              :image-src="selectedImage" 
              :annotations="annotations" 
              :selected-file="selectedFile" 
              :show-faces="showFaces" 
              :show-overlap-boxes="showOverlapBoxes"
              :face-labels="faceLabels" 
              :selected-key-box="selectedKeyBox"
              :point-labels="pointLabels" 
              :selected-point-label-id="selectedPointLabelId" 
              :point-label-persons="pointLabelPersons" 
              :checked-people-by-point="checkedPeopleByPoint" 
              :get-face-label-key="getFaceLabelKey" 
              :checked-people-by-box="checkedPeopleByBox" 
              :planning-centre-people="planningCentrePeople" 
              :get-household-members="getHouseholdMembers" 
              :current-folder-files="currentFolderFiles"
              :fetch-model-data="fetchModelData"
              @loading-change="$emit('loading-change', $event)"
              @face-box-click="$emit('face-box-click', $event)"
              @cluster-box-click="$emit('cluster-box-click', $event)"
              @cluster-box-deselected="$emit('cluster-box-deselected')"
              @face-box-deselected="$emit('face-box-deselected')"
              @point-label-click="$emit('point-label-click', $event)"
              @point-label-create="$emit('point-label-create', $event)"
            ></image-annotation-canvas>
            <p v-else class="text-gray-500">Select a session to view images</p>
          </div>
          <div v-if="selectedImage && !imageLoading" class="text-xs text-gray-500 mt-2 pb-2">
            Hold Shift and Left Click on Image to add names without a box
          </div>
          <div v-if="selectedImage && currentFolderFiles.length > 0 && !imageLoading" class="absolute top-4 right-4 text-white px-3 py-1.5 rounded text-sm font-medium" style="background-color: rgba(0, 0, 0, 0.5);">
            {{ currentFileIndex + 1 }}/{{ currentFolderFiles.length }}
          </div>
          <div v-if="selectedFile && getImageTimestamp && !imageLoading" class="absolute top-4 left-4 text-white px-3 py-1.5 rounded text-sm font-medium" style="background-color: rgba(0, 0, 0, 0.5);">
            {{ getImageTimestamp }}
          </div>
        </div>
      </div>
    </div>
  `
};

