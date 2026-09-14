# 13 · Product recall notice

Sample `SYN-0022`, printed in small type at the bottom right of each page. Two pages. A product safety recall letter from a fictional appliance maker, Kettleworth Appliances Pty Ltd, to Mrs M A Wilson, dated 16 July 2026, about a portable column heater she registered with the company. The answer key is [`ground-truth.json`](ground-truth.json).

## Where it comes from

This letter followed an official sample document: the sample recall letter published by the Australian Competition and Consumer Commission (ACCC). The ACCC publishes it for suppliers to adapt when they recall a product. It is a blank template with placeholders, not a real company's letter. No real company's recall letter was copied.

The body of this letter follows that sample: its headings, their order, the product table, the numbered steps and the signature block. The top of page 1 does not come from the sample. The sample has no letterhead, no date and no address block. The logo, the company contact details, the date and Margaret's address were added, because a letter sent to her home needs to show who sent it and where it goes.

The law does not set a format for a recall letter to a customer. The only legal duty is for the supplier to tell the Commonwealth Minister about the recall. So the letter was built from the ACCC sample, the ACCC guide for suppliers, and the section of the law on recalls:

- **Recall Letter** (Australian Competition and Consumer Commission, Product Safety Australia). The official sample letter to a customer, two pages long. It gave the headings exactly as printed: "Product information", "Product description", "Identifying features", "How concerned should I be?", "What should I do?" and "Signed by". It gave the two levels of heading, with main headings in dark red and sub headings in blue. It gave the product table with three columns and a bold header row. It gave the shape of the opening sentences, the sale period written as day/month/year, the numbered steps, and the closing sentence that offers a small extra payment as thanks. It gave the greeting by first name, with the first sentence straight under it in the same paragraph. It gave a 10 digit order number written inside one of the numbered steps. This letter puts its product registration number in the same kind of place. It gave the signature block: "Signed by", a blank space, the name, then "CEO". The sample has no pictures, so this letter has no photo of the heater. <https://www.productsafety.gov.au/system/files/recall/Recall%20Letter.pdf>
- **Conducting a consumer product safety recall** (Australian Competition and Consumer Commission, April 2023). The ACCC guide for suppliers who run a recall. It gave the list of what a recall notice should tell a customer: a clear description of the product, the defect, the hazard, and what the customer should do. Each of those is covered on page 1 of this letter. It also says a recall should not be called "voluntary", and this letter does not use that word. <https://www.productsafety.gov.au/system/files/conducting-consumer-product-safety-recall-guideline.pdf>
- **Australian Consumer Law, section 128** (Competition and Consumer Act 2010, Schedule 2, Federal Register of Legislation). When a supplier recalls goods, this section requires it to give the Commonwealth Minister a written notice within 2 days. It gave the sentence on page 1 that says the company has notified the national product safety regulator. The letter does not print the section number, because this section is about the notice to the Minister, not about the letter to the customer. <https://www.legislation.gov.au/C2004A00109/latest/text>

Made up, not taken from any source: the company name Kettleworth Appliances Pty Ltd, its logo, ABN, phone number and website, and its CEO David Thompson; the customer and her address; the heater, its fault and the fire risk; the four model numbers, the serial number range, the sale period and the date she registered the heater; the product registration number; the free collection from her home and the choice of a refund or a replacement, where the sample asks the customer to post the item back for a refund; and the \$50.00 goodwill payment, where the sample offers a \$15 store credit voucher. The whole top of page 1 was added, as described above, and it has no postal address for the company. The heading colours were chosen for this letter; only the two levels of heading come from the sample. The phone number is a Victorian landline number, while the sample prints a 1300 number. The regulator is described only by what it does, with no name and no contact details. The space under "Signed by" is left blank, as it is in the sample, so the letter has no signature.

## The six fields

### document_type

**Product recall notice.** The letter has no title line. Page 1, the paragraph that begins "In the best interests of our customers", says "we have decided to recall all Kettleworth Portable Column Heaters". The same paragraph ends "We have notified the national product safety regulator of this recall." The company website at the top right of page 1 ends in "/recall", and the same address is given in step 3 on page 1 and in the last paragraph on page 2. The letter tells a customer about a safety fault in a product she owns and asks her to stop using it, which is what a product recall notice does. The answer key stores it as `product_recall_notice`. This field is free text and the experiments do not score it.

### issuer

**Kettleworth Appliances Pty Ltd.** Page 1, top left, in large bold type beside the logo. The same name is printed in small type at the bottom left of both pages, in the footer. Page 2 uses the short form in the last paragraph, "contact Kettleworth Appliances online". The letter is written by this company about heaters it is recalling, and the signature block on page 2 names its CEO, David Thompson, under "Signed by". The scoring accepts "Kettleworth Appliances" as well, because one name contains the other.

### action_required

**Stop using the heater immediately, unplug it, check the model and serial number against the letter, and contact Kettleworth Appliances to arrange free collection and a refund or replacement.** Page 1, under the heading "What should I do?", the sentence "Customers should stop using the heater immediately and arrange for us to collect it." Five numbered steps follow it. Step 1 says to switch the heater off at the power point and unplug it, and ends "Do not use it again." Step 2 says to check the model number and serial number on the compliance plate against the table above. Step 3 says to call the company or register online if the heater is affected. Step 4 says not to try to repair the heater and not to take it to a repairer. Step 5 says the company will collect the heater and she may choose a full refund or a replacement heater. The second paragraph under "How concerned should I be?" also asks every owner of these models to stop using the heater until it has been checked. The letter is written to get her to take these steps. This field is free text and the experiments do not score it.

### due_date

**Not applicable.** The letter sets no date to act by. Page 1, under "What should I do?", the first sentence says customers should stop using the heater "immediately". Step 1 ends in bold with "Do not use it again." Neither page has a "pay by", "respond by" or "due" label. The letter asks her to act at once, and it gives no date by which the steps must be done.

### amount

**No payment required.** The letter does not ask her to pay anything. Page 1, step 5 under "What should I do?", says the company will collect the heater from her home "at no cost to you", printed in bold. The same step says she may choose "a full refund of the purchase price or a replacement heater of the current model". Page 2, first paragraph, says the company will also make a goodwill payment of \$50.00 once it has collected the heater. If she chooses the refund, the company pays it to her. The goodwill payment is also paid to her by the company. The letter has no amount due, no payment slip and no payment details.

### reference

**9512653343.** Page 1, under "What should I do?", step 3, in bold at the end of the sentence "You will need your product registration number 9512653343." The number is not printed anywhere else in the letter. The contract asks for the reference, account or customer number the person must quote. This is the number the letter tells her she will need when she calls the company or registers online.
