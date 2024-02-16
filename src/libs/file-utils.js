import { readFile } from "fs";
import { Liquid } from "liquidjs";
/**
 * Description
 * @param {string} fileName
 * @returns {Promise<string>}
 */
function readTemplateFile(fileName) {
  const filePath = `./extensions/templates/${fileName}`;
  return new Promise((resolve, reject) => {
    readFile(filePath, "utf8", (error, data) => {
      if (error) reject(error);
      resolve(data);
    });
  });
}

/**
 * Description
 * @param {Record<string, any>} data
 * @param {string} filePath
 * @returns {Promise<string>}
 */
export function parseLiquidData(data, filePath) {
  return new Promise((resolve, reject) => {
    readTemplateFile(filePath)
      .then((text) => {
        const engine = new Liquid();
        const tpl = engine.parse(text);
        engine
          .render(tpl, data)
          .then((content) => resolve(content))
          .catch((error) => {
            console.log(error);
            resolve("");
          });
      })
      .catch((error) => {
        console.log(error);
        reject(error);
      });
  });
}
