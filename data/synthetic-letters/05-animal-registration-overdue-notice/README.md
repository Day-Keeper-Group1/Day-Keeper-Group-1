# 05 · Animal registration overdue notice

Sample `SYN-0005`, printed in small type at the bottom right of the page. One page. An overdue notice for a cat's animal registration from a fictional council, Calderfield City Council, to Mrs M A Wilson, dated 14 May 2026. The answer key is [`ground-truth.json`](ground-truth.json).

## Where it comes from

This letter partly followed one official document. Hobsons Bay City Council, a real council in Melbourne, publishes a blank animal registration renewal notice that is also its registration form. The field labels and the style of the sections on this letter come from that document. That document is a form sent before a registration runs out. It is not a reminder sent after the registration has run out. No official example of an overdue reminder letter was found.

So the wording was built up from the law and from that one form:

- **Animal Registration Renewal Notice and Register Form** (Hobsons Bay City Council). A blank two-page file that the council prints as its renewal notice and registration form. It is the only official picture of this kind of document that was used. It gave the heading line that names the registration year and then the Act in italics, the row of phone, email and website at the top, the italic paragraph about the duty to register, and the section headings set on small coloured tabs. It gave the labels in "ANIMAL DETAILS", such as "Colour/marks", "Date of birth of animal" and "Lifetime Tag Number". It gave the short list of three ways to pay: by phone, in person and by post, with no BPAY and no barcode. It gave the pensioner concession of exactly half the fee. Its printed page size gave the A4 page. The page footer is a plain line with no coloured band, as on the form's first page. The letter does not use that council's colours, logo, fee table or blank form fields. <https://www.hobsonsbay.vic.gov.au/files/assets/public/v/4/documents/community/local-laws/animal-registration-renewal-notice-register-form.pdf>
- **Domestic Animals Act 1994** (Victorian Legislation). Section 10 says every dog and cat aged three months or older must be registered, and that a registration must be renewed before it expires. The italic paragraph under the contact row says this. Section 11 says a registration lasts until 10 April of the next year. This is why the letter says registration expires on 10 April each year. Section 15 says the council sets the fee and must give an eligible concession card holder 50 percent off. This gave the "Pensioner concession (50%)" line. Section 19 says the council must give each animal a registration number and a tag. These are the "Animal number" and the "Lifetime Tag Number" on the letter. The Act writes the date as "10 April", so the important dates on the letter spell out the month. The letter prints the name of the Act in the banner, but no section numbers. <https://www.legislation.vic.gov.au/in-force/acts/domestic-animals-act-1994>
- **Domestic Animals Regulations 2025** (Victorian Legislation). Regulation 22 says a microchip's number must follow Australian Standard AS 5018:2025. That gave the 15 digits of the microchip number on the letter. The regulation also says the first three digits are a code for the maker. The letter does not follow that part, for the reason in the next bullet. <https://www.legislation.vic.gov.au/in-force/statutory-rules/domestic-animals-regulations-2025>
- **Use of 999 ID code for programming transponders** (ICAR, 2019). ICAR is the body that gives microchip makers their codes. This notice says no animal may be identified with a microchip whose number starts with 999. The microchip number on the letter starts with 999, so it cannot belong to a real animal.

Made up, not taken from any source: the council name Calderfield City Council, its ABN, phone numbers, email address, website and PO Box, Mrs M A Wilson and her address, the cat Biscuit and her breed, colour, sex and date of birth, the animal number, the tag number, the fee of \$46.00, the 14 days allowed to pay, the choice of a single page, the order of the sections, the dark blue and red colours, the dark grey text and the logo. The fee was kept inside the range of cat fees that Victorian councils publish. The law does not say how many digits an animal number or a tag number has. Five digits were chosen for both. The microchip number is made up apart from its 15 digits and the 999 at the start. The italic paragraph and the "If your details have changed" paragraph follow the structure of the Hobsons Bay form, but their sentences were rewritten for a renewal that is overdue. The "In person" line gives no street address, because a street address would bring in a real place name. The Hobsons Bay colours were not used, because they belong to a real council.

## The six fields

### document_type

**Animal registration overdue notice.** Page 1, top left, the dark blue banner reads "ANIMAL REGISTRATION RENEWAL OVERDUE NOTICE". The paragraph under the address block begins "Our records show that the registration for the animal shown below expired on 10 April 2026 and has not been renewed." The answer key stores it as `animal_registration_overdue_notice`. This field is free text and the experiments do not score it.

### issuer

**Calderfield City Council.** Page 1, top right of the banner, the logo reads "CALDERFIELD" and under it "CITY COUNCIL". The full name "Calderfield City Council" is printed under the contact row, before the ABN. It is also printed in the "By post" line under "HOW TO PAY" ("payable to Calderfield City Council") and at the bottom left of the page footer. It is the council that holds the cat's registration and asks to be paid.

### action_required

**Pay the overdue animal registration fee of \$23.00 to Calderfield City Council by 28 May 2026, quoting animal number 44637.** Page 1, the "REGISTRATION FEE" section, with "Amount due" and "Payment due by" in the grey bar, and the "HOW TO PAY" section under it. The paragraph above "ANIMAL DETAILS" says "Please renew now so that your registration is returned to good standing." The "By phone" line says "Please quote your animal number 44637." This field is free text and the experiments do not score it.

### due_date

**2026-05-28.** Page 1, "REGISTRATION FEE" section, right side of the grey bar, "Payment due by 28 May 2026". The same date is repeated in the first line of "HOW TO PAY": "Payment must reach Council within 14 days of the date of this notice, by 28 May 2026." That sentence says the payment is due on this date. The box at the top right gives the "Date of issue" as 14 May 2026, and 14 days after it is 28 May 2026. The page writes the month as a word; the answer key writes it as year, month, day.

### amount

**\$23.00.** Page 1, "REGISTRATION FEE" section, left side of the grey bar, "Amount due \$23.00". The amount due is printed once. It is what she has to pay: the "Registration fee (Desexed & Microchipped)" of \$46.00 less the "Pensioner concession (50%)" of \$23.00, as the two lines above the grey bar show.

### reference

**44637.** Page 1, the box with a red border at the top right, second row, "Animal number". The same number is printed in the "By phone" line under "HOW TO PAY" ("Please quote your animal number 44637"). The "By post" line also asks her to write her animal number on the back of her cheque or money order. The contract asks for the reference, account or customer number the person must quote, and this letter tells her to quote her animal number.
