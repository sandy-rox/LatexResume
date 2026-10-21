const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const Handlebars = require("handlebars");

const projectRoot = path.resolve(__dirname, "..");
const dataFile = path.join(projectRoot, "data", "resume.json");
const variantsDir = path.join(projectRoot, "data", "variants");
const templateFile = path.join(projectRoot, "templates", "resume.tex.hbs");
const buildDir = path.join(projectRoot, "build");
const texOutput = path.join(buildDir, "resume.tex");
const pdfOutput = path.join(buildDir, "resume.pdf");
const latexCompilers = [
  {
    command: "pdflatex",
    args: ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", buildDir, texOutput],
  },
  {
    command: "xelatex",
    args: ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", buildDir, texOutput],
  },
  {
    command: "lualatex",
    args: ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", buildDir, texOutput],
  },
  {
    command: "tectonic",
    args: ["--keep-logs", "--outdir", buildDir, texOutput],
  },
];

function escapeLatex(value) {
  return String(value)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}#$%&_])/g, "\\$1")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}");
}

function formatDisplayUrl(value) {
  return String(value ?? "")
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/$/, "");
}

function buildPdfFileName({ name, title }) {
  const firstName = String(name ?? "").trim().split(/\s+/)[0];
  const baseName = [firstName, title]
    .filter(Boolean)
    .join(" ")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${baseName || "resume"}.pdf`;
}

function getVariantName(argv) {
  const index = argv.findIndex((arg) => arg === "--variant" || arg.startsWith("--variant="));
  if (index === -1) {
    return null;
  }

  const variant = argv[index].includes("=") ? argv[index].split("=")[1] : argv[index + 1];
  if (!variant || variant.startsWith("--")) {
    throw new Error("Missing variant name. Usage: --variant <name>");
  }

  return variant;
}

async function loadResumeData(variant) {
  const baseData = JSON.parse(await fs.readFile(dataFile, "utf8"));
  if (!variant) {
    return baseData;
  }

  const variantFile = path.join(variantsDir, `${variant}.json`);
  let variantSource;
  try {
    variantSource = await fs.readFile(variantFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Variant not found: ${path.relative(projectRoot, variantFile)}`);
    }
    throw error;
  }

  // Variant files override top-level fields of resume.json (e.g. title, headline, summary, skills, experience).
  return { ...baseData, ...JSON.parse(variantSource) };
}

function findLatexCompiler() {
  for (const compiler of latexCompilers) {
    const result = spawnSync(compiler.command, ["--version"], { stdio: "ignore" });
    if (!result.error && result.status === 0) {
      return compiler;
    }
  }

  return null;
}

function compileLatex(compiler) {
  return new Promise((resolve, reject) => {
    const child = spawn(compiler.command, compiler.args, { cwd: projectRoot, stdio: "inherit" });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${compiler.command} exited with code ${code}`));
    });
  });
}

async function main() {
  const shouldCompilePdf = process.argv.includes("--pdf");

  const variant = getVariantName(process.argv);
  const [templateSource, resumeData] = await Promise.all([
    fs.readFile(templateFile, "utf8"),
    loadResumeData(variant),
  ]);

  Handlebars.registerHelper("latex", (value) => escapeLatex(value ?? ""));
  Handlebars.registerHelper("url", (value) => `{\\detokenize{${String(value ?? "")}}}`);
  Handlebars.registerHelper("mailto", (value) => `{\\detokenize{mailto:${String(value ?? "")}}}`);
  Handlebars.registerHelper("tel", (value) => `{tel:${String(value ?? "").replace(/[^\d+]/g, "")}}`);
  Handlebars.registerHelper("whatsapp", (value) => `{https://wa.me/${String(value ?? "").replace(/\D/g, "")}}`);
  Handlebars.registerHelper("linktext", (value) => escapeLatex(formatDisplayUrl(value)));

  const template = Handlebars.compile(templateSource, { noEscape: true });
  const renderedLatex = template(resumeData).replace(/\n{3,}/g, "\n\n");

  await fs.mkdir(buildDir, { recursive: true });
  await fs.writeFile(texOutput, renderedLatex);

  console.log(`Generated ${path.relative(projectRoot, texOutput)}${variant ? ` (variant: ${variant})` : ""}`);

  if (!shouldCompilePdf) {
    console.log("Skipping PDF compilation. Run `npm run pdf` after installing a LaTeX compiler.");
    return;
  }

  const compiler = findLatexCompiler();
  if (!compiler) {
    console.error("No LaTeX compiler found. Install `pdflatex`, `xelatex`, `lualatex`, or `tectonic` and try again.");
    process.exitCode = 1;
    return;
  }

  await compileLatex(compiler);

  const namedPdfOutput = path.join(buildDir, buildPdfFileName(resumeData));
  await fs.rename(pdfOutput, namedPdfOutput);
  console.log(`Generated ${path.relative(projectRoot, namedPdfOutput)} using ${compiler.command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
