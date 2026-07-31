import fitz

src = fitz.open('attached_assets/Letter_Hade_1785480466712.pdf')
page = src[0]

# find anchor positions
ref_rects = page.search_for("Ref.")
date_rects = page.search_for("Date: -")
print("Ref:", ref_rects, "Date:", date_rects)

black = (0, 0, 0)
F = "helv"; FB = "hebo"

def text(x, y, s, size=11, font=F):
    page.insert_text(fitz.Point(x, y), s, fontsize=size, fontname=font, color=black)

# Ref no + date on the existing line
r = ref_rects[0]; d = date_rects[0]
text(r.x1 + 4, r.y1 - 1, "DJ/HFM/HYR/2026-27/____", 10)
text(d.x1 + 4, d.y1 - 1, "31/07/2026", 10)

x = 72
y = r.y1 + 40
def line(s, size=11, font=F, gap=17, xx=None):
    global y
    if s:
        text(xx if xx is not None else x, y, s, size, font)
    y += gap

line("To,", 11, FB)
line("The Licensing Officer / Registering Officer,")
line("Office of the Labour Commissioner,")
line("_______________________________")
line("_______________________________")
line("", gap=14)
line("Subject: Submission of Half-Yearly Return for the period January 2026 to June 2026", 11, FB, gap=24)
line("Respected Sir / Madam,", 11, F, gap=22)

body = [
"With reference to the above subject, we are hereby submitting the Half-Yearly Return of our",
"establishment, M/s DJ Hospitality & Facility Management Private Limited, for the half-year",
"period ending 30th June 2026, for your kind perusal and record.",
"",
"We request you to kindly acknowledge the receipt of the same. All particulars furnished in the",
"enclosed return are true and correct to the best of our knowledge and belief.",
]
for b in body:
    line(b, 11, F, gap=16)
line("", gap=6)
line("Kindly do the needful and oblige.", 11, F, gap=26)

line("Enclosures:", 11, FB, gap=16)
line("1. Half-Yearly Return in the prescribed form (Form ______)", 11, F, gap=15)
line("2. Copy of Licence / Registration Certificate", 11, F, gap=15)
line("3. Other supporting documents, if any", 11, F, gap=30)

line("Thanking you,", 11, F, gap=20)
line("Yours faithfully,", 11, F, gap=16)
line("For DJ Hospitality & Facility Management Private Limited", 11, FB, gap=55)
line("Authorised Signatory", 11, F, gap=15)
line("Name: ______________________", 11, F, gap=15)
line("Designation: ________________", 11, F, gap=15)

src.save('.agents/outputs/Half_Yearly_Return_Cover_Letter.pdf')
src[0].get_pixmap(matrix=fitz.Matrix(2,2)).save('.agents/outputs/cover_preview.png')
print("done, y end =", y)
