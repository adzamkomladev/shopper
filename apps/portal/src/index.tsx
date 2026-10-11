import "./styles.css";
import { createRoot } from "react-dom/client";
import { About } from "@shopper/ui/components/about";
import { createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
const rootRoute = createRootRoute();
const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: About });
const router = createRouter({ routeTree: rootRoute.addChildren([aboutRoute]) });
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
