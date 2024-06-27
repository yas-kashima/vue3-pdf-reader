<script setup lang="ts">
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfJSWorkerURL from "pdfjs-dist/build/pdf.worker?url";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/pdf";
import { computed, onBeforeMount, onUnmounted, ref, watch, type Ref } from "vue";

const CSS_UNITS = 96.0 / 72.0;
const dpr = ref(1);
const scaleArray = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500];
const scaleValue = ref(100);

const props = withDefaults(
  defineProps<{
    /**
     * pdf url | Uint8Array | BASE64
     */
    src: string | Uint8Array;
    httpHeaders?: Record<string, any>;
    withCredentials?: boolean;
    password?: string;
    useSystemFonts?: boolean;
    stopAtErrors?: boolean;
    disableFontFace?: boolean;
    disableRange?: boolean;
    disableStream?: boolean;
    disableAutoFetch?: boolean;
    // --custom--
    showProgress?: boolean;
    progressColor?: string;
    showBackToTopBtn?: boolean;
    scrollThreshold?: number;
    pdfWidth?: string;
    rowGap?: number;
    page?: number | '' | null;
    cMapUrl?: string;
  }>(),
  {
    src: undefined,
    httpHeaders: undefined,
    withCredentials: undefined,
    password: undefined,
    useSystemFonts: undefined,
    stopAtErrors: undefined,
    disableFontFace: undefined,
    disableRange: undefined,
    disableStream: undefined,
    disableAutoFetch: undefined,
    showProgress: true,
    progressColor: "#87ceeb",
    showBackToTopBtn: true,
    scrollThreshold: 300,
    pdfWidth: "100%",
    rowGap: 8,
    page: 1,
    cMapUrl: "https://unpkg.com/pdfjs-dist@4.2.67/cmaps/",
  }
);

const rowGap = computed(() => parseInt(String(props.rowGap)));

const emit = defineEmits<{
  (e: "onProgress", loadRatio: number): void;
  (e: "onComplete"): void;
  (e: "onScroll", scrollOffset: number): void;
  (e: "onPageChange", page: number): void;
  /**
   * https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html
   */
  (e: "onPdfInit", pdf: PDFDocumentProxy): void;
}>();

const slots = defineSlots<{
  progress?: (props: { loadRatio: number }) => any;
  backToTopBtn?: (props: { scrollOffset: number }) => any;
}>();

const canvasRefs = ref<Array<Ref<Array<HTMLCanvasElement>>>>([]);

interface Option extends Record<string, any> {
  url?: string;
  data?: Uint8Array;
  httpHeaders?: Record<string, any>;
  withCredentials?: boolean;
  password?: string;
  useSystemFonts?: boolean;
  stopAtErrors?: boolean;
  disableFontFace?: boolean;
  disableRange?: boolean;
  disableStream?: boolean;
  disableAutoFetch?: boolean;
}

const loadRatio = ref(0);
const loadingTask = ref<any>(null);
const getDoc = () => {
  const option: Option = {
    httpHeaders: props.httpHeaders,
    withCredentials: props.withCredentials,
    password: props.password,
    useSystemFonts: props.useSystemFonts,
    stopAtErrors: props.stopAtErrors,
    disableFontFace: props.disableFontFace,
    disableRange: props.disableRange,
    disableStream: props.disableStream,
    disableAutoFetch: props.disableAutoFetch,
    cMapUrl: props.cMapUrl,
  };
  if (props.src instanceof Uint8Array) {
    option.data = props.src;
  } else if (props.src.endsWith(".pdf")) {
    option.url = props.src;
  } else {
    const binaryData = atob(
      props.src.includes(",") ? props.src.split(",")[1] : props.src
    );
    const byteArray = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      byteArray[i] = binaryData.charCodeAt(i);
    }
    option.data = byteArray;
  }

  for (const key in option) {
    if (option[key] === undefined) {
      delete option[key];
    }
  }
  loadRatio.value = 0;
  loadingTask.value = getDocument(option);
  loadingTask.value.onProgress = (progressData: any) => {
    const ratio = (progressData.loaded / progressData.total) * 100;
    loadRatio.value = ratio >= 100 ? 100 : ratio;
    emit("onProgress", loadRatio.value);
  };
  loadingTask.value.promise.then(() => {
    emit("onComplete");
  });
};

const totalPages = ref(0);
const currentPage = ref(1);
const scrollOffset = ref(0);
const itemHeightList = ref<Array<number>>([]);

const scroller = ref<HTMLDivElement>() as Ref<HTMLDivElement>;
const container = ref<HTMLDivElement>() as Ref<HTMLDivElement>;

let pdf: PDFDocumentProxy;
const cancelRendering = ref(false);
const renderComplete = ref(false);
const renderPDF = async () => {
  renderComplete.value = false;
  try {
    if (!pdf) {
      pdf = await loadingTask.value.promise;
      const refs = [];
      for (let i = 0; i < pdf.numPages; i++) {
        refs.push(ref() as Ref<Array<HTMLCanvasElement>>);
      }
      canvasRefs.value = refs;
      totalPages.value = pdf.numPages;
      emit("onPdfInit", pdf);
    }
  } catch (error) {
    console.error("Error loadingTask PDF:", error);
  }
  let calcH = 0;
  for (let i = 0; i < totalPages.value; i++) {
    try {
      const page = await pdf.getPage(i + 1);
      // ----
      if (cancelRendering.value) {
        cancelRendering.value = false;
        renderPDF();
        break;
      }
      // ----
      const canvas = canvasRefs.value[i].value[0];
      // const viewport = page.getViewport({ scale: 1 });
      // let scale =
      //   ((canvas.parentNode as HTMLDivElement).clientWidth - 4) /
      //   viewport.width;
      const scale = scaleValue.value * CSS_UNITS / 100;
      const context = canvas.getContext("2d");
      const scaledViewport = page.getViewport({ scale: scale * dpr.value });
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      itemHeightList.value[i] = calcH +=
        Math.trunc(scaledViewport.height / dpr.value + rowGap.value);
      page.render({
        canvasContext: context as CanvasRenderingContext2D,
        viewport: scaledViewport,
      });
    } catch (error) {
      console.error("Error rendering PDF:", error);
    }
    if (
      props.page && props.page !== 1 &&
      (i === props.page - 1 ||
        (props.page > totalPages.value && i === totalPages.value - 1))
    ) {
      scroller.value.scrollTo(0, (itemHeightList.value[i - 1] ?? 0) + 2);
    }
    if (i === totalPages.value - 1) {
      renderComplete.value = true;
    }
  }
};

const viewportHeight = ref(0);
const isScrolling = ref(false);

let scrollTimer: number;
const handleScroll = (event: any) => {
  isScrolling.value = true;
  clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(() => {
    isScrolling.value = false;
  }, 1000);
  scrollOffset.value = event.target.scrollTop;
  emit("onScroll", event.target.scrollTop);
  if (
    scroller.value.scrollTop + scroller.value.offsetHeight >=
    scroller.value.scrollHeight - 10
  ) {
    currentPage.value = itemHeightList.value.length;
    return;
  }

  for (let i = 0; i < itemHeightList.value.length; i++) {
    const height = itemHeightList.value[i];
    if (height > event.target.scrollTop) {
      currentPage.value = i + 1;
      break;
    }
  }
};

let timer: number;
const renderPDFWithDebounce = () => {
  viewportHeight.value = window.innerHeight;
  if (
    Math.abs(innerWidth.value - window.innerWidth) > 1 &&
    Math.abs(containerWidth.value - container.value.offsetWidth) > 1
  ) {
    setWidth();
  } else {
    setWidth();
    return;
  }
  cancelRendering.value = true;
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    renderComplete.value && renderPDF();
  }, 500);
};

const innerWidth = ref<number>(0);
const containerWidth = ref<number>(0);
const setWidth = () => {
  innerWidth.value = window.innerWidth;
  containerWidth.value = container.value.offsetWidth;
};
const isAddEvent = ref(false);
onBeforeMount(async () => {
  GlobalWorkerOptions.workerSrc = pdfJSWorkerURL;
  dpr.value = window.devicePixelRatio || 1;
  viewportHeight.value = window.innerHeight;
  if (
    (typeof props.src === "string" && props.src.length > 0) ||
    props.src instanceof Uint8Array
  ) {
    getDoc();
    renderPDF();
    window.addEventListener("resize", renderPDFWithDebounce);
    isAddEvent.value = true;
  }
  watch(
    () => props.src,
    (src: string | Uint8Array) => {
      if (
        (typeof src === "string" && src.length > 0) ||
        src instanceof Uint8Array
      ) {
        getDoc();
        renderPDF();
        if (!isAddEvent.value) {
          window.addEventListener("resize", renderPDFWithDebounce);
          isAddEvent.value = true;
        }
      }
    }
  );
});

defineExpose({
  //user set pdfWidth but pdf is blurred
  //when container resize and widnow not resize, you can call reload
  reload: () => {
    innerWidth.value = window.innerWidth - 2;
    renderPDFWithDebounce();
    setWidth();
  },
});

onUnmounted(() => {
  clearTimeout(timer);
  clearTimeout(scrollTimer);
  cancelAnimationFrame(animFrameId);
  isAddEvent.value &&
    window.removeEventListener("resize", renderPDFWithDebounce);
});
// --- back to top ---
let animFrameId: number;
const easeOutCubic = (progress: number) => {
  return 1 - Math.pow(1 - progress, 3);
};
const backToTop = () => {
  const duration = 500;
  const startPos = scroller.value.scrollTop;
  const startTime = performance.now();

  const animateScroll = (timestamp: number) => {
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = easeOutCubic(progress);
    const distance = startPos * (1 - easeProgress);

    scroller.value.scrollTo(0, distance);

    if (progress < 1) {
      animFrameId = requestAnimationFrame(animateScroll);
    }
  };
  cancelAnimationFrame(animFrameId);
  requestAnimationFrame(animateScroll);
};

const changePage = (value: number) => {
  if (!value || value < 1 || value > itemHeightList.value.length) {
    // do not process if page number is invalid
    return;
  }
  scroller.value.scrollTo(0, (itemHeightList.value[value - 2] ?? 0) + 2);
}

const changePageInput =  (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLInputElement)) {
    return;
  }
  const value = parseInt(target.value);
  if (Number.isNaN(value) || value === currentPage.value) {
    return;
  }
  changePage(value);
}

const changeNextPage = () => {
  if (currentPage.value >= itemHeightList.value.length) {
    return;
  }
  changePage(currentPage.value + 1);
}

const changePreviousPage = () => {
  if (currentPage.value <= 1) {
    return;
  }
  changePage(currentPage.value - 1);
}

const scaleUp = () => {
  for (var i = 0; i < scaleArray.length; i++) {
    if (scaleArray[i] > scaleValue.value) {
      scaleValue.value = scaleArray[i];
      break;
    }
  }
  renderPDF();
}

const scaleDown = () => {
  for (var i = scaleArray.length - 1; i >= 0; i--) {
    if (scaleArray[i] < scaleValue.value) {
      scaleValue.value = scaleArray[i];
      break;
    }
  }
  renderPDF();
}

const changeScaleInput = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLInputElement)) {
    return;
  }
  const value = parseInt(target.value);
  if (Number.isNaN(value) || value < scaleArray[0] || value > scaleArray[scaleArray.length - 1]) {
    return;
  }
  scaleValue.value = value;
  renderPDF();
}

let waitToPageFun: Function | null = null;

watch(
  () => props.page,
  (page: number | '' | null) => {
    if (page === currentPage.value) {
      return;
    }
    if (!page || page < 1 || page > itemHeightList.value.length) {
      // do not process if page number is invalid
      return;
    }
    if (renderComplete.value) {
      scroller.value.scrollTo(0, (itemHeightList.value[page - 2] ?? 0) + 2);
    } else {
      waitToPageFun = () => {
        scroller.value.scrollTo(0, (itemHeightList.value[page - 2] ?? 0) + 2);
      };
    }
  }
);
watch(
  () => renderComplete.value,
  (complete: boolean) => {
    complete && waitToPageFun?.();
    waitToPageFun = null;
  }
);
watch(
  () => currentPage.value,
  (page: number) => {
    emit("onPageChange", page);
  }
);
</script>

<template>
  <div
    id="vue3-pdf-reader-main"
    style="height: 100%; position: relative; min-height: 10px; max-height: 100dvh;"
  >
    <div id="vue3-pdf-reader-toolbar" style="height: 38px; padding: 6px 8px" class="vue3-pdf-reader-toolbar">
      <div class="vue3-pdf-reader-toolbar-left">
        <button class="vue3-pdf-reader-button" @click="changePreviousPage">
          <svg xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;" viewBox="0 0 512 512">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M112 244l144-144 144 144M256 120v292"/>
          </svg>
        </button>
        <div class="vue3-pdf-reader-button-separater"></div>
        <button class="vue3-pdf-reader-button" @click="changeNextPage">
          <svg xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;" viewBox="0 0 512 512">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M112 268l144 144 144-144M256 392V100"/>
          </svg>
        </button>
        <input type="number" style="width: 46px; text-align: right;" :value="currentPage" @blur="changePageInput($event.target)" />
        <span style="margin: 0 3px">/</span><span>{{ totalPages }}</span>
      </div>
      <div class="vue3-pdf-reader-toolbar-middle">
        <button class="vue3-pdf-reader-button" @click="scaleUp">
          <svg xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;" viewBox="0 0 512 512">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M256 112v288M400 256H112"/>
          </svg>
        </button>
        <div class="vue3-pdf-reader-button-separater"></div>
        <button class="vue3-pdf-reader-button" @click="scaleDown">
          <svg xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;" viewBox="0 0 512 512">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M400 256H112"/>
          </svg>
        </button>
        <input type="number" style="width: 46px; text-align: right;" :value="scaleValue" @blur="changeScaleInput($event.target)" />
        <span style="margin: 0 3px">%</span>
      </div>
      <div class="vue3-pdf-reader-toolbar-right">
        <button class="vue3-pdf-reader-button">
          <svg xmlns="http://www.w3.org/2000/svg" style="width: 22px; height: 22px;" viewBox="0 0 512 512">
            <path d="M336 176h40a40 40 0 0140 40v208a40 40 0 01-40 40H136a40 40 0 01-40-40V216a40 40 0 0140-40h40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/>
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M176 272l80 80 80-80M256 48v288"/>
          </svg>
        </button>
      </div>
    </div>
    <div
      id="vue3-pdf-reader-progress"
      v-if="props.showProgress"
      style="
        position: absolute;
        left: 0;
        top: 32px;
        width: 100%;
        user-select: none;
        pointer-events: none;
      "
    >
      <slot v-if="slots.progress" name="progress" :loadRatio="loadRatio"></slot>
      <div
        v-else
        style="width: 0%; height: 4px; transition: all 0.2s"
        :style="{
          width: `${loadRatio}%`,
          opacity: loadRatio < 100 ? '1' : '0',
          backgroundColor: props.progressColor,
        }"
      ></div>
    </div>
    <div id="vue3-pdf-reader-container" style="height: calc(100% - 32px);" class="vue3-pdf-reader-container">
      <div
        ref="scroller"
        id="vue3-pdf-reader-scroller"
        style="height: 100%; overflow-y: auto; background-color: rgb(231, 231, 231);"
        :style="{ maxHeight: `${viewportHeight}px` }"
        @scroll="handleScroll"
      >
        <div
          id="vue3-pdf-reader-canvas-container"
          ref="container"
          style="margin: 0 auto; padding-top: 6px;"
          :style="{
            width: isNaN(Number(props.pdfWidth))
              ? props.pdfWidth
              : `${props.pdfWidth}px`,
          }"
        >
          <canvas
            style="
              display: block;
              box-shadow: #a9a9a9 0px 1px 3px 0px;
              margin-left: auto;
              margin-right: auto;
            "
            :style="{
              marginBottom: `${rowGap}px`,
            }"
            v-for="item in totalPages"
            :key="item"
            :ref="canvasRefs[item - 1]"
          ></canvas>
        </div>
      </div>
    </div>
    <div
      id="vue3-pdf-reader-backToTopBtn"
      v-if="props.showBackToTopBtn"
      @click="backToTop"
      style="
        position: absolute;
        right: 16px;
        bottom: 16px;
        display: inline-block;
        user-select: none;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s;
      "
      :style="
        scrollOffset > props.scrollThreshold
          ? { opacity: '1', pointerEvents: 'initial' }
          : undefined
      "
    >
      <slot
        v-if="slots.backToTopBtn"
        name="backToTopBtn"
        :scrollOffset="scrollOffset"
      ></slot>
      <div
        v-else
        style="
          width: 50px;
          height: 50px;
          background: rgba(0, 0, 0, 0.4);
          color: #ffffff;
          font-size: 16px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
        "
      >
        <svg xmlns="http://www.w3.org/2000/svg" style="width: 24px; height: 24px;" viewBox="0 0 512 512">
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M112 328l144-144 144 144"/>
        </svg>
      </div>
    </div>
  </div>
</template>

<style>
.vue3-pdf-reader-toolbar {
  width: 100%;
  background-image: linear-gradient(to top, rgb(108, 117, 125), rgb(142, 142, 153), rgb(108, 117, 125));
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.15), inset 0 -1px 0 rgba(255, 255, 255, 0.05), 0 1px 0 rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.1);
  font-family: "Avenir", Helvetica, Arial, sans-serif;
  color: white;
}
.vue3-pdf-reader-toolbar-left {
  float: left;
}
.vue3-pdf-reader-toolbar-middle {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
.vue3-pdf-reader-toolbar-right {
  float: right;
}
.vue3-pdf-reader-container {
  width: 100%;
}
.vue3-pdf-reader-button {
  color: white;
  background-color: inherit;
  border-style: hidden;
  width: 22px;
  height: 22px;
  padding: 0 2px;
  vertical-align: middle;
  cursor: pointer;
}
.vue3-pdf-reader-button:hover {
  color: rgb(141, 208, 255);
}
.vue3-pdf-reader-button-separater {
  background-color: rgb(75, 75, 75);
  padding: 8px 0;
  width: 1px;
  display: inline-block;
  margin: 5px 0;
  vertical-align: middle;
}
</style>
