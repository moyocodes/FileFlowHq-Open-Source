
import { PDFArray, PDFDict, PDFName, PDFRef, PDFString, PDFHexString } from 'pdf-lib'

/*
 * pdf-lib's copyPages keeps web links (URI actions) intact, but an internal
 * "jump to page N" link still points at the *source* page, which gets copied
 * as a detached, invisible page — so the link goes nowhere. These helpers
 * re-point every internal link at the matching page in the output, and drop
 * the jump (keeping the annotation harmless) when that page wasn't copied.
 */

/** The destination array of a link annotation: /Dest, or /A << /S /GoTo /D … >>. Named dests resolved via the catalog. */
function destOf(doc, annot) {
  const lookup = (v) => (v instanceof PDFRef ? doc.context.lookup(v) : v)
  let dest = lookup(annot.get(PDFName.of('Dest')))
  let holder = { dict: annot, key: 'Dest' }
  if (!dest) {
    const action = lookup(annot.get(PDFName.of('A')))
    if (!(action instanceof PDFDict)) return null
    const s = action.get(PDFName.of('S'))
    if (!(s instanceof PDFName) || s.asString() !== '/GoTo') return null
    dest = lookup(action.get(PDFName.of('D')))
    holder = { dict: action, key: 'D' }
  }
  if (dest instanceof PDFName || dest instanceof PDFString || dest instanceof PDFHexString) {
    dest = resolveNamedDest(doc, dest)
  } else if (dest instanceof PDFDict) {
    dest = lookup(dest.get(PDFName.of('D'))) // { D [...] } form
  }
  return dest instanceof PDFArray ? { dest, holder } : null
}

/** Look a named destination up in /Dests (PDF 1.1) or the /Names → /Dests name tree. */
function resolveNamedDest(doc, name) {
  const lookup = (v) => (v instanceof PDFRef ? doc.context.lookup(v) : v)
  const key = name instanceof PDFName ? name.asString().slice(1) : name.decodeText()
  const oldDests = lookup(doc.catalog.get(PDFName.of('Dests')))
  if (oldDests instanceof PDFDict) {
    const hit = lookup(oldDests.get(PDFName.of(key)))
    if (hit) return hit instanceof PDFDict ? lookup(hit.get(PDFName.of('D'))) : hit
  }
  const names = lookup(doc.catalog.get(PDFName.of('Names')))
  const tree = names instanceof PDFDict ? lookup(names.get(PDFName.of('Dests'))) : null
  const walk = (node, depth = 0) => {
    if (!(node instanceof PDFDict) || depth > 32) return null
    const leaf = lookup(node.get(PDFName.of('Names')))
    if (leaf instanceof PDFArray) {
      for (let i = 0; i + 1 < leaf.size(); i += 2) {
        const k = lookup(leaf.get(i))
        if ((k instanceof PDFString || k instanceof PDFHexString) && k.decodeText() === key) {
          const v = lookup(leaf.get(i + 1))
          return v instanceof PDFDict ? lookup(v.get(PDFName.of('D'))) : v
        }
      }
    }
    const kids = lookup(node.get(PDFName.of('Kids')))
    if (kids instanceof PDFArray) {
      for (let i = 0; i < kids.size(); i++) {
        const found = walk(lookup(kids.get(i)), depth + 1)
        if (found) return found
      }
    }
    return null
  }
  return walk(tree)
}

/**
 * After `copied = await outDoc.copyPages(srcDoc, srcIndices)`, fix internal
 * links on the copied pages so they target the copied pages.
 */
export function remapInternalLinks(srcDoc, srcIndices, copied) {
  const srcRefs = srcDoc.getPages().map((p) => p.ref)
  const outIndexOfSrc = new Map(srcIndices.map((srcIdx, k) => [srcIdx, k]))

  srcIndices.forEach((srcIdx, k) => {
    const srcAnnots = srcDoc.getPage(srcIdx).node.Annots()
    const outAnnots = copied[k].node.Annots()
    if (!srcAnnots || !outAnnots) return
    const n = Math.min(srcAnnots.size(), outAnnots.size())
    for (let j = 0; j < n; j++) {
      const srcAnnot = srcDoc.context.lookup(srcAnnots.get(j))
      const outAnnot = copied[k].doc.context.lookup(outAnnots.get(j))
      if (!(srcAnnot instanceof PDFDict) || !(outAnnot instanceof PDFDict)) continue
      const sub = srcAnnot.get(PDFName.of('Subtype'))
      if (!(sub instanceof PDFName) || sub.asString() !== '/Link') continue

      const src = destOf(srcDoc, srcAnnot)
      if (!src) continue // a web link or other action: copyPages already kept it
      const target = src.dest.get(0)
      const targetSrcIdx = target instanceof PDFRef ? srcRefs.findIndex((r) => r === target || r.toString() === target.toString()) : -1
      const outIdx = outIndexOfSrc.get(targetSrcIdx)

      // Rebuild the destination on the output annotation as a direct /Dest.
      outAnnot.delete(PDFName.of('A'))
      if (outIdx == null) {
        outAnnot.delete(PDFName.of('Dest')) // target page not in this output
        continue
      }
      const rest = []
      for (let i = 1; i < src.dest.size(); i++) rest.push(src.dest.get(i))
      outAnnot.set(PDFName.of('Dest'), copied[k].doc.context.obj([copied[outIdx].ref, ...rest]))
    }
  })
}
