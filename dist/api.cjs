'use strict';

var require$$6 = require('fs');
var stream = require('stream');
var require$$1 = require('path');

var util;
(function (util) {
    util.assertEqual = (val) => val;
    function assertIs(_arg) { }
    util.assertIs = assertIs;
    function assertNever(_x) {
        throw new Error();
    }
    util.assertNever = assertNever;
    util.arrayToEnum = (items) => {
        const obj = {};
        for (const item of items) {
            obj[item] = item;
        }
        return obj;
    };
    util.getValidEnumValues = (obj) => {
        const validKeys = util.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
        const filtered = {};
        for (const k of validKeys) {
            filtered[k] = obj[k];
        }
        return util.objectValues(filtered);
    };
    util.objectValues = (obj) => {
        return util.objectKeys(obj).map(function (e) {
            return obj[e];
        });
    };
    util.objectKeys = typeof Object.keys === "function" // eslint-disable-line ban/ban
        ? (obj) => Object.keys(obj) // eslint-disable-line ban/ban
        : (object) => {
            const keys = [];
            for (const key in object) {
                if (Object.prototype.hasOwnProperty.call(object, key)) {
                    keys.push(key);
                }
            }
            return keys;
        };
    util.find = (arr, checker) => {
        for (const item of arr) {
            if (checker(item))
                return item;
        }
        return undefined;
    };
    util.isInteger = typeof Number.isInteger === "function"
        ? (val) => Number.isInteger(val) // eslint-disable-line ban/ban
        : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
        return array
            .map((val) => (typeof val === "string" ? `'${val}'` : val))
            .join(separator);
    }
    util.joinValues = joinValues;
    util.jsonStringifyReplacer = (_, value) => {
        if (typeof value === "bigint") {
            return value.toString();
        }
        return value;
    };
})(util || (util = {}));
var objectUtil;
(function (objectUtil) {
    objectUtil.mergeShapes = (first, second) => {
        return {
            ...first,
            ...second, // second overwrites first
        };
    };
})(objectUtil || (objectUtil = {}));
const ZodParsedType = util.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set",
]);
const getParsedType = (data) => {
    const t = typeof data;
    switch (t) {
        case "undefined":
            return ZodParsedType.undefined;
        case "string":
            return ZodParsedType.string;
        case "number":
            return isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
        case "boolean":
            return ZodParsedType.boolean;
        case "function":
            return ZodParsedType.function;
        case "bigint":
            return ZodParsedType.bigint;
        case "symbol":
            return ZodParsedType.symbol;
        case "object":
            if (Array.isArray(data)) {
                return ZodParsedType.array;
            }
            if (data === null) {
                return ZodParsedType.null;
            }
            if (data.then &&
                typeof data.then === "function" &&
                data.catch &&
                typeof data.catch === "function") {
                return ZodParsedType.promise;
            }
            if (typeof Map !== "undefined" && data instanceof Map) {
                return ZodParsedType.map;
            }
            if (typeof Set !== "undefined" && data instanceof Set) {
                return ZodParsedType.set;
            }
            if (typeof Date !== "undefined" && data instanceof Date) {
                return ZodParsedType.date;
            }
            return ZodParsedType.object;
        default:
            return ZodParsedType.unknown;
    }
};

const ZodIssueCode = util.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite",
]);
const quotelessJson = (obj) => {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(/"([^"]+)":/g, "$1:");
};
class ZodError extends Error {
    constructor(issues) {
        super();
        this.issues = [];
        this.addIssue = (sub) => {
            this.issues = [...this.issues, sub];
        };
        this.addIssues = (subs = []) => {
            this.issues = [...this.issues, ...subs];
        };
        const actualProto = new.target.prototype;
        if (Object.setPrototypeOf) {
            // eslint-disable-next-line ban/ban
            Object.setPrototypeOf(this, actualProto);
        }
        else {
            this.__proto__ = actualProto;
        }
        this.name = "ZodError";
        this.issues = issues;
    }
    get errors() {
        return this.issues;
    }
    format(_mapper) {
        const mapper = _mapper ||
            function (issue) {
                return issue.message;
            };
        const fieldErrors = { _errors: [] };
        const processError = (error) => {
            for (const issue of error.issues) {
                if (issue.code === "invalid_union") {
                    issue.unionErrors.map(processError);
                }
                else if (issue.code === "invalid_return_type") {
                    processError(issue.returnTypeError);
                }
                else if (issue.code === "invalid_arguments") {
                    processError(issue.argumentsError);
                }
                else if (issue.path.length === 0) {
                    fieldErrors._errors.push(mapper(issue));
                }
                else {
                    let curr = fieldErrors;
                    let i = 0;
                    while (i < issue.path.length) {
                        const el = issue.path[i];
                        const terminal = i === issue.path.length - 1;
                        if (!terminal) {
                            curr[el] = curr[el] || { _errors: [] };
                            // if (typeof el === "string") {
                            //   curr[el] = curr[el] || { _errors: [] };
                            // } else if (typeof el === "number") {
                            //   const errorArray: any = [];
                            //   errorArray._errors = [];
                            //   curr[el] = curr[el] || errorArray;
                            // }
                        }
                        else {
                            curr[el] = curr[el] || { _errors: [] };
                            curr[el]._errors.push(mapper(issue));
                        }
                        curr = curr[el];
                        i++;
                    }
                }
            }
        };
        processError(this);
        return fieldErrors;
    }
    toString() {
        return this.message;
    }
    get message() {
        return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
        return this.issues.length === 0;
    }
    flatten(mapper = (issue) => issue.message) {
        const fieldErrors = {};
        const formErrors = [];
        for (const sub of this.issues) {
            if (sub.path.length > 0) {
                fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
                fieldErrors[sub.path[0]].push(mapper(sub));
            }
            else {
                formErrors.push(mapper(sub));
            }
        }
        return { formErrors, fieldErrors };
    }
    get formErrors() {
        return this.flatten();
    }
}
ZodError.create = (issues) => {
    const error = new ZodError(issues);
    return error;
};

const errorMap = (issue, _ctx) => {
    let message;
    switch (issue.code) {
        case ZodIssueCode.invalid_type:
            if (issue.received === ZodParsedType.undefined) {
                message = "Required";
            }
            else {
                message = `Expected ${issue.expected}, received ${issue.received}`;
            }
            break;
        case ZodIssueCode.invalid_literal:
            message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
            break;
        case ZodIssueCode.unrecognized_keys:
            message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
            break;
        case ZodIssueCode.invalid_union:
            message = `Invalid input`;
            break;
        case ZodIssueCode.invalid_union_discriminator:
            message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
            break;
        case ZodIssueCode.invalid_enum_value:
            message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
            break;
        case ZodIssueCode.invalid_arguments:
            message = `Invalid function arguments`;
            break;
        case ZodIssueCode.invalid_return_type:
            message = `Invalid function return type`;
            break;
        case ZodIssueCode.invalid_date:
            message = `Invalid date`;
            break;
        case ZodIssueCode.invalid_string:
            if (typeof issue.validation === "object") {
                if ("includes" in issue.validation) {
                    message = `Invalid input: must include "${issue.validation.includes}"`;
                    if (typeof issue.validation.position === "number") {
                        message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
                    }
                }
                else if ("startsWith" in issue.validation) {
                    message = `Invalid input: must start with "${issue.validation.startsWith}"`;
                }
                else if ("endsWith" in issue.validation) {
                    message = `Invalid input: must end with "${issue.validation.endsWith}"`;
                }
                else {
                    util.assertNever(issue.validation);
                }
            }
            else if (issue.validation !== "regex") {
                message = `Invalid ${issue.validation}`;
            }
            else {
                message = "Invalid";
            }
            break;
        case ZodIssueCode.too_small:
            if (issue.type === "array")
                message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
            else if (issue.type === "string")
                message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
            else if (issue.type === "number")
                message = `Number must be ${issue.exact
                    ? `exactly equal to `
                    : issue.inclusive
                        ? `greater than or equal to `
                        : `greater than `}${issue.minimum}`;
            else if (issue.type === "date")
                message = `Date must be ${issue.exact
                    ? `exactly equal to `
                    : issue.inclusive
                        ? `greater than or equal to `
                        : `greater than `}${new Date(Number(issue.minimum))}`;
            else
                message = "Invalid input";
            break;
        case ZodIssueCode.too_big:
            if (issue.type === "array")
                message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
            else if (issue.type === "string")
                message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
            else if (issue.type === "number")
                message = `Number must be ${issue.exact
                    ? `exactly`
                    : issue.inclusive
                        ? `less than or equal to`
                        : `less than`} ${issue.maximum}`;
            else if (issue.type === "bigint")
                message = `BigInt must be ${issue.exact
                    ? `exactly`
                    : issue.inclusive
                        ? `less than or equal to`
                        : `less than`} ${issue.maximum}`;
            else if (issue.type === "date")
                message = `Date must be ${issue.exact
                    ? `exactly`
                    : issue.inclusive
                        ? `smaller than or equal to`
                        : `smaller than`} ${new Date(Number(issue.maximum))}`;
            else
                message = "Invalid input";
            break;
        case ZodIssueCode.custom:
            message = `Invalid input`;
            break;
        case ZodIssueCode.invalid_intersection_types:
            message = `Intersection results could not be merged`;
            break;
        case ZodIssueCode.not_multiple_of:
            message = `Number must be a multiple of ${issue.multipleOf}`;
            break;
        case ZodIssueCode.not_finite:
            message = "Number must be finite";
            break;
        default:
            message = _ctx.defaultError;
            util.assertNever(issue);
    }
    return { message };
};

let overrideErrorMap = errorMap;
function setErrorMap(map) {
    overrideErrorMap = map;
}
function getErrorMap() {
    return overrideErrorMap;
}

const makeIssue = (params) => {
    const { data, path, errorMaps, issueData } = params;
    const fullPath = [...path, ...(issueData.path || [])];
    const fullIssue = {
        ...issueData,
        path: fullPath,
    };
    let errorMessage = "";
    const maps = errorMaps
        .filter((m) => !!m)
        .slice()
        .reverse();
    for (const map of maps) {
        errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
    }
    return {
        ...issueData,
        path: fullPath,
        message: issueData.message || errorMessage,
    };
};
const EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
    const issue = makeIssue({
        issueData: issueData,
        data: ctx.data,
        path: ctx.path,
        errorMaps: [
            ctx.common.contextualErrorMap,
            ctx.schemaErrorMap,
            getErrorMap(),
            errorMap, // then global default map
        ].filter((x) => !!x),
    });
    ctx.common.issues.push(issue);
}
class ParseStatus {
    constructor() {
        this.value = "valid";
    }
    dirty() {
        if (this.value === "valid")
            this.value = "dirty";
    }
    abort() {
        if (this.value !== "aborted")
            this.value = "aborted";
    }
    static mergeArray(status, results) {
        const arrayValue = [];
        for (const s of results) {
            if (s.status === "aborted")
                return INVALID;
            if (s.status === "dirty")
                status.dirty();
            arrayValue.push(s.value);
        }
        return { status: status.value, value: arrayValue };
    }
    static async mergeObjectAsync(status, pairs) {
        const syncPairs = [];
        for (const pair of pairs) {
            syncPairs.push({
                key: await pair.key,
                value: await pair.value,
            });
        }
        return ParseStatus.mergeObjectSync(status, syncPairs);
    }
    static mergeObjectSync(status, pairs) {
        const finalObject = {};
        for (const pair of pairs) {
            const { key, value } = pair;
            if (key.status === "aborted")
                return INVALID;
            if (value.status === "aborted")
                return INVALID;
            if (key.status === "dirty")
                status.dirty();
            if (value.status === "dirty")
                status.dirty();
            if (key.value !== "__proto__" &&
                (typeof value.value !== "undefined" || pair.alwaysSet)) {
                finalObject[key.value] = value.value;
            }
        }
        return { status: status.value, value: finalObject };
    }
}
const INVALID = Object.freeze({
    status: "aborted",
});
const DIRTY = (value) => ({ status: "dirty", value });
const OK = (value) => ({ status: "valid", value });
const isAborted = (x) => x.status === "aborted";
const isDirty = (x) => x.status === "dirty";
const isValid = (x) => x.status === "valid";
const isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

var errorUtil;
(function (errorUtil) {
    errorUtil.errToObj = (message) => typeof message === "string" ? { message } : message || {};
    errorUtil.toString = (message) => typeof message === "string" ? message : message === null || message === void 0 ? void 0 : message.message;
})(errorUtil || (errorUtil = {}));

class ParseInputLazyPath {
    constructor(parent, value, path, key) {
        this._cachedPath = [];
        this.parent = parent;
        this.data = value;
        this._path = path;
        this._key = key;
    }
    get path() {
        if (!this._cachedPath.length) {
            if (this._key instanceof Array) {
                this._cachedPath.push(...this._path, ...this._key);
            }
            else {
                this._cachedPath.push(...this._path, this._key);
            }
        }
        return this._cachedPath;
    }
}
const handleResult = (ctx, result) => {
    if (isValid(result)) {
        return { success: true, data: result.value };
    }
    else {
        if (!ctx.common.issues.length) {
            throw new Error("Validation failed but no issues detected.");
        }
        return {
            success: false,
            get error() {
                if (this._error)
                    return this._error;
                const error = new ZodError(ctx.common.issues);
                this._error = error;
                return this._error;
            },
        };
    }
};
function processCreateParams(params) {
    if (!params)
        return {};
    const { errorMap, invalid_type_error, required_error, description } = params;
    if (errorMap && (invalid_type_error || required_error)) {
        throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap)
        return { errorMap: errorMap, description };
    const customMap = (iss, ctx) => {
        if (iss.code !== "invalid_type")
            return { message: ctx.defaultError };
        if (typeof ctx.data === "undefined") {
            return { message: required_error !== null && required_error !== void 0 ? required_error : ctx.defaultError };
        }
        return { message: invalid_type_error !== null && invalid_type_error !== void 0 ? invalid_type_error : ctx.defaultError };
    };
    return { errorMap: customMap, description };
}
class ZodType {
    constructor(def) {
        /** Alias of safeParseAsync */
        this.spa = this.safeParseAsync;
        this._def = def;
        this.parse = this.parse.bind(this);
        this.safeParse = this.safeParse.bind(this);
        this.parseAsync = this.parseAsync.bind(this);
        this.safeParseAsync = this.safeParseAsync.bind(this);
        this.spa = this.spa.bind(this);
        this.refine = this.refine.bind(this);
        this.refinement = this.refinement.bind(this);
        this.superRefine = this.superRefine.bind(this);
        this.optional = this.optional.bind(this);
        this.nullable = this.nullable.bind(this);
        this.nullish = this.nullish.bind(this);
        this.array = this.array.bind(this);
        this.promise = this.promise.bind(this);
        this.or = this.or.bind(this);
        this.and = this.and.bind(this);
        this.transform = this.transform.bind(this);
        this.brand = this.brand.bind(this);
        this.default = this.default.bind(this);
        this.catch = this.catch.bind(this);
        this.describe = this.describe.bind(this);
        this.pipe = this.pipe.bind(this);
        this.readonly = this.readonly.bind(this);
        this.isNullable = this.isNullable.bind(this);
        this.isOptional = this.isOptional.bind(this);
    }
    get description() {
        return this._def.description;
    }
    _getType(input) {
        return getParsedType(input.data);
    }
    _getOrReturnCtx(input, ctx) {
        return (ctx || {
            common: input.parent.common,
            data: input.data,
            parsedType: getParsedType(input.data),
            schemaErrorMap: this._def.errorMap,
            path: input.path,
            parent: input.parent,
        });
    }
    _processInputParams(input) {
        return {
            status: new ParseStatus(),
            ctx: {
                common: input.parent.common,
                data: input.data,
                parsedType: getParsedType(input.data),
                schemaErrorMap: this._def.errorMap,
                path: input.path,
                parent: input.parent,
            },
        };
    }
    _parseSync(input) {
        const result = this._parse(input);
        if (isAsync(result)) {
            throw new Error("Synchronous parse encountered promise.");
        }
        return result;
    }
    _parseAsync(input) {
        const result = this._parse(input);
        return Promise.resolve(result);
    }
    parse(data, params) {
        const result = this.safeParse(data, params);
        if (result.success)
            return result.data;
        throw result.error;
    }
    safeParse(data, params) {
        var _a;
        const ctx = {
            common: {
                issues: [],
                async: (_a = params === null || params === void 0 ? void 0 : params.async) !== null && _a !== void 0 ? _a : false,
                contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap,
            },
            path: (params === null || params === void 0 ? void 0 : params.path) || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data),
        };
        const result = this._parseSync({ data, path: ctx.path, parent: ctx });
        return handleResult(ctx, result);
    }
    async parseAsync(data, params) {
        const result = await this.safeParseAsync(data, params);
        if (result.success)
            return result.data;
        throw result.error;
    }
    async safeParseAsync(data, params) {
        const ctx = {
            common: {
                issues: [],
                contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap,
                async: true,
            },
            path: (params === null || params === void 0 ? void 0 : params.path) || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data),
        };
        const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
        const result = await (isAsync(maybeAsyncResult)
            ? maybeAsyncResult
            : Promise.resolve(maybeAsyncResult));
        return handleResult(ctx, result);
    }
    refine(check, message) {
        const getIssueProperties = (val) => {
            if (typeof message === "string" || typeof message === "undefined") {
                return { message };
            }
            else if (typeof message === "function") {
                return message(val);
            }
            else {
                return message;
            }
        };
        return this._refinement((val, ctx) => {
            const result = check(val);
            const setError = () => ctx.addIssue({
                code: ZodIssueCode.custom,
                ...getIssueProperties(val),
            });
            if (typeof Promise !== "undefined" && result instanceof Promise) {
                return result.then((data) => {
                    if (!data) {
                        setError();
                        return false;
                    }
                    else {
                        return true;
                    }
                });
            }
            if (!result) {
                setError();
                return false;
            }
            else {
                return true;
            }
        });
    }
    refinement(check, refinementData) {
        return this._refinement((val, ctx) => {
            if (!check(val)) {
                ctx.addIssue(typeof refinementData === "function"
                    ? refinementData(val, ctx)
                    : refinementData);
                return false;
            }
            else {
                return true;
            }
        });
    }
    _refinement(refinement) {
        return new ZodEffects({
            schema: this,
            typeName: ZodFirstPartyTypeKind.ZodEffects,
            effect: { type: "refinement", refinement },
        });
    }
    superRefine(refinement) {
        return this._refinement(refinement);
    }
    optional() {
        return ZodOptional.create(this, this._def);
    }
    nullable() {
        return ZodNullable.create(this, this._def);
    }
    nullish() {
        return this.nullable().optional();
    }
    array() {
        return ZodArray.create(this, this._def);
    }
    promise() {
        return ZodPromise.create(this, this._def);
    }
    or(option) {
        return ZodUnion.create([this, option], this._def);
    }
    and(incoming) {
        return ZodIntersection.create(this, incoming, this._def);
    }
    transform(transform) {
        return new ZodEffects({
            ...processCreateParams(this._def),
            schema: this,
            typeName: ZodFirstPartyTypeKind.ZodEffects,
            effect: { type: "transform", transform },
        });
    }
    default(def) {
        const defaultValueFunc = typeof def === "function" ? def : () => def;
        return new ZodDefault({
            ...processCreateParams(this._def),
            innerType: this,
            defaultValue: defaultValueFunc,
            typeName: ZodFirstPartyTypeKind.ZodDefault,
        });
    }
    brand() {
        return new ZodBranded({
            typeName: ZodFirstPartyTypeKind.ZodBranded,
            type: this,
            ...processCreateParams(this._def),
        });
    }
    catch(def) {
        const catchValueFunc = typeof def === "function" ? def : () => def;
        return new ZodCatch({
            ...processCreateParams(this._def),
            innerType: this,
            catchValue: catchValueFunc,
            typeName: ZodFirstPartyTypeKind.ZodCatch,
        });
    }
    describe(description) {
        const This = this.constructor;
        return new This({
            ...this._def,
            description,
        });
    }
    pipe(target) {
        return ZodPipeline.create(this, target);
    }
    readonly() {
        return ZodReadonly.create(this);
    }
    isOptional() {
        return this.safeParse(undefined).success;
    }
    isNullable() {
        return this.safeParse(null).success;
    }
}
const cuidRegex = /^c[^\s-]{8,}$/i;
const cuid2Regex = /^[a-z][a-z0-9]*$/;
const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;
// const uuidRegex =
//   /^([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}|00000000-0000-0000-0000-000000000000)$/i;
const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
// from https://stackoverflow.com/a/46181/1550155
// old version: too slow, didn't support unicode
// const emailRegex = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i;
//old email regex
// const emailRegex = /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@((?!-)([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{1,})[^-<>()[\].,;:\s@"]$/i;
// eslint-disable-next-line
// const emailRegex =
//   /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\])|(\[IPv6:(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))\])|([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])*(\.[A-Za-z]{2,})+))$/;
// const emailRegex =
//   /^[a-zA-Z0-9\.\!\#\$\%\&\'\*\+\/\=\?\^\_\`\{\|\}\~\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
// const emailRegex =
//   /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;
const emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_+-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
// const emailRegex =
//   /^[a-z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9\-]+)*$/i;
// from https://thekevinscott.com/emojis-in-javascript/#writing-a-regular-expression
const _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
let emojiRegex;
const ipv4Regex = /^(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))$/;
const ipv6Regex = /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/;
// Adapted from https://stackoverflow.com/a/3143231
const datetimeRegex = (args) => {
    if (args.precision) {
        if (args.offset) {
            return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{${args.precision}}(([+-]\\d{2}(:?\\d{2})?)|Z)$`);
        }
        else {
            return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{${args.precision}}Z$`);
        }
    }
    else if (args.precision === 0) {
        if (args.offset) {
            return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(([+-]\\d{2}(:?\\d{2})?)|Z)$`);
        }
        else {
            return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$`);
        }
    }
    else {
        if (args.offset) {
            return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(([+-]\\d{2}(:?\\d{2})?)|Z)$`);
        }
        else {
            return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$`);
        }
    }
};
function isValidIP(ip, version) {
    if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
        return true;
    }
    if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
        return true;
    }
    return false;
}
class ZodString extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = String(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.string) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.string,
                received: ctx.parsedType,
            }
            //
            );
            return INVALID;
        }
        const status = new ParseStatus();
        let ctx = undefined;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                if (input.data.length < check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        minimum: check.value,
                        type: "string",
                        inclusive: true,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                if (input.data.length > check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        maximum: check.value,
                        type: "string",
                        inclusive: true,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "length") {
                const tooBig = input.data.length > check.value;
                const tooSmall = input.data.length < check.value;
                if (tooBig || tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    if (tooBig) {
                        addIssueToContext(ctx, {
                            code: ZodIssueCode.too_big,
                            maximum: check.value,
                            type: "string",
                            inclusive: true,
                            exact: true,
                            message: check.message,
                        });
                    }
                    else if (tooSmall) {
                        addIssueToContext(ctx, {
                            code: ZodIssueCode.too_small,
                            minimum: check.value,
                            type: "string",
                            inclusive: true,
                            exact: true,
                            message: check.message,
                        });
                    }
                    status.dirty();
                }
            }
            else if (check.kind === "email") {
                if (!emailRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "email",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "emoji") {
                if (!emojiRegex) {
                    emojiRegex = new RegExp(_emojiRegex, "u");
                }
                if (!emojiRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "emoji",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "uuid") {
                if (!uuidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "uuid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cuid") {
                if (!cuidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "cuid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cuid2") {
                if (!cuid2Regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "cuid2",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "ulid") {
                if (!ulidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "ulid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "url") {
                try {
                    new URL(input.data);
                }
                catch (_a) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "url",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "regex") {
                check.regex.lastIndex = 0;
                const testResult = check.regex.test(input.data);
                if (!testResult) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "regex",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "trim") {
                input.data = input.data.trim();
            }
            else if (check.kind === "includes") {
                if (!input.data.includes(check.value, check.position)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: { includes: check.value, position: check.position },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "toLowerCase") {
                input.data = input.data.toLowerCase();
            }
            else if (check.kind === "toUpperCase") {
                input.data = input.data.toUpperCase();
            }
            else if (check.kind === "startsWith") {
                if (!input.data.startsWith(check.value)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: { startsWith: check.value },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "endsWith") {
                if (!input.data.endsWith(check.value)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: { endsWith: check.value },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "datetime") {
                const regex = datetimeRegex(check);
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: "datetime",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "ip") {
                if (!isValidIP(input.data, check.version)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "ip",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    _regex(regex, validation, message) {
        return this.refinement((data) => regex.test(data), {
            validation,
            code: ZodIssueCode.invalid_string,
            ...errorUtil.errToObj(message),
        });
    }
    _addCheck(check) {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    email(message) {
        return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
    }
    url(message) {
        return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
    }
    emoji(message) {
        return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
    }
    uuid(message) {
        return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
    }
    cuid(message) {
        return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
    }
    cuid2(message) {
        return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
    }
    ulid(message) {
        return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
    }
    ip(options) {
        return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
    }
    datetime(options) {
        var _a;
        if (typeof options === "string") {
            return this._addCheck({
                kind: "datetime",
                precision: null,
                offset: false,
                message: options,
            });
        }
        return this._addCheck({
            kind: "datetime",
            precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
            offset: (_a = options === null || options === void 0 ? void 0 : options.offset) !== null && _a !== void 0 ? _a : false,
            ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message),
        });
    }
    regex(regex, message) {
        return this._addCheck({
            kind: "regex",
            regex: regex,
            ...errorUtil.errToObj(message),
        });
    }
    includes(value, options) {
        return this._addCheck({
            kind: "includes",
            value: value,
            position: options === null || options === void 0 ? void 0 : options.position,
            ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message),
        });
    }
    startsWith(value, message) {
        return this._addCheck({
            kind: "startsWith",
            value: value,
            ...errorUtil.errToObj(message),
        });
    }
    endsWith(value, message) {
        return this._addCheck({
            kind: "endsWith",
            value: value,
            ...errorUtil.errToObj(message),
        });
    }
    min(minLength, message) {
        return this._addCheck({
            kind: "min",
            value: minLength,
            ...errorUtil.errToObj(message),
        });
    }
    max(maxLength, message) {
        return this._addCheck({
            kind: "max",
            value: maxLength,
            ...errorUtil.errToObj(message),
        });
    }
    length(len, message) {
        return this._addCheck({
            kind: "length",
            value: len,
            ...errorUtil.errToObj(message),
        });
    }
    /**
     * @deprecated Use z.string().min(1) instead.
     * @see {@link ZodString.min}
     */
    nonempty(message) {
        return this.min(1, errorUtil.errToObj(message));
    }
    trim() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "trim" }],
        });
    }
    toLowerCase() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "toLowerCase" }],
        });
    }
    toUpperCase() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "toUpperCase" }],
        });
    }
    get isDatetime() {
        return !!this._def.checks.find((ch) => ch.kind === "datetime");
    }
    get isEmail() {
        return !!this._def.checks.find((ch) => ch.kind === "email");
    }
    get isURL() {
        return !!this._def.checks.find((ch) => ch.kind === "url");
    }
    get isEmoji() {
        return !!this._def.checks.find((ch) => ch.kind === "emoji");
    }
    get isUUID() {
        return !!this._def.checks.find((ch) => ch.kind === "uuid");
    }
    get isCUID() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid");
    }
    get isCUID2() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid2");
    }
    get isULID() {
        return !!this._def.checks.find((ch) => ch.kind === "ulid");
    }
    get isIP() {
        return !!this._def.checks.find((ch) => ch.kind === "ip");
    }
    get minLength() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxLength() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
}
ZodString.create = (params) => {
    var _a;
    return new ZodString({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodString,
        coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
        ...processCreateParams(params),
    });
};
// https://stackoverflow.com/questions/3966484/why-does-modulus-operator-return-fractional-number-in-javascript/31711034#31711034
function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = parseInt(step.toFixed(decCount).replace(".", ""));
    return (valInt % stepInt) / Math.pow(10, decCount);
}
class ZodNumber extends ZodType {
    constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
        this.step = this.multipleOf;
    }
    _parse(input) {
        if (this._def.coerce) {
            input.data = Number(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.number) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.number,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        let ctx = undefined;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
            if (check.kind === "int") {
                if (!util.isInteger(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_type,
                        expected: "integer",
                        received: "float",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "min") {
                const tooSmall = check.inclusive
                    ? input.data < check.value
                    : input.data <= check.value;
                if (tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        minimum: check.value,
                        type: "number",
                        inclusive: check.inclusive,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                const tooBig = check.inclusive
                    ? input.data > check.value
                    : input.data >= check.value;
                if (tooBig) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        maximum: check.value,
                        type: "number",
                        inclusive: check.inclusive,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "multipleOf") {
                if (floatSafeRemainder(input.data, check.value) !== 0) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_multiple_of,
                        multipleOf: check.value,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "finite") {
                if (!Number.isFinite(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_finite,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
        return new ZodNumber({
            ...this._def,
            checks: [
                ...this._def.checks,
                {
                    kind,
                    value,
                    inclusive,
                    message: errorUtil.toString(message),
                },
            ],
        });
    }
    _addCheck(check) {
        return new ZodNumber({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    int(message) {
        return this._addCheck({
            kind: "int",
            message: errorUtil.toString(message),
        });
    }
    positive(message) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    negative(message) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    nonpositive(message) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    nonnegative(message) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    multipleOf(value, message) {
        return this._addCheck({
            kind: "multipleOf",
            value: value,
            message: errorUtil.toString(message),
        });
    }
    finite(message) {
        return this._addCheck({
            kind: "finite",
            message: errorUtil.toString(message),
        });
    }
    safe(message) {
        return this._addCheck({
            kind: "min",
            inclusive: true,
            value: Number.MIN_SAFE_INTEGER,
            message: errorUtil.toString(message),
        })._addCheck({
            kind: "max",
            inclusive: true,
            value: Number.MAX_SAFE_INTEGER,
            message: errorUtil.toString(message),
        });
    }
    get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
    get isInt() {
        return !!this._def.checks.find((ch) => ch.kind === "int" ||
            (ch.kind === "multipleOf" && util.isInteger(ch.value)));
    }
    get isFinite() {
        let max = null, min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "finite" ||
                ch.kind === "int" ||
                ch.kind === "multipleOf") {
                return true;
            }
            else if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
            else if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return Number.isFinite(min) && Number.isFinite(max);
    }
}
ZodNumber.create = (params) => {
    return new ZodNumber({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodNumber,
        coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
        ...processCreateParams(params),
    });
};
class ZodBigInt extends ZodType {
    constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
    }
    _parse(input) {
        if (this._def.coerce) {
            input.data = BigInt(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.bigint) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.bigint,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        let ctx = undefined;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                const tooSmall = check.inclusive
                    ? input.data < check.value
                    : input.data <= check.value;
                if (tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        type: "bigint",
                        minimum: check.value,
                        inclusive: check.inclusive,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                const tooBig = check.inclusive
                    ? input.data > check.value
                    : input.data >= check.value;
                if (tooBig) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        type: "bigint",
                        maximum: check.value,
                        inclusive: check.inclusive,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "multipleOf") {
                if (input.data % check.value !== BigInt(0)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_multiple_of,
                        multipleOf: check.value,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
        return new ZodBigInt({
            ...this._def,
            checks: [
                ...this._def.checks,
                {
                    kind,
                    value,
                    inclusive,
                    message: errorUtil.toString(message),
                },
            ],
        });
    }
    _addCheck(check) {
        return new ZodBigInt({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    positive(message) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    negative(message) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    nonpositive(message) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    nonnegative(message) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    multipleOf(value, message) {
        return this._addCheck({
            kind: "multipleOf",
            value,
            message: errorUtil.toString(message),
        });
    }
    get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
}
ZodBigInt.create = (params) => {
    var _a;
    return new ZodBigInt({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodBigInt,
        coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
        ...processCreateParams(params),
    });
};
class ZodBoolean extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = Boolean(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.boolean) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.boolean,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodBoolean.create = (params) => {
    return new ZodBoolean({
        typeName: ZodFirstPartyTypeKind.ZodBoolean,
        coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
        ...processCreateParams(params),
    });
};
class ZodDate extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = new Date(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.date) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.date,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        if (isNaN(input.data.getTime())) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_date,
            });
            return INVALID;
        }
        const status = new ParseStatus();
        let ctx = undefined;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                if (input.data.getTime() < check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        message: check.message,
                        inclusive: true,
                        exact: false,
                        minimum: check.value,
                        type: "date",
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                if (input.data.getTime() > check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        message: check.message,
                        inclusive: true,
                        exact: false,
                        maximum: check.value,
                        type: "date",
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return {
            status: status.value,
            value: new Date(input.data.getTime()),
        };
    }
    _addCheck(check) {
        return new ZodDate({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    min(minDate, message) {
        return this._addCheck({
            kind: "min",
            value: minDate.getTime(),
            message: errorUtil.toString(message),
        });
    }
    max(maxDate, message) {
        return this._addCheck({
            kind: "max",
            value: maxDate.getTime(),
            message: errorUtil.toString(message),
        });
    }
    get minDate() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min != null ? new Date(min) : null;
    }
    get maxDate() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max != null ? new Date(max) : null;
    }
}
ZodDate.create = (params) => {
    return new ZodDate({
        checks: [],
        coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
        typeName: ZodFirstPartyTypeKind.ZodDate,
        ...processCreateParams(params),
    });
};
class ZodSymbol extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.symbol) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.symbol,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodSymbol.create = (params) => {
    return new ZodSymbol({
        typeName: ZodFirstPartyTypeKind.ZodSymbol,
        ...processCreateParams(params),
    });
};
class ZodUndefined extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.undefined,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodUndefined.create = (params) => {
    return new ZodUndefined({
        typeName: ZodFirstPartyTypeKind.ZodUndefined,
        ...processCreateParams(params),
    });
};
class ZodNull extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.null) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.null,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodNull.create = (params) => {
    return new ZodNull({
        typeName: ZodFirstPartyTypeKind.ZodNull,
        ...processCreateParams(params),
    });
};
class ZodAny extends ZodType {
    constructor() {
        super(...arguments);
        // to prevent instances of other classes from extending ZodAny. this causes issues with catchall in ZodObject.
        this._any = true;
    }
    _parse(input) {
        return OK(input.data);
    }
}
ZodAny.create = (params) => {
    return new ZodAny({
        typeName: ZodFirstPartyTypeKind.ZodAny,
        ...processCreateParams(params),
    });
};
class ZodUnknown extends ZodType {
    constructor() {
        super(...arguments);
        // required
        this._unknown = true;
    }
    _parse(input) {
        return OK(input.data);
    }
}
ZodUnknown.create = (params) => {
    return new ZodUnknown({
        typeName: ZodFirstPartyTypeKind.ZodUnknown,
        ...processCreateParams(params),
    });
};
class ZodNever extends ZodType {
    _parse(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.never,
            received: ctx.parsedType,
        });
        return INVALID;
    }
}
ZodNever.create = (params) => {
    return new ZodNever({
        typeName: ZodFirstPartyTypeKind.ZodNever,
        ...processCreateParams(params),
    });
};
class ZodVoid extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.void,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodVoid.create = (params) => {
    return new ZodVoid({
        typeName: ZodFirstPartyTypeKind.ZodVoid,
        ...processCreateParams(params),
    });
};
class ZodArray extends ZodType {
    _parse(input) {
        const { ctx, status } = this._processInputParams(input);
        const def = this._def;
        if (ctx.parsedType !== ZodParsedType.array) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.array,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        if (def.exactLength !== null) {
            const tooBig = ctx.data.length > def.exactLength.value;
            const tooSmall = ctx.data.length < def.exactLength.value;
            if (tooBig || tooSmall) {
                addIssueToContext(ctx, {
                    code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
                    minimum: (tooSmall ? def.exactLength.value : undefined),
                    maximum: (tooBig ? def.exactLength.value : undefined),
                    type: "array",
                    inclusive: true,
                    exact: true,
                    message: def.exactLength.message,
                });
                status.dirty();
            }
        }
        if (def.minLength !== null) {
            if (ctx.data.length < def.minLength.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_small,
                    minimum: def.minLength.value,
                    type: "array",
                    inclusive: true,
                    exact: false,
                    message: def.minLength.message,
                });
                status.dirty();
            }
        }
        if (def.maxLength !== null) {
            if (ctx.data.length > def.maxLength.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_big,
                    maximum: def.maxLength.value,
                    type: "array",
                    inclusive: true,
                    exact: false,
                    message: def.maxLength.message,
                });
                status.dirty();
            }
        }
        if (ctx.common.async) {
            return Promise.all([...ctx.data].map((item, i) => {
                return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
            })).then((result) => {
                return ParseStatus.mergeArray(status, result);
            });
        }
        const result = [...ctx.data].map((item, i) => {
            return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        });
        return ParseStatus.mergeArray(status, result);
    }
    get element() {
        return this._def.type;
    }
    min(minLength, message) {
        return new ZodArray({
            ...this._def,
            minLength: { value: minLength, message: errorUtil.toString(message) },
        });
    }
    max(maxLength, message) {
        return new ZodArray({
            ...this._def,
            maxLength: { value: maxLength, message: errorUtil.toString(message) },
        });
    }
    length(len, message) {
        return new ZodArray({
            ...this._def,
            exactLength: { value: len, message: errorUtil.toString(message) },
        });
    }
    nonempty(message) {
        return this.min(1, message);
    }
}
ZodArray.create = (schema, params) => {
    return new ZodArray({
        type: schema,
        minLength: null,
        maxLength: null,
        exactLength: null,
        typeName: ZodFirstPartyTypeKind.ZodArray,
        ...processCreateParams(params),
    });
};
function deepPartialify(schema) {
    if (schema instanceof ZodObject) {
        const newShape = {};
        for (const key in schema.shape) {
            const fieldSchema = schema.shape[key];
            newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
        }
        return new ZodObject({
            ...schema._def,
            shape: () => newShape,
        });
    }
    else if (schema instanceof ZodArray) {
        return new ZodArray({
            ...schema._def,
            type: deepPartialify(schema.element),
        });
    }
    else if (schema instanceof ZodOptional) {
        return ZodOptional.create(deepPartialify(schema.unwrap()));
    }
    else if (schema instanceof ZodNullable) {
        return ZodNullable.create(deepPartialify(schema.unwrap()));
    }
    else if (schema instanceof ZodTuple) {
        return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
    }
    else {
        return schema;
    }
}
class ZodObject extends ZodType {
    constructor() {
        super(...arguments);
        this._cached = null;
        /**
         * @deprecated In most cases, this is no longer needed - unknown properties are now silently stripped.
         * If you want to pass through unknown properties, use `.passthrough()` instead.
         */
        this.nonstrict = this.passthrough;
        // extend<
        //   Augmentation extends ZodRawShape,
        //   NewOutput extends util.flatten<{
        //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
        //       ? Augmentation[k]["_output"]
        //       : k extends keyof Output
        //       ? Output[k]
        //       : never;
        //   }>,
        //   NewInput extends util.flatten<{
        //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
        //       ? Augmentation[k]["_input"]
        //       : k extends keyof Input
        //       ? Input[k]
        //       : never;
        //   }>
        // >(
        //   augmentation: Augmentation
        // ): ZodObject<
        //   extendShape<T, Augmentation>,
        //   UnknownKeys,
        //   Catchall,
        //   NewOutput,
        //   NewInput
        // > {
        //   return new ZodObject({
        //     ...this._def,
        //     shape: () => ({
        //       ...this._def.shape(),
        //       ...augmentation,
        //     }),
        //   }) as any;
        // }
        /**
         * @deprecated Use `.extend` instead
         *  */
        this.augment = this.extend;
    }
    _getCached() {
        if (this._cached !== null)
            return this._cached;
        const shape = this._def.shape();
        const keys = util.objectKeys(shape);
        return (this._cached = { shape, keys });
    }
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.object) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const { status, ctx } = this._processInputParams(input);
        const { shape, keys: shapeKeys } = this._getCached();
        const extraKeys = [];
        if (!(this._def.catchall instanceof ZodNever &&
            this._def.unknownKeys === "strip")) {
            for (const key in ctx.data) {
                if (!shapeKeys.includes(key)) {
                    extraKeys.push(key);
                }
            }
        }
        const pairs = [];
        for (const key of shapeKeys) {
            const keyValidator = shape[key];
            const value = ctx.data[key];
            pairs.push({
                key: { status: "valid", value: key },
                value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
                alwaysSet: key in ctx.data,
            });
        }
        if (this._def.catchall instanceof ZodNever) {
            const unknownKeys = this._def.unknownKeys;
            if (unknownKeys === "passthrough") {
                for (const key of extraKeys) {
                    pairs.push({
                        key: { status: "valid", value: key },
                        value: { status: "valid", value: ctx.data[key] },
                    });
                }
            }
            else if (unknownKeys === "strict") {
                if (extraKeys.length > 0) {
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.unrecognized_keys,
                        keys: extraKeys,
                    });
                    status.dirty();
                }
            }
            else if (unknownKeys === "strip") ;
            else {
                throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
            }
        }
        else {
            // run catchall validation
            const catchall = this._def.catchall;
            for (const key of extraKeys) {
                const value = ctx.data[key];
                pairs.push({
                    key: { status: "valid", value: key },
                    value: catchall._parse(new ParseInputLazyPath(ctx, value, ctx.path, key) //, ctx.child(key), value, getParsedType(value)
                    ),
                    alwaysSet: key in ctx.data,
                });
            }
        }
        if (ctx.common.async) {
            return Promise.resolve()
                .then(async () => {
                const syncPairs = [];
                for (const pair of pairs) {
                    const key = await pair.key;
                    syncPairs.push({
                        key,
                        value: await pair.value,
                        alwaysSet: pair.alwaysSet,
                    });
                }
                return syncPairs;
            })
                .then((syncPairs) => {
                return ParseStatus.mergeObjectSync(status, syncPairs);
            });
        }
        else {
            return ParseStatus.mergeObjectSync(status, pairs);
        }
    }
    get shape() {
        return this._def.shape();
    }
    strict(message) {
        errorUtil.errToObj;
        return new ZodObject({
            ...this._def,
            unknownKeys: "strict",
            ...(message !== undefined
                ? {
                    errorMap: (issue, ctx) => {
                        var _a, _b, _c, _d;
                        const defaultError = (_c = (_b = (_a = this._def).errorMap) === null || _b === void 0 ? void 0 : _b.call(_a, issue, ctx).message) !== null && _c !== void 0 ? _c : ctx.defaultError;
                        if (issue.code === "unrecognized_keys")
                            return {
                                message: (_d = errorUtil.errToObj(message).message) !== null && _d !== void 0 ? _d : defaultError,
                            };
                        return {
                            message: defaultError,
                        };
                    },
                }
                : {}),
        });
    }
    strip() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "strip",
        });
    }
    passthrough() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "passthrough",
        });
    }
    // const AugmentFactory =
    //   <Def extends ZodObjectDef>(def: Def) =>
    //   <Augmentation extends ZodRawShape>(
    //     augmentation: Augmentation
    //   ): ZodObject<
    //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
    //     Def["unknownKeys"],
    //     Def["catchall"]
    //   > => {
    //     return new ZodObject({
    //       ...def,
    //       shape: () => ({
    //         ...def.shape(),
    //         ...augmentation,
    //       }),
    //     }) as any;
    //   };
    extend(augmentation) {
        return new ZodObject({
            ...this._def,
            shape: () => ({
                ...this._def.shape(),
                ...augmentation,
            }),
        });
    }
    /**
     * Prior to zod@1.0.12 there was a bug in the
     * inferred type of merged objects. Please
     * upgrade if you are experiencing issues.
     */
    merge(merging) {
        const merged = new ZodObject({
            unknownKeys: merging._def.unknownKeys,
            catchall: merging._def.catchall,
            shape: () => ({
                ...this._def.shape(),
                ...merging._def.shape(),
            }),
            typeName: ZodFirstPartyTypeKind.ZodObject,
        });
        return merged;
    }
    // merge<
    //   Incoming extends AnyZodObject,
    //   Augmentation extends Incoming["shape"],
    //   NewOutput extends {
    //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
    //       ? Augmentation[k]["_output"]
    //       : k extends keyof Output
    //       ? Output[k]
    //       : never;
    //   },
    //   NewInput extends {
    //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
    //       ? Augmentation[k]["_input"]
    //       : k extends keyof Input
    //       ? Input[k]
    //       : never;
    //   }
    // >(
    //   merging: Incoming
    // ): ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"],
    //   NewOutput,
    //   NewInput
    // > {
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    setKey(key, schema) {
        return this.augment({ [key]: schema });
    }
    // merge<Incoming extends AnyZodObject>(
    //   merging: Incoming
    // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
    // ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"]
    // > {
    //   // const mergedShape = objectUtil.mergeShapes(
    //   //   this._def.shape(),
    //   //   merging._def.shape()
    //   // );
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    catchall(index) {
        return new ZodObject({
            ...this._def,
            catchall: index,
        });
    }
    pick(mask) {
        const shape = {};
        util.objectKeys(mask).forEach((key) => {
            if (mask[key] && this.shape[key]) {
                shape[key] = this.shape[key];
            }
        });
        return new ZodObject({
            ...this._def,
            shape: () => shape,
        });
    }
    omit(mask) {
        const shape = {};
        util.objectKeys(this.shape).forEach((key) => {
            if (!mask[key]) {
                shape[key] = this.shape[key];
            }
        });
        return new ZodObject({
            ...this._def,
            shape: () => shape,
        });
    }
    /**
     * @deprecated
     */
    deepPartial() {
        return deepPartialify(this);
    }
    partial(mask) {
        const newShape = {};
        util.objectKeys(this.shape).forEach((key) => {
            const fieldSchema = this.shape[key];
            if (mask && !mask[key]) {
                newShape[key] = fieldSchema;
            }
            else {
                newShape[key] = fieldSchema.optional();
            }
        });
        return new ZodObject({
            ...this._def,
            shape: () => newShape,
        });
    }
    required(mask) {
        const newShape = {};
        util.objectKeys(this.shape).forEach((key) => {
            if (mask && !mask[key]) {
                newShape[key] = this.shape[key];
            }
            else {
                const fieldSchema = this.shape[key];
                let newField = fieldSchema;
                while (newField instanceof ZodOptional) {
                    newField = newField._def.innerType;
                }
                newShape[key] = newField;
            }
        });
        return new ZodObject({
            ...this._def,
            shape: () => newShape,
        });
    }
    keyof() {
        return createZodEnum(util.objectKeys(this.shape));
    }
}
ZodObject.create = (shape, params) => {
    return new ZodObject({
        shape: () => shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params),
    });
};
ZodObject.strictCreate = (shape, params) => {
    return new ZodObject({
        shape: () => shape,
        unknownKeys: "strict",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params),
    });
};
ZodObject.lazycreate = (shape, params) => {
    return new ZodObject({
        shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params),
    });
};
class ZodUnion extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const options = this._def.options;
        function handleResults(results) {
            // return first issue-free validation if it exists
            for (const result of results) {
                if (result.result.status === "valid") {
                    return result.result;
                }
            }
            for (const result of results) {
                if (result.result.status === "dirty") {
                    // add issues from dirty option
                    ctx.common.issues.push(...result.ctx.common.issues);
                    return result.result;
                }
            }
            // return invalid
            const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union,
                unionErrors,
            });
            return INVALID;
        }
        if (ctx.common.async) {
            return Promise.all(options.map(async (option) => {
                const childCtx = {
                    ...ctx,
                    common: {
                        ...ctx.common,
                        issues: [],
                    },
                    parent: null,
                };
                return {
                    result: await option._parseAsync({
                        data: ctx.data,
                        path: ctx.path,
                        parent: childCtx,
                    }),
                    ctx: childCtx,
                };
            })).then(handleResults);
        }
        else {
            let dirty = undefined;
            const issues = [];
            for (const option of options) {
                const childCtx = {
                    ...ctx,
                    common: {
                        ...ctx.common,
                        issues: [],
                    },
                    parent: null,
                };
                const result = option._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: childCtx,
                });
                if (result.status === "valid") {
                    return result;
                }
                else if (result.status === "dirty" && !dirty) {
                    dirty = { result, ctx: childCtx };
                }
                if (childCtx.common.issues.length) {
                    issues.push(childCtx.common.issues);
                }
            }
            if (dirty) {
                ctx.common.issues.push(...dirty.ctx.common.issues);
                return dirty.result;
            }
            const unionErrors = issues.map((issues) => new ZodError(issues));
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union,
                unionErrors,
            });
            return INVALID;
        }
    }
    get options() {
        return this._def.options;
    }
}
ZodUnion.create = (types, params) => {
    return new ZodUnion({
        options: types,
        typeName: ZodFirstPartyTypeKind.ZodUnion,
        ...processCreateParams(params),
    });
};
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
//////////                                 //////////
//////////      ZodDiscriminatedUnion      //////////
//////////                                 //////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
const getDiscriminator = (type) => {
    if (type instanceof ZodLazy) {
        return getDiscriminator(type.schema);
    }
    else if (type instanceof ZodEffects) {
        return getDiscriminator(type.innerType());
    }
    else if (type instanceof ZodLiteral) {
        return [type.value];
    }
    else if (type instanceof ZodEnum) {
        return type.options;
    }
    else if (type instanceof ZodNativeEnum) {
        // eslint-disable-next-line ban/ban
        return Object.keys(type.enum);
    }
    else if (type instanceof ZodDefault) {
        return getDiscriminator(type._def.innerType);
    }
    else if (type instanceof ZodUndefined) {
        return [undefined];
    }
    else if (type instanceof ZodNull) {
        return [null];
    }
    else {
        return null;
    }
};
class ZodDiscriminatedUnion extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const discriminator = this.discriminator;
        const discriminatorValue = ctx.data[discriminator];
        const option = this.optionsMap.get(discriminatorValue);
        if (!option) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union_discriminator,
                options: Array.from(this.optionsMap.keys()),
                path: [discriminator],
            });
            return INVALID;
        }
        if (ctx.common.async) {
            return option._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
        }
        else {
            return option._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
        }
    }
    get discriminator() {
        return this._def.discriminator;
    }
    get options() {
        return this._def.options;
    }
    get optionsMap() {
        return this._def.optionsMap;
    }
    /**
     * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
     * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
     * have a different value for each object in the union.
     * @param discriminator the name of the discriminator property
     * @param types an array of object schemas
     * @param params
     */
    static create(discriminator, options, params) {
        // Get all the valid discriminator values
        const optionsMap = new Map();
        // try {
        for (const type of options) {
            const discriminatorValues = getDiscriminator(type.shape[discriminator]);
            if (!discriminatorValues) {
                throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
            }
            for (const value of discriminatorValues) {
                if (optionsMap.has(value)) {
                    throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
                }
                optionsMap.set(value, type);
            }
        }
        return new ZodDiscriminatedUnion({
            typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
            discriminator,
            options,
            optionsMap,
            ...processCreateParams(params),
        });
    }
}
function mergeValues(a, b) {
    const aType = getParsedType(a);
    const bType = getParsedType(b);
    if (a === b) {
        return { valid: true, data: a };
    }
    else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
        const bKeys = util.objectKeys(b);
        const sharedKeys = util
            .objectKeys(a)
            .filter((key) => bKeys.indexOf(key) !== -1);
        const newObj = { ...a, ...b };
        for (const key of sharedKeys) {
            const sharedValue = mergeValues(a[key], b[key]);
            if (!sharedValue.valid) {
                return { valid: false };
            }
            newObj[key] = sharedValue.data;
        }
        return { valid: true, data: newObj };
    }
    else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
        if (a.length !== b.length) {
            return { valid: false };
        }
        const newArray = [];
        for (let index = 0; index < a.length; index++) {
            const itemA = a[index];
            const itemB = b[index];
            const sharedValue = mergeValues(itemA, itemB);
            if (!sharedValue.valid) {
                return { valid: false };
            }
            newArray.push(sharedValue.data);
        }
        return { valid: true, data: newArray };
    }
    else if (aType === ZodParsedType.date &&
        bType === ZodParsedType.date &&
        +a === +b) {
        return { valid: true, data: a };
    }
    else {
        return { valid: false };
    }
}
class ZodIntersection extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const handleParsed = (parsedLeft, parsedRight) => {
            if (isAborted(parsedLeft) || isAborted(parsedRight)) {
                return INVALID;
            }
            const merged = mergeValues(parsedLeft.value, parsedRight.value);
            if (!merged.valid) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.invalid_intersection_types,
                });
                return INVALID;
            }
            if (isDirty(parsedLeft) || isDirty(parsedRight)) {
                status.dirty();
            }
            return { status: status.value, value: merged.data };
        };
        if (ctx.common.async) {
            return Promise.all([
                this._def.left._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                }),
                this._def.right._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                }),
            ]).then(([left, right]) => handleParsed(left, right));
        }
        else {
            return handleParsed(this._def.left._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            }), this._def.right._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            }));
        }
    }
}
ZodIntersection.create = (left, right, params) => {
    return new ZodIntersection({
        left: left,
        right: right,
        typeName: ZodFirstPartyTypeKind.ZodIntersection,
        ...processCreateParams(params),
    });
};
class ZodTuple extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.array) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.array,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        if (ctx.data.length < this._def.items.length) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: this._def.items.length,
                inclusive: true,
                exact: false,
                type: "array",
            });
            return INVALID;
        }
        const rest = this._def.rest;
        if (!rest && ctx.data.length > this._def.items.length) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: this._def.items.length,
                inclusive: true,
                exact: false,
                type: "array",
            });
            status.dirty();
        }
        const items = [...ctx.data]
            .map((item, itemIndex) => {
            const schema = this._def.items[itemIndex] || this._def.rest;
            if (!schema)
                return null;
            return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
        })
            .filter((x) => !!x); // filter nulls
        if (ctx.common.async) {
            return Promise.all(items).then((results) => {
                return ParseStatus.mergeArray(status, results);
            });
        }
        else {
            return ParseStatus.mergeArray(status, items);
        }
    }
    get items() {
        return this._def.items;
    }
    rest(rest) {
        return new ZodTuple({
            ...this._def,
            rest,
        });
    }
}
ZodTuple.create = (schemas, params) => {
    if (!Array.isArray(schemas)) {
        throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    }
    return new ZodTuple({
        items: schemas,
        typeName: ZodFirstPartyTypeKind.ZodTuple,
        rest: null,
        ...processCreateParams(params),
    });
};
class ZodRecord extends ZodType {
    get keySchema() {
        return this._def.keyType;
    }
    get valueSchema() {
        return this._def.valueType;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const pairs = [];
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        for (const key in ctx.data) {
            pairs.push({
                key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
                value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
            });
        }
        if (ctx.common.async) {
            return ParseStatus.mergeObjectAsync(status, pairs);
        }
        else {
            return ParseStatus.mergeObjectSync(status, pairs);
        }
    }
    get element() {
        return this._def.valueType;
    }
    static create(first, second, third) {
        if (second instanceof ZodType) {
            return new ZodRecord({
                keyType: first,
                valueType: second,
                typeName: ZodFirstPartyTypeKind.ZodRecord,
                ...processCreateParams(third),
            });
        }
        return new ZodRecord({
            keyType: ZodString.create(),
            valueType: first,
            typeName: ZodFirstPartyTypeKind.ZodRecord,
            ...processCreateParams(second),
        });
    }
}
class ZodMap extends ZodType {
    get keySchema() {
        return this._def.keyType;
    }
    get valueSchema() {
        return this._def.valueType;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.map) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.map,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        const pairs = [...ctx.data.entries()].map(([key, value], index) => {
            return {
                key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
                value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"])),
            };
        });
        if (ctx.common.async) {
            const finalMap = new Map();
            return Promise.resolve().then(async () => {
                for (const pair of pairs) {
                    const key = await pair.key;
                    const value = await pair.value;
                    if (key.status === "aborted" || value.status === "aborted") {
                        return INVALID;
                    }
                    if (key.status === "dirty" || value.status === "dirty") {
                        status.dirty();
                    }
                    finalMap.set(key.value, value.value);
                }
                return { status: status.value, value: finalMap };
            });
        }
        else {
            const finalMap = new Map();
            for (const pair of pairs) {
                const key = pair.key;
                const value = pair.value;
                if (key.status === "aborted" || value.status === "aborted") {
                    return INVALID;
                }
                if (key.status === "dirty" || value.status === "dirty") {
                    status.dirty();
                }
                finalMap.set(key.value, value.value);
            }
            return { status: status.value, value: finalMap };
        }
    }
}
ZodMap.create = (keyType, valueType, params) => {
    return new ZodMap({
        valueType,
        keyType,
        typeName: ZodFirstPartyTypeKind.ZodMap,
        ...processCreateParams(params),
    });
};
class ZodSet extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.set) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.set,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const def = this._def;
        if (def.minSize !== null) {
            if (ctx.data.size < def.minSize.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_small,
                    minimum: def.minSize.value,
                    type: "set",
                    inclusive: true,
                    exact: false,
                    message: def.minSize.message,
                });
                status.dirty();
            }
        }
        if (def.maxSize !== null) {
            if (ctx.data.size > def.maxSize.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_big,
                    maximum: def.maxSize.value,
                    type: "set",
                    inclusive: true,
                    exact: false,
                    message: def.maxSize.message,
                });
                status.dirty();
            }
        }
        const valueType = this._def.valueType;
        function finalizeSet(elements) {
            const parsedSet = new Set();
            for (const element of elements) {
                if (element.status === "aborted")
                    return INVALID;
                if (element.status === "dirty")
                    status.dirty();
                parsedSet.add(element.value);
            }
            return { status: status.value, value: parsedSet };
        }
        const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
        if (ctx.common.async) {
            return Promise.all(elements).then((elements) => finalizeSet(elements));
        }
        else {
            return finalizeSet(elements);
        }
    }
    min(minSize, message) {
        return new ZodSet({
            ...this._def,
            minSize: { value: minSize, message: errorUtil.toString(message) },
        });
    }
    max(maxSize, message) {
        return new ZodSet({
            ...this._def,
            maxSize: { value: maxSize, message: errorUtil.toString(message) },
        });
    }
    size(size, message) {
        return this.min(size, message).max(size, message);
    }
    nonempty(message) {
        return this.min(1, message);
    }
}
ZodSet.create = (valueType, params) => {
    return new ZodSet({
        valueType,
        minSize: null,
        maxSize: null,
        typeName: ZodFirstPartyTypeKind.ZodSet,
        ...processCreateParams(params),
    });
};
class ZodFunction extends ZodType {
    constructor() {
        super(...arguments);
        this.validate = this.implement;
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.function) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.function,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        function makeArgsIssue(args, error) {
            return makeIssue({
                data: args,
                path: ctx.path,
                errorMaps: [
                    ctx.common.contextualErrorMap,
                    ctx.schemaErrorMap,
                    getErrorMap(),
                    errorMap,
                ].filter((x) => !!x),
                issueData: {
                    code: ZodIssueCode.invalid_arguments,
                    argumentsError: error,
                },
            });
        }
        function makeReturnsIssue(returns, error) {
            return makeIssue({
                data: returns,
                path: ctx.path,
                errorMaps: [
                    ctx.common.contextualErrorMap,
                    ctx.schemaErrorMap,
                    getErrorMap(),
                    errorMap,
                ].filter((x) => !!x),
                issueData: {
                    code: ZodIssueCode.invalid_return_type,
                    returnTypeError: error,
                },
            });
        }
        const params = { errorMap: ctx.common.contextualErrorMap };
        const fn = ctx.data;
        if (this._def.returns instanceof ZodPromise) {
            // Would love a way to avoid disabling this rule, but we need
            // an alias (using an arrow function was what caused 2651).
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const me = this;
            return OK(async function (...args) {
                const error = new ZodError([]);
                const parsedArgs = await me._def.args
                    .parseAsync(args, params)
                    .catch((e) => {
                    error.addIssue(makeArgsIssue(args, e));
                    throw error;
                });
                const result = await Reflect.apply(fn, this, parsedArgs);
                const parsedReturns = await me._def.returns._def.type
                    .parseAsync(result, params)
                    .catch((e) => {
                    error.addIssue(makeReturnsIssue(result, e));
                    throw error;
                });
                return parsedReturns;
            });
        }
        else {
            // Would love a way to avoid disabling this rule, but we need
            // an alias (using an arrow function was what caused 2651).
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const me = this;
            return OK(function (...args) {
                const parsedArgs = me._def.args.safeParse(args, params);
                if (!parsedArgs.success) {
                    throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
                }
                const result = Reflect.apply(fn, this, parsedArgs.data);
                const parsedReturns = me._def.returns.safeParse(result, params);
                if (!parsedReturns.success) {
                    throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
                }
                return parsedReturns.data;
            });
        }
    }
    parameters() {
        return this._def.args;
    }
    returnType() {
        return this._def.returns;
    }
    args(...items) {
        return new ZodFunction({
            ...this._def,
            args: ZodTuple.create(items).rest(ZodUnknown.create()),
        });
    }
    returns(returnType) {
        return new ZodFunction({
            ...this._def,
            returns: returnType,
        });
    }
    implement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
    }
    strictImplement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
    }
    static create(args, returns, params) {
        return new ZodFunction({
            args: (args
                ? args
                : ZodTuple.create([]).rest(ZodUnknown.create())),
            returns: returns || ZodUnknown.create(),
            typeName: ZodFirstPartyTypeKind.ZodFunction,
            ...processCreateParams(params),
        });
    }
}
class ZodLazy extends ZodType {
    get schema() {
        return this._def.getter();
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const lazySchema = this._def.getter();
        return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
    }
}
ZodLazy.create = (getter, params) => {
    return new ZodLazy({
        getter: getter,
        typeName: ZodFirstPartyTypeKind.ZodLazy,
        ...processCreateParams(params),
    });
};
class ZodLiteral extends ZodType {
    _parse(input) {
        if (input.data !== this._def.value) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_literal,
                expected: this._def.value,
            });
            return INVALID;
        }
        return { status: "valid", value: input.data };
    }
    get value() {
        return this._def.value;
    }
}
ZodLiteral.create = (value, params) => {
    return new ZodLiteral({
        value: value,
        typeName: ZodFirstPartyTypeKind.ZodLiteral,
        ...processCreateParams(params),
    });
};
function createZodEnum(values, params) {
    return new ZodEnum({
        values,
        typeName: ZodFirstPartyTypeKind.ZodEnum,
        ...processCreateParams(params),
    });
}
class ZodEnum extends ZodType {
    _parse(input) {
        if (typeof input.data !== "string") {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext(ctx, {
                expected: util.joinValues(expectedValues),
                received: ctx.parsedType,
                code: ZodIssueCode.invalid_type,
            });
            return INVALID;
        }
        if (this._def.values.indexOf(input.data) === -1) {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_enum_value,
                options: expectedValues,
            });
            return INVALID;
        }
        return OK(input.data);
    }
    get options() {
        return this._def.values;
    }
    get enum() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    get Values() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    get Enum() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    extract(values) {
        return ZodEnum.create(values);
    }
    exclude(values) {
        return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)));
    }
}
ZodEnum.create = createZodEnum;
class ZodNativeEnum extends ZodType {
    _parse(input) {
        const nativeEnumValues = util.getValidEnumValues(this._def.values);
        const ctx = this._getOrReturnCtx(input);
        if (ctx.parsedType !== ZodParsedType.string &&
            ctx.parsedType !== ZodParsedType.number) {
            const expectedValues = util.objectValues(nativeEnumValues);
            addIssueToContext(ctx, {
                expected: util.joinValues(expectedValues),
                received: ctx.parsedType,
                code: ZodIssueCode.invalid_type,
            });
            return INVALID;
        }
        if (nativeEnumValues.indexOf(input.data) === -1) {
            const expectedValues = util.objectValues(nativeEnumValues);
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_enum_value,
                options: expectedValues,
            });
            return INVALID;
        }
        return OK(input.data);
    }
    get enum() {
        return this._def.values;
    }
}
ZodNativeEnum.create = (values, params) => {
    return new ZodNativeEnum({
        values: values,
        typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
        ...processCreateParams(params),
    });
};
class ZodPromise extends ZodType {
    unwrap() {
        return this._def.type;
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.promise &&
            ctx.common.async === false) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.promise,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const promisified = ctx.parsedType === ZodParsedType.promise
            ? ctx.data
            : Promise.resolve(ctx.data);
        return OK(promisified.then((data) => {
            return this._def.type.parseAsync(data, {
                path: ctx.path,
                errorMap: ctx.common.contextualErrorMap,
            });
        }));
    }
}
ZodPromise.create = (schema, params) => {
    return new ZodPromise({
        type: schema,
        typeName: ZodFirstPartyTypeKind.ZodPromise,
        ...processCreateParams(params),
    });
};
class ZodEffects extends ZodType {
    innerType() {
        return this._def.schema;
    }
    sourceType() {
        return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects
            ? this._def.schema.sourceType()
            : this._def.schema;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const effect = this._def.effect || null;
        const checkCtx = {
            addIssue: (arg) => {
                addIssueToContext(ctx, arg);
                if (arg.fatal) {
                    status.abort();
                }
                else {
                    status.dirty();
                }
            },
            get path() {
                return ctx.path;
            },
        };
        checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
        if (effect.type === "preprocess") {
            const processed = effect.transform(ctx.data, checkCtx);
            if (ctx.common.issues.length) {
                return {
                    status: "dirty",
                    value: ctx.data,
                };
            }
            if (ctx.common.async) {
                return Promise.resolve(processed).then((processed) => {
                    return this._def.schema._parseAsync({
                        data: processed,
                        path: ctx.path,
                        parent: ctx,
                    });
                });
            }
            else {
                return this._def.schema._parseSync({
                    data: processed,
                    path: ctx.path,
                    parent: ctx,
                });
            }
        }
        if (effect.type === "refinement") {
            const executeRefinement = (acc
            // effect: RefinementEffect<any>
            ) => {
                const result = effect.refinement(acc, checkCtx);
                if (ctx.common.async) {
                    return Promise.resolve(result);
                }
                if (result instanceof Promise) {
                    throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
                }
                return acc;
            };
            if (ctx.common.async === false) {
                const inner = this._def.schema._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (inner.status === "aborted")
                    return INVALID;
                if (inner.status === "dirty")
                    status.dirty();
                // return value is ignored
                executeRefinement(inner.value);
                return { status: status.value, value: inner.value };
            }
            else {
                return this._def.schema
                    ._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx })
                    .then((inner) => {
                    if (inner.status === "aborted")
                        return INVALID;
                    if (inner.status === "dirty")
                        status.dirty();
                    return executeRefinement(inner.value).then(() => {
                        return { status: status.value, value: inner.value };
                    });
                });
            }
        }
        if (effect.type === "transform") {
            if (ctx.common.async === false) {
                const base = this._def.schema._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (!isValid(base))
                    return base;
                const result = effect.transform(base.value, checkCtx);
                if (result instanceof Promise) {
                    throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
                }
                return { status: status.value, value: result };
            }
            else {
                return this._def.schema
                    ._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx })
                    .then((base) => {
                    if (!isValid(base))
                        return base;
                    return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({ status: status.value, value: result }));
                });
            }
        }
        util.assertNever(effect);
    }
}
ZodEffects.create = (schema, effect, params) => {
    return new ZodEffects({
        schema,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect,
        ...processCreateParams(params),
    });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
    return new ZodEffects({
        schema,
        effect: { type: "preprocess", transform: preprocess },
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        ...processCreateParams(params),
    });
};
class ZodOptional extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.undefined) {
            return OK(undefined);
        }
        return this._def.innerType._parse(input);
    }
    unwrap() {
        return this._def.innerType;
    }
}
ZodOptional.create = (type, params) => {
    return new ZodOptional({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodOptional,
        ...processCreateParams(params),
    });
};
class ZodNullable extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.null) {
            return OK(null);
        }
        return this._def.innerType._parse(input);
    }
    unwrap() {
        return this._def.innerType;
    }
}
ZodNullable.create = (type, params) => {
    return new ZodNullable({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodNullable,
        ...processCreateParams(params),
    });
};
class ZodDefault extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        let data = ctx.data;
        if (ctx.parsedType === ZodParsedType.undefined) {
            data = this._def.defaultValue();
        }
        return this._def.innerType._parse({
            data,
            path: ctx.path,
            parent: ctx,
        });
    }
    removeDefault() {
        return this._def.innerType;
    }
}
ZodDefault.create = (type, params) => {
    return new ZodDefault({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodDefault,
        defaultValue: typeof params.default === "function"
            ? params.default
            : () => params.default,
        ...processCreateParams(params),
    });
};
class ZodCatch extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        // newCtx is used to not collect issues from inner types in ctx
        const newCtx = {
            ...ctx,
            common: {
                ...ctx.common,
                issues: [],
            },
        };
        const result = this._def.innerType._parse({
            data: newCtx.data,
            path: newCtx.path,
            parent: {
                ...newCtx,
            },
        });
        if (isAsync(result)) {
            return result.then((result) => {
                return {
                    status: "valid",
                    value: result.status === "valid"
                        ? result.value
                        : this._def.catchValue({
                            get error() {
                                return new ZodError(newCtx.common.issues);
                            },
                            input: newCtx.data,
                        }),
                };
            });
        }
        else {
            return {
                status: "valid",
                value: result.status === "valid"
                    ? result.value
                    : this._def.catchValue({
                        get error() {
                            return new ZodError(newCtx.common.issues);
                        },
                        input: newCtx.data,
                    }),
            };
        }
    }
    removeCatch() {
        return this._def.innerType;
    }
}
ZodCatch.create = (type, params) => {
    return new ZodCatch({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodCatch,
        catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
        ...processCreateParams(params),
    });
};
class ZodNaN extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.nan) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.nan,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return { status: "valid", value: input.data };
    }
}
ZodNaN.create = (params) => {
    return new ZodNaN({
        typeName: ZodFirstPartyTypeKind.ZodNaN,
        ...processCreateParams(params),
    });
};
const BRAND = Symbol("zod_brand");
class ZodBranded extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const data = ctx.data;
        return this._def.type._parse({
            data,
            path: ctx.path,
            parent: ctx,
        });
    }
    unwrap() {
        return this._def.type;
    }
}
class ZodPipeline extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.common.async) {
            const handleAsync = async () => {
                const inResult = await this._def.in._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (inResult.status === "aborted")
                    return INVALID;
                if (inResult.status === "dirty") {
                    status.dirty();
                    return DIRTY(inResult.value);
                }
                else {
                    return this._def.out._parseAsync({
                        data: inResult.value,
                        path: ctx.path,
                        parent: ctx,
                    });
                }
            };
            return handleAsync();
        }
        else {
            const inResult = this._def.in._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
            if (inResult.status === "aborted")
                return INVALID;
            if (inResult.status === "dirty") {
                status.dirty();
                return {
                    status: "dirty",
                    value: inResult.value,
                };
            }
            else {
                return this._def.out._parseSync({
                    data: inResult.value,
                    path: ctx.path,
                    parent: ctx,
                });
            }
        }
    }
    static create(a, b) {
        return new ZodPipeline({
            in: a,
            out: b,
            typeName: ZodFirstPartyTypeKind.ZodPipeline,
        });
    }
}
class ZodReadonly extends ZodType {
    _parse(input) {
        const result = this._def.innerType._parse(input);
        if (isValid(result)) {
            result.value = Object.freeze(result.value);
        }
        return result;
    }
}
ZodReadonly.create = (type, params) => {
    return new ZodReadonly({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodReadonly,
        ...processCreateParams(params),
    });
};
const custom = (check, params = {}, 
/**
 * @deprecated
 *
 * Pass `fatal` into the params object instead:
 *
 * ```ts
 * z.string().custom((val) => val.length > 5, { fatal: false })
 * ```
 *
 */
fatal) => {
    if (check)
        return ZodAny.create().superRefine((data, ctx) => {
            var _a, _b;
            if (!check(data)) {
                const p = typeof params === "function"
                    ? params(data)
                    : typeof params === "string"
                        ? { message: params }
                        : params;
                const _fatal = (_b = (_a = p.fatal) !== null && _a !== void 0 ? _a : fatal) !== null && _b !== void 0 ? _b : true;
                const p2 = typeof p === "string" ? { message: p } : p;
                ctx.addIssue({ code: "custom", ...p2, fatal: _fatal });
            }
        });
    return ZodAny.create();
};
const late = {
    object: ZodObject.lazycreate,
};
var ZodFirstPartyTypeKind;
(function (ZodFirstPartyTypeKind) {
    ZodFirstPartyTypeKind["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind["ZodSymbol"] = "ZodSymbol";
    ZodFirstPartyTypeKind["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind["ZodCatch"] = "ZodCatch";
    ZodFirstPartyTypeKind["ZodPromise"] = "ZodPromise";
    ZodFirstPartyTypeKind["ZodBranded"] = "ZodBranded";
    ZodFirstPartyTypeKind["ZodPipeline"] = "ZodPipeline";
    ZodFirstPartyTypeKind["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
const instanceOfType = (
// const instanceOfType = <T extends new (...args: any[]) => any>(
cls, params = {
    message: `Input not instance of ${cls.name}`,
}) => custom((data) => data instanceof cls, params);
const stringType = ZodString.create;
const numberType = ZodNumber.create;
const nanType = ZodNaN.create;
const bigIntType = ZodBigInt.create;
const booleanType = ZodBoolean.create;
const dateType = ZodDate.create;
const symbolType = ZodSymbol.create;
const undefinedType = ZodUndefined.create;
const nullType = ZodNull.create;
const anyType = ZodAny.create;
const unknownType = ZodUnknown.create;
const neverType = ZodNever.create;
const voidType = ZodVoid.create;
const arrayType = ZodArray.create;
const objectType = ZodObject.create;
const strictObjectType = ZodObject.strictCreate;
const unionType = ZodUnion.create;
const discriminatedUnionType = ZodDiscriminatedUnion.create;
const intersectionType = ZodIntersection.create;
const tupleType = ZodTuple.create;
const recordType = ZodRecord.create;
const mapType = ZodMap.create;
const setType = ZodSet.create;
const functionType = ZodFunction.create;
const lazyType = ZodLazy.create;
const literalType = ZodLiteral.create;
const enumType = ZodEnum.create;
const nativeEnumType = ZodNativeEnum.create;
const promiseType = ZodPromise.create;
const effectsType = ZodEffects.create;
const optionalType = ZodOptional.create;
const nullableType = ZodNullable.create;
const preprocessType = ZodEffects.createWithPreprocess;
const pipelineType = ZodPipeline.create;
const ostring = () => stringType().optional();
const onumber = () => numberType().optional();
const oboolean = () => booleanType().optional();
const coerce = {
    string: ((arg) => ZodString.create({ ...arg, coerce: true })),
    number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
    boolean: ((arg) => ZodBoolean.create({
        ...arg,
        coerce: true,
    })),
    bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
    date: ((arg) => ZodDate.create({ ...arg, coerce: true })),
};
const NEVER = INVALID;

var z = /*#__PURE__*/Object.freeze({
    __proto__: null,
    defaultErrorMap: errorMap,
    setErrorMap: setErrorMap,
    getErrorMap: getErrorMap,
    makeIssue: makeIssue,
    EMPTY_PATH: EMPTY_PATH,
    addIssueToContext: addIssueToContext,
    ParseStatus: ParseStatus,
    INVALID: INVALID,
    DIRTY: DIRTY,
    OK: OK,
    isAborted: isAborted,
    isDirty: isDirty,
    isValid: isValid,
    isAsync: isAsync,
    get util () { return util; },
    get objectUtil () { return objectUtil; },
    ZodParsedType: ZodParsedType,
    getParsedType: getParsedType,
    ZodType: ZodType,
    ZodString: ZodString,
    ZodNumber: ZodNumber,
    ZodBigInt: ZodBigInt,
    ZodBoolean: ZodBoolean,
    ZodDate: ZodDate,
    ZodSymbol: ZodSymbol,
    ZodUndefined: ZodUndefined,
    ZodNull: ZodNull,
    ZodAny: ZodAny,
    ZodUnknown: ZodUnknown,
    ZodNever: ZodNever,
    ZodVoid: ZodVoid,
    ZodArray: ZodArray,
    ZodObject: ZodObject,
    ZodUnion: ZodUnion,
    ZodDiscriminatedUnion: ZodDiscriminatedUnion,
    ZodIntersection: ZodIntersection,
    ZodTuple: ZodTuple,
    ZodRecord: ZodRecord,
    ZodMap: ZodMap,
    ZodSet: ZodSet,
    ZodFunction: ZodFunction,
    ZodLazy: ZodLazy,
    ZodLiteral: ZodLiteral,
    ZodEnum: ZodEnum,
    ZodNativeEnum: ZodNativeEnum,
    ZodPromise: ZodPromise,
    ZodEffects: ZodEffects,
    ZodTransformer: ZodEffects,
    ZodOptional: ZodOptional,
    ZodNullable: ZodNullable,
    ZodDefault: ZodDefault,
    ZodCatch: ZodCatch,
    ZodNaN: ZodNaN,
    BRAND: BRAND,
    ZodBranded: ZodBranded,
    ZodPipeline: ZodPipeline,
    ZodReadonly: ZodReadonly,
    custom: custom,
    Schema: ZodType,
    ZodSchema: ZodType,
    late: late,
    get ZodFirstPartyTypeKind () { return ZodFirstPartyTypeKind; },
    coerce: coerce,
    any: anyType,
    array: arrayType,
    bigint: bigIntType,
    boolean: booleanType,
    date: dateType,
    discriminatedUnion: discriminatedUnionType,
    effect: effectsType,
    'enum': enumType,
    'function': functionType,
    'instanceof': instanceOfType,
    intersection: intersectionType,
    lazy: lazyType,
    literal: literalType,
    map: mapType,
    nan: nanType,
    nativeEnum: nativeEnumType,
    never: neverType,
    'null': nullType,
    nullable: nullableType,
    number: numberType,
    object: objectType,
    oboolean: oboolean,
    onumber: onumber,
    optional: optionalType,
    ostring: ostring,
    pipeline: pipelineType,
    preprocess: preprocessType,
    promise: promiseType,
    record: recordType,
    set: setType,
    strictObject: strictObjectType,
    string: stringType,
    symbol: symbolType,
    transformer: effectsType,
    tuple: tupleType,
    'undefined': undefinedType,
    union: unionType,
    unknown: unknownType,
    'void': voidType,
    NEVER: NEVER,
    ZodIssueCode: ZodIssueCode,
    quotelessJson: quotelessJson,
    ZodError: ZodError
});

// src/shared/constants/extension-types.ts
var APP_EXTENSION_TYPES = ["interface", "display", "layout", "module", "panel", "theme"];
var API_EXTENSION_TYPES = ["hook", "endpoint"];
var HYBRID_EXTENSION_TYPES = ["operation"];
var BUNDLE_EXTENSION_TYPES = ["bundle"];
[
  ...APP_EXTENSION_TYPES,
  ...API_EXTENSION_TYPES,
  ...HYBRID_EXTENSION_TYPES,
  ...BUNDLE_EXTENSION_TYPES
];
[
  ...APP_EXTENSION_TYPES,
  ...API_EXTENSION_TYPES,
  ...HYBRID_EXTENSION_TYPES
];
[...APP_EXTENSION_TYPES, ...HYBRID_EXTENSION_TYPES];

// src/shared/constants/pkg-key.ts
var EXTENSION_PKG_KEY = "directus:extension";
var SplitEntrypoint = z.object({
  app: z.string(),
  api: z.string()
});
var ExtensionSandboxRequestedScopes = z.object({
  request: z.optional(
    z.object({
      urls: z.array(z.string()),
      methods: z.array(
        z.union([z.literal("GET"), z.literal("POST"), z.literal("PATCH"), z.literal("PUT"), z.literal("DELETE")])
      )
    })
  ),
  log: z.optional(z.object({})),
  sleep: z.optional(z.object({}))
});
var ExtensionSandboxOptions = z.optional(
  z.object({
    enabled: z.boolean(),
    requestedScopes: ExtensionSandboxRequestedScopes
  })
);
var ExtensionOptionsBundleEntry = z.union([
  z.object({
    type: z.enum(API_EXTENSION_TYPES),
    name: z.string(),
    source: z.string()
  }),
  z.object({
    type: z.enum(APP_EXTENSION_TYPES),
    name: z.string(),
    source: z.string()
  }),
  z.object({
    type: z.enum(HYBRID_EXTENSION_TYPES),
    name: z.string(),
    source: SplitEntrypoint
  })
]);
var ExtensionOptionsBase = z.object({
  host: z.string(),
  hidden: z.boolean().optional()
});
var ExtensionOptionsApp = z.object({
  type: z.enum(APP_EXTENSION_TYPES),
  path: z.string(),
  source: z.string()
});
var ExtensionOptionsApi = z.object({
  type: z.enum(API_EXTENSION_TYPES),
  path: z.string(),
  source: z.string(),
  sandbox: ExtensionSandboxOptions
});
var ExtensionOptionsHybrid = z.object({
  type: z.enum(HYBRID_EXTENSION_TYPES),
  path: SplitEntrypoint,
  source: SplitEntrypoint,
  sandbox: ExtensionSandboxOptions
});
var ExtensionOptionsBundle = z.object({
  type: z.literal("bundle"),
  partial: z.boolean().optional(),
  path: SplitEntrypoint,
  entries: z.array(ExtensionOptionsBundleEntry)
});
z.array(ExtensionOptionsBundleEntry);
var ExtensionOptions = ExtensionOptionsBase.and(
  z.union([ExtensionOptionsApp, ExtensionOptionsApi, ExtensionOptionsHybrid, ExtensionOptionsBundle])
);

// src/shared/schemas/manifest.ts
z.object({
  name: z.string(),
  version: z.string(),
  type: z.union([z.literal("module"), z.literal("commonjs")]).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  [EXTENSION_PKG_KEY]: ExtensionOptions
});
function defineEndpoint(config) {
  return config;
}

/*
 * liquidjs@10.12.0, https://github.com/harttle/liquidjs
 * (c) 2016-2024 harttle
 * Released under the MIT License.
 */

class Token {
    constructor(kind, input, begin, end, file) {
        this.kind = kind;
        this.input = input;
        this.begin = begin;
        this.end = end;
        this.file = file;
    }
    getText() {
        return this.input.slice(this.begin, this.end);
    }
    getPosition() {
        let [row, col] = [1, 1];
        for (let i = 0; i < this.begin; i++) {
            if (this.input[i] === '\n') {
                row++;
                col = 1;
            }
            else
                col++;
        }
        return [row, col];
    }
    size() {
        return this.end - this.begin;
    }
}

class Drop {
    liquidMethodMissing(key) {
        return undefined;
    }
}

const toString$1 = Object.prototype.toString;
const toLowerCase = String.prototype.toLowerCase;
const hasOwnProperty = Object.hasOwnProperty;
function isString(value) {
    return typeof value === 'string';
}
// eslint-disable-next-line @typescript-eslint/ban-types
function isFunction(value) {
    return typeof value === 'function';
}
function isPromise(val) {
    return val && isFunction(val.then);
}
function isIterator(val) {
    return val && isFunction(val.next) && isFunction(val.throw) && isFunction(val.return);
}
function escapeRegex(str) {
    return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}
function promisify(fn) {
    return function (...args) {
        return new Promise((resolve, reject) => {
            fn(...args, (err, result) => {
                err ? reject(err) : resolve(result);
            });
        });
    };
}
function stringify(value) {
    value = toValue(value);
    if (isString(value))
        return value;
    if (isNil(value))
        return '';
    if (isArray(value))
        return value.map(x => stringify(x)).join('');
    return String(value);
}
function toEnumerable(val) {
    val = toValue(val);
    if (isArray(val))
        return val;
    if (isString(val) && val.length > 0)
        return [val];
    if (isIterable(val))
        return Array.from(val);
    if (isObject(val))
        return Object.keys(val).map((key) => [key, val[key]]);
    return [];
}
function toArray(val) {
    val = toValue(val);
    if (isNil(val))
        return [];
    if (isArray(val))
        return val;
    return [val];
}
function toValue(value) {
    return (value instanceof Drop && isFunction(value.valueOf)) ? value.valueOf() : value;
}
function isNumber(value) {
    return typeof value === 'number';
}
function toLiquid(value) {
    if (value && isFunction(value.toLiquid))
        return toLiquid(value.toLiquid());
    return value;
}
function isNil(value) {
    return value == null;
}
function isUndefined(value) {
    return value === undefined;
}
function isArray(value) {
    // be compatible with IE 8
    return toString$1.call(value) === '[object Array]';
}
function isIterable(value) {
    return isObject(value) && Symbol.iterator in value;
}
/*
 * Iterates over own enumerable string keyed properties of an object and invokes iteratee for each property.
 * The iteratee is invoked with three arguments: (value, key, object).
 * Iteratee functions may exit iteration early by explicitly returning false.
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @return {Object} Returns object.
 */
function forOwn(obj, iteratee) {
    obj = obj || {};
    for (const k in obj) {
        if (hasOwnProperty.call(obj, k)) {
            if (iteratee(obj[k], k, obj) === false)
                break;
        }
    }
    return obj;
}
function last(arr) {
    return arr[arr.length - 1];
}
/*
 * Checks if value is the language type of Object.
 * (e.g. arrays, functions, objects, regexes, new Number(0), and new String(''))
 * @param {any} value The value to check.
 * @return {Boolean} Returns true if value is an object, else false.
 */
function isObject(value) {
    const type = typeof value;
    return value !== null && (type === 'object' || type === 'function');
}
function range(start, stop, step = 1) {
    const arr = [];
    for (let i = start; i < stop; i += step) {
        arr.push(i);
    }
    return arr;
}
function padStart(str, length, ch = ' ') {
    return pad(str, length, ch, (str, ch) => ch + str);
}
function padEnd(str, length, ch = ' ') {
    return pad(str, length, ch, (str, ch) => str + ch);
}
function pad(str, length, ch, add) {
    str = String(str);
    let n = length - str.length;
    while (n-- > 0)
        str = add(str, ch);
    return str;
}
function identify(val) {
    return val;
}
function changeCase(str) {
    const hasLowerCase = [...str].some(ch => ch >= 'a' && ch <= 'z');
    return hasLowerCase ? str.toUpperCase() : str.toLowerCase();
}
function ellipsis(str, N) {
    return str.length > N ? str.slice(0, N - 3) + '...' : str;
}
// compare string in case-insensitive way, undefined values to the tail
function caseInsensitiveCompare(a, b) {
    if (a == null && b == null)
        return 0;
    if (a == null)
        return 1;
    if (b == null)
        return -1;
    a = toLowerCase.call(a);
    b = toLowerCase.call(b);
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}
function argumentsToValue(fn) {
    return (...args) => fn(...args.map(toValue));
}
function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * targeting ES5, extends Error won't create a proper prototype chain, need a trait to kee track of classes
 */
const TRAIT = '__liquidClass__';
class LiquidError extends Error {
    constructor(err, token) {
        /**
         * note: for ES5 targeting, `this` will be replaced by return value of Error(),
         * thus everything on `this` will be lost, avoid calling `LiquidError` methods here
         */
        super(typeof err === 'string' ? err : err.message);
        this.context = '';
        if (typeof err !== 'string')
            Object.defineProperty(this, 'originalError', { value: err, enumerable: false });
        Object.defineProperty(this, 'token', { value: token, enumerable: false });
        Object.defineProperty(this, TRAIT, { value: 'LiquidError', enumerable: false });
    }
    update() {
        Object.defineProperty(this, 'context', { value: mkContext(this.token), enumerable: false });
        this.message = mkMessage(this.message, this.token);
        this.stack = this.message + '\n' + this.context +
            '\n' + this.stack;
        if (this.originalError)
            this.stack += '\nFrom ' + this.originalError.stack;
    }
    static is(obj) {
        return (obj === null || obj === void 0 ? void 0 : obj[TRAIT]) === 'LiquidError';
    }
}
class TokenizationError extends LiquidError {
    constructor(message, token) {
        super(message, token);
        this.name = 'TokenizationError';
        super.update();
    }
}
class ParseError extends LiquidError {
    constructor(err, token) {
        super(err, token);
        this.name = 'ParseError';
        this.message = err.message;
        super.update();
    }
}
class RenderError extends LiquidError {
    constructor(err, tpl) {
        super(err, tpl.token);
        this.name = 'RenderError';
        this.message = err.message;
        super.update();
    }
    static is(obj) {
        return obj.name === 'RenderError';
    }
}
class UndefinedVariableError extends LiquidError {
    constructor(err, token) {
        super(err, token);
        this.name = 'UndefinedVariableError';
        this.message = err.message;
        super.update();
    }
}
// only used internally; raised where we don't have token information,
// so it can't be an UndefinedVariableError.
class InternalUndefinedVariableError extends Error {
    constructor(variableName) {
        super(`undefined variable: ${variableName}`);
        this.name = 'InternalUndefinedVariableError';
        this.variableName = variableName;
    }
}
class AssertionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AssertionError';
        this.message = message + '';
    }
}
function mkContext(token) {
    const [line, col] = token.getPosition();
    const lines = token.input.split('\n');
    const begin = Math.max(line - 2, 1);
    const end = Math.min(line + 3, lines.length);
    const context = range(begin, end + 1)
        .map(lineNumber => {
        const rowIndicator = (lineNumber === line) ? '>> ' : '   ';
        const num = padStart(String(lineNumber), String(end).length);
        let text = `${rowIndicator}${num}| `;
        const colIndicator = lineNumber === line
            ? '\n' + padStart('^', col + text.length)
            : '';
        text += lines[lineNumber - 1];
        text += colIndicator;
        return text;
    })
        .join('\n');
    return context;
}
function mkMessage(msg, token) {
    if (token.file)
        msg += `, file:${token.file}`;
    const [line, col] = token.getPosition();
    msg += `, line:${line}, col:${col}`;
    return msg;
}

// **DO NOT CHANGE THIS FILE**
//
// This file is generated by bin/character-gen.js
// bitmask character types to boost performance
const TYPES = [0, 0, 0, 0, 0, 0, 0, 0, 0, 20, 4, 4, 4, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20, 2, 8, 0, 0, 0, 0, 8, 0, 0, 0, 64, 0, 65, 0, 0, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 0, 0, 2, 2, 2, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const WORD = 1;
const BLANK = 4;
const QUOTE = 8;
const INLINE_BLANK = 16;
const NUMBER = 32;
const SIGN = 64;
const PUNCTUATION = 128;
function isWord(char) {
    const code = char.charCodeAt(0);
    return code >= 128 ? !TYPES[code] : !!(TYPES[code] & WORD);
}
TYPES[160] = TYPES[5760] = TYPES[6158] = TYPES[8192] = TYPES[8193] = TYPES[8194] = TYPES[8195] = TYPES[8196] = TYPES[8197] = TYPES[8198] = TYPES[8199] = TYPES[8200] = TYPES[8201] = TYPES[8202] = TYPES[8232] = TYPES[8233] = TYPES[8239] = TYPES[8287] = TYPES[12288] = BLANK;
TYPES[8220] = TYPES[8221] = PUNCTUATION;

function assert(predicate, message) {
    if (!predicate) {
        const msg = typeof message === 'function'
            ? message()
            : (message || `expect ${predicate} to be true`);
        throw new AssertionError(msg);
    }
}

class NullDrop extends Drop {
    equals(value) {
        return isNil(toValue(value));
    }
    gt() {
        return false;
    }
    geq() {
        return false;
    }
    lt() {
        return false;
    }
    leq() {
        return false;
    }
    valueOf() {
        return null;
    }
}

class EmptyDrop extends Drop {
    equals(value) {
        if (value instanceof EmptyDrop)
            return false;
        value = toValue(value);
        if (isString(value) || isArray(value))
            return value.length === 0;
        if (isObject(value))
            return Object.keys(value).length === 0;
        return false;
    }
    gt() {
        return false;
    }
    geq() {
        return false;
    }
    lt() {
        return false;
    }
    leq() {
        return false;
    }
    valueOf() {
        return '';
    }
}

class BlankDrop extends EmptyDrop {
    equals(value) {
        if (value === false)
            return true;
        if (isNil(toValue(value)))
            return true;
        if (isString(value))
            return /^\s*$/.test(value);
        return super.equals(value);
    }
}

class ForloopDrop extends Drop {
    constructor(length, collection, variable) {
        super();
        this.i = 0;
        this.length = length;
        this.name = `${variable}-${collection}`;
    }
    next() {
        this.i++;
    }
    index0() {
        return this.i;
    }
    index() {
        return this.i + 1;
    }
    first() {
        return this.i === 0;
    }
    last() {
        return this.i === this.length - 1;
    }
    rindex() {
        return this.length - this.i;
    }
    rindex0() {
        return this.length - this.i - 1;
    }
    valueOf() {
        return JSON.stringify(this);
    }
}

class BlockDrop extends Drop {
    constructor(
    // the block render from layout template
    superBlockRender = () => '') {
        super();
        this.superBlockRender = superBlockRender;
    }
    /**
     * Provide parent access in child block by
     * {{ block.super }}
     */
    super() {
        return this.superBlockRender();
    }
}

function isComparable(arg) {
    return arg && isFunction(arg.equals);
}

const nil = new NullDrop();
const literalValues = {
    'true': true,
    'false': false,
    'nil': nil,
    'null': nil,
    'empty': new EmptyDrop(),
    'blank': new BlankDrop()
};

function createTrie(input) {
    const trie = {};
    for (const [name, data] of Object.entries(input)) {
        let node = trie;
        for (let i = 0; i < name.length; i++) {
            const c = name[i];
            node[c] = node[c] || {};
            if (i === name.length - 1 && isWord(name[i])) {
                node[c].needBoundary = true;
            }
            node = node[c];
        }
        node.data = data;
        node.end = true;
    }
    return trie;
}

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

// convert an async iterator to a Promise
function toPromise(val) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!isIterator(val))
            return val;
        let value;
        let done = false;
        let next = 'next';
        do {
            const state = val[next](value);
            done = state.done;
            value = state.value;
            next = 'next';
            try {
                if (isIterator(value))
                    value = toPromise(value);
                if (isPromise(value))
                    value = yield value;
            }
            catch (err) {
                next = 'throw';
                value = err;
            }
        } while (!done);
        return value;
    });
}
// convert an async iterator to a value in a synchronous manner
function toValueSync(val) {
    if (!isIterator(val))
        return val;
    let value;
    let done = false;
    let next = 'next';
    do {
        const state = val[next](value);
        done = state.done;
        value = state.value;
        next = 'next';
        if (isIterator(value)) {
            try {
                value = toValueSync(value);
            }
            catch (err) {
                next = 'throw';
                value = err;
            }
        }
    } while (!done);
    return value;
}

const rFormat = /%([-_0^#:]+)?(\d+)?([EO])?(.)/;
const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'
];
const dayNames = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];
const monthNamesShort = monthNames.map(abbr);
const dayNamesShort = dayNames.map(abbr);
function abbr(str) {
    return str.slice(0, 3);
}
// prototype extensions
function daysInMonth(d) {
    const feb = isLeapYear(d) ? 29 : 28;
    return [31, feb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
}
function getDayOfYear(d) {
    let num = 0;
    for (let i = 0; i < d.getMonth(); ++i) {
        num += daysInMonth(d)[i];
    }
    return num + d.getDate();
}
function getWeekOfYear(d, startDay) {
    // Skip to startDay of this week
    const now = getDayOfYear(d) + (startDay - d.getDay());
    // Find the first startDay of the year
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const then = (7 - jan1.getDay() + startDay);
    return String(Math.floor((now - then) / 7) + 1);
}
function isLeapYear(d) {
    const year = d.getFullYear();
    return !!((year & 3) === 0 && (year % 100 || (year % 400 === 0 && year)));
}
function getSuffix(d) {
    const date = d.getDate();
    let suffix = 'th';
    switch (date) {
        case 11:
        case 12:
        case 13:
            break;
        default:
            switch (date % 10) {
                case 1:
                    suffix = 'st';
                    break;
                case 2:
                    suffix = 'nd';
                    break;
                case 3:
                    suffix = 'rd';
                    break;
            }
    }
    return suffix;
}
function century(d) {
    return parseInt(d.getFullYear().toString().substring(0, 2), 10);
}
// default to 0
const padWidths = {
    d: 2,
    e: 2,
    H: 2,
    I: 2,
    j: 3,
    k: 2,
    l: 2,
    L: 3,
    m: 2,
    M: 2,
    S: 2,
    U: 2,
    W: 2
};
// default to '0'
const padChars = {
    a: ' ',
    A: ' ',
    b: ' ',
    B: ' ',
    c: ' ',
    e: ' ',
    k: ' ',
    l: ' ',
    p: ' ',
    P: ' '
};
function getTimezoneOffset(d, opts) {
    const nOffset = Math.abs(d.getTimezoneOffset());
    const h = Math.floor(nOffset / 60);
    const m = nOffset % 60;
    return (d.getTimezoneOffset() > 0 ? '-' : '+') +
        padStart(h, 2, '0') +
        (opts.flags[':'] ? ':' : '') +
        padStart(m, 2, '0');
}
const formatCodes = {
    a: (d) => dayNamesShort[d.getDay()],
    A: (d) => dayNames[d.getDay()],
    b: (d) => monthNamesShort[d.getMonth()],
    B: (d) => monthNames[d.getMonth()],
    c: (d) => d.toLocaleString(),
    C: (d) => century(d),
    d: (d) => d.getDate(),
    e: (d) => d.getDate(),
    H: (d) => d.getHours(),
    I: (d) => String(d.getHours() % 12 || 12),
    j: (d) => getDayOfYear(d),
    k: (d) => d.getHours(),
    l: (d) => String(d.getHours() % 12 || 12),
    L: (d) => d.getMilliseconds(),
    m: (d) => d.getMonth() + 1,
    M: (d) => d.getMinutes(),
    N: (d, opts) => {
        const width = Number(opts.width) || 9;
        const str = String(d.getMilliseconds()).slice(0, width);
        return padEnd(str, width, '0');
    },
    p: (d) => (d.getHours() < 12 ? 'AM' : 'PM'),
    P: (d) => (d.getHours() < 12 ? 'am' : 'pm'),
    q: (d) => getSuffix(d),
    s: (d) => Math.round(d.getTime() / 1000),
    S: (d) => d.getSeconds(),
    u: (d) => d.getDay() || 7,
    U: (d) => getWeekOfYear(d, 0),
    w: (d) => d.getDay(),
    W: (d) => getWeekOfYear(d, 1),
    x: (d) => d.toLocaleDateString(),
    X: (d) => d.toLocaleTimeString(),
    y: (d) => d.getFullYear().toString().slice(2, 4),
    Y: (d) => d.getFullYear(),
    z: getTimezoneOffset,
    Z: (d, opts) => {
        if (d.getTimezoneName) {
            return d.getTimezoneName() || getTimezoneOffset(d, opts);
        }
        return (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '');
    },
    't': () => '\t',
    'n': () => '\n',
    '%': () => '%'
};
formatCodes.h = formatCodes.b;
function strftime(d, formatStr) {
    let output = '';
    let remaining = formatStr;
    let match;
    while ((match = rFormat.exec(remaining))) {
        output += remaining.slice(0, match.index);
        remaining = remaining.slice(match.index + match[0].length);
        output += format(d, match);
    }
    return output + remaining;
}
function format(d, match) {
    const [input, flagStr = '', width, modifier, conversion] = match;
    const convert = formatCodes[conversion];
    if (!convert)
        return input;
    const flags = {};
    for (const flag of flagStr)
        flags[flag] = true;
    let ret = String(convert(d, { flags, width, modifier }));
    let padChar = padChars[conversion] || '0';
    let padWidth = width || padWidths[conversion] || 0;
    if (flags['^'])
        ret = ret.toUpperCase();
    else if (flags['#'])
        ret = changeCase(ret);
    if (flags['_'])
        padChar = ' ';
    else if (flags['0'])
        padChar = '0';
    if (flags['-'])
        padWidth = 0;
    return padStart(ret, padWidth, padChar);
}

// one minute in milliseconds
const OneMinute = 60000;
const ISO8601_TIMEZONE_PATTERN = /([zZ]|([+-])(\d{2}):(\d{2}))$/;
/**
 * A date implementation with timezone info, just like Ruby date
 *
 * Implementation:
 * - create a Date offset by it's timezone difference, avoiding overriding a bunch of methods
 * - rewrite getTimezoneOffset() to trick strftime
 */
class TimezoneDate {
    constructor(init, timezone) {
        this.date = init instanceof TimezoneDate
            ? init.date
            : new Date(init);
        this.timezoneOffset = isString(timezone) ? TimezoneDate.getTimezoneOffset(timezone, this.date) : timezone;
        this.timezoneName = isString(timezone) ? timezone : '';
        const diff = (this.date.getTimezoneOffset() - this.timezoneOffset) * OneMinute;
        const time = this.date.getTime() + diff;
        this.displayDate = new Date(time);
    }
    getTime() {
        return this.displayDate.getTime();
    }
    getMilliseconds() {
        return this.displayDate.getMilliseconds();
    }
    getSeconds() {
        return this.displayDate.getSeconds();
    }
    getMinutes() {
        return this.displayDate.getMinutes();
    }
    getHours() {
        return this.displayDate.getHours();
    }
    getDay() {
        return this.displayDate.getDay();
    }
    getDate() {
        return this.displayDate.getDate();
    }
    getMonth() {
        return this.displayDate.getMonth();
    }
    getFullYear() {
        return this.displayDate.getFullYear();
    }
    toLocaleString(locale, init) {
        if (init === null || init === void 0 ? void 0 : init.timeZone) {
            return this.date.toLocaleString(locale, init);
        }
        return this.displayDate.toLocaleString(locale, init);
    }
    toLocaleTimeString(locale) {
        return this.displayDate.toLocaleTimeString(locale);
    }
    toLocaleDateString(locale) {
        return this.displayDate.toLocaleDateString(locale);
    }
    getTimezoneOffset() {
        return this.timezoneOffset;
    }
    getTimezoneName() {
        return this.timezoneName;
    }
    /**
     * Create a Date object fixed to it's declared Timezone. Both
     * - 2021-08-06T02:29:00.000Z and
     * - 2021-08-06T02:29:00.000+08:00
     * will always be displayed as
     * - 2021-08-06 02:29:00
     * regardless timezoneOffset in JavaScript realm
     *
     * The implementation hack:
     * Instead of calling `.getMonth()`/`.getUTCMonth()` respect to `preserveTimezones`,
     * we create a different Date to trick strftime, it's both simpler and more performant.
     * Given that a template is expected to be parsed fewer times than rendered.
     */
    static createDateFixedToTimezone(dateString) {
        const m = dateString.match(ISO8601_TIMEZONE_PATTERN);
        // representing a UTC timestamp
        if (m && m[1] === 'Z') {
            return new TimezoneDate(+new Date(dateString), 0);
        }
        // has a timezone specified
        if (m && m[2] && m[3] && m[4]) {
            const [, , sign, hours, minutes] = m;
            const offset = (sign === '+' ? -1 : 1) * (parseInt(hours, 10) * 60 + parseInt(minutes, 10));
            return new TimezoneDate(+new Date(dateString), offset);
        }
        return new Date(dateString);
    }
    static getTimezoneOffset(timezoneName, date = new Date()) {
        const localDateString = date.toLocaleString('en-US', { timeZone: timezoneName });
        const utcDateString = date.toLocaleString('en-US', { timeZone: 'UTC' });
        const localDate = new Date(localDateString);
        const utcDate = new Date(utcDateString);
        return (+utcDate - +localDate) / (60 * 1000);
    }
}

class DelimitedToken extends Token {
    constructor(kind, [contentBegin, contentEnd], input, begin, end, trimLeft, trimRight, file) {
        super(kind, input, begin, end, file);
        this.trimLeft = false;
        this.trimRight = false;
        const tl = input[contentBegin] === '-';
        const tr = input[contentEnd - 1] === '-';
        let l = tl ? contentBegin + 1 : contentBegin;
        let r = tr ? contentEnd - 1 : contentEnd;
        while (l < r && (TYPES[input.charCodeAt(l)] & BLANK))
            l++;
        while (r > l && (TYPES[input.charCodeAt(r - 1)] & BLANK))
            r--;
        this.contentRange = [l, r];
        this.trimLeft = tl || trimLeft;
        this.trimRight = tr || trimRight;
    }
    get content() {
        return this.input.slice(this.contentRange[0], this.contentRange[1]);
    }
}

class TagToken extends DelimitedToken {
    constructor(input, begin, end, options, file) {
        const { trimTagLeft, trimTagRight, tagDelimiterLeft, tagDelimiterRight } = options;
        const [valueBegin, valueEnd] = [begin + tagDelimiterLeft.length, end - tagDelimiterRight.length];
        super(TokenKind.Tag, [valueBegin, valueEnd], input, begin, end, trimTagLeft, trimTagRight, file);
        this.tokenizer = new Tokenizer(input, options.operators, file, this.contentRange);
        this.name = this.tokenizer.readTagName();
        this.tokenizer.assert(this.name, `illegal tag syntax, tag name expected`);
        this.tokenizer.skipBlank();
    }
    get args() {
        return this.tokenizer.input.slice(this.tokenizer.p, this.contentRange[1]);
    }
}

class OutputToken extends DelimitedToken {
    constructor(input, begin, end, options, file) {
        const { trimOutputLeft, trimOutputRight, outputDelimiterLeft, outputDelimiterRight } = options;
        const valueRange = [begin + outputDelimiterLeft.length, end - outputDelimiterRight.length];
        super(TokenKind.Output, valueRange, input, begin, end, trimOutputLeft, trimOutputRight, file);
    }
}

class HTMLToken extends Token {
    constructor(input, begin, end, file) {
        super(TokenKind.HTML, input, begin, end, file);
        this.input = input;
        this.begin = begin;
        this.end = end;
        this.file = file;
        this.trimLeft = 0;
        this.trimRight = 0;
    }
    getContent() {
        return this.input.slice(this.begin + this.trimLeft, this.end - this.trimRight);
    }
}

class NumberToken extends Token {
    constructor(input, begin, end, file) {
        super(TokenKind.Number, input, begin, end, file);
        this.input = input;
        this.begin = begin;
        this.end = end;
        this.file = file;
        this.content = Number(this.getText());
    }
}

class IdentifierToken extends Token {
    constructor(input, begin, end, file) {
        super(TokenKind.Word, input, begin, end, file);
        this.input = input;
        this.begin = begin;
        this.end = end;
        this.file = file;
        this.content = this.getText();
    }
    isNumber(allowSign = false) {
        const begin = allowSign && TYPES[this.input.charCodeAt(this.begin)] & SIGN
            ? this.begin + 1
            : this.begin;
        for (let i = begin; i < this.end; i++) {
            if (!(TYPES[this.input.charCodeAt(i)] & NUMBER))
                return false;
        }
        return true;
    }
}

class LiteralToken extends Token {
    constructor(input, begin, end, file) {
        super(TokenKind.Literal, input, begin, end, file);
        this.input = input;
        this.begin = begin;
        this.end = end;
        this.file = file;
        this.literal = this.getText();
        this.content = literalValues[this.literal];
    }
}

const operatorPrecedences = {
    '==': 2,
    '!=': 2,
    '>': 2,
    '<': 2,
    '>=': 2,
    '<=': 2,
    'contains': 2,
    'not': 1,
    'and': 0,
    'or': 0
};
const operatorTypes = {
    '==': 0 /* OperatorType.Binary */,
    '!=': 0 /* OperatorType.Binary */,
    '>': 0 /* OperatorType.Binary */,
    '<': 0 /* OperatorType.Binary */,
    '>=': 0 /* OperatorType.Binary */,
    '<=': 0 /* OperatorType.Binary */,
    'contains': 0 /* OperatorType.Binary */,
    'not': 1 /* OperatorType.Unary */,
    'and': 0 /* OperatorType.Binary */,
    'or': 0 /* OperatorType.Binary */
};
class OperatorToken extends Token {
    constructor(input, begin, end, file) {
        super(TokenKind.Operator, input, begin, end, file);
        this.input = input;
        this.begin = begin;
        this.end = end;
        this.file = file;
        this.operator = this.getText();
    }
    getPrecedence() {
        const key = this.getText();
        return key in operatorPrecedences ? operatorPrecedences[key] : 1;
    }
}

class PropertyAccessToken extends Token {
    constructor(variable, props, input, begin, end, file) {
        super(TokenKind.PropertyAccess, input, begin, end, file);
        this.variable = variable;
        this.props = props;
    }
}

class FilterToken extends Token {
    constructor(name, args, input, begin, end, file) {
        super(TokenKind.Filter, input, begin, end, file);
        this.name = name;
        this.args = args;
    }
}

class HashToken extends Token {
    constructor(input, begin, end, name, value, file) {
        super(TokenKind.Hash, input, begin, end, file);
        this.input = input;
        this.begin = begin;
        this.end = end;
        this.name = name;
        this.value = value;
        this.file = file;
    }
}

const rHex = /[\da-fA-F]/;
const rOct = /[0-7]/;
const escapeChar = {
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    v: '\x0B'
};
function hexVal(c) {
    const code = c.charCodeAt(0);
    if (code >= 97)
        return code - 87;
    if (code >= 65)
        return code - 55;
    return code - 48;
}
function parseStringLiteral(str) {
    let ret = '';
    for (let i = 1; i < str.length - 1; i++) {
        if (str[i] !== '\\') {
            ret += str[i];
            continue;
        }
        if (escapeChar[str[i + 1]] !== undefined) {
            ret += escapeChar[str[++i]];
        }
        else if (str[i + 1] === 'u') {
            let val = 0;
            let j = i + 2;
            while (j <= i + 5 && rHex.test(str[j])) {
                val = val * 16 + hexVal(str[j++]);
            }
            i = j - 1;
            ret += String.fromCharCode(val);
        }
        else if (!rOct.test(str[i + 1])) {
            ret += str[++i];
        }
        else {
            let j = i + 1;
            let val = 0;
            while (j <= i + 3 && rOct.test(str[j])) {
                val = val * 8 + hexVal(str[j++]);
            }
            i = j - 1;
            ret += String.fromCharCode(val);
        }
    }
    return ret;
}

class QuotedToken extends Token {
    constructor(input, begin, end, file) {
        super(TokenKind.Quoted, input, begin, end, file);
        this.input = input;
        this.begin = begin;
        this.end = end;
        this.file = file;
        this.content = parseStringLiteral(this.getText());
    }
}

class RangeToken extends Token {
    constructor(input, begin, end, lhs, rhs, file) {
        super(TokenKind.Range, input, begin, end, file);
        this.input = input;
        this.begin = begin;
        this.end = end;
        this.lhs = lhs;
        this.rhs = rhs;
        this.file = file;
    }
}

/**
 * LiquidTagToken is different from TagToken by not having delimiters `{%` or `%}`
 */
class LiquidTagToken extends DelimitedToken {
    constructor(input, begin, end, options, file) {
        super(TokenKind.Tag, [begin, end], input, begin, end, false, false, file);
        this.tokenizer = new Tokenizer(input, options.operators, file, this.contentRange);
        this.name = this.tokenizer.readTagName();
        this.tokenizer.assert(this.name, 'illegal liquid tag syntax');
        this.tokenizer.skipBlank();
        this.args = this.tokenizer.remaining();
    }
}

/**
 * value expression with optional filters
 * e.g.
 * {% assign foo="bar" | append: "coo" %}
 */
class FilteredValueToken extends Token {
    constructor(initial, filters, input, begin, end, file) {
        super(TokenKind.FilteredValue, input, begin, end, file);
        this.initial = initial;
        this.filters = filters;
        this.input = input;
        this.begin = begin;
        this.end = end;
        this.file = file;
    }
}

class SimpleEmitter {
    constructor() {
        this.buffer = '';
    }
    write(html) {
        this.buffer += stringify(html);
    }
}

class StreamedEmitter {
    constructor() {
        this.buffer = '';
        this.stream = new stream.PassThrough();
    }
    write(html) {
        this.stream.write(stringify(html));
    }
    error(err) {
        this.stream.emit('error', err);
    }
    end() {
        this.stream.end();
    }
}

class KeepingTypeEmitter {
    constructor() {
        this.buffer = '';
    }
    write(html) {
        html = toValue(html);
        // This will only preserve the type if the value is isolated.
        // I.E:
        // {{ my-port }} -> 42
        // {{ my-host }}:{{ my-port }} -> 'host:42'
        if (typeof html !== 'string' && this.buffer === '') {
            this.buffer = html;
        }
        else {
            this.buffer = stringify(this.buffer) + stringify(html);
        }
    }
}

class Render {
    renderTemplatesToNodeStream(templates, ctx) {
        const emitter = new StreamedEmitter();
        Promise.resolve().then(() => toPromise(this.renderTemplates(templates, ctx, emitter)))
            .then(() => emitter.end(), err => emitter.error(err));
        return emitter.stream;
    }
    *renderTemplates(templates, ctx, emitter) {
        if (!emitter) {
            emitter = ctx.opts.keepOutputType ? new KeepingTypeEmitter() : new SimpleEmitter();
        }
        for (const tpl of templates) {
            try {
                // if tpl.render supports emitter, it'll return empty `html`
                const html = yield tpl.render(ctx, emitter);
                // if not, it'll return an `html`, write to the emitter for it
                html && emitter.write(html);
                if (emitter['break'] || emitter['continue'])
                    break;
            }
            catch (e) {
                const err = RenderError.is(e) ? e : new RenderError(e, tpl);
                throw err;
            }
        }
        return emitter.buffer;
    }
}

class Expression {
    constructor(tokens) {
        this.postfix = [...toPostfix(tokens)];
    }
    *evaluate(ctx, lenient) {
        assert(ctx, 'unable to evaluate: context not defined');
        const operands = [];
        for (const token of this.postfix) {
            if (isOperatorToken(token)) {
                const r = operands.pop();
                let result;
                if (operatorTypes[token.operator] === 1 /* OperatorType.Unary */) {
                    result = yield ctx.opts.operators[token.operator](r, ctx);
                }
                else {
                    const l = operands.pop();
                    result = yield ctx.opts.operators[token.operator](l, r, ctx);
                }
                operands.push(result);
            }
            else {
                operands.push(yield evalToken(token, ctx, lenient));
            }
        }
        return operands[0];
    }
    valid() {
        return !!this.postfix.length;
    }
}
function* evalToken(token, ctx, lenient = false) {
    if (!token)
        return;
    if ('content' in token)
        return token.content;
    if (isPropertyAccessToken(token))
        return yield evalPropertyAccessToken(token, ctx, lenient);
    if (isRangeToken(token))
        return yield evalRangeToken(token, ctx);
}
function* evalPropertyAccessToken(token, ctx, lenient) {
    const props = [];
    for (const prop of token.props) {
        props.push((yield evalToken(prop, ctx, false)));
    }
    try {
        if (token.variable) {
            const variable = yield evalToken(token.variable, ctx, lenient);
            return yield ctx._getFromScope(variable, props);
        }
        else {
            return yield ctx._get(props);
        }
    }
    catch (e) {
        if (lenient && e.name === 'InternalUndefinedVariableError')
            return null;
        throw (new UndefinedVariableError(e, token));
    }
}
function evalQuotedToken(token) {
    return token.content;
}
function* evalRangeToken(token, ctx) {
    const low = yield evalToken(token.lhs, ctx);
    const high = yield evalToken(token.rhs, ctx);
    return range(+low, +high + 1);
}
function* toPostfix(tokens) {
    const ops = [];
    for (const token of tokens) {
        if (isOperatorToken(token)) {
            while (ops.length && ops[ops.length - 1].getPrecedence() > token.getPrecedence()) {
                yield ops.pop();
            }
            ops.push(token);
        }
        else
            yield token;
    }
    while (ops.length) {
        yield ops.pop();
    }
}

function isTruthy(val, ctx) {
    return !isFalsy(val, ctx);
}
function isFalsy(val, ctx) {
    if (ctx.opts.jsTruthy) {
        return !val;
    }
    else {
        return val === false || undefined === val || val === null;
    }
}

const defaultOperators = {
    '==': equals,
    '!=': (l, r) => !equals(l, r),
    '>': (l, r) => {
        if (isComparable(l))
            return l.gt(r);
        if (isComparable(r))
            return r.lt(l);
        return toValue(l) > toValue(r);
    },
    '<': (l, r) => {
        if (isComparable(l))
            return l.lt(r);
        if (isComparable(r))
            return r.gt(l);
        return toValue(l) < toValue(r);
    },
    '>=': (l, r) => {
        if (isComparable(l))
            return l.geq(r);
        if (isComparable(r))
            return r.leq(l);
        return toValue(l) >= toValue(r);
    },
    '<=': (l, r) => {
        if (isComparable(l))
            return l.leq(r);
        if (isComparable(r))
            return r.geq(l);
        return toValue(l) <= toValue(r);
    },
    'contains': (l, r) => {
        l = toValue(l);
        if (isArray(l))
            return l.some((i) => equals(i, r));
        if (isFunction(l === null || l === void 0 ? void 0 : l.indexOf))
            return l.indexOf(toValue(r)) > -1;
        return false;
    },
    'not': (v, ctx) => isFalsy(toValue(v), ctx),
    'and': (l, r, ctx) => isTruthy(toValue(l), ctx) && isTruthy(toValue(r), ctx),
    'or': (l, r, ctx) => isTruthy(toValue(l), ctx) || isTruthy(toValue(r), ctx)
};
function equals(lhs, rhs) {
    if (isComparable(lhs))
        return lhs.equals(rhs);
    if (isComparable(rhs))
        return rhs.equals(lhs);
    lhs = toValue(lhs);
    rhs = toValue(rhs);
    if (isArray(lhs)) {
        return isArray(rhs) && arrayEquals(lhs, rhs);
    }
    return lhs === rhs;
}
function arrayEquals(lhs, rhs) {
    if (lhs.length !== rhs.length)
        return false;
    return !lhs.some((value, i) => !equals(value, rhs[i]));
}

class Node {
    constructor(key, value, next, prev) {
        this.key = key;
        this.value = value;
        this.next = next;
        this.prev = prev;
    }
}
class LRU {
    constructor(limit, size = 0) {
        this.limit = limit;
        this.size = size;
        this.cache = {};
        this.head = new Node('HEAD', null, null, null);
        this.tail = new Node('TAIL', null, null, null);
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }
    write(key, value) {
        if (this.cache[key]) {
            this.cache[key].value = value;
        }
        else {
            const node = new Node(key, value, this.head.next, this.head);
            this.head.next.prev = node;
            this.head.next = node;
            this.cache[key] = node;
            this.size++;
            this.ensureLimit();
        }
    }
    read(key) {
        if (!this.cache[key])
            return;
        const { value } = this.cache[key];
        this.remove(key);
        this.write(key, value);
        return value;
    }
    remove(key) {
        const node = this.cache[key];
        node.prev.next = node.next;
        node.next.prev = node.prev;
        delete this.cache[key];
        this.size--;
    }
    clear() {
        this.head.next = this.tail;
        this.tail.prev = this.head;
        this.size = 0;
        this.cache = {};
    }
    ensureLimit() {
        if (this.size > this.limit)
            this.remove(this.tail.prev.key);
    }
}

const requireResolve = require.resolve;

const statAsync = promisify(require$$6.stat);
const readFileAsync = promisify(require$$6.readFile);
function exists(filepath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield statAsync(filepath);
            return true;
        }
        catch (err) {
            return false;
        }
    });
}
function readFile(filepath) {
    return readFileAsync(filepath, 'utf8');
}
function existsSync(filepath) {
    try {
        require$$6.statSync(filepath);
        return true;
    }
    catch (err) {
        return false;
    }
}
function readFileSync(filepath) {
    return require$$6.readFileSync(filepath, 'utf8');
}
function resolve(root, file, ext) {
    if (!require$$1.extname(file))
        file += ext;
    return require$$1.resolve(root, file);
}
function fallback(file) {
    try {
        return requireResolve(file);
    }
    catch (e) { }
}
function dirname(filepath) {
    return require$$1.dirname(filepath);
}
function contains(root, file) {
    root = require$$1.resolve(root);
    root = root.endsWith(require$$1.sep) ? root : root + require$$1.sep;
    return file.startsWith(root);
}

var fs = /*#__PURE__*/Object.freeze({
  __proto__: null,
  exists: exists,
  readFile: readFile,
  existsSync: existsSync,
  readFileSync: readFileSync,
  resolve: resolve,
  fallback: fallback,
  dirname: dirname,
  contains: contains,
  sep: require$$1.sep
});

function Default(value, defaultValue, ...args) {
    value = toValue(value);
    if (isArray(value) || isString(value))
        return value.length ? value : defaultValue;
    if (value === false && (new Map(args)).get('allow_false'))
        return false;
    return isFalsy(value, this.context) ? defaultValue : value;
}
function json(value, space = 0) {
    return JSON.stringify(value, null, space);
}
const raw = {
    raw: true,
    handler: identify
};

const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&#34;',
    "'": '&#39;'
};
const unescapeMap = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&#34;': '"',
    '&#39;': "'"
};
function escape(str) {
    return stringify(str).replace(/&|<|>|"|'/g, m => escapeMap[m]);
}
function unescape(str) {
    return stringify(str).replace(/&(amp|lt|gt|#34|#39);/g, m => unescapeMap[m]);
}
function escape_once(str) {
    return escape(unescape(stringify(str)));
}
function newline_to_br(v) {
    return stringify(v).replace(/\r?\n/gm, '<br />\n');
}
function strip_html(v) {
    return stringify(v).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<.*?>|<!--[\s\S]*?-->/g, '');
}

var htmlFilters = /*#__PURE__*/Object.freeze({
  __proto__: null,
  escape: escape,
  escape_once: escape_once,
  newline_to_br: newline_to_br,
  strip_html: strip_html
});

const defaultOptions = {
    root: ['.'],
    layouts: ['.'],
    partials: ['.'],
    relativeReference: true,
    jekyllInclude: false,
    cache: undefined,
    extname: '',
    fs: fs,
    dynamicPartials: true,
    jsTruthy: false,
    dateFormat: '%A, %B %-e, %Y at %-l:%M %P %z',
    trimTagRight: false,
    trimTagLeft: false,
    trimOutputRight: false,
    trimOutputLeft: false,
    greedy: true,
    tagDelimiterLeft: '{%',
    tagDelimiterRight: '%}',
    outputDelimiterLeft: '{{',
    outputDelimiterRight: '}}',
    preserveTimezones: false,
    strictFilters: false,
    strictVariables: false,
    ownPropertyOnly: true,
    lenientIf: false,
    globals: {},
    keepOutputType: false,
    operators: defaultOperators
};
function normalize(options) {
    if (options.hasOwnProperty('root')) {
        if (!options.hasOwnProperty('partials'))
            options.partials = options.root;
        if (!options.hasOwnProperty('layouts'))
            options.layouts = options.root;
    }
    if (options.hasOwnProperty('cache')) {
        let cache;
        if (typeof options.cache === 'number')
            cache = options.cache > 0 ? new LRU(options.cache) : undefined;
        else if (typeof options.cache === 'object')
            cache = options.cache;
        else
            cache = options.cache ? new LRU(1024) : undefined;
        options.cache = cache;
    }
    options = Object.assign(Object.assign(Object.assign({}, defaultOptions), (options.jekyllInclude ? { dynamicPartials: false } : {})), options);
    if ((!options.fs.dirname || !options.fs.sep) && options.relativeReference) {
        console.warn('[LiquidJS] `fs.dirname` and `fs.sep` are required for relativeReference, set relativeReference to `false` to suppress this warning');
        options.relativeReference = false;
    }
    options.root = normalizeDirectoryList(options.root);
    options.partials = normalizeDirectoryList(options.partials);
    options.layouts = normalizeDirectoryList(options.layouts);
    options.outputEscape = options.outputEscape && getOutputEscapeFunction(options.outputEscape);
    return options;
}
function getOutputEscapeFunction(nameOrFunction) {
    if (nameOrFunction === 'escape')
        return escape;
    if (nameOrFunction === 'json')
        return json;
    assert(isFunction(nameOrFunction), '`outputEscape` need to be of type string or function');
    return nameOrFunction;
}
function normalizeDirectoryList(value) {
    let list = [];
    if (isArray(value))
        list = value;
    if (isString(value))
        list = [value];
    return list;
}

function whiteSpaceCtrl(tokens, options) {
    let inRaw = false;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (!isDelimitedToken(token))
            continue;
        if (!inRaw && token.trimLeft) {
            trimLeft(tokens[i - 1], options.greedy);
        }
        if (isTagToken(token)) {
            if (token.name === 'raw')
                inRaw = true;
            else if (token.name === 'endraw')
                inRaw = false;
        }
        if (!inRaw && token.trimRight) {
            trimRight(tokens[i + 1], options.greedy);
        }
    }
}
function trimLeft(token, greedy) {
    if (!token || !isHTMLToken(token))
        return;
    const mask = greedy ? BLANK : INLINE_BLANK;
    while (TYPES[token.input.charCodeAt(token.end - 1 - token.trimRight)] & mask)
        token.trimRight++;
}
function trimRight(token, greedy) {
    if (!token || !isHTMLToken(token))
        return;
    const mask = greedy ? BLANK : INLINE_BLANK;
    while (TYPES[token.input.charCodeAt(token.begin + token.trimLeft)] & mask)
        token.trimLeft++;
    if (token.input.charAt(token.begin + token.trimLeft) === '\n')
        token.trimLeft++;
}

class Tokenizer {
    constructor(input, operators = defaultOptions.operators, file, range) {
        this.input = input;
        this.file = file;
        this.rawBeginAt = -1;
        this.p = range ? range[0] : 0;
        this.N = range ? range[1] : input.length;
        this.opTrie = createTrie(operators);
        this.literalTrie = createTrie(literalValues);
    }
    readExpression() {
        return new Expression(this.readExpressionTokens());
    }
    *readExpressionTokens() {
        while (this.p < this.N) {
            const operator = this.readOperator();
            if (operator) {
                yield operator;
                continue;
            }
            const operand = this.readValue();
            if (operand) {
                yield operand;
                continue;
            }
            return;
        }
    }
    readOperator() {
        this.skipBlank();
        const end = this.matchTrie(this.opTrie);
        if (end === -1)
            return;
        return new OperatorToken(this.input, this.p, (this.p = end), this.file);
    }
    matchTrie(trie) {
        let node = trie;
        let i = this.p;
        let info;
        while (node[this.input[i]] && i < this.N) {
            node = node[this.input[i++]];
            if (node['end'])
                info = node;
        }
        if (!info)
            return -1;
        if (info['needBoundary'] && isWord(this.peek(i - this.p)))
            return -1;
        return i;
    }
    readFilteredValue() {
        const begin = this.p;
        const initial = this.readExpression();
        this.assert(initial.valid(), `invalid value expression: ${this.snapshot()}`);
        const filters = this.readFilters();
        return new FilteredValueToken(initial, filters, this.input, begin, this.p, this.file);
    }
    readFilters() {
        const filters = [];
        while (true) {
            const filter = this.readFilter();
            if (!filter)
                return filters;
            filters.push(filter);
        }
    }
    readFilter() {
        this.skipBlank();
        if (this.end())
            return null;
        this.assert(this.peek() === '|', `expected "|" before filter`);
        this.p++;
        const begin = this.p;
        const name = this.readIdentifier();
        if (!name.size()) {
            this.assert(this.end(), `expected filter name`);
            return null;
        }
        const args = [];
        this.skipBlank();
        if (this.peek() === ':') {
            do {
                ++this.p;
                const arg = this.readFilterArg();
                arg && args.push(arg);
                this.skipBlank();
                this.assert(this.end() || this.peek() === ',' || this.peek() === '|', () => `unexpected character ${this.snapshot()}`);
            } while (this.peek() === ',');
        }
        else if (this.peek() === '|' || this.end()) ;
        else {
            throw this.error('expected ":" after filter name');
        }
        return new FilterToken(name.getText(), args, this.input, begin, this.p, this.file);
    }
    readFilterArg() {
        const key = this.readValue();
        if (!key)
            return;
        this.skipBlank();
        if (this.peek() !== ':')
            return key;
        ++this.p;
        const value = this.readValue();
        return [key.getText(), value];
    }
    readTopLevelTokens(options = defaultOptions) {
        const tokens = [];
        while (this.p < this.N) {
            const token = this.readTopLevelToken(options);
            tokens.push(token);
        }
        whiteSpaceCtrl(tokens, options);
        return tokens;
    }
    readTopLevelToken(options) {
        const { tagDelimiterLeft, outputDelimiterLeft } = options;
        if (this.rawBeginAt > -1)
            return this.readEndrawOrRawContent(options);
        if (this.match(tagDelimiterLeft))
            return this.readTagToken(options);
        if (this.match(outputDelimiterLeft))
            return this.readOutputToken(options);
        return this.readHTMLToken([tagDelimiterLeft, outputDelimiterLeft]);
    }
    readHTMLToken(stopStrings) {
        const begin = this.p;
        while (this.p < this.N) {
            if (stopStrings.some(str => this.match(str)))
                break;
            ++this.p;
        }
        return new HTMLToken(this.input, begin, this.p, this.file);
    }
    readTagToken(options = defaultOptions) {
        const { file, input } = this;
        const begin = this.p;
        if (this.readToDelimiter(options.tagDelimiterRight) === -1) {
            throw this.error(`tag ${this.snapshot(begin)} not closed`, begin);
        }
        const token = new TagToken(input, begin, this.p, options, file);
        if (token.name === 'raw')
            this.rawBeginAt = begin;
        return token;
    }
    readToDelimiter(delimiter, respectQuoted = false) {
        this.skipBlank();
        while (this.p < this.N) {
            if (respectQuoted && (this.peekType() & QUOTE)) {
                this.readQuoted();
                continue;
            }
            ++this.p;
            if (this.rmatch(delimiter))
                return this.p;
        }
        return -1;
    }
    readOutputToken(options = defaultOptions) {
        const { file, input } = this;
        const { outputDelimiterRight } = options;
        const begin = this.p;
        if (this.readToDelimiter(outputDelimiterRight, true) === -1) {
            throw this.error(`output ${this.snapshot(begin)} not closed`, begin);
        }
        return new OutputToken(input, begin, this.p, options, file);
    }
    readEndrawOrRawContent(options) {
        const { tagDelimiterLeft, tagDelimiterRight } = options;
        const begin = this.p;
        let leftPos = this.readTo(tagDelimiterLeft) - tagDelimiterLeft.length;
        while (this.p < this.N) {
            if (this.readIdentifier().getText() !== 'endraw') {
                leftPos = this.readTo(tagDelimiterLeft) - tagDelimiterLeft.length;
                continue;
            }
            while (this.p <= this.N) {
                if (this.rmatch(tagDelimiterRight)) {
                    const end = this.p;
                    if (begin === leftPos) {
                        this.rawBeginAt = -1;
                        return new TagToken(this.input, begin, end, options, this.file);
                    }
                    else {
                        this.p = leftPos;
                        return new HTMLToken(this.input, begin, leftPos, this.file);
                    }
                }
                if (this.rmatch(tagDelimiterLeft))
                    break;
                this.p++;
            }
        }
        throw this.error(`raw ${this.snapshot(this.rawBeginAt)} not closed`, begin);
    }
    readLiquidTagTokens(options = defaultOptions) {
        const tokens = [];
        while (this.p < this.N) {
            const token = this.readLiquidTagToken(options);
            token && tokens.push(token);
        }
        return tokens;
    }
    readLiquidTagToken(options) {
        this.skipBlank();
        if (this.end())
            return;
        const begin = this.p;
        this.readToDelimiter('\n');
        const end = this.p;
        return new LiquidTagToken(this.input, begin, end, options, this.file);
    }
    error(msg, pos = this.p) {
        return new TokenizationError(msg, new IdentifierToken(this.input, pos, this.N, this.file));
    }
    assert(pred, msg, pos) {
        if (!pred)
            throw this.error(typeof msg === 'function' ? msg() : msg, pos);
    }
    snapshot(begin = this.p) {
        return JSON.stringify(ellipsis(this.input.slice(begin, this.N), 32));
    }
    /**
     * @deprecated use #readIdentifier instead
     */
    readWord() {
        return this.readIdentifier();
    }
    readIdentifier() {
        this.skipBlank();
        const begin = this.p;
        while (!this.end() && isWord(this.peek()))
            ++this.p;
        return new IdentifierToken(this.input, begin, this.p, this.file);
    }
    readNonEmptyIdentifier() {
        const id = this.readIdentifier();
        return id.size() ? id : undefined;
    }
    readTagName() {
        this.skipBlank();
        // Handle inline comment tags
        if (this.input[this.p] === '#')
            return this.input.slice(this.p, ++this.p);
        return this.readIdentifier().getText();
    }
    readHashes(jekyllStyle) {
        const hashes = [];
        while (true) {
            const hash = this.readHash(jekyllStyle);
            if (!hash)
                return hashes;
            hashes.push(hash);
        }
    }
    readHash(jekyllStyle) {
        this.skipBlank();
        if (this.peek() === ',')
            ++this.p;
        const begin = this.p;
        const name = this.readNonEmptyIdentifier();
        if (!name)
            return;
        let value;
        this.skipBlank();
        const sep = jekyllStyle ? '=' : ':';
        if (this.peek() === sep) {
            ++this.p;
            value = this.readValue();
        }
        return new HashToken(this.input, begin, this.p, name, value, this.file);
    }
    remaining() {
        return this.input.slice(this.p, this.N);
    }
    advance(step = 1) {
        this.p += step;
    }
    end() {
        return this.p >= this.N;
    }
    readTo(end) {
        while (this.p < this.N) {
            ++this.p;
            if (this.rmatch(end))
                return this.p;
        }
        return -1;
    }
    readValue() {
        this.skipBlank();
        const begin = this.p;
        const variable = this.readLiteral() || this.readQuoted() || this.readRange() || this.readNumber();
        const props = this.readProperties(!variable);
        if (!props.length)
            return variable;
        return new PropertyAccessToken(variable, props, this.input, begin, this.p);
    }
    readScopeValue() {
        this.skipBlank();
        const begin = this.p;
        const props = this.readProperties();
        if (!props.length)
            return undefined;
        return new PropertyAccessToken(undefined, props, this.input, begin, this.p);
    }
    readProperties(isBegin = true) {
        const props = [];
        while (true) {
            if (this.peek() === '[') {
                this.p++;
                const prop = this.readValue() || new IdentifierToken(this.input, this.p, this.p, this.file);
                this.assert(this.readTo(']') !== -1, '[ not closed');
                props.push(prop);
                continue;
            }
            if (isBegin && !props.length) {
                const prop = this.readNonEmptyIdentifier();
                if (prop) {
                    props.push(prop);
                    continue;
                }
            }
            if (this.peek() === '.' && this.peek(1) !== '.') { // skip range syntax
                this.p++;
                const prop = this.readNonEmptyIdentifier();
                if (!prop)
                    break;
                props.push(prop);
                continue;
            }
            break;
        }
        return props;
    }
    readNumber() {
        this.skipBlank();
        let decimalFound = false;
        let digitFound = false;
        let n = 0;
        if (this.peekType() & SIGN)
            n++;
        while (this.p + n <= this.N) {
            if (this.peekType(n) & NUMBER) {
                digitFound = true;
                n++;
            }
            else if (this.peek(n) === '.' && this.peek(n + 1) !== '.') {
                if (decimalFound || !digitFound)
                    return;
                decimalFound = true;
                n++;
            }
            else
                break;
        }
        if (digitFound && !isWord(this.peek(n))) {
            const num = new NumberToken(this.input, this.p, this.p + n, this.file);
            this.advance(n);
            return num;
        }
    }
    readLiteral() {
        this.skipBlank();
        const end = this.matchTrie(this.literalTrie);
        if (end === -1)
            return;
        const literal = new LiteralToken(this.input, this.p, end, this.file);
        this.p = end;
        return literal;
    }
    readRange() {
        this.skipBlank();
        const begin = this.p;
        if (this.peek() !== '(')
            return;
        ++this.p;
        const lhs = this.readValueOrThrow();
        this.p += 2;
        const rhs = this.readValueOrThrow();
        ++this.p;
        return new RangeToken(this.input, begin, this.p, lhs, rhs, this.file);
    }
    readValueOrThrow() {
        const value = this.readValue();
        this.assert(value, () => `unexpected token ${this.snapshot()}, value expected`);
        return value;
    }
    readQuoted() {
        this.skipBlank();
        const begin = this.p;
        if (!(this.peekType() & QUOTE))
            return;
        ++this.p;
        let escaped = false;
        while (this.p < this.N) {
            ++this.p;
            if (this.input[this.p - 1] === this.input[begin] && !escaped)
                break;
            if (escaped)
                escaped = false;
            else if (this.input[this.p - 1] === '\\')
                escaped = true;
        }
        return new QuotedToken(this.input, begin, this.p, this.file);
    }
    *readFileNameTemplate(options) {
        const { outputDelimiterLeft } = options;
        const htmlStopStrings = [',', ' ', outputDelimiterLeft];
        const htmlStopStringSet = new Set(htmlStopStrings);
        // break on ',' and ' ', outputDelimiterLeft only stops HTML token
        while (this.p < this.N && !htmlStopStringSet.has(this.peek())) {
            yield this.match(outputDelimiterLeft)
                ? this.readOutputToken(options)
                : this.readHTMLToken(htmlStopStrings);
        }
    }
    match(word) {
        for (let i = 0; i < word.length; i++) {
            if (word[i] !== this.input[this.p + i])
                return false;
        }
        return true;
    }
    rmatch(pattern) {
        for (let i = 0; i < pattern.length; i++) {
            if (pattern[pattern.length - 1 - i] !== this.input[this.p - 1 - i])
                return false;
        }
        return true;
    }
    peekType(n = 0) {
        return this.p + n >= this.N ? 0 : TYPES[this.input.charCodeAt(this.p + n)];
    }
    peek(n = 0) {
        return this.p + n >= this.N ? '' : this.input[this.p + n];
    }
    skipBlank() {
        while (this.peekType() & BLANK)
            ++this.p;
    }
}

class ParseStream {
    constructor(tokens, parseToken) {
        this.handlers = {};
        this.stopRequested = false;
        this.tokens = tokens;
        this.parseToken = parseToken;
    }
    on(name, cb) {
        this.handlers[name] = cb;
        return this;
    }
    trigger(event, arg) {
        const h = this.handlers[event];
        return h ? (h.call(this, arg), true) : false;
    }
    start() {
        this.trigger('start');
        let token;
        while (!this.stopRequested && (token = this.tokens.shift())) {
            if (this.trigger('token', token))
                continue;
            if (isTagToken(token) && this.trigger(`tag:${token.name}`, token)) {
                continue;
            }
            const template = this.parseToken(token, this.tokens);
            this.trigger('template', template);
        }
        if (!this.stopRequested)
            this.trigger('end');
        return this;
    }
    stop() {
        this.stopRequested = true;
        return this;
    }
}

class TemplateImpl {
    constructor(token) {
        this.token = token;
    }
}

class Tag extends TemplateImpl {
    constructor(token, remainTokens, liquid) {
        super(token);
        this.name = token.name;
        this.liquid = liquid;
        this.tokenizer = token.tokenizer;
    }
}

/**
 * Key-Value Pairs Representing Tag Arguments
 * Example:
 *    For the markup `, foo:'bar', coo:2 reversed %}`,
 *    hash['foo'] === 'bar'
 *    hash['coo'] === 2
 *    hash['reversed'] === undefined
 */
class Hash {
    constructor(markup, jekyllStyle) {
        this.hash = {};
        const tokenizer = new Tokenizer(markup, {});
        for (const hash of tokenizer.readHashes(jekyllStyle)) {
            this.hash[hash.name.content] = hash.value;
        }
    }
    *render(ctx) {
        const hash = {};
        for (const key of Object.keys(this.hash)) {
            hash[key] = this.hash[key] === undefined ? true : yield evalToken(this.hash[key], ctx);
        }
        return hash;
    }
}

function createTagClass(options) {
    return class extends Tag {
        constructor(token, tokens, liquid) {
            super(token, tokens, liquid);
            if (isFunction(options.parse)) {
                options.parse.call(this, token, tokens);
            }
        }
        *render(ctx, emitter) {
            const hash = (yield new Hash(this.token.args).render(ctx));
            return yield options.render.call(this, ctx, emitter, hash);
        }
    };
}

function isKeyValuePair(arr) {
    return isArray(arr);
}

class Filter {
    constructor(name, options, args, liquid) {
        this.name = name;
        this.handler = isFunction(options)
            ? options
            : (isFunction(options === null || options === void 0 ? void 0 : options.handler) ? options.handler : identify);
        this.raw = !isFunction(options) && !!(options === null || options === void 0 ? void 0 : options.raw);
        this.args = args;
        this.liquid = liquid;
    }
    *render(value, context) {
        const argv = [];
        for (const arg of this.args) {
            if (isKeyValuePair(arg))
                argv.push([arg[0], yield evalToken(arg[1], context)]);
            else
                argv.push(yield evalToken(arg, context));
        }
        return yield this.handler.apply({ context, liquid: this.liquid }, [value, ...argv]);
    }
}

class Value {
    /**
     * @param str the value to be valuated, eg.: "foobar" | truncate: 3
     */
    constructor(input, liquid) {
        this.filters = [];
        const token = typeof input === 'string'
            ? new Tokenizer(input, liquid.options.operators).readFilteredValue()
            : input;
        this.initial = token.initial;
        this.filters = token.filters.map(({ name, args }) => new Filter(name, this.getFilter(liquid, name), args, liquid));
    }
    *value(ctx, lenient) {
        lenient = lenient || (ctx.opts.lenientIf && this.filters.length > 0 && this.filters[0].name === 'default');
        let val = yield this.initial.evaluate(ctx, lenient);
        for (const filter of this.filters) {
            val = yield filter.render(val, ctx);
        }
        return val;
    }
    getFilter(liquid, name) {
        const impl = liquid.filters[name];
        assert(impl || !liquid.options.strictFilters, () => `undefined filter: ${name}`);
        return impl;
    }
}

class Output extends TemplateImpl {
    constructor(token, liquid) {
        var _a;
        super(token);
        const tokenizer = new Tokenizer(token.input, liquid.options.operators, token.file, token.contentRange);
        this.value = new Value(tokenizer.readFilteredValue(), liquid);
        const filters = this.value.filters;
        const outputEscape = liquid.options.outputEscape;
        if (!((_a = filters[filters.length - 1]) === null || _a === void 0 ? void 0 : _a.raw) && outputEscape) {
            filters.push(new Filter(toString.call(outputEscape), outputEscape, [], liquid));
        }
    }
    *render(ctx, emitter) {
        const val = yield this.value.value(ctx, false);
        emitter.write(val);
    }
}

class HTML extends TemplateImpl {
    constructor(token) {
        super(token);
        this.str = token.getContent();
    }
    *render(ctx, emitter) {
        emitter.write(this.str);
    }
}

var LookupType;
(function (LookupType) {
    LookupType["Partials"] = "partials";
    LookupType["Layouts"] = "layouts";
    LookupType["Root"] = "root";
})(LookupType || (LookupType = {}));
class Loader {
    constructor(options) {
        this.options = options;
        if (options.relativeReference) {
            const sep = options.fs.sep;
            assert(sep, '`fs.sep` is required for relative reference');
            const rRelativePath = new RegExp(['.' + sep, '..' + sep, './', '../'].map(prefix => escapeRegex(prefix)).join('|'));
            this.shouldLoadRelative = (referencedFile) => rRelativePath.test(referencedFile);
        }
        else {
            this.shouldLoadRelative = (referencedFile) => false;
        }
        this.contains = this.options.fs.contains || (() => true);
    }
    *lookup(file, type, sync, currentFile) {
        const { fs } = this.options;
        const dirs = this.options[type];
        for (const filepath of this.candidates(file, dirs, currentFile, type !== LookupType.Root)) {
            if (sync ? fs.existsSync(filepath) : yield fs.exists(filepath))
                return filepath;
        }
        throw this.lookupError(file, dirs);
    }
    *candidates(file, dirs, currentFile, enforceRoot) {
        const { fs, extname } = this.options;
        if (this.shouldLoadRelative(file) && currentFile) {
            const referenced = fs.resolve(this.dirname(currentFile), file, extname);
            for (const dir of dirs) {
                if (!enforceRoot || this.contains(dir, referenced)) {
                    // the relatively referenced file is within one of root dirs
                    yield referenced;
                    break;
                }
            }
        }
        for (const dir of dirs) {
            const referenced = fs.resolve(dir, file, extname);
            if (!enforceRoot || this.contains(dir, referenced)) {
                yield referenced;
            }
        }
        if (fs.fallback !== undefined) {
            const filepath = fs.fallback(file);
            if (filepath !== undefined)
                yield filepath;
        }
    }
    dirname(path) {
        const fs = this.options.fs;
        assert(fs.dirname, '`fs.dirname` is required for relative reference');
        return fs.dirname(path);
    }
    lookupError(file, roots) {
        const err = new Error('ENOENT');
        err.message = `ENOENT: Failed to lookup "${file}" in "${roots}"`;
        err.code = 'ENOENT';
        return err;
    }
}

class Parser {
    constructor(liquid) {
        this.liquid = liquid;
        this.cache = this.liquid.options.cache;
        this.fs = this.liquid.options.fs;
        this.parseFile = this.cache ? this._parseFileCached : this._parseFile;
        this.loader = new Loader(this.liquid.options);
    }
    parse(html, filepath) {
        const tokenizer = new Tokenizer(html, this.liquid.options.operators, filepath);
        const tokens = tokenizer.readTopLevelTokens(this.liquid.options);
        return this.parseTokens(tokens);
    }
    parseTokens(tokens) {
        let token;
        const templates = [];
        while ((token = tokens.shift())) {
            templates.push(this.parseToken(token, tokens));
        }
        return templates;
    }
    parseToken(token, remainTokens) {
        try {
            if (isTagToken(token)) {
                const TagClass = this.liquid.tags[token.name];
                assert(TagClass, `tag "${token.name}" not found`);
                return new TagClass(token, remainTokens, this.liquid);
            }
            if (isOutputToken(token)) {
                return new Output(token, this.liquid);
            }
            return new HTML(token);
        }
        catch (e) {
            if (LiquidError.is(e))
                throw e;
            throw new ParseError(e, token);
        }
    }
    parseStream(tokens) {
        return new ParseStream(tokens, (token, tokens) => this.parseToken(token, tokens));
    }
    *_parseFileCached(file, sync, type = LookupType.Root, currentFile) {
        const cache = this.cache;
        const key = this.loader.shouldLoadRelative(file) ? currentFile + ',' + file : type + ':' + file;
        const tpls = yield cache.read(key);
        if (tpls)
            return tpls;
        const task = this._parseFile(file, sync, type, currentFile);
        // sync mode: exec the task and cache the result
        // async mode: cache the task before exec
        const taskOrTpl = sync ? yield task : toPromise(task);
        cache.write(key, taskOrTpl);
        // note: concurrent tasks will be reused, cache for failed task is removed until its end
        try {
            return yield taskOrTpl;
        }
        catch (err) {
            cache.remove(key);
            throw err;
        }
    }
    *_parseFile(file, sync, type = LookupType.Root, currentFile) {
        const filepath = yield this.loader.lookup(file, type, sync, currentFile);
        return this.liquid.parse(sync ? this.fs.readFileSync(filepath) : yield this.fs.readFile(filepath), filepath);
    }
}

var TokenKind;
(function (TokenKind) {
    TokenKind[TokenKind["Number"] = 1] = "Number";
    TokenKind[TokenKind["Literal"] = 2] = "Literal";
    TokenKind[TokenKind["Tag"] = 4] = "Tag";
    TokenKind[TokenKind["Output"] = 8] = "Output";
    TokenKind[TokenKind["HTML"] = 16] = "HTML";
    TokenKind[TokenKind["Filter"] = 32] = "Filter";
    TokenKind[TokenKind["Hash"] = 64] = "Hash";
    TokenKind[TokenKind["PropertyAccess"] = 128] = "PropertyAccess";
    TokenKind[TokenKind["Word"] = 256] = "Word";
    TokenKind[TokenKind["Range"] = 512] = "Range";
    TokenKind[TokenKind["Quoted"] = 1024] = "Quoted";
    TokenKind[TokenKind["Operator"] = 2048] = "Operator";
    TokenKind[TokenKind["FilteredValue"] = 4096] = "FilteredValue";
    TokenKind[TokenKind["Delimited"] = 12] = "Delimited";
})(TokenKind || (TokenKind = {}));

function isDelimitedToken(val) {
    return !!(getKind(val) & TokenKind.Delimited);
}
function isOperatorToken(val) {
    return getKind(val) === TokenKind.Operator;
}
function isHTMLToken(val) {
    return getKind(val) === TokenKind.HTML;
}
function isOutputToken(val) {
    return getKind(val) === TokenKind.Output;
}
function isTagToken(val) {
    return getKind(val) === TokenKind.Tag;
}
function isQuotedToken(val) {
    return getKind(val) === TokenKind.Quoted;
}
function isPropertyAccessToken(val) {
    return getKind(val) === TokenKind.PropertyAccess;
}
function isRangeToken(val) {
    return getKind(val) === TokenKind.Range;
}
function getKind(val) {
    return val ? val.kind : -1;
}

class Context {
    constructor(env = {}, opts = defaultOptions, renderOptions = {}) {
        var _a, _b, _c;
        /**
         * insert a Context-level empty scope,
         * for tags like `{% capture %}` `{% assign %}` to operate
         */
        this.scopes = [{}];
        this.registers = {};
        this.sync = !!renderOptions.sync;
        this.opts = opts;
        this.globals = (_a = renderOptions.globals) !== null && _a !== void 0 ? _a : opts.globals;
        this.environments = isObject(env) ? env : Object(env);
        this.strictVariables = (_b = renderOptions.strictVariables) !== null && _b !== void 0 ? _b : this.opts.strictVariables;
        this.ownPropertyOnly = (_c = renderOptions.ownPropertyOnly) !== null && _c !== void 0 ? _c : opts.ownPropertyOnly;
    }
    getRegister(key) {
        return (this.registers[key] = this.registers[key] || {});
    }
    setRegister(key, value) {
        return (this.registers[key] = value);
    }
    saveRegister(...keys) {
        return keys.map(key => [key, this.getRegister(key)]);
    }
    restoreRegister(keyValues) {
        return keyValues.forEach(([key, value]) => this.setRegister(key, value));
    }
    getAll() {
        return [this.globals, this.environments, ...this.scopes]
            .reduce((ctx, val) => __assign(ctx, val), {});
    }
    /**
     * @deprecated use `_get()` or `getSync()` instead
     */
    get(paths) {
        return this.getSync(paths);
    }
    getSync(paths) {
        return toValueSync(this._get(paths));
    }
    *_get(paths) {
        const scope = this.findScope(paths[0]);
        return yield this._getFromScope(scope, paths);
    }
    /**
     * @deprecated use `_get()` instead
     */
    getFromScope(scope, paths) {
        return toValueSync(this._getFromScope(scope, paths));
    }
    *_getFromScope(scope, paths, strictVariables = this.strictVariables) {
        if (isString(paths))
            paths = paths.split('.');
        for (let i = 0; i < paths.length; i++) {
            scope = yield readProperty(scope, paths[i], this.ownPropertyOnly);
            if (strictVariables && isUndefined(scope)) {
                throw new InternalUndefinedVariableError(paths.slice(0, i + 1).join('.'));
            }
        }
        return scope;
    }
    push(ctx) {
        return this.scopes.push(ctx);
    }
    pop() {
        return this.scopes.pop();
    }
    bottom() {
        return this.scopes[0];
    }
    findScope(key) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            const candidate = this.scopes[i];
            if (key in candidate)
                return candidate;
        }
        if (key in this.environments)
            return this.environments;
        return this.globals;
    }
}
function readProperty(obj, key, ownPropertyOnly) {
    obj = toLiquid(obj);
    if (isNil(obj))
        return obj;
    if (isArray(obj) && key < 0)
        return obj[obj.length + +key];
    const value = readJSProperty(obj, key, ownPropertyOnly);
    if (value === undefined && obj instanceof Drop)
        return obj.liquidMethodMissing(key);
    if (isFunction(value))
        return value.call(obj);
    if (key === 'size')
        return readSize(obj);
    else if (key === 'first')
        return readFirst(obj);
    else if (key === 'last')
        return readLast(obj);
    return value;
}
function readJSProperty(obj, key, ownPropertyOnly) {
    if (ownPropertyOnly && !Object.hasOwnProperty.call(obj, key) && !(obj instanceof Drop))
        return undefined;
    return obj[key];
}
function readFirst(obj) {
    if (isArray(obj))
        return obj[0];
    return obj['first'];
}
function readLast(obj) {
    if (isArray(obj))
        return obj[obj.length - 1];
    return obj['last'];
}
function readSize(obj) {
    if (obj.hasOwnProperty('size') || obj['size'] !== undefined)
        return obj['size'];
    if (isArray(obj) || isString(obj))
        return obj.length;
    if (typeof obj === 'object')
        return Object.keys(obj).length;
}

var BlockMode;
(function (BlockMode) {
    /* store rendered html into blocks */
    BlockMode[BlockMode["OUTPUT"] = 0] = "OUTPUT";
    /* output rendered html directly */
    BlockMode[BlockMode["STORE"] = 1] = "STORE";
})(BlockMode || (BlockMode = {}));

const abs = argumentsToValue(Math.abs);
const at_least = argumentsToValue(Math.max);
const at_most = argumentsToValue(Math.min);
const ceil = argumentsToValue(Math.ceil);
const divided_by = argumentsToValue((dividend, divisor, integerArithmetic = false) => integerArithmetic ? Math.floor(dividend / divisor) : dividend / divisor);
const floor = argumentsToValue(Math.floor);
const minus = argumentsToValue((v, arg) => v - arg);
const modulo = argumentsToValue((v, arg) => v % arg);
const times = argumentsToValue((v, arg) => v * arg);
function round(v, arg = 0) {
    v = toValue(v);
    arg = toValue(arg);
    const amp = Math.pow(10, arg);
    return Math.round(v * amp) / amp;
}
function plus(v, arg) {
    v = toValue(v);
    arg = toValue(arg);
    return Number(v) + Number(arg);
}

var mathFilters = /*#__PURE__*/Object.freeze({
  __proto__: null,
  abs: abs,
  at_least: at_least,
  at_most: at_most,
  ceil: ceil,
  divided_by: divided_by,
  floor: floor,
  minus: minus,
  modulo: modulo,
  times: times,
  round: round,
  plus: plus
});

const url_decode = (x) => stringify(x).split('+').map(decodeURIComponent).join(' ');
const url_encode = (x) => stringify(x).split(' ').map(encodeURIComponent).join('+');

var urlFilters = /*#__PURE__*/Object.freeze({
  __proto__: null,
  url_decode: url_decode,
  url_encode: url_encode
});

const join = argumentsToValue((v, arg) => toArray(v).join(arg === undefined ? ' ' : arg));
const last$1 = argumentsToValue((v) => isArray(v) ? last(v) : '');
const first = argumentsToValue((v) => isArray(v) ? v[0] : '');
const reverse = argumentsToValue((v) => [...toArray(v)].reverse());
function* sort(arr, property) {
    const values = [];
    for (const item of toArray(arr)) {
        values.push([
            item,
            property ? yield this.context._getFromScope(item, stringify(property).split('.'), false) : item
        ]);
    }
    return values.sort((lhs, rhs) => {
        const lvalue = lhs[1];
        const rvalue = rhs[1];
        return lvalue < rvalue ? -1 : (lvalue > rvalue ? 1 : 0);
    }).map(tuple => tuple[0]);
}
function sort_natural(input, property) {
    const propertyString = stringify(property);
    const compare = property === undefined
        ? caseInsensitiveCompare
        : (lhs, rhs) => caseInsensitiveCompare(lhs[propertyString], rhs[propertyString]);
    return [...toArray(input)].sort(compare);
}
const size = (v) => (v && v.length) || 0;
function* map(arr, property) {
    const results = [];
    for (const item of toArray(arr)) {
        results.push(yield this.context._getFromScope(item, stringify(property), false));
    }
    return results;
}
function* sum(arr, property) {
    let sum = 0;
    for (const item of toArray(arr)) {
        const data = Number(property ? yield this.context._getFromScope(item, stringify(property), false) : item);
        sum += Number.isNaN(data) ? 0 : data;
    }
    return sum;
}
function compact(arr) {
    return toArray(arr).filter(x => !isNil(toValue(x)));
}
function concat(v, arg = []) {
    return toArray(v).concat(toArray(arg));
}
function push(v, arg) {
    return concat(v, [arg]);
}
function unshift(v, arg) {
    const clone = [...toArray(v)];
    clone.unshift(arg);
    return clone;
}
function pop(v) {
    const clone = [...toArray(v)];
    clone.pop();
    return clone;
}
function shift(v) {
    const clone = [...toArray(v)];
    clone.shift();
    return clone;
}
function slice(v, begin, length = 1) {
    v = toValue(v);
    if (isNil(v))
        return [];
    if (!isArray(v))
        v = stringify(v);
    begin = begin < 0 ? v.length + begin : begin;
    return v.slice(begin, begin + length);
}
function* where(arr, property, expected) {
    const values = [];
    arr = toArray(arr);
    const token = new Tokenizer(stringify(property)).readScopeValue();
    for (const item of arr) {
        values.push(yield evalToken(token, new Context(item)));
    }
    return arr.filter((_, i) => {
        if (expected === undefined)
            return isTruthy(values[i], this.context);
        return equals(values[i], expected);
    });
}
function* where_exp(arr, itemName, exp) {
    const filtered = [];
    const keyTemplate = new Value(stringify(exp), this.liquid);
    for (const item of toArray(arr)) {
        const value = yield keyTemplate.value(new Context({ [itemName]: item }));
        if (value)
            filtered.push(item);
    }
    return filtered;
}
function* group_by(arr, property) {
    const map = new Map();
    arr = toArray(arr);
    const token = new Tokenizer(stringify(property)).readScopeValue();
    for (const item of arr) {
        const key = yield evalToken(token, new Context(item));
        if (!map.has(key))
            map.set(key, []);
        map.get(key).push(item);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
}
function* group_by_exp(arr, itemName, exp) {
    const map = new Map();
    const keyTemplate = new Value(stringify(exp), this.liquid);
    for (const item of toArray(arr)) {
        const key = yield keyTemplate.value(new Context({ [itemName]: item }));
        if (!map.has(key))
            map.set(key, []);
        map.get(key).push(item);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
}
function* find(arr, property, expected) {
    const token = new Tokenizer(stringify(property)).readScopeValue();
    for (const item of toArray(arr)) {
        const value = yield evalToken(token, new Context(item));
        if (equals(value, expected))
            return item;
    }
    return null;
}
function* find_exp(arr, itemName, exp) {
    const predicate = new Value(stringify(exp), this.liquid);
    for (const item of toArray(arr)) {
        const value = yield predicate.value(new Context({ [itemName]: item }));
        if (value)
            return item;
    }
    return null;
}
function uniq(arr) {
    arr = toValue(arr);
    const u = {};
    return (arr || []).filter(val => {
        if (hasOwnProperty.call(u, String(val)))
            return false;
        u[String(val)] = true;
        return true;
    });
}
function sample(v, count = 1) {
    v = toValue(v);
    if (isNil(v))
        return [];
    if (!isArray(v))
        v = stringify(v);
    const shuffled = [...v].sort(() => Math.random() - 0.5);
    if (count === 1)
        return shuffled[0];
    return shuffled.slice(0, count);
}

var arrayFilters = /*#__PURE__*/Object.freeze({
  __proto__: null,
  join: join,
  last: last$1,
  first: first,
  reverse: reverse,
  sort: sort,
  sort_natural: sort_natural,
  size: size,
  map: map,
  sum: sum,
  compact: compact,
  concat: concat,
  push: push,
  unshift: unshift,
  pop: pop,
  shift: shift,
  slice: slice,
  where: where,
  where_exp: where_exp,
  group_by: group_by,
  group_by_exp: group_by_exp,
  find: find,
  find_exp: find_exp,
  uniq: uniq,
  sample: sample
});

function date(v, format, timezoneOffset) {
    const opts = this.context.opts;
    let date;
    v = toValue(v);
    format = toValue(format);
    if (isNil(format))
        format = opts.dateFormat;
    else
        format = stringify(format);
    if (v === 'now' || v === 'today') {
        date = new Date();
    }
    else if (isNumber(v)) {
        date = new Date(v * 1000);
    }
    else if (isString(v)) {
        if (/^\d+$/.test(v)) {
            date = new Date(+v * 1000);
        }
        else if (opts.preserveTimezones) {
            date = TimezoneDate.createDateFixedToTimezone(v);
        }
        else {
            date = new Date(v);
        }
    }
    else {
        date = v;
    }
    if (!isValidDate(date))
        return v;
    if (timezoneOffset !== undefined) {
        date = new TimezoneDate(date, timezoneOffset);
    }
    else if (!(date instanceof TimezoneDate) && opts.timezoneOffset !== undefined) {
        date = new TimezoneDate(date, opts.timezoneOffset);
    }
    return strftime(date, format);
}
function isValidDate(date) {
    return (date instanceof Date || date instanceof TimezoneDate) && !isNaN(date.getTime());
}

var dateFilters = /*#__PURE__*/Object.freeze({
  __proto__: null,
  date: date
});

/**
 * String related filters
 *
 * * prefer stringify() to String() since `undefined`, `null` should eval ''
 */
function append(v, arg) {
    assert(arguments.length === 2, 'append expect 2 arguments');
    return stringify(v) + stringify(arg);
}
function prepend(v, arg) {
    assert(arguments.length === 2, 'prepend expect 2 arguments');
    return stringify(arg) + stringify(v);
}
function lstrip(v, chars) {
    if (chars) {
        chars = escapeRegExp(stringify(chars));
        return stringify(v).replace(new RegExp(`^[${chars}]+`, 'g'), '');
    }
    return stringify(v).replace(/^\s+/, '');
}
function downcase(v) {
    return stringify(v).toLowerCase();
}
function upcase(str) {
    return stringify(str).toUpperCase();
}
function remove(v, arg) {
    return stringify(v).split(String(arg)).join('');
}
function remove_first(v, l) {
    return stringify(v).replace(String(l), '');
}
function remove_last(v, l) {
    const str = stringify(v);
    const pattern = String(l);
    const index = str.lastIndexOf(pattern);
    if (index === -1)
        return str;
    return str.substring(0, index) + str.substring(index + pattern.length);
}
function rstrip(str, chars) {
    if (chars) {
        chars = escapeRegExp(stringify(chars));
        return stringify(str).replace(new RegExp(`[${chars}]+$`, 'g'), '');
    }
    return stringify(str).replace(/\s+$/, '');
}
function split(v, arg) {
    const arr = stringify(v).split(String(arg));
    // align to ruby split, which is the behavior of shopify/liquid
    // see: https://ruby-doc.org/core-2.4.0/String.html#method-i-split
    while (arr.length && arr[arr.length - 1] === '')
        arr.pop();
    return arr;
}
function strip(v, chars) {
    if (chars) {
        chars = escapeRegExp(stringify(chars));
        return stringify(v)
            .replace(new RegExp(`^[${chars}]+`, 'g'), '')
            .replace(new RegExp(`[${chars}]+$`, 'g'), '');
    }
    return stringify(v).trim();
}
function strip_newlines(v) {
    return stringify(v).replace(/\r?\n/gm, '');
}
function capitalize(str) {
    str = stringify(str);
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
function replace(v, pattern, replacement) {
    return stringify(v).split(String(pattern)).join(replacement);
}
function replace_first(v, arg1, arg2) {
    return stringify(v).replace(String(arg1), arg2);
}
function replace_last(v, arg1, arg2) {
    const str = stringify(v);
    const pattern = String(arg1);
    const index = str.lastIndexOf(pattern);
    if (index === -1)
        return str;
    const replacement = String(arg2);
    return str.substring(0, index) + replacement + str.substring(index + pattern.length);
}
function truncate(v, l = 50, o = '...') {
    v = stringify(v);
    if (v.length <= l)
        return v;
    return v.substring(0, l - o.length) + o;
}
function truncatewords(v, words = 15, o = '...') {
    const arr = stringify(v).split(/\s+/);
    if (words <= 0)
        words = 1;
    let ret = arr.slice(0, words).join(' ');
    if (arr.length >= words)
        ret += o;
    return ret;
}

var stringFilters = /*#__PURE__*/Object.freeze({
  __proto__: null,
  append: append,
  prepend: prepend,
  lstrip: lstrip,
  downcase: downcase,
  upcase: upcase,
  remove: remove,
  remove_first: remove_first,
  remove_last: remove_last,
  rstrip: rstrip,
  split: split,
  strip: strip,
  strip_newlines: strip_newlines,
  capitalize: capitalize,
  replace: replace,
  replace_first: replace_first,
  replace_last: replace_last,
  truncate: truncate,
  truncatewords: truncatewords
});

const filters = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, htmlFilters), mathFilters), urlFilters), arrayFilters), dateFilters), stringFilters), { json,
    raw, default: Default });

class AssignTag extends Tag {
    constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        this.key = this.tokenizer.readIdentifier().content;
        this.tokenizer.assert(this.key, 'expected variable name');
        this.tokenizer.skipBlank();
        this.tokenizer.assert(this.tokenizer.peek() === '=', 'expected "="');
        this.tokenizer.advance();
        this.value = new Value(this.tokenizer.readFilteredValue(), this.liquid);
    }
    *render(ctx) {
        ctx.bottom()[this.key] = yield this.value.value(ctx, this.liquid.options.lenientIf);
    }
}

const MODIFIERS = ['offset', 'limit', 'reversed'];
class ForTag extends Tag {
    constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        const variable = this.tokenizer.readIdentifier();
        const inStr = this.tokenizer.readIdentifier();
        const collection = this.tokenizer.readValue();
        if (!variable.size() || inStr.content !== 'in' || !collection) {
            throw new Error(`illegal tag: ${token.getText()}`);
        }
        this.variable = variable.content;
        this.collection = collection;
        this.hash = new Hash(this.tokenizer.remaining());
        this.templates = [];
        this.elseTemplates = [];
        let p;
        const stream = this.liquid.parser.parseStream(remainTokens)
            .on('start', () => (p = this.templates))
            .on('tag:else', () => (p = this.elseTemplates))
            .on('tag:endfor', () => stream.stop())
            .on('template', (tpl) => p.push(tpl))
            .on('end', () => {
            throw new Error(`tag ${token.getText()} not closed`);
        });
        stream.start();
    }
    *render(ctx, emitter) {
        const r = this.liquid.renderer;
        let collection = toEnumerable(yield evalToken(this.collection, ctx));
        if (!collection.length) {
            yield r.renderTemplates(this.elseTemplates, ctx, emitter);
            return;
        }
        const continueKey = 'continue-' + this.variable + '-' + this.collection.getText();
        ctx.push({ continue: ctx.getRegister(continueKey) });
        const hash = yield this.hash.render(ctx);
        ctx.pop();
        const modifiers = this.liquid.options.orderedFilterParameters
            ? Object.keys(hash).filter(x => MODIFIERS.includes(x))
            : MODIFIERS.filter(x => hash[x] !== undefined);
        collection = modifiers.reduce((collection, modifier) => {
            if (modifier === 'offset')
                return offset(collection, hash['offset']);
            if (modifier === 'limit')
                return limit(collection, hash['limit']);
            return reversed(collection);
        }, collection);
        ctx.setRegister(continueKey, (hash['offset'] || 0) + collection.length);
        const scope = { forloop: new ForloopDrop(collection.length, this.collection.getText(), this.variable) };
        ctx.push(scope);
        for (const item of collection) {
            scope[this.variable] = item;
            yield r.renderTemplates(this.templates, ctx, emitter);
            if (emitter['break']) {
                emitter['break'] = false;
                break;
            }
            emitter['continue'] = false;
            scope.forloop.next();
        }
        ctx.pop();
    }
}
function reversed(arr) {
    return [...arr].reverse();
}
function offset(arr, count) {
    return arr.slice(count);
}
function limit(arr, count) {
    return arr.slice(0, count);
}

class CaptureTag extends Tag {
    constructor(tagToken, remainTokens, liquid) {
        super(tagToken, remainTokens, liquid);
        this.templates = [];
        this.variable = this.readVariableName();
        while (remainTokens.length) {
            const token = remainTokens.shift();
            if (isTagToken(token) && token.name === 'endcapture')
                return;
            this.templates.push(liquid.parser.parseToken(token, remainTokens));
        }
        throw new Error(`tag ${tagToken.getText()} not closed`);
    }
    *render(ctx) {
        const r = this.liquid.renderer;
        const html = yield r.renderTemplates(this.templates, ctx);
        ctx.bottom()[this.variable] = html;
    }
    readVariableName() {
        const word = this.tokenizer.readIdentifier().content;
        if (word)
            return word;
        const quoted = this.tokenizer.readQuoted();
        if (quoted)
            return evalQuotedToken(quoted);
        throw this.tokenizer.error('invalid capture name');
    }
}

class CaseTag extends Tag {
    constructor(tagToken, remainTokens, liquid) {
        super(tagToken, remainTokens, liquid);
        this.branches = [];
        this.elseTemplates = [];
        this.value = new Value(this.tokenizer.readFilteredValue(), this.liquid);
        this.elseTemplates = [];
        let p = [];
        let elseCount = 0;
        const stream = this.liquid.parser.parseStream(remainTokens)
            .on('tag:when', (token) => {
            if (elseCount > 0) {
                return;
            }
            p = [];
            const values = [];
            while (!token.tokenizer.end()) {
                values.push(token.tokenizer.readValueOrThrow());
                token.tokenizer.skipBlank();
                if (token.tokenizer.peek() === ',') {
                    token.tokenizer.readTo(',');
                }
                else {
                    token.tokenizer.readTo('or');
                }
            }
            this.branches.push({
                values,
                templates: p
            });
        })
            .on('tag:else', () => {
            elseCount++;
            p = this.elseTemplates;
        })
            .on('tag:endcase', () => stream.stop())
            .on('template', (tpl) => {
            if (p !== this.elseTemplates || elseCount === 1) {
                p.push(tpl);
            }
        })
            .on('end', () => {
            throw new Error(`tag ${tagToken.getText()} not closed`);
        });
        stream.start();
    }
    *render(ctx, emitter) {
        const r = this.liquid.renderer;
        const target = toValue(yield this.value.value(ctx, ctx.opts.lenientIf));
        let branchHit = false;
        for (const branch of this.branches) {
            for (const valueToken of branch.values) {
                const value = yield evalToken(valueToken, ctx, ctx.opts.lenientIf);
                if (equals(target, value)) {
                    yield r.renderTemplates(branch.templates, ctx, emitter);
                    branchHit = true;
                    break;
                }
            }
        }
        if (!branchHit) {
            yield r.renderTemplates(this.elseTemplates, ctx, emitter);
        }
    }
}

class CommentTag extends Tag {
    constructor(tagToken, remainTokens, liquid) {
        super(tagToken, remainTokens, liquid);
        while (remainTokens.length) {
            const token = remainTokens.shift();
            if (isTagToken(token) && token.name === 'endcomment')
                return;
        }
        throw new Error(`tag ${tagToken.getText()} not closed`);
    }
    render() { }
}

class RenderTag extends Tag {
    constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        const tokenizer = this.tokenizer;
        this.file = parseFilePath(tokenizer, this.liquid);
        this.currentFile = token.file;
        while (!tokenizer.end()) {
            tokenizer.skipBlank();
            const begin = tokenizer.p;
            const keyword = tokenizer.readIdentifier();
            if (keyword.content === 'with' || keyword.content === 'for') {
                tokenizer.skipBlank();
                // can be normal key/value pair, like "with: true"
                if (tokenizer.peek() !== ':') {
                    const value = tokenizer.readValue();
                    // can be normal key, like "with,"
                    if (value) {
                        const beforeAs = tokenizer.p;
                        const asStr = tokenizer.readIdentifier();
                        let alias;
                        if (asStr.content === 'as')
                            alias = tokenizer.readIdentifier();
                        else
                            tokenizer.p = beforeAs;
                        this[keyword.content] = { value, alias: alias && alias.content };
                        tokenizer.skipBlank();
                        if (tokenizer.peek() === ',')
                            tokenizer.advance();
                        continue; // matched!
                    }
                }
            }
            /**
             * restore cursor if with/for not matched
             */
            tokenizer.p = begin;
            break;
        }
        this.hash = new Hash(tokenizer.remaining());
    }
    *render(ctx, emitter) {
        const { liquid, hash } = this;
        const filepath = (yield renderFilePath(this['file'], ctx, liquid));
        assert(filepath, () => `illegal file path "${filepath}"`);
        const childCtx = new Context({}, ctx.opts, { sync: ctx.sync, globals: ctx.globals, strictVariables: ctx.strictVariables });
        const scope = childCtx.bottom();
        __assign(scope, yield hash.render(ctx));
        if (this['with']) {
            const { value, alias } = this['with'];
            scope[alias || filepath] = yield evalToken(value, ctx);
        }
        if (this['for']) {
            const { value, alias } = this['for'];
            const collection = toEnumerable(yield evalToken(value, ctx));
            scope['forloop'] = new ForloopDrop(collection.length, value.getText(), alias);
            for (const item of collection) {
                scope[alias] = item;
                const templates = (yield liquid._parsePartialFile(filepath, childCtx.sync, this['currentFile']));
                yield liquid.renderer.renderTemplates(templates, childCtx, emitter);
                scope['forloop'].next();
            }
        }
        else {
            const templates = (yield liquid._parsePartialFile(filepath, childCtx.sync, this['currentFile']));
            yield liquid.renderer.renderTemplates(templates, childCtx, emitter);
        }
    }
}
/**
 * @return null for "none",
 * @return Template[] for quoted with tags and/or filters
 * @return Token for expression (not quoted)
 * @throws TypeError if cannot read next token
 */
function parseFilePath(tokenizer, liquid) {
    if (liquid.options.dynamicPartials) {
        const file = tokenizer.readValue();
        tokenizer.assert(file, 'illegal file path');
        if (file.getText() === 'none')
            return;
        if (isQuotedToken(file)) {
            // for filenames like "files/{{file}}", eval as liquid template
            const templates = liquid.parse(evalQuotedToken(file));
            return optimize(templates);
        }
        return file;
    }
    const tokens = [...tokenizer.readFileNameTemplate(liquid.options)];
    const templates = optimize(liquid.parser.parseTokens(tokens));
    return templates === 'none' ? undefined : templates;
}
function optimize(templates) {
    // for filenames like "files/file.liquid", extract the string directly
    if (templates.length === 1 && isHTMLToken(templates[0].token))
        return templates[0].token.getContent();
    return templates;
}
function* renderFilePath(file, ctx, liquid) {
    if (typeof file === 'string')
        return file;
    if (Array.isArray(file))
        return liquid.renderer.renderTemplates(file, ctx);
    return yield evalToken(file, ctx);
}

class IncludeTag extends Tag {
    constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        const { tokenizer } = token;
        this['file'] = parseFilePath(tokenizer, this.liquid);
        this['currentFile'] = token.file;
        const begin = tokenizer.p;
        const withStr = tokenizer.readIdentifier();
        if (withStr.content === 'with') {
            tokenizer.skipBlank();
            if (tokenizer.peek() !== ':') {
                this.withVar = tokenizer.readValue();
            }
            else
                tokenizer.p = begin;
        }
        else
            tokenizer.p = begin;
        this.hash = new Hash(tokenizer.remaining(), this.liquid.options.jekyllInclude);
    }
    *render(ctx, emitter) {
        const { liquid, hash, withVar } = this;
        const { renderer } = liquid;
        const filepath = (yield renderFilePath(this['file'], ctx, liquid));
        assert(filepath, () => `illegal file path "${filepath}"`);
        const saved = ctx.saveRegister('blocks', 'blockMode');
        ctx.setRegister('blocks', {});
        ctx.setRegister('blockMode', BlockMode.OUTPUT);
        const scope = (yield hash.render(ctx));
        if (withVar)
            scope[filepath] = yield evalToken(withVar, ctx);
        const templates = (yield liquid._parsePartialFile(filepath, ctx.sync, this['currentFile']));
        ctx.push(ctx.opts.jekyllInclude ? { include: scope } : scope);
        yield renderer.renderTemplates(templates, ctx, emitter);
        ctx.pop();
        ctx.restoreRegister(saved);
    }
}

class DecrementTag extends Tag {
    constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        this.variable = this.tokenizer.readIdentifier().content;
    }
    render(context, emitter) {
        const scope = context.environments;
        if (!isNumber(scope[this.variable])) {
            scope[this.variable] = 0;
        }
        emitter.write(stringify(--scope[this.variable]));
    }
}

class CycleTag extends Tag {
    constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        this.candidates = [];
        const group = this.tokenizer.readValue();
        this.tokenizer.skipBlank();
        if (group) {
            if (this.tokenizer.peek() === ':') {
                this.group = group;
                this.tokenizer.advance();
            }
            else
                this.candidates.push(group);
        }
        while (!this.tokenizer.end()) {
            const value = this.tokenizer.readValue();
            if (value)
                this.candidates.push(value);
            this.tokenizer.readTo(',');
        }
        this.tokenizer.assert(this.candidates.length, () => `empty candidates: "${token.getText()}"`);
    }
    *render(ctx, emitter) {
        const group = (yield evalToken(this.group, ctx));
        const fingerprint = `cycle:${group}:` + this.candidates.join(',');
        const groups = ctx.getRegister('cycle');
        let idx = groups[fingerprint];
        if (idx === undefined) {
            idx = groups[fingerprint] = 0;
        }
        const candidate = this.candidates[idx];
        idx = (idx + 1) % this.candidates.length;
        groups[fingerprint] = idx;
        return yield evalToken(candidate, ctx);
    }
}

class IfTag extends Tag {
    constructor(tagToken, remainTokens, liquid) {
        super(tagToken, remainTokens, liquid);
        this.branches = [];
        this.elseTemplates = [];
        let p = [];
        let elseCount = 0;
        liquid.parser.parseStream(remainTokens)
            .on('start', () => this.branches.push({
            value: new Value(tagToken.args, this.liquid),
            templates: (p = [])
        }))
            .on('tag:elsif', (token) => {
            if (elseCount > 0) {
                p = [];
                return;
            }
            this.branches.push({
                value: new Value(token.args, this.liquid),
                templates: (p = [])
            });
        })
            .on('tag:else', () => {
            elseCount++;
            p = this.elseTemplates;
        })
            .on('tag:endif', function () { this.stop(); })
            .on('template', (tpl) => {
            if (p !== this.elseTemplates || elseCount === 1) {
                p.push(tpl);
            }
        })
            .on('end', () => { throw new Error(`tag ${tagToken.getText()} not closed`); })
            .start();
    }
    *render(ctx, emitter) {
        const r = this.liquid.renderer;
        for (const { value, templates } of this.branches) {
            const v = yield value.value(ctx, ctx.opts.lenientIf);
            if (isTruthy(v, ctx)) {
                yield r.renderTemplates(templates, ctx, emitter);
                return;
            }
        }
        yield r.renderTemplates(this.elseTemplates, ctx, emitter);
    }
}

class IncrementTag extends Tag {
    constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        this.variable = this.tokenizer.readIdentifier().content;
    }
    render(context, emitter) {
        const scope = context.environments;
        if (!isNumber(scope[this.variable])) {
            scope[this.variable] = 0;
        }
        const val = scope[this.variable];
        scope[this.variable]++;
        emitter.write(stringify(val));
    }
}

class LayoutTag extends Tag {
    constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        this.file = parseFilePath(this.tokenizer, this.liquid);
        this['currentFile'] = token.file;
        this.args = new Hash(this.tokenizer.remaining());
        this.templates = this.liquid.parser.parseTokens(remainTokens);
    }
    *render(ctx, emitter) {
        const { liquid, args, file } = this;
        const { renderer } = liquid;
        if (file === undefined) {
            ctx.setRegister('blockMode', BlockMode.OUTPUT);
            yield renderer.renderTemplates(this.templates, ctx, emitter);
            return;
        }
        const filepath = (yield renderFilePath(this.file, ctx, liquid));
        assert(filepath, () => `illegal file path "${filepath}"`);
        const templates = (yield liquid._parseLayoutFile(filepath, ctx.sync, this['currentFile']));
        // render remaining contents and store rendered results
        ctx.setRegister('blockMode', BlockMode.STORE);
        const html = yield renderer.renderTemplates(this.templates, ctx);
        const blocks = ctx.getRegister('blocks');
        // set whole content to anonymous block if anonymous doesn't specified
        if (blocks[''] === undefined)
            blocks[''] = (parent, emitter) => emitter.write(html);
        ctx.setRegister('blockMode', BlockMode.OUTPUT);
        // render the layout file use stored blocks
        ctx.push((yield args.render(ctx)));
        yield renderer.renderTemplates(templates, ctx, emitter);
        ctx.pop();
    }
}

class BlockTag extends Tag {
    constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        this.templates = [];
        const match = /\w+/.exec(token.args);
        this.block = match ? match[0] : '';
        while (remainTokens.length) {
            const token = remainTokens.shift();
            if (isTagToken(token) && token.name === 'endblock')
                return;
            const template = liquid.parser.parseToken(token, remainTokens);
            this.templates.push(template);
        }
        throw new Error(`tag ${token.getText()} not closed`);
    }
    *render(ctx, emitter) {
        const blockRender = this.getBlockRender(ctx);
        if (ctx.getRegister('blockMode') === BlockMode.STORE) {
            ctx.getRegister('blocks')[this.block] = blockRender;
        }
        else {
            yield blockRender(new BlockDrop(), emitter);
        }
    }
    getBlockRender(ctx) {
        const { liquid, templates } = this;
        const renderChild = ctx.getRegister('blocks')[this.block];
        const renderCurrent = function* (superBlock, emitter) {
            // add {{ block.super }} support when rendering
            ctx.push({ block: superBlock });
            yield liquid.renderer.renderTemplates(templates, ctx, emitter);
            ctx.pop();
        };
        return renderChild
            ? (superBlock, emitter) => renderChild(new BlockDrop(() => renderCurrent(superBlock, emitter)), emitter)
            : renderCurrent;
    }
}

class RawTag extends Tag {
    constructor(tagToken, remainTokens, liquid) {
        super(tagToken, remainTokens, liquid);
        this.tokens = [];
        while (remainTokens.length) {
            const token = remainTokens.shift();
            if (isTagToken(token) && token.name === 'endraw')
                return;
            this.tokens.push(token);
        }
        throw new Error(`tag ${tagToken.getText()} not closed`);
    }
    render() {
        return this.tokens.map((token) => token.getText()).join('');
    }
}

class TablerowloopDrop extends ForloopDrop {
    constructor(length, cols, collection, variable) {
        super(length, collection, variable);
        this.length = length;
        this.cols = cols;
    }
    row() {
        return Math.floor(this.i / this.cols) + 1;
    }
    col0() {
        return (this.i % this.cols);
    }
    col() {
        return this.col0() + 1;
    }
    col_first() {
        return this.col0() === 0;
    }
    col_last() {
        return this.col() === this.cols;
    }
}

class TablerowTag extends Tag {
    constructor(tagToken, remainTokens, liquid) {
        super(tagToken, remainTokens, liquid);
        const variable = this.tokenizer.readIdentifier();
        this.tokenizer.skipBlank();
        const predicate = this.tokenizer.readIdentifier();
        const collectionToken = this.tokenizer.readValue();
        if (predicate.content !== 'in' || !collectionToken) {
            throw new Error(`illegal tag: ${tagToken.getText()}`);
        }
        this.variable = variable.content;
        this.collection = collectionToken;
        this.args = new Hash(this.tokenizer.remaining());
        this.templates = [];
        let p;
        const stream = this.liquid.parser.parseStream(remainTokens)
            .on('start', () => (p = this.templates))
            .on('tag:endtablerow', () => stream.stop())
            .on('template', (tpl) => p.push(tpl))
            .on('end', () => {
            throw new Error(`tag ${tagToken.getText()} not closed`);
        });
        stream.start();
    }
    *render(ctx, emitter) {
        let collection = toEnumerable(yield evalToken(this.collection, ctx));
        const args = (yield this.args.render(ctx));
        const offset = args.offset || 0;
        const limit = (args.limit === undefined) ? collection.length : args.limit;
        collection = collection.slice(offset, offset + limit);
        const cols = args.cols || collection.length;
        const r = this.liquid.renderer;
        const tablerowloop = new TablerowloopDrop(collection.length, cols, this.collection.getText(), this.variable);
        const scope = { tablerowloop };
        ctx.push(scope);
        for (let idx = 0; idx < collection.length; idx++, tablerowloop.next()) {
            scope[this.variable] = collection[idx];
            if (tablerowloop.col0() === 0) {
                if (tablerowloop.row() !== 1)
                    emitter.write('</tr>');
                emitter.write(`<tr class="row${tablerowloop.row()}">`);
            }
            emitter.write(`<td class="col${tablerowloop.col()}">`);
            yield r.renderTemplates(this.templates, ctx, emitter);
            emitter.write('</td>');
        }
        if (collection.length)
            emitter.write('</tr>');
        ctx.pop();
    }
}

class UnlessTag extends Tag {
    constructor(tagToken, remainTokens, liquid) {
        super(tagToken, remainTokens, liquid);
        this.branches = [];
        this.elseTemplates = [];
        let p = [];
        let elseCount = 0;
        this.liquid.parser.parseStream(remainTokens)
            .on('start', () => this.branches.push({
            value: new Value(tagToken.args, this.liquid),
            test: isFalsy,
            templates: (p = [])
        }))
            .on('tag:elsif', (token) => {
            if (elseCount > 0) {
                p = [];
                return;
            }
            this.branches.push({
                value: new Value(token.args, this.liquid),
                test: isTruthy,
                templates: (p = [])
            });
        })
            .on('tag:else', () => {
            elseCount++;
            p = this.elseTemplates;
        })
            .on('tag:endunless', function () { this.stop(); })
            .on('template', (tpl) => {
            if (p !== this.elseTemplates || elseCount === 1) {
                p.push(tpl);
            }
        })
            .on('end', () => { throw new Error(`tag ${tagToken.getText()} not closed`); })
            .start();
    }
    *render(ctx, emitter) {
        const r = this.liquid.renderer;
        for (const { value, test, templates } of this.branches) {
            const v = yield value.value(ctx, ctx.opts.lenientIf);
            if (test(v, ctx)) {
                yield r.renderTemplates(templates, ctx, emitter);
                return;
            }
        }
        yield r.renderTemplates(this.elseTemplates, ctx, emitter);
    }
}

class BreakTag extends Tag {
    render(ctx, emitter) {
        emitter['break'] = true;
    }
}

class ContinueTag extends Tag {
    render(ctx, emitter) {
        emitter['continue'] = true;
    }
}

class EchoTag extends Tag {
    constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        this.tokenizer.skipBlank();
        if (!this.tokenizer.end()) {
            this.value = new Value(this.tokenizer.readFilteredValue(), this.liquid);
        }
    }
    *render(ctx, emitter) {
        if (!this.value)
            return;
        const val = yield this.value.value(ctx, false);
        emitter.write(val);
    }
}

class LiquidTag extends Tag {
    constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        const tokens = this.tokenizer.readLiquidTagTokens(this.liquid.options);
        this.templates = this.liquid.parser.parseTokens(tokens);
    }
    *render(ctx, emitter) {
        yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    }
}

class InlineCommentTag extends Tag {
    constructor(tagToken, remainTokens, liquid) {
        super(tagToken, remainTokens, liquid);
        if (tagToken.args.search(/\n\s*[^#\s]/g) !== -1) {
            throw new Error('every line of an inline comment must start with a \'#\' character');
        }
    }
    render() { }
}

const tags = {
    assign: AssignTag,
    'for': ForTag,
    capture: CaptureTag,
    'case': CaseTag,
    comment: CommentTag,
    include: IncludeTag,
    render: RenderTag,
    decrement: DecrementTag,
    increment: IncrementTag,
    cycle: CycleTag,
    'if': IfTag,
    layout: LayoutTag,
    block: BlockTag,
    raw: RawTag,
    tablerow: TablerowTag,
    unless: UnlessTag,
    'break': BreakTag,
    'continue': ContinueTag,
    echo: EchoTag,
    liquid: LiquidTag,
    '#': InlineCommentTag
};

class Liquid {
    constructor(opts = {}) {
        this.renderer = new Render();
        this.filters = {};
        this.tags = {};
        this.options = normalize(opts);
        this.parser = new Parser(this);
        forOwn(tags, (conf, name) => this.registerTag(name, conf));
        forOwn(filters, (handler, name) => this.registerFilter(name, handler));
    }
    parse(html, filepath) {
        return this.parser.parse(html, filepath);
    }
    _render(tpl, scope, renderOptions) {
        const ctx = scope instanceof Context ? scope : new Context(scope, this.options, renderOptions);
        return this.renderer.renderTemplates(tpl, ctx);
    }
    render(tpl, scope, renderOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            return toPromise(this._render(tpl, scope, Object.assign(Object.assign({}, renderOptions), { sync: false })));
        });
    }
    renderSync(tpl, scope, renderOptions) {
        return toValueSync(this._render(tpl, scope, Object.assign(Object.assign({}, renderOptions), { sync: true })));
    }
    renderToNodeStream(tpl, scope, renderOptions = {}) {
        const ctx = new Context(scope, this.options, renderOptions);
        return this.renderer.renderTemplatesToNodeStream(tpl, ctx);
    }
    _parseAndRender(html, scope, renderOptions) {
        const tpl = this.parse(html);
        return this._render(tpl, scope, renderOptions);
    }
    parseAndRender(html, scope, renderOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            return toPromise(this._parseAndRender(html, scope, Object.assign(Object.assign({}, renderOptions), { sync: false })));
        });
    }
    parseAndRenderSync(html, scope, renderOptions) {
        return toValueSync(this._parseAndRender(html, scope, Object.assign(Object.assign({}, renderOptions), { sync: true })));
    }
    _parsePartialFile(file, sync, currentFile) {
        return this.parser.parseFile(file, sync, LookupType.Partials, currentFile);
    }
    _parseLayoutFile(file, sync, currentFile) {
        return this.parser.parseFile(file, sync, LookupType.Layouts, currentFile);
    }
    _parseFile(file, sync, lookupType, currentFile) {
        return this.parser.parseFile(file, sync, lookupType, currentFile);
    }
    parseFile(file, lookupType) {
        return __awaiter(this, void 0, void 0, function* () {
            return toPromise(this.parser.parseFile(file, false, lookupType));
        });
    }
    parseFileSync(file, lookupType) {
        return toValueSync(this.parser.parseFile(file, true, lookupType));
    }
    *_renderFile(file, ctx, renderFileOptions) {
        const templates = (yield this._parseFile(file, renderFileOptions.sync, renderFileOptions.lookupType));
        return yield this._render(templates, ctx, renderFileOptions);
    }
    renderFile(file, ctx, renderFileOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            return toPromise(this._renderFile(file, ctx, Object.assign(Object.assign({}, renderFileOptions), { sync: false })));
        });
    }
    renderFileSync(file, ctx, renderFileOptions) {
        return toValueSync(this._renderFile(file, ctx, Object.assign(Object.assign({}, renderFileOptions), { sync: true })));
    }
    renderFileToNodeStream(file, scope, renderOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const templates = yield this.parseFile(file);
            return this.renderToNodeStream(templates, scope, renderOptions);
        });
    }
    _evalValue(str, scope) {
        const value = new Value(str, this);
        const ctx = scope instanceof Context ? scope : new Context(scope, this.options);
        return value.value(ctx);
    }
    evalValue(str, scope) {
        return __awaiter(this, void 0, void 0, function* () {
            return toPromise(this._evalValue(str, scope));
        });
    }
    evalValueSync(str, scope) {
        return toValueSync(this._evalValue(str, scope));
    }
    registerFilter(name, filter) {
        this.filters[name] = filter;
    }
    registerTag(name, tag) {
        this.tags[name] = isFunction(tag) ? tag : createTagClass(tag);
    }
    plugin(plugin) {
        return plugin.call(this, Liquid);
    }
    express() {
        const self = this; // eslint-disable-line
        let firstCall = true;
        return function (filePath, ctx, callback) {
            if (firstCall) {
                firstCall = false;
                const dirs = normalizeDirectoryList(this.root);
                self.options.root.unshift(...dirs);
                self.options.layouts.unshift(...dirs);
                self.options.partials.unshift(...dirs);
            }
            self.renderFile(filePath, ctx).then(html => callback(null, html), callback);
        };
    }
}

/**
 * Description
 * @param {string} fileName
 * @returns {Promise<string>}
 */
function readTemplateFile(fileName) {
  const filePath = `./extensions/templates/${fileName}`;
  return new Promise((resolve, reject) => {
    require$$6.readFile(filePath, "utf8", (error, data) => {
      if (error) reject(error);
      resolve(data);
    });
  });
}

/**
 * Description
 * @param {Record<string, any>} data
 * @param {string} filePath
 * @returns {Promise<string>}
 */
function parseLiquidData(data, filePath) {
  return new Promise((resolve, reject) => {
    readTemplateFile(filePath)
      .then((text) => {
        const engine = new Liquid();
        const tpl = engine.parse(text);
        engine
          .render(tpl, data)
          .then((content) => resolve(content))
          .catch((error) => {
            console.log(error);
            resolve("");
          });
      })
      .catch((error) => {
        console.log(error);
        reject(error);
      });
  });
}

var e0 = defineEndpoint({
  id: "flow2pdf",
  handler: (router) => {
    router.post("/print", async (req, res) => {
      const { flow_data, template } = req.body;
      try {
        const text = await parseLiquidData(flow_data, template);
        return res.json({
          html: text,
        });
      } catch (error) {
        console.log(error);
        return res.json({});
      }
    });
  },
});

// src/create-error.ts
var createError = (code, message, status = 500) => {
  return class extends Error {
    name = "DirectusError";
    extensions;
    code = code.toUpperCase();
    status = status;
    constructor(extensions, options) {
      const msg = typeof message === "string" ? message : message(extensions);
      super(msg, options);
      this.extensions = extensions;
    }
    toString() {
      return `${this.name} [${this.code}]: ${this.message}`;
    }
  };
};

const UnexpectedError = createError(
  "UNEXPECTED_ERROR",
  "We encountered an unexpected error. Please try again later.",
  500
);

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
var byteToHex = [];
for (var i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  //
  // Note to future-self: No, you can't remove the `toLowerCase()` call.
  // REF: https://github.com/uuidjs/uuid/pull/677#issuecomment-1757351351
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// Unique ID creation requires a high quality random # generator. In the browser we therefore
// require the crypto API and do not support built-in fallback to lower quality random number
// generators (like Math.random()).

var getRandomValues;
var rnds8 = new Uint8Array(16);
function rng() {
  // lazy load so that environments that need to polyfill have a chance to do so
  if (!getRandomValues) {
    // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation.
    getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);
    if (!getRandomValues) {
      throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
    }
  }
  return getRandomValues(rnds8);
}

var randomUUID = typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID.bind(crypto);
var native = {
  randomUUID
};

function v4(options, buf, offset) {
  if (native.randomUUID && !buf && !options) {
    return native.randomUUID();
  }
  options = options || {};
  var rnds = options.random || (options.rng || rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = rnds[6] & 0x0f | 0x40;
  rnds[8] = rnds[8] & 0x3f | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    offset = offset || 0;
    for (var i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}

const htmlToPdf = require("html-pdf-node");

async function saveDirectusFile(
  fileName,
  { database, getSchema, accountability, services }
) {
  const schema = await getSchema();
  const serviceOptions = { knex: database, schema, accountability };
  const fileService = new services.FilesService(serviceOptions);
  const id = await fileService.createOne({
    storage: "local",
    filename_disk: fileName,
    filename_download: fileName,
    title: fileName,
    type: "application/pdf",
    folder: null,
  });
  return await fileService.readOne(id);
}

function writeOperationFile(fileContent, context) {
  const fileName = `${v4()}.pdf`;
  const filePath = `./uploads/${fileName}`;

  return new Promise((resolve, reject) => {
    require$$6.writeFile(filePath, fileContent, (error) => {
      if (error) reject(error);
      saveDirectusFile(fileName, context)
        .then((data) => resolve(data))
        .catch((error) => reject(error));
    });
  });
}

async function saveOperationPdfFile(fileContent, context) {
  let options = { format: "A4" };
  const file = { content: fileContent };
  const pdfBuffer = await htmlToPdf.generatePdf(file, options);
  return await writeOperationFile(pdfBuffer, context);
}

var e1 = {
  id: "flow2pdf-operation",
  handler: async ({ template }, context) => {
    const { data } = context;
    try {
      const flowData = data["$last"];
      const text = await parseLiquidData(flowData, template);
      return await saveOperationPdfFile(text, context);
    } catch (error) {
      console.log(error);
      throw new UnexpectedError({
        collection: "directus_files",
      });
    }
  },
};

const hooks = [];const endpoints = [{name:'flow2pdf-endpoint',config:e0}];const operations = [{name:'flow2pdf-operation',config:e1}];

exports.endpoints = endpoints;
exports.hooks = hooks;
exports.operations = operations;
