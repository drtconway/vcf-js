"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VCFAsync = exports.VCF = exports.VCFBase = exports.objectToVCFMetaFormat = exports.objectToVCFMetaFilter = exports.objectToVCFMetaInfo = void 0;
function objectToVCFMetaInfo(obj) {
    required(obj, ["ID", "Number", "Type", "Description"]);
    const res = {
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
exports.objectToVCFMetaInfo = objectToVCFMetaInfo;
function objectToVCFMetaFilter(obj) {
    const res = {
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
exports.objectToVCFMetaFilter = objectToVCFMetaFilter;
function objectToVCFMetaFormat(obj) {
    required(obj, ["ID", "Number", "Type", "Description"]);
    const res = {
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
exports.objectToVCFMetaFormat = objectToVCFMetaFormat;
class VCFBase {
    constructor(sourceName) {
        this.sourceName = sourceName;
        this.lineNum = 0;
    }
    parseMetaLine(value) {
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
            }
            else {
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
                        throw new Error(`reading ${this.sourceName}:${this.lineNum}: malformed header - expected ${fixedFields[i]} but got ${parts[i]}.`);
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
                    throw new Error(`reading ${this.sourceName}:${this.lineNum}: malformed header - expected ${fixedFields[i]} but got ${parts[i]}.`);
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
    makeKeyValDict(str, sep) {
        let dict = {};
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
            }
            else {
                let unquotedValStart = i;
                while (i < str.length && str[i] != sep) {
                    ++i;
                }
                let unquotedVal = str.slice(unquotedValStart, i);
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
    parseDataLine(value) {
        let parts = value.trim().split(/\t/g);
        if (parts.length != (this.metaData.sample_ids.length == 0 ? 8 : 9 + this.metaData.sample_ids.length)) {
            throw new Error(`${this.sourceName}:${this.lineNum}: expected ${9 + this.metaData.sample_ids.length} fields, got ${parts.length}.`);
        }
        let res = {};
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
        const genotype = {};
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
    static vepAnnotationParser(m, field = "ANN", strict = true) {
        if (!(field in m.INFO)) {
            throw new Error(`cannot find VEP annotation '${field}'.`);
        }
        let ifo = m.INFO[field];
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
                }
                else {
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
                    }
                    else {
                        console.log(`warning: VEP format expects ${flds.length} components, but the value has ${vals.length}.`);
                    }
                }
                let annot = {};
                for (let i = 0; i < flds.length; ++i) {
                    if (i < vals.length) {
                        const num = Number(vals[i]);
                        annot[flds[i]] = (Number.isFinite(num) ? num : vals[i]);
                    }
                }
                res.push(annot);
            }
            return res;
        };
    }
}
exports.VCFBase = VCFBase;
class VCF extends VCFBase {
    constructor(sourceName, lines) {
        super(sourceName);
        this.lines = lines;
    }
    meta() {
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
    next() {
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
exports.VCF = VCF;
class VCFAsync extends VCFBase {
    constructor(sourceName, lines) {
        super(sourceName);
        this.lines = lines;
    }
    async meta() {
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
    async next() {
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
exports.VCFAsync = VCFAsync;
function required(obj, keys) {
    for (const key of keys) {
        if (!(key in obj)) {
            throw Error(`required key '${key}' not found.`);
        }
    }
}
function getString(obj, fld) {
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
function getMetaNumber(obj, fld) {
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
function getMetaType(obj, fld) {
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
