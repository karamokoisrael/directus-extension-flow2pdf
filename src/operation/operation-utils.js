import fs from "fs";
import { v4 as uuidv4 } from "uuid";
const htmlToPdf = require("html-pdf-node");

export async function saveDirectusFile(
  fileName,
  { database, getSchema, accountability, services }
) {
  const schema = await getSchema();
  const serviceOptions = { knex: database, schema, accountability };
  const fileService = new services.FilesService(serviceOptions);
  const id = await fileService.createOne({
    storage: "local",
    filename_disk: fileName,
    filename_download: fileName,
    title: fileName,
    type: "application/pdf",
    folder: null,
  });
  return await fileService.readOne(id);
}

export function writeOperationFile(fileContent, context) {
  const fileName = `${uuidv4()}.pdf`;
  const filePath = `./uploads/${fileName}`;

  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, fileContent, (error) => {
      if (error) reject(error);
      saveDirectusFile(fileName, context)
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  });
}

export async function saveOperationPdfFile(fileContent, context) {
  let options = { format: "A4" };
  const file = { content: fileContent };
  const pdfBuffer = await htmlToPdf.generatePdf(file, options);
  return await writeOperationFile(pdfBuffer, context);
}
