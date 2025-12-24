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
    // Methods passed as props
    getFacesButtonText: Function,
    getFacesButtonClass: Function,
    getFaceScanningStatus: Function,
    getFaceScanCount: Function,
    getCurrentFaceLabel: Function,
    getCurrentPointLabel: Function,
    getSelectedPersonCheckedState: Function,
    getSelectedPointPersonCheckedState: Function,
    getHouseholdCheckboxState: Function,
    getPointHouseholdCheckboxState: Function,
    getHouseholdGroups: Function,
    getHouseholdMembers: Function,
    getHouseholdMembersDisplay: Function,
    getMatchDisplayText: Function,
    getEmbeddingsStoredState: Function,
    getSelectedCheckInPersonIds: Function,
    getSessionValidTimeRangeString: Function,
    isSessionValid: Function,
    getSessionInvalidMessage: Function,
    getCheckInTableData: Function,
    getOverlaySelectedCount: Function,
    areAllCheckInSelected: Function
  },
  emits: [
    'session-change',
    'faces-button-click',
    'fetch-planning-centre-people',
    'reload-embeddings',
    'search-input',
    'search-keydown',
    'select-person',
    'selected-person-checkbox-change',
    'household-checkbox-change',
    'selected-point-person-checkbox-change',
    'point-household-checkbox-change',
    'store-embeddings',
    'open-check-in-overlay',
    'toggle-check-in-select-all',
    'check-in-table-checkbox-change'
  ],
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
          :class="['w-full px-2 py-1 text-xs rounded border transition-colors', getFacesButtonClass()]"
        >
          {{ getFacesButtonText() }}
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
          <div v-if="selectedFile && getFaceScanningStatus()" class="mt-1">
            <div v-if="getFaceScanningStatus() === 'scanning'" class="flex items-center gap-2 text-gray-600">
              <div class="spinner-small"></div>
              <span>Scanning Faces...</span>
            </div>
            <div v-else-if="getFaceScanningStatus() === 'scanned'" class="flex items-center justify-between text-gray-500">
              <span>{{ getFaceScanCount() }} Faces Scanned</span>
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
      <div v-if="(selectedBoundingBoxIndex !== null || selectedPointLabelId !== null) && labellingStarted" class="mt-3">
        <label class="block text-xs font-semibold text-gray-600 mb-2">Search for Person</label>
        <input
          :value="searchQuery"
          @input="$emit('search-input', $event.target.value)"
          @keydown="$emit('search-keydown', $event)"
          type="text"
          placeholder="Type to search..."
          :disabled="peopleRetrievalStatus === 'retrieving'"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          :class="['w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500', peopleRetrievalStatus === 'retrieving' ? 'bg-gray-100 cursor-not-allowed opacity-60' : '']"
        />
        <!-- Face Guesses (Top 5 Matches) - Only show for bounding boxes, not point labels -->
        <div v-if="faceGuesses.length > 0 && !searchQuery && selectedBoundingBoxIndex !== null" class="mt-2 border border-gray-200 rounded-md overflow-hidden">
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
        <div v-if="searchResults.length > 0" class="mt-2 border border-gray-200 rounded-md overflow-hidden search-results-scroll" style="max-height: 108px; overflow-y: auto; scrollbar-width: thin;">
          <div
            v-for="(person, index) in searchResults"
            :key="person.id || index"
            @click="$emit('select-person', person)"
            :class="['px-2 py-1.5 text-xs cursor-pointer border-b border-gray-100 last:border-b-0', selectedSearchIndex === index ? 'bg-blue-200' : 'hover:bg-blue-50']"
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
      <div v-if="selectedBoundingBoxIndex !== null && getCurrentFaceLabel()" class="mt-3">
        <label class="block text-xs font-semibold text-gray-600 mb-2">Check-In Persons</label>
        
        <!-- Selected Person -->
        <div class="mb-2">
          <div class="flex items-center justify-between px-2">
            <span class="text-xs text-gray-800">{{ getCurrentFaceLabel().name }} ({{ getCurrentFaceLabel().id }})</span>
            <input
              type="checkbox"
              :checked="getSelectedPersonCheckedState()"
              @change="$emit('selected-person-checkbox-change', $event)"
              :class="['w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500', !getSelectedPersonCheckedState() ? 'opacity-50' : '']"
            />
          </div>
        </div>
        
        <!-- Embeddings Stored -->
        <div class="mb-2 px-2 flex items-center justify-between">
          <span class="text-xs text-gray-600">{{ getMatchDisplayText() }}</span>
          <button
            @click="$emit('store-embeddings')"
            :disabled="checkingEmbeddingInDB || getEmbeddingsStoredState()"
            :class="['text-xs px-2 py-1 rounded border transition-colors flex items-center justify-center min-w-[120px]', (checkingEmbeddingInDB || getEmbeddingsStoredState()) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600']"
          >
            <span v-if="checkingEmbeddingInDB" class="flex items-center gap-1">
              <div class="spinner-small"></div>
            </span>
            <span v-else>{{ getEmbeddingsStoredState() ? 'Embedding Saved' : 'Add This Embedding [a]' }}</span>
          </button>
        </div>
        
        <!-- Household Groups -->
        <div v-if="getHouseholdGroups(getCurrentFaceLabel()).length > 0" class="space-y-2">
          <div
            v-for="(group, groupIndex) in getHouseholdGroups(getCurrentFaceLabel())"
            :key="groupIndex"
            class="border border-gray-300 rounded bg-gray-50 py-1"
          >
            <div
              v-for="(member, memberIndex) in group.members"
              :key="member.id || memberIndex"
              class="flex items-center justify-between py-1 px-2"
            >
              <span :class="['text-xs', getSelectedPersonCheckedState() ? 'text-gray-700' : 'text-gray-400']">{{ member.name }}</span>
              <input
                type="checkbox"
                :checked="getHouseholdCheckboxState(member.id)"
                @change="$emit('household-checkbox-change', member.id, $event)"
                :disabled="!getSelectedPersonCheckedState()"
                :class="['w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500', !getSelectedPersonCheckedState() ? 'opacity-50 cursor-not-allowed' : '']"
              />
            </div>
          </div>
        </div>
      </div>
      
      <!-- Point Label Person Selection (without match/embedding display) -->
      <div v-if="selectedPointLabelId !== null && getCurrentPointLabel()" class="mt-3">
        <label class="block text-xs font-semibold text-gray-600 mb-2">Check-In Persons</label>
        
        <!-- Selected Person -->
        <div class="mb-2">
          <div class="flex items-center justify-between px-2">
            <span class="text-xs text-gray-800">{{ getCurrentPointLabel().name }} ({{ getCurrentPointLabel().id }})</span>
            <input
              type="checkbox"
              :checked="getSelectedPointPersonCheckedState()"
              @change="$emit('selected-point-person-checkbox-change', $event)"
              :class="['w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500', !getSelectedPointPersonCheckedState() ? 'opacity-50' : '']"
            />
          </div>
        </div>
        
        <!-- Household Groups -->
        <div v-if="getHouseholdGroups(getCurrentPointLabel()).length > 0" class="space-y-2">
          <div
            v-for="(group, groupIndex) in getHouseholdGroups(getCurrentPointLabel())"
            :key="groupIndex"
            class="border border-gray-300 rounded bg-gray-50 py-1"
          >
            <div
              v-for="(member, memberIndex) in group.members"
              :key="member.id || memberIndex"
              class="flex items-center justify-between py-1 px-2"
            >
              <span :class="['text-xs', getSelectedPointPersonCheckedState() ? 'text-gray-700' : 'text-gray-400']">{{ member.name }}</span>
              <input
                type="checkbox"
                :checked="getPointHouseholdCheckboxState(member.id)"
                @change="$emit('point-household-checkbox-change', member.id, $event)"
                :disabled="!getSelectedPointPersonCheckedState()"
                :class="['w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500', !getSelectedPointPersonCheckedState() ? 'opacity-50 cursor-not-allowed' : '']"
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
            <div class="font-medium">{{ getSessionValidTimeRangeString() }}</div>
          </div>
          <div v-if="!isSessionValid()" class="text-xs text-red-600 mb-2">
            {{ getSessionInvalidMessage() }}
          </div>
        </div>
        <button
          @click="$emit('open-check-in-overlay')"
          :disabled="getSelectedCheckInPersonIds().length === 0 || !isSessionValid()"
          class="w-full text-sm font-semibold px-3 py-2 rounded-md border transition-colors"
          :class="(getSelectedCheckInPersonIds().length === 0 || !isSessionValid()) ? 'bg-gray-200 text-gray-500 cursor-not-allowed border-gray-200' : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'"
        >
          Check In
        </button>
      </div>
    </div>
  `
};

