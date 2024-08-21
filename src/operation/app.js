export default {
  id: "flow2pdf-operation",
  name: "Flow2PDF Operation",
  icon: "print",
  description: "Print flow data!",
  overview: ({ template }) => [
    {
      label: "Template",
      text: template,
    },
  ],
  options: [
    {
      field: "template",
      name: "Template",
      type: "string",
      meta: {
        width: "half",
        interface: "input",
        description:
          "The template file name stored in the extensions directory like flow2pdf-default-template.liquid",
      },
      // schema: {
      //   default_value: "flow2pdf-default-template.liquid",
      // },
    },
  ],
};
