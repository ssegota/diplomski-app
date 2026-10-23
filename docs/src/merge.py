import sys
from pypdf import PdfReader, PdfWriter
out, title = sys.argv[1], sys.argv[2]
w = PdfWriter()
for part in (out + '.cover.pdf', out + '.body.pdf'):
    for pg in PdfReader(part).pages: w.add_page(pg)
w.add_metadata({'/Title': title, '/Author': 'Sandi Baressi Šegota', '/Subject': 'Završni i diplomski radovi – FIPU'})
with open(out, 'wb') as f: w.write(f)
print(out, len(w.pages), 'str.')
