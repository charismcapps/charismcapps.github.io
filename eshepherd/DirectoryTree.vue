<template>
  <ul class="select-none">
    <li v-for="node in nodes" :key="node.name" class="">
      <div v-if="node.type === 'directory'" @click="toggleCollapse(node)" class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 text-gray-800 text-sm leading-tight font-[Arial_Narrow,Arial,sans-serif]">
        <svg :class="['h-4 w-4 text-gray-500 transform transition-transform', { 'rotate-0': isCollapsed(node), '-rotate-90': !isCollapsed(node) }]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M12.03 5.47a.75.75 0 0 1 0 1.06L9.06 9.5l2.97 2.97a.75.75 0 1 1-1.06 1.06l-3.5-3.5a.75.75 0 0 1 0-1.06l3.5-3.5a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" />
        </svg>
        <svg class="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M10 4H4a2 2 0 0 0-2 2v1h20V8a2 2 0 0 0-2-2h-8l-2-2Z"/>
          <path d="M22 9H2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9Z"/>
        </svg>
        <span class="font-medium truncate">{{ node.name }}</span>
      </div>
      <div v-else @click="$emit('select', node)" :class="['group flex items-center gap-2 pl-9 pr-2 py-1.5 cursor-pointer hover:bg-blue-50 text-xs leading-tight font-[Arial_Narrow,Arial,sans-serif]', { 'bg-blue-100 text-blue-800': isSelected(node), 'text-gray-700': !isSelected(node) } ]">
        <svg class="h-4 w-4 text-gray-400 group-hover:text-blue-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/>
        </svg>
        <span class="truncate">{{ node.name }}</span>
      </div>

      <transition name="fade" mode="out-in">
        <div v-show="!isCollapsed(node) && node.children.length" class="ml-4 border-l border-gray-200">
          <directory-tree :nodes="node.children" :selected-file="selectedFile" :is-root-level="false" @select="$emit('select', $event)"></directory-tree>
        </div>
      </transition>
    </li>
  </ul>
</template>

<script>
export default {
  name: 'DirectoryTree',
  props: {
    nodes: {
      type: Array,
      required: true
    },
    selectedFile: {
      type: Object,
      default: null
    },
    isRootLevel: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      collapsed: {} // Track collapsed state for directories
    };
  },
  mounted() {
    this.setupInitialExpansion();
  },
  watch: {
    nodes: {
      handler() {
        this.setupInitialExpansion();
      },
      immediate: true
    }
  },
  methods: {
    setupInitialExpansion() {
      // Auto-expand the first (latest) date folder at root level
      if (this.isRootLevel && this.nodes && this.nodes.length > 0) {
        console.log('Setting up initial expansion for root level with', this.nodes.length, 'nodes');
        const firstNode = this.nodes[0];
        console.log('First node:', firstNode);
        if (firstNode.type === 'directory') {
          console.log('Expanding first directory:', firstNode.name);
          this.collapsed[firstNode.name] = false; // Expand the latest date folder
        }
        // Collapse all other directories at root level
        this.nodes.slice(1).forEach(node => {
          if (node.type === 'directory') {
            console.log('Collapsing directory:', node.name);
            this.collapsed[node.name] = true; // Collapse other date folders
          }
        });
        console.log('Final collapsed state:', this.collapsed);
      }
    },
    toggleCollapse(node) {
      this.collapsed = { ...this.collapsed, [node.name]: !this.collapsed[node.name] };
    },
    isCollapsed(node) {
      // For directories, check if explicitly set in collapsed object
      if (node.type === 'directory') {
        if (this.collapsed[node.name] === undefined) {
          return true; // Default to collapsed if not explicitly set
        }
        return this.collapsed[node.name]; // Return the explicit value (true/false)
      }
      return false; // Files are never collapsed
    },
    isSelected(node) {
      return this.selectedFile && this.selectedFile.name === node.name && this.selectedFile.mediaLink === node.mediaLink;
    }
  }
};
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity .15s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
