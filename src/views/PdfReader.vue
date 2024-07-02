<script setup lang="ts">
import { ref, watchEffect } from "vue";
import type { PDFDocumentProxy } from "..";
import { PDF } from "..";

const isMobile = ref(false);
const page = ref(1);

const handlePageChange = (newPage: number) => {
  console.log(`new page: ${newPage}`);
  page.value = newPage;
};

const resize = () => {
  isMobile.value = window.innerWidth < 1000;
};

watchEffect(() => {
  resize();
  window.addEventListener("resize", resize);
  return () => {
    window.removeEventListener("resize", resize);
  };
});

/**
 *
 * @param {PDFDocumentProxy} pdf - The PDF document proxy object.
 * @returns {void}
 */
const handlePdfInit = (pdf: PDFDocumentProxy): any => {
  console.log(pdf);
};
</script>

<template>
  <div :style="isMobile ? 'width: 100%' : 'width: 1000px'" style="height: 100dvh;">
    <PDF
      :page="page"
      :pdf-width="isMobile ? '100%' : '983'"
      :row-gap="isMobile ? 4 : 8"
      src="/200MB-TESTFILE.ORG.pdf"
      @on-pdf-init="handlePdfInit"
      @on-page-change="handlePageChange"
    >
    </PDF>
  </div>
</template>

<style scoped>
@media (min-width: 768px) {
  ::v-deep(.pdf-vue3-backToTopBtn) {
    right: 32px !important;
  }
}

.tool-bar {
  position: fixed;
  left: 16px;
  bottom: 16px;
  background-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0px 0px 2px #777;
  border-radius: 4px;
  line-height: 1em;
  padding: 8px;
}

.tool-bar > p {
  margin: 0 0 8px;
}
</style>
