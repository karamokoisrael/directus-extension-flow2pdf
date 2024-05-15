import { defineEndpoint } from "@directus/extensions-sdk";
import { parseLiquidData } from "../libs/file-utils";

export default defineEndpoint({
  id: "flow2pdf",
  handler: (router) => {
    router.post("/print", async (req, res) => {
      const { flow_data, template } = req.body;
      try {
        const text = await parseLiquidData(flow_data, template);
        return res.json({
          html: text,
        });
      } catch (error) {
        console.log(error);
        return res.json({});
      }
    });
  },
});
