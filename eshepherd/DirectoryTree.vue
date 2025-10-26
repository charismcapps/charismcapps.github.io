<template>
  <ul class="select-none text-xs">
    <li v-for="node in nodes" :key="node.name">
      <div v-if="node.type === 'directory'" @click="toggleCollapse(node)" class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 text-gray-800 text-sm leading-tight font-[Arial_Narrow,Arial,sans-serif]">
        <svg :class="['h-4 w-4 text-gray-500 transform transition-transform', { 'rotate-0': isCollapsed(node), '-rotate-90': !isCollapsed(node) }]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M12.03 5.47a.75.75 0 0 1 0 1.06L9.06 9.5l2.97 2.97a.75.75 0 1 1-1.06 1.06l-3.5-3.5a.75.75 0 0 1 0-1.06l3.5-3.5a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" />
        </svg>
        <svg class="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M10 4H4a2 2 0 0 0-2 2v1h20V8a2 2 0 0 0-2-2h-8l-2-2Z"/>
          <path d="M22 9H2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9Z"/>
        </svg>
        <span class="font-medium">{{ node.name }}</span>
      </div>
      <div v-else @click="$emit('select', node)" class="group flex items-center gap-2 pl-9 pr-2 py-1.5 cursor-pointer hover:bg-blue-50 text-gray-700 text-xs leading-tight font-[Arial_Narrow,Arial,sans-serif]">
        <svg class="h-4 w-4 text-gray-400 group-hover:text-blue-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/>
        </svg>
        <span class="truncate">{{ node.name }}</span>
      </div>
      <transition name="fade" mode="out-in">
        <div v-show="!isCollapsed(node) && (node.children && node.children.length)" class="ml-4 border-l border-gray-200">
          <directory-tree :nodes="node.children" @select="$emit('select', $event)"></directory-tree>
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
    }
  },
  data() {
    return {
      collapsed: {}
    };
  },
  methods: {
    toggleCollapse(node) {
      if (node.type !== 'directory') return;
      this.$set ? this.$set(this.collapsed, node.name, !this.collapsed[node.name]) : (this.collapsed = { ...this.collapsed, [node.name]: !this.collapsed[node.name] });
    },
    isCollapsed(node) {
      if (node.type !== 'directory') return false;
      return this.collapsed[node.name] !== undefined ? this.collapsed[node.name] : true;
    }
  }
};
</script>

<style scoped>
/* Tailwind handles most styles; add minimal transitions */
.fade-enter-active, .fade-leave-active { transition: opacity .15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
