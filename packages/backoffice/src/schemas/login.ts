import * as v from "valibot";

/** `needsShopCode` is false on the box, which serves one shop and has no shop code. */
export function loginSchema(needsShopCode: boolean) {
  return v.object({
    shopCode: needsShopCode
      ? v.pipe(v.string(), v.trim(), v.minLength(1, "Enter your shop code"))
      : v.string(),
    email: v.pipe(v.string(), v.trim(), v.email("Enter a valid email address")),
    password: v.pipe(v.string(), v.minLength(1, "Enter your password")),
  });
}

export type LoginValues = v.InferOutput<ReturnType<typeof loginSchema>>;
