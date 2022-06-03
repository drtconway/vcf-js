export interface VCFMeta {
  INFO: { [key: string]: VCFMetaInfo };
  FILTER: { [key: string]: VCFMetaFilter };
  FORMAT: { [key: string]: VCFMetaFormat };
  sample_ids?: string[];
  extra: {
    structured: { [metaKey: string]: { [keyID: string]: { [key: string]: string | number } } };
    unstructured: { [key: string]: string[] };
  };
}

export type VCFFieldType = "Integer" | "Float" | "Flag" | "Character" | "String";

export type VCFFieldNumber = number | null | "A" | "R" | "G";

export interface VCFMetaInfo {
  ID: string;
  Number: VCFFieldNumber;
  Type: VCFFieldType;
  Description: string;
  Source?: string;
  Version?: string;
}

export function objectToVCFMetaInfo(obj: { [key: string]: string | number }): VCFMetaInfo {
  required(obj, ["ID", "Number", "Type", "Description"]);
  const res: VCFMetaInfo = {
    ID: getString(obj, "ID"),
    Number: getMetaNumber(obj, "Number"),
    Type: getMetaType(obj, "Type"),
    Description: getString(obj, "Description"),
  };
  if ("Source" in obj) {
    res.Source = getString(obj, "Source");
  }
  if ("Version" in obj) {
    res.Version = getString(obj, "Version");
  }
  return res;
}

export interface VCFMetaFilter {
  ID: string;
  Description: string;
  Source?: string;
  Version?: string;
}

export function objectToVCFMetaFilter(obj: { [key: string]: string | number }): VCFMetaFilter {
  const res: VCFMetaFilter = {
    ID: getString(obj, "ID"),
    Description: getString(obj, "Description"),
  };
  if ("Source" in obj) {
    res.Source = getString(obj, "Source");
  }
  if ("Version" in obj) {
    res.Version = getString(obj, "Version");
  }
  return res;
}

export interface VCFMetaFormat {
  ID: string;
  Number: VCFFieldNumber;
  Type: VCFFieldType;
  Description: string;
  Source?: string;
  Version?: string;
  [extra: string]: any;
}

export function objectToVCFMetaFormat(obj: { [key: string]: string | number }): VCFMetaFormat {
  required(obj, ["ID", "Number", "Type", "Description"]);
  const res: VCFMetaFormat = {
    ID: getString(obj, "ID"),
    Number: getMetaNumber(obj, "Number"),
    Type: getMetaType(obj, "Type"),
    Description: getString(obj, "Description"),
  };
  if ("Source" in obj) {
    res.Source = getString(obj, "Source");
  }
  if ("Version" in obj) {
    res.Version = getString(obj, "Version");
  }
  return res;
}

export interface VCFEntry {
  CHROM: string;
  POS: number;
  ID: string;
  REF: string;
  ALT: string | string[];
  QUAL: string;
  FILTER: string;
  INFO: { [key: string]: string | number };
  FORMAT?: string;
  genotype?: { [sample: string]: { [key: string]: string | number } };
}

export type VEPAnnotation = { [key: string]: string };

export class VCFBase {
  sourceName: string;
  lineNum: number;
  metaData?: VCFMeta;

  constructor(sourceName: string) {
    this.sourceName = sourceName;
    this.lineNum = 0;
  }

  parseMetaLine(value: string): boolean {
    this.lineNum += 1;
    if (!value.startsWith("#")) {
      throw new Error(`reading ${this.sourceName}:${this.lineNum}: unexpected end of metadata.`);
    }

    if (value.startsWith("##")) {
      let [metaKey, metaVal] = value
        .trim()
        .match(/^##(.+?)=(.*)/)
        .slice(1, 3);
      if (metaVal.startsWith("<")) {
        metaVal = metaVal.replace(/^<|>$/g, "");
        let metaDict = this.makeKeyValDict(metaVal, ",");
        switch (metaKey) {
          case "INFO": {
            const ifo = objectToVCFMetaInfo(metaDict);
            this.metaData.INFO[ifo.ID] = ifo;
            break;
          }
          case "FILTER": {
            const flt = objectToVCFMetaFilter(metaDict);
            this.metaData.FILTER[flt.ID] = flt;
            break;
          }
          case "FORMAT": {
            const fmt = objectToVCFMetaFormat(metaDict);
            this.metaData.FORMAT[fmt.ID] = fmt;
            break;
          }
          default: {
            if (!(metaKey in this.metaData.extra.structured)) {
              this.metaData.extra.structured[metaKey] = {};
            }
            this.metaData.extra.structured[metaKey][metaDict.ID] = metaDict;
          }
        }
      } else {
        if (!(metaKey in this.metaData.extra.unstructured)) {
          this.metaData.extra.unstructured[metaKey] = [];
        }
        this.metaData.extra.unstructured[metaKey].push(metaVal);
      }
    }

    if (value.startsWith("#CHROM")) {
      let parts = value.trim().split(/\t/g);
      let fixedFields = ["#CHROM", "POS", "ID", "REF", "ALT", "QUAL", "FILTER", "INFO", "FORMAT"];
      if (parts.length == fixedFields.length - 1) {
        // Handle the case of GNOMAD-like reference VCFs.
        for (let i = 0; i < fixedFields.length - 1; ++i) {
          if (parts[i] != fixedFields[i]) {
            throw new Error(
              `reading ${this.sourceName}:${this.lineNum}: malformed header - expected ${fixedFields[i]} but got ${parts[i]}.`
            );
          }
        }
        this.metaData.sample_ids = [];
        return true;
      }
      if (parts.length < fixedFields.length) {
        throw new Error(`reading ${this.sourceName}:${this.lineNum}: missing fixed fields in the header line (${parts})`);
      }
      for (let i = 0; i < fixedFields.length; ++i) {
        if (parts[i] != fixedFields[i]) {
          throw new Error(
            `reading ${this.sourceName}:${this.lineNum}: malformed header - expected ${fixedFields[i]} but got ${parts[i]}.`
          );
        }
      }
      this.metaData.sample_ids = [];
      for (let i = fixedFields.length; i < parts.length; ++i) {
        this.metaData.sample_ids.push(parts[i]);
      }
      return true;
    }
    return false;
  }

  private makeKeyValDict(str: string, sep: string): { [key: string]: string | number } {
    let dict: { [key: string]: string | number } = {};
    let i = 0;
    while (i < str.length) {
      let keyStart = i;
      while (i < str.length && str[i] != "=" && str[i] != sep) {
        ++i;
      }
      let curKey = str.slice(keyStart, i);
      if (i == str.length || str[i] == sep) {
        dict[curKey] = null;
        if (i < str.length) {
          ++i;
        }
        continue;
      }
      ++i;
      if (i == str.length) {
        throw new Error(`reading ${this.sourceName}:${this.lineNum}: expected a value following '${curKey}='.`);
      }
      if (str[i] == '"') {
        let quotedValStart = ++i;
        while (i < str.length && str[i] != '"') {
          ++i;
        }
        if (i == str.length) {
          throw new Error(`reading ${this.sourceName}:${this.lineNum}: unterminated string value for '${curKey}'.`);
        }
        let quotedVal = str.slice(quotedValStart, i);
        ++i;
        dict[curKey] = quotedVal;
      } else {
        let unquotedValStart = i;
        while (i < str.length && str[i] != sep) {
          ++i;
        }
        let unquotedVal: string | number = str.slice(unquotedValStart, i);
        let numberValue = Number(unquotedVal);
        unquotedVal = Number.isFinite(numberValue) ? numberValue : unquotedVal;
        dict[curKey] = unquotedVal;
      }
      if (i < str.length) {
        ++i;
      }
    }
    return dict;
  }

  parseDataLine(value: string): VCFEntry {
    let parts = value.trim().split(/\t/g);
    if (parts.length != (this.metaData.sample_ids.length == 0 ? 8 : 9 + this.metaData.sample_ids.length)) {
      throw new Error(`${this.sourceName}:${this.lineNum}: expected ${9 + this.metaData.sample_ids.length} fields, got ${parts.length}.`);
    }
    let res: Partial<VCFEntry> = {};
    const CHROM = parts[0];
    const POS = Number(parts[1]);
    const ID = parts[2];
    const REF = parts[3];
    const ALT = parts[4];
    const QUAL = parts[5];
    const FILTER = parts[6];
    let infoStr = parts[7];
    const INFO = this.makeKeyValDict(infoStr, ";");
    if (this.metaData.sample_ids.length == 0) {
      return { CHROM, POS, ID, REF, ALT, QUAL, FILTER, INFO };
    }
    const FORMAT = parts[8];
    let fmts = parts[8].split(/:/g);
    const genotype: { [sample: string]: { [key: string]: string } } = {};
    for (let i = 0; i < this.metaData.sample_ids.length; ++i) {
      let sid = this.metaData.sample_ids[i];
      let gtStr = parts[9 + i];
      let gtParts = gtStr.split(/:/g);
      let gt = {};
      for (let j = 0; j < fmts.length; ++j) {
        gt[fmts[j]] = gtParts[j];
      }
      genotype[sid] = gt;
    }
    return { CHROM, POS, ID, REF, ALT, QUAL, FILTER, INFO, FORMAT, genotype };
  }

  static vepAnnotationParser(m: VCFMeta, field: string = "ANN", strict: boolean = true): (v: VCFEntry) => VEPAnnotation[] {
    if (!(field in m.INFO)) {
      throw new Error(`cannot find VEP annotation '${field}'.`);
    }
    let ifo: VCFMetaInfo = m.INFO[field];
    let s = ifo.Description;
    const qry = "Format: ";
    let i = s.indexOf(qry);
    if (i < 0) {
      throw new Error(`cannot find format specification for VEP annotations in INFO declaration of '${field}'.`);
    }
    let flds = s.slice(i + qry.length).split("|");
    return (v) => {
      if (!(field in v.INFO)) {
        return null;
      }
      let value = v.INFO[field];
      if (typeof value == "number") {
        if (strict) {
          throw new Error(`INFO field '${field}' was not a string.`);
        } else {
          console.log(`INFO field ${field} was not a string`);
          value = value.toString();
        }
      }
      let veps = value.split(",");
      let res = [];
      for (let vep of veps) {
        let vals = vep.split("|");
        if (vals.length != flds.length) {
          if (strict) {
            throw new Error(`warning: VEP format expects ${flds.length} components, but the value has ${vals.length}.`);
          } else {
            console.log(`warning: VEP format expects ${flds.length} components, but the value has ${vals.length}.`);
          }
        }
        let annot: VEPAnnotation = {};
        for (let i = 0; i < flds.length; ++i) {
          if (i < vals.length) {
            annot[flds[i]] = vals[i];
          }
        }
        res.push(annot);
      }
      return res;
    };
  }
}

export class VCF extends VCFBase {
  lines: Iterator<string>;

  constructor(sourceName: string, lines: Iterator<string>) {
    super(sourceName);
    this.lines = lines;
  }

  meta(): VCFMeta {
    if (!this.metaData) {
      this.metaData = { INFO: {}, FILTER: {}, FORMAT: {}, extra: { structured: {}, unstructured: {} } };
      while (true) {
        const { done, value } = this.lines.next();
        if (done) {
          throw new Error(`${this.sourceName}:${this.lineNum}: unexpected end of input.`);
        }
        const finished = this.parseMetaLine(value);
        if (finished) {
          break;
        }
      }
      return this.metaData;
    }
  }

  next(): VCFEntry | null {
    if (!this.metaData) {
      this.meta();
    }
    const { done, value } = this.lines.next();
    if (done) {
      return null;
    }
    this.lineNum += 1;
    return this.parseDataLine(value);
  }
}

export class VCFAsync extends VCFBase {
  lines: AsyncIterator<string>;

  constructor(sourceName: string, lines: AsyncIterator<string>) {
    super(sourceName);
    this.lines = lines;
  }

  async meta(): Promise<VCFMeta> {
    if (!this.metaData) {
      this.metaData = { INFO: {}, FILTER: {}, FORMAT: {}, extra: { structured: {}, unstructured: {} } };
      while (true) {
        const { done, value } = await this.lines.next();
        if (done) {
          throw new Error(`${this.sourceName}:${this.lineNum}: unexpected end of input.`);
        }
        const finished = this.parseMetaLine(value);
        if (finished) {
          break;
        }
      }
      return this.metaData;
    }
  }

  async next(): Promise<VCFEntry | null> {
    if (!this.metaData) {
      await this.meta();
    }
    const { done, value } = await this.lines.next();
    if (done) {
      return null;
    }
    this.lineNum += 1;
    return this.parseDataLine(value);
  }
}

function required(obj: { [key: string]: string | number }, keys: string[]): void {
  for (const key of keys) {
    if (!(key in obj)) {
      throw Error(`required key '${key}' not found.`);
    }
  }
}

function getString(obj: { [key: string]: string | number }, fld: string): string {
  const val = obj[fld];
  if (typeof val == "string") {
    return val;
  }
  throw new Error(`expected a string, got a ${typeof val}.`);
}

/*
function getNumber(obj: { [key: string]: string | number }, fld: string): number {
  const val = obj[fld];
  if (typeof val == "number") {
    return val;
  }
  throw new Error(`expected a number, got a ${typeof val}`);
}
*/

function getMetaNumber(obj: { [key: string]: string | number }, fld: string): VCFFieldNumber {
  const val = obj[fld];
  if (typeof val == "number") {
    return val;
  }
  switch (val) {
    case "A":
    case "R":
    case "G": {
      return val;
    }
    case ".": {
      return null;
    }
    default: {
      throw new Error(`expected a number, got '${val}'.`);
    }
  }
}

function getMetaType(obj: { [key: string]: string | number }, fld: string): VCFFieldType {
  const val = obj[fld];
  switch (val) {
    case "Integer":
    case "Float":
    case "Flag":
    case "Character":
    case "String": {
      return val;
    }
    default: {
      throw new Error(`expected a type, got '${val}'.`);
    }
  }
}
