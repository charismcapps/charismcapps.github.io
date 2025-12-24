// ControlSidePanel Component
export const ControlSidePanel = {
  name: 'ControlSidePanel',
  props: {
    user: Object,
    loading: Boolean,
    sessions: Array,
    selectedSessionName: String,
    selectedFile: Object,
    peopleRetrievalStatus: String,
    peopleRetrievalCount: Number,
    selectedBoundingBoxIndex: Number,
    selectedOverlapBox: Object,
    selectedPointLabelId: String,
    labellingStarted: Boolean,
    searchQuery: String,
    searchResults: Array,
    selectedSearchIndex: Number,
    faceGuesses: Array,
    planningCentrePeople: Array,
    checkingEmbeddingInDB: Boolean,
    checkInOverlaySelection: Object,
    checkInSubmitting: Boolean,
    checkInError: String,
    checkInSuccessMessage: String,
    // Additional props needed for component methods
    showFaces: Boolean,
    faceLabels: Object,
    faceScanningStatus: Object,
    faceScanCount: Object,
    checkedPeopleByBox: Object,
    checkedPeopleByPoint: Object,
    pointLabelPersons: Object,
    embeddingsStored: Object,
    embeddingsCountCache: Object,
    faceMatchCache: Object,
    embeddingIndex: Object // EmbeddingIndex from client-vector-search
  },
  computed: {
    getFacesButtonText() {
      if (!this.labellingStarted) {
        return 'Start Labelling';
      }
      return this.showFaces ? 'Hide Faces' : 'Show Faces';
    },
    getFacesButtonClass() {
      if (!this.labellingStarted) {
        return 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600';
      }
      return this.showFaces ? 'bg-green-500 text-white border-green-600' : 'bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300';
    },
    getFaceScanningStatus() {
      if (!this.selectedFile || !this.selectedFile.name) {
        return null;
      }
      return this.faceScanningStatus?.[this.selectedFile.name] || null;
    },
    getFaceScanCount() {
      if (!this.selectedFile || !this.selectedFile.name) {
        return 0;
      }
      return this.faceScanCount?.[this.selectedFile.name] || 0;
    },
    getCurrentFaceLabel() {
      // Check for overlap box first
      if (this.selectedOverlapBox) {
        const { sourceFile, facialArea } = this.selectedOverlapBox;
        if (sourceFile && facialArea) {
          const key = this.getFaceLabelKey(sourceFile.name, facialArea);
          return key ? this.faceLabels[key] : null;
        }
        return null;
      }
      // Otherwise check for regular box
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getCurrentFaceLabel(this.selectedFile, this.selectedBoundingBoxIndex, this.faceLabels);
      }
      return null;
    },
    getCurrentPointLabel() {
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getCurrentPointLabel(this.selectedPointLabelId, this.pointLabelPersons);
      }
      return null;
    },
    getSelectedPersonCheckedState() {
      // Check for overlap box first
      if (this.selectedOverlapBox) {
        const { sourceFile, facialArea } = this.selectedOverlapBox;
        if (sourceFile && facialArea) {
          const key = this.getFaceLabelKey(sourceFile.name, facialArea);
          const label = key ? this.faceLabels[key] : null;
          if (label && label.id) {
            const checked = this.checkedPeopleByBox[key];
            return checked && checked[label.id] ? true : false;
          }
        }
        return false;
      }
      // Otherwise check for regular box
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getSelectedPersonCheckedState(this.selectedFile, this.selectedBoundingBoxIndex, this.faceLabels, this.checkedPeopleByBox, false);
      }
      return false;
    },
    getSelectedPointPersonCheckedState() {
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getSelectedPointPersonCheckedState(this.selectedPointLabelId, this.pointLabelPersons, this.checkedPeopleByPoint, false);
      }
      return false;
    },
    getMatchDisplayText() {
      const currentLabel = this.getCurrentFaceLabel;
      if (!currentLabel || !currentLabel.id) {
        return '0 Embeddings in DB';
      }
      
      const embeddingsCount = this.embeddingsCountCache?.[currentLabel.id] || 0;
      
      // Check if there's a match for the current bounding box
      let targetFile = this.selectedFile;
      let targetEmbeddingIndex = this.selectedBoundingBoxIndex;
      let imageKey = targetFile?.name;
      
      if (this.selectedOverlapBox) {
        targetFile = this.selectedOverlapBox.sourceFile;
        targetEmbeddingIndex = this.selectedOverlapBox.embeddingIndex;
        imageKey = targetFile?.name;
      }
      
      if (targetEmbeddingIndex === null || !targetFile || !imageKey) {
        return `${embeddingsCount} Embeddings in DB`;
      }
      
      const matchCache = this.faceMatchCache?.[imageKey];
      
      if (!matchCache || !matchCache[targetEmbeddingIndex]) {
        // No match found for this face
        return `No Match. ${embeddingsCount} Embeddings in DB`;
      }
      
      const match = matchCache[targetEmbeddingIndex];
      
      // Check if the selected person matches the top match
      if (match.personId === currentLabel.id) {
        // Selected person is the top match - show match percentage
        const matchPercentage = (match.similarity * 100).toFixed(1);
        return `${matchPercentage}% Match. ${embeddingsCount} Embeddings in DB`;
      } else {
        // Selected person is not the top match
        return `No Match. ${embeddingsCount} Embeddings in DB`;
      }
    },
    getEmbeddingsStoredState() {
      // Check for overlap box first
      if (this.selectedOverlapBox) {
        const { sourceFile, facialArea } = this.selectedOverlapBox;
        if (sourceFile && facialArea) {
          const key = this.getFaceLabelKey(sourceFile.name, facialArea);
          return key ? (this.embeddingsStored[key] || false) : false;
        }
        return false;
      }
      // Otherwise check for regular box
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getEmbeddingsStoredState(this.selectedFile, this.selectedBoundingBoxIndex, this.embeddingsStored);
      }
      return false;
    },
    getSelectedCheckInPersonIds() {
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getSelectedCheckInPersonIds(this.checkedPeopleByBox, this.checkedPeopleByPoint);
      }
      return [];
    },
    getSessionValidTimeRangeString() {
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getSessionValidTimeRangeString(this.selectedSessionName);
      }
      return '';
    },
    isSessionValid() {
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.isSessionValid(this.selectedSessionName);
      }
      return false;
    },
    getSessionInvalidMessage() {
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getSessionInvalidMessage(this.selectedSessionName);
      }
      return '';
    }
  },
  methods: {
    getFaceLabelKey(imageName, facialArea) {
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getFaceLabelKey(imageName, facialArea);
      }
      return null;
    },
    getFacialAreaForIndex(embeddingIndex) {
      // Check for overlap box first
      if (this.selectedOverlapBox) {
        return this.selectedOverlapBox.facialArea || null;
      }
      // Otherwise check for regular box
      if (!this.selectedFile || !this.selectedFile.model) return null;
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getFacialAreaForIndex(this.selectedFile.model, embeddingIndex);
      }
      return null;
    },
    getCurrentFaceLabelKey() {
      // Check for overlap box first
      if (this.selectedOverlapBox) {
        const { sourceFile, facialArea } = this.selectedOverlapBox;
        if (sourceFile && facialArea) {
          return this.getFaceLabelKey(sourceFile.name, facialArea);
        }
        return null;
      }
      // Otherwise check for regular box
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getCurrentFaceLabelKey(this.selectedFile, this.selectedBoundingBoxIndex);
      }
      return null;
    },
    getCheckedPeopleForBox(faceLabelKey) {
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getCheckedPeopleForBox(this.checkedPeopleByBox, faceLabelKey);
      }
      return {};
    },
    isPersonChecked(personId) {
      const faceLabelKey = this.getCurrentFaceLabelKey();
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.isPersonChecked(this.checkedPeopleByBox, faceLabelKey, personId);
      }
      return false;
    },
    isPersonCheckedForPoint(pointLabelId, personId) {
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.isPersonCheckedForPoint(this.checkedPeopleByPoint, pointLabelId, personId);
      }
      return false;
    },
        getHouseholdGroups(person) {
          if (typeof window !== 'undefined' && window.Services && window.Services.planningCenter) {
            return window.Services.planningCenter.getHouseholdGroups(person, this.planningCentrePeople);
          }
          return [];
        },
        getHouseholdMembers(person) {
          if (typeof window !== 'undefined' && window.Services && window.Services.planningCenter) {
            return window.Services.planningCenter.getHouseholdMembers(person, this.planningCentrePeople);
          }
          return [];
        },
        getHouseholdMembersDisplay(person) {
          if (typeof window !== 'undefined' && window.Services && window.Services.planningCenter) {
            return window.Services.planningCenter.getHouseholdMembersDisplay(person, this.planningCentrePeople);
          }
          return '';
        },
    getHouseholdCheckboxState(memberId) {
      const faceLabelKey = this.getCurrentFaceLabelKey();
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getHouseholdCheckboxState(this.checkedPeopleByBox, faceLabelKey, memberId);
      }
      return false;
    },
    getPointHouseholdCheckboxState(memberId) {
      if (typeof window !== 'undefined' && window.Utils) {
        return window.Utils.getPointHouseholdCheckboxState(this.checkedPeopleByPoint, this.selectedPointLabelId, memberId);
      }
      return false;
    },
    performSearch() {
      // Clear face guesses when user starts typing
      this.$emit('face-guesses-clear');
      
      if (!this.searchQuery || this.searchQuery.trim() === '') {
        this.localSearchResults = [];
        this.localSelectedSearchIndex = -1;
        this.$emit('search-results-change', []);
        this.$emit('search-index-change', -1);
        return;
      }
      
      const query = this.searchQuery.toLowerCase().trim();
      const results = (this.planningCentrePeople || [])
        .filter(person => person.name && person.name.toLowerCase().includes(query))
        .slice(0, 15); // Up to 15 results
      
      this.localSearchResults = results;
      this.localSelectedSearchIndex = results.length > 0 ? 0 : -1;
      this.$emit('search-results-change', results);
      this.$emit('search-index-change', this.localSelectedSearchIndex);
      
      // Scroll to selected result
      this.$nextTick(() => {
        this.scrollToSelectedResult();
      });
    },
    scrollToSelectedResult() {
      // Use $nextTick to ensure DOM is updated before scrolling
      this.$nextTick(() => {
        if (this.localSelectedSearchIndex >= 0) {
          const container = this.$refs.searchResultsContainer;
          if (container) {
            const selectedElement = container.children[this.localSelectedSearchIndex];
            if (selectedElement) {
              const containerRect = container.getBoundingClientRect();
              const elementRect = selectedElement.getBoundingClientRect();
              
              // Check if element is outside visible area
              if (elementRect.top < containerRect.top) {
                // Element is above visible area, scroll up
                selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              } else if (elementRect.bottom > containerRect.bottom) {
                // Element is below visible area, scroll down
                selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }
          }
        }
      });
    },
    handleSearchKeydown(event) {
      if (this.localSearchResults.length === 0) {
        return; // Don't handle keys if there are no results
      }
      
      switch(event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.localSelectedSearchIndex = (this.localSelectedSearchIndex + 1) % this.localSearchResults.length;
          this.$emit('search-index-change', this.localSelectedSearchIndex);
          this.scrollToSelectedResult();
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (this.localSelectedSearchIndex <= 0) {
            this.localSelectedSearchIndex = this.localSearchResults.length - 1;
          } else {
            this.localSelectedSearchIndex = this.localSelectedSearchIndex - 1;
          }
          this.$emit('search-index-change', this.localSelectedSearchIndex);
          this.scrollToSelectedResult();
          break;
        case 'Enter':
          event.preventDefault();
          if (this.localSelectedSearchIndex >= 0 && this.localSelectedSearchIndex < this.localSearchResults.length) {
            this.$emit('select-person', this.localSearchResults[this.localSelectedSearchIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          this.localSelectedSearchIndex = -1;
          this.$emit('search-index-change', -1);
          break;
      }
    },
    async loadFaceGuesses() {
      // Check for overlap box first
      let targetFile = this.selectedFile;
      let targetEmbeddingIndex = this.selectedBoundingBoxIndex;
      
      if (this.selectedOverlapBox) {
        targetFile = this.selectedOverlapBox.sourceFile;
        targetEmbeddingIndex = this.selectedOverlapBox.embeddingIndex;
      }
      
      if (targetEmbeddingIndex === null || !targetFile || !targetFile.model) {
        this.$emit('face-guesses-update', []);
        return;
      }
      
      try {
        // Load embedding data for the selected bounding box
        const model = typeof targetFile.model === 'string' 
          ? JSON.parse(targetFile.model) 
          : targetFile.model;
        
        if (!model.embeddings || !Array.isArray(model.embeddings)) {
          this.$emit('face-guesses-update', []);
          return;
        }
        
        const embedding = model.embeddings[targetEmbeddingIndex];
        if (!embedding || !embedding.embedding || !embedding.facial_area) {
          this.$emit('face-guesses-update', []);
          return;
        }
        
        // Decode embedding if it's base64 encoded
        let embeddingArray = embedding.embedding;
        if (typeof embeddingArray === 'string') {
          if (typeof window !== 'undefined' && window.Utils) {
            embeddingArray = window.Utils.decodeEmbeddingFromBase64(embeddingArray);
          } else {
            this.$emit('face-guesses-update', []);
            return;
          }
          if (!embeddingArray) {
            this.$emit('face-guesses-update', []);
            return;
          }
        }
        
        // Ensure embeddingArray is a flat array of numbers
        if (!Array.isArray(embeddingArray)) {
          this.$emit('face-guesses-update', []);
          return;
        }
        
        embeddingArray = embeddingArray.flat(Infinity);
        
        // Validate all elements are numbers
        if (!embeddingArray.every(v => typeof v === 'number' && !isNaN(v) && isFinite(v))) {
          this.$emit('face-guesses-update', []);
          return;
        }
        
        // Request parent to load embeddings if not available
        if (!this.embeddingIndex) {
          this.$emit('load-face-guesses');
          // Wait a bit for embeddingIndex to be loaded
          await new Promise(resolve => setTimeout(resolve, 100));
          // If still not available, emit empty
          if (!this.embeddingIndex) {
            this.$emit('face-guesses-update', []);
            return;
          }
        }
        
        // Search for top 5 matches
        const results = await this.embeddingIndex.search(embeddingArray, { topK: 5 });
        
        if (!results || results.length === 0) {
          this.$emit('face-guesses-update', []);
          return;
        }
        
        // Process results and match with planningCentrePeople
        // Use a Map to deduplicate by personId, keeping only the highest similarity
        const guessesMap = new Map();
        
        for (const result of results) {
          let similarity = result.similarity || result.score || 0;
          
          // If distance is provided instead, convert to similarity
          if (result.distance !== undefined && similarity === 0) {
            similarity = 1 - result.distance;
          }
          
          // Extract personId
          let personId = null;
          if (result.personId) {
            personId = result.personId;
          } else if (result.id) {
            personId = result.id.split('_')[0];
          } else if (result.object && result.object.personId) {
            personId = result.object.personId;
          } else if (result.item && result.item.personId) {
            personId = result.item.personId;
          }
          
          if (personId) {
            // Find person in planningCentrePeople
            const person = (this.planningCentrePeople || []).find(p => p.id === personId);
            if (person) {
              // Check if we already have this person, keep the one with higher similarity
              const existing = guessesMap.get(personId);
              if (!existing || similarity > existing.similarity) {
                guessesMap.set(personId, {
                  person: person,
                  similarity: similarity
                });
              }
            }
          }
        }
        
        // Convert Map to array and sort by similarity (descending)
        const guesses = Array.from(guessesMap.values())
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5); // Take top 5 after deduplication
        
        this.$emit('face-guesses-update', guesses);
      } catch (error) {
        console.error('Error loading face guesses:', error);
        this.$emit('face-guesses-update', []);
      }
    }
  },
  emits: [
    'session-change',
    'faces-button-click',
    'fetch-planning-centre-people',
    'reload-embeddings',
    'search-input',
    'search-results-change',
    'search-index-change',
    'search-keydown',
    'select-person',
    'selected-person-checkbox-change',
    'household-checkbox-change',
    'selected-point-person-checkbox-change',
    'point-household-checkbox-change',
    'store-embeddings',
    'open-check-in-overlay',
    'toggle-check-in-select-all',
    'check-in-table-checkbox-change',
    'load-face-guesses',
    'face-guesses-update'
  ],
  data() {
    return {
      localSearchResults: [],
      localSelectedSearchIndex: -1
    };
  },
  watch: {
    searchQuery: {
      handler(newQuery) {
        this.performSearch();
      },
      immediate: false
    },
    searchResults: {
      handler(newResults) {
        this.localSearchResults = newResults || [];
      },
      immediate: true
    },
    selectedSearchIndex: {
      handler(newIndex) {
        this.localSelectedSearchIndex = newIndex !== undefined ? newIndex : -1;
      },
      immediate: true
    },
    selectedBoundingBoxIndex: {
      handler(newVal) {
        if (newVal !== null && this.selectedFile) {
          this.$nextTick(() => {
            this.loadFaceGuesses();
          });
        } else if (!this.selectedOverlapBox) {
          this.$emit('face-guesses-update', []);
        }
      },
      immediate: false
    },
    selectedOverlapBox: {
      handler(newVal) {
        if (newVal !== null && newVal.sourceFile) {
          this.$nextTick(() => {
            this.loadFaceGuesses();
          });
        } else if (!this.selectedBoundingBoxIndex) {
          this.$emit('face-guesses-update', []);
        }
      },
      immediate: false
    },
    selectedFile: {
      handler() {
        if ((this.selectedBoundingBoxIndex !== null || this.selectedOverlapBox !== null) && this.selectedFile) {
          this.$nextTick(() => {
            this.loadFaceGuesses();
          });
        }
      },
      immediate: false
    },
    embeddingIndex: {
      handler() {
        if (this.embeddingIndex && this.selectedBoundingBoxIndex !== null && this.selectedFile) {
          this.$nextTick(() => {
            this.loadFaceGuesses();
          });
        }
      },
      immediate: false
    }
  },
  mounted() {
    // Load face guesses when bounding box is selected
    if (this.selectedBoundingBoxIndex !== null && this.selectedFile) {
      this.$nextTick(() => {
        this.loadFaceGuesses();
      });
    }
  },
  template: `
    <div class="p-3 h-full flex flex-col" style="position: relative; z-index: 1;">
      <label class="block text-xs font-semibold text-gray-600 mb-2">Session</label>
      <select
        :value="selectedSessionName"
        @change="$emit('session-change', $event.target.value)"
        :disabled="loading"
        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        style="position: relative; z-index: 10;"
      >
        <option value="" disabled>Select a session</option>
        <option
          v-for="session in sessions"
          :key="session.name"
          :value="session.name"
        >
          {{ session.name }}
        </option>
      </select>
      
      <!-- Show Faces Toggle -->
      <div v-if="selectedFile && selectedFile.model_url" class="mt-3">
        <button
          @click="$emit('faces-button-click')"
          :class="['w-full px-2 py-1 text-xs rounded border transition-colors', getFacesButtonClass]"
        >
          {{ getFacesButtonText }}
        </button>
      </div>
      
      <!-- People Retrieval Status -->
      <div v-if="peopleRetrievalStatus !== 'idle'" class="mt-3">
        <div v-if="peopleRetrievalStatus === 'retrieving'" class="flex items-center gap-2 text-xs text-gray-600">
          <div class="spinner-small"></div>
          <span>Retrieving people records...</span>
        </div>
        <div v-else-if="peopleRetrievalStatus === 'completed'" class="text-xs text-gray-600">
          <div class="flex items-center justify-between">
            <span>Retrieved {{ peopleRetrievalCount }} records</span>
            <button
              @click="$emit('fetch-planning-centre-people')"
              :disabled="peopleRetrievalStatus === 'retrieving'"
              class="ml-2 text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              title="Reload people records from Planning Centre"
            >
              Reload Records
            </button>
          </div>
          <div v-if="selectedFile && getFaceScanningStatus" class="mt-1">
            <div v-if="getFaceScanningStatus === 'scanning'" class="flex items-center gap-2 text-gray-600">
              <div class="spinner-small"></div>
              <span>Scanning Faces...</span>
            </div>
            <div v-else-if="getFaceScanningStatus === 'scanned'" class="flex items-center justify-between text-gray-500">
              <span>{{ getFaceScanCount }} Faces Scanned</span>
              <button
                @click="$emit('reload-embeddings')"
                class="ml-2 text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                title="Reload embeddings from database"
              >
                Reload Embeddings
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Face Search Box -->
      <div v-if="(selectedBoundingBoxIndex !== null || selectedOverlapBox !== null || selectedPointLabelId !== null) && labellingStarted" class="mt-3">
        <label class="block text-xs font-semibold text-gray-600 mb-2">Search for Person</label>
        <input
          :value="searchQuery"
          @input="$emit('search-input', $event.target.value)"
          @keydown="handleSearchKeydown"
          type="text"
          placeholder="Type to search..."
          :disabled="peopleRetrievalStatus === 'retrieving'"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          :class="['w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500', peopleRetrievalStatus === 'retrieving' ? 'bg-gray-100 cursor-not-allowed opacity-60' : '']"
        />
        <!-- Face Guesses (Top 5 Matches) - Only show for bounding boxes, not point labels, and only when no person is selected -->
        <div v-if="faceGuesses.length > 0 && !searchQuery && (selectedBoundingBoxIndex !== null || selectedOverlapBox !== null) && !getCurrentFaceLabel" class="mt-2 border border-gray-200 rounded-md overflow-hidden">
          <div class="px-2 py-1 bg-gray-100 border-b border-gray-200">
            <span class="text-xs font-semibold text-gray-600">Top Matches</span>
          </div>
          <div>
            <div
              v-for="(guess, index) in faceGuesses"
              :key="guess.person.id || index"
              @click="$emit('select-person', guess.person)"
              class="px-2 py-1.5 text-xs cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-blue-50"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center flex-1 min-w-0">
                  <span class="font-medium">{{ guess.person.name }}</span>
                  <span v-if="getHouseholdMembers(guess.person).length > 0" class="ml-2 text-gray-500 text-[10px]">
                    [{{ getHouseholdMembersDisplay(guess.person) }}]
                  </span>
                </div>
                <span class="text-gray-600 ml-2 flex-shrink-0">{{ (guess.similarity * 100).toFixed(1) }}%</span>
              </div>
            </div>
          </div>
        </div>
        <!-- Search Results -->
        <div v-if="localSearchResults.length > 0" ref="searchResultsContainer" class="mt-2 border border-gray-200 rounded-md overflow-hidden search-results-scroll" style="max-height: 108px; overflow-y: auto; scrollbar-width: thin;">
          <div
            v-for="(person, index) in localSearchResults"
            :key="person.id || index"
            @click="$emit('select-person', person)"
            :class="['px-2 py-1.5 text-xs cursor-pointer border-b border-gray-100 last:border-b-0', localSelectedSearchIndex === index ? 'bg-blue-200' : 'hover:bg-blue-50']"
          >
            <div class="flex items-center">
              <span class="font-medium">{{ person.name }}</span>
              <span v-if="getHouseholdMembers(person).length > 0" class="ml-2 text-gray-500 text-[10px]">
                [{{ getHouseholdMembersDisplay(person) }}]
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Selected Face Label -->
      <div v-if="(selectedBoundingBoxIndex !== null || selectedOverlapBox !== null) && getCurrentFaceLabel" class="mt-3">
        <label class="block text-xs font-semibold text-gray-600 mb-2">Check-In Persons</label>
        
        <!-- Selected Person -->
        <div class="mb-2">
          <div class="flex items-center justify-between px-2">
            <span class="text-xs text-gray-800">{{ getCurrentFaceLabel.name }} ({{ getCurrentFaceLabel.id }})</span>
            <input
              type="checkbox"
              :checked="getSelectedPersonCheckedState"
              @change="$emit('selected-person-checkbox-change', $event)"
              :class="['w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500', !getSelectedPersonCheckedState ? 'opacity-50' : '']"
            />
          </div>
        </div>
        
        <!-- Embeddings Stored -->
        <div class="mb-2 px-2 flex items-center justify-between">
          <span class="text-xs text-gray-600">{{ getMatchDisplayText }}</span>
          <button
            @click="$emit('store-embeddings')"
            :disabled="checkingEmbeddingInDB || getEmbeddingsStoredState"
            :class="['text-xs px-2 py-1 rounded border transition-colors flex items-center justify-center min-w-[120px]', (checkingEmbeddingInDB || getEmbeddingsStoredState) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600']"
          >
            <span v-if="checkingEmbeddingInDB" class="flex items-center gap-1">
              <div class="spinner-small"></div>
            </span>
            <span v-else>{{ getEmbeddingsStoredState ? 'Embedding Saved' : 'Add This Embedding [a]' }}</span>
          </button>
        </div>
        
        <!-- Household Groups -->
        <div v-if="getCurrentFaceLabel && getHouseholdGroups(getCurrentFaceLabel).length > 0" class="space-y-2">
          <div
            v-for="(group, groupIndex) in getHouseholdGroups(getCurrentFaceLabel)"
            :key="groupIndex"
            class="border border-gray-300 rounded bg-gray-50 py-1"
          >
            <div
              v-for="(member, memberIndex) in group.members"
              :key="member.id || memberIndex"
              class="flex items-center justify-between py-1 px-2"
            >
              <span :class="['text-xs', getSelectedPersonCheckedState ? 'text-gray-700' : 'text-gray-400']">{{ member.name }}</span>
              <input
                type="checkbox"
                :checked="getHouseholdCheckboxState(member.id)"
                @change="$emit('household-checkbox-change', member.id, $event)"
                :disabled="!getSelectedPersonCheckedState"
                :class="['w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500', !getSelectedPersonCheckedState ? 'opacity-50 cursor-not-allowed' : '']"
              />
            </div>
          </div>
        </div>
      </div>
      
      <!-- Point Label Person Selection (without match/embedding display) -->
      <div v-if="selectedPointLabelId !== null && getCurrentPointLabel" class="mt-3">
        <label class="block text-xs font-semibold text-gray-600 mb-2">Check-In Persons</label>
        
        <!-- Selected Person -->
        <div class="mb-2">
          <div class="flex items-center justify-between px-2">
            <span class="text-xs text-gray-800">{{ getCurrentPointLabel.name }} ({{ getCurrentPointLabel.id }})</span>
            <input
              type="checkbox"
              :checked="getSelectedPointPersonCheckedState"
              @change="$emit('selected-point-person-checkbox-change', $event)"
              :class="['w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500', !getSelectedPointPersonCheckedState ? 'opacity-50' : '']"
            />
          </div>
        </div>
        
        <!-- Household Groups -->
        <div v-if="getCurrentPointLabel && getHouseholdGroups(getCurrentPointLabel).length > 0" class="space-y-2">
          <div
            v-for="(group, groupIndex) in getHouseholdGroups(getCurrentPointLabel)"
            :key="groupIndex"
            class="border border-gray-300 rounded bg-gray-50 py-1"
          >
            <div
              v-for="(member, memberIndex) in group.members"
              :key="member.id || memberIndex"
              class="flex items-center justify-between py-1 px-2"
            >
              <span :class="['text-xs', getSelectedPointPersonCheckedState ? 'text-gray-700' : 'text-gray-400']">{{ member.name }}</span>
              <input
                type="checkbox"
                :checked="getPointHouseholdCheckboxState(member.id)"
                @change="$emit('point-household-checkbox-change', member.id, $event)"
                :disabled="!getSelectedPointPersonCheckedState"
                :class="['w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500', !getSelectedPointPersonCheckedState ? 'opacity-50 cursor-not-allowed' : '']"
              />
            </div>
          </div>
        </div>
      </div>
      
      <!-- Check-In Actions -->
      <div class="mt-auto border-t border-gray-200 pt-4">
        <div v-if="selectedSessionName" class="mb-3">
          <div class="text-xs text-gray-600 mb-2">
            <div>Valid Check-In Period:</div>
            <div class="font-medium">{{ getSessionValidTimeRangeString }}</div>
          </div>
          <div v-if="!isSessionValid" class="text-xs text-red-600 mb-2">
            {{ getSessionInvalidMessage }}
          </div>
        </div>
        <button
          @click="$emit('open-check-in-overlay')"
          :disabled="getSelectedCheckInPersonIds.length === 0 || !isSessionValid"
          class="w-full text-sm font-semibold px-3 py-2 rounded-md border transition-colors"
          :class="(getSelectedCheckInPersonIds.length === 0 || !isSessionValid) ? 'bg-gray-200 text-gray-500 cursor-not-allowed border-gray-200' : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'"
        >
          Check In
        </button>
      </div>
    </div>
  `
};

