# 08 · Welfare information request

Sample `SYN-0010`, printed in small type at the bottom right of the page. One page. A letter dated 14 July 2026 from a fictional welfare agency, the Public Payments Office, to Mrs M A Wilson, asking for details of the pension she draws from her superannuation fund. The answer key is [`ground-truth.json`](ground-truth.json).

## Where it comes from

This letter did not follow an official sample letter. No real letter of this kind was available to copy. The federal agency that sends these letters keeps its letter templates on an internal website that the public cannot open.

So the letter was built up from what the Social Security (Administration) Act 1999 says a notice like this must contain, from the Australian Government's guidance on writing letters, and from the agency's public web pages about this kind of review. The look of the page follows the layout habits of one official document from the same agency. That document is a blank form, not a letter.

- **Income and assets form (MOD IA), June 2026 edition** (Services Australia). A blank official form of 20 pages. It is the only official document whose look was followed. It gave the layout: headings in a left column and text in a right column, a thin rule across the page under the letterhead, the agency name with a black band under it holding one italic lower case word, web addresses and phone numbers in bold with no underline, a small form code with a year and month version number at the bottom left, and the page number in bold at the bottom. It also gave the label "Customer Reference Number" and the three footer headings "Information in your language", "Hearing and speech assistance" and "Privacy and your personal information". The text under those footer headings was rewritten. <https://www.servicesaustralia.gov.au/mod-ia>
- **Australian Public Service Writing Handbook** (Australian Public Service Commission, November 2024). It gave the order of the letter: why we are writing, what you need to do, when you need to do it by, what happens if you do not, how to give us the details, what to do if you disagree, and a closing sentence. It also gave "Dear Mrs Wilson" and "Yours sincerely". It gave the rule that a printed letter spells out the full web address. It gave the way dates are written, such as "14 July 2026". <https://www.apsc.gov.au/publication/australian-public-service-writing-handbook>
- **Style Manual, Emails and letters** (Australian Government). It gave the recipient's name and address at the top, the date of the letter, a subject line that says what the letter is for, and the list of enclosed pages at the end. <https://www.stylemanual.gov.au/content-types/emails-and-letters>
- **Social Security (Administration) Act 1999, section 196** (Parliament of Australia, text from AustLII). A written notice asking for information must describe the information, say how to give it, and say how long the person has. It must also say that it is given under this section. That is the bold sentence on the page, "This notice is given under section 196 of the Social Security (Administration) Act 1999." The sentence was written from the words of the section, not copied from a real letter. <https://classic.austlii.edu.au/au/legis/cth/consol_act/ssa1999338/s196.html>
- **Social Security (Administration) Act 1999, section 72** (Parliament of Australia, text from AustLII). A notice must say that it is an information notice given under the social security law. That is the sentence "It is an information notice given to you under the social security law." This sentence was also written from the words of the section. <https://classic.austlii.edu.au/au/legis/cth/consol_act/ssa1999338/s72.html>
- **Social Security (Administration) Act 1999, sections 63, 64 and 81** (Parliament of Australia, text from AustLII). Section 63 says the consequences in section 64 only apply if the notice tells the person about them. Section 64 says the payment stops being payable and the person can stop qualifying for a concession card. Section 81 says the payment can be cancelled or suspended. Together they gave the paragraph under "What happens if you do not". <https://classic.austlii.edu.au/au/legis/cth/consol_act/ssa1999338/s63.html> <https://classic.austlii.edu.au/au/legis/cth/consol_act/ssa1999338/s64.html> <https://classic.austlii.edu.au/au/legis/cth/consol_act/ssa1999338/s81.html>
- **Social Security Guide 8.1.3.10, Provision of information** (Department of Social Services). It confirms that a notice under this part of the Act must give the person at least 14 days to reply. The 21 days in this letter meet that minimum. <https://guides.dss.gov.au/social-security-guide/8/1/3/10>
- **Income stream reviews** (Services Australia). The public page about this kind of review. It gave the 21 days counted from the date on the letter, the one-time access code for sending details online, and returning the form in a reply paid envelope. Its sentences were rewritten, not copied. <https://www.servicesaustralia.gov.au/income-stream-reviews?context=22526>
- **Change of circumstances (Age Pension)** (Services Australia). It gave the ongoing duty to report a change, in the paragraph under "What else you need to tell us". <https://www.servicesaustralia.gov.au/change-circumstances-when-you-get-age-pension?context=22526>
- **Explanations and formal reviews of a Centrelink decision** (Services Australia). It gave the paragraph under "If you disagree with a decision". A person can ask for an explanation or for a review by an officer who took no part in the decision. Neither costs anything. <https://www.servicesaustralia.gov.au/explanations-and-formal-reviews-centrelink-decision?context=64107>
- **Centrepay Procedural Guide, version 6, March 2024** (Services Australia). Only one fact was taken from it. Section 4.1.2 says the agency gives a Customer Reference Number to businesses as well as to customers. Both kinds of number have the same format. The letter uses this fact when it gives Wattlebank Super a reference number in the same format as Mrs Wilson's. The real format described in the guide, 9 numbers and 1 letter, was not used. <https://www.servicesaustralia.gov.au/centrepay>

Made up, not taken from any source: the agency name Public Payments Office, the word "paystead" in the black band, the superannuation fund Wattlebank Super, Mrs Wilson with her address and date of birth, the officer Karen Mitchell, the date of the letter, the start date of her pension and the period under review, the two reference numbers themselves and their pattern of PPO followed by two groups of four digits, the one-time access code, every phone number, the web address, the reply paid number 2841, and the form code RVW452.2607. Every sentence of the letter was written for this sample, because no real letter wording could be found. Printing the superannuation fund's own reference on the letter is also invented, with no source for it. Some layout choices differ from the official form on purpose. The font is Arial at 11 point, where the form uses a narrow font. There is no government crest and no national government line above the agency name. Only one phone number is given for hearing and speech help, where the form gives two. The enclosed form and envelope are listed at the end of the letter but are not shown.

## The six fields

### document_type

**Welfare information request notice.** Page 1, the bold heading under the address reads "We need some details about your income stream". The first paragraph says "This is a routine compliance check, not a change to your pension." Under "What happens if you do not", the letter says "This notice is given under section 196 of the Social Security (Administration) Act 1999. It is an information notice given to you under the social security law." The answer key stores it as `welfare_information_request_notice`. This field is free text and the experiments do not score it.

### issuer

**Public Payments Office.** Page 1, top left, the letterhead reads "Public Payments Office" in large bold type, with a black band under it. The same name is printed as the last line of the signature block, under "Karen Mitchell" and "Service Officer". The letter is written and signed in the name of this office. It is also the office she has to send the details to.

### action_required

**Return form to Public Payments Office.** Page 1, the section "What you need to do" says "Fill in the enclosed form and tell us, for the income stream above:" and lists three details. It then says "Send the latest schedule from Wattlebank Super with it." The income stream is described in the table "Income stream under review" above that section. The form is named near the bottom of the letter, on the line "Enclosed: Income and assets form; Reply paid envelope". The section "How to give us the details" lists four ways to give the details: online, by telephone, by post and in person. The section "What happens if you do not" says her pension can be suspended or cancelled if the details do not reach the office in time. The value starts with one of the contract's eight action words, and the experiments score that word.

### due_date

**2026-08-04.** This date is not printed on the letter. Page 1, the section "When you need to do it by" says "You have 21 days from the date at the top of this notice to give us these details." The date at the top right of the page, beside the label "Date", is "14 July 2026". Counting 21 days from 14 July 2026 gives 4 August 2026. The first 17 days reach 31 July, and 4 more days reach 4 August. The answer key writes it as year, month, day.

### amount

**No payment required.** No dollar amount and no currency symbol is printed anywhere on the page. The letter asks for information. It does not ask for money. The section "What you need to do" asks her to fill in a form and send a schedule from her superannuation fund. The four ways listed under "How to give us the details" are ways to send the details, and none of them is a way to pay. The first paragraph says "This is a routine compliance check, not a change to your pension."

### reference

**PPO-5002-9891.** Page 1, top right, beside the label "Customer Reference Number". The number itself is printed only once. Under "How to give us the details", option 1 is "Online". It tells her to "enter your Customer Reference Number together with the one-time access code below". The contract asks for the reference, account or customer number the person must quote, and this is the number the letter tells her to enter.

### identifiers

Every number the letter prints that identifies her, something she holds, or this matter, each under the label printed beside it, written as printed. The first list is the numbers a reading must find; the reference is one of them, and a reading that gives any of them as the reference is right. The experiments score whether every number in the first list is found.

- **Customer Reference Number PPO-5002-9891.** page 1, top right header block, second line, bold beside the grey label.

Also printed, and identifying something narrower: a payment method's own reference, a meter, an invoice or statement, a provider, or a one-time code. A reading may list these or leave them out.

- **Provider reference PPO-7143-4935.** page 1, "Income stream under review" table, fourth row.
- **One-time access code VRJF86.** page 1, boxed panel directly under the four numbered channels, printed in a serif typewriter face with wide letter spacing as V R J F 8 6.
