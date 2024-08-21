import { parseLiquidData } from "../libs/file-utils";
import { UnexpectedError } from "../libs/error-utils";
import { saveOperationPdfFile } from "./operation-utils";

export default {
  id: "flow2pdf-operation",
  handler: async ({ template }, context) => {
    const { data } = context;
    try {
      console.log(template);
      const flowData = data["$last"];
      const text = await parseLiquidData(flowData, template);
      return await saveOperationPdfFile(text, context);
    } catch (error) {
      console.log(error);
      throw new UnexpectedError({
        collection: "directus_files",
      });
    }
  },
};
