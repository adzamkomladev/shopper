export type BoxBindings = {
  requestIP?: (request: Request) => { address: string } | null;
};
