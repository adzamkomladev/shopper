import * as v from "valibot";
import { momoPhoneFingerprint, momoView } from "@shopper/core/payments";
import { paymentHeaders } from "./payments/headers";
import { readHostPayment } from "./payments/intent";
import { recoverHostPayments } from "./payments/recover";
import {
  paymentSale,
  storePaymentUpdate,
  applyDraftPayment,
  hostTime,
  readDraft,
  TillError,
  validateSession,
} from "@shopper/core/till";
import { buildInfo } from "@shopper/config";
import { add, money, sub } from "@shopper/money";
import type { TillDatabase } from "@shopper/db-sqlite";
import type { BridgeMessage, BridgeRequest } from "@shopper/sync/bridge";
import type { HostConfiguration } from "./config";

type Request = Extract<BridgeRequest, { type: "payment.momo.start" | "payment.momo.otp" }>;
export function createHostPayments(
  database: TillDatabase,
  config: HostConfiguration,
  publish: (message: BridgeMessage) => void = () => undefined,
) {
  let busy = false;
  return {
    get busy() {
      return busy;
    },
    receive,
    recover: () => recoverHostPayments(database, config, receive),
    async request(request: Request) {
      if (busy) throw new TillError("DRAFT_BUSY", "A payment request is already being sent");
      if (!config.session) throw new TillError("session", "Sign in before taking MoMo payments");
      busy = true;
      try {
        const deviceTime = new Date();
        const scope = await validateSession(database, config.session, {
          scope: config.identity,
          permission: "payment.momo",
          at: deviceTime,
        });
        const at = await hostTime(database, config.identity, deviceTime);
        const view = await readDraft(database, scope, { at });
        if (!view.draft || view.draft.revision !== request.expectedRevision)
          throw new TillError("REVISION_STALE", "The basket changed before this payment");
        const context = {
          orgId: scope.orgId,
          deviceId: scope.deviceId,
          branchId: scope.branchId,
          actorId: scope.cashierId,
          role: config.session.roleName,
          appVersion: buildInfo.version,
        };
        const phoneFingerprint =
          request.type === "payment.momo.start"
            ? await momoPhoneFingerprint(request.phone)
            : undefined;
        let reference = request.type === "payment.momo.start" ? request.id : request.reference;
        if (request.type === "payment.momo.start") {
          const retry = view.draft.tenders.find(
            (t) => t.kind === "momo" && ["pending", "otp"].includes(t.status),
          );
          if (retry) {
            const intent = retry.reference
              ? await readHostPayment(database, config, retry.reference)
              : undefined;
            if (
              retry.amount !== request.amount ||
              intent?.phoneFingerprint !== phoneFingerprint ||
              retry.network !== request.network
            )
              throw new TillError(
                "DRAFT_BUSY",
                "Resolve the pending MoMo payment before starting another",
              );
            if (!retry.reference)
              throw new TillError("PAYMENT_INVALID", "Pending payment has no reference");
            reference = retry.reference;
          }
          const reserved = view.draft.tenders
            .filter((t) => t.kind === "momo" && ["pending", "otp"].includes(t.status))
            .reduce((sum, t) => add(sum, money(t.amount)), money(0));
          if (
            !view.settlement ||
            request.amount > add(sub(view.settlement.balance, reserved), money(retry?.amount ?? 0))
          )
            throw new TillError("TENDER_OVERPAID", "MoMo amount exceeds the remaining balance");
        } else if (
          !view.draft.tenders.some((t) => t.reference === request.reference && t.status === "otp")
        ) {
          throw new TillError("PAYMENT_INVALID", "This basket is not waiting for that payment OTP");
        }
        if (
          request.type === "payment.momo.start" &&
          !view.draft.tenders.some((t) => t.reference === reference)
        )
          await applyDraftPayment(database, context, {
            scope,
            at,
            expectedRevision: request.expectedRevision,
            reference,
            amount: request.amount,
            phone: `******${request.phone.slice(-4)}`,
            phoneFingerprint,
            network: request.network,
            status: "pending",
          });
        const sent = await readHostPayment(database, config, reference);
        const path =
          request.type === "payment.momo.start"
            ? "/payments/momo"
            : `/payments/momo/${reference}/otp`;
        const body =
          request.type === "payment.momo.start"
            ? { reference, amount: request.amount, phone: request.phone, network: request.network }
            : { otp: request.otp };
        let response: Response;
        try {
          response = await fetch(new URL(path, config.upstream), {
            method: "POST",
            headers: await paymentHeaders(config),
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15_000),
          });
        } catch {
          throw new TillError(
            "PAYMENT_UNAVAILABLE",
            "MoMo is unavailable. Reconnect before retrying.",
          );
        }
        if (!response.ok)
          throw new TillError(
            "PAYMENT_UNAVAILABLE",
            "The MoMo request could not be accepted. Check the connection and retry.",
          );
        let payment: v.InferOutput<typeof momoView>;
        try {
          payment = v.parse(momoView, await response.json());
        } catch {
          throw new TillError(
            "PAYMENT_UNAVAILABLE",
            "Payment response was unreadable. Reconnect to recover its saved reference.",
          );
        }
        const current = await readDraft(database, scope, { at });
        if (!current.draft) throw new TillError("DRAFT_UNKNOWN", "Payment basket is unavailable");
        const observed = await readHostPayment(database, config, reference);
        // OTP POST returns the row captured before sending the workflow event.
        if (
          observed &&
          ["pending", "otp"].includes(payment.status) &&
          (request.type === "payment.momo.otp" ||
            payment.status === sent?.status ||
            observed.status !== sent?.status ||
            observed.failureReason !== sent?.failureReason)
        ) {
          if (
            current.draft.tenders.find((t) => t.reference === reference)?.status === observed.status
          )
            return current;
          payment = v.parse(momoView, observed);
        }
        return applyDraftPayment(database, context, {
          ...payment,
          scope,
          at,
          expectedRevision: current.draft.revision,
        });
      } finally {
        busy = false;
      }
    },
  };

  async function receive(payment: v.InferOutput<typeof momoView>, allowUnknown = false) {
    if (!config.session) return;
    const identity = config.identity;
    const known = await readHostPayment(database, config, payment.reference);
    if (!known && !allowUnknown) return;
    const scope = {
      orgId: identity.orgId,
      deviceId: identity.deviceId,
      branchId: identity.branchId,
      cashierId: config.session.userId,
    };
    const context = {
      orgId: scope.orgId,
      deviceId: scope.deviceId,
      branchId: scope.branchId,
      actorId: scope.cashierId,
      role: config.session.roleName,
      appVersion: buildInfo.version,
    };
    const at = await hostTime(database, identity, new Date());
    const retained = v.parse(
      momoView,
      await storePaymentUpdate(database, context, { scope, at, ...payment }),
    );
    if (await database.read((tx) => paymentSale(tx, scope.orgId, payment.reference))) return;
    publish({ type: "payment", payment: retained });
    try {
      const view = await readDraft(database, scope, { at });
      const tender = view.draft?.tenders.find((t) => t.reference === payment.reference);
      if (view.draft && tender) {
        if (tender.status !== retained.status)
          publish({
            type: "draft",
            view: await applyDraftPayment(database, context, {
              ...retained,
              scope,
              at,
              expectedRevision: view.draft.revision,
            }),
          });
      }
    } catch (caught) {
      if (!(caught instanceof TillError)) throw caught;
      // A changed basket cannot undo the charge; the durable intent remains visible for recovery.
    }
  }
}
