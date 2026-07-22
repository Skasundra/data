const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const archiver = require("archiver");

// ─── Logger ──────────────────────────────────────────────────────────────────
const log = {
  info: (...a) => console.log(`[${new Date().toISOString()}] [CSV] [INFO] `, ...a),
  error: (...a) => console.error(`[${new Date().toISOString()}] [CSV] [ERROR]`, ...a),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Flatten a nested object into dot-notation keys.
 * e.g. { a: { b: 1 } } => { "a.b": 1 }
 */
const flattenObject = (obj, prefix = "", result = {}) => {
  if (obj === null || obj === undefined) return result;
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      flattenObject(value, fullKey, result);
    } else if (Array.isArray(value)) {
      result[fullKey] = value.join("; ");
    } else {
      result[fullKey] = value;
    }
  }
  return result;
};

/**
 * Escape a CSV field value
 */
const escapeCsvField = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Detect whether a field name represents a phone number column.
 */
const isPhoneField = (field) => {
  const f = String(field).toLowerCase();
  return f === "phone" || f.endsWith(".phone") || f.includes("phone") || f.includes("mobile") || f.includes("contact");
};

/**
 * Normalize a phone number to consistent 91XXXXXXXXXX format.
 * Rules:
 *  - +91...  → strip the "+"  (becomes 91...)
 *  - starts with 0 → remove leading zero(s), prepend 91
 *  - already starts with 91 → unchanged
 *  - plain 10-digit → prepend 91
 * Applied ONLY at export time; stored data is never mutated.
 */
const formatPhoneNumber = (value) => {
  if (value === null || value === undefined) return value;
  const original = String(value).trim();
  if (original === "" || original.toUpperCase() === "N/A") return original;

  // Strip everything except digits (this also removes spaces, +, -, () etc.)
  let digits = original.replace(/\D/g, "");
  if (!digits) return original; // nothing numeric — return as-is

  // Already in 91XXXXXXXXXX form (12 digits starting with 91)
  if (digits.startsWith("91") && digits.length >= 12) {
    return digits;
  }

  // Starts with leading zero(s) → strip them, then prepend 91
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
    return "91" + digits;
  }

  // Plain 10-digit Indian number → prepend 91
  if (digits.length === 10) {
    return "91" + digits;
  }

  // Already starts with 91 (shorter/odd length) → keep as-is
  if (digits.startsWith("91")) {
    return digits;
  }

  // Fallback → prepend 91 for consistency
  return "91" + digits;
};

/**
 * Sanitize a string for use as a filename or worksheet name.
 */
const sanitizeName = (name, maxLen = 100) => {
  return String(name || "untitled")
    .replace(/[\\/:*?"<>|]/g, "_") // illegal filename/sheet chars
    .replace(/\s+/g, "_")
    .slice(0, maxLen) || "untitled";
};

/**
 * Excel worksheet names: max 31 chars, no special chars.
 */
const sanitizeSheetName = (name) => {
  return String(name || "Sheet")
    .replace(/[\\/:*?[\]]/g, "_")
    .slice(0, 31) || "Sheet";
};

/**
 * Build a CSV string from records + selected fields.
 * Phone fields are wrapped in ="value" to prevent Excel scientific notation.
 */
const buildCsvString = (records, exportFields) => {
  // Precompute which fields are phone fields
  const phoneFields = new Set(exportFields.filter(isPhoneField));

  let csv = exportFields.map(escapeCsvField).join(",") + "\n";
  const CHUNK_SIZE = 500;
  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    for (const record of chunk) {
      const flat = flattenObject(record);
      csv += exportFields.map((field) => {
        let val = flat[field];
        if (phoneFields.has(field)) {
          val = formatPhoneNumber(val);
          // Wrap in ="value" so Excel treats it as text, not a number
          if (val !== null && val !== undefined && String(val).trim() !== "" && String(val).toUpperCase() !== "N/A") {
            return `="${String(val)}"`;
          }
        }
        return escapeCsvField(val);
      }).join(",") + "\n";
    }
  }
  return csv;
};

/**
 * Build an array-of-arrays (AOA) for an Excel worksheet.
 * Returns { aoa, phoneColumnIndices } so the caller can apply text formatting.
 */
const buildAoa = (records, exportFields) => {
  const phoneFields = new Set(exportFields.filter(isPhoneField));
  const phoneColumnIndices = [];
  exportFields.forEach((f, i) => { if (phoneFields.has(f)) phoneColumnIndices.push(i); });

  const aoa = [exportFields];
  for (const record of records) {
    const flat = flattenObject(record);
    aoa.push(exportFields.map((field) => {
      let v = flat[field];
      if (phoneFields.has(field)) {
        v = formatPhoneNumber(v);
        // Ensure the value is a string so XLSX doesn't store it as a number
        if (v !== null && v !== undefined) return String(v);
      }
      return v === null || v === undefined ? "" : v;
    }));
  }
  return { aoa, phoneColumnIndices };
};

/**
 * Apply the non-empty filter on a record set.
 */
const applyRequiredFilter = (records, requiredFields) => {
  if (!requiredFields || requiredFields.length === 0) return records;
  return records.filter((record) => {
    const flat = flattenObject(record);
    return requiredFields.every((field) => {
      const val = flat[field];
      if (val === null || val === undefined) return false;
      const str = String(val).trim();
      if (str === "" || str === "N/A" || str === "null" || str === "undefined") return false;
      return true;
    });
  });
};

/**
 * Group records by a key function.
 * Returns a Map of groupKey -> records[].
 */
const groupRecords = (records, keyFn) => {
  const groups = new Map();
  for (const record of records) {
    const key = keyFn(record) || "Unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return groups;
};

/**
 * Parse the googlemaps_scraped_data.json structure.
 * Structure: { location: { keyword: [ ...businesses ] } }
 * Returns: { records, cities, categories }
 */
const parseGmapsStructure = (data) => {
  const records = [];
  const cities = new Set();
  const categories = new Set();

  for (const [city, keywords] of Object.entries(data)) {
    cities.add(city);
    if (typeof keywords === "object" && !Array.isArray(keywords)) {
      for (const [keyword, businesses] of Object.entries(keywords)) {
        categories.add(keyword);
        if (Array.isArray(businesses)) {
          for (const biz of businesses) {
            records.push({ _city: city, _category: keyword, ...biz });
          }
        }
      }
    }
  }

  return {
    records,
    cities: [...cities].sort(),
    categories: [...categories].sort(),
  };
};

/**
 * Parse any JSON structure into a flat array of records.
 * Handles: arrays, nested city/category structures, single objects.
 */
const parseJsonToRecords = (data) => {
  // Case 1: Array at top level
  if (Array.isArray(data)) {
    return { records: data, cities: [], categories: [], isGmapsFormat: false };
  }

  // Case 2: Google Maps scraped data format (city -> keyword -> array)
  // Detect by checking if values are objects whose values are arrays
  const topKeys = Object.keys(data);
  if (topKeys.length > 0) {
    const firstVal = data[topKeys[0]];
    if (firstVal && typeof firstVal === "object" && !Array.isArray(firstVal)) {
      const innerKeys = Object.keys(firstVal);
      if (innerKeys.length > 0 && Array.isArray(firstVal[innerKeys[0]])) {
        const parsed = parseGmapsStructure(data);
        return { ...parsed, isGmapsFormat: true };
      }
    }
  }

  // Case 3: Single object — wrap in array
  return { records: [data], cities: [], categories: [], isGmapsFormat: false };
};

/**
 * Detect all unique fields from an array of records (flattened).
 */
const detectFields = (records, sampleSize = 100) => {
  const fields = new Set();
  const sample = records.slice(0, sampleSize);
  for (const record of sample) {
    const flat = flattenObject(record);
    for (const key of Object.keys(flat)) {
      fields.add(key);
    }
  }
  return [...fields].sort();
};

// ─── API Handlers ────────────────────────────────────────────────────────────

/**
 * POST /json-to-csv/parse
 * Body: { filePath } (path to a JSON file on server) OR multipart file upload
 * Returns: { fields, cities, categories, totalRecords, isGmapsFormat, sampleData }
 */
const parseJsonFile = async (req, res) => {
  try {
    let jsonData;

    if (req.file) {
      // Uploaded file
      const filePath = req.file.path;
      const content = fs.readFileSync(filePath, "utf8");
      jsonData = JSON.parse(content);
      // Clean up uploaded file after parsing
      fs.unlinkSync(filePath);
    } else if (req.body.filePath) {
      // Server-side file path
      const filePath = path.resolve(req.body.filePath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ status: 404, message: "File not found" });
      }
      const content = fs.readFileSync(filePath, "utf8");
      jsonData = JSON.parse(content);
    } else if (req.body.jsonContent) {
      // Direct JSON content (for small payloads)
      jsonData = typeof req.body.jsonContent === "string"
        ? JSON.parse(req.body.jsonContent)
        : req.body.jsonContent;
    } else {
      return res.status(400).json({ status: 400, message: "Provide filePath, jsonContent, or upload a file" });
    }

    const { records, cities, categories, isGmapsFormat } = parseJsonToRecords(jsonData);
    const fields = detectFields(records);

    // Extract unique values for all fields (performance optimized)
    const uniqueValues = {};
    for (const field of fields) {
      const vals = new Set();
      for (const r of records) {
        const flat = flattenObject(r);
        const val = flat[field];
        if (val !== null && val !== undefined) {
          const str = String(val).trim();
          if (str !== "" && str.toUpperCase() !== "N/A") {
            vals.add(str);
          }
        }
      }
      uniqueValues[field] = [...vals].sort();
    }

    // Return sample data (first 5 records flattened)
    const sampleData = records.slice(0, 5).map((r) => flattenObject(r));

    log.info(`Parsed JSON: ${records.length} records, ${fields.length} fields, gmaps=${isGmapsFormat}`);

    return res.json({
      status: 200,
      message: "JSON parsed successfully",
      data: {
        fields,
        cities,
        categories,
        totalRecords: records.length,
        isGmapsFormat,
        sampleData,
        uniqueValues,
      },
    });
  } catch (error) {
    log.error("parseJsonFile failed:", error.message);
    if (error instanceof SyntaxError) {
      return res.status(400).json({ status: 400, message: "Invalid JSON format: " + error.message });
    }
    return res.status(500).json({ status: 500, message: "Failed to parse JSON file", error: error.message });
  }
};

/**
 * POST /json-to-csv/convert
 * Body: {
 *   filePath? | jsonContent?,
 *   selectedFields[],
 *   filterCity?, filterCategory?,
 *   allowEmpty[],
 *   exportMode: "single" | "city" | "category" | "city-category",
 *   outputFormat: "csv" | "excel"   (csv => zip when multiple groups)
 * }
 * Returns: CSV / Excel / ZIP file download
 */
const convertJsonToCsv = async (req, res) => {
  try {
    const {
      selectedFields,
      filterCity,
      filterCategory,
      requireNonEmpty,
      exportMode = "single",
      outputFormat = "csv",
      deduplicateFields,
      fieldFilters,
    } = req.body;

    log.info(`Convert — mode=${exportMode}, format=${outputFormat}, city=${filterCity}, category=${filterCategory}, deduplicateFields=${JSON.stringify(deduplicateFields)}, fieldFilters=${JSON.stringify(fieldFilters)}`);

    let jsonData;
    if (req.file) {
      const filePath = req.file.path;
      jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      fs.unlinkSync(filePath);
    } else if (req.body.filePath) {
      const filePath = path.resolve(req.body.filePath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ status: 404, message: "File not found" });
      }
      jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } else if (req.body.jsonContent) {
      jsonData = typeof req.body.jsonContent === "string"
        ? JSON.parse(req.body.jsonContent)
        : req.body.jsonContent;
    } else {
      return res.status(400).json({ status: 400, message: "Provide filePath, jsonContent, or upload a file" });
    }

    let { records, isGmapsFormat } = parseJsonToRecords(jsonData);

    // ── Apply city/category pre-filters ──
    if (isGmapsFormat) {
      if (filterCity) records = records.filter((r) => r._city === filterCity);
      if (filterCategory) records = records.filter((r) => r._category === filterCategory);
    }

    // ── Apply dynamic field filters ──
    if (fieldFilters && typeof fieldFilters === "object") {
      for (const [field, filterVals] of Object.entries(fieldFilters)) {
        if (Array.isArray(filterVals) && filterVals.length > 0) {
          records = records.filter((r) => {
            const flat = flattenObject(r);
            const val = flat[field];
            if (val === null || val === undefined) return false;
            return filterVals.some(
              (fv) => String(val).trim().toLowerCase() === String(fv).trim().toLowerCase()
            );
          });
        }
      }
    }

    if (records.length === 0) {
      return res.status(404).json({ status: 404, message: "No records match the filter criteria" });
    }

    // ── Determine export fields ──
    const allFields = detectFields(records);
    const fieldsToExport = selectedFields && selectedFields.length > 0
      ? selectedFields.filter((f) => allFields.includes(f))
      : allFields;
    const exportFields = fieldsToExport.filter((f) => !f.startsWith("_") || selectedFields?.includes(f));

    if (exportFields.length === 0) {
      return res.status(400).json({ status: 400, message: "No valid fields selected for export" });
    }

    // ── Required (non-empty) fields ──
    const allowEmpty = req.body.allowEmpty && Array.isArray(req.body.allowEmpty) ? req.body.allowEmpty : [];
    let requiredFields;
    if (requireNonEmpty && Array.isArray(requireNonEmpty) && requireNonEmpty.length > 0) {
      requiredFields = requireNonEmpty;
    } else if (selectedFields && selectedFields.length > 0) {
      requiredFields = selectedFields.filter((f) => !allowEmpty.includes(f) && !f.startsWith("_"));
    } else {
      requiredFields = [];
    }

    const filteredRecords = applyRequiredFilter(records, requiredFields);
    log.info(`Filtered: ${records.length} → ${filteredRecords.length} records`);

    if (filteredRecords.length === 0) {
      return res.status(404).json({
        status: 404,
        message: `No records have non-empty values for: ${requiredFields.join(", ")}`,
      });
    }

    // ── Deduplicate records if requested ──
    let finalRecords = filteredRecords;
    if (deduplicateFields && Array.isArray(deduplicateFields) && deduplicateFields.length > 0) {
      const seen = new Set();
      finalRecords = [];
      for (const record of filteredRecords) {
        const flat = flattenObject(record);
        // Construct composite key based on selected deduplicateFields
        const compositeKey = deduplicateFields.map((field) => {
          let val = flat[field];
          if (isPhoneField(field)) val = formatPhoneNumber(val);
          return val === null || val === undefined ? "" : String(val).trim().toLowerCase();
        }).join("|");

        if (!seen.has(compositeKey)) {
          seen.add(compositeKey);
          finalRecords.push(record);
        }
      }
      log.info(`Deduplicated: ${filteredRecords.length} → ${finalRecords.length} records using keys: [${deduplicateFields.join(", ")}]`);
    }

    if (finalRecords.length === 0) {
      return res.status(404).json({
        status: 404,
        message: `No records match the filter criteria after deduplication`,
      });
    }

    // ── Build groups based on export mode ──
    // Each group: { name, records }
    let groups = [];
    if (exportMode === "single" || !isGmapsFormat) {
      groups = [{ name: "all_data", records: finalRecords }];
    } else if (exportMode === "city") {
      const map = groupRecords(finalRecords, (r) => r._city);
      groups = [...map.entries()].map(([name, recs]) => ({ name, records: recs }));
    } else if (exportMode === "category") {
      const map = groupRecords(finalRecords, (r) => r._category);
      groups = [...map.entries()].map(([name, recs]) => ({ name, records: recs }));
    } else if (exportMode === "city-category") {
      const map = groupRecords(finalRecords, (r) => `${r._city} - ${r._category}`);
      groups = [...map.entries()].map(([name, recs]) => ({ name, records: recs }));
    } else {
      groups = [{ name: "all_data", records: finalRecords }];
    }

    // Sort groups by name for predictable output
    groups.sort((a, b) => a.name.localeCompare(b.name));
    log.info(`Export groups: ${groups.length} (mode=${exportMode})`);

    const timestamp = Date.now();

    // ── OUTPUT: Single Excel workbook with one sheet per group ──
    if (outputFormat === "excel") {
      const wb = XLSX.utils.book_new();
      const usedSheetNames = new Set();

      for (const group of groups) {
        let sheetName = sanitizeSheetName(group.name);
        // Ensure unique sheet names
        let suffix = 1;
        let uniqueName = sheetName;
        while (usedSheetNames.has(uniqueName)) {
          const base = sheetName.slice(0, 28);
          uniqueName = `${base}_${suffix++}`;
        }
        usedSheetNames.add(uniqueName);

        const { aoa, phoneColumnIndices } = buildAoa(group.records, exportFields);
        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // Force phone columns to text format so Excel doesn't show scientific notation
        if (phoneColumnIndices.length > 0 && ws['!ref']) {
          const range = XLSX.utils.decode_range(ws['!ref']);
          for (const colIdx of phoneColumnIndices) {
            for (let row = range.s.r + 1; row <= range.e.r; row++) {
              const cellAddr = XLSX.utils.encode_cell({ r: row, c: colIdx });
              const cell = ws[cellAddr];
              if (cell) {
                cell.t = 's'; // force string type
                cell.z = '@'; // text number format
                cell.v = String(cell.v);
              }
            }
          }
        }

        XLSX.utils.book_append_sheet(wb, ws, uniqueName);
      }

      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
      const filename = `export_${exportMode}_${timestamp}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-Total-Records", finalRecords.length);
      res.setHeader("X-Total-Sheets", groups.length);
      log.info(`Excel generated: ${groups.length} sheets, ${finalRecords.length} records`);
      return res.send(buffer);
    }

    // ── OUTPUT: CSV ──
    // Single group → single CSV file
    if (groups.length === 1) {
      const csv = buildCsvString(groups[0].records, exportFields);
      const filename = `export_${sanitizeName(groups[0].name)}_${timestamp}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-Total-Records", groups[0].records.length);
      res.setHeader("X-Total-Fields", exportFields.length);
      log.info(`CSV generated: ${groups[0].records.length} records`);
      return res.send("\uFEFF" + csv);
    }

    // Multiple groups → ZIP of CSV files
    const filename = `export_${exportMode}_${timestamp}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Total-Records", finalRecords.length);
    res.setHeader("X-Total-Files", groups.length);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      log.error("Archive error:", err.message);
      if (!res.headersSent) res.status(500).json({ status: 500, message: err.message });
    });
    archive.pipe(res);

    const usedFileNames = new Set();
    for (const group of groups) {
      let csvFileName = sanitizeName(group.name) + ".csv";
      let suffix = 1;
      while (usedFileNames.has(csvFileName)) {
        csvFileName = `${sanitizeName(group.name)}_${suffix++}.csv`;
      }
      usedFileNames.add(csvFileName);

      const csv = "\uFEFF" + buildCsvString(group.records, exportFields);
      archive.append(csv, { name: csvFileName });
    }

    log.info(`ZIP generated: ${groups.length} CSV files, ${filteredRecords.length} records`);
    await archive.finalize();
    return;
  } catch (error) {
    log.error("convertJsonToCsv failed:", error.message);
    if (!res.headersSent) {
      return res.status(500).json({ status: 500, message: "Failed to convert", error: error.message });
    }
  }
};

/**
 * GET /json-to-csv/server-files
 * Returns list of JSON files available on server for conversion
 */
const listServerJsonFiles = (_req, res) => {
  try {
    const baseDir = path.resolve(__dirname);
    const files = fs.readdirSync(baseDir)
      .filter((f) => f.endsWith(".json") && !f.includes("node_modules") && !f.includes("package"))
      .map((f) => ({
        name: f,
        path: path.join(baseDir, f),
        size: fs.statSync(path.join(baseDir, f)).size,
        sizeFormatted: formatBytes(fs.statSync(path.join(baseDir, f)).size),
      }));

    return res.json({ status: 200, data: files });
  } catch (error) {
    return res.status(500).json({ status: 500, message: error.message });
  }
};

const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

module.exports = { parseJsonFile, convertJsonToCsv, listServerJsonFiles };
