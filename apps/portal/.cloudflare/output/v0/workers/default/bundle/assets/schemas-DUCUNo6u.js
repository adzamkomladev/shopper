import {
  $ as toLowerCase,
  F as nullable,
  H as picklist,
  L as object,
  Q as string,
  U as pipe,
  Z as strictObject,
  _ as check,
  f as uuidV7Schema,
  h as boolean,
  j as minLength,
  k as maxLength,
  m as array,
  nt as union,
  q as regex,
  tt as trim,
  y as email,
  z as optional,
} from "./react-dom-BCYT53bd.js";
//#region ../../packages/auth/src/schemas/permissions.ts
var permissionNames = [
  "sale.create",
  "refund.approve",
  "refund.request",
  "shift.read",
  "shift.write",
  "stock.read",
  "stock.write",
  "product.read",
  "product.write",
  "product.propose",
  "tax.read",
  "tax.write",
  "report.read",
  "audit.read",
  "user.read",
  "role.read",
  "device.read",
  "user.write",
  "role.write",
  "store.read",
  "store.write",
  "branch.read",
  "branch.write",
  "device.enroll",
  "device.revoke",
  "cashier.pin.assign",
];
//#endregion
//#region ../../packages/auth/src/schemas/users.ts
var assignRoleInput = strictObject({
  userId: uuidV7Schema,
  roleId: uuidV7Schema,
});
var registerUserInput = strictObject({
  name: pipe(string(), trim(), minLength(1), maxLength(200)),
  email: pipe(string(), trim(), email()),
  password: pipe(string(), minLength(8), maxLength(128)),
  roleId: uuidV7Schema,
});
var userListItem = object({
  id: uuidV7Schema,
  name: string(),
  email: string(),
  emailVerified: boolean(),
  roleId: uuidV7Schema,
  roleName: string(),
  protectedOwner: boolean(),
});
var userListResponse = array(userListItem);
//#endregion
//#region ../../packages/auth/src/schemas/devices.ts
var id = uuidV7Schema;
var pin = pipe(string(), regex(/^\d{4,8}$/));
var enrollmentIssueInput = strictObject({ branchId: id });
var enrollmentInput = strictObject({
  orgId: id,
  code: pipe(string(), regex(/^\d{6}$/)),
  name: pipe(string(), trim(), minLength(1), maxLength(200)),
});
var pinInput = strictObject({
  userId: id,
  pin,
});
var cashierLoginInput = strictObject({
  deviceId: id,
  deviceToken: pipe(string(), regex(/^[0-9a-f]{64}$/)),
  userId: id,
  pin,
});
var revokeDeviceInput = strictObject({ deviceId: id });
var deviceListItem = strictObject({
  id,
  name: string(),
  branchId: id,
  branchName: string(),
  createdAt: string(),
  revokedAt: nullable(string()),
  status: picklist(["active", "revoked"]),
});
array(deviceListItem);
//#endregion
//#region ../../packages/auth/src/schemas/roles.ts
var permissionCode = picklist(permissionNames);
var roleName = pipe(string(), trim(), minLength(1), maxLength(100));
var permissionCodes = pipe(array(permissionCode), maxLength(permissionNames.length));
var createRoleInput = strictObject({
  name: roleName,
  permissionCodes,
});
var updateRoleInput = pipe(
  strictObject({
    name: optional(roleName),
    permissionCodes: optional(permissionCodes),
  }),
  check(
    (input) => input.name !== void 0 || input.permissionCodes !== void 0,
    "A role change is required",
  ),
);
var roleAssignmentInput = strictObject({ roleId: uuidV7Schema });
var roleListItem = object({
  id: uuidV7Schema,
  name: string(),
  protectedOwner: boolean(),
  permissionCodes: array(permissionCode),
});
var roleListResponse = array(roleListItem);
var permissionListItem = object({
  id: uuidV7Schema,
  code: permissionCode,
  tillAllowed: boolean(),
});
var permissionListResponse = array(permissionListItem);
var sessionPermissionsResponse = array(permissionCode);
//#endregion
//#region ../../packages/auth/src/schemas/onboarding.ts
var shopCodeSchema = pipe(
  string(),
  trim(),
  toLowerCase(),
  minLength(2),
  maxLength(80),
  regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
);
var personNameSchema = pipe(string(), trim(), minLength(1), maxLength(120));
var emailSchema = pipe(string(), trim(), toLowerCase(), email(), maxLength(254));
var passwordSchema = pipe(string(), minLength(12), maxLength(128));
var linkTokenSchema = pipe(string(), minLength(1), maxLength(256));
var registrationStartSchema = strictObject({
  name: personNameSchema,
  email: emailSchema,
  shopName: personNameSchema,
  shopCode: shopCodeSchema,
});
var registrationVerifySchema = strictObject({
  id: uuidV7Schema,
  token: linkTokenSchema,
});
var registrationCompleteSchema = strictObject({
  id: uuidV7Schema,
  token: linkTokenSchema,
  password: passwordSchema,
  shopCode: optional(shopCodeSchema),
});
var registrationResendSchema = strictObject({
  id: uuidV7Schema,
  resendToken: linkTokenSchema,
});
var registrationStartResponse = strictObject({
  id: uuidV7Schema,
  email: string(),
  expiresAt: string(),
  resendToken: string(),
  deliveryStatus: picklist(["pending", "sent", "failed"]),
});
var registrationViewResponse = strictObject({
  id: uuidV7Schema,
  email: string(),
  name: string(),
  shopName: string(),
  shopCode: string(),
  expiresAt: string(),
  verified: boolean(),
  completed: boolean(),
  deliveryStatus: optional(picklist(["pending", "sent", "failed"])),
});
var registrationCompleteResponse = strictObject({
  orgId: uuidV7Schema,
  shopCode: string(),
  email: string(),
});
var registrationPreviewSchema = union([registrationVerifySchema, registrationResendSchema]);
//#endregion
//#region ../../packages/auth/src/schemas/invitations.ts
var invitationIssueSchema = strictObject({
  email: emailSchema,
  roleId: uuidV7Schema,
  channel: picklist(["email", "local"]),
});
var invitationAcceptSchema = strictObject({
  token: linkTokenSchema,
  name: optional(personNameSchema),
  password: optional(passwordSchema),
});
strictObject({ token: linkTokenSchema });
var invitationListItem = object({
  id: uuidV7Schema,
  email: string(),
  roleId: nullable(uuidV7Schema),
  channel: picklist(["email", "local"]),
  status: string(),
  expiresAt: string(),
  createdAt: string(),
  consumedAt: nullable(string()),
  setupLink: optional(string()),
  deliveryStatus: optional(picklist(["pending", "sent", "failed"])),
});
array(invitationListItem);
var invitationPreviewResponse = strictObject({
  id: uuidV7Schema,
  orgId: uuidV7Schema,
  shopCode: string(),
  shopName: string(),
  email: string(),
  roleId: uuidV7Schema,
  roleName: string(),
  channel: picklist(["email", "local"]),
  expiresAt: string(),
  existingAccount: boolean(),
});
var invitationAcceptResponse = strictObject({
  orgId: uuidV7Schema,
  shopCode: string(),
  email: string(),
  userId: uuidV7Schema,
  roleId: uuidV7Schema,
});
//#endregion
export {
  pinInput as A,
  roleListResponse as C,
  deviceListItem as D,
  cashierLoginInput as E,
  permissionNames as F,
  assignRoleInput as M,
  registerUserInput as N,
  enrollmentInput as O,
  userListResponse as P,
  roleListItem as S,
  updateRoleInput as T,
  registrationViewResponse as _,
  invitationPreviewResponse as a,
  permissionListResponse as b,
  passwordSchema as c,
  registrationCompleteSchema as d,
  registrationPreviewSchema as f,
  registrationVerifySchema as g,
  registrationStartSchema as h,
  invitationListItem as i,
  revokeDeviceInput as j,
  enrollmentIssueInput as k,
  personNameSchema as l,
  registrationStartResponse as m,
  invitationAcceptSchema as n,
  emailSchema as o,
  registrationResendSchema as p,
  invitationIssueSchema as r,
  linkTokenSchema as s,
  invitationAcceptResponse as t,
  registrationCompleteResponse as u,
  shopCodeSchema as v,
  sessionPermissionsResponse as w,
  roleAssignmentInput as x,
  createRoleInput as y,
};
