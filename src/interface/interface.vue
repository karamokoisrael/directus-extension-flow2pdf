<template>
  <div class="presentation-links">
    <VButton
      :primary="props.button_type == 'primary'"
      :secondary="props.button_type == 'secondary'"
      :warning="props.button_type == 'warning'"
      :danger="props.button_type == 'danger'"
      :icon="!props.label"
      :loading="loading"
      @click="print"
    >
      <v-icon v-if="props.icon" left :name="props.icon" />
      <span v-if="props.label">{{ props.label }}</span>
    </VButton>
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
  button_type: {
    type: String,
    default: "primary",
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

function downloadPdf(pdfData) {
  const container = document.createElement("div");
  container.innerHTML = pdfData.html;
  html2pdf(container, {
    ...html2pdfConfig,
    filename: html2pdfConfig.fileName || pdfData.fileName,
  });
}

function previewPdf(pdfData) {
  const newWindow = window.open("", "_blank");
  newWindow.document.write(pdfData.html);
  newWindow.document.close();
}

async function print() {
  try {
    loading.value = true;
    const flowData = await getFlowData();
    const pdfData = await getPdfData(flowData);

    switch (props.behavior) {
      case "print":
        sendDivToPrinter(pdfData.html);
        break;
      case "download":
        downloadPdf(pdfData);
        break;
      case "preview":
        previewPdf(pdfData);
        break;
      default:
        break;
    }
    if (props.behavior == "print") {
    } else {
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
</style>
