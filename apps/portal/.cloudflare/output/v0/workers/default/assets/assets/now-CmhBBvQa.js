import { Ht as e, Wt as t, _ as n } from "./createLucideIcon-BBeoGZx-.js";
var r = n(),
  i = t(e(), 1);
function a(e) {
  let t = (0, r.c)(2),
    n;
  t[0] === e
    ? (n = t[1])
    : ((n = () => {
        let t = Date.now();
        return {
          subscribe: (n) => {
            let r = setInterval(() => {
              ((t = Date.now()), n());
            }, e);
            return () => clearInterval(r);
          },
          read: () => t,
        };
      }),
      (t[0] = e),
      (t[1] = n));
  let [a] = (0, i.useState)(n);
  return (0, i.useSyncExternalStore)(a.subscribe, a.read);
}
export { a as t };
