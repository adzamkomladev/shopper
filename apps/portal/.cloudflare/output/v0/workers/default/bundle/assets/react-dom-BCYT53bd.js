import { a as __toESM, t as __commonJSMin } from "./rolldown-runtime-7_rZTKki.js";
// @__NO_SIDE_EFFECTS__
function getGlobalConfig(config2) {
  return {
    lang: config2?.lang ?? void 0,
    message: config2?.message,
    abortEarly: config2?.abortEarly ?? void 0,
    abortPipeEarly: config2?.abortPipeEarly ?? void 0,
  };
}
var store4;
function setSpecificMessage(reference, message2, lang) {
  if (!store4) store4 = /* @__PURE__ */ new Map();
  if (!store4.get(reference)) store4.set(reference, /* @__PURE__ */ new Map());
  store4.get(reference).set(lang, message2);
}
// @__NO_SIDE_EFFECTS__
function getSpecificMessage(reference, lang) {
  return store4?.get(reference)?.get(lang);
}
// @__NO_SIDE_EFFECTS__
function _stringify(input) {
  const type = typeof input;
  if (type === "string") return `"${input}"`;
  if (type === "number" || type === "bigint" || type === "boolean") return `${input}`;
  if (type === "object" || type === "function")
    return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
  return type;
}
function _addIssue(context, label, dataset, config2, other) {
  const input = other && "input" in other ? other.input : dataset.value;
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? /* @__PURE__ */ _stringify(input);
  const issue = {
    kind: context.kind,
    type: context.type,
    input,
    expected,
    received,
    message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
    requirement: context.requirement,
    path: other?.path,
    issues: other?.issues,
    lang: config2.lang,
    abortEarly: config2.abortEarly,
    abortPipeEarly: config2.abortPipeEarly,
  };
  const isSchema = context.kind === "schema";
  const message2 =
    other?.message ??
    context.message ??
    /* @__PURE__ */ getSpecificMessage(context.reference, issue.lang) ??
    (isSchema ? (issue.lang, void 0) : null) ??
    config2.message ??
    (issue.lang, void 0);
  if (message2 !== void 0)
    issue.message = typeof message2 === "function" ? message2(issue) : message2;
  if (isSchema) dataset.typed = false;
  if (dataset.issues) dataset.issues.push(issue);
  else dataset.issues = [issue];
}
// @__NO_SIDE_EFFECTS__
function _getStandardProps(context) {
  return {
    version: 1,
    vendor: "valibot",
    validate(value2) {
      return context["~run"]({ value: value2 }, /* @__PURE__ */ getGlobalConfig());
    },
  };
}
// @__NO_SIDE_EFFECTS__
function _isValidObjectKey(object2, key) {
  return (
    Object.hasOwn(object2, key) &&
    key !== "__proto__" &&
    key !== "prototype" &&
    key !== "constructor"
  );
}
// @__NO_SIDE_EFFECTS__
function _joinExpects(values2, separator) {
  const list = [...new Set(values2)];
  if (list.length > 1) return `(${list.join(` ${separator} `)})`;
  return list[0] ?? "never";
}
// @__NO_SIDE_EFFECTS__
function getDotPath(issue) {
  if (issue.path) {
    let key = "";
    for (const item of issue.path)
      if (typeof item.key === "string" || typeof item.key === "number") {
        if (key) key += `.${item.key}`;
        else key += item.key;
      } else return null;
    return key;
  }
  return null;
}
// @__NO_SIDE_EFFECTS__
function isValiError(error) {
  return error instanceof ValiError;
}
var ValiError = class extends Error {
  /**
   * Creates a Valibot error with useful information.
   *
   * @param issues The error issues.
   */
  constructor(issues) {
    super(issues[0].message);
    this.name = "ValiError";
    this.issues = issues;
  }
};
var EMAIL_REGEX = /^[\w+-]+(?:\.[\w+-]+)*@[\da-z]+(?:[.-][\da-z]+)*\.[a-z]{2,}$/iu;
var ISO_TIMESTAMP_REGEX =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:[12]\d|0[1-9]|3[01])[T ](?:0\d|1\d|2[0-3])(?::[0-5]\d){2}(?:\.\d{1,9})?(?:Z|[+-](?:0\d|1\d|2[0-3])(?::?[0-5]\d)?)$/u;
var UUID_REGEX = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu;
// @__NO_SIDE_EFFECTS__
function brand(name) {
  return {
    kind: "transformation",
    type: "brand",
    reference: brand,
    async: false,
    name,
    "~run"(dataset) {
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function check(requirement, message2) {
  return {
    kind: "validation",
    type: "check",
    reference: check,
    async: false,
    expects: null,
    requirement,
    message: message2,
    "~run"(dataset, config2) {
      if (dataset.typed && !this.requirement(dataset.value))
        _addIssue(this, "input", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function email(message2) {
  return {
    kind: "validation",
    type: "email",
    reference: email,
    expects: null,
    async: false,
    requirement: EMAIL_REGEX,
    message: message2,
    "~run"(dataset, config2) {
      if (dataset.typed && !this.requirement.test(dataset.value))
        _addIssue(this, "email", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function finite(message2) {
  return {
    kind: "validation",
    type: "finite",
    reference: finite,
    async: false,
    expects: null,
    requirement: Number.isFinite,
    message: message2,
    "~run"(dataset, config2) {
      if (dataset.typed && !this.requirement(dataset.value))
        _addIssue(this, "finite", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function integer(message2) {
  return {
    kind: "validation",
    type: "integer",
    reference: integer,
    async: false,
    expects: null,
    requirement: Number.isInteger,
    message: message2,
    "~run"(dataset, config2) {
      if (dataset.typed && !this.requirement(dataset.value))
        _addIssue(this, "integer", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function isoTimestamp(message2) {
  return {
    kind: "validation",
    type: "iso_timestamp",
    reference: isoTimestamp,
    async: false,
    expects: null,
    requirement: ISO_TIMESTAMP_REGEX,
    message: message2,
    "~run"(dataset, config2) {
      if (dataset.typed && !this.requirement.test(dataset.value))
        _addIssue(this, "timestamp", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function maxLength(requirement, message2) {
  return {
    kind: "validation",
    type: "max_length",
    reference: maxLength,
    async: false,
    expects: `<=${requirement}`,
    requirement,
    message: message2,
    "~run"(dataset, config2) {
      if (dataset.typed && dataset.value.length > this.requirement)
        _addIssue(this, "length", dataset, config2, { received: `${dataset.value.length}` });
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function maxValue(requirement, message2) {
  return {
    kind: "validation",
    type: "max_value",
    reference: maxValue,
    async: false,
    expects: `<=${requirement instanceof Date ? requirement.toJSON() : /* @__PURE__ */ _stringify(requirement)}`,
    requirement,
    message: message2,
    "~run"(dataset, config2) {
      if (dataset.typed && !(dataset.value <= this.requirement))
        _addIssue(this, "value", dataset, config2, {
          received:
            dataset.value instanceof Date
              ? dataset.value.toJSON()
              : /* @__PURE__ */ _stringify(dataset.value),
        });
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function minLength(requirement, message2) {
  return {
    kind: "validation",
    type: "min_length",
    reference: minLength,
    async: false,
    expects: `>=${requirement}`,
    requirement,
    message: message2,
    "~run"(dataset, config2) {
      if (dataset.typed && dataset.value.length < this.requirement)
        _addIssue(this, "length", dataset, config2, { received: `${dataset.value.length}` });
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function minValue(requirement, message2) {
  return {
    kind: "validation",
    type: "min_value",
    reference: minValue,
    async: false,
    expects: `>=${requirement instanceof Date ? requirement.toJSON() : /* @__PURE__ */ _stringify(requirement)}`,
    requirement,
    message: message2,
    "~run"(dataset, config2) {
      if (dataset.typed && !(dataset.value >= this.requirement))
        _addIssue(this, "value", dataset, config2, {
          received:
            dataset.value instanceof Date
              ? dataset.value.toJSON()
              : /* @__PURE__ */ _stringify(dataset.value),
        });
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function nonEmpty(message2) {
  return {
    kind: "validation",
    type: "non_empty",
    reference: nonEmpty,
    async: false,
    expects: "!0",
    message: message2,
    "~run"(dataset, config2) {
      if (dataset.typed && dataset.value.length === 0)
        _addIssue(this, "length", dataset, config2, { received: "0" });
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function rawCheck(action) {
  return {
    kind: "validation",
    type: "raw_check",
    reference: rawCheck,
    async: false,
    expects: null,
    "~run"(dataset, config2) {
      action({
        dataset,
        config: config2,
        addIssue: (info) => _addIssue(this, info?.label ?? "input", dataset, config2, info),
      });
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function rawTransform(action) {
  return {
    kind: "transformation",
    type: "raw_transform",
    reference: rawTransform,
    async: false,
    "~run"(dataset, config2) {
      const output = action({
        dataset,
        config: config2,
        addIssue: (info) => _addIssue(this, info?.label ?? "input", dataset, config2, info),
        NEVER: null,
      });
      if (dataset.issues) dataset.typed = false;
      else dataset.value = output;
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function regex(requirement, message2) {
  return {
    kind: "validation",
    type: "regex",
    reference: regex,
    async: false,
    expects: `${requirement}`,
    requirement,
    message: message2,
    "~run"(dataset, config2) {
      if (dataset.typed && !this.requirement.test(dataset.value))
        _addIssue(this, "format", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function safeInteger(message2) {
  return {
    kind: "validation",
    type: "safe_integer",
    reference: safeInteger,
    async: false,
    expects: null,
    requirement: Number.isSafeInteger,
    message: message2,
    "~run"(dataset, config2) {
      if (dataset.typed && !this.requirement(dataset.value))
        _addIssue(this, "safe integer", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function toLowerCase() {
  return {
    kind: "transformation",
    type: "to_lower_case",
    reference: toLowerCase,
    async: false,
    "~run"(dataset) {
      dataset.value = dataset.value.toLowerCase();
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function transform(operation) {
  return {
    kind: "transformation",
    type: "transform",
    reference: transform,
    async: false,
    operation,
    "~run"(dataset) {
      dataset.value = this.operation(dataset.value);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function trim() {
  return {
    kind: "transformation",
    type: "trim",
    reference: trim,
    async: false,
    "~run"(dataset) {
      dataset.value = dataset.value.trim();
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function url(message2) {
  return {
    kind: "validation",
    type: "url",
    reference: url,
    async: false,
    expects: null,
    requirement(input) {
      try {
        new URL(input);
        return true;
      } catch {
        return false;
      }
    },
    message: message2,
    "~run"(dataset, config2) {
      if (dataset.typed && !this.requirement(dataset.value))
        _addIssue(this, "URL", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function uuid(message2) {
  return {
    kind: "validation",
    type: "uuid",
    reference: uuid,
    async: false,
    expects: null,
    requirement: UUID_REGEX,
    message: message2,
    "~run"(dataset, config2) {
      if (dataset.typed && !this.requirement.test(dataset.value))
        _addIssue(this, "UUID", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function getFallback(schema, dataset, config2) {
  return typeof schema.fallback === "function"
    ? schema.fallback(dataset, config2)
    : schema.fallback;
}
// @__NO_SIDE_EFFECTS__
function flatten(issues) {
  const flatErrors = {};
  for (const issue of issues)
    if (issue.path) {
      const dotPath = /* @__PURE__ */ getDotPath(issue);
      if (dotPath) {
        if (!flatErrors.nested) flatErrors.nested = {};
        if (flatErrors.nested[dotPath]) flatErrors.nested[dotPath].push(issue.message);
        else flatErrors.nested[dotPath] = [issue.message];
      } else if (flatErrors.other) flatErrors.other.push(issue.message);
      else flatErrors.other = [issue.message];
    } else if (flatErrors.root) flatErrors.root.push(issue.message);
    else flatErrors.root = [issue.message];
  return flatErrors;
}
// @__NO_SIDE_EFFECTS__
function forward(action, path) {
  return {
    ...action,
    "~run"(dataset, config2) {
      const prevIssues = dataset.issues && [...dataset.issues];
      dataset = action["~run"](dataset, config2);
      if (dataset.issues) {
        for (const issue of dataset.issues)
          if (!prevIssues?.includes(issue)) {
            let pathInput = dataset.value;
            for (const key of path) {
              const pathValue = pathInput[key];
              const pathItem = {
                type: "unknown",
                origin: "value",
                input: pathInput,
                key,
                value: pathValue,
              };
              if (issue.path) issue.path.push(pathItem);
              else issue.path = [pathItem];
              if (!pathValue) break;
              pathInput = pathValue;
            }
          }
      }
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function getDefault(schema, dataset, config2) {
  return typeof schema.default === "function" ? schema.default(dataset, config2) : schema.default;
}
// @__NO_SIDE_EFFECTS__
function is(schema, input) {
  return !schema["~run"]({ value: input }, { abortEarly: true }).issues;
}
// @__NO_SIDE_EFFECTS__
function array(item, message2) {
  return {
    kind: "schema",
    type: "array",
    reference: array,
    expects: "Array",
    async: false,
    item,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      const input = dataset.value;
      if (Array.isArray(input)) {
        dataset.typed = true;
        dataset.value = [];
        for (let key = 0; key < input.length; key++) {
          const value2 = input[key];
          const itemDataset = this.item["~run"]({ value: value2 }, config2);
          if (itemDataset.issues) {
            const pathItem = {
              type: "array",
              origin: "value",
              input,
              key,
              value: value2,
            };
            for (const issue of itemDataset.issues) {
              if (issue.path) issue.path.unshift(pathItem);
              else issue.path = [pathItem];
              dataset.issues?.push(issue);
            }
            if (!dataset.issues) dataset.issues = itemDataset.issues;
            if (config2.abortEarly) {
              dataset.typed = false;
              break;
            }
          }
          if (!itemDataset.typed) dataset.typed = false;
          dataset.value.push(itemDataset.value);
        }
      } else _addIssue(this, "type", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function boolean(message2) {
  return {
    kind: "schema",
    type: "boolean",
    reference: boolean,
    expects: "boolean",
    async: false,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      if (typeof dataset.value === "boolean") dataset.typed = true;
      else _addIssue(this, "type", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function date(message2) {
  return {
    kind: "schema",
    type: "date",
    reference: date,
    expects: "Date",
    async: false,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      if (dataset.value instanceof Date) {
        if (!isNaN(dataset.value)) dataset.typed = true;
        else _addIssue(this, "type", dataset, config2, { received: '"Invalid Date"' });
      } else _addIssue(this, "type", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function lazy(getter) {
  return {
    kind: "schema",
    type: "lazy",
    reference: lazy,
    expects: "unknown",
    async: false,
    getter,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      return this.getter(dataset.value)["~run"](dataset, config2);
    },
  };
}
// @__NO_SIDE_EFFECTS__
function literal(literal_, message2) {
  return {
    kind: "schema",
    type: "literal",
    reference: literal,
    expects: /* @__PURE__ */ _stringify(literal_),
    async: false,
    literal: literal_,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      if (dataset.value === this.literal) dataset.typed = true;
      else _addIssue(this, "type", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function looseObject(entries2, message2) {
  return {
    kind: "schema",
    type: "loose_object",
    reference: looseObject,
    expects: "Object",
    async: false,
    entries: entries2,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const valueSchema = this.entries[key];
          if (
            key in input ||
            ((valueSchema.type === "exact_optional" ||
              valueSchema.type === "optional" ||
              valueSchema.type === "nullish") &&
              valueSchema.default !== void 0)
          ) {
            const value2 = key in input ? input[key] : /* @__PURE__ */ getDefault(valueSchema);
            const valueDataset = valueSchema["~run"]({ value: value2 }, config2);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key,
                value: value2,
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) issue.path.unshift(pathItem);
                else issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) dataset.issues = valueDataset.issues;
              if (config2.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!valueDataset.typed) dataset.typed = false;
            dataset.value[key] = valueDataset.value;
          } else if (valueSchema.fallback !== void 0)
            dataset.value[key] = /* @__PURE__ */ getFallback(valueSchema);
          else if (
            valueSchema.type !== "exact_optional" &&
            valueSchema.type !== "optional" &&
            valueSchema.type !== "nullish"
          ) {
            _addIssue(this, "key", dataset, config2, {
              input: void 0,
              expected: `"${key}"`,
              path: [
                {
                  type: "object",
                  origin: "key",
                  input,
                  key,
                  value: input[key],
                },
              ],
            });
            if (config2.abortEarly) break;
          }
        }
        if (!dataset.issues || !config2.abortEarly) {
          for (const key in input)
            if (/* @__PURE__ */ _isValidObjectKey(input, key) && !(key in this.entries))
              dataset.value[key] = input[key];
        }
      } else _addIssue(this, "type", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function null_(message2) {
  return {
    kind: "schema",
    type: "null",
    reference: null_,
    expects: "null",
    async: false,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      if (dataset.value === null) dataset.typed = true;
      else _addIssue(this, "type", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function nullable(wrapped, default_) {
  return {
    kind: "schema",
    type: "nullable",
    reference: nullable,
    expects: `(${wrapped.expects} | null)`,
    async: false,
    wrapped,
    default: default_,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      if (dataset.value === null) {
        if (this.default !== void 0)
          dataset.value = /* @__PURE__ */ getDefault(this, dataset, config2);
        if (dataset.value === null) {
          dataset.typed = true;
          return dataset;
        }
      }
      return this.wrapped["~run"](dataset, config2);
    },
  };
}
// @__NO_SIDE_EFFECTS__
function number(message2) {
  return {
    kind: "schema",
    type: "number",
    reference: number,
    expects: "number",
    async: false,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      if (typeof dataset.value === "number" && !isNaN(dataset.value)) dataset.typed = true;
      else _addIssue(this, "type", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function object(entries2, message2) {
  return {
    kind: "schema",
    type: "object",
    reference: object,
    expects: "Object",
    async: false,
    entries: entries2,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const valueSchema = this.entries[key];
          if (
            key in input ||
            ((valueSchema.type === "exact_optional" ||
              valueSchema.type === "optional" ||
              valueSchema.type === "nullish") &&
              valueSchema.default !== void 0)
          ) {
            const value2 = key in input ? input[key] : /* @__PURE__ */ getDefault(valueSchema);
            const valueDataset = valueSchema["~run"]({ value: value2 }, config2);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key,
                value: value2,
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) issue.path.unshift(pathItem);
                else issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) dataset.issues = valueDataset.issues;
              if (config2.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!valueDataset.typed) dataset.typed = false;
            dataset.value[key] = valueDataset.value;
          } else if (valueSchema.fallback !== void 0)
            dataset.value[key] = /* @__PURE__ */ getFallback(valueSchema);
          else if (
            valueSchema.type !== "exact_optional" &&
            valueSchema.type !== "optional" &&
            valueSchema.type !== "nullish"
          ) {
            _addIssue(this, "key", dataset, config2, {
              input: void 0,
              expected: `"${key}"`,
              path: [
                {
                  type: "object",
                  origin: "key",
                  input,
                  key,
                  value: input[key],
                },
              ],
            });
            if (config2.abortEarly) break;
          }
        }
      } else _addIssue(this, "type", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function optional(wrapped, default_) {
  return {
    kind: "schema",
    type: "optional",
    reference: optional,
    expects: `(${wrapped.expects} | undefined)`,
    async: false,
    wrapped,
    default: default_,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      if (dataset.value === void 0) {
        if (this.default !== void 0)
          dataset.value = /* @__PURE__ */ getDefault(this, dataset, config2);
        if (dataset.value === void 0) {
          dataset.typed = true;
          return dataset;
        }
      }
      return this.wrapped["~run"](dataset, config2);
    },
  };
}
// @__NO_SIDE_EFFECTS__
function picklist(options, message2) {
  return {
    kind: "schema",
    type: "picklist",
    reference: picklist,
    expects: /* @__PURE__ */ _joinExpects(options.map(_stringify), "|"),
    async: false,
    options,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      if (this.options.includes(dataset.value)) dataset.typed = true;
      else _addIssue(this, "type", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function record(key, value2, message2) {
  return {
    kind: "schema",
    type: "record",
    reference: record,
    expects: "Object",
    async: false,
    key,
    value: value2,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const entryKey in input)
          if (/* @__PURE__ */ _isValidObjectKey(input, entryKey)) {
            const entryValue = input[entryKey];
            const keyDataset = this.key["~run"]({ value: entryKey }, config2);
            if (keyDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "key",
                input,
                key: entryKey,
                value: entryValue,
              };
              for (const issue of keyDataset.issues) {
                issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) dataset.issues = keyDataset.issues;
              if (config2.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            const valueDataset = this.value["~run"]({ value: entryValue }, config2);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key: entryKey,
                value: entryValue,
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) issue.path.unshift(pathItem);
                else issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) dataset.issues = valueDataset.issues;
              if (config2.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!keyDataset.typed || !valueDataset.typed) dataset.typed = false;
            if (keyDataset.typed) dataset.value[keyDataset.value] = valueDataset.value;
          }
      } else _addIssue(this, "type", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function strictObject(entries2, message2) {
  return {
    kind: "schema",
    type: "strict_object",
    reference: strictObject,
    expects: "Object",
    async: false,
    entries: entries2,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const valueSchema = this.entries[key];
          if (
            key in input ||
            ((valueSchema.type === "exact_optional" ||
              valueSchema.type === "optional" ||
              valueSchema.type === "nullish") &&
              valueSchema.default !== void 0)
          ) {
            const value2 = key in input ? input[key] : /* @__PURE__ */ getDefault(valueSchema);
            const valueDataset = valueSchema["~run"]({ value: value2 }, config2);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key,
                value: value2,
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) issue.path.unshift(pathItem);
                else issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) dataset.issues = valueDataset.issues;
              if (config2.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!valueDataset.typed) dataset.typed = false;
            dataset.value[key] = valueDataset.value;
          } else if (valueSchema.fallback !== void 0)
            dataset.value[key] = /* @__PURE__ */ getFallback(valueSchema);
          else if (
            valueSchema.type !== "exact_optional" &&
            valueSchema.type !== "optional" &&
            valueSchema.type !== "nullish"
          ) {
            _addIssue(this, "key", dataset, config2, {
              input: void 0,
              expected: `"${key}"`,
              path: [
                {
                  type: "object",
                  origin: "key",
                  input,
                  key,
                  value: input[key],
                },
              ],
            });
            if (config2.abortEarly) break;
          }
        }
        if (!dataset.issues || !config2.abortEarly) {
          for (const key in input)
            if (!(key in this.entries)) {
              _addIssue(this, "key", dataset, config2, {
                input: key,
                expected: "never",
                path: [
                  {
                    type: "object",
                    origin: "key",
                    input,
                    key,
                    value: input[key],
                  },
                ],
              });
              break;
            }
        }
      } else _addIssue(this, "type", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function string(message2) {
  return {
    kind: "schema",
    type: "string",
    reference: string,
    expects: "string",
    async: false,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      if (typeof dataset.value === "string") dataset.typed = true;
      else _addIssue(this, "type", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function _subIssues(datasets) {
  let issues;
  if (datasets)
    for (const dataset of datasets)
      if (issues) issues.push(...dataset.issues);
      else issues = dataset.issues;
  return issues;
}
// @__NO_SIDE_EFFECTS__
function union(options, message2) {
  return {
    kind: "schema",
    type: "union",
    reference: union,
    expects: /* @__PURE__ */ _joinExpects(
      options.map((option) => option.expects),
      "|",
    ),
    async: false,
    options,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      let validDataset;
      let typedDatasets;
      let untypedDatasets;
      for (const schema of this.options) {
        const optionDataset = schema["~run"]({ value: dataset.value }, config2);
        if (optionDataset.typed) {
          if (optionDataset.issues) {
            if (typedDatasets) typedDatasets.push(optionDataset);
            else typedDatasets = [optionDataset];
          } else {
            validDataset = optionDataset;
            break;
          }
        } else if (untypedDatasets) untypedDatasets.push(optionDataset);
        else untypedDatasets = [optionDataset];
      }
      if (validDataset) return validDataset;
      if (typedDatasets) {
        if (typedDatasets.length === 1) return typedDatasets[0];
        _addIssue(this, "type", dataset, config2, {
          issues: /* @__PURE__ */ _subIssues(typedDatasets),
        });
        dataset.typed = true;
      } else if (untypedDatasets?.length === 1) return untypedDatasets[0];
      else
        _addIssue(this, "type", dataset, config2, {
          issues: /* @__PURE__ */ _subIssues(untypedDatasets),
        });
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function unknown() {
  return {
    kind: "schema",
    type: "unknown",
    reference: unknown,
    expects: "unknown",
    async: false,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset) {
      dataset.typed = true;
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function variant(key, options, message2) {
  return {
    kind: "schema",
    type: "variant",
    reference: variant,
    expects: "Object",
    async: false,
    key,
    options,
    message: message2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        let outputDataset;
        let maxDiscriminatorPriority = 0;
        let invalidDiscriminatorKey = this.key;
        let expectedDiscriminators = [];
        const parseOptions = (variant2, allKeys) => {
          for (const schema of variant2.options) {
            if (schema.type === "variant") parseOptions(schema, new Set(allKeys).add(schema.key));
            else {
              let keysAreValid = true;
              let currentPriority = 0;
              for (const currentKey of allKeys) {
                const discriminatorSchema = schema.entries[currentKey];
                if (
                  currentKey in input
                    ? discriminatorSchema["~run"](
                        {
                          typed: false,
                          value: input[currentKey],
                        },
                        { abortEarly: true },
                      ).issues
                    : discriminatorSchema.type !== "exact_optional" &&
                      discriminatorSchema.type !== "optional" &&
                      discriminatorSchema.type !== "nullish"
                ) {
                  keysAreValid = false;
                  if (
                    invalidDiscriminatorKey !== currentKey &&
                    (maxDiscriminatorPriority < currentPriority ||
                      (maxDiscriminatorPriority === currentPriority &&
                        currentKey in input &&
                        !(invalidDiscriminatorKey in input)))
                  ) {
                    maxDiscriminatorPriority = currentPriority;
                    invalidDiscriminatorKey = currentKey;
                    expectedDiscriminators = [];
                  }
                  if (invalidDiscriminatorKey === currentKey)
                    expectedDiscriminators.push(schema.entries[currentKey].expects);
                  break;
                }
                currentPriority++;
              }
              if (keysAreValid) {
                const optionDataset = schema["~run"]({ value: input }, config2);
                if (!outputDataset || (!outputDataset.typed && optionDataset.typed))
                  outputDataset = optionDataset;
              }
            }
            if (outputDataset && !outputDataset.issues) break;
          }
        };
        parseOptions(this, /* @__PURE__ */ new Set([this.key]));
        if (outputDataset) return outputDataset;
        _addIssue(this, "type", dataset, config2, {
          input: input[invalidDiscriminatorKey],
          expected: /* @__PURE__ */ _joinExpects(expectedDiscriminators, "|"),
          path: [
            {
              type: "object",
              origin: "value",
              input,
              key: invalidDiscriminatorKey,
              value: input[invalidDiscriminatorKey],
            },
          ],
        });
      } else _addIssue(this, "type", dataset, config2);
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function omit(schema, keys) {
  const entries2 = { ...schema.entries };
  for (const key of keys) delete entries2[key];
  return {
    ...schema,
    entries: entries2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
  };
}
function parse(schema, input, config2) {
  const dataset = schema["~run"]({ value: input }, /* @__PURE__ */ getGlobalConfig(config2));
  if (dataset.issues) throw new ValiError(dataset.issues);
  return dataset.value;
}
// @__NO_SIDE_EFFECTS__
function partial(schema, keys) {
  const entries2 = {};
  for (const key in schema.entries)
    entries2[key] =
      !keys || keys.includes(key)
        ? /* @__PURE__ */ optional(schema.entries[key])
        : schema.entries[key];
  return {
    ...schema,
    entries: entries2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
  };
}
// @__NO_SIDE_EFFECTS__
function pipe(...pipe2) {
  return {
    ...pipe2[0],
    pipe: pipe2,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      for (const item of pipe2)
        if (item.kind !== "metadata") {
          if (dataset.issues && (item.kind === "schema" || item.kind === "transformation")) {
            dataset.typed = false;
            break;
          }
          if (!dataset.issues || (!config2.abortEarly && !config2.abortPipeEarly))
            dataset = item["~run"](dataset, config2);
        }
      return dataset;
    },
  };
}
// @__NO_SIDE_EFFECTS__
function safeParse(schema, input, config2) {
  const dataset = schema["~run"]({ value: input }, /* @__PURE__ */ getGlobalConfig(config2));
  return {
    typed: dataset.typed,
    success: !dataset.issues,
    output: dataset.value,
    issues: dataset.issues,
  };
}
//#endregion
//#region ../../packages/ports/src/schemas/primitives.ts
var jsonSchema = /* @__PURE__ */ lazy(() =>
  /* @__PURE__ */ union([
    /* @__PURE__ */ null_(),
    /* @__PURE__ */ boolean(),
    /* @__PURE__ */ pipe(/* @__PURE__ */ number(), /* @__PURE__ */ finite()),
    /* @__PURE__ */ string(),
    /* @__PURE__ */ array(jsonSchema),
    /* @__PURE__ */ record(/* @__PURE__ */ string(), jsonSchema),
  ]),
);
var uuidV7Schema = /* @__PURE__ */ pipe(
  /* @__PURE__ */ string(),
  /* @__PURE__ */ uuid(),
  /* @__PURE__ */ regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
);
var sequenceSchema = /* @__PURE__ */ pipe(
  /* @__PURE__ */ string(),
  /* @__PURE__ */ regex(/^\d{1,19}$/),
);
var workflowInstanceIdSchema = /* @__PURE__ */ pipe(
  /* @__PURE__ */ string(),
  /* @__PURE__ */ maxLength(100),
  /* @__PURE__ */ regex(/^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/),
);
//#endregion
//#region ../../packages/ports/src/schemas/messages.ts
var envelopeSchema = /* @__PURE__ */ object({
  id: uuidV7Schema,
  orgId: uuidV7Schema,
  v: /* @__PURE__ */ pipe(
    /* @__PURE__ */ number(),
    /* @__PURE__ */ integer(),
    /* @__PURE__ */ minValue(1),
  ),
  sequence: sequenceSchema,
  type: /* @__PURE__ */ pipe(/* @__PURE__ */ string(), /* @__PURE__ */ minLength(1)),
  payload: jsonSchema,
});
//#endregion
//#region ../../packages/ports/src/messages.ts
function messageBody(message) {
  parse(envelopeSchema, message);
  const body = JSON.stringify(message);
  if (new TextEncoder().encode(body).byteLength > 98304)
    throw new RangeError("Message exceeds 96 KB; put the payload in Blobs and send a reference");
  return body;
}
//#endregion
//#region ../../packages/ports/src/storage.ts
function scopedKey(orgId, key) {
  parse(uuidV7Schema, orgId);
  if (
    !key ||
    !/^[a-zA-Z0-9_./-]+$/.test(key) ||
    key.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error("Invalid storage key");
  return `${orgId}/${key}`;
}
function requestCache(operations) {
  return {
    request() {
      let written = false;
      return {
        async get(orgId, key) {
          if (written) throw new Error("Cache read-after-write is forbidden in a request");
          scopedKey(orgId, key);
          return operations.get(orgId, key);
        },
        async put(orgId, key, value, ttlMs) {
          scopedKey(orgId, key);
          if (
            !Number.isSafeInteger(ttlMs) ||
            ttlMs <= 0 ||
            !Number.isSafeInteger(Date.now() + ttlMs)
          )
            throw new RangeError("Invalid cache TTL");
          parse(jsonSchema, value);
          written = true;
          await operations.put(orgId, key, value, ttlMs);
        },
        async delete(orgId, key) {
          scopedKey(orgId, key);
          written = true;
          await operations.delete(orgId, key);
        },
      };
    },
  };
}
async function blobUrlAccess(options) {
  if (options.secret.byteLength < 32)
    throw new Error("Blob signing secret must contain at least 32 bytes");
  const key = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(options.secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"],
  );
  const now = options.now ?? Date.now;
  const data = (orgId, name, expires) =>
    new TextEncoder().encode(JSON.stringify([orgId, name, expires]));
  return {
    async sign(orgId, name, seconds) {
      scopedKey(orgId, name);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600)
        throw new RangeError("Signed URL lifetime must be 1–3600 seconds");
      const expires = Math.floor(now() / 1e3) + seconds;
      const signature = new Uint8Array(
        await crypto.subtle.sign("HMAC", key, data(orgId, name, expires)),
      );
      const url = new URL(options.baseUrl);
      url.searchParams.set("org", orgId);
      url.searchParams.set("key", name);
      url.searchParams.set("expires", String(expires));
      url.searchParams.set(
        "signature",
        Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join(""),
      );
      return url.toString();
    },
    async read(urlString, blobs) {
      const url = new URL(urlString);
      const orgId = url.searchParams.get("org") ?? "";
      const name = url.searchParams.get("key") ?? "";
      const expires = Number(url.searchParams.get("expires"));
      const signature = url.searchParams.get("signature") ?? "";
      if (
        !Number.isSafeInteger(expires) ||
        expires <= Math.floor(now() / 1e3) ||
        !/^[a-f0-9]{64}$/.test(signature)
      )
        throw new Error("Invalid or expired blob URL");
      const bytes = Uint8Array.from(signature.match(/../g), (byte) => parseInt(byte, 16));
      if (!(await crypto.subtle.verify("HMAC", key, bytes, data(orgId, name, expires))))
        throw new Error("Invalid blob URL signature");
      scopedKey(orgId, name);
      return blobs.get(orgId, name);
    },
  };
}
//#endregion
//#region ../../packages/ports/src/schemas/storage.ts
var objectStorageOptionsSchema = /* @__PURE__ */ object({
  endpoint: /* @__PURE__ */ pipe(/* @__PURE__ */ string(), /* @__PURE__ */ url()),
  bucket: /* @__PURE__ */ pipe(/* @__PURE__ */ string(), /* @__PURE__ */ minLength(1)),
  accessKeyId: /* @__PURE__ */ pipe(/* @__PURE__ */ string(), /* @__PURE__ */ minLength(1)),
  secretAccessKey: /* @__PURE__ */ pipe(/* @__PURE__ */ string(), /* @__PURE__ */ minLength(1)),
  region: /* @__PURE__ */ pipe(/* @__PURE__ */ string(), /* @__PURE__ */ minLength(1)),
});
//#endregion
//#region ../../node_modules/.pnpm/aws4fetch@1.0.20/node_modules/aws4fetch/dist/aws4fetch.esm.mjs
/**
 * @license MIT <https://opensource.org/licenses/MIT>
 * @copyright Michael Hart 2024
 */
var encoder = new TextEncoder();
var HOST_SERVICES = {
  appstream2: "appstream",
  cloudhsmv2: "cloudhsm",
  email: "ses",
  marketplace: "aws-marketplace",
  mobile: "AWSMobileHubService",
  pinpoint: "mobiletargeting",
  queue: "sqs",
  "git-codecommit": "codecommit",
  "mturk-requester-sandbox": "mturk-requester",
  "personalize-runtime": "personalize",
};
var UNSIGNABLE_HEADERS = /* @__PURE__ */ new Set([
  "authorization",
  "content-type",
  "content-length",
  "user-agent",
  "presigned-expires",
  "expect",
  "x-amzn-trace-id",
  "range",
  "connection",
]);
var AwsClient = class {
  constructor({
    accessKeyId,
    secretAccessKey,
    sessionToken,
    service,
    region,
    cache,
    retries,
    initRetryMs,
  }) {
    if (accessKeyId == null) throw new TypeError("accessKeyId is a required option");
    if (secretAccessKey == null) throw new TypeError("secretAccessKey is a required option");
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;
    this.service = service;
    this.region = region;
    this.cache = cache || /* @__PURE__ */ new Map();
    this.retries = retries != null ? retries : 10;
    this.initRetryMs = initRetryMs || 50;
  }
  async sign(input, init) {
    if (input instanceof Request) {
      const { method, url, headers, body } = input;
      init = Object.assign(
        {
          method,
          url,
          headers,
        },
        init,
      );
      if (init.body == null && headers.has("Content-Type"))
        init.body =
          body != null && headers.has("X-Amz-Content-Sha256")
            ? body
            : await input.clone().arrayBuffer();
      input = url;
    }
    const signer = new AwsV4Signer(
      Object.assign({ url: input.toString() }, init, this, init && init.aws),
    );
    const signed = Object.assign({}, init, await signer.sign());
    delete signed.aws;
    try {
      return new Request(signed.url.toString(), signed);
    } catch (e) {
      if (e instanceof TypeError)
        return new Request(signed.url.toString(), Object.assign({ duplex: "half" }, signed));
      throw e;
    }
  }
  async fetch(input, init) {
    for (let i = 0; i <= this.retries; i++) {
      const fetched = fetch(await this.sign(input, init));
      if (i === this.retries) return fetched;
      const res = await fetched;
      if (res.status < 500 && res.status !== 429) return res;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * this.initRetryMs * Math.pow(2, i)),
      );
    }
    throw new Error("An unknown error occurred, ensure retries is not negative");
  }
};
var AwsV4Signer = class {
  constructor({
    method,
    url,
    headers,
    body,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    service,
    region,
    cache,
    datetime,
    signQuery,
    appendSessionToken,
    allHeaders,
    singleEncode,
  }) {
    if (url == null) throw new TypeError("url is a required option");
    if (accessKeyId == null) throw new TypeError("accessKeyId is a required option");
    if (secretAccessKey == null) throw new TypeError("secretAccessKey is a required option");
    this.method = method || (body ? "POST" : "GET");
    this.url = new URL(url);
    this.headers = new Headers(headers || {});
    this.body = body;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;
    let guessedService, guessedRegion;
    if (!service || !region)
      [guessedService, guessedRegion] = guessServiceRegion(this.url, this.headers);
    this.service = service || guessedService || "";
    this.region = region || guessedRegion || "us-east-1";
    this.cache = cache || /* @__PURE__ */ new Map();
    this.datetime =
      datetime || /* @__PURE__ */ new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    this.signQuery = signQuery;
    this.appendSessionToken = appendSessionToken || this.service === "iotdevicegateway";
    this.headers.delete("Host");
    if (this.service === "s3" && !this.signQuery && !this.headers.has("X-Amz-Content-Sha256"))
      this.headers.set("X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD");
    const params = this.signQuery ? this.url.searchParams : this.headers;
    params.set("X-Amz-Date", this.datetime);
    if (this.sessionToken && !this.appendSessionToken)
      params.set("X-Amz-Security-Token", this.sessionToken);
    this.signableHeaders = ["host", ...this.headers.keys()]
      .filter((header) => allHeaders || !UNSIGNABLE_HEADERS.has(header))
      .sort();
    this.signedHeaders = this.signableHeaders.join(";");
    this.canonicalHeaders = this.signableHeaders
      .map(
        (header) =>
          header +
          ":" +
          (header === "host"
            ? this.url.host
            : (this.headers.get(header) || "").replace(/\s+/g, " ")),
      )
      .join("\n");
    this.credentialString = [
      this.datetime.slice(0, 8),
      this.region,
      this.service,
      "aws4_request",
    ].join("/");
    if (this.signQuery) {
      if (this.service === "s3" && !params.has("X-Amz-Expires"))
        params.set("X-Amz-Expires", "86400");
      params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
      params.set("X-Amz-Credential", this.accessKeyId + "/" + this.credentialString);
      params.set("X-Amz-SignedHeaders", this.signedHeaders);
    }
    if (this.service === "s3")
      try {
        this.encodedPath = decodeURIComponent(this.url.pathname.replace(/\+/g, " "));
      } catch (e) {
        this.encodedPath = this.url.pathname;
      }
    else this.encodedPath = this.url.pathname.replace(/\/+/g, "/");
    if (!singleEncode) this.encodedPath = encodeURIComponent(this.encodedPath).replace(/%2F/g, "/");
    this.encodedPath = encodeRfc3986(this.encodedPath);
    const seenKeys = /* @__PURE__ */ new Set();
    this.encodedSearch = [...this.url.searchParams]
      .filter(([k]) => {
        if (!k) return false;
        if (this.service === "s3") {
          if (seenKeys.has(k)) return false;
          seenKeys.add(k);
        }
        return true;
      })
      .map((pair) => pair.map((p) => encodeRfc3986(encodeURIComponent(p))))
      .sort(([k1, v1], [k2, v2]) => (k1 < k2 ? -1 : k1 > k2 ? 1 : v1 < v2 ? -1 : v1 > v2 ? 1 : 0))
      .map((pair) => pair.join("="))
      .join("&");
  }
  async sign() {
    if (this.signQuery) {
      this.url.searchParams.set("X-Amz-Signature", await this.signature());
      if (this.sessionToken && this.appendSessionToken)
        this.url.searchParams.set("X-Amz-Security-Token", this.sessionToken);
    } else this.headers.set("Authorization", await this.authHeader());
    return {
      method: this.method,
      url: this.url,
      headers: this.headers,
      body: this.body,
    };
  }
  async authHeader() {
    return [
      "AWS4-HMAC-SHA256 Credential=" + this.accessKeyId + "/" + this.credentialString,
      "SignedHeaders=" + this.signedHeaders,
      "Signature=" + (await this.signature()),
    ].join(", ");
  }
  async signature() {
    const date = this.datetime.slice(0, 8);
    const cacheKey = [this.secretAccessKey, date, this.region, this.service].join();
    let kCredentials = this.cache.get(cacheKey);
    if (!kCredentials) {
      kCredentials = await hmac(
        await hmac(
          await hmac(await hmac("AWS4" + this.secretAccessKey, date), this.region),
          this.service,
        ),
        "aws4_request",
      );
      this.cache.set(cacheKey, kCredentials);
    }
    return buf2hex(await hmac(kCredentials, await this.stringToSign()));
  }
  async stringToSign() {
    return [
      "AWS4-HMAC-SHA256",
      this.datetime,
      this.credentialString,
      buf2hex(await hash(await this.canonicalString())),
    ].join("\n");
  }
  async canonicalString() {
    return [
      this.method.toUpperCase(),
      this.encodedPath,
      this.encodedSearch,
      this.canonicalHeaders + "\n",
      this.signedHeaders,
      await this.hexBodyHash(),
    ].join("\n");
  }
  async hexBodyHash() {
    let hashHeader =
      this.headers.get("X-Amz-Content-Sha256") ||
      (this.service === "s3" && this.signQuery ? "UNSIGNED-PAYLOAD" : null);
    if (hashHeader == null) {
      if (this.body && typeof this.body !== "string" && !("byteLength" in this.body))
        throw new Error(
          "body must be a string, ArrayBuffer or ArrayBufferView, unless you include the X-Amz-Content-Sha256 header",
        );
      hashHeader = buf2hex(await hash(this.body || ""));
    }
    return hashHeader;
  }
};
async function hmac(key, string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? encoder.encode(key) : key,
    {
      name: "HMAC",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(string));
}
async function hash(content) {
  return crypto.subtle.digest(
    "SHA-256",
    typeof content === "string" ? encoder.encode(content) : content,
  );
}
var HEX_CHARS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
function buf2hex(arrayBuffer) {
  const buffer = new Uint8Array(arrayBuffer);
  let out = "";
  for (let idx = 0; idx < buffer.length; idx++) {
    const n = buffer[idx];
    out += HEX_CHARS[(n >>> 4) & 15];
    out += HEX_CHARS[n & 15];
  }
  return out;
}
function encodeRfc3986(urlEncodedStr) {
  return urlEncodedStr.replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}
function guessServiceRegion(url, headers) {
  const { hostname, pathname } = url;
  if (hostname.endsWith(".on.aws")) {
    const match = hostname.match(/^[^.]{1,63}\.lambda-url\.([^.]{1,63})\.on\.aws$/);
    return match != null ? ["lambda", match[1] || ""] : ["", ""];
  }
  if (hostname.endsWith(".r2.cloudflarestorage.com")) return ["s3", "auto"];
  if (hostname.endsWith(".backblazeb2.com")) {
    const match = hostname.match(/^(?:[^.]{1,63}\.)?s3\.([^.]{1,63})\.backblazeb2\.com$/);
    return match != null ? ["s3", match[1] || ""] : ["", ""];
  }
  const match = hostname
    .replace("dualstack.", "")
    .match(/([^.]{1,63})\.(?:([^.]{0,63})\.)?amazonaws\.com(?:\.cn)?$/);
  let service = (match && match[1]) || "";
  let region = match && match[2];
  if (region === "us-gov") region = "us-gov-west-1";
  else if (region === "s3" || region === "s3-accelerate") {
    region = "us-east-1";
    service = "s3";
  } else if (service === "iot") {
    if (hostname.startsWith("iot.")) service = "execute-api";
    else if (hostname.startsWith("data.jobs.iot.")) service = "iot-jobs-data";
    else service = pathname === "/mqtt" ? "iotdevicegateway" : "iotdata";
  } else if (service === "autoscaling") {
    const targetPrefix = (headers.get("X-Amz-Target") || "").split(".")[0];
    if (targetPrefix === "AnyScaleFrontendService") service = "application-autoscaling";
    else if (targetPrefix === "AnyScaleScalingPlannerFrontendService")
      service = "autoscaling-plans";
  } else if (region == null && service.startsWith("s3-")) {
    region = service.slice(3).replace(/^fips-|^external-1/, "");
    service = "s3";
  } else if (service.endsWith("-fips")) service = service.slice(0, -5);
  else if (region && /-\d$/.test(service) && !/-\d$/.test(region))
    [service, region] = [region, service];
  return [HOST_SERVICES[service] || service, region || ""];
}
//#endregion
//#region ../../packages/ports/src/storage/object.ts
function objectStorage(options) {
  parse(objectStorageOptionsSchema, options);
  const aws = new AwsClient({
    ...options,
    service: "s3",
    retries: 0,
  });
  const now = options.now ?? Date.now;
  const url = (orgId, key) => {
    const result = new URL(options.endpoint);
    result.pathname = `${result.pathname.replace(/\/$/, "")}/${options.bucket}/${scopedKey(orgId, key)}`;
    return result;
  };
  return {
    async createUpload(orgId, key, input) {
      if (
        !Number.isInteger(input.expiresInSeconds) ||
        input.expiresInSeconds < 1 ||
        input.expiresInSeconds > 3600
      )
        throw new RangeError("Upload lifetime must be 1–3600 seconds");
      const target = url(orgId, key);
      target.searchParams.set("X-Amz-Expires", String(input.expiresInSeconds));
      const instant = now();
      const headers = { "Content-Type": input.contentType };
      return {
        url: (
          await aws.sign(target, {
            method: "PUT",
            headers,
            aws: {
              signQuery: true,
              allHeaders: true,
              datetime: new Date(instant).toISOString().replace(/[:-]|\.\d{3}/g, ""),
            },
          })
        ).url,
        method: "PUT",
        headers,
        expiresAt: instant + input.expiresInSeconds * 1e3,
      };
    },
    async put(orgId, key, value) {
      await checked(
        await aws.fetch(url(orgId, key), {
          method: "PUT",
          body: new Uint8Array(value),
        }),
      );
    },
    async get(orgId, key, maxBytes) {
      const response = await aws.fetch(url(orgId, key));
      if (response.status === 404) return null;
      await checked(response);
      return readBlobBody(
        response.body,
        Number(response.headers.get("Content-Length")) || void 0,
        maxBytes,
      );
    },
    async delete(orgId, key) {
      await checked(await aws.fetch(url(orgId, key), { method: "DELETE" }));
    },
  };
}
async function readBlobBody(body, size, maxBytes) {
  if (maxBytes !== void 0 && (!Number.isSafeInteger(maxBytes) || maxBytes < 0))
    throw new RangeError("Invalid blob size limit");
  if (maxBytes !== void 0 && size !== void 0 && size > maxBytes) {
    await body?.cancel();
    throw new RangeError("Blob exceeds size limit");
  }
  if (!body) return /* @__PURE__ */ new Uint8Array();
  const reader = body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (maxBytes !== void 0 && length > maxBytes) {
        await reader.cancel();
        throw new RangeError("Blob exceeds size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
async function checked(response) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Object storage request failed (${response.status})`);
  }
}
//#endregion
//#region ../../node_modules/.pnpm/react@19.3.0/node_modules/react/cjs/react.production.js
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var require_react_production = /* @__PURE__ */ __commonJSMin((exports) => {
  var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
  var REACT_PORTAL_TYPE = Symbol.for("react.portal");
  var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
  var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
  var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
  var REACT_CONSUMER_TYPE = Symbol.for("react.consumer");
  var REACT_CONTEXT_TYPE = Symbol.for("react.context");
  var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
  var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
  var REACT_MEMO_TYPE = Symbol.for("react.memo");
  var REACT_LAZY_TYPE = Symbol.for("react.lazy");
  var REACT_ACTIVITY_TYPE = Symbol.for("react.activity");
  var REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition");
  var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
  function getIteratorFn(maybeIterable) {
    if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
    maybeIterable =
      (MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL]) ||
      maybeIterable["@@iterator"];
    return "function" === typeof maybeIterable ? maybeIterable : null;
  }
  var ReactNoopUpdateQueue = {
    isMounted: function () {
      return !1;
    },
    enqueueForceUpdate: function () {},
    enqueueReplaceState: function () {},
    enqueueSetState: function () {},
  };
  var assign = Object.assign;
  var emptyObject = {};
  function Component(props, context, updater) {
    this.props = props;
    this.context = context;
    this.refs = emptyObject;
    this.updater = updater || ReactNoopUpdateQueue;
  }
  Component.prototype.isReactComponent = {};
  Component.prototype.setState = function (partialState, callback) {
    if (
      "object" !== typeof partialState &&
      "function" !== typeof partialState &&
      null != partialState
    )
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables.",
      );
    this.updater.enqueueSetState(this, partialState, callback, "setState");
  };
  Component.prototype.forceUpdate = function (callback) {
    this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
  };
  function ComponentDummy() {}
  ComponentDummy.prototype = Component.prototype;
  function PureComponent(props, context, updater) {
    this.props = props;
    this.context = context;
    this.refs = emptyObject;
    this.updater = updater || ReactNoopUpdateQueue;
  }
  var pureComponentPrototype = (PureComponent.prototype = new ComponentDummy());
  pureComponentPrototype.constructor = PureComponent;
  assign(pureComponentPrototype, Component.prototype);
  pureComponentPrototype.isPureReactComponent = !0;
  var isArrayImpl = Array.isArray;
  function noop() {}
  var ReactSharedInternals = {
    H: null,
    A: null,
    T: null,
    S: null,
  };
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  function ReactElement(type, key, props) {
    var refProp = props.ref;
    return {
      $$typeof: REACT_ELEMENT_TYPE,
      type,
      key,
      ref: void 0 !== refProp ? refProp : null,
      props,
    };
  }
  function cloneAndReplaceKey(oldElement, newKey) {
    return ReactElement(oldElement.type, newKey, oldElement.props);
  }
  function isValidElement(object) {
    return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
  }
  function escape(key) {
    var escaperLookup = {
      "=": "=0",
      ":": "=2",
    };
    return (
      "$" +
      key.replace(/[=:]/g, function (match) {
        return escaperLookup[match];
      })
    );
  }
  var userProvidedKeyEscapeRegex = /\/+/g;
  function getElementKey(element, index) {
    return "object" === typeof element && null !== element && null != element.key
      ? escape("" + element.key)
      : index.toString(36);
  }
  function resolveThenable(thenable) {
    switch (thenable.status) {
      case "fulfilled":
        return thenable.value;
      case "rejected":
        throw thenable.reason;
      default:
        switch (
          ("string" === typeof thenable.status
            ? thenable.then(noop, noop)
            : ((thenable.status = "pending"),
              thenable.then(
                function (fulfilledValue) {
                  "pending" === thenable.status &&
                    ((thenable.status = "fulfilled"), (thenable.value = fulfilledValue));
                },
                function (error) {
                  "pending" === thenable.status &&
                    ((thenable.status = "rejected"), (thenable.reason = error));
                },
              )),
          thenable.status)
        ) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenable.reason;
        }
    }
    throw thenable;
  }
  function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
    var type = typeof children;
    if ("undefined" === type || "boolean" === type) children = null;
    var invokeCallback = !1;
    if (null === children) invokeCallback = !0;
    else
      switch (type) {
        case "bigint":
        case "string":
        case "number":
          invokeCallback = !0;
          break;
        case "object":
          switch (children.$$typeof) {
            case REACT_ELEMENT_TYPE:
            case REACT_PORTAL_TYPE:
              invokeCallback = !0;
              break;
            case REACT_LAZY_TYPE:
              return (
                (invokeCallback = children._init),
                mapIntoArray(
                  invokeCallback(children._payload),
                  array,
                  escapedPrefix,
                  nameSoFar,
                  callback,
                )
              );
          }
      }
    if (invokeCallback)
      return (
        (callback = callback(children)),
        (invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar),
        isArrayImpl(callback)
          ? ((escapedPrefix = ""),
            null != invokeCallback &&
              (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"),
            mapIntoArray(callback, array, escapedPrefix, "", function (c) {
              return c;
            }))
          : null != callback &&
            (isValidElement(callback) &&
              (callback = cloneAndReplaceKey(
                callback,
                escapedPrefix +
                  (null == callback.key || (children && children.key === callback.key)
                    ? ""
                    : ("" + callback.key).replace(userProvidedKeyEscapeRegex, "$&/") + "/") +
                  invokeCallback,
              )),
            array.push(callback)),
        1
      );
    invokeCallback = 0;
    var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
    if (isArrayImpl(children))
      for (var i = 0; i < children.length; i++)
        ((nameSoFar = children[i]),
          (type = nextNamePrefix + getElementKey(nameSoFar, i)),
          (invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback)));
    else if (((i = getIteratorFn(children)), "function" === typeof i))
      for (children = i.call(children), i = 0; !(nameSoFar = children.next()).done;)
        ((nameSoFar = nameSoFar.value),
          (type = nextNamePrefix + getElementKey(nameSoFar, i++)),
          (invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback)));
    else if ("object" === type) {
      if ("function" === typeof children.then)
        return mapIntoArray(resolveThenable(children), array, escapedPrefix, nameSoFar, callback);
      array = String(children);
      throw Error(
        "Objects are not valid as a React child (found: " +
          ("[object Object]" === array
            ? "object with keys {" + Object.keys(children).join(", ") + "}"
            : array) +
          "). If you meant to render a collection of children, use an array instead.",
      );
    }
    return invokeCallback;
  }
  function mapChildren(children, func, context) {
    if (null == children) return children;
    var result = [],
      count = 0;
    mapIntoArray(children, result, "", "", function (child) {
      return func.call(context, child, count++);
    });
    return result;
  }
  function lazyInitializer(payload) {
    if (-1 === payload._status) {
      var ctor = payload._result,
        thenable = ctor();
      thenable.then(
        function (moduleObject) {
          if (0 === payload._status || -1 === payload._status)
            ((payload._status = 1),
              (payload._result = moduleObject),
              void 0 === thenable.status &&
                ((thenable.status = "fulfilled"), (thenable.value = moduleObject)));
        },
        function (error) {
          if (0 === payload._status || -1 === payload._status)
            ((payload._status = 2),
              (payload._result = error),
              void 0 === thenable.status &&
                ((thenable.status = "rejected"), (thenable.reason = error)));
        },
      );
      -1 === payload._status && ((payload._status = 0), (payload._result = thenable));
    }
    if (1 === payload._status) return payload._result.default;
    throw payload._result;
  }
  var reportGlobalError =
    "function" === typeof reportError
      ? reportError
      : function (error) {
          if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
            var event = new window.ErrorEvent("error", {
              bubbles: !0,
              cancelable: !0,
              message:
                "object" === typeof error && null !== error && "string" === typeof error.message
                  ? String(error.message)
                  : String(error),
              error,
            });
            if (!window.dispatchEvent(event)) return;
          } else if ("object" === typeof process && "function" === typeof process.emit) {
            process.emit("uncaughtException", error);
            return;
          }
          console.error(error);
        };
  function startTransition(scope) {
    var prevTransition = ReactSharedInternals.T,
      currentTransition = {};
    currentTransition.types = null !== prevTransition ? prevTransition.types : null;
    ReactSharedInternals.T = currentTransition;
    try {
      var returnValue = scope(),
        onStartTransitionFinish = ReactSharedInternals.S;
      null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
      "object" === typeof returnValue &&
        null !== returnValue &&
        "function" === typeof returnValue.then &&
        returnValue.then(noop, reportGlobalError);
    } catch (error) {
      reportGlobalError(error);
    } finally {
      (null !== prevTransition &&
        null !== currentTransition.types &&
        (prevTransition.types = currentTransition.types),
        (ReactSharedInternals.T = prevTransition));
    }
  }
  function addTransitionType(type) {
    var transition = ReactSharedInternals.T;
    if (null !== transition) {
      var transitionTypes = transition.types;
      null === transitionTypes
        ? (transition.types = [type])
        : -1 === transitionTypes.indexOf(type) && transitionTypes.push(type);
    } else startTransition(addTransitionType.bind(null, type));
  }
  var Children = {
    map: mapChildren,
    forEach: function (children, forEachFunc, forEachContext) {
      mapChildren(
        children,
        function () {
          forEachFunc.apply(this, arguments);
        },
        forEachContext,
      );
    },
    count: function (children) {
      var n = 0;
      mapChildren(children, function () {
        n++;
      });
      return n;
    },
    toArray: function (children) {
      return (
        mapChildren(children, function (child) {
          return child;
        }) || []
      );
    },
    only: function (children) {
      if (!isValidElement(children))
        throw Error("React.Children.only expected to receive a single React element child.");
      return children;
    },
  };
  exports.Activity = REACT_ACTIVITY_TYPE;
  exports.Children = Children;
  exports.Component = Component;
  exports.Fragment = REACT_FRAGMENT_TYPE;
  exports.Profiler = REACT_PROFILER_TYPE;
  exports.PureComponent = PureComponent;
  exports.StrictMode = REACT_STRICT_MODE_TYPE;
  exports.Suspense = REACT_SUSPENSE_TYPE;
  exports.ViewTransition = REACT_VIEW_TRANSITION_TYPE;
  exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
  exports.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function (size) {
      return ReactSharedInternals.H.useMemoCache(size);
    },
  };
  exports.addTransitionType = addTransitionType;
  exports.cache = function (fn) {
    return function () {
      return fn.apply(null, arguments);
    };
  };
  exports.cacheSignal = function () {
    return null;
  };
  exports.cloneElement = function (element, config, children) {
    if (null === element || void 0 === element)
      throw Error("The argument must be a React element, but you passed " + element + ".");
    var props = assign({}, element.props),
      key = element.key;
    if (null != config)
      for (propName in (void 0 !== config.key && (key = "" + config.key), config))
        !hasOwnProperty.call(config, propName) ||
          "key" === propName ||
          "__self" === propName ||
          "__source" === propName ||
          ("ref" === propName && void 0 === config.ref) ||
          (props[propName] = config[propName]);
    var propName = arguments.length - 2;
    if (1 === propName) props.children = children;
    else if (1 < propName) {
      for (var childArray = Array(propName), i = 0; i < propName; i++)
        childArray[i] = arguments[i + 2];
      props.children = childArray;
    }
    return ReactElement(element.type, key, props);
  };
  exports.createContext = function (defaultValue) {
    defaultValue = {
      $$typeof: REACT_CONTEXT_TYPE,
      _currentValue: defaultValue,
      _currentValue2: defaultValue,
      _threadCount: 0,
      Provider: null,
      Consumer: null,
    };
    defaultValue.Provider = defaultValue;
    defaultValue.Consumer = {
      $$typeof: REACT_CONSUMER_TYPE,
      _context: defaultValue,
    };
    return defaultValue;
  };
  exports.createElement = function (type, config, children) {
    var propName,
      props = {},
      key = null;
    if (null != config)
      for (propName in (void 0 !== config.key && (key = "" + config.key), config))
        hasOwnProperty.call(config, propName) &&
          "key" !== propName &&
          "__self" !== propName &&
          "__source" !== propName &&
          (props[propName] = config[propName]);
    var childrenLength = arguments.length - 2;
    if (1 === childrenLength) props.children = children;
    else if (1 < childrenLength) {
      for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++)
        childArray[i] = arguments[i + 2];
      props.children = childArray;
    }
    if (type && type.defaultProps)
      for (propName in ((childrenLength = type.defaultProps), childrenLength))
        void 0 === props[propName] && (props[propName] = childrenLength[propName]);
    return ReactElement(type, key, props);
  };
  exports.createRef = function () {
    return { current: null };
  };
  exports.forwardRef = function (render) {
    return {
      $$typeof: REACT_FORWARD_REF_TYPE,
      render,
    };
  };
  exports.isValidElement = isValidElement;
  exports.lazy = function (ctor) {
    return {
      $$typeof: REACT_LAZY_TYPE,
      _payload: {
        _status: -1,
        _result: ctor,
      },
      _init: lazyInitializer,
    };
  };
  exports.memo = function (type, compare) {
    return {
      $$typeof: REACT_MEMO_TYPE,
      type,
      compare: void 0 === compare ? null : compare,
    };
  };
  exports.startTransition = startTransition;
  exports.unstable_useCacheRefresh = function () {
    return ReactSharedInternals.H.useCacheRefresh();
  };
  exports.use = function (usable) {
    return ReactSharedInternals.H.use(usable);
  };
  exports.useActionState = function (action, initialState, permalink) {
    return ReactSharedInternals.H.useActionState(action, initialState, permalink);
  };
  exports.useCallback = function (callback, deps) {
    return ReactSharedInternals.H.useCallback(callback, deps);
  };
  exports.useContext = function (Context) {
    return ReactSharedInternals.H.useContext(Context);
  };
  exports.useDebugValue = function () {};
  exports.useDeferredValue = function (value, initialValue) {
    return ReactSharedInternals.H.useDeferredValue(value, initialValue);
  };
  exports.useEffect = function (create, deps) {
    return ReactSharedInternals.H.useEffect(create, deps);
  };
  exports.useEffectEvent = function (callback) {
    return ReactSharedInternals.H.useEffectEvent(callback);
  };
  exports.useId = function () {
    return ReactSharedInternals.H.useId();
  };
  exports.useImperativeHandle = function (ref, create, deps) {
    return ReactSharedInternals.H.useImperativeHandle(ref, create, deps);
  };
  exports.useInsertionEffect = function (create, deps) {
    return ReactSharedInternals.H.useInsertionEffect(create, deps);
  };
  exports.useLayoutEffect = function (create, deps) {
    return ReactSharedInternals.H.useLayoutEffect(create, deps);
  };
  exports.useMemo = function (create, deps) {
    return ReactSharedInternals.H.useMemo(create, deps);
  };
  exports.useOptimistic = function (passthrough, reducer) {
    return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
  };
  exports.useReducer = function (reducer, initialArg, init) {
    return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
  };
  exports.useRef = function (initialValue) {
    return ReactSharedInternals.H.useRef(initialValue);
  };
  exports.useState = function (initialState) {
    return ReactSharedInternals.H.useState(initialState);
  };
  exports.useSyncExternalStore = function (subscribe, getSnapshot, getServerSnapshot) {
    return ReactSharedInternals.H.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  };
  exports.useTransition = function () {
    return ReactSharedInternals.H.useTransition();
  };
  exports.version = "19.3.0";
});
//#endregion
//#region ../../node_modules/.pnpm/react@19.3.0/node_modules/react/index.js
var require_react = /* @__PURE__ */ __commonJSMin((exports, module) => {
  module.exports = require_react_production();
});
//#endregion
//#region ../../node_modules/.pnpm/react@19.3.0/node_modules/react/cjs/react-jsx-runtime.production.js
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var require_react_jsx_runtime_production = /* @__PURE__ */ __commonJSMin((exports) => {
  var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
  var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
  function jsxProd(type, config, maybeKey) {
    var key = null;
    void 0 !== maybeKey && (key = "" + maybeKey);
    void 0 !== config.key && (key = "" + config.key);
    if ("key" in config) {
      maybeKey = {};
      for (var propName in config) "key" !== propName && (maybeKey[propName] = config[propName]);
    } else maybeKey = config;
    config = maybeKey.ref;
    return {
      $$typeof: REACT_ELEMENT_TYPE,
      type,
      key,
      ref: void 0 !== config ? config : null,
      props: maybeKey,
    };
  }
  exports.Fragment = REACT_FRAGMENT_TYPE;
  exports.jsx = jsxProd;
  exports.jsxs = jsxProd;
});
//#endregion
//#region ../../node_modules/.pnpm/react@19.3.0/node_modules/react/jsx-runtime.js
var require_jsx_runtime = /* @__PURE__ */ __commonJSMin((exports, module) => {
  module.exports = require_react_jsx_runtime_production();
});
//#endregion
//#region ../../node_modules/.pnpm/use-sync-external-store@1.7.0_react@19.3.0/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.production.js
/**
 * @license React
 * use-sync-external-store-shim.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var require_use_sync_external_store_shim_production = /* @__PURE__ */ __commonJSMin((exports) => {
  var React = require_react();
  function is(x, y) {
    return (x === y && (0 !== x || 1 / x === 1 / y)) || (x !== x && y !== y);
  }
  var objectIs = "function" === typeof Object.is ? Object.is : is;
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useLayoutEffect = React.useLayoutEffect;
  var useDebugValue = React.useDebugValue;
  function useSyncExternalStore$2(subscribe, getSnapshot) {
    var value = getSnapshot(),
      _useState = useState({
        inst: {
          value,
          getSnapshot,
        },
      }),
      inst = _useState[0].inst,
      forceUpdate = _useState[1];
    useLayoutEffect(
      function () {
        inst.value = value;
        inst.getSnapshot = getSnapshot;
        checkIfSnapshotChanged(inst) && forceUpdate({ inst });
      },
      [subscribe, value, getSnapshot],
    );
    useEffect(
      function () {
        checkIfSnapshotChanged(inst) && forceUpdate({ inst });
        return subscribe(function () {
          checkIfSnapshotChanged(inst) && forceUpdate({ inst });
        });
      },
      [subscribe],
    );
    useDebugValue(value);
    return value;
  }
  function checkIfSnapshotChanged(inst) {
    var latestGetSnapshot = inst.getSnapshot;
    inst = inst.value;
    try {
      var nextValue = latestGetSnapshot();
      return !objectIs(inst, nextValue);
    } catch (error) {
      return !0;
    }
  }
  function useSyncExternalStore$1(subscribe, getSnapshot) {
    return getSnapshot();
  }
  var shim =
    "undefined" === typeof window ||
    "undefined" === typeof window.document ||
    "undefined" === typeof window.document.createElement
      ? useSyncExternalStore$1
      : useSyncExternalStore$2;
  exports.useSyncExternalStore =
    void 0 !== React.useSyncExternalStore ? React.useSyncExternalStore : shim;
});
//#endregion
//#region ../../node_modules/.pnpm/use-sync-external-store@1.7.0_react@19.3.0/node_modules/use-sync-external-store/shim/index.js
var require_shim = /* @__PURE__ */ __commonJSMin((exports, module) => {
  module.exports = require_use_sync_external_store_shim_production();
});
//#endregion
//#region ../../node_modules/.pnpm/use-sync-external-store@1.7.0_react@19.3.0/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.js
/**
 * @license React
 * use-sync-external-store-shim/with-selector.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var require_with_selector_production = /* @__PURE__ */ __commonJSMin((exports) => {
  var React = require_react();
  var shim = require_shim();
  function is(x, y) {
    return (x === y && (0 !== x || 1 / x === 1 / y)) || (x !== x && y !== y);
  }
  var objectIs = "function" === typeof Object.is ? Object.is : is;
  var useSyncExternalStore = shim.useSyncExternalStore;
  var useRef = React.useRef;
  var useEffect = React.useEffect;
  var useMemo = React.useMemo;
  var useDebugValue = React.useDebugValue;
  exports.useSyncExternalStoreWithSelector = function (
    subscribe,
    getSnapshot,
    getServerSnapshot,
    selector,
    isEqual,
  ) {
    var instRef = useRef(null);
    if (null === instRef.current) {
      var inst = {
        hasValue: !1,
        value: null,
      };
      instRef.current = inst;
    } else inst = instRef.current;
    instRef = useMemo(
      function () {
        function memoizedSelector(nextSnapshot) {
          if (!hasMemo) {
            hasMemo = !0;
            memoizedSnapshot = nextSnapshot;
            nextSnapshot = selector(nextSnapshot);
            if (void 0 !== isEqual && inst.hasValue) {
              var currentSelection = inst.value;
              if (isEqual(currentSelection, nextSnapshot))
                return (memoizedSelection = currentSelection);
            }
            return (memoizedSelection = nextSnapshot);
          }
          currentSelection = memoizedSelection;
          if (objectIs(memoizedSnapshot, nextSnapshot)) return currentSelection;
          var nextSelection = selector(nextSnapshot);
          if (void 0 !== isEqual && isEqual(currentSelection, nextSelection))
            return ((memoizedSnapshot = nextSnapshot), currentSelection);
          memoizedSnapshot = nextSnapshot;
          return (memoizedSelection = nextSelection);
        }
        var hasMemo = !1,
          memoizedSnapshot,
          memoizedSelection,
          maybeGetServerSnapshot = void 0 === getServerSnapshot ? null : getServerSnapshot;
        return [
          function () {
            return memoizedSelector(getSnapshot());
          },
          null === maybeGetServerSnapshot
            ? void 0
            : function () {
                return memoizedSelector(maybeGetServerSnapshot());
              },
        ];
      },
      [getSnapshot, getServerSnapshot, selector, isEqual],
    );
    var value = useSyncExternalStore(subscribe, instRef[0], instRef[1]);
    useEffect(
      function () {
        inst.hasValue = !0;
        inst.value = value;
      },
      [value],
    );
    useDebugValue(value);
    return value;
  };
});
//#endregion
//#region ../../node_modules/.pnpm/use-sync-external-store@1.7.0_react@19.3.0/node_modules/use-sync-external-store/shim/with-selector.js
var require_with_selector = /* @__PURE__ */ __commonJSMin((exports, module) => {
  module.exports = require_with_selector_production();
});
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-store@0.11.2_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-store/dist/useSelector.js
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_with_selector = require_with_selector();
function defaultCompare(a, b) {
  return a === b;
}
/**
 * Selects a slice of state from an atom or store and subscribes the component
 * to that selection.
 *
 * This is the primary React read hook for TanStack Store. It works with any
 * source that exposes `get()` and `subscribe()`, including atoms, readonly
 * atoms, stores, and readonly stores.
 *
 * Omit the selector to subscribe to the whole value.
 *
 * @example
 * ```tsx
 * const count = useSelector(counterStore, (state) => state.count)
 * ```
 *
 * @example
 * ```tsx
 * const value = useSelector(countAtom)
 * ```
 */
function useSelector(source, selector = (s) => s, options) {
  const compare = options?.compare ?? defaultCompare;
  const subscribe = (0, import_react.useCallback)(
    (handleStoreChange) => {
      const { unsubscribe } = source.subscribe(handleStoreChange);
      return unsubscribe;
    },
    [source],
  );
  const getSnapshot = (0, import_react.useCallback)(() => source.get(), [source]);
  return (0, import_with_selector.useSyncExternalStoreWithSelector)(
    subscribe,
    getSnapshot,
    getSnapshot,
    selector,
    compare,
  );
}
//#endregion
//#region ../../node_modules/.pnpm/react-dom@19.3.0_react@19.3.0/node_modules/react-dom/cjs/react-dom.production.js
/**
 * @license React
 * react-dom.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var require_react_dom_production = /* @__PURE__ */ __commonJSMin((exports) => {
  var React = require_react();
  function formatProdErrorMessage(code) {
    var url = "https://react.dev/errors/" + code;
    if (1 < arguments.length) {
      url += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var i = 2; i < arguments.length; i++)
        url += "&args[]=" + encodeURIComponent(arguments[i]);
    }
    return (
      "Minified React error #" +
      code +
      "; visit " +
      url +
      " for the full message or use the non-minified dev environment for full errors and additional helpful warnings."
    );
  }
  function noop() {}
  var Internals = {
    d: {
      f: noop,
      r: function () {
        throw Error(formatProdErrorMessage(522));
      },
      D: noop,
      C: noop,
      L: noop,
      m: noop,
      X: noop,
      S: noop,
      M: noop,
    },
    p: 0,
    findDOMNode: null,
  };
  var REACT_PORTAL_TYPE = Symbol.for("react.portal");
  var REACT_RECOVERABLE_TYPE = Symbol.for("react.recoverable");
  var REACT_OPTIMISTIC_KEY = Symbol.for("react.optimistic_key");
  function createPortal$1(children, containerInfo, implementation) {
    var key = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
    return {
      $$typeof: REACT_PORTAL_TYPE,
      key: null == key ? null : key === REACT_OPTIMISTIC_KEY ? REACT_OPTIMISTIC_KEY : "" + key,
      children,
      containerInfo,
      implementation,
    };
  }
  var ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function getCrossOriginStringAs(as, input) {
    if ("font" === as) return "";
    if ("string" === typeof input) return "use-credentials" === input ? input : "";
  }
  exports.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = Internals;
  exports.browser = function (reason) {
    return {
      $$typeof: REACT_RECOVERABLE_TYPE,
      _reason: reason,
    };
  };
  exports.createPortal = function (children, container) {
    var key = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
    if (
      !container ||
      (1 !== container.nodeType && 9 !== container.nodeType && 11 !== container.nodeType)
    )
      throw Error(formatProdErrorMessage(299));
    return createPortal$1(children, container, null, key);
  };
  exports.flushSync = function (fn) {
    var previousTransition = ReactSharedInternals.T,
      previousUpdatePriority = Internals.p;
    try {
      if (((ReactSharedInternals.T = null), (Internals.p = 2), fn)) return fn();
    } finally {
      ((ReactSharedInternals.T = previousTransition),
        (Internals.p = previousUpdatePriority),
        Internals.d.f());
    }
  };
  exports.preconnect = function (href, options) {
    "string" === typeof href &&
      (options
        ? ((options = options.crossOrigin),
          (options =
            "string" === typeof options ? ("use-credentials" === options ? options : "") : void 0))
        : (options = null),
      Internals.d.C(href, options));
  };
  exports.prefetchDNS = function (href) {
    "string" === typeof href && Internals.d.D(href);
  };
  exports.preinit = function (href, options) {
    if ("string" === typeof href && options && "string" === typeof options.as) {
      var as = options.as,
        crossOrigin = getCrossOriginStringAs(as, options.crossOrigin),
        integrity = "string" === typeof options.integrity ? options.integrity : void 0,
        fetchPriority = "string" === typeof options.fetchPriority ? options.fetchPriority : void 0;
      "style" === as
        ? Internals.d.S(
            href,
            "string" === typeof options.precedence ? options.precedence : void 0,
            {
              crossOrigin,
              integrity,
              fetchPriority,
            },
          )
        : "script" === as &&
          Internals.d.X(href, {
            crossOrigin,
            integrity,
            fetchPriority,
            nonce: "string" === typeof options.nonce ? options.nonce : void 0,
          });
    }
  };
  exports.preinitModule = function (href, options) {
    if ("string" === typeof href)
      if ("object" === typeof options && null !== options) {
        if (null == options.as || "script" === options.as) {
          var crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
          Internals.d.M(href, {
            crossOrigin,
            integrity: "string" === typeof options.integrity ? options.integrity : void 0,
            nonce: "string" === typeof options.nonce ? options.nonce : void 0,
            fetchPriority:
              "string" === typeof options.fetchPriority ? options.fetchPriority : void 0,
          });
        }
      } else options ?? Internals.d.M(href);
  };
  exports.preload = function (href, options) {
    if (
      "string" === typeof href &&
      "object" === typeof options &&
      null !== options &&
      "string" === typeof options.as
    ) {
      var as = options.as,
        crossOrigin = getCrossOriginStringAs(as, options.crossOrigin);
      Internals.d.L(href, as, {
        crossOrigin,
        integrity: "string" === typeof options.integrity ? options.integrity : void 0,
        nonce: "string" === typeof options.nonce ? options.nonce : void 0,
        type: "string" === typeof options.type ? options.type : void 0,
        fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0,
        referrerPolicy:
          "string" === typeof options.referrerPolicy ? options.referrerPolicy : void 0,
        imageSrcSet: "string" === typeof options.imageSrcSet ? options.imageSrcSet : void 0,
        imageSizes: "string" === typeof options.imageSizes ? options.imageSizes : void 0,
        media: "string" === typeof options.media ? options.media : void 0,
      });
    }
  };
  exports.preloadModule = function (href, options) {
    if ("string" === typeof href)
      if (options) {
        var crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
        Internals.d.m(href, {
          as: "string" === typeof options.as && "script" !== options.as ? options.as : void 0,
          crossOrigin,
          integrity: "string" === typeof options.integrity ? options.integrity : void 0,
          nonce: "string" === typeof options.nonce ? options.nonce : void 0,
          fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0,
        });
      } else Internals.d.m(href);
  };
  exports.requestFormReset = function (form) {
    Internals.d.r(form);
  };
  exports.unstable_batchedUpdates = function (fn, a) {
    return fn(a);
  };
  exports.useFormState = function (action, initialState, permalink) {
    return ReactSharedInternals.H.useFormState(action, initialState, permalink);
  };
  exports.useFormStatus = function () {
    return ReactSharedInternals.H.useHostTransitionStatus();
  };
  exports.version = "19.3.0";
});
//#endregion
//#region ../../node_modules/.pnpm/react-dom@19.3.0_react@19.3.0/node_modules/react-dom/index.js
var require_react_dom = /* @__PURE__ */ __commonJSMin((exports, module) => {
  function checkDCE() {
    if (
      typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" ||
      typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function"
    )
      return;
    try {
      __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
    } catch (err) {
      console.error(err);
    }
  }
  checkDCE();
  module.exports = require_react_dom_production();
});
//#endregion
export {
  toLowerCase as $,
  maxValue as A,
  parse as B,
  integer as C,
  literal as D,
  isoTimestamp as E,
  nullable as F,
  rawTransform as G,
  picklist as H,
  number as I,
  safeInteger as J,
  record as K,
  object as L,
  minValue as M,
  nonEmpty as N,
  looseObject as O,
  null_ as P,
  string as Q,
  omit as R,
  getDotPath as S,
  isValiError as T,
  pipe as U,
  partial as V,
  rawCheck as W,
  setSpecificMessage as X,
  safeParse as Y,
  strictObject as Z,
  check as _,
  objectStorage as a,
  uuid as at,
  flatten as b,
  requestCache as c,
  sequenceSchema as d,
  transform as et,
  uuidV7Schema as f,
  brand as g,
  boolean as h,
  require_react as i,
  url as it,
  minLength as j,
  maxLength as k,
  scopedKey as l,
  array as m,
  useSelector as n,
  union as nt,
  readBlobBody as o,
  variant as ot,
  workflowInstanceIdSchema as p,
  regex as q,
  require_jsx_runtime as r,
  unknown as rt,
  blobUrlAccess as s,
  require_react_dom as t,
  trim as tt,
  messageBody as u,
  date as v,
  is as w,
  forward as x,
  email as y,
  optional as z,
};
