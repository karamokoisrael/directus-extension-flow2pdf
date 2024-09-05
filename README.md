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



# API endpoint

If you want to print a pdf from you own app (Vuejs, Reactjs, Angular...), you can use the exposed endpoint `flow2pdf/print`
- Trigger the flow using the extension sdk [Guide to trigger a flow](https://docs.directus.io/reference/system/flows.html#flow-with-post-webhook-trigger)

- Run a POST request to the following endpoint `http://your-directus-instance.com/flow2pdf/print` [Guide run POST request on custom Directus endpoint](https://docs.directus.io/guides/sdk/getting-started.html#directus-javascript-sdk)
- The body should match format `{ "flow_data": { "property1": "value1", "property2": "value2" }, "template": "path to your template" }`
  - `flow_data` should contained the response you received after the flow was triggered
  - `template` is the path to your liquid file
- If the request is successful you'll get a response with the following format `{"html": "The corresponding html"}`
- You can then use `html2pdf.js` to transform the html output to a pdf


# Extra

- You can add `MARKETPLACE_TRUST="all"` option in your directus env variables to be able to browser API/Hybrid extensions within the marketplace section of your directus app.
```