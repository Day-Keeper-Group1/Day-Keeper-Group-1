# 26 · Charity appeal letter

Sample `SYN-0024`, printed in small type at the bottom right of the page. One page. A yearly appeal for donations from a fictional charity, the Pentmere Foundation, to Mrs M A Wilson, inviting her to give money towards breakfast clubs in local primary schools. The answer key is [`ground-truth.json`](ground-truth.json).

## Where it comes from

This letter did not follow an official sample or an annotated example document. It was built up from published legislation, without one.

No government body publishes a template or a sample appeal letter for a charity. The law says which blocks a fundraising letter must contain, but it says nothing about how those blocks are arranged on the page. The rules the synthetic data was made under do not allow a real charity's appeal letter to be used as a template.

So the letter was built up from the Victorian fundraising law, from the national fundraising principles it carries, and from the tax office page behind the one tax sentence on the slip:

- **Fundraising Act 1998, authorised version 042** (Victorian Government). Section 15A is the one printing rule this kind of letter has: a fundraising direct debit form must be easily legible, must use at least 10 point type where it is printed or typed, and must be clearly expressed. That is why the whole slip below the tear line is set in larger type than the body of the letter. Section 7 forbids misleading or deceptive statements in fundraising. Section 15(2) requires two extra sentences, saying who sent the letter and that they were hired to send it, but only when a commercial fundraising company sends it. This letter is sent by the charity itself, so those two sentences are not on it. The Act does not require a registration number. The words "registration number" do not appear anywhere in its 131 pages, so no registration number is printed on the letter. <https://www.legislation.vic.gov.au/in-force/acts/fundraising-act-1998>
- **Fundraising Regulations 2019, authorised version 002** (Victorian Government). Schedule 2 holds the National Fundraising Principles, which bind charities registered with the national charities regulator. Four of them shaped this letter. Principle 1 requires the charity to explain its purpose and what the money is used for, which is the second paragraph of the letter. Principle 4b requires the charity to honour a request not to receive future appeals, which is the tick box at the very bottom of the slip. Principle 9 requires the letter to say whether a gift is one off or ongoing and to explain how to end an ongoing gift, which is the line under the monthly gift box. Principle 8 forbids a charity from exploiting the trust, the lack of knowledge, the lack of capacity, the apparent need for care and support, or the vulnerable circumstances of a donor. That principle decided the plain tone of the letter and what it is about. <https://www.legislation.vic.gov.au/in-force/statutory-rules/fundraising-regulations-2019>
- **Competition and Consumer Regulations 2010** (Federal Register of Legislation, compilation of 20 May 2026). This one was used to decide what not to print. Regulation 78 sets a warning that must be the most prominent text on certain documents, saying the document is not a bill and that no money need be paid. It applies to unsolicited goods and services and to unauthorised directory and advertising entries, not to charity fundraising. None of that wording is on this letter. <https://www.legislation.gov.au/F1996B01420/2026-05-20/2026-05-20/text/original/pdf>
- **Gifts and donations** (Australian Taxation Office). The slip prints "Donations of \$2 or more are tax deductible." The tax office page says the \$2 minimum for claiming a deduction was removed from 1 July 2026, backdated to all eligible gifts made from 1 July 2024, and this letter is dated 14 August 2026. The older sentence was printed on purpose. Real fundraising stationery is often printed months ahead, so both wordings were in circulation in August 2026. <https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/gifts-and-donations>

Made up, not taken from any source: the charity Pentmere Foundation, its leaf mark, its brown colour and its line "Breakfast clubs in local primary schools", the coordinator Susan Barrett, and the recipient Mrs M A Wilson at 14 Bracken Rise, Calderfield. Every number on the page was invented as well: the phone number, the website, the ABN, and the supporter number. The whole story is invented, including the eleven schools, the four hundred children, the 84 cents in every dollar, and the toaster going since 2019. The three gift levels \$35, \$50 and \$100 and what each one buys are invented, and so are the letter date of 14 August 2026 and the return date of 30/09/2026. The layout is ours: where the tear line falls, what the slip holds and in what order, and the shape of the letterhead. The return date on the slip was written with slashes, the way a bill writes a date, rather than spelled out like the date at the top of the letter. A reply paid envelope is named in the text but no envelope was made. The phone number is an ordinary Victorian landline rather than a national hotline number, which is what a small local charity prints. The subject of the letter, breakfast clubs for school children, was chosen so that the letter does not talk about the reader's own circumstances.

## The six fields

### document_type

**Charity appeal letter.** Page 1, top left, the letterhead reads "Pentmere Foundation" with "Breakfast clubs in local primary schools" under it. The body asks the reader to give money to that programme, and the block below the tear line at the bottom of the page is headed "YES, I would like to help." with gift boxes, name and phone lines and a card number line. The answer key stores it as `charity_appeal_letter`. This field is free text and the experiments do not score it.

### issuer

**Pentmere Foundation.** Page 1, top left, the name in large brown type beside a leaf mark. The same name is printed in the second paragraph of the letter, "The Pentmere Foundation pays for the food, the equipment and the food-safety training", and again in the footer at the bottom left of the page. The letter is signed by Susan Barrett, Coordinator. It is the charity that wrote the letter and that any gift would go to.

### action_required

**No action.** Page 1, the fifth paragraph of the body says "If you are able to help this year, the slip at the bottom of this page has everything we need. If this is not the right time, that is completely all right, and it will not change anything about how we treat you." The slip below the tear line is headed "YES, I would like to help." The postscript at the end of the letter says "Whatever you decide about this letter, they will be there again on Monday." The letter asks her to consider giving and tells her that not giving changes nothing, so there is nothing she has to do. The value starts with one of the contract's eight action words, and the experiments score that word.

### due_date

**Not applicable.** Page 1, near the bottom of the slip, the letter prints "Please return this slip by 30/09/2026 in the reply paid envelope provided." That line is about the slip, and the slip is only filled in and returned if she decides to give. The body of the letter says "If this is not the right time, that is completely all right, and it will not change anything about how we treat you." Nothing is required of her, so there is no date she has to meet. The answer key has `null` for this field.

### amount

**No payment required.** Page 1, the fourth paragraph says "A gift of \$35 covers a week of breakfasts for one classroom. \$50 buys a term's worth of fruit for one school. \$100 replaces a toaster that has been going since 2019 and is starting to give up." The slip repeats the same three figures as tick boxes, "\$35", "\$50" and "\$100", followed by a fourth box reading "My choice \$" with a blank line after it for her to write her own figure. They are suggestions for a gift, and the blank line means the letter sets no figure at all. The line "Donations of \$2 or more are tax deductible." is a statement about tax, not a request for money. Nothing is owed. The answer key has `null` for this field.

### reference

**772-578-249.** Page 1, at the top right of the slip, on the same line as the heading "YES, I would like to help.", printed after the words "Supporter number". It appears once on the page. It is her own number with this charity, printed on the slip before the letter was posted, and it is the number that would identify her to the charity if she sent the slip back.
