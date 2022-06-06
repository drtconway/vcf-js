export interface VCFMeta {
    INFO: {
        [key: string]: VCFMetaInfo;
    };
    FILTER: {
        [key: string]: VCFMetaFilter;
    };
    FORMAT: {
        [key: string]: VCFMetaFormat;
    };
    sample_ids?: string[];
    extra: {
        structured: {
            [metaKey: string]: {
                [keyID: string]: {
                    [key: string]: string | number;
                };
            };
        };
        unstructured: {
            [key: string]: string[];
        };
    };
}
export declare type VCFFieldType = "Integer" | "Float" | "Flag" | "Character" | "String";
export declare type VCFFieldNumber = number | null | "A" | "R" | "G";
export interface VCFMetaInfo {
    ID: string;
    Number: VCFFieldNumber;
    Type: VCFFieldType;
    Description: string;
    Source?: string;
    Version?: string;
}
export declare function objectToVCFMetaInfo(obj: {
    [key: string]: string | number;
}): VCFMetaInfo;
export interface VCFMetaFilter {
    ID: string;
    Description: string;
    Source?: string;
    Version?: string;
}
export declare function objectToVCFMetaFilter(obj: {
    [key: string]: string | number;
}): VCFMetaFilter;
export interface VCFMetaFormat {
    ID: string;
    Number: VCFFieldNumber;
    Type: VCFFieldType;
    Description: string;
    Source?: string;
    Version?: string;
    [extra: string]: any;
}
export declare function objectToVCFMetaFormat(obj: {
    [key: string]: string | number;
}): VCFMetaFormat;
export interface VCFEntry {
    CHROM: string;
    POS: number;
    ID: string;
    REF: string;
    ALT: string | string[];
    QUAL: string;
    FILTER: string;
    INFO: {
        [key: string]: string | number;
    };
    FORMAT?: string;
    genotype?: {
        [sample: string]: {
            [key: string]: string | number;
        };
    };
}
export declare type VEPAnnotation = {
    [key: string]: string | number;
};
export declare class VCFBase {
    sourceName: string;
    lineNum: number;
    metaData?: VCFMeta;
    constructor(sourceName: string);
    parseMetaLine(value: string): boolean;
    private makeKeyValDict;
    parseDataLine(value: string): VCFEntry;
    static vepAnnotationParser(m: VCFMeta, field?: string, strict?: boolean): (v: VCFEntry) => VEPAnnotation[];
}
export declare class VCF extends VCFBase {
    lines: Iterator<string>;
    constructor(sourceName: string, lines: Iterator<string>);
    meta(): VCFMeta;
    next(): VCFEntry | null;
}
export declare class VCFAsync extends VCFBase {
    lines: AsyncIterator<string>;
    constructor(sourceName: string, lines: AsyncIterator<string>);
    meta(): Promise<VCFMeta>;
    next(): Promise<VCFEntry | null>;
}
