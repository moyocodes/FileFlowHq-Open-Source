# fileflowhq

Add ready-made, **private** file tools to your React app with one command. Like [shadcn/ui](https://ui.shadcn.com), the components are **copied into your project**: you own the code and can edit it freely. The file work is done in the user's browser by [`@fileflowhq/tools`](https://www.npmjs.com/package/@fileflowhq/tools), so nothing is uploaded.

```bash
npx fileflowhq add compress-image
```

## Components

| Name | What it does |
| --- | --- |
| `compress-image` | Compress an image to a target size (e.g. 100 KB) |
| `convert-image` | Convert images to JPEG, PNG, WebP or AVIF (HEIC in) |
| `merge-pdf` | Merge PDFs in a chosen order |
| `split-pdf` | Extract a page range or split every page |
| `pdf-to-images` | Turn PDF pages into PNG or JPEG images |
| `images-to-pdf` | Combine images into one PDF |
| `csv-json` | Convert CSV to JSON and back |

## Step by step

1. **Open a React project.** Vite, Next.js, Remix and Create React App all work. It should use Tailwind CSS, since the components are styled with Tailwind classes.
2. **Add the components you want:**
   ```bash
   npx fileflowhq add compress-image merge-pdf
   ```
   This:
   - copies the files into `src/components/fileflowhq/` (or `components/fileflowhq/` if there's no `src`)
   - writes `.tsx` if your project has a `tsconfig.json`, otherwise `.jsx`
   - installs `@fileflowhq/tools` with your package manager (npm, pnpm, yarn or bun)
3. **Use them:**
   ```jsx
   import { CompressImage } from './components/fileflowhq/compress-image'
   import { MergePdf } from './components/fileflowhq/merge-pdf'

   export default function Page() {
     return (
       <>
         <CompressImage />
         <MergePdf />
       </>
     )
   }
   ```
4. **Change anything.** The files are now yours: restyle them, rename things, translate the text.

No other setup is needed. That includes `pdf-to-images`, because the PDF worker is bundled in `@fileflowhq/tools`.

## Commands

```bash
npx fileflowhq list                        # show every component
npx fileflowhq add <name...>               # add components
npx fileflowhq add --all                   # add all of them
npx fileflowhq add merge-pdf --overwrite   # replace a file you changed with the original
npx fileflowhq add csv-json --path app/ui  # choose the folder
npx fileflowhq add csv-json --js           # .jsx even in a TypeScript project
npx fileflowhq add csv-json --no-install   # don't install @fileflowhq/tools
```

Existing files are never overwritten unless you pass `--overwrite`.

## Next.js

Every component starts with `'use client'`, so you can use them straight from the App Router.

## Don't use React or Tailwind?

Use [`@fileflowhq/tools`](https://www.npmjs.com/package/@fileflowhq/tools) directly. It's framework-free JavaScript, and there's a [live playground](https://fileflowhq.com/playground).

## License

MIT © James Moyosore (FileFlowHQ)
