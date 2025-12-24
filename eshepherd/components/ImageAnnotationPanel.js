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
    selectedBoundingBoxIndex: Number,
    annotations: Array,
    showFaces: Boolean,
    faceLabels: Object,
    pointLabels: Object,
    selectedPointLabelId: String,
    pointLabelPersons: Object,
    checkedPeopleByPoint: Object,
    checkedPeopleByBox: Object,
    planningCentrePeople: Array,
    // Methods passed as props
    getFaceLabelKey: Function,
    getHouseholdMembers: Function,
    getImageTimestamp: Function
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
    'point-label-create'
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
            @click="$emit('prev-image')"
            class="inline-flex items-center gap-1 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 shadow px-1.5 py-0.5 text-[11px]"
          >
            <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.03 15.53a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 1 1 1.06 1.06L8.56 10l3.47 3.47a.75.75 0 0 1 0 1.06Z" clip-rule="evenodd"/></svg>
            Prev
          </button>
          <button
            :disabled="!hasNextImage"
            @click="$emit('next-image')"
            class="inline-flex items-center gap-1 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 shadow px-1.5 py-0.5 text-[11px]"
          >
            Next
            <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.97 4.47a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06L11.44 10 7.97 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>
          </button>
          <span class="text-xs text-gray-500 ml-2">Use ← → arrow keys<span v-if="selectedBoundingBoxIndex !== null">, Tab for next box, ESC to deselect</span></span>
        </div>
        <div class="flex-1 w-full flex flex-col items-center justify-center bg-gray-50 relative" @touchstart="$emit('touch-start', $event)" @touchend="$emit('touch-end', $event)">
          <div class="flex-1 w-full flex items-center justify-center relative">
            <image-annotation 
              v-if="selectedImage" 
              :image-src="selectedImage" 
              :annotations="annotations" 
              :selected-file="selectedFile" 
              :show-faces="showFaces" 
              :face-labels="faceLabels" 
              :selected-bounding-box-index="selectedBoundingBoxIndex" 
              :point-labels="pointLabels" 
              :selected-point-label-id="selectedPointLabelId" 
              :point-label-persons="pointLabelPersons" 
              :checked-people-by-point="checkedPeopleByPoint" 
              :get-face-label-key="getFaceLabelKey" 
              :checked-people-by-box="checkedPeopleByBox" 
              :planning-centre-people="planningCentrePeople" 
              :get-household-members="getHouseholdMembers" 
              @update="$emit('update-annotations', $event)"
              @loading-change="$emit('loading-change', $event)"
              @face-box-click="$emit('face-box-click', $event)"
              @point-label-click="$emit('point-label-click', $event)"
              @point-label-create="$emit('point-label-create', $event)"
            ></image-annotation>
            <p v-else class="text-gray-500">Select a session to view images</p>
          </div>
          <div v-if="selectedImage && !imageLoading" class="text-xs text-gray-500 mt-2 pb-2">
            Hold Shift and Left Click on Image to add names without a box
          </div>
          <div v-if="selectedImage && currentFolderFiles.length > 0 && !imageLoading" class="absolute top-4 right-4 text-white px-3 py-1.5 rounded text-sm font-medium" style="background-color: rgba(0, 0, 0, 0.5);">
            {{ currentFileIndex + 1 }}/{{ currentFolderFiles.length }}
          </div>
          <div v-if="selectedFile && getImageTimestamp(selectedFile) && !imageLoading" class="absolute top-4 left-4 text-white px-3 py-1.5 rounded text-sm font-medium" style="background-color: rgba(0, 0, 0, 0.5);">
            {{ getImageTimestamp(selectedFile) }}
          </div>
        </div>
      </div>
    </div>
  `
};

