import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PDFDocument, degrees } from 'pdf-lib'

import { extractPdfPages, mergePdfs, rotatePdf } from '../src/app/lib/pdf-tools'
import { formatBytes, outputName, parsePageSelection, pdfFileKind } from '../src/shared/pdf'

async function samplePdf(pageCount: number): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([300, 400])
  }
  return document.save()
}

test('parses page ranges, ignores duplicates, and defaults to every page', () => {
  assert.deepEqual(parsePageSelection('', 4), [1, 2, 3, 4])
  assert.deepEqual(parsePageSelection('1-2, 2, 4', 4), [1, 2, 4])
  assert.deepEqual(parsePageSelection('3', 4), [3])
})

test('rejects malformed, reversed, and out-of-range page selections', () => {
  assert.throws(() => parsePageSelection('1,,2', 4), /page/i)
  assert.throws(() => parsePageSelection('3-1', 4), /page/i)
  assert.throws(() => parsePageSelection('5', 4), /page/i)
  assert.throws(() => parsePageSelection('0', 4), /page/i)
})

test('names outputs without dropping the source name or duplicating the extension', () => {
  assert.equal(outputName('Quarterly Report.PDF', 'merged'), 'Quarterly Report-merged.pdf')
  assert.equal(outputName('notes.txt', 'converted', 'pdf'), 'notes-converted.pdf')
  assert.equal(outputName('   ', 'result'), 'result.pdf')
})

test('formats sizes and recognises files the studio can convert', () => {
  assert.equal(formatBytes(900), '900 B')
  assert.equal(formatBytes(1_500), '1.5 KB')
  assert.equal(formatBytes(2_000_000), '1.9 MB')
  assert.equal(pdfFileKind('Report.PDF'), 'pdf')
  assert.equal(pdfFileKind('letter.docx'), 'docx')
  assert.equal(pdfFileKind('data.xlsx'), 'sheet')
  assert.equal(pdfFileKind('photo.png'), 'other')
})

test('merges PDFs in the order they were selected', async () => {
  const merged = await mergePdfs([await samplePdf(2), await samplePdf(3)])
  const document = await PDFDocument.load(merged)
  assert.equal(document.getPageCount(), 5)
})

test('extracts only the requested one-based pages', async () => {
  const extracted = await extractPdfPages(await samplePdf(5), [2, 4])
  const document = await PDFDocument.load(extracted)
  assert.equal(document.getPageCount(), 2)
  assert.deepEqual(document.getPages().map((page) => page.getSize().width), [300, 300])
})

test('adds rotation to the selected pages without changing the others', async () => {
  const rotated = await rotatePdf(await samplePdf(3), [2], 90)
  const document = await PDFDocument.load(rotated)
  assert.deepEqual(document.getPages().map((page) => page.getRotation().angle), [0, 90, 0])
  assert.equal(degrees(90).angle, 90)
})
