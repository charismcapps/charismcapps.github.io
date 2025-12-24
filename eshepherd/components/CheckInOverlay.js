// CheckInOverlay Component
export const CheckInOverlay = {
  name: 'CheckInOverlay',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    tableData: {
      type: Array,
      default: () => []
    },
    selection: {
      type: Object,
      default: () => ({})
    },
    selectedCount: {
      type: Number,
      default: 0
    },
    totalCount: {
      type: Number,
      default: 0
    },
    allSelected: {
      type: Boolean,
      default: false
    },
    submitting: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: null
    },
    successMessage: {
      type: String,
      default: ''
    }
  },
  emits: ['close', 'submit', 'toggle-select-all', 'checkbox-change'],
  template: `
    <div
      v-if="show"
      class="absolute inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center px-4 py-6"
    >
      <div class="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Confirm People to Check In</h3>
            <p class="text-xs text-gray-500">Review selected people before submitting to Planning Center</p>
          </div>
          <button
            @click="$emit('close')"
            class="text-gray-500 hover:text-gray-700 text-xl leading-none"
            aria-label="Close check-in overlay"
          >
            &times;
          </button>
        </div>
        
        <div class="px-4 py-3 flex flex-wrap items-center gap-3 border-b border-gray-100">
          <div class="text-sm text-gray-700 font-medium">
            {{ selectedCount }} / {{ totalCount }} selected
          </div>
          <button
            @click="$emit('toggle-select-all')"
            :disabled="totalCount === 0"
            class="text-sm px-3 py-1.5 rounded border transition-colors"
            :class="totalCount === 0 ? 'text-gray-400 border-gray-200 cursor-not-allowed bg-gray-100' : (allSelected ? 'text-gray-700 border-gray-300 bg-gray-100 hover:bg-gray-200' : 'text-blue-600 border-blue-500 hover:bg-blue-50')"
          >
            {{ allSelected ? 'Deselect All' : 'Select All' }}
          </button>
          <div class="ml-auto flex items-center gap-2">
            <button
              @click="$emit('submit')"
              :disabled="selectedCount === 0 || submitting"
              class="px-4 py-2 rounded-md text-sm font-semibold text-white flex items-center gap-2"
              :class="selectedCount === 0 || submitting ? 'bg-green-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'"
            >
              <div v-if="submitting" class="spinner-small"></div>
              <span>{{ submitting ? 'Checking In...' : 'Submit To Planning Center' }}</span>
            </button>
          </div>
        </div>
        
        <div class="px-4 py-2">
          <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
          <p v-if="successMessage" class="text-xs text-green-600">{{ successMessage }}</p>
          <p v-if="totalCount === 0" class="text-xs text-gray-500 mt-1">No people available for check-in yet.</p>
        </div>
        
        <div class="flex-1 px-4 pb-4 w-full">
          <div class="border border-gray-200 rounded-md h-full flex flex-col overflow-hidden bg-white">
            <div v-if="totalCount === 0" class="flex-1 flex items-center justify-center text-sm text-gray-500">
              Add people from the face labelling panel to prepare check-in.
            </div>
            <div v-else class="flex-1 overflow-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-gray-100 text-gray-600 text-xs uppercase sticky top-0 z-10">
                  <tr>
                    <th class="text-left px-3 py-2 w-32">Person ID</th>
                    <th class="text-left px-3 py-2">Person's Name</th>
                    <th class="text-center px-3 py-2 w-28">Check In</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="entry in tableData"
                    :key="entry.person.id"
                    class="border-b border-gray-100 last:border-b-0"
                  >
                    <td class="px-3 py-2 text-xs text-gray-500">{{ entry.person.id }}</td>
                    <td class="px-3 py-2 text-sm text-gray-800">{{ entry.person.name }}</td>
                    <td class="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        :checked="!!selection[entry.person.id]"
                        @change="$emit('checkbox-change', entry.person.id, $event)"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};

