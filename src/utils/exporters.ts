import JSZip from "jszip";
import { Book } from "../types";

function escapeXml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeFileSlug(title: string): string {
  return (
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "Mi_Libro"
  );
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function exportBookAsEpub(book: Book): Promise<void> {
  const zip = new JSZip();
  const bookUuid = `urn:uuid:${sanitizeFileSlug(book.id)}-${Date.now()}`;
  const safeTitle = escapeXml(book.title || "Libro Sin Título");
  const safeAuthor = escapeXml(book.author || "Autor Independiente");
  const safeGenre = escapeXml(book.genre || "Literatura");
  const safeSynopsis = escapeXml(book.synopsis || "");

  // EPUB spec requires uncompressed mimetype as first entry
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  zip.file(
    "OEBPS/styles.css",
    `body { font-family: Georgia, serif; line-height: 1.7; margin: 5%; color: #1c1917; }
h1, h2 { font-family: Georgia, serif; text-align: center; font-weight: bold; }
h1 { font-size: 2em; margin-top: 2em; margin-bottom: 0.4em; }
.subtitle { text-align: center; font-style: italic; color: #57534e; margin-bottom: 1.5em; }
.author { text-align: center; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.9em; margin-bottom: 2.5em; }
h2.chapter-title { font-size: 1.45em; margin-top: 1.2em; margin-bottom: 1.2em; border-bottom: 1px solid #d6d3d1; padding-bottom: 0.4em; }
p { text-indent: 1.5em; margin: 0 0 0.8em 0; text-align: left; }
p.first { text-indent: 0; }
`
  );

  // Title page XHTML
  zip.file(
    "OEBPS/titlepage.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="es" lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${safeTitle}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>${safeTitle}</h1>
  ${book.subtitle ? `<p class="subtitle">${escapeXml(book.subtitle)}</p>` : ""}
  <p class="author">${safeAuthor}</p>
  ${safeSynopsis ? `<p class="first"><em>${safeSynopsis}</em></p>` : ""}
</body>
</html>`
  );

  const chapterItems: Array<{ id: string; href: string; title: string }> = [];

  book.chapters.forEach((ch, idx) => {
    const id = `chapter_${idx + 1}`;
    const href = `${id}.xhtml`;
    const title = ch.title || `Capítulo ${idx + 1}`;
    chapterItems.push({ id, href, title });

    const paragraphs = (ch.content || "")
      .split(/\n{2,}|\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    const pHtml =
      paragraphs.length > 0
        ? paragraphs
            .map(
              (p, pIdx) =>
                `<p class="${pIdx === 0 ? "first" : ""}">${escapeXml(p)}</p>`
            )
            .join("\n  ")
        : `<p class="first"></p>`;

    zip.file(
      `OEBPS/${href}`,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="es" lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h2 class="chapter-title">${escapeXml(title)}</h2>
  ${pHtml}
</body>
</html>`
    );
  });

  // EPUB 3 Navigation Document
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="es" lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Índice</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h2>Índice</h2>
    <ol>
      <li><a href="titlepage.xhtml">Portada</a></li>
      ${chapterItems
        .map((c) => `<li><a href="${c.href}">${escapeXml(c.title)}</a></li>`)
        .join("\n      ")}
    </ol>
  </nav>
</body>
</html>`
  );

  // Legacy NCX for Kindle/older readers
  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookUuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${safeTitle}</text></docTitle>
  <navMap>
    <navPoint id="navPoint-0" playOrder="1">
      <navLabel><text>Portada</text></navLabel>
      <content src="titlepage.xhtml"/>
    </navPoint>
    ${chapterItems
      .map(
        (c, i) => `<navPoint id="navPoint-${i + 1}" playOrder="${i + 2}">
      <navLabel><text>${escapeXml(c.title)}</text></navLabel>
      <content src="${c.href}"/>
    </navPoint>`
      )
      .join("\n    ")}
  </navMap>
</ncx>`
  );

  // Package OPF
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId" xml:lang="es">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${bookUuid}</dc:identifier>
    <dc:title>${safeTitle}</dc:title>
    <dc:creator>${safeAuthor}</dc:creator>
    <dc:language>es</dc:language>
    <dc:subject>${safeGenre}</dc:subject>
    <dc:description>${safeSynopsis}</dc:description>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="styles.css" media-type="text/css"/>
    <item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>
    ${chapterItems
      .map(
        (c) =>
          `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`
      )
      .join("\n    ")}
  </manifest>
  <spine toc="ncx">
    <itemref idref="titlepage"/>
    ${chapterItems.map((c) => `<itemref idref="${c.id}"/>`).join("\n    ")}
  </spine>
</package>`
  );

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
  });
  triggerDownload(blob, `${sanitizeFileSlug(book.title)}.epub`);
}

export async function exportBookAsDocx(book: Book): Promise<void> {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/>
      <w:sz w:val="24"/>
    </w:rPr>
    <w:pPr>
      <w:spacing w:after="160" w:line="320" w:lineRule="auto"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="1440" w:after="240"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="52"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="480" w:after="240"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="34"/></w:rPr>
  </w:style>
</w:styles>`
  );

  const paragraphsXml: string[] = [];

  paragraphsXml.push(
    `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${escapeXml(
      book.title || "Libro Sin Título"
    )}</w:t></w:r></w:p>`
  );

  if (book.subtitle) {
    paragraphsXml.push(
      `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t>${escapeXml(
        book.subtitle
      )}</w:t></w:r></w:p>`
    );
  }

  if (book.author) {
    paragraphsXml.push(
      `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="480"/></w:pPr><w:r><w:t>Por: ${escapeXml(
        book.author
      )}</w:t></w:r></w:p>`
    );
  }

  if (book.synopsis) {
    paragraphsXml.push(
      `<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>${escapeXml(
        book.synopsis
      )}</w:t></w:r></w:p>`
    );
  }

  book.chapters.forEach((ch, idx) => {
    paragraphsXml.push(
      `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`
    );
    paragraphsXml.push(
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escapeXml(
        ch.title || `Capítulo ${idx + 1}`
      )}</w:t></w:r></w:p>`
    );

    const blocks = (ch.content || "")
      .split(/\n{2,}|\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    blocks.forEach((b) => {
      paragraphsXml.push(
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(b)}</w:t></w:r></w:p>`
      );
    });
  });

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphsXml.join("\n    ")}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`
  );

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  triggerDownload(blob, `${sanitizeFileSlug(book.title)}.docx`);
}
