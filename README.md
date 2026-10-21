# LaTeX Resume Builder

A small Node.js project that generates a resume in LaTeX from structured JSON data.

## Project structure

- `data/resume.json`: your resume content
- `templates/resume.tex.hbs`: the Handlebars LaTeX template
- `scripts/build-resume.js`: renders LaTeX and optionally compiles PDF
- `build/`: generated output

## Usage

Install dependencies:

```bash
npm install
```

Generate the LaTeX file:

```bash
npm run build
```

Generate the PDF:

```bash
npm run pdf
```

The PDF is saved as `build/<first name>_<title>.pdf`, built from the first word of `name` and the `title` field in `data/resume.json` (e.g. `Sandeep_Senior_Software_Engineer.pdf`).

### Role-specific variants

Files in `data/variants/<name>.json` override top-level fields of `data/resume.json` (for example `title`, `headline`, `summary`, `skills`, or `experience`). Build one with:

```bash
npm run pdf -- --variant backend
# or
npm run pdf:backend
npm run pdf:fullstack
```

Since the PDF name comes from the title, a variant with its own title gets its own file (e.g. `Sandeep_Senior_Backend_Engineer.pdf`).

Clean generated files:

```bash
npm run clean
```

## LaTeX compiler

The PDF step works with any of these commands:

- `pdflatex`
- `xelatex`
- `lualatex`
- `tectonic`

On macOS, `tectonic` is a lightweight option. MacTeX or BasicTeX also work.
