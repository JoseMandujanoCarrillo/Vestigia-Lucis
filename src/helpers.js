export function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function parseMultiline(text) {
  return String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf(":");
    if (separator < 0) return { title: "Milagro", description: line };
    return { title: line.slice(0, separator).trim() || "Milagro", description: line.slice(separator + 1).trim() };
  }).filter((item) => item.description);
}

export function parseTags(text) {
  return [...new Set(String(text || "").split(",").map((tag) => tag.trim()).filter(Boolean))];
}

export function validYouTubeUrl(value) {
  return !value || /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(value);
}
