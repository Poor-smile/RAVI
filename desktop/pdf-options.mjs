const PDF_MARGIN_INCHES = 0.55;

export function desktopPdfOptions(landscape = false) {
  return {
    pageSize: "A4",
    landscape: landscape === true,
    displayHeaderFooter: false,
    printBackground: true,
    preferCSSPageSize: true,
    margins: {
      top: PDF_MARGIN_INCHES,
      bottom: PDF_MARGIN_INCHES,
      left: PDF_MARGIN_INCHES,
      right: PDF_MARGIN_INCHES,
    },
  };
}
