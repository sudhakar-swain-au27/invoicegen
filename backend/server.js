const express = require('express');
const multer = require('multer');
const cors = require('cors');
const PDFDocument = require('pdfkit');

const app = express();
const port = 9000;

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/generate-invoice', upload.fields([{ name: 'companyLogo' }, { name: 'signatureImage' }]), async (req, res) => {
  try {
    const data = req.body;
    data.items = JSON.parse(data.items); // Parse the items array

    // Validate required fields
    const requiredFields = ['sellerName', 'sellerAddress', 'sellerCityStatePincode', 'sellerPAN', 'sellerGST', 'placeOfSupply', 'billingName', 'billingAddress', 'billingCityStatePincode', 'billingStateUTCode', 'shippingName', 'shippingAddress', 'shippingCityStatePincode', 'shippingStateUTCode', 'orderNo', 'orderDate', 'invoiceNo', 'invoiceDate', 'reverseCharge'];
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      return res.status(400).send(`Missing required fields: ${missingFields.join(', ')}`);
    }

    if (data.items.length === 0) {
      return res.status(400).send('Items are required.');
    }

    const pdfBuffer = await createInvoice(data, req.files);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${data.invoiceNo}.pdf`
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Internal Server Error');
  }
});

async function createInvoice(data, files) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  let buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => { /* Do nothing */ });

  // Company logo
  if (files.companyLogo) {
    doc.image(files.companyLogo[0].buffer, 50, 45, { width: 150 });
  }

  // Invoice header
  doc
    .fontSize(20)
    .text('INVOICE', 275, 50, { align: 'right' })
    .fontSize(10);

  // Seller details (right-aligned)
  doc
    .fontSize(10)
    .text(`Seller: ${data.sellerName}`, { align: 'right' })
    .text(`Address: ${data.sellerAddress}`, { align: 'right' })
    .text(`City, State, Pincode: ${data.sellerCityStatePincode}`, { align: 'right' })
    .text(`PAN No: ${data.sellerPAN}`, { align: 'right' })
    .text(`GST Registration No: ${data.sellerGST}`, { align: 'right' })
    .text(`Place of Supply: ${data.placeOfSupply}`, { align: 'right' })
    .text(`Order No: ${data.orderNo}`, { align: 'right' })
    .text(`Order Date: ${data.orderDate}`, { align: 'right' })
    .text(`Invoice No: ${data.invoiceNo}`, { align: 'right' })
    .text(`Invoice Date: ${data.invoiceDate}`, { align: 'right' })
    .text(`Reverse Charge: ${data.reverseCharge}`, { align: 'right' });

  // Billing details (right-aligned)
  doc
    .fontSize(10)
    .text(`Billing Name: ${data.billingName}`, 300, 200, { align: 'right' })
    .text(`Billing Address: ${data.billingAddress}`, 300, 215, { align: 'right' })
    .text(`Billing City, State, Pincode: ${data.billingCityStatePincode}`, 300, 230, { align: 'right' })
    .text(`Billing State/UT Code: ${data.billingStateUTCode}`, 300, 245, { align: 'right' });

  // Shipping details (right-aligned)
  doc
    .fontSize(10)
    .text(`Shipping Name: ${data.shippingName}`, 300, 265, { align: 'right' })
    .text(`Shipping Address: ${data.shippingAddress}`, 300, 280, { align: 'right' })
    .text(`Shipping City, State, Pincode: ${data.shippingCityStatePincode}`, 300, 295, { align: 'right' })
    .text(`Shipping State/UT Code: ${data.shippingStateUTCode}`, 300, 310, { align: 'right' });

  // Table header
  const tableTop = 380;
  const itemDescriptionX = 50;
  const itemUnitPriceX = 200;
  const itemQuantityX = 250;
  const itemDiscountX = 300;
  const itemTaxRateX = 350;
  const itemTotalX = 400;

  doc
    .fontSize(10)
    .text('Description', itemDescriptionX, tableTop)
    .text('Unit Price', itemUnitPriceX, tableTop)
    .text('Quantity', itemQuantityX, tableTop)
    .text('Discount', itemDiscountX, tableTop)
    .text('Tax Rate', itemTaxRateX, tableTop)
    .text('Total', itemTotalX, tableTop);

  // Table rows
  let position = tableTop + 20;
  data.items.forEach((item, index) => {
    const itemTotal = (item.unitPrice * item.quantity * (1 - item.discount / 100)) * (1 + item.taxRate / 100);
    doc
      .fontSize(10)
      .text(item.description, itemDescriptionX, position)
      .text(item.unitPrice, itemUnitPriceX, position)
      .text(item.quantity, itemQuantityX, position)
      .text(item.discount, itemDiscountX, position)
      .text(`${item.taxRate}%`, itemTaxRateX, position)
      .text(itemTotal.toFixed(2), itemTotalX, position);
    position += 20;
  });

  // Signature image
  if (files.signatureImage) {
    doc.image(files.signatureImage[0].buffer, 50, position + 20, { width: 100 });
  }

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    doc.on('error', reject);
  });
}

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
