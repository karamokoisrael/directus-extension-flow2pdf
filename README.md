# Flow2Pdf

The `flow2pdf` extension is a bundle that allows directus to print data from flow results and liquid templates.

# Requirements

- Node.js 18 or higher
- `directus-extension-flow2pdf` installed on your Directus instance.

# Usage

The extension will add a new interface, endpoint and operation to your directus instance.
Find the configurations for each interface type below

# Interface Configuration

- Create a Flow with `Webhook` trigger and set the method as `POST`, now copy the `id` of the Flow. Make sure that the trigger is not asynchronous.
- Create a `Button Links` field in the desired collection and choose `Flow2PDF` as the interface.
- Create `extensions/template` directory and add your `.liquid` template.

![Interface Configuration](https://github.com/karamokoisrael/directus-extension-flow2pdf/blob/master/images/interface-configuration.png?raw=true "Configurations")

- `Flow Id`: Id of the Flow you will be collecting data from (Note: the last operation of your Flow should return some JSON data ).
- `Behavior`: Accepts two values
  - `print`: To print the document from your printer
  - `download`: To download the document as PDF
- `Template`: the name of your liquid js template stored in `extensions/templates` directory. The data from your flow will be passed to the liquid file.
- `label`: The label of the button
- `Icon`: The icon of the button
- `Type`: The type of the button. Accepted values are `primary`, `secondary`, `warning` and `danger`

# Operation Configuration

- Create your flow and add `the FLow2PDF Operation` to generate a pdf from your flow output
- Create `extensions/template` directory and add your `.liquid` template.
- The operation saves the pdf file locally and returns the file payload with the following format 
```json
  {
  "id": "1d6cda32-503d-47b5-b16d-7bc35da61fab",
  "storage": "local",
  "filename_disk": "169e5fc5-ab4e-4475-9070-f0b3de30fb83.pdf",
  "filename_download": "169e5fc5-ab4e-4475-9070-f0b3de30fb83.pdf",
  "title": "169e5fc5-ab4e-4475-9070-f0b3de30fb83.pdf",
  "type": "application/pdf",
  "folder": null,
  "uploaded_by": "199def52-8491-4049-ac05-d83b06087f83",
  "uploaded_on": "2024-07-14T11:59:21",
  "modified_by": null,
  "modified_on": "2024-07-14T03:59:21",
  "charset": null,
  "filesize": null,
  "width": null,
  "height": null,
  "duration": null,
  "embed": null,
  "description": null,
  "location": null,
  "tags": null,
  "metadata": null,
  "focal_point_x": null,
  "focal_point_y": null
  }

```

- You can then use the payload to send a mail or a notification to any in your database.

![Interface Configuration](https://github.com/karamokoisrael/directus-extension-flow2pdf/blob/master/images/operation-configuration.png?raw=true "Configurations")

- `Template`: the name of your liquid js template stored in `extensions/templates` directory. The data from your last operation will be passed to the liquid file.

# Extra

<!-- - You can add `MARKETPLACE_TRUST="all"` option in your directus env variables to be able to browser API/Hybrid extensions within the marketplace section of your directus app. -->
- This extension should preferably be installed using a package manager like npm, pnpm, or yarn due to reported issues with installations through the Directus marketplace.
```