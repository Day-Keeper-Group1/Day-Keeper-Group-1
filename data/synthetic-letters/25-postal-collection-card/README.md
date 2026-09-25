# 25 · Postal collection card

Sample `SYN-0020`, printed in small type at the bottom right of each page. Two pages, which are the two sides of one small card. A card left at the address of Mrs M A Wilson by a fictional postal service, Kelsworth Post, after a delivery it could not complete, telling her to collect the item from a post office. The answer key is [`ground-truth.json`](ground-truth.json).

## Where it comes from

This card did not follow an official sample or an annotated example document. It was built up without one.

No law or regulation says what a collection card must contain. What it prints, how it is laid out, and how long the item is held are one company's own business rules, and the company can change them whenever it likes. No postal company publishes the printed wording or the field positions of its cards either. The rules the synthetic data was made under do not allow a photograph of a real card to be used as a template, because a real card is a real person's mail.

So the card was built from the few things a postal service does publish about missed deliveries, and everything else was invented:

- **Missed parcel deliveries** (Australia Post). The public help page for a delivery that could not be completed. It gave three things printed on this card: an item is held for 10 business days and is then returned to sender, collecting it needs proof of identity, and the identity documents accepted are one document with a photograph on it, or two documents without a photograph where at least one shows the address. The page also says that somebody else can be authorised to collect on your behalf. <https://auspost.com.au/receiving/parcel-deliveries/missed-parcel-deliveries>
- **Australia Post to axe "Sorry we missed you" cards for MyPost customers** (SmartCompany). It reports that from June 2023 the paper card was stopped only for customers registered with the online account service, and that everyone else still receives one on paper. It also quotes the postal service calling its own cards handwritten. That is why this letter is a paper card, and why the branch name and the delivery date on it are written by hand. <https://www.smartcompany.com.au/industries/retail/australia-post-axe-sorry-we-missed-you-cards-mypost-customers/>

Made up, not taken from any source: every printed word on the card, the size of the card, and where each field sits. The whole card is a reconstruction. The company name Kelsworth Post and the tracking address www.kelsworth-post.example/track are invented. The post office name Calderfield Post Office, its address at 62 Fernlea Street and its opening hours are invented, although the street name is reused from another letter in this set so that the two agree. The card size of A6, 105 by 148 mm, printed on both sides, was a choice; no public specification gives a size. The handwriting is a handwriting font with a small amount of rotation, and which font it is depends on what is installed on the machine that made the image. Writing the delivery date as 11/8, with no year after it, was a choice, taken from the way a postal worker fills a card in by hand. The four reasons in the checkbox list are invented wording, and ticking "A signature was required" was a choice about what happened to her that day. The authority form on page 2 was also a choice: the postal service says somebody else can be authorised to collect, but it does not say that the form for doing so is printed on the back of the card. Leaving the sender off the card was a choice as well, because a real collection card usually does not say who sent the item. The barcode is a drawing, with its bar widths derived from the article number; it encodes nothing and cannot be scanned. The article number itself was written in the international S10 form of two letters, nine digits and a two letter country code, and its check digit was deliberately set to the wrong value, so the number cannot have been issued to any real item.

## The six fields

### document_type

**Postal collection card.** Page 1, top left, the envelope logo and the name "Kelsworth Post", then the large heading "Sorry we missed you" and under it "We tried to deliver an item to this address and could not leave it." The middle of the page carries the heading "COLLECT YOUR ITEM FROM" over a box that names a post office. Page 2 is headed "Authority to collect". The answer key stores it as `postal_collection_card`. This field is free text and the experiments do not score it.

### issuer

**Kelsworth Post.** Page 1, top left, the name in large type beside an envelope logo. The same name is printed in the footer at the bottom left of both pages. Page 2, last line of text, gives the tracking address "www.kelsworth-post.example/track", which carries the name again. Kelsworth Post is the postal service that tried to deliver the item, left this card and is holding the item.

### action_required

**Collect item from Calderfield Post Office.** Page 1, middle of the page, the heading "COLLECT YOUR ITEM FROM" sits over a grey box that holds the handwritten branch name "Calderfield Post Office", its street address and its opening hours. Under the box the card says "Bring this card and proof of identity." The line after that says "If someone else is collecting for you, fill in the back of this card." Page 2 is the form for that, headed "Authority to collect", and it is filled in only when another person goes instead of her. The card asks her to go to the named post office and pick the item up, and it calls it an "item" throughout. The value starts with one of the contract's eight action words, and the experiments score that word.

### due_date

**Not applicable.** Page 1, directly under the grey box, there are two ruled lines. The first is labelled "Attempted" and has "11/8" written on it by hand, with no year after it. That is the day the delivery was tried. The second is labelled "Collect by" and its line is empty. Nothing is written or printed against "Collect by". The bold line under the two lines reads "Items not collected within 10 business days will be returned to sender.", which gives a length of time and not a date. No date to collect by appears anywhere on either page. The answer key has `null` for this field.

### amount

**No payment required.** No amount of money is printed anywhere on either page, and there is no payment section. Page 1, under the heading "WHY WE COULD NOT DELIVER", there are four checkboxes. The ticked one is "A signature was required". The box beside "A payment was required" is empty. The card asks her to collect an item and to bring proof of identity, and it asks for nothing to be paid. The answer key has `null` for this field.

### reference

**RS431545614AU.** Page 1, lower left, the heading "ARTICLE NUMBER" sits over a barcode, and the number is printed in monospace type directly under the barcode as one unbroken block of letters and digits. It is the only number the card prints for the item. The contract asks for the reference, account or customer number the person must quote, and this is the number the card identifies the item by. Page 2 says "Track this item at www.kelsworth-post.example/track", and this is the number the item is tracked under there.

### identifiers

Every number the letter prints that identifies her, something she holds, or this matter, each under the label printed beside it, written as printed. The first list is the numbers a reading must find; the reference is one of them, and a reading that gives any of them as the reference is right. The experiments score whether every number in the first list is found.

- **ARTICLE NUMBER RS431545614AU.** page 1, lower left, the monospace line immediately under the barcode, beneath the heading ARTICLE NUMBER.
