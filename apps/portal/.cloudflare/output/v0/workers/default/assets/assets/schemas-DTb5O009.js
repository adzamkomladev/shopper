import {
  $ as e,
  A as t,
  B as n,
  C as r,
  I as i,
  J as a,
  M as o,
  Q as s,
  R as c,
  S as l,
  U as u,
  W as d,
  b as f,
  et as p,
  nt as m,
  r as h,
  rt as g,
  y as _,
} from "./createLucideIcon-BBeoGZx-.js";
var v = d(e(), m(), p(), o(2), t(80), a(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  y = d(e(), m(), o(1), t(120)),
  b = d(e(), m(), p(), r(), t(254)),
  x = d(e(), o(12), t(128)),
  S = d(e(), o(1), t(256));
s({ name: y, email: b, shopName: y, shopCode: v });
var C = s({ id: h, token: S });
s({ id: h, token: S, password: x, shopCode: n(v) });
var w = s({ id: h, resendToken: S }),
  T = s({
    id: h,
    email: e(),
    expiresAt: e(),
    resendToken: e(),
    deliveryStatus: u([`pending`, `sent`, `failed`]),
  }),
  E = s({
    id: h,
    email: e(),
    name: e(),
    shopName: e(),
    shopCode: e(),
    expiresAt: e(),
    verified: f(),
    completed: f(),
    deliveryStatus: n(u([`pending`, `sent`, `failed`])),
  }),
  D = s({ orgId: h, shopCode: e(), email: e() });
g([C, w]);
var O = h,
  k = d(e(), a(/^\d{4,8}$/)),
  A = s({ branchId: O });
s({ orgId: O, code: d(e(), a(/^\d{6}$/)), name: d(e(), m(), o(1), t(200)) });
var j = s({ userId: O, pin: k });
s({ deviceId: O, deviceToken: d(e(), a(/^[0-9a-f]{64}$/)), userId: O, pin: k });
var M = s({ deviceId: O }),
  N = s({
    id: O,
    name: e(),
    branchId: O,
    branchName: e(),
    createdAt: e(),
    revokedAt: i(e()),
    status: u([`active`, `revoked`]),
  });
_(N);
var P =
    `sale.create,refund.approve,refund.request,shift.read,shift.write,stock.read,stock.write,product.read,product.write,product.propose,tax.read,tax.write,report.read,audit.read,user.read,role.read,device.read,user.write,role.write,store.read,store.write,branch.read,branch.write,device.enroll,device.revoke,cashier.pin.assign`.split(
      `,`,
    ),
  F = u(P),
  I = d(e(), m(), o(1), t(100)),
  L = d(_(F), t(P.length));
(s({ name: I, permissionCodes: L }),
  d(
    s({ name: n(I), permissionCodes: n(L) }),
    l((e) => e.name !== void 0 || e.permissionCodes !== void 0, `A role change is required`),
  ),
  s({ roleId: h }));
var R = c({ id: h, name: e(), protectedOwner: f(), permissionCodes: _(F) }),
  z = _(R),
  B = c({ id: h, code: F, tillAllowed: f() }),
  V = _(B),
  H = _(F);
(s({ userId: h, roleId: h }),
  s({
    name: d(e(), m(), o(1), t(200)),
    email: d(e(), m(), r()),
    password: d(e(), o(8), t(128)),
    roleId: h,
  }));
var U = c({
    id: h,
    name: e(),
    email: e(),
    emailVerified: f(),
    roleId: h,
    roleName: e(),
    protectedOwner: f(),
  }),
  W = _(U),
  G = s({ email: b, roleId: h, channel: u([`email`, `local`]) });
(s({ token: S, name: n(y), password: n(x) }), s({ token: S }));
var K = c({
  id: h,
  email: e(),
  roleId: i(h),
  channel: u([`email`, `local`]),
  status: e(),
  expiresAt: e(),
  createdAt: e(),
  consumedAt: i(e()),
  setupLink: n(e()),
  deliveryStatus: n(u([`pending`, `sent`, `failed`])),
});
_(K);
var q = s({
    id: h,
    orgId: h,
    shopCode: e(),
    shopName: e(),
    email: e(),
    roleId: h,
    roleName: e(),
    channel: u([`email`, `local`]),
    expiresAt: e(),
    existingAccount: f(),
  }),
  J = s({ orgId: h, shopCode: e(), email: e(), userId: h, roleId: h });
export {
  D as _,
  W as a,
  v as b,
  z as c,
  A as d,
  j as f,
  y as g,
  x as h,
  q as i,
  H as l,
  b as m,
  G as n,
  V as o,
  M as p,
  K as r,
  R as s,
  J as t,
  N as u,
  T as v,
  E as y,
};
