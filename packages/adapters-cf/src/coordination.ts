import { DurableObject } from "cloudflare:workers";
// Day 1 binding only. Sequencing commands and persistence begin on Day 3.
export class StoreSequencer extends DurableObject {}
