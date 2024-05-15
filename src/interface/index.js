import InterfaceComponent from "./interface.vue";

export default {
  id: "flow2pdf-interface",
  name: "Flow2pdf",
  icon: "print",
  description: "This extension provide a button for downloading pdf",
  component: InterfaceComponent,
  hideLabel: true,
  hideLoader: true,
  autoKey: true,
  types: ["alias"],
  localTypes: ["presentation"],
  group: "presentation",
  options: [
    {
      field: "flow_id",
      type: "string",
      name: "Flow ID",
      meta: {
        width: "half",
        interface: "input",
        options: {
          placeholder: "Flow ID",
        },
      },
    },
    {
      field: "behavior",
      type: "string",
      name: "Behavior",
      meta: {
        width: "half",
        interface: "select-dropdown",
        options: {
          choices: [
            {
              text: "Print",
              value: "print",
            },
            {
              text: "Download",
              value: "download",
            },
            {
              text: "Preview",
              value: "preview",
            },
          ],
        },
        default_value: "download",
      },
    },
    {
      field: "template",
      name: "Template",
      type: "string",
      meta: {
        width: "half",
        interface: "input",
        default_value: "flow2pdf-default-template.liquid",
      },
      schema: {
        default_value: "flow2pdf-default-template.liquid",
      },
    },
    {
      field: "label",
      type: "string",
      name: "Label",
      meta: {
        width: "half",
        interface: "system-input-translated-string",
        default_value: "Print",
        options: {
          placeholder: "$t:label",
        },
      },
      schema: {
        default_value: "Print",
      },
    },
    {
      field: "icon",
      name: "Icon",
      type: "string",
      meta: {
        width: "half",
        interface: "select-icon",
        default_value: "normal",
      },
      schema: {
        default_value: "print",
      },
    },
    {
      field: "button_type",
      name: "Type",
      type: "string",
      meta: {
        width: "half",
        interface: "select-dropdown",
        default_value: "primary",
        options: {
          choices: [
            { text: "$t:primary", value: "primary" },
            { text: "$t:secondary", value: "secondary" },
            { text: "$t:warning", value: "warning" },
            { text: "$t:danger", value: "danger" },
          ],
        },
      },
      schema: {
        default_value: "primary",
      },
    },
  ],
};
