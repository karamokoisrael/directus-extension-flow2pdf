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
- `Pdf Options`: Options to customize the generated pdf. You should provide a json with the following parameters:

|Name        |Type            |Default                         |Description                                                                                                 |
|------------|----------------|--------------------------------|------------------------------------------------------------------------------------------------------------|
|margin      |number or array |`0`                             |PDF margin (in jsPDF units). Can be a single number, `[vMargin, hMargin]`, or `[top, left, bottom, right]`. |
|pagebreak   |object          |`{mode: ['css', 'legacy']}`     |Controls the pagebreak behaviour on the page. See [Page-breaks](#page-breaks) below.                        |
|image       |object          |`{type: 'jpeg', quality: 0.95}` |The image type and quality used to generate the PDF. See [Image type and quality](#image-type-and-quality) below.|
|enableLinks |boolean         |`true`                          |If enabled, PDF hyperlinks are automatically added ontop of all anchor tags.                                |
|html2canvas |object          |`{ }`                           |Configuration options sent directly to `html2canvas` ([see here](https://html2canvas.hertzen.com/configuration) for usage).|
|jsPDF       |object          |`{ }`                           |Configuration options sent directly to `jsPDF` ([see here](http://rawgit.com/MrRio/jsPDF/master/docs/jsPDF.html) for usage).|


- `Template`: the name of your liquid js template stored in `extensions/templates` directory. The data from your last operation will be passed to the liquid file.

# Extra

- You can add `MARKETPLACE_TRUST="all"` option in your directus env variables to be able to browser API/Hybrid extensions within the marketplace section of your directus app.
```