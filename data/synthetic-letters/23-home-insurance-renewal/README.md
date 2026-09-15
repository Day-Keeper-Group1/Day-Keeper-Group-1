# 23 · Home insurance renewal

Sample `SYN-0019`, printed in small type at the bottom right of each page. Two pages. A yearly renewal notice for a home building and contents insurance policy, from a fictional insurer, Quillhaven Insurance, to Mrs M A Wilson, dated 24 July 2026. The answer key is [`ground-truth.json`](ground-truth.json).

## Where it comes from

This notice did follow one real document for its layout. The pages of a real renewal notice are reproduced in Schedule A of a court document that the corporate regulator published, and the policyholder's name in it was blacked out by the regulator before it was published. That one document gave the labels and the order of the blocks. No other insurer's notice was looked at, and nothing on this page was copied from a real person's own mail.

The rest was built up from the industry code and from the law that says what a renewal notice must tell the customer:

- **ASIC v RACQ Insurance Limited, concise statement, 22 September 2025** (Australian Securities and Investments Commission). Schedule A of this court document holds the pages of a real renewal notice. It is the only picture of a renewal notice that was used. It gave the wording of the labels: "Policyholder and payment information", "Amount due by", "This period premium", "Last period premium", "How to pay", "Pay Instore", "PAYMENT DUE DATE", "AMOUNT DUE" and "Total amount payable". It also gave the four rows of the premium table on page 2, the fact that the tax on each row is worked out and rounded on its own line before the rows are added up, and the habit of spelling out the month on the important dates while the small print uses digits. <https://download.asic.gov.au/media/s2ro4xl5/25-211mr-asic-v-racq-insurance-limited-concise-statement-22-sept-2025.pdf>
- **General Insurance Code of Practice, October 2023 update** (Insurance Council of Australia). Paragraphs 48, 49 and 50. They say a renewal notice has to point the customer at a way of checking the sum insured, has to tell her that the policy renews by itself and that she can say no, has to ask her to check that her cover is still right, and has to set this year's premium beside last year's and explain how the premium is worked out. Only those requirements were taken. None of the Code's own sentences were copied, and this fictional insurer does not claim to belong to any real industry body. <https://insurancecouncil.com.au/wp-content/uploads/2023/11/2023-COP_UPDATE_October_FINAL.pdf>
- **Insurance Contracts Act 1984 (Cth), section 58** (Federal Register of Legislation). It says the insurer must tell the customer, at least 14 days before the cover ends, the day and the time at which it will end, and whether the insurer is prepared to renew. That is why the page says the cover expires at 4:00pm on 4 September 2026 and that the insurer is prepared to renew on the terms in the notice. The section number is not printed on the page, and a real renewal notice does not print it either. <https://www.legislation.gov.au/C2004A02944/latest/text>
- **Insurance duty** (State Revenue Office Victoria). Victorian insurance duty is 10 percent, worked out on the premium including GST. With GST also at 10 percent, the total comes to 1.21 times the net premium, and that is how the four rows of the page 2 table add up. Victoria takes its fire and emergency services money through council rates instead, so a Victorian insurance notice has no levy row. <https://www.sro.vic.gov.au/insurance-duty>

Made up, not taken from any source: the company name Quillhaven Insurance, the customer Mrs M A Wilson and her address at 14 Bracken Rise, Calderfield, and every number printed on the page, which means the ABN, the policy number, the customer number, the BPAY biller code, the payment reference, the phone number and the website. The expiry time of 4:00pm was chosen by us. The law says a time has to be printed but does not say which time, and the product disclosure statements that were searched print no time at all. The money was invented as well: the net premium of \$2,054.63, last period's net premium of \$1,794.50, the excess of \$750.00, and the two sums insured of \$585,000.00 and \$92,000.00. The 14.5 percent increase printed on page 2 is the arithmetic between our own two figures, and it is not a market statistic. The spec card had said a renewal premium usually sits 8 to 20 percent above the last one, five real notices did not support that and two of them went down, so these figures were chosen without that rule. The dark teal and dark gold colours are a design decision and were not sampled from any real insurer. The barcode is a picture: the bar widths come from the text printed under it, it encodes nothing, and it cannot be scanned. The two paragraphs under "Why does your premium change?" follow the shape of a real insurer's paragraphs, but every sentence was rewritten and the two causes they name are invented. The phone number in the letterhead uses a Victorian landline range that is set aside for fiction, rather than the six digit 13 xx xx number a real insurer prints, and no financial services licence number appears anywhere, which a real renewal notice does carry. The name Kelsworth Post is used for the pay in store option. The external dispute resolution scheme on page 2 is described by what it does and is not named, because a body that a person could contact would have to be invented.

## The six fields

### document_type

**Home insurance renewal.** Page 1, under the letterhead, the large heading "Renewal Certificate of Insurance". The band below it prints "Policy type" with "Home Building and Contents" under it, and a later band is headed "When your cover expires". The answer key stores it as `home_insurance_renewal`. This field is free text and the experiments do not score it.

### issuer

**Quillhaven Insurance.** Page 1, top left, the wordmark beside a shield logo. The same name is printed in the footer of both pages, at the left end. It is the insurer sending the notice and asking to be paid, and no other sender is named anywhere on the two pages.

### action_required

**Pay Quillhaven Insurance.** Page 1, the grey box on the left reads "Amount due by 4 September 2026", and the box beside it reads "This period premium \$2,486.10". Under them the "How to pay" section gives three ways to pay the one amount, by BPAY, by phone or online, or at a Kelsworth Post outlet. Below that, a tear off slip with a barcode repeats "PAYMENT DUE DATE" and "AMOUNT DUE". The value starts with one of the contract's eight action words, and the experiments score that word.

### due_date

**2026-09-04.** Page 1, the grey box on the left, the label "Amount due by" with "4 September 2026" in large type under it. The same date is printed on the tear off slip under "PAYMENT DUE DATE". The section "When your cover expires" says the current cover expires at 4:00pm on that same day. The page writes the day first, then the month in words, then the year; the answer key writes it as year, month, day.

### amount

**\$2,486.10.** Page 1, the middle grey box, the label "This period premium" with "\$2,486.10" under it. The same figure is printed on the tear off slip under "AMOUNT DUE", and on page 2 it is the bold "Total amount payable" row in the "This period premium" column. It is the figure the notice asks her to pay by the due date, and the line under the boxes says any discounts and credits she is entitled to have already been taken off it.

### reference

**HB 1193 8188.** Page 1, the band headed "Policyholder and payment information", middle column, the label "Policy number" with "HB 1193 8188" in bold under it. It is printed once. The letters "HB" sit on the same line and in the same weight as the digits, so they are part of the value, and the key keeps them and the spacing. The contract asks for the reference, account or customer number the person must quote. This notice is a certificate for one policy, that number is the number the policy is kept under, and it is the first number printed in the band.

### identifiers

Every number the letter prints that identifies her, something she holds, or this matter, each under the label printed beside it, written as printed. The first list is the numbers a reading must find; the reference is one of them, and a reading that gives any of them as the reference is right. The experiments score whether every number in the first list is found.

- **Policy number HB 1193 8188.** page 1, band headed "Policyholder and payment information", middle column, bold under the label.
- **Customer number 70 976 319.** page 1, band headed "Policyholder and payment information", right column, bold under the label.

Also printed, and identifying something narrower: a payment method's own reference, a meter, an invoice or statement, a provider, or a one-time code. A reading may list these or leave them out.

- **Ref 0915 60028807 26.** page 1, "How to pay", BPAY box, second line under "Biller code: 9200041".
