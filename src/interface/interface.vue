<template>
  <div class="presentation-links">
    <v-button
      class="action"
      :class="[props.type]"
      :secondary="props.type !== 'primary'"
      :icon="!props.label"
      :loading="loading"
      @click="print"
    >
      <v-icon v-if="props.icon" left :name="props.icon" />
      <span v-if="props.label">{{ props.label }}</span>
    </v-button>
    <div id="flow2pdf-html-container"></div>
  </div>
</template>

<script setup>
import { ref, defineProps, onMounted } from "vue";
import { useApi } from "@directus/extensions-sdk";
import html2pdf from "html2pdf.js";
import { html2pdfConfig } from "../config";

const api = useApi();
const props = defineProps({
  flow_id: {
    type: String,
  },
  behavior: {
    type: String,
    default: "print",
  },
  template: {
    type: String,
    default: "flow2pdf-default-template.liquid",
  },
  label: {
    type: String,
    default: "Print",
  },
  icon: {
    type: String,
    default: "print",
  },
  type: {
    type: String,
    default: "normal",
  },
});

onMounted(() => {
  const urlParams = window.location.pathname.split("/");
  const lastIndex = urlParams.length - 1;
  queryParams.value = {
    collection: urlParams[lastIndex - 1],
    item: urlParams[lastIndex],
  };
});

const loading = ref(false);
const queryParams = ref({
  collection: "",
  item: "",
});

async function print() {
  try {
    loading.value = true;
    const flowData = await getFlowData();
    const pdfData = await getPdfData(flowData);
    if (props.behavior == "print") {
      sendDivToPrinter(pdfData.html);
    } else {
      const container = document.createElement("div");
      container.innerHTML = pdfData.html;
      html2pdf(container, {
        ...html2pdfConfig,
        filename: html2pdfConfig.fileName || pdfData.fileName,
      });
    }
  } catch (error) {
    console.log(error);
  } finally {
    loading.value = false;
  }
}

async function sendDivToPrinter(html) {
  const frame1 = document.createElement("iframe");
  frame1.name = "frame1";
  frame1.style.position = "absolute";
  frame1.style.top = "-1000000px";
  document.body.appendChild(frame1);
  const frameDoc = frame1.contentWindow
    ? frame1.contentWindow
    : frame1.contentDocument.document
    ? frame1.contentDocument.document
    : frame1.contentDocument;
  frameDoc.document.open();
  frameDoc.document.write('<html lang="en"><head><title></title>');
  frameDoc.document.write("</head><body>");
  frameDoc.document.write(html);
  frameDoc.document.write("</body></html>");
  frameDoc.document.close();
  setTimeout(function () {
    window.frames["frame1"].focus();
    window.frames["frame1"].print();
    document.body.removeChild(frame1);
  }, 500);
}

async function getFlowData() {
  const body = {
    collection: queryParams.value.collection,
    keys: [queryParams.value.item],
  };
  const response = await api.post(
    `/flows/trigger/${props.flow_id}?ID=${queryParams.value.item}`,
    body
  );
  if (!response.data) throw new Error("No data found");
  return response.data;
}

async function getPdfData(flowData) {
  const body = {
    collection: queryParams.value.collection,
    item: queryParams.value.item,
    flow_data: flowData,
    template: props.template,
  };

  const response = await api.post("/flow2pdf/print", body);
  if (!response.data.html) throw new Error("No data found");

  return {
    html: response.data.html,
    fileName: `${body.collection}-${body.item}.pdf`,
  };
}
</script>

<style lang="scss" scoped>
.presentation-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.action {
  &.info {
    --v-button-background-color: var(--blue);
    --v-button-background-color-hover: var(--blue-125);
    --v-button-color: var(--blue-alt);
    --v-button-color-hover: var(--blue-alt);
  }

  &.success {
    --v-button-background-color: var(--theme--success);
    --v-button-background-color-hover: var(--success-125);
    --v-button-color: var(--success-alt);
    --v-button-color-hover: var(--success-alt);
  }

  &.warning {
    --v-button-background-color: var(--theme--warning);
    --v-button-background-color-hover: var(--warning-125);
    --v-button-color: var(--warning-alt);
    --v-button-color-hover: var(--warning-alt);
  }

  &.danger {
    --v-button-icon-color: var(--white);
    --v-button-background-color: var(--theme--danger);
    --v-button-background-color-hover: var(--danger-125);
    --v-button-color: var(--danger-alt);
    --v-button-color-hover: var(--danger-alt);
  }
}
</style>
