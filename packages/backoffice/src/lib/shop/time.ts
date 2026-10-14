/**
 * Ghana keeps GMT all year (Africa/Accra is UTC+0), so shop time is UTC. A datetime-local value is
 * read as UTC and prices are shown in UTC, whatever zone the browser is in.
 */
export const SHOP_TIME_ZONE = "UTC";

export const parseShopTime = (local: string) => new Date(`${local}Z`);
