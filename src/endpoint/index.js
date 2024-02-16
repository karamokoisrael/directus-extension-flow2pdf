import { defineEndpoint } from "@directus/extensions-sdk";
import { parseLiquidData } from "../libs/file-utils";
// import { createError } from "@directus/errors";

// const UnexpectedError = createError(
//   "UNEXPECTED_RESPONSE",
//   "Something went wrong...",
//   500
// );

export default defineEndpoint({
  id: "flow2pdf",
  handler: (router, { services, database, getSchema, accountability }) => {
    router.post("/print", async (req, res) => {
      const { flow_data, template } = req.body;
      const schema = await getSchema({ database, accountability });
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
