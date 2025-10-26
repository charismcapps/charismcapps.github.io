<template>
  <div>
    <v-stage :config="stageConfig">
      <v-layer>
        <v-image :config="imageConfig"></v-image>
        <v-rect v-for="(box, index) in annotations" :key="index" :config="box"></v-rect>
      </v-layer>
    </v-stage>
  </div>
</template>

<script>
export default {
  name: 'ImageAnnotation',
  props: {
    imageSrc: {
      type: String,
      required: true
    },
    annotations: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      stageConfig: { width: 800, height: 600 },
      imageConfig: { image: null, x: 0, y: 0, width: 800, height: 600 }
    };
  },
  watch: {
    imageSrc(newSrc) {
      const img = new Image();
      img.onload = () => {
        this.imageConfig.image = img;
      };
      img.src = newSrc;
    }
  }
};
</script>

<style scoped>
/* Add styles if needed */
</style>
